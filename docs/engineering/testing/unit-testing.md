# Unit testing

This document holds the rules for tests in Vitest's `unit` project, which [Which project a test belongs in](testing-conventions.md#which-project-a-test-belongs-in) describes. The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for the `unit` project's tests, and how any test replaces a dependency.

- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.
- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a unit test, the whole value:

  ```ts
  // ✅ Specific: each share, in minor units
  expect(allocateMinor(1000, [1, 1, 1])).toStrictEqual([334, 333, 333]);

  // ❌ Vague: some shares came back
  expect(allocateMinor(1000, [1, 1, 1]).length).toBeGreaterThan(0);
  ```

## Replacing external dependencies

- **Fake only what can't run in a test,** and fake it at the edge: the network, storage, or a third-party service. Let the app's own logic (Yjs documents, claim math, seed validation) run for real. Don't fake something just to make a test faster.
- **Prefer passing the dependency in.** When code takes its provider, client, clock or fetcher as a parameter, as [_core and shell_](../code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it) asks of code that decides, a test can hand it a plain fake object with no mocking at all. Design other new code this way too, where it costs little.
- **`vi.fn()` is fine for a fake's methods** and for a component's callback props, when the test needs to check how they were called.
- **Use `vi.mock` only for a third-party module the code imports directly** and can't reasonably take as a parameter, as `src/sync/yjsProvider.test.ts` does for Liveblocks, `y-webrtc` and `y-indexeddb`. Never mock React or its hooks. Never `vi.mock` the repository's own modules; test them for real.

## Changing this document

The reasons for these rules are in [unit-testing.meta.md](unit-testing.meta.md). Read it only when changing or questioning a rule here.
