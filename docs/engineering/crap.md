# CRAP score

oxCrap scores each function in `src/`, `app/` and its own `scripts/oxcrap/` by its complexity and how much of it the tests run, and fails on one that's over the limits without a `@crap-allow` comment. Its [README](../../scripts/oxcrap/README.md) says what CRAP is, how oxCrap scores, how to run it and how to write a `@crap-allow` comment. This procedure says what to do with a finding in this repository.

## Where findings come from

`npm run oxcrap` scores the app, then oxCrap itself. The app's coverage report is the one every `npm test` writes to `coverage/coverage-final.json`; oxCrap's is the one `npm run test:tooling` writes to `coverage-tooling/coverage-final.json`. So **run `npm test` and `npm run test:tooling` before `npm run oxcrap`**, as the [definition of done](../../AGENTS.md#definition-of-done) orders them. `npm run oxcrap:app` and `npm run oxcrap:tooling` score one each.

**The coverage a CRAP score uses comes from unit tests only:** the `unit` and `browser` projects, property tests included. It never comes from `real` tests, which run real programs and files, nor from tests that run the whole program: `npm run test:e2e`, or a [feature contract](testing/tooling-testing.md#feature-contracts-for-deep-modules) that runs a deep module's program. `npm test` runs the `real` project in a second pass with coverage off. Don't add any of their coverage to the report oxCrap reads. For oxCrap, the unit tests are [`vitest.tooling.config.ts`](../../vitest.tooling.config.ts)'s; its real tests and feature contract count for none of it. [`.oxcraprc.json`](../../.oxcraprc.json), at the root, sets what it scores in the app and the limits; [`scripts/oxcrap/.oxcraprc.json`](../../scripts/oxcrap/.oxcraprc.json) does the same for oxCrap. Other tooling isn't scored yet.

- **The Stop hook** gives a Claude Code session its findings as advice when it stops with changes to the app or tooling. [Its README](../../scripts/stop-hook.md) says what it runs and when.
- **CI** runs `npm test` and `npm run test:tooling`, then `npm run oxcrap`, and fails on any finding.
- **`npm run oxcrap`** is one of the definition-of-done checks.

All three run oxCrap on a fresh report, so they print the same findings.

## Responding to a finding

1. **Fix failing tests and lint first,** then run `npm test` and `npm run test:tooling`, for what you changed, and `npm run oxcrap` again. A test run that fails writes no coverage report, so there's no score until the tests pass, and fixing either can change the scores.
2. **First add tests for the branches the function doesn't run yet.** This changes no behaviour and is usually enough to bring the score under the limit. Write them as [the testing index](testing/README.md)'s document for that kind of test says, in the project the function belongs in. A `real` test or an end-to-end scenario doesn't count, as [above](#where-findings-come-from) says.
3. **If its complexity is over the limit, refactor it,** into smaller functions only where the split reads better than the original. Don't extract a helper that exists only to pass the limit, and **don't move a switch's cases or a chain of conditions into a lookup table,** which [_least power_](code-design-principles.md#3-least-power-use-the-least-powerful-construct-that-does-the-job) rules out. oxCrap counts a module-level table of functions and a membership test as the branches they stand for, as [its README](../../scripts/oxcrap/README.md#how-oxcrap-scores) says, so that move doesn't pass; the rule holds wherever the table is.
4. **Never skip, delete or weaken a test, or write numbers in a `@crap-allow` comment other than the function's real ones, to pass.**
5. **If you leave a function over the limits, allow it** with a reason, as [below](#allowing-a-function-over-the-limits) says. Say so in your final message and in the pull request's verification, as [Submitting work](workflow/submitting-work.md#what-the-description-carries) asks for every check.

## Allowing a function over the limits

- **Allow a function only when the other steps would make the code worse:** when splitting it would scatter one idea across helpers, and testing the rest of it isn't worth it.
- **Write the comment as [the README](../../scripts/oxcrap/README.md#allowing-a-function-over-the-limits) says,** with the numbers from the finding and a reason a reviewer can check: why this function, and what would change your mind.
- **When a function's numbers change, update its comment by hand,** and check the reason still holds.
- **Replace a stand-in reason when you work on its function.** The comments added when the check started say "Debt from before the CRAP check (#63)", and those added when everything that branches started counting say "Debt from before nested functions, default values and ?. counted (#74)". Each is followed by "no tests yet" or "too complex". Give the real reason, or bring the function within the limits and delete the comment.

## Showing a finding in another document

- **Show oxCrap's output with an invented function in an invented file,** such as `grade` in `src/grade.ts`, as oxCrap's README does, never a real one. Where a real function's numbers are kept is in [single source of truth](../prose/single-source-of-truth.md#rules)'s owner table.

## Changing this document

The reasons for this procedure and for oxCrap, their sources, and the options not taken are in [`scripts/oxcrap/oxcrap.meta.md`](../../scripts/oxcrap/oxcrap.meta.md). Read it only when changing or questioning a rule here.
