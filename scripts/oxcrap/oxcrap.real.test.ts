import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// The script's contract, end to end: it runs as a program on a plain folder, not a git repository,
// given a coverage report. The rules themselves are tested beside each module.

const script = fileURLToPath(new URL('./oxcrap.ts', import.meta.url));
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

/** A plain folder holding `files`: no git, no package.json. */
function project(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-oxcrap-test-'));
  directories.push(cwd);
  write(cwd, files);
  return cwd;
}

/**
 * Writes coverage.json as a test run would: one statement per non-blank line of each listed file,
 * run when it's in `covered`. Written last, so it's newer than the code.
 */
function coverage(cwd: string, files: string[], covered: string[] = []) {
  const report: Record<string, unknown> = {};
  for (const file of files) {
    const statementMap: Record<string, unknown> = {};
    const s: Record<string, number> = {};
    readFileSync(join(cwd, file), 'utf8')
      .split('\n')
      .forEach((line, index) => {
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

function oxcrap(cwd: string, args = ['--coverage', 'coverage.json', 'src']) {
  const result = spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

const allow = (crap: number, complexity: number) =>
  `// @crap-allow CRAP ${crap}, complexity ${complexity}. One branch per row of the rate table.\n`;

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('oxcrap', () => {
  it('fails a function over the limits, says what comment would allow it, and points to the guide', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 11) });
    coverage(cwd, ['src/grade.ts']);

    const result = oxcrap(cwd, ['--coverage', 'coverage.json', '--guide', 'GUIDE.md', 'src']);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 156, complexity 12, coverage 0%. Over the limits (CRAP 30, complexity 10). To leave it, add `// @crap-allow CRAP 156, complexity 12. <reason>` directly above it.',
    );
    expect(result.output).toContain('Follow GUIDE.md to respond.');
  });

  it('passes a function its tests run all of', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 5) });
    coverage(cwd, ['src/grade.ts'], ['src/grade.ts']);

    const result = oxcrap(cwd);

    expect(result.output).toContain('No CRAP findings.');
    expect(result.status).toBe(0);
  });

  it('passes a function whose @crap-allow comment gives its numbers, and fails one that no longer matches', () => {
    const cwd = project({ 'src/grade.ts': allow(156, 12) + branchy('grade', 11) });
    coverage(cwd, ['src/grade.ts']);
    expect(oxcrap(cwd).status).toBe(0);

    write(cwd, { 'src/grade.ts': allow(156, 12) + branchy('grade', 12) });
    coverage(cwd, ['src/grade.ts']);
    const result = oxcrap(cwd);
    expect(result.status).toBe(1);
    expect(result.output).toContain(
      '- src/grade.ts:1 grade: CRAP 182, complexity 13, coverage 0%, but its @crap-allow comment says CRAP 156, complexity 12. Update the comment to `// @crap-allow CRAP 182, complexity 13.`, and check its reason still holds.',
    );
  });

  it('scores every file under a path, but not tests, node_modules or dot-folders', () => {
    const cwd = project({
      'src/deep/rank.ts': branchy('rank', 11),
      'src/rank.test.ts': branchy('rankTest', 11),
      'src/node_modules/lib/index.ts': branchy('lib', 11),
      'src/.cache/built.ts': branchy('built', 11),
    });
    coverage(cwd, []);

    const result = oxcrap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain('- src/deep/rank.ts:1 rank: CRAP 156');
    expect(result.output).not.toMatch(/rankTest|lib:|built:/);
  });

  it('names files from the directory it runs in', () => {
    const cwd = project({ 'src/grade.ts': branchy('grade', 11) });
    coverage(cwd, ['src/grade.ts']);

    const result = oxcrap(join(cwd, 'src'), ['--coverage', '../coverage.json', '.']);

    expect(result.status).toBe(1);
    expect(result.output).toContain('- grade.ts:1 grade: CRAP 156');
  });

  it('refuses to score without a coverage report', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });

    const result = oxcrap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'No coverage report at coverage.json. Run the tests with coverage first; a run whose tests fail may write none.',
    );
  });

  it('refuses a coverage report older than the code', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
    coverage(cwd, ['src/keep.ts']);
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(cwd, 'src/keep.ts'), later, later);

    const result = oxcrap(cwd);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      'The coverage report at coverage.json is older than src/keep.ts. Run the tests again, so it covers the code as it is.',
    );
  });

  it('says what’s wrong when a path is missing, or the report or paths aren’t given', () => {
    const cwd = project({ 'src/keep.ts': 'export const keep = 1;\n' });
    coverage(cwd, ['src/keep.ts']);
    const usage =
      'Usage: node scripts/oxcrap/oxcrap.ts --coverage <report> [--guide <doc>] <path>...';

    expect(oxcrap(cwd, ['--coverage', 'coverage.json', 'lib']).output).toContain(
      'No file or folder at lib.',
    );
    expect(oxcrap(cwd, ['src']).output).toContain(usage);
    expect(oxcrap(cwd, ['--coverage', 'coverage.json']).output).toContain(usage);
  });
});
