// oxCrap's command line as a function: reads the config, the paths and the coverage report through
// a `Host`, scores each function, and returns what to print and the exit status. oxcrap.ts gives it
// the real file system; a test gives it files in memory. The rules are in README.md beside this
// file; why it works this way is in oxcrap.meta.md.
import { dirname, isAbsolute, join, posix as posixPath, relative, resolve, sep } from 'node:path';
import { parseArgs } from 'node:util';
import { type Allow, type Finding, findAllows } from './allow.ts';
import { check, crapOf, type Scored } from './check.ts';
import { CODE_FILES, CONFIG_NAMES, type Config, merge, parseConfig } from './config.ts';
import { coverageOf, newerThan, parseReport, type Report } from './coverage.ts';
import { type Fn, moduleExports, parse } from './functions.ts';
import type { Exports } from './tables.ts';

/** What oxCrap needs from the world outside it. Paths it's given are absolute. */
export type Host = {
  /** The current directory, which command-line paths are read from and output is shown from. */
  readonly cwd: string;
  /** Whether paths are compared without case, as on Windows. */
  readonly caseInsensitive: boolean;
  readonly exists: (path: string) => boolean;
  readonly isDirectory: (path: string) => boolean;
  readonly read: (path: string) => string;
  readonly modified: (path: string) => number;
  /** The path with symlinks resolved, or the path itself when it can't be. */
  readonly realpath: (path: string) => string;
  /** The files `globs` pick out from `root`, as files.ts finds them, and its .gitignore. */
  readonly findFiles: (
    root: string,
    globs: readonly string[],
    ignorePatterns: readonly string[],
    named: readonly string[],
  ) => { readonly matched: readonly string[]; readonly scored: readonly string[] };
};

/** What a run prints, and the status it exits with. */
export type Outcome = {
  readonly status: number;
  readonly stdout: readonly string[];
  readonly stderr: readonly string[];
};

export const USAGE =
  'Usage: node scripts/oxcrap/oxcrap.ts [-c <config>] [--coverage <report>] [--help-url <url>] [<path>...]';

function toPosix(path: string) {
  return path.split(sep).join('/');
}

/**
 * Whether a path or glob, from the scored folder, reaches outside it. A config covers the folder
 * it's in, as oxlint's does.
 */
export function outside(path: string) {
  return (
    /(^|[/{,])\.\.(?=[/},]|$)/.test(path) || posixPath.isAbsolute(path) || /^[a-z]:/i.test(path)
  );
}

/** Whether a help value is a URL, such as https://…, rather than a path. */
export function isUrl(value: string) {
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

/** A path as the person running oxCrap would write it: from the current directory. */
function shown(host: Host, path: string) {
  return toPosix(relative(host.cwd, path)) || '.';
}

/** A path from the current directory, made absolute. */
function here(host: Host, path: string) {
  return resolve(host.cwd, path);
}

/**
 * A path as a key both sides of a coverage lookup agree on: real (symlinks resolved, as a test
 * run sees it), with `/` between folders, and in one case where paths aren't case-sensitive.
 */
function pathKey(host: Host, path: string) {
  const key = toPosix(host.realpath(path));
  return host.caseInsensitive ? key.toLowerCase() : key;
}

/** The config file to read: the one `-c` names, else the first default name in this folder. */
function configFile(host: Host, given: string | undefined) {
  if (!given) return CONFIG_NAMES.map((name) => here(host, name)).find(host.exists);
  const path = here(host, given);
  if (!host.exists(path)) throw new Error(`No config file at ${given}.`);
  if (host.isDirectory(path)) throw new Error(`${given} is a folder, not a config file.`);
  return path;
}

/** The config's options, refusing `files` that reach outside its folder. */
function readConfig(host: Host, path: string | undefined): Partial<Config> {
  if (!path) return {};
  const options = parseConfig(host.read(path), shown(host, path));
  const escaping = options.files?.find(outside);
  if (escaping) {
    throw new Error(
      `${shown(host, path)}: "files" can't reach outside the config's folder, as "${escaping}" does. Move the config up to a folder that holds the files.`,
    );
  }
  return options;
}

/**
 * The paths given on the command line, from `root`: a glob for each folder's code files, and
 * each file as it is.
 */
function pathsFor(host: Host, root: string, paths: readonly string[]) {
  const globs: string[] = [];
  const named: string[] = [];
  for (const path of paths) {
    const from = pathFrom(host, root, path);
    if (!host.isDirectory(here(host, path))) named.push(from);
    else globs.push(from ? `${from}/${CODE_FILES}` : CODE_FILES);
  }
  return { globs, named };
}

/** One command-line path, from `root`, refused when it's missing, outside, or a glob. */
function pathFrom(host: Host, root: string, path: string) {
  const absolute = here(host, path);
  if (!host.exists(absolute)) throw new Error(`No file or folder at ${path}.`);
  const from = toPosix(relative(root, absolute));
  if (outside(from)) {
    throw new Error(`${path} is outside ${shown(host, root)}, the folder oxCrap scores.`);
  }
  // Node's glob has no way to escape these that works on every platform.
  if (host.isDirectory(absolute) && /[*?[\]{}()!+@]/.test(from)) {
    throw new Error(`${path} has a glob character in its name; list it in "files" instead.`);
  }
  return from;
}

/** The coverage report's path: `--coverage` from here, or the config's from its folder. */
function coveragePath(
  host: Host,
  given: string | undefined,
  configured: string | undefined,
  root: string,
) {
  if (given) return here(host, given);
  if (configured) return resolve(root, configured);
  throw new Error(
    `${USAGE}\nGive the coverage report with --coverage, or as "coverage" in ${CONFIG_NAMES[0]}.`,
  );
}

/**
 * The help to print under findings, as commitlint's helpUrl is: a URL as it is, or a path, which
 * must exist, shown from the current directory. `--help-url` is read from here; the config's
 * `helpUrl` from the config's folder, which `from` names.
 */
function helpFrom(
  host: Host,
  given: string | undefined,
  configured: string | undefined,
  root: string,
  from: string,
) {
  const value = given ?? configured;
  if (!value || isUrl(value)) return value;
  const path = given ? here(host, given) : resolve(root, value);
  if (!host.exists(path)) {
    throw new Error(
      `No help file at ${shown(host, path)}, which ${given ? '--help-url' : from} names.`,
    );
  }
  return shown(host, path);
}

/** The report at `path`, refused when it's missing or older than any of `files`. */
function readReport(host: Host, path: string, files: readonly string[]): Report {
  if (!host.exists(path)) {
    throw new Error(
      `No coverage report at ${shown(host, path)}. Run the tests with coverage first; a run whose tests fail may write none.`,
    );
  }
  const times = files.map((file) => ({ file: shown(host, file), time: host.modified(file) }));
  const stale = newerThan(host.modified(path), times);
  if (stale.length > 0) {
    const more = stale.length > 1 ? ` and ${stale.length - 1} more` : '';
    throw new Error(
      `The coverage report at ${shown(host, path)} is older than ${stale[0]}${more}. Run the tests again, so it covers the code as it is.`,
    );
  }
  return parseReport(host.read(path), shown(host, path));
}

/** Each file's coverage, by the key `pathKey` gives, refusing a report that covers none. */
function coverageByPath(
  host: Host,
  sources: readonly string[],
  report: Report,
  reportPath: string,
) {
  const byPath = new Map(Object.entries(report).map(([path, file]) => [pathKey(host, path), file]));
  const covered = sources.filter((path) => byPath.has(pathKey(host, path))).length;
  // `score` has stopped already when there are no files to score.
  if (covered === 0) {
    throw new Error(
      `The coverage report at ${shown(host, reportPath)} covers none of the ${sources.length} files being scored. Is it the report for this code, written from this folder?`,
    );
  }
  return byPath;
}

/** Every finding in `sources`: the @crap-allow comments' problems, then the scores'. */
function findings(
  host: Host,
  sources: readonly string[],
  report: Report,
  reportPath: string,
  config: Config,
) {
  const byPath = coverageByPath(host, sources, report, reportPath);
  const scored: Scored[] = [];
  const allowed = new Map<Fn, Allow>();
  const problems: Finding[] = [];
  // Each imported module's exports, read once however many files import it.
  const modules = new Map<string, Exports>();
  for (const path of sources) {
    const file = shown(host, path);
    const source = host.read(path);
    const parsed = parse(file, source, config.counting, (from) =>
      exportsAt(host, resolveImport(host, path, from), modules),
    );
    const coverage = coverageOf(parsed.functions, byPath.get(pathKey(host, path)));
    for (const fn of parsed.functions) {
      const share = coverage.get(fn) ?? 0;
      scored.push({ fn, file, coverage: share, crap: crapOf(fn.complexity, share) });
    }
    const allows = findAllows(file, source, parsed);
    for (const [fn, allow] of allows.allowed) allowed.set(fn, allow);
    problems.push(...allows.problems);
  }
  return [...problems, ...check(scored, allowed, config.limits)];
}

/** The whole run: options, config, files and report, then the findings to print. */
function score(host: Host, args: readonly string[]): Outcome {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      config: { type: 'string', short: 'c' },
      coverage: { type: 'string' },
      'help-url': { type: 'string' },
    },
  });
  const configPath = configFile(host, values.config);
  // Paths in a config are read from its folder; paths on the command line from this one.
  const root = configPath ? dirname(configPath) : host.cwd;
  const fromFile = readConfig(host, configPath);
  const given = positionals.length > 0 ? pathsFor(host, root, positionals) : undefined;
  const config = merge(fromFile, { files: given?.globs });
  const coverage = coveragePath(host, values.coverage, config.coverage, root);
  // Stryker disable next-line StringLiteral: only a config file can give `helpUrl`, so with no config file this name is never shown.
  const named = configPath ? `"helpUrl" in ${shown(host, configPath)}` : 'the config';
  const help = helpFrom(host, values['help-url'], config.helpUrl, root, named);
  const files = host.findFiles(root, config.files, config.ignorePatterns, given?.named ?? []);
  if (files.scored.length === 0) {
    const where = configPath ? `"files" in ${shown(host, configPath)}` : 'the paths given';
    throw new Error(`No files to score: nothing matches ${where} that "ignorePatterns" leaves in.`);
  }
  function absolute(file: string) {
    return isAbsolute(file) ? file : join(root, file);
  }
  const report = readReport(host, coverage, files.matched.map(absolute));
  const problems = findings(host, files.scored.map(absolute), report, coverage, config);
  return outcome(problems, help);
}

/** The extensions and index files a relative import may leave off, in the order tried. */
const IMPORT_ENDINGS: readonly string[] = [
  '',
  '.ts',
  '.tsx',
  '.mts',
  '.js',
  '.mjs',
  '/index.ts',
  '/index.tsx',
];

/**
 * The file a relative import in `importer` names, or nothing if there's none. A `.js` name also
 * finds the `.ts` file it compiles from, as TypeScript resolves it.
 */
export function resolveImport(host: Host, importer: string, from: string) {
  const base = resolve(dirname(importer), from);
  const stems = [base, base.replace(/\.(m?)js(x?)$/, '.$1ts$2')];
  return stems
    .flatMap((stem) => IMPORT_ENDINGS.map((ending) => stem + ending))
    .find((path) => host.exists(path) && !host.isDirectory(path));
}

/** What the module at `path` exports, read once into `modules`. */
// oxlint-disable-next-line readonly/types -- `modules` is the cache exportsAt fills, so each module is read once.
function exportsAt(host: Host, path: string | undefined, modules: Map<string, Exports>) {
  if (!path) return undefined;
  if (!modules.has(path)) modules.set(path, moduleExports(path, host.read(path)));
  return modules.get(path);
}

/** What to print for `problems`, and the status: 1 with findings, 0 without. */
export function outcome(problems: readonly Finding[], help: string | undefined): Outcome {
  if (problems.length === 0) return { status: 0, stdout: ['No CRAP findings.'], stderr: [] };
  const lines = problems.map((f) => `- ${f.file}:${f.line} ${f.message}`);
  const stderr = [`CRAP findings:\n${lines.join('\n')}`];
  if (help) stderr.push(`\nGet help: ${help}`);
  return { status: 1, stdout: [], stderr };
}

/** Runs oxCrap with `args` over `host`. A problem that stops the run is printed, with status 1. */
export function run(args: readonly string[], host: Host): Outcome {
  try {
    return score(host, args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 1, stdout: [], stderr: [message] };
  }
}
