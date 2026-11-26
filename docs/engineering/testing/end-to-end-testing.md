# End-to-end testing

The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for end-to-end tests and the code under `e2e/` that runs them.

An end-to-end test checks a journey a person or an assistant takes through the running app, such as an assistant creating a room through `/api/mcp` and two people splitting it live. It is a Gherkin scenario, run by [Playwright Test](https://playwright.dev/docs/intro) through [playwright-bdd](https://vitalets.github.io/playwright-bdd/) as [`playwright.config.ts`](../../../playwright.config.ts) sets up, and `npm run test:e2e` runs them all. Keep edge cases in Vitest. Write a scenario only for what the whole app is needed to show.

| Path                             | Holds                                                                                                                     |
| :------------------------------- | :------------------------------------------------------------------------------------------------------------------------ |
| `e2e/features/<journey>.feature` | Scenarios, in the words of the people at the table                                                                        |
| `e2e/steps/<journey>.steps.ts`   | Step definitions                                                                                                          |
| `e2e/screenplay/`                | The cast (`fixtures.ts`), actors and their abilities (`actor.ts`, `mcp.ts`), and the shared `tasks.ts` and `questions.ts` |

Steps follow the Screenplay pattern: **actors** use **abilities** to perform **tasks** and answer **questions**.

- **Name an actor in every step,** and get them with `actorCalled(name)`. The same name gives the same actor for the whole scenario. Each actor's abilities are created on first use: a browser of their own, a separate context on a phone-sized screen so each has their own storage and identity, and an MCP client session.
- **Keep step definitions thin.** A step calls `actor.attemptsTo(...)` with tasks, or asserts on `actor.answer(...)` with a question. Clicks, typing and tool calls belong in tasks, and reading the page or a tool result belongs in questions. When a step needs one that doesn't exist, add it to `tasks.ts` or `questions.ts` rather than using `page` in the step.
- **Every step definition is used by some feature, and steps don't call other steps.**
  - **What fails:** `npm run test:e2e` fails on a step with no definition, or one that two definitions match. `npm run lint` fails on a definition no feature uses, through `scripts/check-unused-steps.ts`.
  - **Removing a scenario:** delete any definitions only it used.
  - **Sharing behaviour between steps:** put it in a task or question, not in a call from one step to another.
- **A question that reads the page returns a `Locator`,** so `await expect(locator)` retries until it passes, with no waits of your own. Find elements in the order [component tests](component-and-hook-testing.md) use, by role and accessible name first, and assert the text a user reads.
- **Carry what an actor learns to a later step** with `remember` and `recall`, adding the key and its type to `Notes` in `actor.ts`.
- **Import `test`, `Given`, `When` and `Then` from `e2e/screenplay/fixtures.ts` only.** `createBdd` works only with the `test` that playwright-bdd exports.
- **Leave a feature's layout to `npm run format`,** table alignment included, and fix what `npm run lint` reports in it. The rules are in [`.gplintrc`](../../../.gplintrc).
- **When a feature names how the app is built, reword it in the words of the person doing it.** `.gplintrc`'s `no-restricted-patterns` list fails on such words, like a tool's name, `button` or `seed`. When a scenario uses a new one, add it to the list rather than to the scenario.
- **Don't edit `.features-gen/`.** `bddgen` writes the Playwright tests there from the features, and git ignores it.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [end-to-end-testing.meta.md](end-to-end-testing.meta.md). Read it only when changing or questioning a rule here.
