# Post-merge cleanup

After a pull request you worked on is merged, delete its branches and bring `main` up to date. Do it in this order: every deletion comes after a check that the merged work is really on `main`.

## Steps

Replace `<n>` with the pull request number and `<branch>` with its branch.

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

3. **Check for leftovers.** `git status --short` must show nothing you'd lose. Copy any untracked work somewhere durable before deleting anything.

4. **Delete the branches.** First check that no open pull request is built on this branch, and retarget any that is (`gh pr edit <m> --base main`) before deleting:

   ```bash
   gh pr list --base <branch>
   git switch main
   git branch -D <branch>                   # -D, because git sees rewritten commits as unmerged
   git ls-remote --heads origin <branch>    # tip must be the commit verified in step 2
   git push origin --delete <branch>
   ```

   Skip the remote deletion if the branch is already gone (GitHub can delete it on merge).

5. **Update `main`.**

   ```bash
   git status -sb
   git pull --ff-only origin main
   ```

6. **Verify.** `git branch -a` shows none of the pull request's branches, and the [definition-of-done checks](../../AGENTS.md#definition-of-done) pass on `main`.

## Never

- Delete a branch before step 2 passes.
- Force-push to get past a difference step 2 couldn't explain.
- Merge `main` into a branch to make the comparison pass.

## Clone-mode sandboxes

In a [clone-mode sandbox](../../.sbx-kits/splitsmart/README.md#clone-mode-and-vs-code) the branches above live in the sandbox's clone, and the same steps apply there. Removing the sandbox deletes the clone, including unpushed commits and untracked files.

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [post-merge-cleanup.meta.md](post-merge-cleanup.meta.md). Read it only when changing or questioning a rule here.
