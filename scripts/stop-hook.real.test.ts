import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./stop-hook.ts', import.meta.url));
const directories: string[] = [];

// Fakes of the three npm scripts the hook runs. `lint` fails when LINT_FAILS is set, `test` when
// a file named tests-fail exists, and `oxcrap` prints crap-output, then the arguments it was given,
// and exits with crap-status. `oxcrap` is a file, as the real one is, so npm's added arguments reach
// it rather than node.
const scripts = {
  lint: 'node -e "if (process.env.LINT_FAILS) { console.log(\'lint: 1 problem\'); process.exit(1) }"',
  test: "node -e \"const fs = require('fs'); if (fs.existsSync('tests-fail')) { console.log('FAIL adds up'); process.exit(1) }\"",
  oxcrap: 'node fake-crap.mjs',
};
const fakeCrap = `import { existsSync, readFileSync } from 'node:fs';
const read = (file, otherwise) => (existsSync(file) ? readFileSync(file, 'utf8') : otherwise);
console.log(read('crap-output', 'No CRAP findings.') + ' args: ' + process.argv.slice(2).join(' '));
process.exit(Number(read('crap-status', '0')));
`;

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

/** A git repository on `main` with the fake npm scripts, checked out on a branch `work`. */
function repository() {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-stop-hook-test-'));
  directories.push(cwd);
  write(cwd, {
    'package.json': JSON.stringify({ scripts }),
    'fake-crap.mjs': fakeCrap,
    '.gitignore': 'tests-fail\ncrap-output\ncrap-status\n',
    'src/keep.ts': 'export const keep = 1;\n',
  });
  git(cwd, 'init', '--quiet', '--initial-branch=main');
  git(cwd, 'add', '.');
  git(cwd, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'base');
  git(cwd, 'checkout', '--quiet', '-b', 'work');
  return cwd;
}

function hook(cwd: string, input: object, env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [script], {
    cwd,
    input: JSON.stringify({ cwd, ...input }),
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  const context = result.stdout
    ? (JSON.parse(result.stdout).hookSpecificOutput.additionalContext as string)
    : undefined;
  return { status: result.status, stdout: result.stdout, context };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('stop-hook', () => {
  it('gives Claude the CRAP check’s findings as additional context, and exits 0', () => {
    const cwd = repository();
    write(cwd, {
      'src/grade.ts': 'export const grade = 1;\n',
      'crap-output': 'CRAP findings: grade is over the limits.',
      'crap-status': '1',
    });

    const result = hook(cwd, { stop_hook_active: false });

    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout).hookSpecificOutput.hookEventName).toBe('Stop');
    expect(result.context).toContain(
      '`npm run oxcrap` reports:\nCRAP findings: grade is over the limits.',
    );
    expect(result.context).toContain('This is advice; CI fails on each of these.');
  });

  it('says nothing when the checks pass', () => {
    const cwd = repository();
    write(cwd, { 'src/grade.ts': 'export const grade = 1;\n' });

    expect(hook(cwd, { stop_hook_active: false })).toMatchObject({ status: 0, stdout: '' });
  });

  it('says nothing when Claude is already continuing because of a stop hook', () => {
    const cwd = repository();
    write(cwd, { 'src/grade.ts': 'export const grade = 1;\n', 'crap-status': '1' });

    expect(hook(cwd, { stop_hook_active: true })).toMatchObject({ status: 0, stdout: '' });
  });

  it('says nothing, and runs nothing, when src/ and app/ haven’t changed', () => {
    const cwd = repository();
    write(cwd, { 'README.md': 'Changed.\n', 'tests-fail': '' });

    expect(hook(cwd, { stop_hook_active: false })).toMatchObject({ status: 0, stdout: '' });
  });

  it('puts lint failures first, and gives no CRAP score while the tests fail', () => {
    const cwd = repository();
    write(cwd, {
      'src/grade.ts': 'export const grade = 1;\n',
      'tests-fail': '',
      'crap-status': '1',
    });

    const { context } = hook(cwd, { stop_hook_active: false }, { LINT_FAILS: '1' });

    expect(context?.indexOf('`npm run lint` fails. Fix it first:\nlint: 1 problem')).toBe(0);
    expect(context).toContain(
      '`npm test` fails, so it wrote no coverage report and no CRAP score was calculated. Fix the tests first:\nFAIL adds up',
    );
    expect(context).not.toContain('npm run oxcrap');
  });
});
