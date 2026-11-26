# Component and hook testing

The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for component and hook tests.

Use [`vitest-browser-react`](https://github.com/vitest-community/vitest-browser-react) and Vitest's browser API, `vitest/browser`. Copy the pattern in `app/r/[room]/_room-view/IdentityModal.browser.test.tsx`.

- **Check what a user can see and do.** A component has two users: the person using the app, and the developer rendering it. So a component test works only through the component's props and its rendered output. Don't assert on state, internal functions, how many times something rendered, or CSS classes.
- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a component, the button by its accessible name, or the full message:

  ```ts
  // ✅ Specific: the message the user reads
  await expect.element(screen.getByText('Add the first person to this receipt.')).toBeVisible();

  // ❌ Vague: some element with a class is on the page
  expect(screen.container.querySelector('.text-slate-500')).not.toBeNull();
  ```

- **Render with `render` from `vitest-browser-react`,** and import the app's stylesheet (`import '../index.css'`) so that visibility reflects the real styles. Cleanup is automatic.
- **Find elements as a user would.** Use `getByRole` with the accessible name first. When no role fits, use, in this order: `getByLabelText`, `getByPlaceholder`, `getByText`, `getByAltText`, `getByTitle`. Use `getByTestId` only when none of these can find the element. If an element can't be found by role, check whether the component is missing an accessible name or role, and fix the component.
- **Interact with `userEvent` from `vitest/browser`.** Don't add `@testing-library/user-event`, and don't dispatch DOM events by hand.
- **Assert with `await expect.element(locator)`.** It retries until the assertion passes or times out, so don't add waits, sleeps or retry loops of your own. Keep actions such as clicks outside the assertion.
- **Assert absence with `await expect.element(locator).not.toBeInTheDocument()`.**
- **Don't wrap calls in React's `act`.** Rendering and `userEvent` already handle it. The one exception is the `act` that `renderHook` returns, which you use to call a hook's own functions.
- **Test a hook through the component that uses it.** Use `renderHook` from `vitest-browser-react` instead only when the hook is complex enough that a component would obscure it, or when several components share it. `app/r/[room]/_room-view/useActiveIdentity.browser.test.ts` is an example.
- **Replace a dependency as [unit testing](unit-testing.md#replacing-external-dependencies) says.**
- **`RoomView` is the exception to both rules above it and to [faking only what can't run](unit-testing.md#replacing-external-dependencies).** Its hooks are tested on their own with `renderHook`, and its own test passes fake components through its `parts` prop and fakes of its `services`, checking only how it wires them together, as the owner decided on [#93](https://github.com/DetweilerRyan/split/issues/93#issuecomment-7122174580). Its hooks aren't passed in: it calls the real ones.
- **A component's callback props are part of what it shows its developer user.** Checking that `onSelect` was called with the chosen id is fine. Checking which internal function ran is not.
- **Tests run through the React Compiler,** as the app build does. Don't remove the compiler from `vitest.config.ts`; `vitest.config.browser.test.ts` fails if a component stops being compiled.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [component-and-hook-testing.meta.md](component-and-hook-testing.meta.md). Read it only when changing or questioning a rule here.
