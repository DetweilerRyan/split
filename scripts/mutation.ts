#!/usr/bin/env node
// Runs Stryker's mutation testing on oxCrap, as docs/engineering/mutation-testing.md says: a full
// run, or only the lines of scripts/oxcrap/ changed since the merge base with origin/main. Either
// way it keeps an incremental results file per worktree, in git's folder, seeded from a baseline
// every worktree shares, which a full run on main refreshes. Why is in mutation-testing.meta.md.
//
// Usage: node scripts/mutation.ts [--changed]
// Node runs this as TypeScript by stripping the types, so use only syntax that erases.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/** The code mutation testing covers; tests and the feature contract aren't mutated. */
const SCOPE = 'scripts/oxcrap';
const mutated = (file: string) =>
  file.startsWith(`${SCOPE}/`) &&
  file.endsWith('.ts') &&
  !file.endsWith('.test.ts') &&
  !file.startsWith(`${SCOPE}/features/`);

/**
 * The line ranges `git diff --unified=0` reports as added or changed, by file, as Stryker's
 * `--mutate` takes them: `file:start-end`. Deleted lines leave nothing to mutate.
 */
export function changedRanges(diff: string): string[] {
  const ranges: string[] = [];
  let file: string | undefined;
  for (const line of diff.split('\n')) {
    const header = /^\+\+\+ (?:b\/(.+)|\/dev\/null)$/.exec(line);
    if (header) {
      file = header[1];
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (hunk && file && mutated(file)) {
      const start = Number(hunk[1]);
      const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
      if (count > 0) ranges.push(`${file}:${start}-${start + count - 1}`);
    }
  }
  return ranges;
}

function git(args: string[]) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

/** The mutate arguments for the lines changed since the merge base, new files included whole. */
function changedMutate() {
  const base = ['origin/main', 'main'].find(
    (ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]).status === 0,
  );
  if (!base) throw new Error("Couldn't find origin/main or main to compare with.");
  const mergeBase = git(['merge-base', base, 'HEAD']);
  const ranges = changedRanges(
    git(['diff', '--unified=0', '--no-ext-diff', mergeBase, '--', SCOPE]),
  );
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', SCOPE])
    .split('\n')
    .filter((file) => file && mutated(file));
  return [...ranges, ...untracked];
}

/** Runs the mutation test, keeping and seeding the incremental file. */
function run() {
  const changed = process.argv.slice(2).includes('--changed');
  const own = resolve(git(['rev-parse', '--git-path', 'stryker/incremental.json']));
  const baseline = resolve(git(['rev-parse', '--git-common-dir']), 'stryker/baseline.json');
  mkdirSync(dirname(own), { recursive: true });
  // A new worktree starts from main's results, so it re-tests only what differs.
  if (!existsSync(own) && existsSync(baseline)) copyFileSync(baseline, own);

  const args = ['run', '--incremental', '--incrementalFile', own];
  if (changed) {
    const mutate = changedMutate();
    if (mutate.length === 0) {
      console.log(`No changed code in ${SCOPE}/ to mutation-test.`);
      return;
    }
    args.push('--mutate', mutate.join(','));
  } else {
    // A full run tests every mutant again, so it also catches what incremental mode can't see: a
    // change to a dependency or a shared helper.
    args.push('--force');
  }

  const stryker = resolve('node_modules/.bin/stryker');
  const result = spawnSync(stryker, args, { stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);

  if (!changed && git(['rev-parse', '--abbrev-ref', 'HEAD']) === 'main') {
    mkdirSync(dirname(baseline), { recursive: true });
    copyFileSync(own, baseline);
    console.log(`Saved this run as the baseline other worktrees start from: ${baseline}`);
  }
}

// Run when called as a program; a test only imports `changedRanges`.
if (import.meta.main) run();
