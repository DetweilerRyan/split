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
- **Nest a test's callbacks as its structure needs,** and keep its blocks within the depth [`.oxlintrc.json`](../../.oxlintrc.json) allows.

## Which project a test belongs in

The app's tests use [Vitest](https://vitest.dev/), with three [projects](https://vitest.dev/guide/projects) in [`vitest.config.ts`](../../vitest.config.ts). The file name decides the project. `npm test` runs all three; only `unit` and `browser` count towards [CRAP's coverage](crap.md#where-findings-come-from). A journey through the whole running app is an [end-to-end test](#end-to-end-tests) instead, and a test of the repository's own dev tools is a [tooling test](#tooling-tests).

| Project   | File name                                               | Runs in                               | Put here                                                                                |
| :-------- | :------------------------------------------------------ | :------------------------------------ | :-------------------------------------------------------------------------------------- |
| `browser` | `<module>.browser.test.ts`, `<module>.browser.test.tsx` | headless Chromium, through Playwright | every test of a React component or hook                                                 |
| `real`    | `<module>.real.test.ts`                                 | Node                                  | a test that runs real programs or touches the file system                               |
| `unit`    | `<module>.test.ts`, `<module>.test.tsx`                 | jsdom                                 | everything else: logic with no React, such as math, seed codecs, stores and server code |

- **A [property test](#property-tests) is named `<module>.property.test.ts`,** and runs in the project its module's other tests would: `unit` for the app, `tooling-unit` for tooling.
- **Each test file is a sidecar.** It sits beside the one module it covers and is named after it: `src/domain/receipt/math.ts` → `src/domain/receipt/math.test.ts`, `src/components/IdentityModal.tsx` → `src/components/IdentityModal.browser.test.tsx`. When tests for a second module creep into a file, move them to that module's sidecar.
- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.
- **Tests run through the React Compiler,** as the app build does. Don't remove the compiler from `vitest.config.ts`; `vitest.config.browser.test.ts` fails if a component stops being compiled.
- **The browser is installed by setup.** [`scripts/prepare-sandbox.sh`](../../scripts/prepare-sandbox.sh) installs it in a sandbox or the dev container. On another machine, run `npx playwright install --only-shell chromium` once before `npm test`.

## Property tests

A property test checks a rule that should hold for every input, against many inputs [fast-check](https://fast-check.dev/) generates. When one fails, fast-check shrinks the input to the smallest one that still breaks the rule.

- **Write one when you can state a rule for all inputs, and check it without working out the answer the way the code does.** For example:
  - **a round trip:** decoding what was encoded gives back the original;
  - **an invariant:** the shares of a split add up to the total;
  - **an answer the generator knows:** oxCrap's generated functions record how many branches they have;
  - **agreement with a simpler version** of the same code.
- **Don't write one** for components, or for code whose right answer you'd have to work out the same way the code does. Example tests say those more clearly.
- **Keep the example tests too.** A property test adds inputs nobody thought of; it doesn't replace the cases a reader needs to see.
- **Put it in its own sidecar,** `<module>.property.test.ts`, beside the module. It runs with the module's other unit tests, and counts towards the coverage report like them.
- **Generate every way the input can be written, not just its plainest form.** List the rules the code decides, from its issue's decisions or its README, and give the arbitrary a dimension for each:
  - **where the thing lives,** such as in the file or imported from another;
  - **the forms it can take,** such as wrappers, casts or aliases;
  - **code nearby that must, or must not, change the answer.**

  A generator of the plainest shape checks the headline claim and none of the decisions around it.

- **For code that recognises a pattern, generate the dodges and the look-alikes:** rewrites that get around it, and code it must leave alone. Each should give the answer the plain version gives, or the answer for no pattern at all, such as the same code reading a name that isn't a table.
- **Build inputs from fast-check's arbitraries,** and assert with `expect` inside `fc.property`. Return nothing from the property.
- **Build constraints into the arbitraries,** such as `fc.integer({ min: 1 })`, rather than filtering inputs out with `fc.pre` or `.filter`. Filtering wastes runs and can leave few inputs that test anything.
- **Don't write a property that only restates what the generator guarantees,** such as checking that a generated positive number is positive. It passes whatever the code does.
- **Show a new property can fail.** Break the code it checks, for example by removing a branch or changing a rule, and confirm the property fails. Then put the code back. A property that passes either way tests nothing.
  - **Mutation testing breaks most of the rules a generator varies for you,** where it runs, as [Mutation testing](mutation-testing.md) says. A mutant on such a rule that survives means no dimension reaches it. Break by hand only the rules no mutant can undo, such as a call wrapped around a value, which no mutator removes.
- **When a review or a mutation run finds a bug a property test missed,** add the dimension that would have caught it, and confirm the property fails with the fix undone.
- **Keep it fast.** fast-check runs 100 inputs by default. Raise `numRuns` only for a check that's cheap to run, as oxCrap's complexity property is.
- **When one fails, its output gives a seed and a path.** Pass them to `fc.assert` as `{ seed, path }` to run the same input again. Once it's fixed, add the shrunk input as an example test.

`scripts/oxcrap/complexity.property.test.ts` is an example.

## Writing component and hook tests

Use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API, `vitest/browser`. Copy the pattern in `src/components/IdentityModal.browser.test.tsx`.

- **Render with `render` from `vitest-browser-react`,** and import the app's stylesheet (`import '../index.css'`) so that visibility reflects the real styles. Cleanup is automatic.
- **Find elements as a user would.** Use `getByRole` with the accessible name first. When no role fits, use, in this order: `getByLabelText`, `getByPlaceholder`, `getByText`, `getByAltText`, `getByTitle`. Use `getByTestId` only when none of these can find the element. If an element can't be found by role, check whether the component is missing an accessible name or role, and fix the component.
- **Interact with `userEvent` from `vitest/browser`.** Don't add `@testing-library/user-event`, and don't dispatch DOM events by hand.
- **Assert with `await expect.element(locator)`.** It retries until the assertion passes or times out, so don't add waits, sleeps or retry loops of your own. Keep actions such as clicks outside the assertion.
- **Assert absence with `await expect.element(locator).not.toBeInTheDocument()`.**
- **Don't wrap calls in React's `act`.** Rendering and `userEvent` already handle it. The one exception is the `act` that `renderHook` returns, which you use to call a hook's own functions.
- **Test a hook through the component that uses it.** Use `renderHook` from `vitest-browser-react` instead only when the hook is complex enough that a component would obscure it, or when several components share it. `src/hooks/useActiveIdentity.browser.test.ts` is an example.
- **`RoomView` is the exception to both rules above it and to [faking only what can't run](#replacing-external-dependencies).** Its hooks are tested on their own with `renderHook`, and its own test passes fake components through its `parts` prop and fakes of its `services`, checking only how it wires them together, as the owner decided on [#93](https://github.com/DetweilerRyan/split/issues/93#issuecomment-7122174580). Its hooks aren't passed in: it calls the real ones.
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

## Tooling tests

Tooling tests check the repository's own dev tools: everything in `scripts/`, and root tooling config such as `.rev-dep.config.jsonc`, whose sidecar is `rev-dep.config.real.test.ts`. They run apart from the app's, from two configs, and `npm run test:tooling` runs both. `npm test` doesn't.

| Project        | Config                                                                 | File name                                                     | Runs in |
| :------------- | :--------------------------------------------------------------------- | :------------------------------------------------------------ | :------ |
| `tooling-unit` | [`vitest.tooling.config.ts`](../../vitest.tooling.config.ts)           | every `<module>.test.ts` under `scripts/` that isn't `.real.` | Node    |
| `tooling-real` | [`vitest.tooling-real.config.ts`](../../vitest.tooling-real.config.ts) | `<module>.real.test.ts`                                       | Node    |

- **Name and place them as the app's tests are:** a sidecar beside its module (`scripts/prepare-sandbox.sh` → `scripts/prepare-sandbox.real.test.ts`), `.real.` when it runs programs or touches the file system.
- **They get no React Compiler and no `@` alias,** so a tooling test can't import app code.
- **Only `tooling-unit` collects coverage,** of oxCrap's code, into `coverage-tooling/`, for [its CRAP score](crap.md). `tooling-real` collects none.
- **A root file's test is tooling when it tests tooling config.** List it in `include` in `vitest.tooling-real.config.ts`, and in `ignored` in `vitest.config.ts`. `vitest.config.browser.test.ts` stays an app test, since it guards the app's compiler setup.

### Feature contracts for deep modules

A deep module is any module whose small interface hides much more logic than the interface shows. It might be a program with a command line, or a simplified abstraction over complex code that callers use through a few functions. Its contract is what its callers give it and get back, which is the part that survives rewriting its internals.

- **Test a deep module's contract with Gherkin features,** written in its callers' words and kept beside it.
- **Drive the features through the module's own interface.** Run a program end to end, as a process. A module used through code is driven through its functions, which needn't be end to end.
- **Keep unit tests for the modules inside it,** for their edge cases.
- **Don't keep a second test of the same contract,** such as a `real` test of the program, beside the features.

#### Deciding a module is deep

What makes a module deep is how much its internals outweigh its interface, and that isn't measured. So whether a module is deep is the owner's call.

- **An agent that thinks a module is deep proposes it** in the issue or pull request. It says what the interface is, and what it hides.
- **Until the owner agrees, test it as any other module.** A script keeps its `real` test.

| Deep module               | Decided on                                              |
| :------------------------ | :------------------------------------------------------ |
| oxCrap, `scripts/oxcrap/` | [#65](https://github.com/DetweilerRyan/split/issues/65) |

#### A deep module that's a program

These rules cover a deep module whose interface is a program, the only kind set up so far. The first deep module used through code sets up its own layout and runner, and adds its rules here.

| Path                                            | Holds                                                 |
| :---------------------------------------------- | :---------------------------------------------------- |
| `scripts/<tool>/features/<topic>.feature`       | Scenarios, in the words of a developer using the tool |
| `scripts/<tool>/features/steps/<tool>.steps.ts` | Step definitions                                      |
| `scripts/<tool>/features/screenplay/`           | The tool's own cast, actor, tasks and questions       |
| `scripts/<tool>/features/playwright.config.ts`  | Its playwright-bdd config, with no browser            |
| `scripts/<tool>/features/.gplintrc`             | Its gplint rules                                      |

- **Follow the [end-to-end tests' Screenplay rules](#end-to-end-tests),** with these differences:
  - **The actor's abilities** are a throwaway project folder and running the program, not a browser or an MCP session.
  - **The fixtures take no `browser` or `page`,** so Playwright never starts one.
  - **The screenplay is the tool's own, inside its folder,** so the tool imports nothing from outside it. A [dependency-direction](dependency-direction.md) rule can enforce that, as one does for oxCrap.
  - **Steps import `test`, `Given`, `When` and `Then`** from the tool's own `screenplay/fixtures.ts`.
- **Run the program as a process, by its path,** as a developer would, and assert its exit status and the exact text it prints. Put a message longer than a step allows, or one holding double quotes, in a DocString.
- **Use the tool's own words:** for oxCrap, function, complexity, config, coverage report and `@crap-allow`. The tool's `.gplintrc` bans its module and function names, and how the test runs the program, instead of the app's words. Its structural rules are copied from the root `.gplintrc`: change a rule in both.
- **Keep edge cases in the modules' unit tests.** A scenario covers what the program as a whole does with its arguments and files.
- **Wire a new tool's features into `package.json`:** its config in `test:tooling`; `gplint -c <its .gplintrc> <its folder>` and `-c <its config>` for `check-unused-steps.ts` in `lint`; its folder in `format` and `format:check`.

## Tests stay offline

- **A test never makes a request to the internet,** not even to a public endpoint: no Liveblocks, no WebRTC signaling server, no exchange-rate service, no npm registry. The suite must pass with no network access. The browser is downloaded by setup, never by a test.
- **End-to-end tests use servers on this machine only.** `playwright.config.ts` starts the app and a local WebRTC signaling server, and every actor's browser refuses requests to any other host. Use receipts in USD, so no exchange rate is fetched. A scenario that needs another outside service waits until that service can be replaced at its edge.
- **A `real` test runs local programs and temporary files only,** in a temporary directory it cleans up. `scripts/prepare-sandbox.real.test.ts` runs the setup script there with fakes of `npm`, Playwright's CLI, `ldd` and `sudo`.
- **Don't depend on state outside the test,** such as files in the home folder or IndexedDB from an earlier run. Clear `localStorage` before a test that reads it.

## Replacing external dependencies

- **Fake only what can't run in a test,** and fake it at the edge: the network, storage, or a third-party service. Let the app's own logic (Yjs documents, claim math, seed validation) run for real. Don't fake something just to make a test faster.
- **Prefer passing the dependency in.** When code takes its provider, client, clock or fetcher as a parameter, a test can hand it a plain fake object with no mocking at all. Design new code this way where it costs little. `useActiveIdentity` takes only the provider's `setIdentity` for this reason.
- **`vi.fn()` is fine for a fake's methods** and for a component's callback props, when the test needs to check how they were called.
- **Use `vi.mock` only for a third-party module the code imports directly** and can't reasonably take as a parameter, as `src/sync/yjsProvider.test.ts` does for Liveblocks, `y-webrtc` and `y-indexeddb`. Never mock React or its hooks. Never `vi.mock` the repository's own modules; test them for real.

## Fixing a bug

Start with a test that reproduces the bug, run it against the unfixed code, and confirm it fails for the reason you expect. Then fix the code and watch the same test pass. If the test passes before the fix, it doesn't reproduce the bug yet.

Changing what an existing test expects needs a reason in the pull request. [Submitting work](workflow/submitting-work.md#what-the-description-carries) says how to list it.

## Changing this document

The reasons for these conventions, their sources, and the options not taken are in [testing-conventions.meta.md](testing-conventions.meta.md). Read it only when changing or questioning a convention here.
