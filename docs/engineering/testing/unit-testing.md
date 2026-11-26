# Unit testing

## What a unit test is

A unit test checks logic with no React, such as the receipt math, seed codecs, stores and server code, through the functions that use it. It runs in Vitest's `unit` project, in jsdom. Its file is `<module>.test.ts` or `<module>.test.tsx`, beside the module it covers, as [the project table](testing-conventions.md#which-project-a-test-belongs-in) in testing conventions sets.

## How the conventions apply

[Testing conventions](testing-conventions.md) apply as written, with this for unit tests:

- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a unit test, the whole value:

  ```ts
  // ✅ Specific: each share, in minor units
  expect(allocateMinor(1000, [1, 1, 1])).toStrictEqual([334, 333, 333]);

  // ❌ Vague: some shares came back
  expect(allocateMinor(1000, [1, 1, 1]).length).toBeGreaterThan(0);
  ```

## Rules for unit tests

- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.

## Changing this document

The reasons for these rules are in [unit-testing.meta.md](unit-testing.meta.md). Read it only when changing or questioning a rule here.
