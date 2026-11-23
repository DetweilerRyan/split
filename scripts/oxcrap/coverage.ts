// Reads an istanbul JSON coverage report, and works out how much of each function it ran. The
// script never runs the tests itself: whatever runs them writes the report it's given.
import type { Fn, Range } from './functions.ts';

/** One file's entry in an istanbul JSON coverage report. */
export type FileCoverage = {
  statementMap: Record<string, Range>;
  s: Record<string, number>;
  fnMap: Record<string, { loc: Range }>;
  f: Record<string, number>;
};
export type Report = Record<string, FileCoverage>;

/** Reads a report's text, keyed by absolute path as istanbul writes it, or says what's wrong. */
export function parseReport(text: string, path: string): Report {
  let report: unknown;
  try {
    report = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} isn't a JSON coverage report: ${(error as Error).message}`);
  }
  const files = report && typeof report === 'object' ? Object.values(report) : [];
  if (
    Array.isArray(report) ||
    files.some((file) => !file?.statementMap || !file?.s || !file?.fnMap || !file?.f)
  ) {
    throw new Error(`${path} isn't an istanbul JSON coverage report, such as coverage-final.json.`);
  }
  return report as Report;
}

/**
 * The files changed after the report was written, newest first, so a report made before the
 * latest edits isn't mistaken for one that covers them.
 */
export function newerThan(reportTime: number, files: { file: string; time: number }[]) {
  return files
    .filter((f) => f.time > reportTime)
    .sort((a, b) => b.time - a.time)
    .map((f) => f.file);
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
 * the innermost of `functions` holding it: with `enclosing` counting only outermost functions are
 * passed, so it's the outermost function around it, as complexity counts nested functions. A
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
