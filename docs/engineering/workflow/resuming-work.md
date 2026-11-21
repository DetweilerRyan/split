# Resuming work

When a session picks up a branch that an earlier session started, whether a new session or one whose context was cleared, find the branch's [worktree](starting-work.md), enter it, and work out where the branch stands before changing anything.

## Steps

Replace `<branch>` with the branch, `<n>` with its pull request number, and `<name>` with its worktree's folder.

1. **Find the worktree.** From the main checkout:

   ```bash
   git worktree list
   gh pr list --head <branch>               # the branch's pull request, if it has one
   ```

   If the branch has no worktree, for example because its work started in another sandbox, create one for the existing branch instead of a new one:

   ```bash
   git fetch origin <branch>
   git worktree add .claude/worktrees/<name> <branch>
   ```

2. **Enter it.** In Claude Code, use `EnterWorktree` with `path: ".claude/worktrees/<name>"`. Otherwise `cd` into it. Run everything for the branch from there, as [starting work](starting-work.md) says.

3. **See what the earlier session left.** Read these before changing anything:

   ```bash
   git status --short                       # uncommitted work the earlier session left
   git log --oneline origin/main..HEAD      # the branch's commits
   gh pr view <n> --comments                # its state, description, decisions and feedback
   gh api repos/{owner}/{repo}/pulls/<n>/comments --jq '.[] | {path, body}'   # inline review comments
   ```

   The pull request description's "Decisions made" and "For the owner to confirm" say what is settled and what is still open. Feedback in the comments with no reply yet is still to do; [revising work](revising-work.md) says how to handle it. Don't reopen a settled decision. Keep uncommitted work unless you know it's abandoned, and ask the owner if you don't.

4. **Refresh dependencies.** From the worktree's root, `sh scripts/prepare-sandbox.sh`. It skips the install when nothing has changed.

5. **Catch up with the remote.** Before pushing, follow [Before pushing to a branch that has had a pull request](submitting-work.md#before-pushing-to-a-branch-that-has-had-a-pull-request) in submitting work. If `main` has moved, follow [When `main` moves](submitting-work.md#when-main-moves).

## Changing this document

The reasons for these rules and the decisions behind them are in [resuming-work.meta.md](resuming-work.meta.md). Read it only when changing or questioning a rule here.
