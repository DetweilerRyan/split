# CI

[`.github/workflows/ci.yml`](../../.github/workflows/ci.yml) runs the [definition-of-done checks](../../AGENTS.md#definition-of-done) on every pull request and every push to `main`, in one GitHub Actions job. A failing run blocks merging.

## When a run fails

1. **Find the failed step.** Each check is its own step, named as in the definition of done.

   ```bash
   gh pr checks <n>
   gh run view <run-id> --log-failed
   ```

2. **Reproduce it locally** with the same `npm run` command, fix it, and push. Don't re-run a failed job hoping it passes; if a check fails in CI and passes locally, find out why.
3. **Put a ready pull request back to draft** while CI fails, as [Pull requests](pull-requests.md#draft-until-done) says.

## Updating what CI runs

- **`playwright` and the container image move together.** The image tag in `ci.yml` (`mcr.microsoft.com/playwright:v<version>-noble`) must equal the `playwright` version in `package.json`. Change both in the same commit, after checking the tag exists:

  ```bash
  curl -s https://mcr.microsoft.com/v2/playwright/tags/list | grep -o '"v<version>-noble"'
  ```

- **Pin each action to a full commit SHA,** with its release tag in a comment: `uses: actions/checkout@<sha> # v7.0.1`. Choose a release published at least two weeks earlier, as [dependencies](dependencies.md#after-approval) says for packages. Resolve the SHA with `gh api repos/<owner>/<action>/commits/<tag> -q .sha`.
- **Use the standard `ubuntu-latest` runner,** never a larger runner. Larger runners are billed even on a public repository.
- **Keep the checks in one job.** Split them into parallel jobs only when a measured run shows one check holding the others up, and say which in the pull request.
- **Report the run time** in the pull request that changes `ci.yml`: the total, and the steps that changed.
- **A new action or image is a new dependency.** It needs the owner's approval, as [dependencies](dependencies.md) says.

## Changing this document

The reasons for these rules, the measured run times, and the options not taken are in [ci.meta.md](ci.meta.md). Read it only when changing or questioning a rule here.
