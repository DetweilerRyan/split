# Mutation testing

Mutation testing makes small changes to code, such as flipping `<` to `<=` or deleting a statement, and runs the tests against each one. A change no test fails on, a _surviving mutant_, marks code the tests run but don't check. [Stryker](https://stryker-mutator.io/docs/stryker-js/introduction/) does it here, for oxCrap (`scripts/oxcrap/`) only, and only locally: it's in neither CI nor the Stop hook.

## What it runs

- **The code:** `scripts/oxcrap/**/*.ts`, without its tests, `features/` and `oxcrap.ts`, as [`stryker.config.json`](../../stryker.config.json) sets.
- **The tests:** the tooling unit and property tests, from [`vitest.tooling.config.ts`](../../vitest.tooling.config.ts); per mutant, Stryker runs only those that reach it. No `.real.test.ts` and no feature contract runs, so code only those reach shows as "no coverage", not as surviving.

## Running it

| Command                         | What it does                                                                                                                      |
| :------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test:mutation:changed` | Mutates only the lines of `scripts/oxcrap/` changed since the merge base with `origin/main`, and lists survivors.                 |
| `npm run test:mutation`         | Mutates all of oxCrap again. When oxCrap hasn't changed on the branch, it also refreshes the baseline other worktrees start from. |

- **Each worktree keeps an incremental results file,** in git's folder (`git rev-parse --git-path stryker/incremental.json`). It's never committed.
  - **A full run** starts from no results, tests every mutant, and writes the file.
  - **A changed-lines run** reuses its results for mutants whose code and tests haven't changed, and doesn't write it back.
- **A worktree without one starts its changed-lines runs from the baseline:** `stryker/baseline.json` in the folder `git rev-parse --git-common-dir` names, which every worktree shares. A full run writes it when oxCrap hasn't changed on the branch, so it describes `main`'s oxCrap.
- **Run a full run on a branch that hasn't changed oxCrap** after a pull request that changed it merges, after `npm install`, or when a change to a shared helper or a dependency should be retested. Incremental mode only notices changes to mutated files and test files.
- **A run scoring below `thresholds.break`** in [`stryker.config.json`](../../stryker.config.json) exits non-zero. When a full run on `main`'s oxCrap scores higher, raise `break` to that score rounded down, in the pull request that raised it. Lower it only with the owner's approval.
- **The report** is in `reports/mutation/mutation.html`, and Stryker's working copy is in `.stryker-tmp/`. Both are gitignored, and the Vitest configs leave the working copy out.

## When oxCrap's code changes

1. **Run it once, after the [definition of done](../../AGENTS.md#definition-of-done) passes.** It's expensive. Don't run it in the middle of a change, or to probe.
2. **Take each survivor in turn:**
   - **Add a test with an assertion that fails on that mutant,** as [testing conventions](testing-conventions.md) say. Make it a [property test](../testing/property-testing.md#when-to-write-one) where those say one is called for.
   - **If it's in a guard for a case that can't happen, delete the guard:** restructure so the type proves the value is there, as `NestedFn`'s `parents` in `scripts/oxcrap/functions.ts` does. Keep the guard only when a library's type forces it.
   - **Or propose it as equivalent:** a change that can't alter what the code does. Mark it with `// Stryker disable next-line <mutator>: <reason>`, saying why no test could fail on it.

   Never weaken, edit away or delete an existing test to kill a mutant.

3. **Stop after four rounds** of adding tests and running the changed lines again. Report what still survives in the pull request, rather than keep going.
4. **A second judge confirms each proposed equivalent mutant:** a fresh-context reviewer subagent, as in [reviewing work](workflow/reviewing-work.md), or the owner. The author of the tests mustn't be the only judge. List each one in the pull request; a disable comment stays only if the reviewer agrees.

## Changing this document

The reasons for these rules, the measurements and the research behind them are in [mutation-testing.meta.md](mutation-testing.meta.md). Read it only when changing or questioning a rule here.
