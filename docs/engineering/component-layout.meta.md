# Component layout: reasons

The reasons for [Component layout](component-layout.md)'s rules.

## Where the rules came from

- **The container lays out its slots, and a slot's component owns only what's inside its border,** as the owner asked on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7221567617)): "I want RoomView to be responsible for the layout (not their styling) of it's constituent slots and the real components that fill the slots should have zero responsiblitie of their own layout (margin padding display ect) aroudn their root element", then "RoomViewRoot owns layout not RoomView", and "padding should be the responsitibity of the component iteself and should be considere'd internal layout since it's inside the border and boxshadow".
  - **The component owns its root's whole `display`,** as the owner chose on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7223464456)), after research. The owner's first message had listed display among what a component mustn't own around its root.
  - **Padding with no border around it is spacing outside the component,** so the banner, which has none, lost its padding to its caller's spacing.
  - **`mergeClasses` wraps `tailwind-merge` 2.6.1,** which the owner approved on #169, so a caller's utility wins over a component's own one it conflicts with. It's behind one helper so it can be swapped, as the owner said: "since it's behind a mergeClasses facad we'll be able to change it out without having to update a lot of code". Tailwind v4, and `tailwind-merge`'s 3.x line, are [#172](https://github.com/DetweilerRyan/split/issues/172).
- **A document of its own,** as the owner chose on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7223464456)), since layout is about how components are written, not how they're tested. It was first part of component and hook testing's container rule.

## Why the component owns its root's whole `display`

- **CSS splits `display` in two.** The outer type "dictates how the principal box itself participates in flow layout", and the inner type sets "how its descendant boxes are laid out" ([CSS Display Module Level 3](https://www.w3.org/TR/css-display-3/), checked 2026-11-27). `flex` is `block flex`.
- **`none` is neither,** since "Elements with either of these values do not have inner or outer display types". So hiding is a separate question from layout, which is why it's the caller's.
- **The outer type rarely matters here:** a flex or grid container blockifies its children's `display` ([CSS Flexbox Level 1](https://www.w3.org/TR/css-flexbox-1/), checked 2026-11-27), and the room's slots sit in grid and flex parents.
- **Tailwind can't split it.** Its display utilities are single keywords, such as `flex` and `inline-flex` ([Tailwind's display docs](https://tailwindcss.com/docs/display), checked 2026-11-27), and no issue or discussion in its repository proposes outer-only utilities. `tailwind-merge` puts every display value in one group, so a caller's `block` would replace a component's `flex` entirely.
- **Sources hand spacing, not `display`, to the parent:**
  - Max Stoiber: "A component should not affect anything outside it's own visual boundaries" ([Margin considered harmful](https://mxstbr.com/thoughts/margin), 2020).
  - SEEK's Braid: "components should not provide surrounding white space", and things are hidden "by wrapping them with the Hidden component" ([Layout](https://seek-oss.github.io/braid-design-system/foundations/layout)).
  - Every Layout says a flex or grid element "changes the way its child elements behave" ([Boxes](https://every-layout.dev/rudiments/boxes/)).
- **Component libraries put `display` on the root:** shadcn/ui's Card root is `cn("flex flex-col gap-6 … py-6 …", className)`, and Radix Themes sets `display` as a default a caller may override.
- **The counter-position:** Brad Frost's layout context overrides a component's `display` ([Layout & Grid in Design Systems](https://bradfrost.com/blog/post/layout-grid-in-design-systems/), 2022). The rule keeps that only as hiding, or as a variant the component offers.

## What would reopen this

- **Tailwind gains outer-only display utilities,** or a caller keeps needing to change a component's outer type.
- **A lint rule guards these rules** once [#175](https://github.com/DetweilerRyan/split/issues/175) lands; this document would then point to it.
