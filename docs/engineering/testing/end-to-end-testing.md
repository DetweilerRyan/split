# End-to-end testing

The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md), and the rules every feature test follows, its scenarios and its Screenplay, are in [feature testing conventions](feature-testing-conventions.md). This document adds the ones for end-to-end tests and the code under `e2e/` that runs them.

An end-to-end test checks a journey a person or an assistant takes through the running app, such as an assistant creating a room through `/api/mcp` and two people splitting it live. It is a Gherkin scenario, run by [Playwright Test](https://playwright.dev/docs/intro) through [playwright-bdd](https://vitalets.github.io/playwright-bdd/) as [`playwright.config.ts`](../../../playwright.config.ts) sets up, and `npm run test:e2e` runs them all.

| Path                             | Holds                                                                                                                     |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `e2e/features/<journey>.feature` | Scenarios, in the words of the people at the table                                                                        |
| `e2e/steps/<journey>.steps.ts`   | Step definitions                                                                                                          |
| `e2e/screenplay/`                | The cast (`fixtures.ts`), actors and their abilities (`actor.ts`, `mcp.ts`), and the shared `tasks.ts` and `questions.ts` |

- **Each actor's abilities** are a browser of their own, a separate context on a phone-sized screen so each has their own storage and identity, and an MCP client session.
- **Clicks, typing and tool calls belong in tasks, and reading the page or a tool result in questions.** Add one to `tasks.ts` or `questions.ts` rather than using `page` in a step.
- **The root `.gplintrc` lists the app's own words,** like a tool's name, `button` or `seed`.

- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For an end-to-end step, what the person reads on the row:

  ```ts
  // ✅ Specific: the share the person reads on the item
  await expect(actorCalled(person).answer(ItemRow(item))).toContainText(share);

  // ❌ Vague: the row is on the page
  await expect(actorCalled(person).answer(ItemRow(item))).toBeVisible();
  ```

- **A question that reads the page returns a `Locator`,** so `await expect(locator)` retries until it passes, with no waits of your own. Find elements as [testing conventions](testing-conventions.md#what-a-test-checks) says, and assert the text a user reads.
- **End-to-end tests use servers on this machine only.** `playwright.config.ts` starts the app and a local WebRTC signaling server, and every actor's browser refuses requests to any other host. Use receipts in USD, so no exchange rate is fetched. A scenario that needs another outside service waits until that service can be replaced at its edge.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [end-to-end-testing.meta.md](end-to-end-testing.meta.md). Read it only when changing or questioning a rule here.
