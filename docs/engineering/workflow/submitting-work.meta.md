# Submitting work: reasons and sources

Why the rules in [submitting work](submitting-work.md) are as they are, and the cases behind them. Read this only when changing or questioning one of them. Following the procedure needs nothing from this file.

The procedure is adapted from the owner's market-research repository (`docs/engineering/pull-request-discipline.md`), trimmed for this repository. Its independent review on every pull request, statistics review and squash-before-rebase step were left out as heavier than this repository needs. The choice is recorded on [#32](https://github.com/DetweilerRyan/split/pull/32).

## Draft until done

- **The state carries the message because GitHub won't merge a draft.** A ready pull request with a message saying "please wait" still reads as mergeable from the pull request list. A draft can't be merged by accident.
- **Recheck after `main` moves, even on a clean rebase.** A change on `main` can break a pull request's tests without touching its lines. market-research's procedure records the case: a pull request marked ready, then `main` marked a platform not supported, and the pull request merged without a second run. Two of its tests named that platform, so `main` failed until a fix merged.

## Before pushing

- **Fetch first.** On 2026-11-20, GitHub Copilot pushed `8e5f8cc` to the branch of [#31](https://github.com/DetweilerRyan/split/pull/31) while a Claude session had local commits on it. Rebasing onto the remote branch kept both. A plain push would have been rejected, and a force-push would have discarded Copilot's commit.
- **Check the pull request is still open.** A push after the merge lands on a branch nobody will merge, and GitHub gives no warning.

## Changed test expectations

Why a pull request must list its changed test expectations, and where the rule comes from, is in [reviewing-work.meta.md](reviewing-work.meta.md#changed-test-expectations): the description carries the list so that a review can check it.
