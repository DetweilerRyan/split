# Unit testing

A unit test is one in Vitest's `unit` project, which [Which project a test belongs in](testing-conventions.md#which-project-a-test-belongs-in) describes. The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for unit tests.

- **Don't assert on layout or visibility in the `unit` project.** jsdom does no layout, so `toBeVisible` there doesn't reflect what a user would see. Write that test in the `browser` project.

## Changing this document

The reasons for these rules are in [unit-testing.meta.md](unit-testing.meta.md). Read it only when changing or questioning a rule here.
