# Choosing and adding dependencies

A dependency is any npm package in `package.json`, and anything else the repository runs but doesn't own, such as a tool the sandbox kit installs. A well-chosen dependency beats hand-written code for a problem someone else has already solved, and each one also adds something to install, update, ship to the browser, and trust.

So adding one is a decision, and **the decision is the repository owner's alone**. An agent's job is to notice when a dependency would help, find and evaluate candidates, and recommend one.

## When to look for one

Look before writing the code when the problem is general rather than SplitSmart's (parsing a format, speaking a protocol, generating a QR code), or when hand-written code keeps needing edge-case fixes for behaviour that has nothing to do with splitting receipts.

Don't look when a few lines of the platform or standard library do the job, when a package already in `package.json` does it, or when the logic is specific to this app.

## Evaluating

Name two or three candidates, and always include the two baselines: writing it ourselves, and using something already installed. Answer each question for each candidate, from the npm page, the source repository, and [deps.dev](https://deps.dev/). Date the answers, since they change.

| Question                       | What to check                                                                                                                                                                                                                                                                                                                |
| :----------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Is it needed?**              | What it replaces, in code and tests we'd otherwise own, and how much of the package we'd use.                                                                                                                                                                                                                                |
| **Is it the real one?**        | The name matches the one the project's own site links to. A similar, more popular name suggests typosquatting.                                                                                                                                                                                                               |
| **Is it maintained?**          | A release and commits in the last 12 months, and more than one maintainer or wide enough use that it would be forked.                                                                                                                                                                                                        |
| **Is it safe?**                | No known unfixed vulnerability in the version you'd add (`npm audit` after a trial install), and how fast past ones were fixed.                                                                                                                                                                                              |
| **Does the license allow it?** | A common open-source license, for the package and what it pulls in.                                                                                                                                                                                                                                                          |
| **What comes with it?**        | Its own dependencies (`npm view <package> dependencies`), install scripts, and what it adds to the client bundle if it runs in the browser.                                                                                                                                                                                  |
| **Does it fit here?**          | It works with Next.js on Vercel, in the browser where the app uses it, and in the sandbox kit: any host it contacts at install or run time must be allowed in the kit's [network policy](../../.sbx-kits/splitsmart/splitsmart.yaml). It can be replaced by a fake in tests ([testing conventions](testing-conventions.md)). |

**Then try it** in a sandbox or a throwaway branch, after the checks above, since installing a package runs its code. Don't commit the trial.

## Recommending and approval

- **Recommend one option,** and say in a line each why the others lost. "Add nothing" is a valid recommendation. When two are close, prefer the one already installed, then the one with fewer dependencies of its own.
- **Put the proposal in the issue or pull request:** the need, the candidates, the trial's result, and the recommendation.
- **Only the owner approves a new dependency,** in writing, in the issue, the pull request, or the session. Until then, no commit adds it to `package.json` or imports it. Approval covers one package in one role; it doesn't carry over to the next package.
- **A version update of an approved dependency needs no new approval,** including a security update. Read its changelog for breaking changes, and run the [definition-of-done checks](../../AGENTS.md#definition-of-done).

## After approval

1. Add it with an exact version, `npm install --save-exact <package>@<version>` (with `--save-dev` for tooling), and commit the updated `package-lock.json` with it. Choose a release published at least two weeks before you add it.
2. Allow any hosts it needs in the kit's network policy.
3. Where practical, keep it behind one module of ours, so replacing it later changes one file.

Removing a dependency undoes the same steps in one change.

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [dependencies.meta.md](dependencies.meta.md). Read it only when changing or questioning a rule here.
