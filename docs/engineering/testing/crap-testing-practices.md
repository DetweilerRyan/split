# CRAP testing practices

## What a CRAP score is

oxCrap scores each function in the app and in oxCrap itself, and fails on one that's over the limits without a `@crap-allow` comment. The score combines the function's complexity and how much of it the tests run. Its [README](../../../scripts/oxcrap/README.md) says what CRAP is, how oxCrap scores, how to run it and how to write a `@crap-allow` comment. This document says what to do with a finding in this repository.

## Where findings come from

`npm run oxcrap` scores the app, then oxCrap itself. The app's coverage report is the one every `npm test` writes; oxCrap's is the one `npm run test:tooling` writes. So **run `npm test` and `npm run test:tooling` before `npm run oxcrap`**, as the [definition of done](../../../AGENTS.md#definition-of-done) orders them. `npm run oxcrap:app` and `npm run oxcrap:tooling` score one each.

**The coverage a CRAP score uses comes from unit tests only:** the `unit` and `browser` projects, property tests included. It never comes from `real` tests, which run real programs and files. Nor does it come from tests that run the whole program: `npm run test:e2e`, or a [feature contract](feature-testing-conventions.md#feature-contracts-for-deep-modules) that runs a deep module's program. Don't add any of their coverage to the report oxCrap reads. For oxCrap, the unit tests are those in [`vitest.tooling.config.ts`](../../../vitest.tooling.config.ts). oxCrap's real tests and feature contract count for none of it. The root [`.oxcraprc.json`](../../../.oxcraprc.json) sets what oxCrap scores in the app, and the limits. For oxCrap itself, [`scripts/oxcrap/.oxcraprc.json`](../../../scripts/oxcrap/.oxcraprc.json) does the same.

- **The Stop hook** gives a Claude Code session its findings as advice. It does so when the session stops with changes to the app or tooling. Its [README](../../../scripts/stop-hook.md) says what it runs and when.
- **CI** runs `npm test` and `npm run test:tooling`, then `npm run oxcrap`, and fails on any finding.
- **`npm run oxcrap`** is one of the definition-of-done checks.

All three run oxCrap on a fresh report, so they print the same findings.

## Responding to a finding

1. **Fix failing tests and lint first,** then run `npm test` and `npm run test:tooling`, for what you changed, and `npm run oxcrap` again. A test run that fails writes no coverage report, so there's no score until the tests pass, and fixing either can change the scores.
2. **First add tests for the branches the function doesn't run yet.** This changes no behaviour and is usually enough to bring the score under the limit. Write them as [the testing index](README.md)'s document for that kind of test says, in the project the function belongs in. A `real` test or an end-to-end scenario doesn't count, as [above](#where-findings-come-from) says.
3. **If its complexity is over the limit, refactor it,** into smaller functions only where the split reads better than the original. Don't extract a helper that exists only to pass the limit. Also **don't move a switch's cases or a chain of conditions into a lookup table,** which [_least power_](../code-design-principles.md#3-least-power-use-the-least-powerful-construct-that-does-the-job) rules out. As [its README](../../../scripts/oxcrap/README.md#how-oxcrap-scores) says, oxCrap counts a module-level table of functions and a membership test as the branches they stand for. So that move doesn't pass. The rule holds wherever the table is.
4. **Never skip, delete or weaken a test, or write numbers in a `@crap-allow` comment other than the function's real ones, to pass.**
5. **If you leave a function over the limits, allow it** with a reason, as [below](#allowing-a-function-over-the-limits) says. Say so in your final message and in the pull request's verification, as [Submitting work](../workflow/submitting-work.md#what-the-description-carries) asks for every check.

## Allowing a function over the limits

- **Allow a function only when the other steps would make the code worse,** which means both of these hold:
  - splitting it would scatter one idea across helpers;
  - testing the rest of it isn't worth it.
- **Write the comment as [the README](../../../scripts/oxcrap/README.md#allowing-a-function-over-the-limits) says,** with the numbers from the finding. Give a reason a reviewer can check: why this function, and what would change your mind.
- **When a function's numbers change, update its comment by hand,** and check the reason still holds.
- **Replace a stand-in reason when you work on its function.** The comments added when the check started say "Debt from before the CRAP check (#63)". Those added when everything that branches started counting say "Debt from before nested functions, default values and ?. counted (#74)". Each is followed by "no tests yet" or "too complex". Give the real reason, or bring the function within the limits and delete the comment.

## Showing a finding in another document

- **Show oxCrap's output with an invented function in an invented file,** such as `grade` in `src/grade.ts`, as oxCrap's README does, never a real one. The owner table in [single source of truth](../../prose/single-source-of-truth.md#rules) says where a real function's numbers are kept.

## Changing this document

The reasons for this document and for oxCrap, their sources, and the options not taken are in [`scripts/oxcrap/oxcrap.meta.md`](../../../scripts/oxcrap/oxcrap.meta.md). Read it only when changing or questioning a rule here.
