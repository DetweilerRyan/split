# Components: reasons

The reasons for [Components](components.md)' rules.

## Layout: where the rules came from

- **The container lays out its slots, and a slot's component owns only what's inside its border,** as the owner asked on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7221567617)): "I want RoomView to be responsible for the layout (not their styling) of it's constituent slots and the real components that fill the slots should have zero responsiblitie of their own layout (margin padding display ect) aroudn their root element", then "RoomViewRoot owns layout not RoomView", and "padding should be the responsitibity of the component iteself and should be considere'd internal layout since it's inside the border and boxshadow".
  - **The component owns its root's whole `display`,** as the owner chose on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7223464456)), after research. The owner's first message had listed display among what a component mustn't own around its root.
  - **Padding with no border around it is spacing outside the component,** so the banner, which has none, lost its padding to its caller's spacing.
  - **`mergeClasses` wraps `tailwind-merge` 2.6.1,** which the owner approved on #169, so a caller's utility wins over a component's own one it conflicts with. It's behind one helper so it can be swapped, as the owner said: "since it's behind a mergeClasses facad we'll be able to change it out without having to update a lot of code". Tailwind v4, and `tailwind-merge`'s 3.x line, are [#172](https://github.com/DetweilerRyan/split/issues/172).
- **A document of its own,** first `component-layout.md`, as the owner chose on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7223464456)), since layout is about how components are written, not how they're tested. It was first part of component and hook testing's container rule.

## Layout: why the component owns its root's whole `display`

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

## Containers

- **Moved here from component and hook testing,** with React's specifics from collaboration testing conventions, as the owner asked on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7224537910)): "i am interested in the collaboration-tsting-conventions doc staying general and avoiding coupling itself to react components or hooks while components.md can reference collaboration-testing-conventions.md and provide specifics". Component and hook testing keeps how a container is tested.
- **Hooks are called directly** for React's rules of hooks, quoted in [component and hook testing's sidecar](testing/component-and-hook-testing.meta.md).
- **A container is `<Name>.tsx`, and its composition root `<Name>.root.tsx`,** as the owner chose on #169. In review the owner first proposed the container as `<component>.root.tsx` ([comment](https://github.com/DetweilerRyan/split/pull/169#discussion_r4721563160)), and invited push-back; the session pointed out that "root" already means the composition root in these documents. The owner then asked for it the other way round, and chose it ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7224190409)).
  - **`.root` reads like the other file infixes** (`.test`, `.meta`, `.browser`): the composition root is about its container, wiring it and holding no logic.
  - **The names reversed what the owner chose earlier,** when the composition root was `RoomView` and the container `RoomViewRoot`, so that "root" means one thing.
  - **A nested container has no root file,** since its parent's root binds it.
- **Slots, not parts,** as the owner asked in review: "we should probably use the term slots instead of parts to be more inline with the broader react community" ([comment](https://github.com/DetweilerRyan/split/pull/159#discussion_r4711932004)). MUI names the prop that takes the components a caller passes in `slots`, and React's docs liken elements passed as props, such as `left={<Contacts />}`, to "slots" in other libraries ([Composition vs Inheritance](https://legacy.reactjs.org/docs/composition-vs-inheritance.html)). `RoomView`'s prop was renamed in #165.

### React's own reasons, moved from collaboration testing conventions' sidecar

- **Precedent in React is partial:** react-select types its `Option` slot as a component of `OptionProps`, the props it passes ([react-select components](testing/testing-conventions.meta.md#react-select-components)), but imports that type from the real `Option`'s module and defaults to the real components. It's precedent for typing a slot by what's passed to it, not for no defaults; no React library the research found has a slot with no default.
- **A prop, not context:** React's docs say to start by passing props, which make "the data flow explicit", before context ([Passing Data Deeply with Context](testing/testing-conventions.meta.md#react-context)), and Kent C. Dodds says "Don't reach for context too soon!" ([Application State Management with React](testing/testing-conventions.meta.md#kcd-state-management)). React Redux removed the `store` prop in v6 and brought it back in v7 because "Some users expressed concerns that working with context in unit tests was not sufficient" ([v7.0.1](testing/testing-conventions.meta.md#react-redux-701)).
- **Context is the other way to inject a store,** sharing "the store instance via React Context - not the store values themselves" ([Zustand and React Context](testing/testing-conventions.meta.md#tkdodo-zustand-context)), advice for app code with a deep tree. A container one level below its composition root can take a prop, as React's docs advise first.
- **A mutable store prop fits React's rules:** they say "A component's props and state are immutable snapshots. Never mutate them directly" ([Components and Hooks must be pure](testing/testing-conventions.meta.md#react-pure)). A store prop's identity stays the same, its methods run outside render, in event handlers and effects, and render reads it only through `useSyncExternalStore`, React's hook for subscribing to an external store, which says "If the underlying store has mutable data, return a new immutable snapshot" ([useSyncExternalStore](testing/testing-conventions.meta.md#react-use-sync-external-store)), as `useReceiptStore` does.
- **Why slots and not hooks:** React's docs sanction components passed as props and children, like slots in other libraries ([Composition vs Inheritance](testing/testing-conventions.meta.md#react-composition)), and forbid passing hooks as values, naming dependency injection through a hook prop as the thing not to do ([React calls Components and Hooks](testing/testing-conventions.meta.md#react-rules-hooks)). So a container's slots are collaborators, and its hooks aren't.
- **The least powerful seam:** _least power_ ranks plain data before an interface passed in. React elements are plain objects that can be passed as props, which React likens to slots ([Composition vs Inheritance](testing/testing-conventions.meta.md#react-composition)), so an element slot is a seam the code only places, never calls, with no interface beyond `ReactNode`; a component slot is an interface passed in.

## Code design principles

- **Asked for by the owner on #169** ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7224950578)): "make sure the new components doc mentions specifics of how each code design principle is applied".
- **Each bullet applies a principle, and links to it rather than restating it,** so the principle stays the one source of its reason.
- **The applications are React's usual ones:** deriving state during render, and not mirroring props into state, are what React's docs advise in [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect) and [Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure).

## Review against this document

- **Asked for by the owner on #169** ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7225318267)), after a review of the room's code against this document: "go with your recommendation".
- **A `className` only when a caller places the component:** the rule first read as applying to every component, so every slot component of the room took one, and only the app bar was given one. Earned complexity asks for a prop a current caller needs.

## Research into the review's open questions

The owner asked for web research on seven questions the review left open, and chose on #169 ([recorded](https://github.com/DetweilerRyan/split/pull/169#issuecomment-7225941414)).

- **One page column, used by the page and inside a full-width bar.** GOV.UK puts its `govuk-width-container` inside its full-width header and around `<main>` ([Layout](https://design-system.service.gov.uk/styles/layout/)). MUI's and Radix's `Container`, Braid's `PageBlock` and Bootstrap's navbar container do the same.
  - **A class, not a component,** as _least power_ asks: it only sets classes, as `.card` does.
  - **Not taken:** the page passing its column into the bar, which GOV.UK offers only as an override (`containerClasses`); and full-bleed grids or subgrid, which need the bar inside the page's grid.
- **Separate props, not a `Pick`.** React's docs allow either for style ([Passing Props](https://react.dev/learn/passing-props-to-a-component)), but for rendering they advise "the minimum necessary information in its props. For example, it could accept individual values instead of a whole object" ([memo](https://react.dev/reference/react/memo)). Redux's style guide says the same of selectors.
- **A constant for a value that's the same in every deploy.** The twelve-factor app says such config "does not vary between deploys, and so is best done in the code" ([Config](https://12factor.net/config)). Testing Library tests time with fake timers ([Using Fake Timers](https://testing-library.com/docs/using-fake-timers/)). Seemann's "Primitives are dependencies, too" ([Primitive Dependencies](https://blog.ploeh.dk/2012/07/02/PrimitiveDependencies/)) is why one that varies goes with the services.
- **`| undefined` on every optional property, never on a parameter.** TypeScript's setting applies to properties only ([exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)). DefinitelyTyped's lint rule "Forbids optional parameters from including an explicit `undefined` in their type; requires it in optional properties" ([redundant-undefined](https://github.com/microsoft/DefinitelyTyped-tools/blob/main/packages/eslint-plugin/src/rules/redundant-undefined.ts)).
  - **`?: T` where presence matters:** TkDodo says "The important part is to know the difference and be explicit about intent" ([Optional vs. undefined](https://tkdodo.eu/blog/optional-vs-undefined)).
- **Dialogs, an `open` prop or conditional rendering,** went to [#177](https://github.com/DetweilerRyan/split/issues/177) rather than a rule here.
- **Simple collaborators** are defined in [collaboration testing conventions' sidecar](testing/collaboration-testing-conventions.meta.md#when-a-collaboration-test-earns-its-cost).

## What would reopen this

- **Tailwind gains outer-only display utilities,** or a caller keeps needing to change a component's outer type.
- **A lint rule guards these rules** once [#175](https://github.com/DetweilerRyan/split/issues/175) lands; this document would then point to it.
