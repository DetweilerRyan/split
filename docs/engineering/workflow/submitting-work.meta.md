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

- **The rule comes from Kent C. Dodds's [`autopilot` verification guide](https://github.com/kentcdodds/kcd-skills/blob/main/skills/autopilot/references/verification.md):** "Reviewers (AI and human) check every changed test expectation against the PR's intent. When a PR changes an assertion alongside the code it tests, the PR body says why." Added on [#38](https://github.com/DetweilerRyan/split/issues/38), which the owner approved.
- **Why it matters:** a test changed in the same pull request as the code it tests can hide a regression. The code broke, and the test was edited until it agreed. A reason tied to the pull request's intent is what separates a deliberate change from that.
- **The first case:** [#37](https://github.com/DetweilerRyan/split/pull/37) narrowed the first-render assertion of `useActiveIdentity`'s tests from an exact list of renders to "the first render has the identity, and none is empty". It gave the reason: a re-render with the same identity after saving the fallback. The narrowed assertion still failed against the original effect-based hook, which showed it kept catching what it was for.
