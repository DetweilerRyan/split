# Cleaning up merged work

After a pull request you worked on is merged, remove its [worktree](starting-work.md), delete its branches and bring `main` up to date. Do it in this order: every deletion comes after a check that the merged work is really on `main`.

## Steps

Replace `<n>` with the pull request number, `<branch>` with its branch, and `<name>` with its worktree's folder.

1. **Confirm the merge.** Stop unless `state` is `MERGED`.

   ```bash
   gh pr view <n> --json state,mergeCommit
   git fetch --prune origin
   ```

2. **Confirm the pull request's files are on `main`.** Compare files, not commits: after a squash or rebase merge, the commits on `main` have new IDs, and git reports the branch as not fully merged even when nothing is lost.

   ```bash
   gh pr diff <n> --name-only                       # the files this pull request changed
   git diff --stat <branch> origin/main -- <files>  # must be empty
   ```

   If a file differs, read the differing lines. Each must come from a pull request merged later; anything else means work was lost, so stop.

   If one of the pull request's files names one of its own commits by hash, as `.git-blame-ignore-revs` does, also check that the commit is on `main`. `git merge-base --is-ancestor <hash> origin/main` must succeed.

3. **Check for leftovers.** In the branch's worktree, `git status --short` must show nothing you'd lose. Copy any untracked work somewhere durable before deleting anything.

4. **Delete the branches.** Run this step and the ones after it from the main checkout, not the branch's worktree. If the Claude Code session entered the worktree with `EnterWorktree`, leave it with `ExitWorktree` and `action: "keep"`, which returns the session to the main checkout. Don't use `action: "remove"`: it deletes the branch along with the worktree, before the checks below. Take the branch's name from `git worktree list` below, not from `ExitWorktree`'s message, which can give a name the branch had before it was renamed.

   First check that no open pull request is built on this branch, and retarget any that is (`gh pr edit <m> --base main`) before deleting:

   ```bash
   git worktree list                        # the branch's worktree, and its branch's current name
   gh pr list --base <branch>
   git worktree remove .claude/worktrees/<name>   # refuses if step 3 missed changes
   git branch -D <branch>                   # -D, because git sees rewritten commits as unmerged
   git ls-remote --heads origin <branch>    # tip must be the commit verified in step 2
   git push origin --delete <branch>
   ```

   Skip the remote deletion if the branch is already gone (GitHub can delete it on merge).

5. **Update `main`.**

   ```bash
   git status -sb                           # in the main checkout
   git pull --ff-only origin main
   ```

6. **Verify.** `git branch -a` shows none of the pull request's branches, `git worktree list` doesn't show its worktree, and the [definition-of-done checks](../../../AGENTS.md#definition-of-done) pass on `main`.

## Never

- Delete a branch before step 2 passes.
- Force-push to get past a difference step 2 couldn't explain.
- Merge `main` into a branch to make the comparison pass.

## Clone-mode sandboxes

In a [clone-mode sandbox](../../../.sbx-kits/splitsmart/README.md#clone-mode-and-vs-code) the branches above live in the sandbox's clone, and the same steps apply there. Removing the sandbox deletes the clone, including unpushed commits and untracked files.

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [cleaning-up-merged-work.meta.md](cleaning-up-merged-work.meta.md). Read it only when changing or questioning a rule here.
