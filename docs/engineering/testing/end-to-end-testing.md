# End-to-end testing

## What this kind of test is

An end-to-end test checks a journey that a person or an assistant takes through the running app. One example is an assistant creating a room through `/api/mcp`, and two people splitting it live. It's a feature test. [`playwright.config.ts`](../../../playwright.config.ts) sets it up, and `npm run test:e2e` runs them all. Its files are under `e2e/`:

| Path                             | Holds                                                                                              |
| :------------------------------- | :------------------------------------------------------------------------------------------------- |
| `e2e/features/<journey>.feature` | Scenarios, in the words of the people at the table                                                 |
| `e2e/steps/<journey>.steps.ts`   | Step definitions                                                                                   |
| `e2e/screenplay/`                | The cast (`fixtures.ts`), actors and their abilities, and the shared `tasks.ts` and `questions.ts` |

## How the conventions apply

[Testing conventions](testing-conventions.md) and [feature testing conventions](feature-testing-conventions.md) apply as written, with these for end-to-end tests:

- **Each actor's abilities** are these:
  - a browser of their own: a separate context on a phone-sized screen, so each actor has their own storage and identity;
  - an MCP client session.
- **Clicks, typing and tool calls belong in tasks, and reading the page or a tool result in questions.** Add one to `tasks.ts` or `questions.ts` rather than using `page` in a step.
- **The root [`.gplintrc`](../../../.gplintrc)'s `no-restricted-patterns` list bans the words for how the app is built,** like a tool's name, `button` or `seed`.
- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For an end-to-end step, what the person reads on the row:

  ```ts
  // ✅ Specific: the share the person reads on the item
  await expect(actorCalled(person).answer(ItemRow(item))).toContainText(share);

  // ❌ Vague: the row is on the page
  await expect(actorCalled(person).answer(ItemRow(item))).toBeVisible();
  ```

- **End-to-end tests use servers on this machine only.** `playwright.config.ts` starts the app and a local WebRTC signaling server, and every actor's browser refuses requests to any other host. Use receipts in USD, so nothing fetches an exchange rate. A scenario that needs another outside service waits until a test can replace that service at its edge.
- **Find elements as [testing conventions](testing-conventions.md#what-a-test-checks) says,** by role and accessible name first, and assert the text a user reads.

## Rules of its own

### When to write one

[Scenarios](feature-testing-conventions.md#scenarios) in feature testing conventions says when a scenario is worth writing.

### Writing one

- **A question that reads the page returns a `Locator`,** so `await expect(locator)` retries until it passes, with no waits of your own.

### When one fails

In testing conventions, [Fixing a bug](testing-conventions.md#fixing-a-bug) applies as written. In feature testing conventions, [Steps and the Screenplay](feature-testing-conventions.md#steps-and-the-screenplay) says what fails, and what to do, for each of these:

- a step with no definition;
- a step that two definitions match;
- a step definition no feature uses.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [end-to-end-testing.meta.md](end-to-end-testing.meta.md). Read it only when changing or questioning a rule here.
