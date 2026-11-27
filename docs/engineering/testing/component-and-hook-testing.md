# Component and hook testing

## What this kind of test is

A test of a React component or hook, in Vitest's `browser` project, as [the project table](testing-conventions.md#which-project-a-test-belongs-in) in testing conventions describes it. Its file is `<module>.browser.test.ts` or `<module>.browser.test.tsx`, beside the module it covers.

## How the conventions apply

[Testing conventions](testing-conventions.md) apply as written, with these for component and hook tests:

- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a component, the button by its accessible name, or the full message:

  ```ts
  // ✅ Specific: the message the user reads
  await expect.element(screen.getByText('Add the first person to this receipt.')).toBeVisible();

  // ❌ Vague: some element with a class is on the page
  expect(screen.container.querySelector('.text-slate-500')).not.toBeNull();
  ```

- **A container component's slots are its collaborators,** as [Collaboration and contract tests](collaboration-testing-conventions.md#collaboration-and-contract-tests) describes. That section says how to invert and test them. [When a collaboration test earns its cost](collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) says when a component is worth making one.
  - **What a container is:** a component whose job is to call hooks and render what a caller passes in. The caller passes render functions through a `slots` prop, as MUI names such a prop, and the container calls each with props it computes. Where it renders what the caller already rendered, it takes an element slot instead, as [When a collaboration test earns its cost](collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) says.
  - **Each slot's type** is a render function of only the props the container passes, such as `(props: { readonly title: string; readonly onShare: () => void }) => ReactNode`.
  - **A render function only returns elements of components defined outside it, and calls no hooks.** The container may call it conditionally, and the React Compiler may skip a call, so a hook inside it breaks React's rules of hooks. A component created inside it would remount on every render, losing its state.
  - **The container lays out its slots.** It gives each slot in the page's flow a `className` for where it sits, such as its grid placement, margin or position.
  - **A slot's component owns only what's inside its border:** its look and its padding. It puts no margin, position or width against its parent on its root. It merges the `className` it's given into its root with `mergeClasses`, from `src/utils/`.
  - **The composition root renders the real components** in the render functions it passes. It adds there any props the container doesn't compute, so the container's slot types needn't list them.
  - **A nested container** has the composition root bind it to its dependencies, in the render function for its slot.
  - **A React context a slot's real component reads** is part of what the component relies on. The type checker can't see it, so the component's contract tests cover it. The container may import that context to provide it, from the component's module or a module of its own: the context doesn't fill the slot.
  - **A browser global a hook defaults,** such as `location`, isn't one of the container's services.
  - **Its collaboration test** passes render functions of fakes, and checks which props each slot is called with and which handler its callback reaches.
  - **`RoomViewRoot` is one,** with `RoomView` as its composition root. `RoomViewRoot` declares `RoomSlots`, and `RoomView` renders the real components in them, adding what `RoomViewRoot` doesn't compute. `RoomItems` is a container nested in one of its slots.
- **A container's hooks are collaborators it can't take as parameters.** React's rules forbid passing a hook around as a value. So a container calls its real hooks, and they run for real in its collaboration test. That test sees a hook's work only through:
  - the props a slot is called with;
  - the calls a fake service, or the fakes under a real one, receive.

  So each custom hook the container calls from its folder gets a test of its own, with `renderHook`.

- **A container's store and services are dependencies it inverts too,** as [Collaboration and contract tests](collaboration-testing-conventions.md#collaboration-and-contract-tests) says. That holds whether it calls them or hands them to its hooks. The interface it declares for each must fit its hooks' own narrower ones.
  - **`RoomViewRoot` declares `RoomConnection` and `RoomServices` for them.** Its test builds a real `ReceiptStore` over an in-memory Yjs document, and its provider fakes only presence, which can't run offline. The exchange-rate service runs for real, over a fake network and cache.

## Rules of its own

### When to write one

[What a test checks](testing-conventions.md#what-a-test-checks) in testing conventions says when a function is worth testing on its own. When a hook gets a `renderHook` test of its own is in [Writing one](#writing-one).

### Writing one

Use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API, `vitest/browser`. Copy the pattern in `app/r/[room]/_room-view/IdentityModal.browser.test.tsx`.

- **Check what a user can see and do.** A component has two users: the person using the app, and the developer rendering it. So a component test works only through the component's props and its rendered output. Don't assert on state, internal functions, how many times something rendered, or CSS classes.
- **A component's callback props are part of what it shows its developer user.** You may check that `onSelect` was called with the chosen id. Don't check which internal function ran.
- **Render with `render` from `vitest-browser-react`,** and import the app's stylesheet (`import '../index.css'`) so that visibility reflects the real styles. Cleanup is automatic.
- **Interact with `userEvent` from `vitest/browser`.** Don't add `@testing-library/user-event`, and don't dispatch DOM events by hand.
- **Assert with `await expect.element(locator)`.** It retries until the assertion passes or times out, so don't add waits, sleeps or retry loops of your own.
- **Keep actions, such as clicks, outside the assertion.**
- **Assert absence with `await expect.element(locator).not.toBeInTheDocument()`.**
- **Don't wrap calls in React's `act`.** Rendering and `userEvent` already handle it. The one exception is the `act` that `renderHook` returns, which you use to call a hook's own functions.
- **Test a hook through the component that uses it.** Use `renderHook` from `vitest-browser-react` instead only in one of these cases:
  - the hook is complex enough that a component would obscure it;
  - several components share it;
  - it belongs to a container, as above.

  `app/r/[room]/_room-view/useActiveIdentity.browser.test.ts` is an example.

- **Tests run through the React Compiler,** as the app build does. Don't remove the compiler from `vitest.config.ts`; `vitest.config.browser.test.ts` fails if a component stops being compiled.

### When one fails

[Fixing a bug](testing-conventions.md#fixing-a-bug) in testing conventions applies as written.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [component-and-hook-testing.meta.md](component-and-hook-testing.meta.md). Read it only when changing or questioning a rule here.
