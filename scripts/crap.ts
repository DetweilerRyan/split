#!/usr/bin/env node
// Scores each function in src/ and app/ by CRAP: complexity² × (1 − coverage)³ + complexity,
// where complexity is oxlint's cyclomatic complexity and coverage is the share of the function's
// statements the Vitest suite runs. It fails when a function the branch changes is over the limits
// below, unless a `// crap-allow:` comment directly above it gives its current numbers and a
// reason; and when any crap-allow comment's numbers no longer match its function. The script
// never writes to source files. docs/engineering/crap.md says what to do with a finding. Why the
// script works this way is in crap.meta.md beside it; read that only when changing or questioning
// the script.
//
// Usage, from the repository root:
//   node scripts/crap.ts [--base <ref>]  check against <ref> (default origin/main)
//   node scripts/crap.ts --hook          Claude Code Stop hook; reads the hook's input on stdin
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const MAX_CRAP = 30;
const MAX_COMPLEXITY = 10;
const SCORED = ['src', 'app'];
const PROCEDURE = 'docs/engineering/crap.md';
const oxlint = fileURLToPath(new URL('../node_modules/.bin/oxlint', import.meta.url));

type Position = { line: number; column: number };
type Range = { start: Position; end: Position };
type Scored = Range & {
  file: string;
  name: string;
  complexity: number;
  coverage: number;
  crap: number;
};
type FileCoverage = {
  statementMap: Record<string, Range>;
  s: Record<string, number>;
  fnMap: Record<string, { loc: Range }>;
  f: Record<string, number>;
};
type Finding = { file: string; line: number; message: string };

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
 * Names a function oxlint calls anonymous by what the code before it on its line says:
 * `seed.items.forEach((item) =>` gives "seed.items.forEach callback", and `onSave: () =>` or
 * `const onSave = () =>` gives "onSave". The name only labels findings.
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
    return found.filter((fn) => !isTest(fn.file));
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

const isTest = (file: string) => /\.test\.tsx?$/.test(file);

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

    for (const fn of functions) {
      // Label a function by the functions around it, as in "RoomView > changeDisplayCurrency".
      const parents = functions
        .filter((other) => other !== fn && contains(other, fn))
        .sort((a, b) => b.span - a.span);
      const counts = statements.get(fn);
      const covered =
        counts && counts.total > 0 ? counts.run / counts.total : called.get(fn) ? 1 : 0;
      scored.push({
        ...fn,
        name: [...parents.map((parent) => parent.name), fn.name].join(' > '),
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
  return changed;
}

const isChanged = (lines: Set<number> | 'all' | undefined, from: number, to: number) =>
  lines === 'all' || (lines !== undefined && [...lines].some((n) => n >= from && n <= to));

const ALLOW = /crap-allow/;
const ALLOW_FORMAT = /^\/\/ crap-allow: CRAP (\d+(?:\.\d)?), complexity (\d+)\.(?: (\S.*))?$/;
const isComment = (line: string) => /^(\/\/|\/\*|\*)/.test(line.trim());

type Allow = {
  file: string;
  line: number;
  crap: number;
  complexity: number;
  reason: string;
  lastLine: number;
};

/**
 * Every `// crap-allow:` comment in src/ and app/, with its reason: the text after the numbers and
 * any `//` lines straight below it. Malformed ones become findings.
 */
function allows(root: string, problems: Finding[]) {
  const files = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '--', ...SCORED)
    .split('\n')
    .filter(
      (file) => /\.[cm]?[jt]sx?$/.test(file) && !isTest(file) && existsSync(join(root, file)),
    );
  const found: Allow[] = [];
  for (const file of files) {
    const lines = readFileSync(join(root, file), 'utf8').split('\n');
    lines.forEach((text, index) => {
      if (!ALLOW.test(text) || !isComment(text)) return;
      const line = index + 1;
      const match = ALLOW_FORMAT.exec(text.trim());
      if (!match) {
        problems.push({
          file,
          line,
          message:
            'This crap-allow comment isn’t in the form `// crap-allow: CRAP <score>, complexity <n>. <reason>`.',
        });
        return;
      }
      const reason = [match[3] ?? ''];
      let last = index;
      while (
        last + 1 < lines.length &&
        lines[last + 1].trim().startsWith('//') &&
        !ALLOW.test(lines[last + 1])
      ) {
        last++;
        reason.push(lines[last].trim().replace(/^\/\/\s?/, ''));
      }
      found.push({
        file,
        line,
        crap: Number(match[1]),
        complexity: Number(match[2]),
        reason: reason.join(' ').trim(),
        lastLine: last + 1,
      });
    });
  }
  return found;
}

/**
 * The function a crap-allow comment applies to: the outermost one starting on the first line
 * after the comment block it sits in, so it can share that block with a doc comment.
 */
function owner(allow: Allow, scored: Scored[], root: string) {
  const lines = readFileSync(join(root, allow.file), 'utf8').split('\n');
  let next = allow.lastLine; // 0-based index of the line after the comment block
  while (next < lines.length && isComment(lines[next])) next++;
  const starting = scored.filter((fn) => fn.file === allow.file && fn.start.line === next + 1);
  return starting.sort((a, b) => b.end.line - a.end.line)[0];
}

const round = (n: number) => Math.round(n * 10) / 10;
const overLimit = (fn: Scored) => fn.crap > MAX_CRAP || fn.complexity > MAX_COMPLEXITY;
const numbers = (fn: Scored) => `CRAP ${round(fn.crap)}, complexity ${fn.complexity}`;
const describe = (fn: Scored) =>
  `${fn.name}: ${numbers(fn)}, coverage ${Math.round(fn.coverage * 100)}%`;

function check(root: string, base: string, report: Record<string, FileCoverage>) {
  const changed = changedLines(root, base);
  const scored = score(root, complexities(root), report);
  const problems: Finding[] = [];
  const notices: Finding[] = [];

  const allowed = new Map<Scored, Allow>();
  for (const allow of allows(root, problems)) {
    const fn = owner(allow, scored, root);
    const at = { file: allow.file, line: allow.line };
    if (!fn) {
      problems.push({
        ...at,
        message:
          'This crap-allow comment isn’t directly above a function. Move it there, or delete it.',
      });
      continue;
    }
    if (allowed.has(fn)) {
      problems.push({ ...at, message: `${fn.name} already has a crap-allow comment.` });
      continue;
    }
    allowed.set(fn, allow);
    if (!allow.reason) {
      problems.push({ ...at, message: `The crap-allow comment for ${fn.name} gives no reason.` });
    }
    if (!overLimit(fn)) {
      problems.push({
        ...at,
        message: `${describe(fn)}. It's within the limits now, so delete its crap-allow comment.`,
      });
    } else if (round(fn.crap) !== allow.crap || fn.complexity !== allow.complexity) {
      problems.push({
        ...at,
        message: `${describe(fn)}, but its crap-allow comment says CRAP ${allow.crap}, complexity ${allow.complexity}. Update the comment to \`// crap-allow: ${numbers(fn)}.\`, and check its reason still holds.`,
      });
    }
    if (isChanged(changed.get(allow.file), allow.line, allow.lastLine)) {
      notices.push({
        ...at,
        message: `Adds or changes the crap-allow comment for ${fn.name} (CRAP ${allow.crap}, complexity ${allow.complexity}). Its reason: ${allow.reason || '(none)'}`,
      });
    }
  }

  for (const fn of scored) {
    if (!overLimit(fn) || allowed.has(fn)) continue;
    if (!isChanged(changed.get(fn.file), fn.start.line, fn.end.line)) continue;
    problems.push({
      file: fn.file,
      line: fn.start.line,
      message: `${describe(fn)}. Over the limits (CRAP ${MAX_CRAP}, complexity ${MAX_COMPLEXITY}). To leave it, add \`// crap-allow: ${numbers(fn)}. <reason>\` directly above it.`,
    });
  }
  const order = (a: Finding, b: Finding) =>
    a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1;
  return { problems: problems.sort(order), notices: notices.sort(order) };
}

const tail = (text: string, lines: number) => text.trimEnd().split('\n').slice(-lines).join('\n');
const list = (findings: Finding[]) =>
  findings.map((f) => `- ${f.file}:${f.line} ${f.message}`).join('\n');

function hook(input: { cwd?: string; stop_hook_active?: boolean }) {
  // Advise once: when Claude is already continuing because of a stop hook, let it stop.
  if (input.stop_hook_active) return undefined;
  const root = git(input.cwd ?? process.cwd(), 'rev-parse', '--show-toplevel');
  const base = ['origin/main', 'main'].find(
    (ref) => run('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root).status === 0,
  );
  if (!base) return `The CRAP check couldn't find origin/main or main to compare with.`;
  if (changedLines(root, base).size === 0) return undefined;

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
    const { problems, notices } = check(root, base, tests.report);
    if (problems.length) sections.push(`CRAP findings:\n${list(problems)}`);
    if (notices.length) sections.push(`crap-allow comments this branch changes:\n${list(notices)}`);
  }
  if (sections.length === 0) return undefined;
  return `${sections.join('\n\n')}\n\nFollow ${PROCEDURE} to respond. This is advice; CI fails on each CRAP finding.`;
}

function main(args: string[]) {
  const root = process.cwd();
  let options;
  try {
    options = parseArgs({
      args,
      options: {
        base: { type: 'string', default: 'origin/main' },
        hook: { type: 'boolean', default: false },
      },
    }).values;
  } catch (error) {
    throw new CheckError((error as Error).message);
  }

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

  const tests = coverage(root);
  if (!tests.passed) {
    console.error(`${tail(tests.output, 60)}\n\nThe tests fail, so no CRAP score was calculated.`);
    return 1;
  }
  const { problems, notices } = check(root, options.base, tests.report);
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
  if (!(error instanceof CheckError)) throw error;
  console.error(error.message);
  process.exitCode = 1;
}
