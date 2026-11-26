# Tooling testing

The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for tests of the repository's own dev tools, and for a deep module's feature contract.

Tooling tests check the repository's own dev tools: everything in `scripts/`, and root tooling config such as `.rev-dep.config.jsonc`, whose sidecar is `rev-dep.config.real.test.ts`. They run apart from the app's, from two configs, and `npm run test:tooling` runs both. `npm test` doesn't.

| Project        | Config                                                                    | File name                                                     | Runs in |
| :------------- | :------------------------------------------------------------------------ | :------------------------------------------------------------ | :------ |
| `tooling-unit` | [`vitest.tooling.config.ts`](../../../vitest.tooling.config.ts)           | every `<module>.test.ts` under `scripts/` that isn't `.real.` | Node    |
| `tooling-real` | [`vitest.tooling-real.config.ts`](../../../vitest.tooling-real.config.ts) | `<module>.real.test.ts`                                       | Node    |

- **Name and place them as [the app's tests](testing-conventions.md#which-project-a-test-belongs-in) are:** a sidecar beside its module (`scripts/prepare-sandbox.sh` → `scripts/prepare-sandbox.real.test.ts`), `.real.` when it runs programs or touches the file system.
- **They get no React Compiler and no `@` alias,** so a tooling test can't import app code.
- **Only `tooling-unit` collects coverage,** of oxCrap's code, into `coverage-tooling/`, for [its CRAP score](../crap.md). `tooling-real` collects none.
- **A root file's test is tooling when it tests tooling config.** List it in `include` in `vitest.tooling-real.config.ts`, and in `ignored` in `vitest.config.ts`. `vitest.config.browser.test.ts` stays an app test, since it guards the app's compiler setup.

## Feature contracts for deep modules

What a deep module is, is in the code design principles' [_deep modules_](../code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour). Its contract is what its callers give it and get back, which is the part that survives rewriting its internals.

- **Test a deep module's contract with Gherkin features,** written in its callers' words and kept beside it.
- **Drive the features through the module's own interface.** Run a program end to end, as a process. A module used through code is driven through its functions, which needn't be end to end.
- **Keep unit tests for the modules inside it,** for their edge cases.
- **Don't keep a second test of the same contract,** such as a `real` test of the program, beside the features.

### Deciding a module is deep

What makes a module deep is how much its internals outweigh its interface, and that isn't measured. So whether a module is deep is the owner's call.

- **An agent that thinks a module is deep proposes it** in the issue or pull request. It says what the interface is, and what it hides.
- **Until the owner agrees, test it as any other module.** A script keeps its `real` test.

| Deep module               | Decided on                                              |
| :------------------------ | :------------------------------------------------------ |
| oxCrap, `scripts/oxcrap/` | [#65](https://github.com/DetweilerRyan/split/issues/65) |

### A deep module that's a program

These rules cover a deep module whose interface is a program, the only kind set up so far. The first deep module used through code sets up its own layout and runner, and adds its rules here.

| Path                                            | Holds                                                 |
| :---------------------------------------------- | :---------------------------------------------------- |
| `scripts/<tool>/features/<topic>.feature`       | Scenarios, in the words of a developer using the tool |
| `scripts/<tool>/features/steps/<tool>.steps.ts` | Step definitions                                      |
| `scripts/<tool>/features/screenplay/`           | The tool's own cast, actor, tasks and questions       |
| `scripts/<tool>/features/playwright.config.ts`  | Its playwright-bdd config, with no browser            |
| `scripts/<tool>/features/.gplintrc`             | Its gplint rules                                      |

- **Follow the [end-to-end tests' Screenplay rules](end-to-end-testing.md),** with these differences:
  - **The actor's abilities** are a throwaway project folder and running the program, not a browser or an MCP session.
  - **The fixtures take no `browser` or `page`,** so Playwright never starts one.
  - **The screenplay is the tool's own, inside its folder,** so the tool imports nothing from outside it. A [dependency-direction](../dependency-direction.md) rule can enforce that, as one does for oxCrap.
  - **Steps import `test`, `Given`, `When` and `Then`** from the tool's own `screenplay/fixtures.ts`.
- **Run the program as a process, by its path,** as a developer would, and assert its exit status and the exact text it prints. Put a message longer than a step allows, or one holding double quotes, in a DocString.
- **Use the tool's own words:** for oxCrap, function, complexity, config, coverage report and `@crap-allow`. The tool's `.gplintrc` bans its module and function names, and how the test runs the program, instead of the app's words. Its structural rules are copied from the root `.gplintrc`: change a rule in both.
- **Keep edge cases in the modules' unit tests.** A scenario covers what the program as a whole does with its arguments and files.
- **Wire a new tool's features into `package.json`:** its config in `test:tooling`; `gplint -c <its .gplintrc> <its folder>` and `-c <its config>` for `check-unused-steps.ts` in `lint`; its folder in `format` and `format:check`.

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [tooling-testing.meta.md](tooling-testing.meta.md). Read it only when changing or questioning a rule here.
