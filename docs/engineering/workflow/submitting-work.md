# Submitting work

A pull request's state is a message to the owner: **draft means "not yet"; ready means "you may merge this".** Keep both true, so the owner can tell from the pull request list alone what can be merged.

## Draft until done

1. **Open every pull request as a draft,** with the description [below](#what-the-description-carries).

   ```bash
   gh pr create --draft --title "<title>" --body-file <file>
   ```

2. **Mark it ready only when** every check in [`AGENTS.md`'s definition of done](../../../AGENTS.md#definition-of-done) passes on the pushed branch, its [CI](../ci.md) run has passed, and every question for the owner has been answered.

   ```bash
   gh pr checks <n>
   ```

   ```bash
   gh pr ready <n>
   ```

3. **Put it back to draft when the work reopens:** a review finds something to fix, a new decision changes it, or a rebase conflicts.

   ```bash
   gh pr ready <n> --undo
   ```

4. **Never use a message in place of the state.** If the owner should wait, the pull request is a draft.

The owner merges. A session never merges a pull request and never pushes to `main`. After the merge, follow [Cleaning up merged work](cleaning-up-merged-work.md).

## Before pushing to a branch that has had a pull request

- **Check the pull request is still open.** A push that lands after the merge is not part of it, and nothing warns you.

  ```bash
  gh pr view <n> --json state,isDraft
  ```

  If it has merged, branch from `origin/main` and open a new pull request for what remains.

- **Fetch first.** Another agent, such as GitHub Copilot, may have pushed to the same branch. Rebase your commits onto the remote branch rather than overwriting it.

  ```bash
  git fetch origin <branch>
  git log --oneline HEAD..origin/<branch>   # commits you don't have yet
  git rebase origin/<branch>
  ```

## When `main` moves

Rebase onto `origin/main`, never merge `main` in ([`AGENTS.md`](../../../AGENTS.md#boundaries)), then run the definition-of-done checks again, even when the rebase is clean: a change on `main` can break a pull request's tests without touching its lines. Put a ready pull request back to draft if anything fails.

```bash
git fetch origin main
git rebase origin/main
git push --force-with-lease
```

## What the description carries

The owner reads the description, not the diff, to decide what to look at.

- **What to look at:** three points at most, the ones that need the owner's eye.
- **Decisions made:** each choice the session made that the issue didn't settle, with the alternative and a one-line reason. The owner can overrule one here without it blocking the work.
- **For the owner to confirm:** only questions the session can't settle from the repository or the issue. Say "nothing" when there is nothing.
- **Changed test expectations:** each assertion the pull request changes in an existing test, with the reason, which a [review](reviewing-work.md) checks. "Nothing" when there is nothing. Adding a test is not a change; editing or deleting what one expects is.
- **Verification:** which checks you ran and their result, and what was not verified. A skipped step is said to be skipped.
- **Links:** the issue it closes or relates to (`Closes #<n>` closes the issue on merge).

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [submitting-work.meta.md](submitting-work.meta.md). Read it only when changing or questioning a rule here.
