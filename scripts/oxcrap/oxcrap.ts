#!/usr/bin/env node
// oxCrap's command line: scores every function its config picks out by CRAP, from a coverage
// report, and fails on one over the limits without a matching @crap-allow comment. What CRAP is,
// the options, the config file and the comment's rules are in README.md beside this file; why it
// works this way is in oxcrap.meta.md, to read only when changing or questioning it.
//
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { type Allow, type Finding, findAllows } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import { CODE_FILES, CONFIG_NAMES, type Config, merge, parseConfig } from './config.ts';
import { coverageOf, newerThan, parseReport, type Report } from './coverage.ts';
import { findFiles, gitignoreIn } from './files.ts';
import { type Fn, parse } from './functions.ts';

const USAGE =
  'Usage: node scripts/oxcrap/oxcrap.ts [-c <config>] [--coverage <report>] [--help-url <url>] [<path>...]';

const posix = (path: string) => path.split(sep).join('/');
/** A path as the person running oxCrap would write it: from the current directory. */
const shown = (path: string) => posix(relative('.', path)) || '.';

/**
 * Whether a path or glob, from the scored folder, reaches outside it. A config covers the folder
 * it's in, as oxlint's does.
 */
const outside = (path: string) => path === '..' || path.startsWith('../') || path.startsWith('/');

/** Whether a help value is a URL, such as https://…, rather than a path. */
const isUrl = (value: string) => /^[a-z][a-z0-9+.-]*:\/\//i.test(value);

/**
 * The help to print under findings, as commitlint's helpUrl is: a URL as it is, or a path, which
 * must exist, shown from the current directory. `--help-url` is read from here; the config's
 * `helpUrl` from the config's folder.
 */
function helpFrom(
  given: string | undefined,
  configured: string | undefined,
  root: string,
  from: string,
) {
  const value = given ?? configured;
  if (!value || isUrl(value)) return value;
  const path = given ? resolve(given) : resolve(root, value);
  if (!existsSync(path)) {
    throw new Error(`No help file at ${shown(path)}, which ${given ? '--help-url' : from} names.`);
  }
  return shown(path);
}

/** The config file to read: the one `-c` names, else the first default name in this directory. */
function configFile(given: string | undefined) {
  if (given) {
    if (!existsSync(given)) throw new Error(`No config file at ${given}.`);
    return given;
  }
  return CONFIG_NAMES.find((name) => existsSync(name));
}

/**
 * The paths given on the command line, from `root`: a glob for each folder's code files, and each
 * file as it is.
 */
function pathsFor(root: string, paths: string[]) {
  const globs: string[] = [];
  const named: string[] = [];
  for (const path of paths) {
    if (!existsSync(path)) throw new Error(`No file or folder at ${path}.`);
    const from = posix(relative(root, resolve(path)));
    if (outside(from)) {
      throw new Error(`${path} is outside ${shown(root)}, the folder oxCrap scores.`);
    }
    if (!statSync(path).isDirectory()) {
      named.push(from);
    } else if (/[*?[\]{}()!+@]/.test(from)) {
      // Node's glob has no way to escape these that works on every platform.
      throw new Error(`${path} has a glob character in its name; list it in "files" instead.`);
    } else {
      globs.push(from ? `${from}/${CODE_FILES}` : CODE_FILES);
    }
  }
  return { globs, named };
}

/** The report at `path`, refused when it's missing or older than any of `files`. */
function readReport(path: string, files: string[]): Report {
  if (!existsSync(path)) {
    throw new Error(
      `No coverage report at ${shown(path)}. Run the tests with coverage first; a run whose tests fail may write none.`,
    );
  }
  const stale = newerThan(
    statSync(path).mtimeMs,
    files.map((file) => ({ file: shown(file), time: statSync(file).mtimeMs })),
  );
  if (stale.length > 0) {
    const more = stale.length > 1 ? ` and ${stale.length - 1} more` : '';
    throw new Error(
      `The coverage report at ${shown(path)} is older than ${stale[0]}${more}. Run the tests again, so it covers the code as it is.`,
    );
  }
  return parseReport(readFileSync(path, 'utf8'), shown(path));
}

function findings(sources: string[], report: Report, config: Config) {
  const scored: Scored[] = [];
  const allowed = new Map<Fn, Allow>();
  const problems: Finding[] = [];
  for (const path of sources) {
    const file = shown(path);
    const source = readFileSync(path, 'utf8');
    const parsed = parse(file, source);
    const coverage = coverageOf(parsed.functions, report[path]);
    for (const fn of parsed.functions) {
      const covered = coverage.get(fn) ?? 0;
      scored.push({ fn, file, coverage: covered, crap: crapOf(fn.complexity, covered) });
    }
    const allows = findAllows(file, source, parsed);
    for (const [fn, allow] of allows.allowed) allowed.set(fn, allow);
    problems.push(...allows.problems);
  }
  return [...problems, ...check(scored, allowed, config.limits)];
}

function main(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: { type: 'string', short: 'c' },
      coverage: { type: 'string' },
      'help-url': { type: 'string' },
    },
  });

  const configPath = configFile(values.config);
  const fromFile = configPath
    ? parseConfig(readFileSync(configPath, 'utf8'), shown(configPath))
    : {};
  // Paths in a config are read from its folder; paths on the command line from this one.
  const root = configPath ? dirname(resolve(configPath)) : resolve('.');
  const escaping = (fromFile.files ?? []).find(outside);
  if (escaping && configPath) {
    throw new Error(
      `${shown(configPath)}: "files" can't reach outside the config's folder, as "${escaping}" does. Move the config up to a folder that holds the files.`,
    );
  }
  const given = positionals.length > 0 ? pathsFor(root, positionals) : undefined;
  const config = merge(fromFile, { files: given?.globs });
  const coverage = values.coverage
    ? resolve(values.coverage)
    : config.coverage
      ? resolve(root, config.coverage)
      : undefined;
  if (!coverage) {
    throw new Error(
      `${USAGE}\nGive the coverage report with --coverage, or as "coverage" in ${CONFIG_NAMES[0]}.`,
    );
  }

  const help = helpFrom(
    values['help-url'],
    config.helpUrl,
    root,
    configPath ? `"helpUrl" in ${shown(configPath)}` : 'the config',
  );
  const { matched, scored } = findFiles(
    root,
    config.files,
    config.ignorePatterns,
    given?.named,
    gitignoreIn(root),
  );
  if (scored.length === 0) {
    const where = configPath ? `"files" in ${shown(configPath)}` : 'the paths given';
    throw new Error(`No files to score: nothing matches ${where} that "ignorePatterns" leaves in.`);
  }
  const absolute = (file: string) => join(root, file);
  const report = readReport(coverage, matched.map(absolute));
  const problems = findings(scored.map(absolute), report, config);

  if (problems.length) {
    console.error(
      `CRAP findings:\n${problems.map((f) => `- ${f.file}:${f.line} ${f.message}`).join('\n')}`,
    );
    if (help) console.error(`\nGet help: ${help}`);
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
