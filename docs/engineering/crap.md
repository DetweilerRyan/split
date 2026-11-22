# CRAP score

oxCrap, [`scripts/oxcrap/oxcrap.ts`](../../scripts/oxcrap/oxcrap.ts), scores each function in `src/` and `app/` by its complexity and how much of it the tests run. A function the branch changes fails when it's over the limits in [`check.ts`](../../scripts/oxcrap/check.ts), unless a [`@crap-allow` comment](#allowing-a-function-over-the-limits) above it records its current numbers and a reason. This procedure says what to do with a finding.

## Where findings come from

The script never runs the tests. It reads the coverage report that every `npm test` writes to `coverage/coverage-final.json`, and refuses a report older than any file in `src/` or `app/`. So **run `npm test` before `npm run oxcrap`**, as the [definition of done](../../AGENTS.md#definition-of-done) orders them.

- **The Stop hook,** [`scripts/stop-hook.ts`](../../scripts/stop-hook.ts), runs lint, `npm test` and `npm run oxcrap` when a Claude Code session stops with changes in `src/` or `app/`. It gives the session what fails as advice, once per stop, and never blocks.
- **CI** runs `npm test`, then `npm run oxcrap` against the pull request's base branch, and fails on any finding.
- **`npm run oxcrap`,** one of the definition-of-done checks, compares the branch with `origin/main`.

All three run the same script on a fresh report, so they print the same findings.

## How complexity is counted

The script counts complexity itself, with the rules in [`complexity.ts`](../../scripts/oxcrap/complexity.ts). They're close to ESLint's `complexity` rule but not the same, so don't compare its numbers with another tool's.

## Responding to a finding

1. **Fix failing tests and lint first,** then run `npm test` and `npm run oxcrap` again. A test run that fails writes no coverage report, so there's no score until the tests pass, and fixing either can change the scores.
2. **First add tests for the branches the function doesn't run yet.** This changes no behaviour and is usually enough to bring the score under the limit. Write them as [testing conventions](testing-conventions.md) say, in the project the function belongs in.
3. **If its complexity is over the limit, refactor it,** into smaller functions only where the split reads better than the original. Don't extract a helper that exists only to pass the limit.
4. **Never skip, delete or weaken a test, or write numbers in a `@crap-allow` comment other than the function's real ones, to pass.**
5. **If you leave a function over the limits, allow it** with a reason, as [below](#allowing-a-function-over-the-limits) says. Say so in your final message and in the pull request's verification, as [Submitting work](workflow/submitting-work.md#what-the-description-carries) asks for every check.

## Allowing a function over the limits

Write a comment that starts with `@crap-allow` directly above the function, above its doc comment if it has one. The finding gives the line to start from:

```ts
// @crap-allow CRAP 210, complexity 14. One branch per form field.
export function RestaurantModal() {
```

For a reason longer than a line, use a block comment. Inside JSX, use `{/* … */}` on the line above the handler:

```ts
/* @crap-allow CRAP 210, complexity 14. One branch per form field; splitting it would scatter
   the form's validation across files. */
export function RestaurantModal() {
```

- **The numbers must be the function's current CRAP score and complexity,** exactly as the finding prints them. The check fails on any comment whose numbers don't match, anywhere in `src/` and `app/`, whether the function got worse or better, and even when its code didn't change.
- **When a function's numbers change, update its comment by hand,** and check the reason still holds. The script never edits source files.
- **Give a reason after the numbers.** The check fails on a comment with no reason.
- **Put the function on the line below the comment, on a line of its own.** Other comments, such as a lint directive or a doc comment, can sit between them. The check fails on a comment that isn't directly above a function, and on one above a line where two functions start.
- **Delete the comment when the function is within the limits again.** The check fails on a comment for a function within the limits.
- **A comment the branch adds or changes is flagged for the owner.** The check passes, but prints a notice quoting the reason, and CI shows it as a warning.

A comment that mentions `@crap-allow` without starting with it is ignored, so a comment can explain one.

## Changing this document

The reasons for this procedure and the script, their sources, and the options not taken are in [`scripts/oxcrap/oxcrap.meta.md`](../../scripts/oxcrap/oxcrap.meta.md). Read it only when changing or questioning a rule here.
