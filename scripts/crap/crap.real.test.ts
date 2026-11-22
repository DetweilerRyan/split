import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// The script's contract, end to end: it runs as a program on a real git repository, given a
// coverage report. The rules themselves are tested beside each module.

const script = fileURLToPath(new URL('./crap.ts', import.meta.url));
const directories: string[] = [];

/** A function with `branches` if statements, so its complexity is branches + 1. */
function branchy(name: string, branches: number) {
  const ifs = Array.from({ length: branches }, (_, i) => `  if (n === ${i}) return ${i};`);
  return `export function ${name}(n: number) {\n${ifs.join('\n')}\n  return -1;\n}\n`;
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

/** A git repository on `main` holding `files`, checked out on a branch `work`. */
function repository(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-crap-test-'));
  directories.push(cwd);
  write(cwd, { '.gitignore': 'coverage.json\n', ...files });
  git(cwd, 'init', '--quiet', '--initial-branch=main');
  git(cwd, 'add', '.');
  git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base');
  git(cwd, 'checkout', '--quiet', '-b', 'work');
  return cwd;
}

/**
 * Writes coverage.json as a test run would: one statement per non-blank line of each file in
 * src/, run when its file is listed in `covered`. Written last, so it's newer than the code.
 */
function coverage(cwd: string, covered: string[] = []) {
  const report: Record<string, unknown> = {};
  for (const name of ['grade.ts', 'keep.ts']) {
    const file = `src/${name}`;
    let text: string;
    try {
      text = readFileSync(join(cwd, file), 'utf8');
    } catch {
      continue;
    }
    const statementMap: Record<string, unknown> = {};
    const s: Record<string, number> = {};
    text.split('\n').forEach((line, index) => {
      if (!line.trim()) return;
      statementMap[index] = {
        start: { line: index + 1, column: 0 },
        end: { line: index + 1, column: line.length },
      };
      s[index] = covered.includes(file) ? 1 : 0;
    });
    report[resolve(cwd, file)] = { statementMap, s, fnMap: {}, f: {}, branchMap: {}, b: {} };
  }
  writeFileSync(join(cwd, 'coverage.json'), JSON.stringify(report));
}

function crap(cwd: string, args = ['--coverage', 'coverage.json', '--base', 'main', 'src']) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_ACTIONS: '' },
  });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const allow = (crap: number, complexity: number) =>
  `// @crap-allow CRAP ${crap}, complexity ${complexity}. One branch per row of the rate table.\n`;

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('crap', () => {
  it('fails a changed function over the limits, says what comment would allow it, and points to the guide', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 11) });
    coverage(cwd);

    const result = crap(cwd, [
      '--coverage',
      'coverage.json',
      '--base',
      'main',
      '--guide',
      'GUIDE.md',
      'src',
    ]);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.',
    );
    expect(result.output).toContain('Follow GUIDE.md to respond.');
  });

  it('passes a changed function its tests run all of', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 5) });
    coverage(cwd, ['src/grade.ts']);

    const result = crap(cwd);

    expect(result.output).toContain('No CRAP findings, checked against main.');
    expect(result.status).toBe(0);
  });

  it('ignores a function over the limits that the branch doesn’t change', () => {
    const cwd = repository({ 'src/grade.ts': `${branchy('grade', 11)}export const other = 1;\n` });
    write(cwd, { 'src/grade.ts': `${branchy('grade', 11)}export const other = 2;\n` });
    coverage(cwd);

    expect(crap(cwd).status).toBe(0);
  });

  it('passes a function whose @crap-allow comment gives its numbers, and fails one that no longer matches', () => {
    const cwd = repository({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 11).replace('-1', '-2') });
    coverage(cwd);
    expect(crap(cwd).status).toBe(0);

    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 12) });
    coverage(cwd);
    const result = crap(cwd);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.',
    );
  });

  it('flags a @crap-allow comment the branch adds, quoting its reason', () => {
    const cwd = repository({ 'src/grade.ts': branchy('grade', 11) });
    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    coverage(cwd);

    const result = crap(cwd);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      'Notice: src/grade.ts:1 Adds or changes the @crap-allow comment for grade (CRAP 156, complexity 12). Its reason: One branch per row of the rate table.',
    );
  });

  it('scores the paths it’s given from the directory it runs in', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    write(cwd, { 'src/grade.ts': branchy('grade', 11) });
    coverage(cwd);

    const result = crap(join(cwd, 'src'), [
      '--coverage',
      '../coverage.json',
      '--base',
      'main',
      '.',
    ]);

    expect(result.status).toBe(1);
    expect(result.output).toContain('- src/grade.ts:1 grade: CRAP 156');
  });

  it('refuses to score without a coverage report', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      `No coverage report at ${join(cwd, 'coverage.json')}. Run the tests with coverage first; a run whose tests fail may write none.`,
    );
  });

  it('refuses a coverage report older than the code', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    coverage(cwd);
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(cwd, 'src/keep.ts'), later, later);

    const result = crap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      `The coverage report at ${join(cwd, 'coverage.json')} is older than src/keep.ts. Run the tests again, so it covers the code as it is.`,
    );
  });

  it('says how to run it when the report or paths are missing', () => {
    const cwd = repository({ 'src/keep.ts': 'export const keep = 1;\n' });
    const usage =
      'Usage: node scripts/crap/crap.ts --coverage <report> [--base <ref>] [--guide <doc>] <path>...';

    expect(crap(cwd, ['src']).output).toContain(usage);
    expect(crap(cwd, ['--coverage', 'coverage.json']).output).toContain(usage);
  });
});
