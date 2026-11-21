# CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs the [definition-of-done checks](../../AGENTS.md#definition-of-done) on every pull request and every push to `main`, in one GitHub Actions job. A failing run blocks merging: the `guard on main branch` ruleset requires the `Definition of done` check, a branch up to date with `main`, a pull request, and a rebase merge. When `main` moves, rebase as [Submitting work](workflow/submitting-work.md#when-main-moves) says, and CI runs again.

## When a run fails

1. **Find the failed check.** All five checks run in one step, `Lint, formatting, types, tests, build`. Its log has a group for each check, named as in the definition of done with its `npm run` command and exit code, and an `error` line naming each check that failed, right after that check's group.

   ```bash
   gh pr checks <n>
   gh run view <run-id> --log-failed
   ```

2. **Reproduce it locally** with the `npm run` command the group names, or run all five as CI does with `bash scripts/ci-checks.sh`, fix it, and push. Don't re-run a failed job hoping it passes; if a check fails in CI and passes locally, find out why.
3. **Put a ready pull request back to draft** while CI fails, as [Submitting work](workflow/submitting-work.md#draft-until-done) says.

## Updating what CI runs

- **`playwright` and the container image move together.** The image tag in `ci.yml` (`mcr.microsoft.com/playwright:v<version>-noble`) must equal the `playwright` version in `package.json`. Change both in the same commit, after checking the tag exists:

  ```bash
  curl -s https://mcr.microsoft.com/v2/playwright/tags/list | grep -o '"v<version>-noble"'
  ```

- **Pin each action to a full commit SHA,** with its release tag in a comment: `uses: actions/checkout@<sha> # v7.0.1`. Choose a release published at least two weeks earlier, as [dependencies](dependencies.md#after-approval) says for packages. Resolve the SHA with `gh api repos/<owner>/<action>/commits/<tag> -q .sha`.
- **Use the standard `ubuntu-latest` runner,** never a larger runner. Larger runners are billed even on a public repository.
- **The checks CI runs are listed in [`scripts/ci-checks.sh`](../../scripts/ci-checks.sh).** When the definition of done changes, change the script in the same commit: its `names` and `scripts` lists, and the `check <index>` lines that start each one. Keep Types running before Production build, not beside it.
- **Keep the checks in one job.** Split them into parallel jobs only when a measured run shows one check holding the others up, and say which in the pull request.
- **Report the run time** in the pull request that changes `ci.yml`: the total, and the steps that changed.
- **A new action or image is a new dependency.** It needs the owner's approval, as [dependencies](dependencies.md) says.

## Changing this document

The reasons for these rules, the measured run times, and the options not taken are in [ci.meta.md](ci.meta.md). Read it only when changing or questioning a rule here.
