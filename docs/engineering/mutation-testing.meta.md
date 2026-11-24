# Mutation testing: reasons and sources

Why [mutation testing](mutation-testing.md) works the way it does here. Read this only when changing or questioning a rule there. The decisions were made on [#77](https://github.com/DetweilerRyan/split/issues/77), which holds the full research.

## Why

- **Coverage measures what tests run, not what they check,** and CRAP rewards coverage. #63's research found this is where agents' tests most often fall short. [Thoughtworks](https://www.thoughtworks.com/radar/techniques/mutation-testing) and [SpecBench](https://arxiv.org/html/2605.21384v1) report agents' tests reaching high coverage while catching little.
- **[agentpatterns.ai](https://agentpatterns.ai/verification/mutation-testing-quality-gate/):** "Coverage proves a line ran; mutation testing proves the suite would notice a regression."
- **It automates what this repository did by hand.** The property-test guidance says to break the code and confirm the property fails. On #71 and #75 that was done every time.

## Decisions

- **oxCrap first:** its tests are fast and run in Node, its modules are mostly pure functions, and every CRAP score depends on it.
- **Local only, for now.** The owner said: "let's hold off on adding mutation testing to CI for now and focus on using it locally". [agentpatterns.ai](https://agentpatterns.ai/verification/mutation-testing-quality-gate/) says it "belongs nightly or post-merge", not as a per-PR gate "without selective mutation". The changed-lines run is this repository's selective mutation.
- **Unit and property tests only.** The owner said: "no real.test should be covered by mutation tests". The feature contract can't be used anyway: it runs oxCrap as a separate process. CRAP's coverage leaves out the same tests ([#78](https://github.com/DetweilerRyan/split/pull/78)).
- **The incremental file isn't committed.**
  - **Why:** it's rewritten on every run and keyed to file contents, so committed it would show in most diffs, conflict between branches, and describe whichever branch last ran it.
  - **Instead:** each worktree keeps its own in git's folder, seeded from a baseline in the folder all worktrees share. Reusing results from other code is safe, because incremental mode compares contents and re-tests what changed.
  - **A changed-lines run works on a scratch copy,** because Stryker writes back only the mutants a run tests. An independent review found the first version's changed run replaced the worktree's 1,429 results with its own 4.
  - **The baseline is refreshed by a full run on any branch that hasn't changed oxCrap,** not only on `main`, because agents work in worktrees and rarely on `main`. Such a branch's oxCrap is `main`'s.
  - **Checked on 10.1.1:**
    - `incrementalFile` is the option's name.
    - `--incremental` works with `--mutate`, which [stryker-js#3609](https://redirect.github.com/stryker-mutator/stryker-js/issues/3609) had tracked: a second run of the same lines reused all 27 of its mutants' results.
    - `--mutate` takes line ranges such as `check.ts:20-40`.
- **The agent procedure** follows the owner's three changes, from agentpatterns.ai's evidence:
  - **Run it once, last.** [Staged evidence gates](https://agentpatterns.ai/verification/staged-evidence-gates-program-repair/) order checks cheapest first, and [execution budgeting](https://agentpatterns.ai/verification/execution-budgeting-program-repair/) suggests telling an agent a run is "expensive; use sparingly".
  - **Stop after four rounds.** MUTGEN ([arXiv 2506.02954](https://arxiv.org/abs/2506.02954)) reports the kill rate "plateaus around four iterations". Further loops "start exercising equivalent mutants the filter missed".
  - **A second judge for equivalence.** Raw runs see more than half of mutants survive, and the page advises "a different model, a learned classifier, or human review for equivalence". Meta's ACH ([arXiv 2501.12862](https://arxiv.org/abs/2501.12862)) raised its judge's precision from 0.79 to 0.95 with preprocessing.
- **`oxcrap.ts` isn't mutated.** It only gives `run.ts` and `files.ts` the real file system and the process, so no unit test reaches it, and its 16 mutants could only ever show as "no coverage". The feature contract checks it end to end. The owner chose "Unit-test files.ts, exclude oxcrap.ts" on [#79](https://github.com/DetweilerRyan/split/issues/79#issuecomment-7118031362): `files.ts`'s logic moved behind a search it's given, so unit tests reach it, and `oxcrap.ts` left `mutate`.
- **`ignoreStatic`:** a mutant that runs when its file loads, not in a test, makes every test run. oxCrap's module-level constants, such as `DEFAULTS` and `COUNT_ALL`, would each run the whole suite.
- **No TypeScript checker.** The owner approved `@stryker-mutator/typescript-checker`, but it can't run with this repository's TypeScript 7, so it's uninstalled.
  - **Why it fails:** TypeScript 7's package exposes only its version at the top level, and its compiler API under `typescript/unstable/*`.
  - **The experimental mode doesn't help:** the checker's `experimentalNativePreview` looks for `typescript/native/unstable/sync`, which TypeScript 7.0.2 doesn't publish.
  - **The same API breaks Stryker's tsconfig step,** which `tsconfigFile` in `stryker.config.json` skips by naming a file that doesn't exist. Vitest strips types itself, so nothing needs that step.
  - **What would bring it back:** [stryker-js#6110](https://github.com/stryker-mutator/stryker-js/issues/6110) and [#6111](https://github.com/stryker-mutator/stryker-js/issues/6111). Re-add the checker when they land.
- **Vitest 5 is fine as of 10.1.1.** [stryker-js#6263](https://github.com/stryker-mutator/stryker-js/issues/6263) reported every mutant surviving with no tests run under Vitest 5. It was fixed the day 10.1.1 shipped, and the first run here confirms it.
- **The config is at the root, as `stryker.config.json`,** beside the other tool configs, rather than in `scripts/oxcrap/`. Stryker copies the project from where it runs.
  - **`ignorePatterns`** keeps `.claude/` (other worktrees), `coverage/`, `coverage-tooling/`, `test-results/`, `.features-gen/` and `reports/` out of its sandbox.
- **Stryker runs `vitest.tooling.config.ts`, the tooling unit config, because its Vitest runner can't choose projects.** Its options are `configFile`, `dir`, `related` and `pool`. A separate `vitest.mutation.config.ts` first kept `tooling-real` out; the owner asked for the alternative, splitting the tooling config into unit and real configs, and [#70](https://github.com/DetweilerRyan/split/issues/70#issuecomment-7111420730) did it, since oxCrap's own CRAP score needs the same split.
- **`scripts/mutation.ts`'s diff parsing has a property test.** It generates diffs from known files and hunks, including paths with spaces and files oxCrap doesn't mutate, and expects those ranges back.
  - **The first version had none.** It was judged a small parse that example tests could cover. The review then found it filed hunks under the wrong file when a path was quoted, and dropped paths with spaces, which git ends with a tab. Under the reviewing-work check, that was the wrong call.
  - **Run against the buggy version,** the property and both new example tests failed.
  - **Git is run with explicit flags,** prefixes and unquoted paths, so a user's git settings can't change what the parser reads.

## The baseline

The first full run, on 2026-11-23, before any survivor was addressed:

| File            | Mutation score | Killed | Timed out | Survived | No coverage |
| :-------------- | -------------: | -----: | --------: | -------: | ----------: |
| `config.ts`     |          98.5% |     66 |         0 |        0 |           1 |
| `complexity.ts` |          89.2% |    149 |         0 |       17 |           1 |
| `check.ts`      |          83.9% |     47 |         0 |        4 |           5 |
| `allow.ts`      |          80.4% |    127 |         0 |       28 |           3 |
| `functions.ts`  |          79.8% |    133 |         9 |       29 |           7 |
| `coverage.ts`   |          73.9% |     82 |         0 |       28 |           1 |
| `recursion.ts`  |          52.5% |    196 |         2 |      157 |          22 |
| `files.ts`      |             0% |      0 |         0 |        0 |          36 |
| `oxcrap.ts`     |             0% |      0 |         0 |        0 |         191 |
| **All files**   |      **60.5%** |    800 |        11 |      263 |         267 |

- **How it ran:** 1,429 mutants, 88 of them static and skipped by `ignoreStatic`, so 1,341 tested. That's 8 tests per mutant on average, in 78 s on 15 worker processes. The tests themselves take about 3 s.
- **Survivors are left to follow-ups:** the owner said "set up and record the baseline, survivors in follow-ups".
- **Where they are:** `oxcrap.ts` and `files.ts` have no coverage because only real tests and the feature contract reach them. That's [#70](https://github.com/DetweilerRyan/split/issues/70)'s gap. `recursion.ts`'s survivors are most likely its scope handling for imports, `catch` parameters, `switch` cases and loops, which no test declares names in.

## After the survivors (#79)

The owner had the survivors split into three batches, each worked by a subagent and checked by fresh reviews ([decisions](https://github.com/DetweilerRyan/split/issues/79#issuecomment-7118031362)). A full run on `main` after the last of them, on 2026-11-24:

| File            | Mutation score | Killed | Timed out | Survived | No coverage |
| :-------------- | -------------: | -----: | --------: | -------: | ----------: |
| `check.ts`      |           100% |     58 |         0 |        0 |           0 |
| `complexity.ts` |           100% |    135 |         0 |        0 |           0 |
| `config.ts`     |           100% |     67 |         0 |        0 |           0 |
| `coverage.ts`   |           100% |    101 |         0 |        0 |           0 |
| `files.ts`      |           100% |     30 |         0 |        0 |           0 |
| `functions.ts`  |           100% |    140 |        10 |        0 |           0 |
| `run.ts`        |           100% |    210 |         0 |        0 |           0 |
| `allow.ts`      |          99.4% |    152 |         0 |        1 |           0 |
| `tables.ts`     |          98.9% |    452 |         0 |        4 |           1 |
| `recursion.ts`  |          97.5% |    234 |         4 |        6 |           0 |
| **All files**   |      **99.3%** |  1,579 |        14 |       11 |           1 |

- **What's left:**
  - `allow.ts`'s survivor is a confirmed equivalent, left unmarked because a disable comment would also hide a killed mutant on its line.
  - The rest are bugs filed as [#87](https://github.com/DetweilerRyan/split/issues/87) and [#88](https://github.com/DetweilerRyan/split/issues/88). Fixing them changes scores, so #79 left them.
- **Dead code was deleted rather than marked,** as the owner decided ("Delete dead code first", [decision](https://github.com/DetweilerRyan/split/issues/79)). A disable comment turns off every mutant of its mutator on its line, killed ones included, so each one kept was checked for what it hides.
- **`oxcrap.ts` left `mutate`,** and `files.ts`'s logic moved behind an injected glob so unit tests reach it ("Unit-test files.ts, exclude oxcrap.ts").
- **The threshold ratchets** ("Ratchet at the result"): `break` is the score reached, rounded down, and is raised as the score rises. A run on oxCrap that a change makes worse fails locally, where mutation testing runs.
- **A full run starts from no results.** Measuring this showed `oxcrap.ts` still reported as mutated after it left `mutate`. Stryker keeps a file from old incremental results, and the baseline every new worktree is seeded from still held it. A full run reuses nothing anyway, so it now deletes the worktree's file first.

## What would reopen this

- **Running it in CI, or in the Stop hook,** once changed-lines runs prove fast. The first full run took 78 s.
- **The app,** after oxCrap. `src/utils/math.ts` and `src/store/seedCodec.ts` were named first in #64.
