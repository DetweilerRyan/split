#!/usr/bin/env node
// Runs Stryker's mutation testing on oxCrap, as docs/engineering/mutation-testing.md says: a full
// run, or only the lines of scripts/oxcrap/ changed since the merge base with origin/main. It's
// expensive: run it once, after the definition of done passes. Each worktree keeps its own
// incremental results file in git's folder, seeded from a baseline every worktree shares. Why is
// in mutation-testing.meta.md.
//
// Usage: npm run test:mutation [-- ...] or npm run test:mutation:changed
// Node runs this as TypeScript by stripping the types, so use only syntax that erases.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

/** The code mutation testing covers; tests and the feature contract aren't mutated. */
const SCOPE = 'scripts/oxcrap';
function mutated(file: string) {
  return (
    file.startsWith(`${SCOPE}/`) &&
    file.endsWith('.ts') &&
    !file.endsWith('.test.ts') &&
    !file.startsWith(`${SCOPE}/features/`)
  );
}

/**
 * The line ranges `git diff --unified=0` reports as added or changed, by file, as Stryker's
 * `--mutate` takes them: `file:start-end`. Deleted lines leave nothing to mutate. It expects the
 * diff `diffArgs` asks for: `a/` and `b/` prefixes and unquoted paths.
 */
export function changedRanges(diff: string): readonly string[] {
  const ranges: string[] = [];
  let file: string | undefined;
  for (const line of diff.split('\n')) {
    // Each file's section starts here, so no hunk is ever counted against the file before it.
    if (line.startsWith('diff --git ')) {
      file = undefined;
      continue;
    }
    if (line.startsWith('+++ ')) {
      // Git ends a path that holds a space with a tab.
      const path = line.slice(4).replace(/\t$/, '');
      file = path.startsWith('b/') ? path.slice(2) : undefined;
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

/** `git diff` with the output `changedRanges` reads, whatever the user's git settings. */
export function diffArgs(base: string) {
  return [
    '-c',
    'core.quotePath=false',
    'diff',
    '--unified=0',
    '--no-color',
    '--no-ext-diff',
    '--no-relative',
    '--src-prefix=a/',
    '--dst-prefix=b/',
    base,
    '--',
    SCOPE,
  ];
}

function git(args: readonly string[], cwd: string) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

/** The mutate arguments for the lines changed since the merge base, new files included whole. */
function changedMutate(root: string) {
  const base = ['origin/main', 'main'].find(
    (ref) =>
      spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], { cwd: root })
        .status === 0,
  );
  if (!base) throw new Error("Couldn't find origin/main or main to compare with.");
  const mergeBase = git(['merge-base', base, 'HEAD'], root);
  const ranges = changedRanges(git(diffArgs(mergeBase), root));
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', SCOPE], root)
    .split('\n')
    .filter((file) => file && mutated(file));
  return [...ranges, ...untracked];
}

/** Copies `from` to `to` through a temporary file, so a reader never sees half of it. */
function copyAtomically(from: string, to: string) {
  mkdirSync(dirname(to), { recursive: true });
  const partial = `${to}.${process.pid}.partial`;
  copyFileSync(from, partial);
  renameSync(partial, to);
}

function stryker(root: string, args: readonly string[]) {
  const result = spawnSync(resolve(root, 'node_modules/.bin/stryker'), args, {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.error) throw new Error(`Couldn't run Stryker: ${result.error.message}`);
  return result.status ?? 1;
}

/** Runs the mutation test, keeping and seeding the incremental file. */
function run() {
  const root = git(['rev-parse', '--show-toplevel'], process.cwd());
  const changed = process.argv.slice(2).includes('--changed');
  const own = resolve(root, git(['rev-parse', '--git-path', 'stryker/incremental.json'], root));
  const common = git(['rev-parse', '--git-common-dir'], root);
  const baseline = resolve(root, common, 'stryker/baseline.json');
  // A new worktree starts from the shared results, so it re-tests only what differs.
  if (!existsSync(own) && existsSync(baseline)) copyAtomically(baseline, own);

  if (changed) {
    const mutate = changedMutate(root);
    if (mutate.length === 0) {
      console.log(`No changed code in ${SCOPE}/ to mutation-test.`);
      return 0;
    }
    // Stryker writes back only the mutants a run tests, so a changed-lines run works on a scratch
    // copy and leaves this worktree's full results in place for the next run.
    const scratch = mkdtempSync(join(tmpdir(), 'stryker-changed-'));
    const file = join(scratch, 'incremental.json');
    if (existsSync(own)) copyFileSync(own, file);
    try {
      return stryker(root, [
        'run',
        '--incremental',
        '--incrementalFile',
        file,
        '--mutate',
        mutate.join(','),
      ]);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  }

  // A full run tests every mutant again, so it also catches what incremental mode can't see: a
  // change to a dependency or a shared helper. It starts from no results, since it reuses none,
  // and Stryker keeps reporting a file from old results after it leaves `mutate`.
  rmSync(own, { force: true });
  const status = stryker(root, ['run', '--incremental', '--force', '--incrementalFile', own]);
  if (status !== 0) return status;
  // Its results describe main's oxCrap when this worktree hasn't changed oxCrap, so they become
  // the baseline every new worktree starts from.
  if (changedMutate(root).length === 0) {
    copyAtomically(own, baseline);
    console.log(`Saved this run as the baseline other worktrees start from: ${baseline}`);
  }
  return 0;
}

// Run when called as a program; a test only imports what it checks.
if (import.meta.main) process.exitCode = run();
