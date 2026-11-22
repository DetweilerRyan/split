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

// The script's contract, end to end: it runs as a program on a real git repository, with a fake
// `npm test`. The rules themselves are tested beside each module.
describe('crap', () => {
  const allow = (crap: number, complexity: number) =>
    `// @crap-allow CRAP ${crap}, complexity ${complexity}. One branch per row of the rate table.\n`;

  it('fails a changed function over the limits, and says what comment would allow it', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 11) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.',
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

  it('ignores a function over the limits that the branch doesn’t change', () => {
    const cwd = repository({ 'src/grade.ts': `${branchy('grade', 11)}export const other = 1;\n` });
    write(cwd, { 'src/grade.ts': `${branchy('grade', 11)}export const other = 2;\n` });

    expect(crap(cwd).status).toBe(0);
  });

  it('passes a changed function whose @crap-allow comment gives its numbers', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, {
      'src/grade.ts': allow(156, 12) + branchy('grade', 11).replace('return -1', 'return -2'),
    });

    const result = crap(cwd);

    expect(result.output).toContain('No CRAP findings, checked against main.');
    expect(result.status).toBe(0);
  });

  it('fails when a function’s numbers no longer match its @crap-allow comment', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 12) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.',
    );
  });

  it('flags a @crap-allow comment the branch adds, quoting its reason', () => {
    const cwd = repository({ 'src/grade.ts': branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });

    const result = crap(cwd);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'Notice: src/grade.ts:1 Adds or changes the @crap-allow comment for grade (CRAP 156, complexity 12). Its reason: One branch per row of the rate table.',
    );
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
        '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12.',
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
