# Tooling testing

## What this kind of test is

A tooling test checks the repository's own dev tools: everything in `scripts/`, and root tooling config such as `.rev-dep.config.jsonc`, whose sidecar is `rev-dep.config.real.test.ts`. Tooling tests run apart from the app's, from two configs, and `npm run test:tooling` runs both. `npm test` doesn't. A tool that's a deep module also has a feature contract, which is a feature test, with its files as [A deep module that's a program](#a-deep-module-thats-a-program) below lists them.

| Project        | Config                                                                    | File name                                                     | Runs in |
| :------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------ | :------ |
| `tooling-unit` | [`vitest.tooling.config.ts`](../../../vitest.tooling.config.ts)           | every `<module>.test.ts` under `scripts/` that isn't `.real.` | Node    |
| `tooling-real` | [`vitest.tooling-real.config.ts`](../../../vitest.tooling-real.config.ts) | `<module>.real.test.ts`                                       | Node    |

A root file's test is tooling when it tests tooling config.

## How the conventions apply

[Testing conventions](testing-conventions.md) apply as written, and so do [feature testing conventions](feature-testing-conventions.md) to a tool's feature contract, with these for tooling tests:

- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a tool, everything its user gets back: the exit status and each message it prints. Here `oxcrap(args, files, times)` is `scripts/oxcrap/run.test.ts`'s helper, which runs the tool on files in memory:

  ```ts
  // ✅ Specific: the exit status and the whole message
  expect(oxcrap(args, files, times)).toEqual({ status: 1, stdout: [], stderr: [message] });

  // ❌ Vague: it failed somehow
  expect(oxcrap(args, files, times).status).not.toBe(0);
  ```

- **Name and place them as [the app's tests](testing-conventions.md#which-project-a-test-belongs-in) are:** a sidecar beside its module (`scripts/prepare-sandbox.sh` → `scripts/prepare-sandbox.real.test.ts`), `.real.` when it runs programs or touches the file system.

- **For the feature contract of [a deep module that's a program](#a-deep-module-thats-a-program),** feature testing conventions apply with these:
  - **Its screenplay is the tool's own, inside its folder,** so the tool imports nothing from outside it. A [dependency-direction](../dependency-direction.md) rule can enforce that, as one does for oxCrap.
    - **The actor's abilities** are a throwaway project folder and running the program, not a browser or an MCP session.
    - **The fixtures take no `browser` or `page`,** so Playwright never starts one.
  - **Run the program as a process, by its path,** as a developer would, and assert its exit status and the exact text it prints. Put a message longer than a step allows, or one holding double quotes, in a DocString.
  - **A scenario covers what the program as a whole does with its arguments and files.**
  - **Use the tool's own words:** for oxCrap, function, complexity, config, coverage report and `@crap-allow`. The tool's `.gplintrc` bans its module and function names, and how the test runs the program, instead of the app's words.

## Rules of its own

### When to write one

[What a test checks](testing-conventions.md#what-a-test-checks) in testing conventions says when a function is worth testing on its own.

### Writing one

- **List a root file's tooling test** in `include` in `vitest.tooling-real.config.ts`, and in `ignored` in `vitest.config.ts`. `vitest.config.browser.test.ts` stays an app test, since it guards the app's compiler setup.
- **Tooling tests get no React Compiler and no `@` alias,** so a tooling test can't import app code.
- **Only `tooling-unit` collects coverage,** of oxCrap's code, into `coverage-tooling/`, for [its CRAP score](crap-testing-practices.md). `tooling-real` collects none.

### A deep module that's a program

This subsection holds the layout and wiring of a deep module whose interface is a program, the only kind set up so far. How its features apply feature testing conventions is under [How the conventions apply](#how-the-conventions-apply).

| Path                                            | Holds                                                 |
| :---------------------------------------------- | :---------------------------------------------------- |
| `scripts/<tool>/features/<topic>.feature`       | Scenarios, in the words of a developer using the tool |
| `scripts/<tool>/features/steps/<tool>.steps.ts` | Step definitions                                      |
| `scripts/<tool>/features/screenplay/`           | The tool's own cast, actor, tasks and questions       |
| `scripts/<tool>/features/playwright.config.ts`  | Its playwright-bdd config, with no browser            |
| `scripts/<tool>/features/.gplintrc`             | Its gplint rules                                      |

- **Wire a new tool's features into `package.json`:** its config in `test:tooling`; `gplint -c <its .gplintrc> <its folder>` and `-c <its config>` for `check-unused-steps.ts` in `lint`; its folder in `format` and `format:check`.

### When one fails

[Fixing a bug](testing-conventions.md#fixing-a-bug) in testing conventions applies as written. For a step with no definition, one two definitions match, or one no feature uses, [Steps and the Screenplay](feature-testing-conventions.md#steps-and-the-screenplay) in feature testing conventions says what fails and what to do.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [tooling-testing.meta.md](tooling-testing.meta.md). Read it only when changing or questioning a rule here.
