# Reviewing work: reasons and sources

Why the rules in [reviewing work](reviewing-work.md) are as they are, and the cases behind them. Read this only when changing or questioning one of them. Following the procedure needs nothing from this file.

- **A document of its own.** On 2026-11-21 the owner split reviewing out of [submitting work](submitting-work.md), then named `pull-requests.md`. Reviewing is a different reader's task at a different moment from submitting, and the [workflow index](README.md) is arranged by when a procedure is read.

## Changed test expectations

- **The rule comes from Kent C. Dodds's [`autopilot` verification guide](https://github.com/kentcdodds/kcd-skills/blob/main/skills/autopilot/references/verification.md):** "Reviewers (AI and human) check every changed test expectation against the PR's intent. When a PR changes an assertion alongside the code it tests, the PR body says why." Added on [#38](https://github.com/DetweilerRyan/split/issues/38), which the owner approved.
- **Why it matters:** a test changed in the same pull request as the code it tests can hide a regression. The code broke, and the test was edited until it agreed. A reason tied to the pull request's intent is what separates a deliberate change from that.
- **The first case:** [#37](https://github.com/DetweilerRyan/split/pull/37) narrowed the first-render assertion of `useActiveIdentity`'s tests from an exact list of renders to "the first render has the identity, and none is empty". It gave the reason: a re-render with the same identity after saving the fallback. The narrowed assertion still failed against the original effect-based hook, which showed it kept catching what it was for.
