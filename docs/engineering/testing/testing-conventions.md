# Testing conventions

## What these conventions cover

Every test in this repository follows these rules, whatever its kind. They cover:

- what a test checks;
- which project a test belongs in;
- what a test may touch;
- how a test replaces a dependency;
- collaboration and contract tests, and when they earn their cost;
- fixing a bug.

Most kinds of test also have their own document in the [testing index](README.md). It says how these rules apply to that kind, and adds its own. [`AGENTS.md`'s definition of done](../../../AGENTS.md#definition-of-done) gives the command that runs the tests.

## What a test checks

- **Make the test use the code the way it's really used.** Prefer a test that exercises several units together over one that isolates a single function. Two kinds of code are exceptions:
  - logic with no collaborators, such as the receipt math, which a test may isolate;
  - code whose job is wiring collaborators that have tests of their own, which [Collaboration and contract tests](#collaboration-and-contract-tests) covers.
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

  Run the app's own logic for real, such as Yjs documents, claim math and seed validation. Never fake something just to make a test faster. The exceptions are the fakes that [Collaboration and contract tests](#collaboration-and-contract-tests) allows.

- **Prefer passing the dependency in.** [_Core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) asks code that decides to take each of these as a parameter:
  - its provider;
  - its client;
  - its clock;
  - its fetcher.

  A test can then hand it a plain fake object, with no mocking. Design other new code this way too, where it costs little.

- **Passing in isn't inverting.** Taking a collaborator as a parameter passes it in. The code inverts the dependency when it also does both of these:
  - declares the collaborator's interface in its own terms;
  - imports no value or type that implements it.

  A [collaboration test](#collaboration-and-contract-tests) needs the dependency inverted.

- **You may use `vi.fn()` when the test checks how something was called:** for a fake's methods, or for a callback the test passes in.
- **Use `vi.mock` only for a third-party module the code imports directly,** and can't reasonably take as a parameter. `src/sync/yjsProvider.test.ts` does this for Liveblocks, `y-webrtc` and `y-indexeddb`.
- **Never mock React or its hooks.**
- **Never `vi.mock` the repository's own modules.** Test them for real.

## Collaboration and contract tests

Some code's job is wiring collaborators that have tests of their own, such as a component that renders what a caller passes into its slots. A test through the real collaborators would repeat their tests. Once [When a collaboration test earns its cost](#when-a-collaboration-test-earns-its-cost) says it's worth it, test such code with a collaboration test. Then invert its dependencies, so the test can pass them in.

- **Its dependencies are of two sorts:**
  - **A _collaborator_** does work the code delegates to it, such as a component a container renders in a slot.
  - **A _store or service_** is state the code reads and changes, such as a document's store. Or it's an effect the code reaches outside itself for, such as an exchange-rate fetcher, or the clipboard at the edge. It counts whether the code uses it or hands it on.
- **Invert every dependency the code can take as a parameter,** as [_core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) defines it:
  - **Declare the interface** each dependency must meet in the code's own terms, listing only what the code uses.
  - **Import no value or type that implements it.** Importing something else from the same module, such as a hook, is fine.
  - **Take each as a parameter, with no default.**
  - **Call the rest directly,** and let them run for real:
    - what the code can't take as a parameter, such as a hook;
    - pure functions, which need no fake.
- **Wire in the real dependencies at a composition root.** That's the nearest code above that isn't itself inverted this way. It imports the real dependencies and passes them in, and the type checker checks each against its interface there.
- **Bind nested inverted code at the root.** The root binds the nested code's dependencies to it before passing it in, so the outer code never sees them. Create the binding once, so the bound code keeps its identity across renders:
  - at module level;
  - or with a `useState` initializer, when the dependencies come from the root's own state.
- **In the collaboration test, fake each collaborator that has contract tests.** Check only how the code uses them: what it gives each one, and what it does with what each gives back or calls. Leave a collaborator's own work to its own tests.
- **A collaborator's own tests are its contract tests.** They check that it meets the interface the code declares, and does what the code relies on. That includes what the type checker can't see, such as something it's given but ignores.
  - **Fake only a collaborator that has contract tests.**
  - **Pass in a real one where it has none,** until it has tests of its own.
- **Run a store or service for real when it takes its effects as parameters,** over fakes of those effects. For example:
  - a store over an in-memory document, in place of its sync and persistence;
  - a fetcher over a fake network.

  Write new ones that way where it costs little, as [Prefer passing the dependency in](#replacing-external-dependencies) asks.

- **Fake a store or service that opens its effects itself,** as `yjsProvider` opens `y-indexeddb`. The test passes a fake that implements the interface. The real one's contract tests check what the code relies on.
- **The edge is a browser or third-party API itself,** such as the clipboard. Fake it as [Replacing external dependencies](#replacing-external-dependencies) says. It needs no contract tests. Fake a third-party collaborator only at the edge too.
- **Keep fakes and contract tests in step.** When what a dependency is given or gives back changes meaning, change its fakes and its contract tests together.
- **Keep at least one test that runs the code with its real dependencies,** such as a test of the whole running app.

## When a collaboration test earns its cost

The interfaces, parameters, composition root and fakes in [Collaboration and contract tests](#collaboration-and-contract-tests) are complexity. Three code design principles decide when they're worth it:

- [_earned complexity_](../code-design-principles.md#4-earned-complexity-pay-for-complexity-only-when-a-use-needs-it);
- [_least power_](../code-design-principles.md#3-least-power-use-the-least-powerful-construct-that-does-the-job);
- [_deep modules_](../code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour).

- **Start with a test through the real collaborators,** as [What a test checks](#what-a-test-checks) says. Write a collaboration test only when all three of these hold:
  - the code's job is wiring;
  - most of its collaborators have tests of their own;
  - a test through them would repeat what those tests check.

  Test a component through the real components it renders when it renders only one or two simple ones. Do the same when most of them have no tests.

- **Earn it with a current use, not an expected one,** as _earned complexity_ asks.
  - **Invert code when its test would start repeating its collaborators' tests,** not because it may grow into a container.
  - **In code no collaboration test has earned yet, don't give a collaborator a parameter** just so a test can fake it later.
- **The collaboration test earns the parameters as a set.** Once you've earned it, make every collaborator a parameter, even one the test passes in real until it has tests. Then one composition root wires them all.
- **A store's or service's parameter isn't an injection point,** so earned complexity doesn't count it, as [code design principles](../code-design-principles.md#when-two-principles-pull-apart) say. It passes a dependency in rather than swapping a whole collaborator. Keep its interface as small as any other.
- **Use the least powerful seam that works,** as _least power_ asks.
  - **Prefer an element slot:** `children`, or another prop typed `ReactNode`. It takes what the caller already rendered, so the test passes its own elements, and the code declares no other interface.
  - **Use a component slot, typed `ComponentType<…>`,** only when the code renders the component with props it computes.
- **Keep each interface small,** as _deep modules_ asks. List only what the code uses. When the code uses a little of a large collaborator, narrow its interface to that.
- **Split the code when its fakes grow too many to read.** The code is too big; adding fakes won't fix that.
- **Undo it when it stops paying.** When the code gains logic of its own, or its collaborators lose their tests, test it through the real collaborators and drop the parameters. Putting the duplication back costs less than keeping an abstraction no use needs.

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
