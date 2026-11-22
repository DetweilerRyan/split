#!/usr/bin/env node
// oxCrap's command line: scores every function under the given paths by CRAP, from a coverage
// report, and fails on one over the limits without a matching @crap-allow comment. What CRAP is,
// the options and the comment's rules are in README.md beside this file; why it works this way is
// in oxcrap.meta.md, to read only when changing or questioning it.
//
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { type Allow, type Finding, findAllows } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import { coverageOf, newerThan, parseReport, type Report } from './coverage.ts';
import { type Fn, parse } from './functions.ts';

const USAGE = 'Usage: node scripts/oxcrap/oxcrap.ts --coverage <report> [--guide <doc>] <path>...';
const CODE = /\.[cm]?[jt]sx?$/;
const TEST = /\.(test|spec)\.[cm]?[jt]sx?$/;
const SKIPPED = /(^|\/)(node_modules|\.[^/]+)(\/|$)/;

/** Every file under `paths`, named from the current directory, leaving out node_modules and dot-folders. */
function files(paths: string[]) {
  const found = new Set<string>();
  for (const path of paths) {
    if (!existsSync(path)) throw new Error(`No file or folder at ${path}.`);
    const entries = statSync(path).isDirectory()
      ? readdirSync(path, { recursive: true, encoding: 'utf8' }).map((entry) => join(path, entry))
      : [path];
    for (const entry of entries) {
      const file = relative('.', entry).split(sep).join('/');
      if (!SKIPPED.test(file) && statSync(entry).isFile()) found.add(file);
    }
  }
  return [...found].sort();
}

/** The report at `path`, refused when it's missing or older than any of `all`. */
function readReport(path: string, all: string[]): Report {
  if (!existsSync(path)) {
    throw new Error(
      `No coverage report at ${path}. Run the tests with coverage first; a run whose tests fail may write none.`,
    );
  }
  const stale = newerThan(
    statSync(path).mtimeMs,
    all.map((file) => ({ file, time: statSync(file).mtimeMs })),
  );
  if (stale.length > 0) {
    const more = stale.length > 1 ? ` and ${stale.length - 1} more` : '';
    throw new Error(
      `The coverage report at ${path} is older than ${stale[0]}${more}. Run the tests again, so it covers the code as it is.`,
    );
  }
  return parseReport(readFileSync(path, 'utf8'), path);
}

function findings(sources: string[], report: Report) {
  const scored: Scored[] = [];
  const allowed = new Map<Fn, Allow>();
  const problems: Finding[] = [];
  for (const file of sources) {
    const source = readFileSync(file, 'utf8');
    const parsed = parse(file, source);
    const coverage = coverageOf(parsed.functions, report[resolve(file)]);
    for (const fn of parsed.functions) {
      const covered = coverage.get(fn) ?? 0;
      scored.push({ fn, file, coverage: covered, crap: crapOf(fn.complexity, covered) });
    }
    const allows = findAllows(file, source, parsed);
    for (const [fn, allow] of allows.allowed) allowed.set(fn, allow);
    problems.push(...allows.problems);
  }
  return [...problems, ...check(scored, allowed)];
}

function main(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { coverage: { type: 'string' }, guide: { type: 'string' } },
  });
  if (!values.coverage || positionals.length === 0) throw new Error(USAGE);

  const all = files(positionals);
  const report = readReport(values.coverage, all);
  const problems = findings(
    all.filter((file) => CODE.test(file) && !TEST.test(file)),
    report,
  );
  if (problems.length) {
    console.error(
      `CRAP findings:\n${problems.map((f) => `- ${f.file}:${f.line} ${f.message}`).join('\n')}`,
    );
    if (values.guide) console.error(`\nFollow ${values.guide} to respond.`);
    return 1;
  }
  console.log('No CRAP findings.');
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
