# Code design principles

Six principles for deciding how code is shaped here. Each says how to decide, with the reason, so it applies to cases nothing below names. The rules that enforce parts of them live in the documents each one links to.

Apply them to the code your task writes or changes. Don't reshape other code to fit them unless the task asks. Not all existing code follows them yet, so follow the principle, not the nearest example.

| #   | Name                                                                                        | Principle                                                  |
| :-- | :------------------------------------------------------------------------------------------ | :--------------------------------------------------------- |
| 1   | [Core and shell](#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) | Keep essential logic apart from the machinery around it    |
| 2   | [Contained state](#2-contained-state-keep-state-minimal-immutable-and-contained)            | Keep state minimal, immutable and contained                |
| 3   | [Least power](#3-least-power-use-the-least-powerful-construct-that-does-the-job)            | Use the least powerful construct that does the job         |
| 4   | [Earned complexity](#4-earned-complexity-pay-for-complexity-only-when-a-use-needs-it)       | Pay for complexity only when a use needs it                |
| 5   | [Deep modules](#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour)  | Give each module a small interface over a lot of behaviour |
| 6   | [Honest types](#6-honest-types-let-the-types-rule-out-states-that-cant-happen)              | Let the types rule out states that can't happen            |

Refer to a principle by its name.

## 1. Core and shell: keep essential logic apart from the machinery around it

Essential logic is the users' problem itself: how a receipt is split, rounded and totalled. Test it by asking whether the rule would exist with no React, no Yjs and no network. If it would, it's essential. The machinery around it, the UI, sync, storage and outside services, is still needed; it just isn't domain logic.

- **Write essential logic as pure functions over plain data, in `src/domain/`,** named in the domain's own words, such as receipt, item, claim, participant and share.
- **Keep effects in the shell, and decisions out of it where you can.** The shell reads and writes the outside world, and passes plain values to the code that decides. A decision that exists only because of the machinery, such as whether a dialog is open, stays out of `src/domain/`. If it's more than wiring, write it as a pure function beside the shell code that uses it.
- **Pass effects into the code that decides as arguments,** typed by an interface holding only what the code uses (interface segregation), as `useActiveIdentity` takes `Pick<RoomProvider, 'setIdentity'>`. When the deciding code declares that interface in its own terms, importing no value or type that implements it, the dependency is inverted too (dependency inversion). `useExchangeRate` declares `FetchRate` that way, and `RoomView`, the composition root of the room's container `RoomViewRoot`, passes in `src/services/`'s `getExchangeRate`. Pure logic then needs no fakes, and the rest fakes only the effects that can't run in a test, and what [collaboration tests](testing/collaboration-testing-conventions.md#collaboration-and-contract-tests) allow, with plain objects, as [Testing conventions](testing/testing-conventions.md#replacing-external-dependencies) says.
- **A business decision your change adds or edits in a component or hook goes in the domain,** and the UI calls it.

```ts
// Wrong: the component splits the bill itself, skipping the domain's split in minor units.
const share = item.eur / claimants.length;

// Right: the component reads the domain's split.
const { perPerson } = computeReceiptMath(snapshot);
```

Where code goes is in [Code layout](code-layout.md), and what each layer may import is in [Dependency direction](dependency-direction.md). How to pass a fake in a test is in [Testing conventions](testing/testing-conventions.md#replacing-external-dependencies).

## 2. Contained state: keep state minimal, immutable and contained

Out of the Tar Pit argues that state is the biggest remaining cause of complexity in most large systems, so keep as little of it as the task allows, and keep the rest apart.

- **Don't store a value you can compute from other state.** Derive it where it's read. Keep a cached copy only when a reader needs a stable value or deriving it is too slow, and rebuild it from its source whenever the source changes, as `ReceiptStore` rebuilds the snapshot it gives `useSyncExternalStore`.
- **Write functions over plain data, not classes.** Keep state in a function's parameters, or in a factory that closes over it and returns an object of functions, as `createActor` in [`e2e/screenplay/actor.ts`](../../e2e/screenplay/actor.ts) does. An `Error` subclass may be a class. Any other class needs the owner's approval, as `ReceiptStore`'s had on [#83](https://github.com/DetweilerRyan/split/issues/83). Use `this` only inside those classes. `npm run lint` enforces this through the local oxlint plugin [`scripts/lint/functional.ts`](../../scripts/lint/functional.ts).
- **Keep the room's data, which is persisted and shared between peers, in the shell's storage and sync code,** under `src/sync/`, and hand the core plain, immutable snapshots of it, as `ReceiptStore` turns the room's Yjs document into a `RoomSnapshot`. The receipt's data is essential; only how it's stored and synced belongs to the shell. A service's cache stays beside its service, as `src/services/exchangeRates.ts` keeps its rates. UI state, such as whether a dialog is open, stays in the component or hook that uses it.

How each type is kept readonly, how to build a changed value, and the working value a function may change in place are in [Types and schemas](types-and-schemas.md#readonly-by-default).

## 3. Least power: use the least powerful construct that does the job

This borrows the W3C's rule of least power, which is about choosing among languages: within one language too, the less a construct can do, the more a reader and a tool can tell about what it does.

- **Reach for the weakest form that works:** a value or plain data, then a pure function, then a `switch` or a chain of conditions, then a function or an interface passed in. A handler looked up by a key at run time, `Proxy`, `eval` and calls through computed property names come last, only when nothing weaker works.
- **Handle a closed set of cases with an exhaustive `switch`** over its discriminated union, as _honest types_ writes it, ending in a `never` check, so the compiler names every `switch` a new case has to reach. `npm run lint` reports a `switch` over a union that leaves a case out, and doesn't count a `default` as handling it.
- **Don't turn a `switch` or a chain of conditions into a lookup table to shorten it or to pass a CRAP limit,** whether it's a `Map`, an object or a `Set` read at run time, and whether or not it's called a registry. It hides the branches from a reader without removing them. A table of plain values read for its value, such as region codes to currencies, is data, and a `switch` that only picks such a value may become one. A membership test, such as a `Set`'s `has`, is a branch.
- **Use a registry rarely,** a table of handlers looked up by a key at run time. It's among the most dynamic constructs here, so the problem has to need it: cases added at run time by code the module can't know about, which an interface passed in can't serve. Say in a comment beside it why nothing weaker works.
- **Prefer declarative config and plain data to code that builds the same thing at run time,** but never in place of branches, except a `switch` that only picks a plain value, as the rule above says.

```ts
// Wrong: the table hides which handler runs, and the branches it stands for.
const handlers = { add: addItem, remove: removeItem };
function reduce(state: State, action: Action): State {
  return handlers[action.kind](state, action);
}

// Right: every branch is written out, and the compiler checks there's one for each case.
function reduce(state: State, action: Action): State {
  switch (action.kind) {
    case 'add':
      return addItem(state, action);
    case 'remove':
      return removeItem(state, action);
    default: {
      const unhandled: never = action;
      return unhandled;
    }
  }
}
```

## 4. Earned complexity: pay for complexity only when a use needs it

An abstraction is a bet on how its uses will change. When a use stops fitting, putting the duplication back costs less than bending the abstraction to fit.

- **Add a layer, folder, option, parameter or injection point when a current use needs it:** a second caller that needs the same behaviour, not only similar code, or a test that can't run without it. Don't add one for a use you expect; refactoring code for a current use isn't one. One implementation behind a seam is a guess at one; two make it real, and a fake a test needs counts as one.
- **Keep code beside its one user.** [Code layout](code-layout.md) says where that is, and when the code moves. Two similar pieces of code are cheaper than the wrong shared one.
- **Default each option to what most callers want,** so a caller that doesn't need it passes nothing, as oxCrap's `counting` options count everything unless a config turns one off. [Its README](../../scripts/oxcrap/README.md) lists their defaults.

## 5. Deep modules: give each module a small interface over a lot of behaviour

A module earns its place by carrying complexity its callers would otherwise carry. A deep module is one whose small interface hides much more logic than the interface shows. It might be a program with a command line, or a simplified abstraction over complex code that callers use through a few functions.

- **Test a module by imagining it deleted.** If its complexity would reappear in each caller, it's earning its place. If the complexity would vanish with it, it's a pass-through: remove it, so callers use what it wraps. A shell module that only performs effects belongs to _core and shell_, and stays.
- **Gather what changes for the same reason, and separate what changes for different reasons** (single responsibility). A reason is whoever asks for the change, such as whoever sets the receipt's rules, runs the sync, or designs the screens. If two of them would each ask for changes to one module, split it along that line. This is about modules, not about a function doing one thing.
- **Its interface is everything a caller relies on:** its exports and types, and also the invariants it keeps and the errors it can raise. Test it through that interface. A test of the module that has to reach past its interface means the module has the wrong shape. A module inside it is tested through its own interface, which isn't reaching past.
- **Anything that implements an interface keeps the contract its callers rely on,** not only its types: the invariants and errors the interface promises (Liskov substitution). A fake in a test keeps the part the code under test relies on.
- **Put a stable interface where variation is real,** and pass the implementation in (open-closed, read as protected variation, narrowed to variation that's there). Variation is real when there are two or more implementations, a test's fake among them. Move a closed set from _least power_'s `switch` to an interface when the same `switch` over the same union recurs in two or more modules, or when a second implementation of those cases lives outside the module. `RoomProvider` shows both sides: callers depend on its interface, and tests fake it, while inside `createProvider` conditions on one closed choice pick the backend, within one module.
- **An error says what went wrong and what to do about it.** Whoever reads it, a person or an agent, acts on its words.

## 6. Honest types: let the types rule out states that can't happen

A value that can't be invalid needs no check where it's used.

- **Write alternatives as a discriminated union,** with a discriminator field, such as `status` or `kind`, that names which case a value is. Don't use booleans and optional fields that could contradict each other. Use a union for a value's state or kind even when there are two cases, so a third needs no change of shape. A boolean is fine for a plain yes-or-no fact.
- **Don't make a caller choose what a function does by passing a literal `true` or `false`** (a flag argument). Write two functions, or take a member of a union whose name says which. A boolean passed through from data, such as a checkbox's value, is fine.
- **Parse input where it enters the program,** into a type that guarantees it's valid, and pass that type on, rather than checking the raw value again where it's used. [Types and schemas](types-and-schemas.md#ids-and-the-strings-built-from-them) says how, for ids.

```ts
// Wrong: nothing stops `loading` and `error` from both being set.
type Rate = { readonly loading: boolean; readonly error?: string; readonly value?: number };

// Right: each state carries only what's true in it.
type Rate =
  | { readonly status: 'loading' }
  | { readonly status: 'failed'; readonly error: string }
  | { readonly status: 'ready'; readonly value: number };
```

## When two principles pull apart

- **Core and shell wins over earned complexity for a business rule,** which goes in `src/domain/` even with one user, as [Code layout](code-layout.md) says.
- **Least power and deep modules split a set of cases by where it varies.** A closed set handled in one module is a union with a `switch`. When the same `switch` recurs across modules, or a second implementation of those cases lives outside the module, it's an interface. A registry comes after both, as _least power_ says.
- **Earned complexity gives way to true inversion for a collaborator of code inverted for a collaboration test:** it's a parameter even while it's passed in real, before it has tests of its own, because the collaboration test earns the parameters as a set, and one composition root wires them all, as [When a collaboration test earns its cost](testing/collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) says.
- **A collaborator, store or service of code inverted for a collaboration test has no default,** even an effect such as a browser global, so earned complexity's "default each option" doesn't apply to it: its composition root passes it in, as [Collaboration and contract tests](testing/collaboration-testing-conventions.md#collaboration-and-contract-tests) says. The interface it's declared by is a type the code owns, not a seam earned complexity or deep modules counts, even with one implementation behind it. Code not inverted for one, such as a hook, may still default a browser global, as [Code layout](code-layout.md) says.
- **Passing an effect in, as core and shell asks, isn't a parameter or an injection point that earned complexity counts,** and needs no justification under it. An injection point lets a caller swap a whole collaborator, as a container's slots do for the [collaboration test](testing/collaboration-testing-conventions.md#collaboration-and-contract-tests) that collaboration testing conventions describe. Add one only when _earned complexity_'s test is met, which for a collaboration test is [When a collaboration test earns its cost](testing/collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost).

## Changing this document

Where each principle comes from, the sources behind it, and why the document is written the way it is are in [code-design-principles.meta.md](code-design-principles.meta.md). Read it only when changing or questioning a principle here.
