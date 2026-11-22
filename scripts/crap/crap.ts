#!/usr/bin/env node
// Scores each function in src/ and app/ by CRAP: complexity² × (1 − coverage)³ + complexity,
// where complexity is counted by complexity.ts and coverage is the share of the function's
// statements the Vitest suite runs. It fails when a function the branch changes is over the
// limits in check.ts, unless a `// @crap-allow` comment directly above it gives its current
// numbers and a reason; and when any @crap-allow comment's numbers no longer match its function.
// It never writes to source files. docs/engineering/crap.md says what to do with a finding. Why
// it works this way is in crap.meta.md beside it; read that only when changing or questioning it.
//
// Usage, from the repository root:
//   node scripts/crap/crap.ts [--base <ref>]  check against <ref> (default origin/main)
//   node scripts/crap/crap.ts --hook          Claude Code Stop hook; reads its input on stdin
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type Allow, type Finding, findAllows } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import { coverageOf, type Report, runCoverage } from './coverage.ts';
import { changedLines, git } from './diff.ts';
import { type Fn, parse } from './functions.ts';

const SCORED = ['src', 'app'];
const PROCEDURE = 'docs/engineering/crap.md';

/** The JavaScript and TypeScript files in src/ and app/, tests left out. */
function sourceFiles(root: string) {
  return git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '--', ...SCORED)
    .split('\n')
    .filter(
      (file) =>
        /\.[cm]?[jt]sx?$/.test(file) &&
        !/\.test\.[cm]?[jt]sx?$/.test(file) &&
        existsSync(join(root, file)),
    );
}

function findings(root: string, base: string, report: Report) {
  const scored: Scored[] = [];
  const allowed = new Map<Fn, Allow>();
  const problems: Finding[] = [];
  for (const file of sourceFiles(root)) {
    const source = readFileSync(join(root, file), 'utf8');
    const parsed = parse(file, source);
    const coverage = coverageOf(parsed.functions, report[resolve(root, file)]);
    for (const fn of parsed.functions) {
      const covered = coverage.get(fn) ?? 0;
      scored.push({ fn, file, coverage: covered, crap: crapOf(fn.complexity, covered) });
    }
    const allows = findAllows(file, source, parsed);
    for (const [fn, allow] of allows.allowed) allowed.set(fn, allow);
    problems.push(...allows.problems);
  }
  const result = check(scored, allowed, changedLines(root, base, SCORED));
  return { problems: [...problems, ...result.problems], notices: result.notices };
}

const tail = (text: string, lines: number) => text.trimEnd().split('\n').slice(-lines).join('\n');
const list = (items: Finding[]) =>
  items.map((f) => `- ${f.file}:${f.line} ${f.message}`).join('\n');

function hook(input: { cwd?: string; stop_hook_active?: boolean }) {
  // Advise once: when Claude is already continuing because of a stop hook, let it stop.
  if (input.stop_hook_active) return undefined;
  const root = git(input.cwd ?? process.cwd(), 'rev-parse', '--show-toplevel');
  const base = ['origin/main', 'main'].find(
    (ref) =>
      spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: root })
        .status === 0,
  );
  if (!base) return `The CRAP check couldn't find origin/main or main to compare with.`;
  if (changedLines(root, base, SCORED).size === 0) return undefined;

  const sections: string[] = [];
  const lint = spawnSync('npm', ['run', 'lint'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  if (lint.status !== 0) {
    sections.push(
      `\`npm run lint\` fails. Fix it first:\n${tail(`${lint.stdout}${lint.stderr}`, 40)}`,
    );
  }
  const tests = runCoverage(root);
  if (!tests.passed) {
    sections.push(
      `\`npm test\` fails, so no CRAP score was calculated this run. Fix the tests first:\n${tail(tests.output, 60)}`,
    );
  } else {
    const { problems, notices } = findings(root, base, tests.report);
    if (problems.length) sections.push(`CRAP findings:\n${list(problems)}`);
    if (notices.length) {
      sections.push(`@crap-allow comments this branch changes:\n${list(notices)}`);
    }
  }
  if (sections.length === 0) return undefined;
  return `${sections.join('\n\n')}\n\nFollow ${PROCEDURE} to respond. This is advice; CI fails on each CRAP finding.`;
}

function main(args: string[]) {
  const { values: options } = parseArgs({
    args,
    options: {
      base: { type: 'string', default: 'origin/main' },
      hook: { type: 'boolean', default: false },
    },
  });

  if (options.hook) {
    let message: string | undefined;
    try {
      const stdin = readFileSync(0, 'utf8').trim();
      message = hook(stdin ? JSON.parse(stdin) : {});
    } catch (error) {
      message = `The CRAP check couldn't run: ${error instanceof Error ? error.message : String(error)}`;
    }
    if (message) {
      console.log(
        JSON.stringify({
          hookSpecificOutput: { hookEventName: 'Stop', additionalContext: message },
        }),
      );
    }
    return 0;
  }

  const root = process.cwd();
  const tests = runCoverage(root);
  if (!tests.passed) {
    console.error(`${tail(tests.output, 60)}\n\nThe tests fail, so no CRAP score was calculated.`);
    return 1;
  }
  const { problems, notices } = findings(root, options.base, tests.report);
  for (const notice of notices) {
    console.log(
      process.env.GITHUB_ACTIONS
        ? `::warning file=${notice.file},line=${notice.line}::${notice.message}`
        : `Notice: ${notice.file}:${notice.line} ${notice.message}`,
    );
  }
  if (problems.length) {
    console.error(`CRAP findings, checked against ${options.base}:\n${list(problems)}`);
    console.error(`\nFollow ${PROCEDURE} to respond.`);
    return 1;
  }
  console.log(`No CRAP findings, checked against ${options.base}.`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
