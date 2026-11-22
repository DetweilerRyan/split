#!/usr/bin/env node
// Scores each function in src/ and app/ by CRAP: complexity² × (1 − coverage)³ + complexity,
// where complexity is oxlint's cyclomatic complexity and coverage is the share of the function's
// statements the Vitest suite runs. It fails when a function the branch changes scores over the
// limits below, unless the baseline file already records it at that score or higher.
// docs/engineering/crap.md says what to do with a finding. Why the script works this way is in
// crap.meta.md beside it; read that only when changing or questioning the script.
//
// Usage, from the repository root, where <file> is the baseline's path from the root:
//   node scripts/crap.ts --baseline <file> [--base <ref>]  check functions changed since <ref>
//                                                          (default origin/main)
//   node scripts/crap.ts --baseline <file> --hook          Claude Code Stop hook; reads its input
//                                                          on stdin
//   node scripts/crap.ts --baseline <file> --write-baseline  rewrite the baseline from every
//                                                          function's score, keeping its comments
// `npm run crap` passes the repository's baseline. Node runs this as TypeScript by stripping the
// types, so use only syntax that erases: no enums, namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const MAX_CRAP = 30;
const MAX_COMPLEXITY = 10;
const SCORED = ['src', 'app'];
const PROCEDURE = 'docs/engineering/crap.md';
const REWRITE = '`npm run crap -- --write-baseline`';
const HEADER = [
  '// Functions over the CRAP limits when they were last measured, written by',
  '// `npm run crap -- --write-baseline`. docs/engineering/crap.md says when to change it.',
  '// Give the reason a function stays over the limits in // comments on the lines above its',
  '// entry. Rewriting the file keeps them.',
];
const oxlint = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url));

type Position = { line: number; column: number };
type Range = { start: Position; end: Position };
type Scored = Range & {
  file: string;
  key: string;
  complexity: number;
  coverage: number;
  crap: number;
};
type Entry = { crap: number; complexity: number };
type Baseline = Record<string, Entry>;
/** A baseline file: its header comments, and each entry with the comments above it. */
type BaselineFile = { header: string[]; entries: Map<string, Entry & { comments: string[] }> };
type FileCoverage = {
  statementMap: Record<string, Range>;
  s: Record<string, number>;
  fnMap: Record<string, { loc: Range }>;
  f: Record<string, number>;
};

class CheckError extends Error {}

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  if (result.error) throw new CheckError(`Couldn't run ${command}: ${result.error.message}`);
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    stdout: result.stdout,
  };
}

function git(cwd: string, ...args: string[]) {
  const result = run('git', args, cwd);
  if (result.status !== 0) throw new CheckError(`git ${args.join(' ')} failed:\n${result.output}`);
  return result.stdout.trim();
}

const before = (a: Position, b: Position) =>
  a.line < b.line || (a.line === b.line && a.column <= b.column);
const contains = (outer: Range, inner: Range) =>
  before(outer.start, inner.start) && before(inner.end, outer.end);

/** Turns a byte offset, which is what oxlint reports, into a 1-based line and 0-based column. */
function position(source: Buffer, offset: number): Position {
  const lineStart = source.lastIndexOf(10, offset - 1) + 1;
  let line = 1;
  for (let i = source.indexOf(10); i !== -1 && i < offset; i = source.indexOf(10, i + 1)) line++;
  return { line, column: source.subarray(lineStart, offset).toString('utf8').length };
}

/**
 * Names a function oxlint calls anonymous by what the code before it on its line says, so the
 * name stays the same when other functions are added around it: `seed.items.forEach((item) =>`
 * gives "seed.items.forEach callback", and `onSave: () =>` or `const onSave = () =>` gives "onSave".
 */
function anonymousName(source: Buffer, offset: number) {
  const lineStart = source.lastIndexOf(10, offset - 1) + 1;
  const before = source.subarray(lineStart, offset).toString('utf8');
  const callee = /([\w$.]+)(?:<[^>]*>)?\(\s*(?:[^()]*,\s*)?(?:async\s*)?$/.exec(before);
  if (callee) return `${callee[1]} callback`;
  const assigned = /([\w$]+)\s*(?::[^=]*)?[:=]\s*(?:async\s*)?$/.exec(before);
  return assigned ? assigned[1] : '(anonymous)';
}

const COMPLEXITY_MESSAGE =
  /^[a-z ]+?(?: `([^`]+)`)? has a complexity of (\d+)\. Maximum allowed is 0\.$/;

type Found = Range & { file: string; name: string; complexity: number; span: number };

/** Every function's complexity, from oxlint's `complexity` rule with a maximum of 0. */
function complexities(root: string): Found[] {
  const directory = mkdtempSync(join(tmpdir(), 'splitsmart-crap-'));
  try {
    const config = join(directory, 'oxlintrc.json');
    writeFileSync(
      config,
      JSON.stringify({ rules: { 'eslint/complexity': ['error', { max: 0 }] } }),
    );
    const paths = SCORED.filter((path) => existsSync(join(root, path)));
    if (paths.length === 0) return [];
    const { output, stdout } = run(oxlint, ['-c', config, '--format', 'json', ...paths], root);
    let report: {
      diagnostics?: {
        code?: string;
        message: string;
        filename: string;
        labels?: { span: { offset: number; length: number } }[];
      }[];
    };
    try {
      report = JSON.parse(stdout);
    } catch {
      throw new CheckError(`oxlint didn't print a JSON report:\n${output}`);
    }
    if (!Array.isArray(report.diagnostics))
      throw new CheckError(`oxlint's report has no diagnostics:\n${output}`);

    const sources = new Map<string, Buffer>();
    const found: Found[] = [];
    for (const diagnostic of report.diagnostics) {
      if (!diagnostic.code)
        throw new CheckError(`oxlint couldn't read ${diagnostic.filename}: ${diagnostic.message}`);
      if (diagnostic.code !== 'eslint(complexity)') continue;
      const match = COMPLEXITY_MESSAGE.exec(diagnostic.message);
      const span = diagnostic.labels?.[0]?.span;
      if (!match || !span) {
        throw new CheckError(
          `Couldn't read a score from oxlint's complexity message; oxlint may have changed it:\n${diagnostic.message}`,
        );
      }
      const file = diagnostic.filename;
      let source = sources.get(file);
      if (!source) sources.set(file, (source = readFileSync(join(root, file))));
      found.push({
        file,
        name: match[1] ?? anonymousName(source, span.offset),
        complexity: Number(match[2]),
        start: position(source, span.offset),
        end: position(source, span.offset + span.length),
        span: span.length,
      });
    }
    return found.filter((fn) => !/\.test\.tsx?$/.test(fn.file));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Runs `npm test` with coverage on, and returns its istanbul JSON report keyed by absolute path. */
function coverage(root: string) {
  const directory = mkdtempSync(join(tmpdir(), 'splitsmart-coverage-'));
  try {
    const result = run(
      'npm',
      [
        'test',
        '--',
        '--coverage.enabled',
        '--coverage.reporter=json',
        `--coverage.reportsDirectory=${directory}`,
      ],
      root,
    );
    if (result.status !== 0) return { passed: false as const, output: result.output };
    const path = join(directory, 'coverage-final.json');
    if (!existsSync(path))
      throw new CheckError(`The test run wrote no coverage report:\n${result.output}`);
    return {
      passed: true as const,
      report: JSON.parse(readFileSync(path, 'utf8')) as Record<string, FileCoverage>,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** The innermost function, of those in the same file, whose range holds `range`. */
function innermost(functions: Found[], range: Range) {
  let best: Found | undefined;
  for (const fn of functions) if (contains(fn, range) && (!best || fn.span < best.span)) best = fn;
  return best;
}

function score(root: string, found: Found[], report: Record<string, FileCoverage>): Scored[] {
  const byFile = Map.groupBy(found, (fn) => fn.file);
  const scored: Scored[] = [];
  for (const [file, functions] of byFile) {
    const fileCoverage = report[resolve(root, file)];
    const statements = new Map<Found, { total: number; run: number }>();
    const called = new Map<Found, boolean>();
    if (fileCoverage) {
      for (const [id, range] of Object.entries(fileCoverage.statementMap)) {
        const owner = innermost(functions, range);
        if (!owner) continue;
        const counts = statements.get(owner) ?? { total: 0, run: 0 };
        counts.total++;
        if (fileCoverage.s[id] > 0) counts.run++;
        statements.set(owner, counts);
      }
      for (const [id, fn] of Object.entries(fileCoverage.fnMap)) {
        const owner = innermost(functions, fn.loc);
        if (owner) called.set(owner, (called.get(owner) ?? false) || fileCoverage.f[id] > 0);
      }
    }

    const siblings = new Map<string, number>();
    for (const fn of functions) {
      // Name a function by the functions around it, so its key survives edits elsewhere in the file.
      const parents = functions
        .filter((other) => other !== fn && contains(other, fn))
        .sort((a, b) => b.span - a.span);
      const path = [...parents.map((parent) => parent.name), fn.name].join(' > ');
      const count = (siblings.get(path) ?? 0) + 1;
      siblings.set(path, count);
      const counts = statements.get(fn);
      const covered =
        counts && counts.total > 0 ? counts.run / counts.total : called.get(fn) ? 1 : 0;
      scored.push({
        ...fn,
        key: `${file} > ${path}${count > 1 ? ` (${count})` : ''}`,
        coverage: covered,
        crap: fn.complexity ** 2 * (1 - covered) ** 3 + fn.complexity,
      });
    }
  }
  return scored;
}

/** Lines each file has changed since its merge base with `base`, working tree and new files included. */
function changedLines(root: string, base: string) {
  const mergeBase = git(root, 'merge-base', base, 'HEAD');
  const changed = new Map<string, Set<number> | 'all'>();
  const diff = git(
    root,
    'diff',
    '--unified=0',
    '--no-color',
    '--no-ext-diff',
    mergeBase,
    '--',
    ...SCORED,
  );
  let file: string | undefined;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      file = line === '+++ /dev/null' ? undefined : line.slice(6);
      if (file) changed.set(file, new Set());
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    const lines = file ? changed.get(file) : undefined;
    if (!hunk || !(lines instanceof Set)) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    // A deletion has no new lines; mark the lines either side of it as changed.
    if (count === 0) lines.add(start).add(start + 1);
    for (let n = start; n < start + count; n++) lines.add(n);
  }
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard', '--', ...SCORED);
  for (const path of untracked.split('\n').filter(Boolean)) changed.set(path, 'all');
  return { mergeBase, changed };
}

/**
 * Reads a JSONC baseline: comments and trailing commas allowed, as oxfmt writes it. It keeps the
 * `//` comments before the opening brace as the header, and those above each entry with that
 * entry. Block comments are allowed but not kept.
 */
function parseBaseline(text: string, path: string): BaselineFile {
  let code = '';
  const header: string[] = [];
  const comments = new Map<string, string[]>();
  let pending: string[] = [];
  let depth = 0;
  let expectKey = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '/' && text[i + 1] === '/') {
      const newline = text.indexOf('\n', i);
      const end = newline === -1 ? text.length : newline;
      const comment = text.slice(i, end).trim();
      if (depth === 0) header.push(comment);
      else if (depth === 1) pending.push(comment);
      i = end - 1;
    } else if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end === -1) throw new CheckError(`${path} has a /* comment with no closing */.`);
      i = end + 1;
    } else if (char === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const literal = text.slice(i, j + 1);
      code += literal;
      // A string straight after `{` or `,` in the top-level object is an entry's key.
      if (depth === 1 && expectKey) {
        comments.set(JSON.parse(literal), pending);
        pending = [];
      }
      expectKey = false;
      i = j;
    } else {
      if (char === '{') expectKey = ++depth === 1;
      else if (char === '}') depth--;
      else if (char === ',' && depth === 1) expectKey = true;
      code += char;
    }
  }

  let data: unknown;
  try {
    data = JSON.parse(code.replace(/,(\s*[}\]])/g, '$1'));
  } catch (error) {
    throw new CheckError(`${path} isn't valid JSONC: ${(error as Error).message}`);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new CheckError(`${path} should hold one object, keyed by function.`);
  }

  const entries = new Map<string, Entry & { comments: string[] }>();
  for (const [key, value] of Object.entries(data as Record<string, Entry>)) {
    if (typeof value?.crap !== 'number' || typeof value.complexity !== 'number') {
      throw new CheckError(`${path}: "${key}" needs a numeric crap and complexity.`);
    }
    entries.set(key, {
      crap: value.crap,
      complexity: value.complexity,
      comments: comments.get(key) ?? [],
    });
  }
  return { header, entries };
}

function readBaselineFile(root: string, path: string, ref?: string): BaselineFile {
  if (ref) {
    const shown = run('git', ['show', `${ref}:${path}`], root);
    return shown.status === 0
      ? parseBaseline(shown.stdout, `${ref}:${path}`)
      : { header: [], entries: new Map() };
  }
  const file = join(root, path);
  return existsSync(file)
    ? parseBaseline(readFileSync(file, 'utf8'), path)
    : { header: [], entries: new Map() };
}

function readBaseline(root: string, path: string, ref?: string): Baseline {
  return Object.fromEntries(readBaselineFile(root, path, ref).entries);
}

const round = (n: number) => Math.round(n * 10) / 10;
const overLimit = (fn: { crap: number; complexity: number }) =>
  fn.crap > MAX_CRAP || fn.complexity > MAX_COMPLEXITY;
const describe = (fn: Scored) =>
  `${fn.file}:${fn.start.line} ${fn.key.slice(fn.file.length + 3)}: CRAP ${round(fn.crap)}, complexity ${fn.complexity}, coverage ${Math.round(fn.coverage * 100)}%`;

type Findings = { problems: string[]; notices: string[] };

function check(
  root: string,
  path: string,
  base: string,
  report: Record<string, FileCoverage>,
): Findings {
  const { mergeBase, changed } = changedLines(root, base);
  const scored = score(root, complexities(root), report);
  const baseline = readBaseline(root, path);
  const problems: string[] = [];
  const notices: string[] = [];

  for (const fn of scored) {
    const lines = changed.get(fn.file);
    if (!lines) continue;
    const touched =
      lines === 'all' || [...lines].some((line) => line >= fn.start.line && line <= fn.end.line);
    if (!touched) continue;
    const recorded = baseline[fn.key];
    if (recorded) {
      if (round(fn.crap) > recorded.crap || fn.complexity > recorded.complexity) {
        problems.push(
          `${describe(fn)}. Worse than its baseline (CRAP ${recorded.crap}, complexity ${recorded.complexity}).`,
        );
      } else if (round(fn.crap) < recorded.crap || fn.complexity < recorded.complexity) {
        problems.push(
          `${describe(fn)}. Better than its baseline (CRAP ${recorded.crap}, complexity ${recorded.complexity}): run ${REWRITE} to record it.`,
        );
      }
    } else if (overLimit(fn)) {
      problems.push(
        `${describe(fn)}. Over the limits (CRAP ${MAX_CRAP}, complexity ${MAX_COMPLEXITY}).`,
      );
    }
  }

  const keys = new Set(scored.map((fn) => fn.key));
  for (const key of Object.keys(baseline)) {
    const file = key.split(' > ')[0];
    if (!keys.has(key) && (changed.has(file) || !existsSync(join(root, file)))) {
      problems.push(
        `${key}: in the baseline, but no function has this name now. Run ${REWRITE} to drop it.`,
      );
    }
  }

  const previous = readBaseline(root, path, mergeBase);
  for (const [key, entry] of readBaselineFile(root, path).entries) {
    const old = previous[key];
    if (!old || entry.crap > old.crap || entry.complexity > old.complexity) {
      const reason = entry.comments.length
        ? `Its reason: ${entry.comments.map((line) => line.replace(/^\/\/\s?/, '')).join(' ')}`
        : 'Give the reason in a comment above the entry.';
      notices.push(
        `${path} raises ${key} to CRAP ${entry.crap}, complexity ${entry.complexity}${old ? ` (was ${old.crap}, ${old.complexity})` : ' (new entry)'}. ${reason}`,
      );
    }
  }
  return { problems, notices };
}

/** Rewrites the baseline from every function's score, keeping the header and each kept entry's comments. */
function writeBaseline(root: string, path: string, report: Record<string, FileCoverage>) {
  const existing = readBaselineFile(root, path);
  const entries = score(root, complexities(root), report)
    .filter(overLimit)
    .sort((a, b) => (a.key < b.key ? -1 : 1));
  const lines = existing.header.length > 0 ? [...existing.header] : [...HEADER];
  lines.push('{');
  for (const fn of entries) {
    for (const comment of existing.entries.get(fn.key)?.comments ?? []) lines.push(`  ${comment}`);
    const key = JSON.stringify(fn.key);
    const crap = round(fn.crap);
    const line = `  ${key}: { "crap": ${crap}, "complexity": ${fn.complexity} },`;
    // Lay entries out as oxfmt does, so a rewritten baseline passes `npm run format:check`:
    // on one line, unless that passes oxfmt's 100-character width.
    if (line.length <= 100) lines.push(line);
    else {
      lines.push(
        `  ${key}: {`,
        `    "crap": ${crap},`,
        `    "complexity": ${fn.complexity},`,
        '  },',
      );
    }
  }
  lines.push('}');
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), `${lines.join('\n')}\n`);
  return entries.length;
}

const tail = (text: string, lines: number) => text.trimEnd().split('\n').slice(-lines).join('\n');

function hook(path: string, input: { cwd?: string; stop_hook_active?: boolean }) {
  // Advise once: when Claude is already continuing because of a stop hook, let it stop.
  if (input.stop_hook_active) return undefined;
  const root = git(input.cwd ?? process.cwd(), 'rev-parse', '--show-toplevel');
  const base = ['origin/main', 'main'].find(
    (ref) => run('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root).status === 0,
  );
  if (!base) return `The CRAP check couldn't find origin/main or main to compare with.`;
  if (changedLines(root, base).changed.size === 0) return undefined;

  const sections: string[] = [];
  const lint = run('npm', ['run', 'lint'], root);
  if (lint.status !== 0)
    sections.push(`\`npm run lint\` fails. Fix it first:\n${tail(lint.output, 40)}`);
  const tests = coverage(root);
  if (!tests.passed) {
    sections.push(
      `\`npm test\` fails, so no CRAP score was calculated this run. Fix the tests first:\n${tail(tests.output, 60)}`,
    );
  } else {
    const { problems, notices } = check(root, path, base, tests.report);
    if (problems.length)
      sections.push(
        `CRAP findings in changed functions:\n${problems.map((p) => `- ${p}`).join('\n')}`,
      );
    if (notices.length) sections.push(notices.map((n) => `- ${n}`).join('\n'));
  }
  if (sections.length === 0) return undefined;
  return `${sections.join('\n\n')}\n\nFollow ${PROCEDURE} to respond. This is advice: fix each finding, or record it in the baseline with its reason.`;
}

function main(args: string[]) {
  const root = process.cwd();
  let options;
  try {
    options = parseArgs({
      args,
      options: {
        baseline: { type: 'string' },
        base: { type: 'string', default: 'origin/main' },
        hook: { type: 'boolean', default: false },
        'write-baseline': { type: 'boolean', default: false },
      },
    }).values;
  } catch (error) {
    throw new CheckError((error as Error).message);
  }
  const path = options.baseline;
  const missing =
    'Pass --baseline <file>, the baseline file’s path from the repository root. `npm run crap` passes the repository’s.';

  if (options.hook) {
    let message: string | undefined;
    try {
      if (!path) throw new CheckError(missing);
      const stdin = readFileSync(0, 'utf8').trim();
      message = hook(path, stdin ? JSON.parse(stdin) : {});
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

  if (!path) throw new CheckError(missing);
  const tests = coverage(root);
  if (!tests.passed) {
    console.error(`${tail(tests.output, 60)}\n\nThe tests fail, so no CRAP score was calculated.`);
    return 1;
  }
  if (options['write-baseline']) {
    console.log(
      `Wrote ${writeBaseline(root, path, tests.report)} functions over the limits to ${path}.`,
    );
    return 0;
  }

  const base = options.base;
  const { problems, notices } = check(root, path, base, tests.report);
  for (const notice of notices) {
    console.log(
      process.env.GITHUB_ACTIONS ? `::warning file=${path}::${notice}` : `Notice: ${notice}`,
    );
  }
  if (problems.length) {
    console.error(`CRAP findings in functions changed since ${base}:`);
    for (const problem of problems) console.error(`- ${problem}`);
    console.error(`\nFollow ${PROCEDURE} to respond.`);
    return 1;
  }
  console.log(`No CRAP findings in functions changed since ${base}.`);
  return 0;
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  if (!(error instanceof CheckError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
