# Components

How a React component is written: who places it and how it looks, and how a container takes the components it renders. It also says how the code design principles apply to a component. Tests of components follow [Component and hook testing](testing/component-and-hook-testing.md).

## Layout

Who decides where a component sits, and who decides how it looks. A component that's placed by its caller can be reused anywhere, and its caller can arrange the page without editing it.

- **The caller places the component.** The caller owns what acts on the component from outside:
  - margin;
  - position, such as `sticky`, `absolute` or `fixed`, and its offsets;
  - width and height against the parent, such as `max-w-*` or `mx-auto`;
  - its properties as a grid or flex item, such as `col-span-*`, `self-*`, `order-*` or `grow`;
  - whether it shows at all.
- **The component owns what's inside its border:** its look, its padding, and its root's whole `display` value. A root's `flex` or `grid` arranges the component's own children.
- **Hide a component with `hidden`,** or a responsive form such as `max-md:hidden`. Never pass a component another `display` value: it replaces the component's own and breaks how it lays out its children.
- **Give a component a variant** when it must sit differently, such as inline. The caller then chooses the variant, not a `display` class.
- **Take the caller's classes as an optional `className`,** and merge them into the root last, with `mergeClasses` from `src/utils/`:

  ```tsx
  <section className={mergeClasses('card p-4', className)}>
  ```

- **Let an overlay place itself.** A dialog or a toast is fixed to the viewport, so it takes no `className` for placement.
- **A container places the slots it renders.** It places each with its own wrapper's spacing, or with a `className` it passes. [Containers](#containers) says how a container's slots work.

## Containers

A container is a component whose job is to call hooks and render components a caller passes in. It's code whose job is wiring, so [Collaboration testing conventions](testing/collaboration-testing-conventions.md) say when it earns a collaboration test and how to invert its dependencies. These rules are those conventions for React.

- **Take what the caller passes in through a `slots` prop,** as MUI names such a prop.
- **Make a slot an element,** typed `ReactNode`, when the container only places what the caller rendered, or decides only whether to show it. It's the least powerful seam, as the conventions' [least power rule](testing/collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) asks. `children` is an element slot too.
- **Make a slot a render function** only when the container renders the component with props it computes. Type it as a function of only those props, such as `(props: { readonly title: string; readonly onShare: () => void }) => ReactNode`.
- **A render function only returns elements of components defined outside it, and calls no hooks.** The container may call it conditionally, and the React Compiler may skip a call, so a hook inside it breaks React's rules of hooks. A component created inside it would remount on every render, losing its state.
- **Call hooks directly, and let them run for real.** React's rules forbid passing a hook around as a value, so a hook is something the code can't take as a parameter. That's why each custom hook a container calls gets a test of its own, as [Component and hook testing](testing/component-and-hook-testing.md) says.
- **Take the container's store and services as props,** typed by interfaces it declares, each of which must fit its hooks' own narrower ones. That holds whether it calls them or hands them to its hooks.
- **Name a container `<Name>.tsx`, and its composition root `<Name>.root.tsx`,** exporting `<Name>Root`. The root is the container's only caller. It gets no browser test of its own: only the end-to-end tests run it.
- **Render the real components in the composition root's render functions.** Add there any props the container doesn't compute, so the container's slot types needn't list them.
- **Bind a nested container in its slot's render function.** Render it with the props the outer container passes, plus its own slots and dependencies, such as `(props) => <Nested {...props} store={store} slots={nestedSlots} />`. A nested container has no root file: its parent's root binds it.
- **A container may import a context that a slot's component reads,** to provide it. It may import it from the component's own module, since the context doesn't fill the slot.
- **A browser global a hook defaults,** such as `location`, isn't one of the container's services.

## Code design principles

How each of the [code design principles](code-design-principles.md) applies to a component. The principles say why; this says what they mean for a component.

- **[Core and shell](code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it):** a component is shell.
  - **Read a business result from the domain,** such as a share or a total, rather than computing it in the component.
  - **Keep a decision about the UI only,** such as whether a dialog is open, in the component or hook. If it's more than wiring, write it as a pure function beside them.
  - **Take a store or service as a prop or hook argument,** typed by only what the component uses, rather than importing it.
- **[Contained state](code-design-principles.md#2-contained-state-keep-state-minimal-immutable-and-contained):**
  - **Derive a value from props or the snapshot during render.** Don't copy it into `useState`, which then drifts from its source.
  - **Read the room's data through the store's snapshot,** never a copy held in the component.
  - **Keep UI state in the lowest component that uses it,** and lift it only when a sibling needs it too.
  - **Type props `readonly`,** and never change a prop or the snapshot in place.
- **[Least power](code-design-principles.md#3-least-power-use-the-least-powerful-construct-that-does-the-job):**
  - **Prefer an element slot to a render function,** as [Containers](#containers) says, and a `className` to a variant.
  - **Choose what to render with JSX conditions, or a `switch` over a union.** Don't look up a component in a table by key.
  - **A `switch` that only picks a class string** may become a table of plain values.
- **[Earned complexity](code-design-principles.md#4-earned-complexity-pay-for-complexity-only-when-a-use-needs-it):**
  - **Add a prop, variant or slot when a current caller needs it,** not one you expect.
  - **Render the real components until a collaboration test earns slots,** as [When a collaboration test earns its cost](testing/collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) says.
  - **Keep a component beside its one user.** It moves to `src/components/` only once two folders import it, which `npm run lint` checks.
- **[Deep modules](code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour):**
  - **A component's interface is its props, the contexts it reads, and what the user sees and does.** Test it through those.
  - **Keep props few:** take the snapshot's fields a component needs, and compute the rest inside it, rather than having each caller compute them.
  - **Remove a component that only forwards its props** to another, so callers use the one it wraps.
  - **A container wires, and a component presents.** Split a component when two people would ask to change it for different reasons, such as the receipt's rules and the screen's design.
  - **A fake in a slot keeps the contract the container relies on,** such as calling the handler it's given.
  - **A message the user sees says what went wrong and what to do about it.**
- **[Honest types](code-design-principles.md#6-honest-types-let-the-types-rule-out-states-that-cant-happen):**
  - **Write a component's states as a discriminated union prop,** not booleans and optional props that could contradict each other.
  - **Don't make a caller choose what a component does with a literal `true` or `false`.** Take a variant named by a union member, or write two components. A boolean passed through from data is fine.
  - **Parse what the user types where it enters,** in the form's handler, and pass the parsed value to the store.
  - **Type an optional prop `?: T | undefined`,** since `exactOptionalPropertyTypes` is on, so a caller can pass a value that may be missing.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [components.meta.md](components.meta.md). Read it only when changing or questioning a rule here.
