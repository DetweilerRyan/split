# CI: reasons and sources

Why the rules in [CI](ci.md) are as they are, what was measured, and what was rejected. Read this only when changing or questioning one of them. Following the procedure needs nothing from this file.

## Decisions

- **CI exists, and a failing run blocks merging.** Proposed in [#45](https://github.com/DetweilerRyan/split/issues/45). The owner approved the three dependencies and chose to block merging in the session on 2026-11-21, [recorded on #45](https://github.com/DetweilerRyan/split/issues/45#issuecomment-7056855615). Before this, `AGENTS.md` said "The repository has no CI, so nothing runs them for you".
- **The ruleset targets only `main`** (the default branch). The owner asked whether to target all branches; the check gates merges into `main`, where all work lands, and a ruleset on feature branches could get in the way of pushing and rebasing them. Set up by the owner on 2026-11-21 as `guard on main branch`, which also requires a pull request, linear history and rebase merges, and blocks force-pushes and deletion.
- **Approved dependencies:** `actions/checkout`, `actions/setup-node` and the `mcr.microsoft.com/playwright` image, each in the role #45 lists.

## Cost

- **Free while the repository is public.** GitHub's [Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) lists public repositories as the first case where "the use of standard GitHub-hosted runners is free". Checked on 2026-11-21.
- **If the repository goes private,** GitHub Free includes $12 of runner time a month, and usage without a payment method is blocked rather than charged, per the same page.
- **Larger runners** are billed even on public repositories, so the procedure rules them out.

## Speed

The owner asked for a fast run ("3 to 5 minutes is way too long for a small repo like this").

- **The checks are fast; setup is not.** In the sandbox (16 cores) on 2026-11-21: lint 0.2 s, formatting 0.1 s, types 0.2 s, tests 2.5 s, build without a cache 4.3 s.
- **The first run on GitHub** ([run 44863104339](https://github.com/DetweilerRyan/split/actions/runs/44863104339), 2026-11-21, empty npm cache) took 62 s from job start to end:

  | Step                                                 | Time |
  | :--------------------------------------------------- | ---: |
  | Set up job                                           |  2 s |
  | Initialize containers (pulling the Playwright image) | 21 s |
  | Checkout                                             |  3 s |
  | Set up Node 26, with the npm cache                   |  4 s |
  | `npm ci`                                             |  6 s |
  | Lint, formatting, types                              |  1 s |
  | Tests (83)                                           |  6 s |
  | Production build                                     |  8 s |
  | Post steps (saving the npm cache) and cleanup        |  4 s |

- **The second run** ([run 44863276153](https://github.com/DetweilerRyan/split/actions/runs/44863276153)), with the npm cache restored, also took 62 s: the cache made Node setup slower (6 s) and didn't shorten `npm ci` (9 s), and the container still took 23 s. Run-to-run variation of a few seconds is normal.
- **The third run** ([run 44948887831](https://github.com/DetweilerRyan/split/actions/runs/44948887831), PR #51, npm cache restored) took 58 s. The checks ran one after another for about 20 s: lint, formatting and types 1.4 s, tests 7.9 s, build 9.9 s. `oxlint` reported 4 threads on the runner. The step-by-step table is in [#52](https://github.com/DetweilerRyan/split/issues/52).
- **The container image** saves downloading Chromium on each run, and its system libraries. Pulling it is now the largest step.

### Running the checks together ([#52](https://github.com/DetweilerRyan/split/issues/52))

- **The five checks run at the same time in one step,** through `scripts/ci-checks.sh`. That keeps one image pull and one `npm ci`, which is what ruled out parallel jobs below. The script is plain bash, so it adds no dependency, and it can be run locally.
- **A failure still names its check.** Before #52 each check was its own step, so the failed step's name was the check's name. The script prints each check's output in its own `::group::`, then an `::error::` annotation for each failure, so `gh run view --log-failed` still leads to the check. Tested locally with a misformatted file: exit 1, one error line titled `Formatting failed`, and the other four groups still reported.
- **The logs go to `$RUNNER_TEMP`, outside the checkout,** so oxlint and oxfmt, which walk the checkout, never read a log while it is being written.
- **Types runs before Production build, not beside it.** `tsconfig.json` includes `next-env.d.ts` and `.next/types/**/*.ts`, which `next build` writes. Measured in the sandbox on 2026-11-21 with 4 cores (`taskset -c 0-3`), from a clean state each time:
  - `next build` writes all four `.next/types/` files within about 10 ms, 2.5 s into a 7 s build, and `next-env.d.ts` about 5 s in. It doesn't write `tsconfig.tsbuildinfo`.
  - From a clean state `tsc` checks none of these files, so CI never type-checked them when Types ran first. After a build, it checks all five, and they pass.
  - Types and build run together, with `tsc` started at 13 offsets from 0 to 6 s into the build, three times each: all 39 trials passed.
  - So running them together would almost always work. The only failure is `tsc` reading a file in the 10 ms it is half-written, and on a slow runner `tsc` would sometimes check the generated files and sometimes not. Chaining them costs at most the 0.7 s Types takes, so the owner chose determinism over that 0.7 s in the session on 2026-11-21.
- **Measured locally, 4 cores, from a clean state each time:** one after another (two runs) the checks took 11.8 to 12.4 s (tests 4.3 to 5.0 s, build 6.6 s). Together (five runs) they took 10.2 to 10.5 s: tests and build slow each other, to 6.2 to 7.0 s and 9.4 to 9.7 s, and Types then Build is the longest path. The saving is about 2 s locally, less than #52's estimate of 8 to 10 s in CI. All 83 tests passed in every run, and no test took 1 s, against Vitest's default limit of 5 s.
- **Not taken: limiting Vitest's workers** to give the build more CPU. Three runs each on 4 cores: `--maxWorkers=2` changed nothing (tests 7.0 to 7.3 s, build 9.4 to 9.5 s, total 10.2 to 10.3 s). `--maxWorkers=1` sped the build to 8.7 to 8.9 s but slowed tests to 9.9 to 10.5 s, so the total stayed at 9.9 to 10.5 s.
- **Not taken: dropping `npm run typecheck` because `next build` also type-checks.** Next's `runTypeCheck.js` hides errors in `*.test.*`, `*.spec.*`, `__tests__/` and `__mocks__/` files, and stops at the first error, so the tests would no longer be type-checked.
- **Not taken: `typescript.ignoreBuildErrors`.** It saves 1.4 s of build, but a local `next build` would then succeed with type errors.
- **Not taken: a Chromium-only image** to shorten the 17 s pull. It would be a new dependency to maintain, for perhaps 8 s.

### npm

- **No npm cache** (`cache: npm` removed from `actions/setup-node` in #52). `npm ci` deletes `node_modules` and unpacks every package again, so a restored cache didn't make it faster in any measured run: 6 s with the cache empty (run 44863104339), 9 s and 9.3 s with it restored (runs 44863276153 and 44948887831). Restoring the 140 MB archive cost 1.2 s, plus a cache check in the post step. Reopen if `npm ci` starts downloading slowly enough that a cache would pay for itself.
- **`npm ci --no-audit --no-fund`.** The audit is a network call, and neither it nor the funding message is part of the definition of done.

### Other speed decisions

- **Not taken: caching the browsers.** Playwright's [CI docs](https://playwright.dev/docs/ci) say "Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable" to downloading them, and that the Linux system dependencies "are not cacheable".
- **Not taken: parallel jobs.** Each job would pull the image and run `npm ci` again, about 30 s, to save at most the 15 s the checks take after setup. The checks run in parallel inside the one job instead, as above. Reopen if a check grows slow enough to dominate.
- **Not taken: caching `.next/cache`.** It saves about 2 s of build.
- **Not taken: `microsoft/playwright-github-action`.** Its README marks it deprecated, and the repository was archived on 2025-01-23.
- **`concurrency` with `cancel-in-progress`** stops a run when a newer push to the same branch arrives, so nobody waits on an outdated run.

## Container settings

- **`--user 1001`** follows the container example in Playwright's CI docs. It runs as the runner's own user, so files the job writes in the workspace stay writable by the runner's post steps.
- **Node 26 through `actions/setup-node`,** not the image's own Node, so CI uses the version the [sandbox kit](../../.sbx-kits/splitsmart/splitsmart.dockerfile) uses.
- **`NEXT_TELEMETRY_DISABLED`** stops `next build` from sending telemetry from CI.

## Pins

- **Full commit SHAs.** GitHub's [security hardening guide](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions) calls pinning to a full-length SHA "the only way to use an action as an immutable release". A tag can be moved to other code.
- **Versions chosen on 2026-11-21:** `actions/checkout` v7.0.1 (published 2026-07-20) and `actions/setup-node` v7.1.0 (published 2026-10-08), the newest releases at least two weeks old. The image is `v1.65.0-noble`, matching `playwright` 1.65.0.
