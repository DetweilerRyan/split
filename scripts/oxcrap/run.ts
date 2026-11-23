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
import { exportedTables, type Fn, parse } from './functions.ts';
import type { Tables } from './tables.ts';

/** What oxCrap needs from the world outside it. Paths it's given are absolute. */
export type Host = {
  /** The current directory, which command-line paths are read from and output is shown from. */
  cwd: string;
  /** Whether paths are compared without case, as on Windows. */
  caseInsensitive: boolean;
  exists: (path: string) => boolean;
  isDirectory: (path: string) => boolean;
  read: (path: string) => string;
  modified: (path: string) => number;
  /** The path with symlinks resolved, or the path itself when it can't be. */
  realpath: (path: string) => string;
  /** The files `globs` pick out from `root`, as files.ts finds them, and its .gitignore. */
  findFiles: (
    root: string,
    globs: string[],
    ignorePatterns: string[],
    named: string[],
  ) => { matched: string[]; scored: string[] };
};

/** What a run prints, and the status it exits with. */
export type Outcome = { status: number; stdout: string[]; stderr: string[] };

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

/** One run of oxCrap, over a host. */
class Run {
  constructor(host: Host) {
    this.host = host;
  }

  readonly host: Host;

  /** A path as the person running oxCrap would write it: from the current directory. */
  shown(path: string) {
    return toPosix(relative(this.host.cwd, path)) || '.';
  }

  /** A path from the current directory, made absolute. */
  here(path: string) {
    return resolve(this.host.cwd, path);
  }

  /**
   * A path as a key both sides of a coverage lookup agree on: real (symlinks resolved, as a test
   * run sees it), with `/` between folders, and in one case where paths aren't case-sensitive.
   */
  pathKey(path: string) {
    const key = toPosix(this.host.realpath(path));
    return this.host.caseInsensitive ? key.toLowerCase() : key;
  }

  /** The config file to read: the one `-c` names, else the first default name in this folder. */
  configFile(given: string | undefined) {
    if (!given) return CONFIG_NAMES.map((name) => this.here(name)).find(this.host.exists);
    const path = this.here(given);
    if (!this.host.exists(path)) throw new Error(`No config file at ${given}.`);
    if (this.host.isDirectory(path)) throw new Error(`${given} is a folder, not a config file.`);
    return path;
  }

  /** The config's options, refusing `files` that reach outside its folder. */
  readConfig(path: string | undefined): Partial<Config> {
    if (!path) return {};
    const options = parseConfig(this.host.read(path), this.shown(path));
    const escaping = (options.files ?? []).find(outside);
    if (escaping) {
      throw new Error(
        `${this.shown(path)}: "files" can't reach outside the config's folder, as "${escaping}" does. Move the config up to a folder that holds the files.`,
      );
    }
    return options;
  }

  /**
   * The paths given on the command line, from `root`: a glob for each folder's code files, and
   * each file as it is.
   */
  pathsFor(root: string, paths: string[]) {
    const globs: string[] = [];
    const named: string[] = [];
    for (const path of paths) {
      const from = this.pathFrom(root, path);
      if (!this.host.isDirectory(this.here(path))) named.push(from);
      else globs.push(from ? `${from}/${CODE_FILES}` : CODE_FILES);
    }
    return { globs, named };
  }

  /** One command-line path, from `root`, refused when it's missing, outside, or a glob. */
  pathFrom(root: string, path: string) {
    const absolute = this.here(path);
    if (!this.host.exists(absolute)) throw new Error(`No file or folder at ${path}.`);
    const from = toPosix(relative(root, absolute));
    if (outside(from)) {
      throw new Error(`${path} is outside ${this.shown(root)}, the folder oxCrap scores.`);
    }
    // Node's glob has no way to escape these that works on every platform.
    if (this.host.isDirectory(absolute) && /[*?[\]{}()!+@]/.test(from)) {
      throw new Error(`${path} has a glob character in its name; list it in "files" instead.`);
    }
    return from;
  }

  /** The coverage report's path: `--coverage` from here, or the config's from its folder. */
  coveragePath(given: string | undefined, configured: string | undefined, root: string) {
    if (given) return this.here(given);
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
  helpFrom(given: string | undefined, configured: string | undefined, root: string, from: string) {
    const value = given ?? configured;
    if (!value || isUrl(value)) return value;
    const path = given ? this.here(given) : resolve(root, value);
    if (!this.host.exists(path)) {
      throw new Error(
        `No help file at ${this.shown(path)}, which ${given ? '--help-url' : from} names.`,
      );
    }
    return this.shown(path);
  }

  /** The report at `path`, refused when it's missing or older than any of `files`. */
  readReport(path: string, files: string[]): Report {
    if (!this.host.exists(path)) {
      throw new Error(
        `No coverage report at ${this.shown(path)}. Run the tests with coverage first; a run whose tests fail may write none.`,
      );
    }
    const times = files.map((file) => ({ file: this.shown(file), time: this.host.modified(file) }));
    const stale = newerThan(this.host.modified(path), times);
    if (stale.length > 0) {
      const more = stale.length > 1 ? ` and ${stale.length - 1} more` : '';
      throw new Error(
        `The coverage report at ${this.shown(path)} is older than ${stale[0]}${more}. Run the tests again, so it covers the code as it is.`,
      );
    }
    return parseReport(this.host.read(path), this.shown(path));
  }

  /** Each file's coverage, by the key `pathKey` gives, refusing a report that covers none. */
  coverageByPath(sources: string[], report: Report, reportPath: string) {
    const byPath = new Map(
      Object.entries(report).map(([path, file]) => [this.pathKey(path), file]),
    );
    const covered = sources.filter((path) => byPath.has(this.pathKey(path))).length;
    if (sources.length > 0 && covered === 0) {
      throw new Error(
        `The coverage report at ${this.shown(reportPath)} covers none of the ${sources.length} files being scored. Is it the report for this code, written from this folder?`,
      );
    }
    return byPath;
  }

  /** Every finding in `sources`: the @crap-allow comments' problems, then the scores'. */
  findings(sources: string[], report: Report, reportPath: string, config: Config) {
    const byPath = this.coverageByPath(sources, report, reportPath);
    const scored: Scored[] = [];
    const allowed = new Map<Fn, Allow>();
    const problems: Finding[] = [];
    // Each imported module's tables, read once however many files import it.
    const modules = new Map<string, Tables>();
    for (const path of sources) {
      const file = this.shown(path);
      const source = this.host.read(path);
      const parsed = parse(file, source, config.counting, (from, name) =>
        tablesAt(this.host, resolveImport(this.host, path, from), modules)?.get(name),
      );
      const coverage = coverageOf(parsed.functions, byPath.get(this.pathKey(path)));
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
  score(args: string[]): Outcome {
    const { values, positionals } = parseArgs({
      args,
      allowPositionals: true,
      options: {
        config: { type: 'string', short: 'c' },
        coverage: { type: 'string' },
        'help-url': { type: 'string' },
      },
    });
    const configPath = this.configFile(values.config);
    // Paths in a config are read from its folder; paths on the command line from this one.
    const root = configPath ? dirname(configPath) : this.host.cwd;
    const fromFile = this.readConfig(configPath);
    const given = positionals.length > 0 ? this.pathsFor(root, positionals) : undefined;
    const config = merge(fromFile, { files: given?.globs });
    const coverage = this.coveragePath(values.coverage, config.coverage, root);
    const named = configPath ? `"helpUrl" in ${this.shown(configPath)}` : 'the config';
    const help = this.helpFrom(values['help-url'], config.helpUrl, root, named);
    const files = this.host.findFiles(
      root,
      config.files,
      config.ignorePatterns,
      given?.named ?? [],
    );
    if (files.scored.length === 0) {
      const where = configPath ? `"files" in ${this.shown(configPath)}` : 'the paths given';
      throw new Error(
        `No files to score: nothing matches ${where} that "ignorePatterns" leaves in.`,
      );
    }
    function absolute(file: string) {
      return isAbsolute(file) ? file : join(root, file);
    }
    const report = this.readReport(coverage, files.matched.map(absolute));
    const problems = this.findings(files.scored.map(absolute), report, coverage, config);
    return outcome(problems, help);
  }
}

/** The extensions and index files a relative import may leave off, in the order tried. */
const IMPORT_ENDINGS = ['', '.ts', '.tsx', '.mts', '.js', '.mjs', '/index.ts', '/index.tsx'];

/** The file a relative import in `importer` names, or nothing if there's none. */
export function resolveImport(host: Host, importer: string, from: string) {
  const base = resolve(dirname(importer), from);
  return IMPORT_ENDINGS.map((ending) => base + ending).find(
    (path) => host.exists(path) && !host.isDirectory(path),
  );
}

/** The tables the module at `path` exports, read once into `modules`. */
function tablesAt(host: Host, path: string | undefined, modules: Map<string, Tables>) {
  if (!path) return undefined;
  if (!modules.has(path)) modules.set(path, exportedTables(path, host.read(path)));
  return modules.get(path);
}

/** What to print for `problems`, and the status: 1 with findings, 0 without. */
export function outcome(problems: Finding[], help: string | undefined): Outcome {
  if (problems.length === 0) return { status: 0, stdout: ['No CRAP findings.'], stderr: [] };
  const lines = problems.map((f) => `- ${f.file}:${f.line} ${f.message}`);
  const stderr = [`CRAP findings:\n${lines.join('\n')}`];
  if (help) stderr.push(`\nGet help: ${help}`);
  return { status: 1, stdout: [], stderr };
}

/** Runs oxCrap with `args` over `host`. A problem that stops the run is printed, with status 1. */
export function run(args: string[], host: Host): Outcome {
  try {
    return new Run(host).score(args);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { status: 1, stdout: [], stderr: [message] };
  }
}
