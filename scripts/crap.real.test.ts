import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./crap.ts', import.meta.url));
const BASELINE = 'crap-baseline.jsonc';
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
  const result = spawnSync(process.execPath, [script, '--baseline', BASELINE, ...args], {
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
  it('reads each changed function’s complexity from oxlint and fails one over the limits', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 11) });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10).',
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

    expect(result.output).toContain('No CRAP findings in functions changed since main.');
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

    const result = crap(cwd);

    expect(result.status).toBe(0);
  });

  it('passes a changed function its baseline records at the same score, and fails it when it gets worse', () => {
    const baseline = { 'src/grade.ts > grade': { crap: 156, complexity: 12 } };
    const cwd = repository({
      'src/grade.ts': branchy('grade', 11),
      [BASELINE]: JSON.stringify(baseline),
    });

    write(cwd, { 'src/grade.ts': branchy('grade', 11).replace('return -1', 'return -2') });
    expect(crap(cwd).status).toBe(0);

    write(cwd, { 'src/grade.ts': branchy('grade', 12) });
    const worse = crap(cwd);
    expect(worse.status).toBe(1);
    expect(worse.output).toContain(
      'grade: CRAP 182, complexity 13, coverage 0%. Worse than its baseline (CRAP 156, complexity 12).',
    );
  });

  it('asks for the baseline to be rewritten when a changed function gets better, and passes once it is', () => {
    const cwd = repository({
      'src/grade.ts': branchy('grade', 11),
      [BASELINE]: JSON.stringify({
        'src/grade.ts > grade': { crap: 156, complexity: 12 },
      }),
    });
    write(cwd, {
      'covered.json': JSON.stringify({ 'src/grade.ts': 'all' }),
      'src/grade.ts': branchy('grade', 11).replace('return -1', 'return -2'),
    });

    const better = crap(cwd);
    expect(better.status).toBe(1);
    expect(better.output).toContain('Better than its baseline (CRAP 156, complexity 12)');

    expect(crap(cwd, ['--write-baseline']).status).toBe(0);
    expect(readFileSync(join(cwd, BASELINE), 'utf8')).toContain(
      '{\n  "src/grade.ts > grade": { "crap": 12, "complexity": 12 },\n}\n',
    );
    expect(crap(cwd).status).toBe(0);
  });

  it('asks for the baseline to be rewritten when a file it records is deleted', () => {
    const cwd = repository({
      'src/grade.ts': branchy('grade', 11),
      'src/keep.ts': 'export const keep = 1;\n',
      [BASELINE]: JSON.stringify({
        'src/grade.ts > grade': { crap: 156, complexity: 12 },
      }),
    });
    rmSync(join(cwd, 'src/grade.ts'));

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'src/grade.ts > grade: in the baseline, but no function has this name now.',
    );
  });

  it('flags a baseline entry the branch adds, without failing', () => {
    const cwd = repository({ 'src/grade.ts': branchy('grade', 11) });
    write(cwd, {
      [BASELINE]: JSON.stringify({
        'src/grade.ts > grade': { crap: 156, complexity: 12 },
      }),
    });

    const result = crap(cwd);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'crap-baseline.jsonc raises src/grade.ts > grade to CRAP 156, complexity 12 (new entry). Give the reason in a comment above the entry.',
    );
  });

  it('names an anonymous callback by the call it is passed to', () => {
    const body = branchy('inner', 11)
      .replace('export function inner(n: number) {', 'items.forEach((n: number) => {')
      .replace(/}\n$/, '});\n');
    const cwd = repository({ 'src/list.ts': `declare const items: number[];\n${body}` });

    expect(crap(cwd, ['--write-baseline']).status).toBe(0);
    expect(readFileSync(join(cwd, BASELINE), 'utf8')).toContain(
      '  "src/list.ts > items.forEach callback": { "crap": 156, "complexity": 12 },\n',
    );
  });

  it('quotes the reason above a baseline entry the branch adds', () => {
    const cwd = repository({ 'src/grade.ts': branchy('grade', 11) });
    write(cwd, {
      [BASELINE]: `{
  // One branch per row of the rate table.
  // Revisit when the table moves to data.
  "src/grade.ts > grade": { "crap": 156, "complexity": 12 },
}
`,
    });

    const result = crap(cwd);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      '(new entry). Its reason: One branch per row of the rate table. Revisit when the table moves to data.',
    );
  });

  it('reads a baseline with comments and trailing commas', () => {
    const cwd = repository({
      'src/grade.ts': branchy('grade', 11),
      [BASELINE]: `// Header.
{
  /* A block comment, read but not kept. */
  // Kept over the limits: the branches mirror the rate table, one per row.
  "src/grade.ts > grade": { "crap": 156, "complexity": 12 },
}
`,
    });
    write(cwd, { 'src/grade.ts': branchy('grade', 11).replace('return -1', 'return -2') });

    const result = crap(cwd);

    expect(result.output).toContain('No CRAP findings in functions changed since main.');
    expect(result.status).toBe(0);
  });

  it('keeps the header, and the comments above each entry it keeps, when it rewrites the baseline', () => {
    const cwd = repository({
      'src/grade.ts': branchy('grade', 11),
      'src/rank.ts': branchy('rank', 11),
      [BASELINE]: `// Our header.
{
  // Gone: rank is tested now.
  "src/rank.ts > rank": { "crap": 156, "complexity": 12 },
  // Kept over the limits: one branch per row of the rate table.
  // Revisit when the table moves to data.
  "src/grade.ts > grade": { "crap": 156, "complexity": 12 },
}
`,
    });
    write(cwd, {
      'src/rank.ts': branchy('rank', 2),
      'covered.json': JSON.stringify({ 'src/rank.ts': 'all' }),
    });

    expect(crap(cwd, ['--write-baseline']).status).toBe(0);

    expect(readFileSync(join(cwd, BASELINE), 'utf8')).toBe(`// Our header.
{
  // Kept over the limits: one branch per row of the rate table.
  // Revisit when the table moves to data.
  "src/grade.ts > grade": { "crap": 156, "complexity": 12 },
}
`);
  });

  it('writes a baseline entry over 100 characters across lines, as oxfmt lays it out', () => {
    const name = `grade${'x'.repeat(80)}`;
    const cwd = repository({ 'src/grade.ts': branchy(name, 11) });

    expect(crap(cwd, ['--write-baseline']).status).toBe(0);

    expect(readFileSync(join(cwd, BASELINE), 'utf8')).toContain(
      `{\n  "src/grade.ts > ${name}": {\n    "crap": 156,\n    "complexity": 12,\n  },\n}\n`,
    );
  });

  it('asks for the baseline’s path when none is given', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });

    const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      'Pass --baseline <file>, the baseline file’s path from the repository root.',
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
      const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
      write(cwd, { 'src/grade.ts': branchy('grade', 11) });

      const result = crap(cwd, ['--hook'], JSON.stringify({ cwd, stop_hook_active: false }));

      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout).hookSpecificOutput.hookEventName).toBe('Stop');
      expect(context(result.stdout)).toContain(
        '- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%.',
      );
      expect(context(result.stdout)).toContain('Follow docs/engineering/crap.md to respond.');
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
