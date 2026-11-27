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

- **A container component's slots are its collaborators,** as [Collaboration and contract tests](collaboration-testing-conventions.md#collaboration-and-contract-tests) describes. [When a collaboration test earns its cost](collaboration-testing-conventions.md#when-a-collaboration-test-earns-its-cost) says when a component is worth making one. [Containers](../components.md#containers) in components says how a container is written.
  - **A container's composition root,** its `.root.tsx`, gets no browser test of its own: only the end-to-end tests run it.
  - **Its collaboration test** passes render functions of fakes. It checks which props each slot is called with, and which handler its callback reaches.
  - **A React context a slot's real component reads** is part of what the component relies on. The type checker can't see it, so the component's contract tests cover it.
- **A container's hooks are collaborators it can't take as parameters,** as [Containers](../components.md#containers) says. So a container calls its real hooks, and they run for real in its collaboration test. That test sees a hook's work only through:
  - the props a slot is called with;
  - the calls a fake service, or the fakes under a real one, receive.

  So each custom hook the container calls from its folder gets a test of its own, with `renderHook`.

- **A container's store and services run for real in its test where they can,** as [Collaboration and contract tests](collaboration-testing-conventions.md#collaboration-and-contract-tests) says. [Containers](../components.md#containers) says how a container takes them.

## Rules of its own

### When to write one

[What a test checks](testing-conventions.md#what-a-test-checks) in testing conventions says when a function is worth testing on its own. When a hook gets a `renderHook` test of its own is in [Writing one](#writing-one).

### Writing one

Use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API, `vitest/browser`.

A test of a component looks like this:

```tsx
const onJoin = vi.fn();
const screen = await render(<JoinForm onJoin={onJoin} />);
await userEvent.fill(screen.getByRole('textbox', { name: 'Your name' }), 'Ana');
await userEvent.click(screen.getByRole('button', { name: 'Join' }));
expect(onJoin).toHaveBeenCalledExactlyOnceWith('Ana');
await expect.element(screen.getByRole('textbox', { name: 'Your name' })).toHaveValue('');
```

- **Check what a user can see and do.** A component has two users: the person using the app, and the developer rendering it. So a component test works only through the component's props and its rendered output. Don't assert on state, internal functions, how many times something rendered, or CSS classes.
- **A component's callback props are part of what it shows its developer user.** You may check that `onSelect` was called with the chosen id. Don't check which internal function ran.
- **Render with `render` from `vitest-browser-react`.** Cleanup is automatic.
- **Rely on the browser project's setup file for the app's stylesheet,** which `vitest.config.ts` runs before every test, so visibility reflects the real styles. Don't import the stylesheet in a test.
- **Interact with `userEvent` from `vitest/browser`.** Don't add `@testing-library/user-event`, and don't dispatch DOM events by hand.
- **Assert with `await expect.element(locator)`.** It retries until the assertion passes or times out, so don't add waits, sleeps or retry loops of your own.
- **Keep actions, such as clicks, outside the assertion.**
- **Assert absence with `await expect.element(locator).not.toBeInTheDocument()`.**
- **Don't wrap calls in React's `act`.** Rendering and `userEvent` already handle it. The one exception is the `act` that `renderHook` returns, which you use to call a hook's own functions.
- **Test a hook through the component that uses it.** Use `renderHook` from `vitest-browser-react` instead only in one of these cases:
  - the hook is complex enough that a component would obscure it;
  - several components share it;
  - it belongs to a container, as above.
- **Tests run through the React Compiler,** as the app build does. Don't remove the compiler from `vitest.config.ts`; `vitest.config.browser.test.ts` fails if a component stops being compiled.

### When one fails

[Fixing a bug](testing-conventions.md#fixing-a-bug) in testing conventions applies as written.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [component-and-hook-testing.meta.md](component-and-hook-testing.meta.md). Read it only when changing or questioning a rule here.
