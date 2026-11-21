# Branch setup

Do every branch's work in its own git worktree under `.claude/worktrees/`. Keep the main checkout on `main`, so its working tree only ever changes when `main` is updated.

## Starting a branch

For a branch that already exists, follow [Resuming a branch](branch-resume.md) instead.

1. **Create the worktree from `origin/main`.** In Claude Code, use the `EnterWorktree` tool, which creates it under `.claude/worktrees/` and switches the session into it. Otherwise:

   ```bash
   git fetch origin main
   git worktree add -b <branch> .claude/worktrees/<name> origin/main
   cd .claude/worktrees/<name>
   ```

   Name the branch as the repository's branches are named, `<kind>/<topic>` (for example `docs/worktrees`), and rename a generated one with `git branch -m <branch>` before pushing.

2. **Install dependencies in the worktree.** Each worktree has its own `node_modules`. From the worktree's root:

   ```bash
   sh scripts/prepare-sandbox.sh
   ```

3. **Run everything for the branch from its worktree**: edits, commits, the [definition-of-done checks](../../AGENTS.md#definition-of-done), and pushes. Don't run a branch's git commands from the main checkout or another worktree.

## Where worktrees live

- `.claude/worktrees/` is listed in `.gitignore`, which keeps oxlint and oxfmt out of it, and `vitest.config.ts` excludes it. Together they stop a check run in one checkout from also checking another worktree's files. If you move or rename the folder, update both.
- In the [dev container](../../.sbx-kits/splitsmart/README.md#clone-mode-and-vs-code), open the main checkout, not a worktree folder. A worktree's git metadata lives in the main checkout's `.git`, which the container mounts only when the main checkout is its workspace; the worktrees are visible inside it.

## Finishing

After the pull request merges, [post-merge cleanup](post-merge-cleanup.md) removes the worktree along with its branch.

## Changing this document

The reasons for these rules and the decisions behind them are in [branch-setup.meta.md](branch-setup.meta.md). Read it only when changing or questioning a rule here.
