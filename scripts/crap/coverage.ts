// Runs the test suite with coverage, and works out how much of each function it ran.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Fn, Range } from './functions.ts';

/** One file's entry in an istanbul JSON coverage report. */
export type FileCoverage = {
  statementMap: Record<string, Range>;
  s: Record<string, number>;
  fnMap: Record<string, { loc: Range }>;
  f: Record<string, number>;
};
export type Report = Record<string, FileCoverage>;

/** Runs `npm test` with coverage on, returning its report keyed by absolute path, or its output. */
export function runCoverage(root: string) {
  const directory = mkdtempSync(join(tmpdir(), 'splitsmart-coverage-'));
  try {
    const result = spawnSync(
      'npm',
      [
        'test',
        '--',
        '--coverage.enabled',
        '--coverage.reporter=json',
        `--coverage.reportsDirectory=${directory}`,
      ],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
      },
    );
    const output = `${result.stdout}${result.stderr}`;
    if (result.error) throw new Error(`Couldn't run npm test: ${result.error.message}`);
    if (result.status !== 0) return { passed: false as const, output };
    const path = join(directory, 'coverage-final.json');
    if (!existsSync(path)) throw new Error(`The test run wrote no coverage report:\n${output}`);
    return { passed: true as const, report: JSON.parse(readFileSync(path, 'utf8')) as Report };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const before = (a: Range['start'], b: Range['start']) =>
  a.line < b.line || (a.line === b.line && a.column <= b.column);
const contains = (outer: Range, inner: Range) =>
  before(outer.start, inner.start) && before(inner.end, outer.end);

/** The innermost of `functions` whose range holds `range`. */
function innermost(functions: Fn[], range: Range) {
  let best: Fn | undefined;
  for (const fn of functions) {
    if (
      contains(fn, range) &&
      (!best || fn.offset.end - fn.offset.start < best.offset.end - best.offset.start)
    ) {
      best = fn;
    }
  }
  return best;
}

/**
 * The share of each function's statements the tests ran, from 0 to 1. A statement counts toward
 * the innermost function holding it, as complexity is counted without nested functions. A
 * function with no statements of its own, such as a one-line arrow, counts as covered when the
 * report shows it was called. A file the report doesn't have scores 0 throughout.
 */
export function coverageOf(functions: Fn[], file: FileCoverage | undefined) {
  const statements = new Map<Fn, { total: number; run: number }>();
  const called = new Map<Fn, boolean>();
  if (file) {
    for (const [id, range] of Object.entries(file.statementMap)) {
      const owner = innermost(functions, range);
      if (!owner) continue;
      const counts = statements.get(owner) ?? { total: 0, run: 0 };
      counts.total++;
      if (file.s[id] > 0) counts.run++;
      statements.set(owner, counts);
    }
    for (const [id, fn] of Object.entries(file.fnMap)) {
      const owner = innermost(functions, fn.loc);
      if (owner) called.set(owner, (called.get(owner) ?? false) || file.f[id] > 0);
    }
  }
  const covered = new Map<Fn, number>();
  for (const fn of functions) {
    const counts = statements.get(fn);
    covered.set(
      fn,
      counts && counts.total > 0 ? counts.run / counts.total : called.get(fn) ? 1 : 0,
    );
  }
  return covered;
}
