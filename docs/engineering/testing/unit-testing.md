# Unit testing

A unit test is one in Vitest's `unit` project: logic with no React, run in jsdom, as [Which project a test belongs in](testing-conventions.md#which-project-a-test-belongs-in) says. What every test checks, what it may touch, and how it replaces a dependency are in [testing conventions](testing-conventions.md).

- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [unit-testing.meta.md](unit-testing.meta.md). Read it only when changing or questioning a rule here.
