# Unit testing

This document holds the rules for tests in Vitest's `unit` project, which [Which project a test belongs in](testing-conventions.md#which-project-a-test-belongs-in) describes. The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for the `unit` project's tests.

- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.
- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a unit test, the whole value:

  ```ts
  // ✅ Specific: each share, in minor units
  expect(allocateMinor(1000, [1, 1, 1])).toStrictEqual([334, 333, 333]);

  // ❌ Vague: some shares came back
  expect(allocateMinor(1000, [1, 1, 1]).length).toBeGreaterThan(0);
  ```

## Changing this document

The reasons for these rules are in [unit-testing.meta.md](unit-testing.meta.md). Read it only when changing or questioning a rule here.
