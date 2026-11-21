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
- **The container image** saves downloading Chromium on each run, and its system libraries. Pulling it is now the largest step.
- **Not taken: caching the browsers.** Playwright's [CI docs](https://playwright.dev/docs/ci) say "Caching browser binaries is not recommended, since the amount of time it takes to restore the cache is comparable" to downloading them, and that the Linux system dependencies "are not cacheable".
- **Not taken: parallel jobs.** Each job would pull the image and run `npm ci` again, about 30 s, to save at most the 15 s the checks take after setup. Reopen if a check grows slow enough to dominate.
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
