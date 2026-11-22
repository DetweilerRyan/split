# CRAP score

[`scripts/crap.ts`](../../scripts/crap.ts) scores each function in `src/` and `app/` that a branch changes, by its complexity and how much of it the tests run. A function fails when its score is over the limits at the top of the script, unless the [baseline](#the-baseline), [`crap-baseline.jsonc`](../../crap-baseline.jsonc), already records it at that score or higher. This procedure says what to do with a finding.

## Where findings come from

- **The Stop hook,** in [`.claude/settings.json`](../../.claude/settings.json), gives a Claude Code session its findings when it stops with changes in `src/` or `app/`. It advises once per stop and never blocks.
- **CI,** whose `CRAP score` step fails the pull request on any finding.
- **`npm run crap`,** one of the [definition-of-done checks](../../AGENTS.md#definition-of-done), which compares the branch with `origin/main`.

All three run the same script and print the same findings.

## Responding to a finding

1. **Fix failing tests and lint first,** then run `npm run crap` again. The script gives no score while the tests fail, and fixing either can change the scores.
2. **First add tests for the branches the function doesn't run yet.** This changes no behaviour and is usually enough to bring the score under the limit. Write them as [testing conventions](testing-conventions.md) say, in the project the function belongs in.
3. **If its complexity is over the limit, refactor it,** into smaller functions only where the split reads better than the original. Don't extract a helper that exists only to pass the limit.
4. **Never skip, delete or weaken a test, or edit a score in the baseline, to pass.**
5. **If you leave a finding as it is, record it with its reason.** Run `npm run crap -- --write-baseline`, then write the reason in a comment above the function's entry, as [the baseline](#the-baseline) says. Say so in your final message and in the pull request's verification, as [Submitting work](workflow/submitting-work.md#what-the-description-carries) asks for every check.

## The baseline

[`crap-baseline.jsonc`](../../crap-baseline.jsonc), at the repository root, records the functions over the limits when they were last measured. It is debt to pay down, not a target. `npm run crap` passes its path to the script with `--baseline`.

- **A changed function in the baseline passes at its recorded score,** and fails if its score or complexity goes up.
- **When a changed function gets better, record it.** The check fails until you do. Run `npm run crap -- --write-baseline` and commit the result with the change.
- **Renaming a function in the baseline, or moving it into another function, gives it a new key.** The check then treats it as new, so it must be within the limits or be recorded again.
- **Give the reason a function stays over the limits in `//` comments on the lines directly above its entry.** Write them by hand; `--write-baseline` keeps them, along with the `//` comments above the opening brace, and drops an entry's comments with the entry. It doesn't keep `/* */` comments.
- **A pull request that adds an entry or raises one gives the reason in a comment above it.** The check passes, but prints a notice for each that quotes its reason, and CI shows it as a warning for the owner.

## Changing this document

The reasons for this procedure and the script, their sources, and the options not taken are in [`scripts/crap.meta.md`](../../scripts/crap.meta.md). Read it only when changing or questioning a rule here.
