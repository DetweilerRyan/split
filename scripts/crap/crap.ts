#!/usr/bin/env node
// Scores each function under the given paths by CRAP: complexity² × (1 − coverage)³ + complexity,
// where complexity is counted by complexity.ts and coverage comes from the istanbul JSON report
// it's given. It fails when a function the branch changes is over the limits in check.ts, unless
// a `// @crap-allow` comment directly above it gives its current numbers and a reason; and when any
// @crap-allow comment's numbers no longer match its function. It never runs the tests, and never
// writes to source files. Why it works this way is in crap.meta.md beside it; read that only when
// changing or questioning it.
//
// Usage, from anywhere in the repository:
//   node scripts/crap/crap.ts --coverage <report> [--base <ref>] [--guide <doc>] <path>...
//     --coverage  an istanbul JSON report, such as coverage/coverage-final.json, written by a test
//                 run of the code as it is now
//     --base      the ref to find changed functions against (default origin/main)
//     --guide     a document to point to from the findings, such as a procedure for responding
//     <path>      the folders or files whose functions are scored, from the current directory
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { type Allow, type Finding, findAllows } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import { coverageOf, newerThan, parseReport, type Report } from './coverage.ts';
import { changedLines, git } from './diff.ts';
import { type Fn, parse } from './functions.ts';

const USAGE =
  'Usage: node scripts/crap/crap.ts --coverage <report> [--base <ref>] [--guide <doc>] <path>...';
const CODE = /\.[cm]?[jt]sx?$/;
const TEST = /\.(test|spec)\.[cm]?[jt]sx?$/;

/** The files git knows under `paths`, tracked or new, that exist in the working tree. */
function files(root: string, paths: string[]) {
  return git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '--', ...paths)
    .split('\n')
    .filter((file) => file && existsSync(join(root, file)));
}

/** The report at `path`, refused when it's missing or older than any file under `paths`. */
function readReport(root: string, path: string, paths: string[]): Report {
  if (!existsSync(path)) {
    throw new Error(
      `No coverage report at ${path}. Run the tests with coverage first; a run whose tests fail may write none.`,
    );
  }
  const stale = newerThan(
    statSync(path).mtimeMs,
    files(root, paths).map((file) => ({ file, time: statSync(join(root, file)).mtimeMs })),
  );
  if (stale.length > 0) {
    const more = stale.length > 1 ? ` and ${stale.length - 1} more` : '';
    throw new Error(
      `The coverage report at ${path} is older than ${stale[0]}${more}. Run the tests again, so it covers the code as it is.`,
    );
  }
  return parseReport(readFileSync(path, 'utf8'), path);
}

function findings(root: string, base: string, paths: string[], report: Report) {
  const scored: Scored[] = [];
  const allowed = new Map<Fn, Allow>();
  const problems: Finding[] = [];
  for (const file of files(root, paths).filter((f) => CODE.test(f) && !TEST.test(f))) {
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
  const result = check(scored, allowed, changedLines(root, base, paths));
  return { problems: [...problems, ...result.problems], notices: result.notices };
}

const list = (items: Finding[]) =>
  items.map((f) => `- ${f.file}:${f.line} ${f.message}`).join('\n');

function main(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      coverage: { type: 'string' },
      base: { type: 'string', default: 'origin/main' },
      guide: { type: 'string' },
    },
  });
  if (!values.coverage || positionals.length === 0) throw new Error(USAGE);

  const root = git(process.cwd(), 'rev-parse', '--show-toplevel');
  // git reports paths from the repository root, so name the scored paths the same way.
  const paths = positionals.map((path) => relative(root, resolve(path)) || '.');
  const report = readReport(root, resolve(values.coverage), paths);
  const { problems, notices } = findings(root, values.base, paths, report);

  for (const notice of notices) {
    console.log(
      process.env.GITHUB_ACTIONS
        ? `::warning file=${notice.file},line=${notice.line}::${notice.message}`
        : `Notice: ${notice.file}:${notice.line} ${notice.message}`,
    );
  }
  if (problems.length) {
    console.error(`CRAP findings, checked against ${values.base}:\n${list(problems)}`);
    if (values.guide) console.error(`\nFollow ${values.guide} to respond.`);
    return 1;
  }
  console.log(`No CRAP findings, checked against ${values.base}.`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
