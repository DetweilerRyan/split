# Testing conventions

How to write tests in this repository: what they check, which project they belong in, how component and hook tests are written, and what tests may touch. Everything you need to follow these conventions is in this file; you don't need to read anything else to apply them. The command that runs the tests is in [`AGENTS.md`'s definition of done](../../AGENTS.md#definition-of-done).

## What a test checks

- **Check what a user can see and do.** A component has two users: the person using the app, and the developer rendering it. So a component test works only through the component's props and its rendered output. Don't assert on state, internal functions, how many times something rendered, or CSS classes.
- **Make the test use the code the way it's really used.** Prefer a test that exercises several units together over one that isolates a single function, unless the function is logic with no collaborators, such as the receipt math.
- **Make assertions specific.** Assert the exact thing a user would see: the button with its accessible name, the full message.

  ```ts
  // ✅ Specific: the message the user reads
  await expect.element(screen.getByText('Add the first person to this receipt.')).toBeVisible();

  // ❌ Vague: some element with a class is on the page
  expect(screen.container.querySelector('.text-slate-500')).not.toBeNull();
  ```

- **Name each test after the one behaviour it pins down,** and take its expected values from the requirement, not by running the code and pasting its output.

## Which project a test belongs in

Tests use [Vitest](https://vitest.dev/), with three [projects](https://vitest.dev/guide/projects) in [`vitest.config.ts`](../../vitest.config.ts). The file name decides the project. `npm test` runs all three. A journey through the whole running app is an [end-to-end test](#end-to-end-tests) instead.

| Project   | File name                                               | Runs in                               | Put here                                                                                 |
| :-------- | :------------------------------------------------------ | :------------------------------------ | :--------------------------------------------------------------------------------------- |
| `browser` | `<module>.browser.test.ts`, `<module>.browser.test.tsx` | headless Chromium, through Playwright | every test of a React component or hook                                                  |
| `real`    | `<module>.real.test.ts`                                 | Node                                  | a test that runs real programs or touches the file system, such as a shell script's test |
| `unit`    | `<module>.test.ts`, `<module>.test.tsx`                 | jsdom                                 | everything else: logic with no React, such as math, seed codecs, stores and server code  |

- **Each test file is a sidecar.** It sits beside the one module it covers and is named after it: `src/utils/math.ts` → `src/utils/math.test.ts`, `src/components/IdentityModal.tsx` → `src/components/IdentityModal.browser.test.tsx`, `scripts/prepare-sandbox.sh` → `scripts/prepare-sandbox.real.test.ts`. When tests for a second module creep into a file, move them to that module's sidecar.
- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.
- **Tests run through the React Compiler,** as the app build does. Don't remove the compiler from `vitest.config.ts`; `vitest.config.browser.test.ts` fails if a component stops being compiled.
- **The browser is installed by setup.** [`scripts/prepare-sandbox.sh`](../../scripts/prepare-sandbox.sh) installs it in a sandbox or the dev container. On another machine, run `npx playwright install --only-shell chromium` once before `npm test`.

## Writing component and hook tests

Use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API, `vitest/browser`. Copy the pattern in `src/components/IdentityModal.browser.test.tsx`.

- **Render with `render` from `vitest-browser-react`,** and import the app's stylesheet (`import '../index.css'`) so that visibility reflects the real styles. Cleanup is automatic.
- **Find elements as a user would.** Use `getByRole` with the accessible name first. When no role fits, use, in this order: `getByLabelText`, `getByPlaceholder`, `getByText`, `getByAltText`, `getByTitle`. Use `getByTestId` only when none of these can find the element. If an element can't be found by role, check whether the component is missing an accessible name or role, and fix the component.
- **Interact with `userEvent` from `vitest/browser`.** Don't add `@testing-library/user-event`, and don't dispatch DOM events by hand.
- **Assert with `await expect.element(locator)`.** It retries until the assertion passes or times out, so don't add waits, sleeps or retry loops of your own. Keep actions such as clicks outside the assertion.
- **Assert absence with `await expect.element(locator).not.toBeInTheDocument()`.**
- **Don't wrap calls in React's `act`.** Rendering and `userEvent` already handle it. The one exception is the `act` that `renderHook` returns, which you use to call a hook's own functions.
- **Test a hook through the component that uses it.** Use `renderHook` from `vitest-browser-react` instead only when the hook is complex enough that a component would obscure it, or when several components share it. `src/hooks/useActiveIdentity.browser.test.ts` is an example.
- **A component's callback props are part of what it shows its developer user.** Checking that `onSelect` was called with the chosen id is fine. Checking which internal function ran is not.

## End-to-end tests

An end-to-end test checks a journey a person or an assistant takes through the running app, such as an assistant creating a room through `/api/mcp` and two people splitting it live. It is a Gherkin scenario, run by [Playwright Test](https://playwright.dev/docs/intro) through [playwright-bdd](https://vitalets.github.io/playwright-bdd/) as [`playwright.config.ts`](../../playwright.config.ts) sets up, and `npm run test:e2e` runs them all. Keep edge cases in Vitest. Write a scenario only for what the whole app is needed to show.

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
- **A question that reads the page returns a `Locator`,** so `await expect(locator)` retries until it passes, with no waits of your own. Find elements in the order [component tests](#writing-component-and-hook-tests) use, by role and accessible name first, and assert the text a user reads.
- **Carry what an actor learns to a later step** with `remember` and `recall`, adding the key and its type to `Notes` in `actor.ts`.
- **Import `test`, `Given`, `When` and `Then` from `e2e/screenplay/fixtures.ts` only.** `createBdd` works only with the `test` that playwright-bdd exports.
- **Leave a feature's layout to `npm run format`,** table alignment included, and fix what `npm run lint` reports in it. The rules are in [`.gplintrc`](../../.gplintrc).
- **When a feature names how the app is built, reword it in the words of the person doing it.** `.gplintrc`'s `no-restricted-patterns` list fails on such words, like a tool's name, `button` or `seed`. When a scenario uses a new one, add it to the list rather than to the scenario.
- **Don't edit `.features-gen/`.** `bddgen` writes the Playwright tests there from the features, and git ignores it.

## Tests stay offline

- **A test never makes a request to the internet,** not even to a public endpoint: no Liveblocks, no WebRTC signaling server, no exchange-rate service, no npm registry. The suite must pass with no network access. The browser is downloaded by setup, never by a test.
- **End-to-end tests use servers on this machine only.** `playwright.config.ts` starts the app and a local WebRTC signaling server, and every actor's browser refuses requests to any other host. Use receipts in USD, so no exchange rate is fetched. A scenario that needs another outside service waits until that service can be replaced at its edge.
- **A `real` test runs local programs and temporary files only,** in a temporary directory it cleans up. `scripts/prepare-sandbox.real.test.ts` runs the setup script there with fakes of `npm`, Playwright's CLI, `ldd` and `sudo`.
- **Don't depend on state outside the test,** such as files in the home folder or IndexedDB from an earlier run. Clear `localStorage` before a test that reads it.

## Replacing external dependencies

- **Fake only what can't run in a test,** and fake it at the edge: the network, storage, or a third-party service. Let the app's own logic (Yjs documents, claim math, seed validation) run for real. Don't fake something just to make a test faster.
- **Prefer passing the dependency in.** When code takes its provider, client, clock or fetcher as a parameter, a test can hand it a plain fake object with no mocking at all. Design new code this way where it costs little. `useActiveIdentity` takes only the provider's `setIdentity` for this reason.
- **`vi.fn()` is fine for a fake's methods** and for a component's callback props, when the test needs to check how they were called.
- **Use `vi.mock` only for a third-party module the code imports directly** and can't reasonably take as a parameter, as `src/store/yjsProvider.test.ts` does for Liveblocks, `y-webrtc` and `y-indexeddb`. Never mock React or its hooks. Never `vi.mock` the repository's own modules; test them for real.

## Fixing a bug

Start with a test that reproduces the bug, run it against the unfixed code, and confirm it fails for the reason you expect. Then fix the code and watch the same test pass. If the test passes before the fix, it doesn't reproduce the bug yet.

Changing what an existing test expects needs a reason in the pull request. [Submitting work](workflow/submitting-work.md#what-the-description-carries) says how to list it.

## Changing this document

The reasons for these conventions, their sources, and the options not taken are in [testing-conventions.meta.md](testing-conventions.meta.md). Read it only when changing or questioning a convention here.
