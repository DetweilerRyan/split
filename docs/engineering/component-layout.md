# Component layout

Who decides where a component sits, and who decides how it looks. A component that's placed by its caller can be reused anywhere, and its caller can arrange the page without editing it.

## The rules

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
- **A container places the slots it renders.** It places each with its own wrapper's spacing, or with a `className` it passes. [Component and hook testing](testing/component-and-hook-testing.md) says how a container's slots work.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [component-layout.meta.md](component-layout.meta.md). Read it only when changing or questioning a rule here.
