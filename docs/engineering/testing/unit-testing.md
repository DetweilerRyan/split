# Unit testing

## What this kind of test is

A test in Vitest's `unit` project, as [the project table](testing-conventions.md#which-project-a-test-belongs-in) in testing conventions describes it. Its file is `<module>.test.ts` or `<module>.test.tsx`, beside the module it covers.

## How the conventions apply

[Testing conventions](testing-conventions.md) apply as written, with this for the `unit` project's tests:

- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a test in the `unit` project, the whole value:

  ```ts
  // ✅ Specific: each share, in minor units
  expect(allocateMinor(1000, [1, 1, 1])).toStrictEqual([334, 333, 333]);

  // ❌ Vague: some shares came back
  expect(allocateMinor(1000, [1, 1, 1]).length).toBeGreaterThan(0);
  ```

## Rules of its own

### When to write one

[What a test checks](testing-conventions.md#what-a-test-checks) in testing conventions says when a function is worth testing on its own.

### Writing one

- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.

### When one fails

[Fixing a bug](testing-conventions.md#fixing-a-bug) in testing conventions applies as written.

## Changing this document

The reasons for these rules are in [unit-testing.meta.md](unit-testing.meta.md). Read it only when changing or questioning a rule here.
