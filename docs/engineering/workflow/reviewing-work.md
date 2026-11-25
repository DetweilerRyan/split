# Reviewing work

A review checks work against what it says it is for. It happens in two places:

- **Your own work, before you open its pull request, and again before pushing a revision.** Every session reviews its own branch before [submitting it](submitting-work.md), and again after [revising it](revising-work.md). Fix what the review finds, or say in the description why you left it.
- **Someone else's pull request,** when a session or agent is asked to check one. The owner decides whether it merges; the review says what the owner should know first. Report findings as review comments on the lines they concern.

The checks are the same in both.

## What to read

For your own work, read the whole diff of the branch against `main`, not only your last change:

```bash
git fetch origin main
git diff origin/main...HEAD
```

For a pull request, read its description first, then its diff:

```bash
gh pr view <n>
gh pr diff <n>
```

## Changed test expectations

Check every changed test expectation against what the work is for. Each one needs a reason that the work's intent explains, written in the description under "Changed test expectations" (see [What the description carries](submitting-work.md#what-the-description-carries)). In your own review, write the reason down now, for the description.

A changed expectation with no reason, or with a reason the intent doesn't cover, is a finding: report it, and don't approve until it's explained or reverted.

## New and moved modules

For each module the work adds, and each module it moves code into:

- **Check whether the code needs a property test,** as [Property testing](../testing/property-testing.md#when-to-write-one) says: a rule you can check without working out the answer the way the code does. If it does, it needs one. A missing one is a finding.
- **Check the tests that covered the code before still reach it.** A test of the file it came from may have covered only one case of what moved.

When a finding says the tests can't catch a bug, answer it with a test that can, such as a property test, not only with examples of the case the finding names.

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [reviewing-work.meta.md](reviewing-work.meta.md). Read it only when changing or questioning a rule here.
