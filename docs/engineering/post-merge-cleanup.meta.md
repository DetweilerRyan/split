# Post-merge cleanup: reasons

Why the steps in [post-merge cleanup](post-merge-cleanup.md) are in the order they are. Read this only when changing or questioning a step. Following the procedure needs nothing from this file.

The procedure is adapted from the owner's market-research repository (`docs/engineering/post-merge-cleanup.md`), without its worktree steps.

- **Files, not commits, show whether work was lost.** This repository's pull requests are often merged by rebase: #31, #32, #34 and #37 landed on `main` under new commit IDs. So git reports the branch as "not fully merged" when nothing is lost, and `git branch -d` refuses to delete it. Comparing the pull request's files with `main` is what tells a rewritten commit from missing work. That's why step 4 uses `git branch -D`, and only after step 2.
- **Only this pull request's files are compared.** Another pull request may merge in between and change the same files. A difference in them is fine when a later merge explains it, and anything else is lost work.
- **Retarget a stacked pull request before deleting its base.** On 2026-11-21, [#39](https://github.com/DetweilerRyan/split/pull/39) was built on #37's branch. After #37 merged, #39 was rebased onto `main` and retargeted before the branch was deleted. Deleting a base branch from the command line may close a pull request built on it, and retargeting first makes that moot.
- **Check a commit the pull request's files name by hash.** [#36](https://github.com/DetweilerRyan/split/pull/36)'s `.git-blame-ignore-revs` names its reformat commit, `ae6eb79`. Matching files don't show that commit is on `main`: a rebase merge would have given it a new hash and left the file pointing at nothing. #36 was merged with a merge commit for that reason, and the cleanup checked `ae6eb79` was an ancestor of `main`.
