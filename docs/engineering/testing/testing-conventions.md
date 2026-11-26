# Testing conventions

## What these conventions cover

Testing conventions are the rules every test in this repository follows, whatever its kind: what a test checks, which project it belongs in, what it may touch, how it replaces a dependency, collaboration and contract tests and when they earn their cost, and fixing a bug. Most kinds of test have their own document in the [testing index](README.md), which says how these rules apply to it and adds its own. The command that runs the tests is in [`AGENTS.md`'s definition of done](../../../AGENTS.md#definition-of-done).

## What a test checks

- **Make the test use the code the way it's really used.** Prefer a test that exercises several units together over one that isolates a single function, unless the function is logic with no collaborators, such as the receipt math. Code whose job is wiring collaborators that have tests of their own is the exception: [Collaboration and contract tests](#collaboration-and-contract-tests) says how to test it.
- **Make assertions specific.** Assert the exact thing the test's user sees or relies on: the whole value, the full message, the element by what a person reads on it, rather than that something came back. Each kind's own document shows an example for its tests.
- **Find elements as a user would.** Find one by its role with its accessible name first (`getByRole`). When no role fits, find it, in this order, by its label (Vitest's `getByLabelText`, Playwright's `getByLabel`), placeholder (`getByPlaceholder`), text (`getByText`), alt text (`getByAltText`) or title (`getByTitle`). Find it by a test id (`getByTestId`) only when none of these can. If an element can't be found by role, check whether the component is missing an accessible name or role, and fix the component.
- **Name each test after the one behaviour it pins down,** and take its expected values from the requirement, not by running the code and pasting its output.
- **Nest a test's callbacks as its structure needs,** and keep its blocks within the depth [`.oxlintrc.json`](../../../.oxlintrc.json) allows.

## Which project a test belongs in

The app's tests use [Vitest](https://vitest.dev/), with three [projects](https://vitest.dev/guide/projects) in [`vitest.config.ts`](../../../vitest.config.ts). The file name decides the project. `npm test` runs all three; only `unit` and `browser` count towards [CRAP's coverage](crap-testing-practices.md#where-findings-come-from). A journey through the whole running app is an [end-to-end test](end-to-end-testing.md) instead, and a test of the repository's own dev tools is a [tooling test](tooling-testing.md).

| Project   | File name                                               | Runs in                               | Put here                                                                                                                                      |
| :-------- | :------------------------------------------------------ | :------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `browser` | `<module>.browser.test.ts`, `<module>.browser.test.tsx` | headless Chromium, through Playwright | every test of a React component or hook; its own rules are in [component and hook testing](component-and-hook-testing.md)                     |
| `real`    | `<module>.real.test.ts`                                 | Node                                  | a test that runs real programs or touches the file system; its own rules are in [real testing](real-testing.md)                               |
| `unit`    | `<module>.test.ts`, `<module>.test.tsx`                 | jsdom                                 | everything else: logic with no React, such as math, seed codecs, stores and server code; its own rules are in [unit testing](unit-testing.md) |

- **A [property test](property-testing.md) is named `<module>.property.test.ts`,** and runs in the project its module's other tests would: `unit` for the app, `tooling-unit` for tooling.
- **Each test file is a sidecar.** It sits beside the one module it covers and is named after it: `src/domain/receipt/math.ts` → `src/domain/receipt/math.test.ts`, `app/r/[room]/_room-view/IdentityModal.tsx` → `app/r/[room]/_room-view/IdentityModal.browser.test.tsx`. When tests for a second module creep into a file, move them to that module's sidecar.
- **The browser is installed by setup.** [`scripts/prepare-sandbox.sh`](../../../scripts/prepare-sandbox.sh) installs it in a sandbox or the dev container. On another machine, run `npx playwright install --only-shell chromium` once before `npm test`.

## Tests stay offline

- **A test never makes a request to the internet,** not even to a public endpoint: no Liveblocks, no WebRTC signaling server, no exchange-rate service, no npm registry. The suite must pass with no network access. The browser is downloaded by setup, never by a test.
- **A `.real.test.ts` runs local programs and temporary files only,** in whichever project runs it, in a temporary directory it cleans up. `scripts/prepare-sandbox.real.test.ts` runs the setup script there with fakes of `npm`, Playwright's CLI, `ldd` and `sudo`.
- **Don't depend on state outside the test,** such as files in the home folder or IndexedDB from an earlier run. Clear `localStorage` before a test that reads it.

## Replacing external dependencies

- **Fake only what can't run in a test,** and fake it at the edge: the network, storage, or a third-party service. Let the app's own logic (Yjs documents, claim math, seed validation) run for real. Don't fake something just to make a test faster. The exceptions are the fakes [Collaboration and contract tests](#collaboration-and-contract-tests) allows.
- **Prefer passing the dependency in.** When code takes its provider, client, clock or fetcher as a parameter, as [_core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) asks of code that decides, a test can hand it a plain fake object with no mocking at all. Design other new code this way too, where it costs little. Taking a collaborator as a parameter passes it in; declaring its interface in the code's own terms as well, and importing no value or type that implements it, inverts the dependency, which a [collaboration test](#collaboration-and-contract-tests) needs.
- **`vi.fn()` is fine for a fake's methods** and for a callback the test passes in, when the test needs to check how they were called.
- **Use `vi.mock` only for a third-party module the code imports directly** and can't reasonably take as a parameter, as `src/sync/yjsProvider.test.ts` does for Liveblocks, `y-webrtc` and `y-indexeddb`. Never mock React or its hooks. Never `vi.mock` the repository's own modules; test them for real.

## Collaboration and contract tests

Code whose job is wiring collaborators that have tests of their own, such as a component that renders the components passed into its slots, needn't have its test check their work again: a test through the real collaborators would repeat their tests. Test such code with a collaboration test, and invert its dependencies so the test can pass them in, once [When a collaboration test earns its cost](#when-a-collaboration-test-earns-its-cost) says it's worth it.

- **Its dependencies are of two sorts.** A _collaborator_ does work the code delegates to it, such as a component a container renders in a slot. A _store or service_ is state the code reads and changes, such as a document's store, or an effect it reaches outside itself for, such as an exchange-rate fetcher, or the clipboard at the edge, whether the code uses it or hands it on.
- **Invert every dependency it can take as a parameter,** as [_core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) describes. The code declares, in its own terms, the interface each must meet, listing only what it uses, and imports no value or type that implements it, as _core and shell_ defines; importing something else from the same module, such as a hook, is fine. It takes each as a parameter with no default. What it can't take as a parameter, such as a hook, and pure functions, which need no fake, it calls directly, and they run for real.
- **A composition root wires the real ones in:** the nearest code above it that isn't itself inverted this way imports them and passes them in, and the type checker checks each against its interface there. When inverted code nests inside, the root binds the nested code's dependencies to it before passing it in, so the outer code never sees them. It creates the binding once, at module level, or with a `useState` initializer when the dependencies come from its own state, so the bound code keeps its identity across renders.
- **The collaboration test fakes the collaborators it takes as parameters,** and checks only how the code uses them: what it gives each one, and what it does with what each gives back or calls. It doesn't check a collaborator's own work.
- **A collaborator's own tests are its contract tests.** They check that it meets the interface the code declares and does what the code relies on, including what the type checker can't see, such as something it's given but ignores. Fake only a collaborator that has them; for one that doesn't, the test passes the real one until it has tests of its own.
- **A store or service that takes its effects as parameters runs for real** over fakes of them, such as a store over an in-memory document in place of its sync and persistence, or a fetcher over a fake network. Write new ones that way where it costs little, as [Prefer passing the dependency in](#replacing-external-dependencies) asks. One that opens its effects itself, as `yjsProvider` opens `y-indexeddb`, is replaced in the test by a fake that implements the interface, and the real one's contract tests check what the code relies on.
- **The edge is a browser or third-party API itself,** such as the clipboard: it's faked as [Replacing external dependencies](#replacing-external-dependencies) says, with no contract tests. A third-party collaborator is faked only at the edge too.
- **Keep fakes and contract tests in step.** When what a dependency is given or gives back changes meaning, change its fakes and its contract tests together. Keep at least one test that runs the code with its real dependencies, such as a test of the whole running app.

## When a collaboration test earns its cost

The interfaces, parameters, composition root and fakes that [Collaboration and contract tests](#collaboration-and-contract-tests) describes are complexity, and code design principles decide when they're worth it: [_earned complexity_](../code-design-principles.md#4-earned-complexity-pay-for-complexity-only-when-a-use-needs-it), [_least power_](../code-design-principles.md#3-least-power-use-the-least-powerful-construct-that-does-the-job) and [_deep modules_](../code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour).

- **Start with a test through the real collaborators,** as [What a test checks](#what-a-test-checks) says. Write a collaboration test only when that test would pay twice for the same checks: the code's job is wiring, most of its collaborators have tests of their own, and a test through them would repeat what those tests check. A component that renders one or two simple components, or mostly components with no tests of their own, is tested through them.
- **Earn it with a current use, not an expected one,** as _earned complexity_ asks. Don't invert code because it may grow into a container, and in code no collaboration test has earned yet, don't give a collaborator a parameter in case a test wants to fake it later. Invert the code when its test would start repeating its collaborators'.
- **The collaboration test earns the parameters as a set.** Once it does, every collaborator is a parameter, even one passed in real until it has tests, so one composition root wires them all. A store's or service's parameter passes a dependency in rather than swapping a whole collaborator, so it isn't an injection point, but its interface is kept as small as any other.
- **Use the least powerful seam that works,** as _least power_ asks. An element slot, `children` or another prop typed `ReactNode`, takes what the caller already rendered: the test passes its own elements, and the code declares no interface beyond it. Prefer it. Take a component slot, typed `ComponentType<…>`, only when the code renders the component with props it computes.
- **Keep each interface small,** as _deep modules_ asks: it lists only what the code uses. When the code uses a little of a large collaborator, narrow its interface to that. When the fakes grow too many to read, the code is too big; split it rather than add fakes.
- **Undo it when it stops paying.** When the code gains logic of its own, or its collaborators lose their tests, test it through the real collaborators and drop the parameters. Putting the duplication back costs less than keeping an abstraction no use needs.

## Fixing a bug

Start with a test that reproduces the bug, run it against the unfixed code, and confirm it fails for the reason you expect. Then fix the code and watch the same test pass. If the test passes before the fix, it doesn't reproduce the bug yet.

Changing what an existing test expects needs a reason in the pull request. [Submitting work](../workflow/submitting-work.md#what-the-description-carries) says how to list it.

## Kinds of test

Each kind of test follows the rules above, and its own document's:

- The `unit` project's own rules are in [Unit testing](unit-testing.md).
- How and when to write a property test is in [Property testing](property-testing.md).
- The `real` project's own rules are in [Real testing](real-testing.md).
- How to write a component or hook test is in [Component and hook testing](component-and-hook-testing.md).
- How to write an end-to-end test is in [End-to-end testing](end-to-end-testing.md).
- How to test the repository's own dev tools is in [Tooling testing](tooling-testing.md).

Every feature test also follows [Feature testing conventions](feature-testing-conventions.md): its scenarios, its Screenplay, and a deep module's feature contract.

## Changing this document

The reasons for these conventions, their sources, and the options not taken are in [testing-conventions.meta.md](testing-conventions.meta.md). Read it only when changing or questioning a convention here.
