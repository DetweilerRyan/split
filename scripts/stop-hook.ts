#!/usr/bin/env node
// The Claude Code Stop hook in .claude/settings.json. When a session stops with changes in src/ or
// app/, it runs lint, the tests (which write the coverage report) and the CRAP check, and gives
// Claude what fails as advice: `hookSpecificOutput.additionalContext`, which lets the session carry
// on and act on it. It never blocks, and always exits 0. CI runs the same checks and fails on them.
// Why it works this way is in oxcrap/oxcrap.meta.md; read that only when changing or questioning it.
//
// Usage: node scripts/stop-hook.ts, with the hook's JSON input on stdin.
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const WATCHED = ['src', 'app'];

function run(command: string, args: string[], cwd: string) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' },
  });
  if (result.error) throw new Error(`Couldn't run ${command}: ${result.error.message}`);
  return { status: result.status, output: `${result.stdout}${result.stderr}`.trim() };
}

const tail = (text: string, lines: number) => text.split('\n').slice(-lines).join('\n');

/** The advice for Claude, or nothing when there's nothing to say. */
function advice(input: { cwd?: string; stop_hook_active?: boolean }) {
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
  const changed =
    run('git', ['diff', '--quiet', mergeBase, '--', ...WATCHED], root).status !== 0 ||
    run('git', ['ls-files', '--others', '--exclude-standard', '--', ...WATCHED], root).output !==
      '';
  if (!changed) return undefined;

  const sections: string[] = [];
  const lint = run('npm', ['run', 'lint', '--silent'], root);
  if (lint.status !== 0)
    sections.push(`\`npm run lint\` fails. Fix it first:\n${tail(lint.output, 40)}`);
  const tests = run('npm', ['test', '--silent'], root);
  if (tests.status !== 0) {
    sections.push(
      `\`npm test\` fails, so it wrote no coverage report and no CRAP score was calculated. Fix the tests first:\n${tail(tests.output, 60)}`,
    );
  } else {
    const crap = run('npm', ['run', 'oxcrap', '--silent', '--', '--base', base], root);
    if (crap.status !== 0 || crap.output.includes('Notice:')) {
      sections.push(`\`npm run oxcrap\` reports:\n${tail(crap.output, 80)}`);
    }
  }
  if (sections.length === 0) return undefined;
  // `npm run oxcrap` already points to its procedure, so this only says what kind of message it is.
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
