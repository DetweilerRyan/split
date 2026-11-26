# Testing conventions

## What these conventions cover

Every test in this repository follows these rules, whatever its kind. They cover:

- what a test checks;
- which project a test belongs in;
- what a test may touch;
- how a test replaces a dependency;
- fixing a bug.

A test that fakes a child component, store or service also follows [Collaboration testing conventions](collaboration-testing-conventions.md). So does a test of code whose job is wiring other tested code. Most kinds of test also have their own document in the [testing index](README.md). It says how these rules apply to that kind, and adds its own. [`AGENTS.md`'s definition of done](../../../AGENTS.md#definition-of-done) gives the command that runs the tests.

## What a test checks

- **Make the test use the code the way it's really used.** Prefer a test that exercises several units together over one that isolates a single function. Two kinds of code are exceptions:
  - logic with no collaborators, such as the receipt math, which a test may isolate;
  - code whose job is wiring collaborators that have tests of their own, which [Collaboration and contract tests](collaboration-testing-conventions.md#collaboration-and-contract-tests) covers.
- **Make assertions specific.** Assert the exact thing the test's user sees or relies on, not just that something came back:
  - the whole value;
  - the full message;
  - an element, by what a person reads on it.

  Each kind's own document shows an example for its tests.

- **Find elements as a user would.** First find an element by its role with its accessible name (`getByRole`). When no role fits, try these in order:
  1. its label: Vitest's `getByLabelText`, or Playwright's `getByLabel`;
  2. its placeholder (`getByPlaceholder`);
  3. its text (`getByText`);
  4. its alt text (`getByAltText`);
  5. its title (`getByTitle`).

  Use a test id (`getByTestId`) only when none of these can find it. When no role finds an element, check whether the component lacks an accessible name or role, and fix the component.

- **Name each test after the one behaviour it pins down.**
- **Take a test's expected values from the requirement.** Don't run the code and paste its output.
- **Nest a test's callbacks as its structure needs,** within the depth [`.oxlintrc.json`](../../../.oxlintrc.json) allows.

## Which project a test belongs in

The app's tests use [Vitest](https://vitest.dev/), with three [projects](https://vitest.dev/guide/projects) in [`vitest.config.ts`](../../../vitest.config.ts). A test's file name decides its project. `npm test` runs all three. Only `unit` and `browser` count towards [CRAP's coverage](crap-testing-practices.md#where-findings-come-from).

Two kinds of test sit outside these projects:

- a journey through the whole running app is an [end-to-end test](end-to-end-testing.md);
- a test of the repository's own dev tools is a [tooling test](tooling-testing.md).

| Project   | File name                                               | Runs in                               | Put here                                                                                                                                      |
| :-------- | :------------------------------------------------------ | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser` | `<module>.browser.test.ts`, `<module>.browser.test.tsx` | headless Chromium, through Playwright | every test of a React component or hook; its own rules are in [component and hook testing](component-and-hook-testing.md)                     |
| `real`    | `<module>.real.test.ts`                                 | Node                                  | a test that runs real programs or touches the file system; its own rules are in [real testing](real-testing.md)                               |
| `unit`    | `<module>.test.ts`, `<module>.test.tsx`                 | jsdom                                 | everything else: logic with no React, such as math, seed codecs, stores and server code; its own rules are in [unit testing](unit-testing.md) |

- **Name a [property test](property-testing.md) `<module>.property.test.ts`.** It runs in the project its module's other tests run in: `unit` for the app, `tooling-unit` for tooling.
- **Make each test file a sidecar.** Put it beside the one module it covers, and name it after that module:
  - `src/domain/receipt/math.ts` → `src/domain/receipt/math.test.ts`;
  - `app/r/[room]/_room-view/IdentityModal.tsx` → `app/r/[room]/_room-view/IdentityModal.browser.test.tsx`.

  When tests for a second module creep into a file, move them to that module's sidecar.

- **Let setup install the browser.** In a sandbox or the dev container, [`scripts/prepare-sandbox.sh`](../../../scripts/prepare-sandbox.sh) installs it. On another machine, run `npx playwright install --only-shell chromium` once before `npm test`.

## Tests stay offline

- **Never make a request to the internet from a test,** not even to a public endpoint. That rules out, among others:
  - Liveblocks;
  - a WebRTC signaling server;
  - the exchange-rate service;
  - the npm registry.

  The suite must pass with no network access. Setup downloads the browser; a test never does.

- **Run only local programs and temporary files in a `.real.test.ts`,** whichever project runs it. Use a temporary directory, and clean it up. `scripts/prepare-sandbox.real.test.ts` runs the setup script there, with fakes of `npm`, Playwright's CLI, `ldd` and `sudo`.
- **Set up every piece of state the test reads inside the test.** Never rely on files in the home folder, or on IndexedDB left by an earlier run. Clear `localStorage` before a test that reads it.

## Replacing external dependencies

- **Fake only what can't run in a test,** and fake it at the edge:
  - the network;
  - storage;
  - a third-party service.

  Run the app's own logic for real, such as Yjs documents, claim math and seed validation. Never fake something just to make a test faster. The exceptions are the fakes that [Collaboration and contract tests](collaboration-testing-conventions.md#collaboration-and-contract-tests) allows.

- **Prefer passing the dependency in.** [_Core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) asks code that decides to take each of these as a parameter:
  - its provider;
  - its client;
  - its clock;
  - its fetcher.

  A test can then hand it a plain fake object, with no mocking. Design other new code this way too, where it costs little.

- **Passing in isn't inverting.** Taking a dependency as a parameter passes it in. The code inverts the dependency when it also does both of these:
  - declares the dependency's interface in its own terms;
  - imports no value or type that implements it.

  A [collaboration test](collaboration-testing-conventions.md#collaboration-and-contract-tests) needs the dependency inverted.

- **You may use `vi.fn()` when the test checks how something was called:** for a fake's methods, or for a callback the test passes in.
- **Use `vi.mock` only for a third-party module the code imports directly,** and can't reasonably take as a parameter. `src/sync/yjsProvider.test.ts` does this for Liveblocks, `y-webrtc` and `y-indexeddb`.
- **Never mock React or its hooks.**
- **Never `vi.mock` the repository's own modules.** Test them for real. To fake a child component, store or service the code uses, follow [Collaboration testing conventions](collaboration-testing-conventions.md).

## Fixing a bug

1. **Write a test that reproduces the bug.**
2. **Run it against the unfixed code,** and confirm it fails for the reason you expect. If it passes, it doesn't reproduce the bug yet.
3. **Fix the code,** and watch the same test pass.

When you change what an existing test expects, give the reason in the pull request. [Submitting work](../workflow/submitting-work.md#what-the-description-carries) says how to list it.

## Kinds of test

Each kind of test follows the rules above, and its own document's:

- [Unit testing](unit-testing.md): the `unit` project's own rules.
- [Property testing](property-testing.md): how and when to write a property test.
- [Real testing](real-testing.md): the `real` project's own rules.
- [Component and hook testing](component-and-hook-testing.md): how to write a component or hook test.
- [End-to-end testing](end-to-end-testing.md): how to write an end-to-end test.
- [Tooling testing](tooling-testing.md): how to test the repository's own dev tools.

Every feature test also follows [Feature testing conventions](feature-testing-conventions.md): its scenarios, its Screenplay, and a deep module's feature contract.

## Changing this document

[testing-conventions.meta.md](testing-conventions.meta.md) holds the reasons for these conventions, their sources, and the options not taken. Read it only when you change or question a convention here.
