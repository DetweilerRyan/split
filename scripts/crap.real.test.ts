import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./crap.ts', import.meta.url));
const directories: string[] = [];

// Stands in for `npm test`: writes an istanbul report with one statement per non-blank line of
// each file in src/, run when the line is listed in covered.json ("all" covers every line).
// It fails instead when a file named tests-fail exists.
const fakeTests = `import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
if (existsSync('tests-fail')) { console.log('FAIL src/a.test.ts > adds up'); process.exit(1); }
const directory = process.argv.find((arg) => arg.startsWith('--coverage.reportsDirectory=')).split('=')[1];
const covered = existsSync('covered.json') ? JSON.parse(readFileSync('covered.json', 'utf8')) : {};
const report = {};
for (const name of readdirSync('src')) {
  const file = 'src/' + name;
  const statementMap = {}, s = {};
  readFileSync(file, 'utf8').split('\\n').forEach((text, index) => {
    if (!text.trim()) return;
    const id = String(index);
    statementMap[id] = { start: { line: index + 1, column: 0 }, end: { line: index + 1, column: text.length } };
    s[id] = covered[file] === 'all' || covered[file]?.includes(index + 1) ? 1 : 0;
  });
  report[resolve(file)] = { path: resolve(file), statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
}
mkdirSync(directory, { recursive: true });
writeFileSync(join(directory, 'coverage-final.json'), JSON.stringify(report));
`;

/** A function with `branches` if statements, so oxlint gives it a complexity of branches + 1. */
function branchy(name: string, branches: number) {
  const ifs = Array.from({ length: branches }, (_, i) => `  if (n === ${i}) return ${i};`);
  return `export function ${name}(n: number) {\n${ifs.join('\n')}\n  return -1;\n}\n`;
}

/** A git repository on `main` holding `files`, with the fake test runner as `npm test`. */
function repository(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-crap-test-'));
  directories.push(cwd);
  write(cwd, {
    'package.json': JSON.stringify({
      type: 'module',
      scripts: {
        test: 'node fake-tests.mjs',
        lint: 'node -e "process.exit(+!!process.env.LINT_FAILS)"',
      },
    }),
    'fake-tests.mjs': fakeTests,
    '.gitignore': 'covered.json\ntests-fail\n',
    ...files,
  });
  git(cwd, 'init', '--quiet', '--initial-branch=main');
  git(cwd, 'add', '.');
  git(
    cwd,
    '-c',
    'user.name=Test',
    '-c',
    'user.email=test@example.com',
    'commit',
    '--quiet',
    '-m',
    'base',
  );
  git(cwd, 'checkout', '--quiet', '-b', 'work');
  return cwd;
}

function write(cwd: string, files: Record<string, string>) {
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
}

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr);
}

function crap(
  cwd: string,
  args: string[] = ['--base', 'main'],
  input?: string,
  env: Record<string, string> = {},
) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    input,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: '', ...env },
  });
  return {
    status: result.status,
    output: `${result.stdout}${result.stderr}`,
    stdout: result.stdout,
  };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('crap', () => {
  const allow = (
    crap: number,
    complexity: number,
    reason = 'One branch per row of the rate table.',
  ) => `// crap-allow: CRAP ${crap}, complexity ${complexity}. ${reason}\n`;

  it('reads each changed function’s complexity from oxlint and fails one over the limits', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 11) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// crap-allow: CRAP 156, complexity 12. <reason>` directly above it.',
    );
    expect(result.output).toContain('Follow docs/engineering/crap.md to respond.');
  });

  it('passes a changed function whose tests run all of it', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, {
      'src/grade.ts': branchy('grade', 5),
      'covered.json': JSON.stringify({ 'src/grade.ts': 'all' }),
    });

    const result = crap(cwd);

    expect(result.output).toContain('No CRAP findings, checked against main.');
    expect(result.status).toBe(0);
  });

  it('fails a changed function over CRAP 30 even when its complexity is within 10', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 5) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain('grade: CRAP 42, complexity 6, coverage 0%. Over the limits');
  });

  it('ignores a function over the limits that the branch doesn’t change', () => {
    const cwd = repository({ 'src/grade.ts': `${branchy('grade', 11)}export const other = 1;\n` });
    write(cwd, { 'src/grade.ts': `${branchy('grade', 11)}export const other = 2;\n` });

    expect(crap(cwd).status).toBe(0);
  });

  it('passes a changed function over the limits whose crap-allow comment gives its numbers', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, {
      'src/grade.ts': allow(156, 12) + branchy('grade', 11).replace('return -1', 'return -2'),
    });

    const result = crap(cwd);

    expect(result.output).toContain('No CRAP findings, checked against main.');
    expect(result.status).toBe(0);
  });

  it('fails when a function gets worse than its crap-allow comment says', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 12) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its crap-allow comment says CRAP 156, complexity 12. Update the comment to `// crap-allow: CRAP 182, complexity 13.`, and check its reason still holds.',
    );
  });

  it('fails when a function gets better than its crap-allow comment says, even with its code unchanged', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, { 'covered.json': JSON.stringify({ 'src/grade.ts': 'all' }) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'grade: CRAP 12, complexity 12, coverage 100%, but its crap-allow comment says CRAP 156, complexity 12.',
    );
  });

  it('fails a crap-allow comment on a function that is within the limits now', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 3) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "grade: CRAP 20, complexity 4, coverage 0%. It's within the limits now, so delete its crap-allow comment.",
    );
  });

  it('fails a crap-allow comment with no reason, or in the wrong form', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, {
      'src/grade.ts': '// crap-allow: CRAP 156, complexity 12.\n' + branchy('grade', 11),
      'src/rank.ts': '// crap-allow CRAP=156 complexity=12 because\n' + branchy('rank', 11),
    });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 The crap-allow comment for grade gives no reason.',
    );
    expect(result.output).toContain(
      '- src/rank.ts:1 This crap-allow comment isn’t in the form `// crap-allow: CRAP <score>, complexity <n>. <reason>`.',
    );
  });

  it('fails a crap-allow comment left behind when its function is gone', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': `${allow(156, 12)}export const grade = 1;\n` });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 This crap-allow comment isn’t directly above a function. Move it there, or delete it.',
    );
  });

  it('applies a crap-allow comment across a doc comment, and flags one the branch adds with its whole reason', () => {
    const cwd = repository({ 'src/grade.ts': branchy('grade', 11) });
    write(cwd, {
      'src/grade.ts':
        allow(156, 12, 'One branch per row of the rate table.') +
        '// Revisit when the table moves to data.\n' +
        '/** Grades a score. */\n' +
        branchy('grade', 11),
    });

    const result = crap(cwd);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'Notice: src/grade.ts:1 Adds or changes the crap-allow comment for grade (CRAP 156, complexity 12). Its reason: One branch per row of the rate table. Revisit when the table moves to data.',
    );
  });

  it('labels an anonymous callback by the call it is passed to', () => {
    const body = branchy('inner', 11)
      .replace('export function inner(n: number) {', 'items.forEach((n: number) => {')
      .replace(/}\n$/, '});\n');
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/list.ts': `declare const items: number[];\n${body}` });

    expect(crap(cwd).output).toContain('- src/list.ts:2 items.forEach callback: CRAP 156');
  });

  it('gives no score when the tests fail', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 11), 'tests-fail': '' });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain('FAIL src/a.test.ts > adds up');
    expect(result.output).toContain('The tests fail, so no CRAP score was calculated.');
  });

  describe('as a Stop hook', () => {
    const context = (stdout: string) =>
      JSON.parse(stdout).hookSpecificOutput.additionalContext as string;

    it('gives the agent its findings as additional context, and exits 0', () => {
      const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
      write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 12) });

      const result = crap(cwd, ['--hook'], JSON.stringify({ cwd, stop_hook_active: false }));

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).hookSpecificOutput.hookEventName).toBe('Stop');
      expect(context(result.stdout)).toContain(
        '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its crap-allow comment says CRAP 156, complexity 12.',
      );
      expect(context(result.stdout)).toContain(
        'Follow docs/engineering/crap.md to respond. This is advice; CI fails on each CRAP finding.',
      );
    });

    it('says nothing when Claude is already continuing because of a stop hook', () => {
      const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
      write(cwd, { 'src/grade.ts': branchy('grade', 11) });

      const result = crap(cwd, ['--hook'], JSON.stringify({ cwd, stop_hook_active: true }));

      expect(result).toMatchObject({ status: 0, stdout: '' });
    });

    it('says nothing when src/ and app/ haven’t changed', () => {
      const cwd = repository({ 'src/grade.ts': branchy('grade', 11) });

      const result = crap(cwd, ['--hook'], JSON.stringify({ cwd, stop_hook_active: false }));

      expect(result).toMatchObject({ status: 0, stdout: '' });
    });

    it('puts lint failures first, and gives no score while the tests fail', () => {
      const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
      write(cwd, { 'src/grade.ts': branchy('grade', 11), 'tests-fail': '' });

      const result = crap(cwd, ['--hook'], JSON.stringify({ cwd, stop_hook_active: false }), {
        LINT_FAILS: '1',
      });

      const message = context(result.stdout);
      expect(result.status).toBe(0);
      expect(message.indexOf('`npm run lint` fails. Fix it first')).toBe(0);
      expect(message).toContain('`npm test` fails, so no CRAP score was calculated this run.');
      expect(message).not.toContain('CRAP 156');
    });
  });
});
