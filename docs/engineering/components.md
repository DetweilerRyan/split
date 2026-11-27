# Components

How a React component is written: who places it and how it looks, and how a container component takes the components it renders. Tests of components follow [Component and hook testing](testing/component-and-hook-testing.md).

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

- **Take the components through a `slots` prop,** as MUI names such a prop, once the container earns a collaboration test. Before then, render the real components directly.
- **Prefer an element slot,** `children` or another prop typed `ReactNode`, which takes what the caller already rendered. It's the least powerful seam, as the conventions' [least power rule](testing/collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) asks.
- **Use a render-function slot** only when the container renders the component with props it computes. Type it as a function of only those props, such as `(props: { readonly title: string; readonly onShare: () => void }) => ReactNode`.
- **A render function only returns elements of components defined outside it, and calls no hooks.** The container may call it conditionally, and the React Compiler may skip a call, so a hook inside it breaks React's rules of hooks. A component created inside it would remount on every render, losing its state.
- **Call hooks directly, and let them run for real.** React's rules forbid passing a hook around as a value, so a hook is something the code can't take as a parameter.
- **Take the container's store and services as props,** typed by interfaces it declares, which its hooks' own narrower interfaces must fit. That holds whether it calls them or hands them to its hooks.
- **Name a container `<Name>.tsx`, and its composition root `<Name>.root.tsx`,** exporting `<Name>Root`. The root is the container's only caller, and only the end-to-end tests run it.
- **Render the real components in the composition root's render functions.** Add there any props the container doesn't compute, so the container's slot types needn't list them.
- **Bind a nested container in its slot's render function,** by rendering it with its own slots and dependencies, such as `(props) => <Nested {...props} slots={nestedSlots} />`. A nested container has no root file: its parent's root binds it.
- **A container may import a context that a slot's component reads,** to provide it. The context may live in the component's module or a module of its own. The context doesn't fill the slot.
- **A browser global a hook defaults,** such as `location`, isn't one of the container's services.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [components.meta.md](components.meta.md). Read it only when changing or questioning a rule here.
