# Collaboration testing conventions

## What these conventions cover

These rules are for testing code whose job is to call other code that has tests of its own. You may know this as mocking what code calls, stubbing a store, or dependency injection. This document calls the code such code calls its _collaborators_. They say:

- when such code earns a test that fakes what it uses;
- how the code takes what it uses, so a test can pass fakes;
- what such a test checks, and what it leaves to the other code's tests.

Every test also follows [Testing conventions](testing-conventions.md). For React components, [Components](../components.md#containers) says how a container applies these rules.

## Collaboration and contract tests

Some code's job is wiring collaborators that have tests of their own. For example, it calls what a caller passes in, and passes on what each returns. A test through the real collaborators would repeat their tests. Once [When a collaboration test earns its cost](#when-a-collaboration-test-earns-its-cost) says it's worth it, test such code with a collaboration test. Then invert its dependencies, so the test can pass them in.

- **Its dependencies are of two sorts:**
  - **A _collaborator_** does work the code delegates to it, such as another module the code hands part of its job to.
  - **A _store or service_** is state the code reads and changes, such as a document's store. Or it's an effect the code reaches outside itself for, such as an exchange-rate fetcher, or the clipboard at the edge. It counts whether the code uses it or hands it on.
- **Invert every dependency the code can take as a parameter,** as [_core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) defines it:
  - **Declare the interface** each dependency must meet in the code's own terms, listing only what the code uses.
  - **Import no value or type that implements it.** Importing something else from the same module, such as a function it calls directly, is fine.
  - **Take each as a parameter, with no default.**
  - **Call the rest directly,** and let them run for real:
    - what the code can't take as a parameter, such as something its framework requires it to call directly rather than receive as a value;
    - pure functions, which need no fake.
- **Wire in the real dependencies at a composition root.** That's the nearest code above that isn't itself inverted this way. It imports the real dependencies and passes them in, and the type checker checks each against its interface there.
- **Bind nested inverted code at the root.** The root binds the nested code's dependencies to it before passing it in, so the outer code never sees them. Where the code takes a function to call, the root passes one that calls the nested code. That function passes on what the outer code gives it, plus the nested code's own dependencies.
- **In the collaboration test, fake each collaborator that has contract tests.** Check only how the code uses them: what it gives each one, and what it does with what each gives back or calls. Leave a collaborator's own work to its own tests.
- **A collaborator's own tests are its contract tests.** They check that it meets the interface the code declares, and does what the code relies on. That includes what the type checker can't see, such as something it's given but ignores.
  - **Fake only a collaborator that has contract tests.**
  - **Pass in a real one where it has none,** until it has tests of its own.
- **Run a store or service for real when it takes its effects as parameters,** over fakes of those effects. For example:
  - a store over an in-memory document, in place of its sync and persistence;
  - a fetcher over a fake network.

  Write new ones that way where it costs little, as [Prefer passing the dependency in](testing-conventions.md#replacing-external-dependencies) asks.

- **Fake a store or service that opens its effects itself,** as `yjsProvider` opens `y-indexeddb`. The test passes a fake that implements the interface. The real one's contract tests check what the code relies on.
- **The edge is a browser or third-party API itself,** such as the clipboard. Fake it as [Replacing external dependencies](testing-conventions.md#replacing-external-dependencies) says. It needs no contract tests. Fake a third-party collaborator only at the edge too.
- **Keep fakes and contract tests in step.** When what a dependency is given or gives back changes meaning, change its fakes and its contract tests together.
- **Keep at least one test that runs the code with its real dependencies,** such as one that runs the whole app.

## When a collaboration test earns its cost

The interfaces, parameters, composition root and fakes in [Collaboration and contract tests](#collaboration-and-contract-tests) are complexity. Three code design principles decide when they're worth it:

- [_earned complexity_](../code-design-principles.md#4-earned-complexity-pay-for-complexity-only-when-a-use-needs-it);
- [_least power_](../code-design-principles.md#3-least-power-use-the-least-powerful-construct-that-does-the-job);
- [_deep modules_](../code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour).

- **Start with a test through the real collaborators,** as [What a test checks](testing-conventions.md#what-a-test-checks) says. Write a collaboration test only when all three of these hold:
  - the code's job is wiring;
  - most of its collaborators have tests of their own;
  - a test through them would repeat what those tests check.

  Test code through its real collaborators when it has only one or two simple ones. Do the same when most of them have no tests.

- **Earn it with a current use, not an expected one,** as _earned complexity_ asks.
  - **Invert code when its test would start repeating its collaborators' tests,** not because it may grow into wiring code.
  - **In code no collaboration test has earned yet, don't give a collaborator a parameter** just so a test can fake it later.
- **The collaboration test earns the parameters as a set.** Once you've earned it, make every collaborator a parameter, even one the test passes in real until it has tests. Then one composition root wires them all.
- **A store's or service's parameter isn't an injection point,** so earned complexity doesn't count it, as [code design principles](../code-design-principles.md#when-two-principles-pull-apart) say. It passes a dependency in rather than swapping a whole collaborator. Keep its interface as small as any other.
- **Use the least powerful seam that works,** as _least power_ asks.
  - **Prefer taking a result the caller has already made,** which the code only places or passes on, without calling into it. The test passes its own results, and the code declares no other interface.
  - **Take a function, or an object whose methods it calls, only when the code calls it with values it computes.** Its composition root passes one that calls the real collaborator. It adds anything the code doesn't compute, so the code never sees it.
- **Keep each interface small,** as _deep modules_ asks. List only what the code uses. When the code uses a little of a large collaborator, narrow its interface to that.
- **Split the code when its fakes grow too many to read.** The code is too big; adding fakes won't fix that.
- **Undo it when it stops paying.** When the code gains logic of its own, or its collaborators lose their tests, test it through the real collaborators and drop the parameters. Putting the duplication back costs less than keeping an abstraction no use needs.

## Changing this document

The reasons for these conventions and the options not taken are in [collaboration-testing-conventions.meta.md](collaboration-testing-conventions.meta.md). Their sources are listed in [testing conventions' sidecar](testing-conventions.meta.md#sources). Read them only when you change or question a convention here.
