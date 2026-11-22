// Works out which lines a branch changes, from git.
import { spawnSync } from 'node:child_process';

/** The changed lines in each file, or 'all' for a new file git doesn't track yet. */
export type Changed = Map<string, Set<number> | 'all'>;

/** Reads the new side's changed lines from `git diff --unified=0` output. */
export function parseDiff(diff: string): Changed {
  const changed: Changed = new Map();
  let lines: Set<number> | undefined;
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ ')) {
      lines = line === '+++ /dev/null' ? undefined : new Set();
      if (lines) changed.set(line.slice(6), lines);
      continue;
    }
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!hunk || !lines) continue;
    const start = Number(hunk[1]);
    const count = hunk[2] === undefined ? 1 : Number(hunk[2]);
    // A deletion has no new lines; mark the lines either side of it as changed.
    if (count === 0) lines.add(start).add(start + 1);
    for (let n = start; n < start + count; n++) lines.add(n);
  }
  return changed;
}

/** Whether any of lines `from` to `to` changed. */
export const isChanged = (lines: Set<number> | 'all' | undefined, from: number, to: number) =>
  lines === 'all' || (lines !== undefined && [...lines].some((n) => n >= from && n <= to));

export function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (result.error) throw new Error(`Couldn't run git: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stdout}${result.stderr}`);
  }
  return result.stdout.trim();
}

/** Lines changed in `paths` since the merge base with `base`, working tree and new files included. */
export function changedLines(root: string, base: string, paths: string[]): Changed {
  const mergeBase = git(root, 'merge-base', base, 'HEAD');
  const changed = parseDiff(
    git(root, 'diff', '--unified=0', '--no-color', '--no-ext-diff', mergeBase, '--', ...paths),
  );
  const untracked = git(root, 'ls-files', '--others', '--exclude-standard', '--', ...paths);
  for (const path of untracked.split('\n').filter(Boolean)) changed.set(path, 'all');
  return changed;
}
