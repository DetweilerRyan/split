# Code design principles

Four principles for deciding how code is shaped here. Each says how to decide, with the reason, so it applies to cases nothing below names. The rules that enforce parts of them live in the documents each one links to.

Apply them to the code your task writes or changes. Don't reshape other code to fit them unless the task asks.

## 1. Keep essential logic apart from accidental machinery

Essential logic is the business rule itself: how a receipt splits, rounds and converts. Test it by asking whether the rule would exist with no React, no Yjs and no network. If it would, it's essential.

- **Write essential logic as pure functions over plain data, in `src/domain/`,** named in the words users use, such as receipt, item, claim, participant and share.
- **Keep accidental machinery in the shell:** UI, sync, storage and outside services. A condition in the shell is one that wouldn't exist without them, such as whether a request failed or a dialog is open. Any other condition is essential logic.
- **Keep effects out of the code that decides.** The shell performs them, and passes their results, or the effect itself, in as arguments. Pure essential logic then needs no fakes, and the rest is tested with plain fakes.
- **A business decision your change adds or edits in a component or hook goes in the domain,** and the UI calls it.

```ts
// Wrong: the rule lives in the component, where only the UI's tests reach it.
const share = item.claims.length > 0 ? item.amount / item.claims.length : 0;

// Right: the component calls the domain's rule.
const share = itemShare(item);
```

Where code goes is in [Code layout](code-layout.md), and what each layer may import is in [Dependency direction](dependency-direction.md). How to pass a fake in a test is in [Testing conventions](testing-conventions.md#replacing-external-dependencies).

## 2. Keep state minimal, immutable and contained

State is what makes code hard to follow, so keep as little of it as the task allows.

- **Don't store a value you can compute from other state.** Derive it where it's read, unless a reader needs a stable cached value, as the snapshot `ReceiptStore` gives `useSyncExternalStore` does.
- **Write functions over plain data, not classes, and don't use `this`.** Keep state in a function's parameters, or in a factory that closes over it and returns an object of functions, as `createActor` in [`e2e/screenplay/actor.ts`](../../e2e/screenplay/actor.ts) does. An `Error` subclass may be a class. `npm run lint` enforces this through the local oxlint plugin [`scripts/lint/functional.ts`](../../scripts/lint/functional.ts).
- **State that must outlive a call belongs in the shell** of principle 1, behind one module, as `ReceiptStore` holds the room's Yjs document.
- **`ReceiptStore` keeps its class,** as the owner decided on [#83](https://github.com/DetweilerRyan/split/issues/83). Keeping any other class needs the owner's approval. Disable `functional/no-classes` on the class's line, with the reason.

How each type is kept readonly, how to build a changed value, and the working value a function may change in place are in [Types and schemas](types-and-schemas.md#readonly-by-default).

## 3. Use the least powerful construct that does the job

The less a construct can do, the more a reader and a tool can tell about what it does.

- **Reach for the weakest form that works:** a value or plain data, then a pure function, then a `switch` or a chain of conditions, then a function passed in. Dynamic dispatch, `Proxy`, `eval` and calls through computed property names come last, only when nothing weaker works.
- **Don't turn a `switch` or a chain of conditions into a lookup table.** It hides the branches from a reader, and oxCrap still counts them. [CRAP score](crap.md#responding-to-a-finding) says what counts as one.
- **Prefer declarative config and plain data to code that builds the same thing at run time,** but never in place of branches, as the rule above says.

```ts
// Wrong: which handler runs is decided at run time, out of sight.
const handlers = { add: addItem, remove: removeItem };
handlers[action.kind](state, action);

// Right: every branch is written out.
switch (action.kind) {
  case 'add':
    return addItem(state, action);
  case 'remove':
    return removeItem(state, action);
}
```

## 4. Pay for complexity only when a use needs it

An abstraction made before its second use is a guess, and a wrong one costs more to undo than duplication does.

- **Add a layer, folder, option, parameter or injection point when a current use needs it:** a second caller, or a test that can't run without it. Don't add one for a use you expect.
- **Keep code beside its one user.** [Code layout](code-layout.md) says where that is, and when the code moves. Two similar pieces of code are cheaper than the wrong shared one.
- **Default each option to the simple case,** so a caller that doesn't need it passes nothing, as oxCrap's `counting` options do. [Its README](../../scripts/oxcrap/README.md) lists their defaults.

## When two principles pull apart

- **Principle 1 wins over principle 4 for a business rule,** which goes in `src/domain/` even with one user, as [Code layout](code-layout.md) says.
- **Passing an effect in, as principle 1 asks, isn't a parameter or an injection point that principle 4 counts.** An injection point lets a caller swap a whole part, as `RoomView`'s `parts` do, by the owner's exception in [Testing conventions](testing-conventions.md#writing-component-and-hook-tests). Add one only when principle 4's test is met.

## Changing this document

Where each principle comes from, the sources behind it, and why the document is written the way it is are in [code-design-principles.meta.md](code-design-principles.meta.md). Read it only when changing or questioning a principle here.
