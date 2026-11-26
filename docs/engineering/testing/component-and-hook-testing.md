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

- **A container component's parts are its collaborators,** as [Collaboration and contract tests](testing-conventions.md#collaboration-and-contract-tests) describes. A component whose job is to call hooks and render parts that each have tests of their own, such as `RoomView`, takes its parts through a `parts` prop, each typed `ComponentType<ComponentProps<typeof Part>>` and defaulting to the real part. Its collaboration test passes fake parts through `parts`, with fakes of the services it calls, and checks which props each part gets and which handler a part's callback reaches.
- **A container's hooks aren't collaborators.** React's rules forbid passing a hook around as a value, so a container calls its real hooks. Its collaboration test sees a hook's work only through the props a fake part gets, so each of its hooks is tested on its own with `renderHook`.

## Rules of its own

### When to write one

[What a test checks](testing-conventions.md#what-a-test-checks) in testing conventions says when a function is worth testing on its own. When a hook gets a `renderHook` test of its own is in [Writing one](#writing-one).

### Writing one

Use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API, `vitest/browser`. Copy the pattern in `app/r/[room]/_room-view/IdentityModal.browser.test.tsx`.

- **Check what a user can see and do.** A component has two users: the person using the app, and the developer rendering it. So a component test works only through the component's props and its rendered output. Don't assert on state, internal functions, how many times something rendered, or CSS classes.
- **A component's callback props are part of what it shows its developer user.** Checking that `onSelect` was called with the chosen id is fine. Checking which internal function ran is not.
- **Render with `render` from `vitest-browser-react`,** and import the app's stylesheet (`import '../index.css'`) so that visibility reflects the real styles. Cleanup is automatic.
- **Interact with `userEvent` from `vitest/browser`.** Don't add `@testing-library/user-event`, and don't dispatch DOM events by hand.
- **Assert with `await expect.element(locator)`.** It retries until the assertion passes or times out, so don't add waits, sleeps or retry loops of your own. Keep actions such as clicks outside the assertion.
- **Assert absence with `await expect.element(locator).not.toBeInTheDocument()`.**
- **Don't wrap calls in React's `act`.** Rendering and `userEvent` already handle it. The one exception is the `act` that `renderHook` returns, which you use to call a hook's own functions.
- **Test a hook through the component that uses it.** Use `renderHook` from `vitest-browser-react` instead only when the hook is complex enough that a component would obscure it, when several components share it, or when it belongs to a container, as above. `app/r/[room]/_room-view/useActiveIdentity.browser.test.ts` is an example.
- **Tests run through the React Compiler,** as the app build does. Don't remove the compiler from `vitest.config.ts`; `vitest.config.browser.test.ts` fails if a component stops being compiled.

### When one fails

[Fixing a bug](testing-conventions.md#fixing-a-bug) in testing conventions applies as written.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [component-and-hook-testing.meta.md](component-and-hook-testing.meta.md). Read it only when changing or questioning a rule here.
