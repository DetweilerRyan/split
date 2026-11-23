#!/usr/bin/env node
// The Claude Code Stop hook in .claude/settings.json. When a session stops with changes in the app
// (APP below), it runs lint, the tests (which write the coverage report) and the CRAP check; with
// changes in tooling (TOOLING below), lint and the tooling tests. It gives
// Claude what fails as advice: `hookSpecificOutput.additionalContext`, which lets the session carry
// on and act on it. It never blocks, and always exits 0. CI runs the same checks and fails on them.
// Its README is stop-hook.md beside it; why it works this way is in stop-hook.meta.md, to read
// only when changing or questioning it.
//
// Usage: node scripts/stop-hook.ts, with the hook's JSON input on stdin.
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

// What counts as a change, and what each kind runs. A path in both runs both.
/** The app's code and its test setup: lint, `npm test` and `npm run oxcrap:app`. */
const APP = [
  'src',
  'app',
  'vitest.config.ts',
  'vitest.config.browser.test.ts',
  '.oxcraprc.json',
  'package.json',
];
/**
 * Tooling and its tests: lint, `npm run test:tooling` and `npm run oxcrap:tooling`, which scores
 * oxCrap's own code.
 */
const TOOLING = [
  'scripts',
  'vitest.tooling.config.ts',
  'vitest.tooling-real.config.ts',
  '.oxlintrc.json',
  '.rev-dep.config.jsonc',
  'rev-dep.config.real.test.ts',
  'stryker.config.json',
  'package.json',
];
const WATCHED = [...new Set([...APP, ...TOOLING])];
/** How long a session's fingerprint is kept after its last stop. */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000;

function run(command: string, args: string[], cwd: string) {
  // On Windows, npm is npm.cmd, which Node runs only through a shell.
  const shell = process.platform === 'win32' && command === 'npm';
  const result = spawnSync(shell ? `${command} ${args.join(' ')}` : command, shell ? [] : args, {
    cwd,
    shell,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  if (result.error) throw new Error(`Couldn't run ${command}: ${result.error.message}`);
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

const tail = (text: string, lines: number) => text.split('\n').slice(-lines).join('\n');

/**
 * A hash of the work in WATCHED: the commit, every change git sees there since it, and the
 * contents of new files. It changes with any edit, however it was made: an Edit, a Bash command
 * or a commit.
 */
function fingerprint(root: string) {
  const hash = createHash('sha256');
  hash.update(run('git', ['rev-parse', 'HEAD'], root).output);
  hash.update(
    run('git', ['diff', 'HEAD', '--no-ext-diff', '--binary', '--', ...WATCHED], root).output,
  );
  const untracked = run(
    'git',
    ['ls-files', '--others', '--exclude-standard', '-z', '--', ...WATCHED],
    root,
  );
  for (const file of untracked.output.split('\0').filter(Boolean).sort()) {
    hash.update(`\0${file}\0`).update(readFileSync(join(root, file)));
  }
  return hash.digest('hex');
}

/**
 * The file holding a session's fingerprint from its last stop, inside the repository's git folder
 * (a worktree's own), so it's never committed and each worktree keeps its own. Old ones are pruned.
 */
function stateFile(root: string, session: string) {
  const folder = resolve(
    root,
    run('git', ['rev-parse', '--git-path', 'claude-stop-hook'], root).output,
  );
  mkdirSync(folder, { recursive: true });
  for (const name of readdirSync(folder)) {
    const path = join(folder, name);
    if (Date.now() - statSync(path).mtimeMs > KEEP_MS) rmSync(path, { force: true });
  }
  return join(folder, session.replace(/[^\w-]/g, '_'));
}

/** The advice for Claude, or nothing when there's nothing to say. */
function advice(input: { cwd?: string; stop_hook_active?: boolean; session_id?: string }) {
  // Advise once: when Claude is already continuing because of a stop hook, let it stop.
  if (input.stop_hook_active) return undefined;
  const top = run('git', ['rev-parse', '--show-toplevel'], input.cwd ?? process.cwd());
  if (top.status !== 0) return undefined;
  const root = top.output;
  const base = ['origin/main', 'main'].find(
    (ref) => run('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], root).status === 0,
  );
  if (!base) return `The Stop hook couldn't find origin/main or main to compare with.`;
  const mergeBase = run('git', ['merge-base', base, 'HEAD'], root).output;
  const changedIn = (paths: string[]) =>
    run('git', ['diff', '--quiet', mergeBase, '--', ...paths], root).status !== 0 ||
    run('git', ['ls-files', '--others', '--exclude-standard', '--', ...paths], root).output !== '';
  const app = changedIn(APP);
  const tooling = changedIn(TOOLING);
  if (!app && !tooling) return undefined;

  // Stay quiet when nothing in WATCHED changed since this session's last stop. It's saved before
  // the checks run, so whatever they report is reported once, not on every stop after.
  if (input.session_id) {
    const state = stateFile(root, input.session_id);
    const now = fingerprint(root);
    if (existsSync(state) && readFileSync(state, 'utf8') === now) return undefined;
    mkdirSync(dirname(state), { recursive: true });
    writeFileSync(state, now);
  }

  const sections: string[] = [];
  const lint = run('npm', ['run', 'lint', '--silent'], root);
  if (lint.status !== 0)
    sections.push(`\`npm run lint\` fails. Fix it first:\n${tail(lint.output, 40)}`);
  if (app) {
    const tests = run('npm', ['test', '--silent'], root);
    if (tests.status !== 0) {
      sections.push(
        `\`npm test\` fails, so it wrote no coverage report and no CRAP score was calculated. Fix the tests first:\n${tail(tests.output, 60)}`,
      );
    } else {
      const crap = run('npm', ['run', 'oxcrap:app', '--silent'], root);
      if (crap.status !== 0) {
        sections.push(`\`npm run oxcrap:app\` reports:\n${tail(crap.output, 80)}`);
      }
    }
  }
  if (tooling) {
    const tools = run('npm', ['run', 'test:tooling', '--silent'], root);
    if (tools.status !== 0) {
      sections.push(
        `\`npm run test:tooling\` fails, so no CRAP score was calculated for oxCrap. Fix the tests first:\n${tail(tools.output, 60)}`,
      );
    } else {
      const crap = run('npm', ['run', 'oxcrap:tooling', '--silent'], root);
      if (crap.status !== 0) {
        sections.push(`\`npm run oxcrap:tooling\` reports:\n${tail(crap.output, 80)}`);
      }
    }
  }
  if (sections.length === 0) return undefined;
  // oxCrap already says where to get help, so this only says what kind of message it is.
  return `${sections.join('\n\n')}\n\nThis is advice; CI fails on each of these.`;
}

let message: string | undefined;
try {
  const stdin = readFileSync(0, 'utf8').trim();
  message = advice(stdin ? JSON.parse(stdin) : {});
} catch (error) {
  message = `The Stop hook couldn't run: ${error instanceof Error ? error.message : String(error)}`;
}
if (message) {
  console.log(
    JSON.stringify({ hookSpecificOutput: { hookEventName: 'Stop', additionalContext: message } }),
  );
}
