# Reviewing work: reasons and sources

Why the rules in [reviewing work](reviewing-work.md) are as they are, and the cases behind them. Read this only when changing or questioning one of them. Following the procedure needs nothing from this file.

- **A document of its own.** On 2026-11-21 the owner split reviewing out of [submitting work](submitting-work.md), then named `pull-requests.md`. Reviewing is a different reader's task at a different moment from submitting, and the [workflow index](README.md) is arranged by when a procedure is read.
- **Every session reviews its own work before opening the pull request.** The owner asked for this on [#47](https://github.com/DetweilerRyan/split/pull/47#discussion_r4653452404) on 2026-11-21, which makes reviewing a regular stage of the workflow as well as the starting point for a separate reviewer. So it comes before submitting in the workflow index, and [submitting work](submitting-work.md) begins with it. Both kinds of review run the same checks, so a finding means the same thing whoever makes it.
- **The whole branch, not the last change.** A self-review that reads only the latest commit misses what earlier commits on the branch did, and a reviewer reads the whole pull request.

## Changed test expectations

- **The rule comes from Kent C. Dodds's [`autopilot` verification guide](https://github.com/kentcdodds/kcd-skills/blob/main/skills/autopilot/references/verification.md):** "Reviewers (AI and human) check every changed test expectation against the PR's intent. When a PR changes an assertion alongside the code it tests, the PR body says why." Added on [#38](https://github.com/DetweilerRyan/split/issues/38), which the owner approved.
- **Why it matters:** a test changed in the same pull request as the code it tests can hide a regression. The code broke, and the test was edited until it agreed. A reason tied to the pull request's intent is what separates a deliberate change from that.
- **The first case:** [#37](https://github.com/DetweilerRyan/split/pull/37) narrowed the first-render assertion of `useActiveIdentity`'s tests from an exact list of renders to "the first render has the identity, and none is empty". It gave the reason: a re-render with the same identity after saving the fallback. The narrowed assertion still failed against the original effect-based hook, which showed it kept catching what it was for.
