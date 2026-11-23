# CRAP score

oxCrap scores each function in `src/` and `app/` by its complexity and how much of it the tests run, and fails on one that's over the limits without a `@crap-allow` comment. Its [README](../../scripts/oxcrap/README.md) says what CRAP is, how oxCrap scores, how to run it and how to write a `@crap-allow` comment. This procedure says what to do with a finding in this repository.

## Where findings come from

oxCrap reads the coverage report that every `npm test` writes to `coverage/coverage-final.json`. So **run `npm test` before `npm run oxcrap`**, as the [definition of done](../../AGENTS.md#definition-of-done) orders them.

**The coverage a CRAP score uses comes from the Vitest projects only,** never from tests that run the whole program: not `npm run test:e2e`, and not a deep module's [feature contract](testing-conventions.md#feature-contracts-for-deep-modules). Don't add their coverage to the report oxCrap reads. [`.oxcraprc.json`](../../.oxcraprc.json), at the root, sets what it scores here and the limits.

- **The Stop hook** gives a Claude Code session its findings as advice when it stops with changes to the app. [Its README](../../scripts/stop-hook.md) says what it runs and when.
- **CI** runs `npm test`, then `npm run oxcrap`, and fails on any finding.
- **`npm run oxcrap`** is one of the definition-of-done checks.

All three run oxCrap on a fresh report, so they print the same findings.

## Responding to a finding

1. **Fix failing tests and lint first,** then run `npm test` and `npm run oxcrap` again. A test run that fails writes no coverage report, so there's no score until the tests pass, and fixing either can change the scores.
2. **First add tests for the branches the function doesn't run yet.** This changes no behaviour and is usually enough to bring the score under the limit. Write them as [testing conventions](testing-conventions.md) say, in the project the function belongs in. An end-to-end scenario doesn't count, as [above](#where-findings-come-from) says.
3. **If its complexity is over the limit, refactor it,** into smaller functions only where the split reads better than the original. Don't extract a helper that exists only to pass the limit.
4. **Never skip, delete or weaken a test, or write numbers in a `@crap-allow` comment other than the function's real ones, to pass.**
5. **If you leave a function over the limits, allow it** with a reason, as [below](#allowing-a-function-over-the-limits) says. Say so in your final message and in the pull request's verification, as [Submitting work](workflow/submitting-work.md#what-the-description-carries) asks for every check.

## Allowing a function over the limits

- **Allow a function only when the other steps would make the code worse:** when splitting it would scatter one idea across helpers, and testing the rest of it isn't worth it.
- **Write the comment as [the README](../../scripts/oxcrap/README.md#allowing-a-function-over-the-limits) says,** with the numbers from the finding and a reason a reviewer can check: why this function, and what would change your mind.
- **When a function's numbers change, update its comment by hand,** and check the reason still holds.
- **Replace a stand-in reason when you work on its function.** The 15 comments added when the check started say "Debt from before the CRAP check (#63)", followed by "no tests yet" or "too complex". Give the real reason, or bring the function within the limits and delete the comment.

## Changing this document

The reasons for this procedure and for oxCrap, their sources, and the options not taken are in [`scripts/oxcrap/oxcrap.meta.md`](../../scripts/oxcrap/oxcrap.meta.md). Read it only when changing or questioning a rule here.
