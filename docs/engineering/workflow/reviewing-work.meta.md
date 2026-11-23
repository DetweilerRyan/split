# Reviewing work: reasons and sources

Why the rules in [reviewing work](reviewing-work.md) are as they are, and the cases behind them. Read this only when changing or questioning one of them. Following the procedure needs nothing from this file.

- **A document of its own.** On 2026-11-21 the owner split reviewing out of [submitting work](submitting-work.md), then named `pull-requests.md`. Reviewing is a different reader's task at a different moment from submitting, and the [workflow index](README.md) is arranged by when a procedure is read.
- **Every session reviews its own work before opening the pull request.** The owner asked for this on [#47](https://github.com/DetweilerRyan/split/pull/47#discussion_r4653452404) on 2026-11-21, which makes reviewing a regular stage of the workflow as well as the starting point for a separate reviewer. So it comes before submitting in the workflow index, and [submitting work](submitting-work.md) begins with it. Both kinds of review run the same checks, so a finding means the same thing whoever makes it.
- **The whole branch, not the last change.** A self-review that reads only the latest commit misses what earlier commits on the branch did, and a reviewer reads the whole pull request.

## New and moved modules

- **Asked for by the owner** ([feedback](https://github.com/DetweilerRyan/split/pull/75#issuecomment-7110046332)): "yes, add the check to reviewing-work".
- **The case behind it,** on #75: the session moved oxCrap's recursion counting into a new module, `recursion.ts`.
  - **The old file's property test only ever checked a function calling itself.** The session assumed it still covered the new module.
  - **A review found that the counting matched calls to the wrong functions.** It said the property couldn't catch that, and the session answered with example tests for the cases the review named.
  - **The owner then suggested a property test.** It caught three seeded breaks, each shrunk to a one- or two-function case.
  - **The owner's question:** "do you think the property tests for recursion.ts are warrented? and if so, why didn't you add them yourself especially since it was originally implemented in a file that was property tested."
- **Why at review:** the property-test guidance says when one is warranted. But the moment to ask is when code lands somewhere new, and an author fixing findings is focused on the findings. Reviewing your own work happens before every pull request and revision, so the check runs then.
- **Why "a test that can":** an example test fixes the case a finding names. A finding that the tests can't catch a bug is about the tests, not that one case.

## Changed test expectations

- **The rule comes from Kent C. Dodds's [`autopilot` verification guide](https://github.com/kentcdodds/kcd-skills/blob/main/skills/autopilot/references/verification.md):** "Reviewers (AI and human) check every changed test expectation against the PR's intent. When a PR changes an assertion alongside the code it tests, the PR body says why." Added on [#38](https://github.com/DetweilerRyan/split/issues/38), which the owner approved.
- **Why it matters:** a test changed in the same pull request as the code it tests can hide a regression. The code broke, and the test was edited until it agreed. A reason tied to the pull request's intent is what separates a deliberate change from that.
- **The first case:** [#37](https://github.com/DetweilerRyan/split/pull/37) narrowed the first-render assertion of `useActiveIdentity`'s tests from an exact list of renders to "the first render has the identity, and none is empty". It gave the reason: a re-render with the same identity after saving the fallback. The narrowed assertion still failed against the original effect-based hook, which showed it kept catching what it was for.
