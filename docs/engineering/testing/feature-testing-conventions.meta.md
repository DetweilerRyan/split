# Feature testing conventions: reasons and sources

Why the rules in [feature testing conventions](feature-testing-conventions.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file. The sources it cites are listed in [testing conventions' sidecar](testing-conventions.meta.md#sources).

## Gherkin and the Screenplay

Researched on 2026-11-21 and settled on [#55](https://github.com/DetweilerRyan/split/issues/55), for the end-to-end tests, which were the first feature tests; the owner's decisions are in [this comment](https://github.com/DetweilerRyan/split/issues/55#issuecomment-7071299115).

- **Gherkin run by Playwright Test through playwright-bdd.** Approved by the owner in the session on 2026-11-21, with `@playwright/test` 1.65.0 and `playwright-bdd` 9.2.1.
  - **How it works:** playwright-bdd turns each feature into an ordinary Playwright test file, so traces, sharding, fixtures and the HTML report all still work ([playwright-bdd](testing-conventions.meta.md#playwright-bdd)).
  - **Not taken:** `@cucumber/cucumber` driving Playwright as a library. Cucumber would then run the tests, and Playwright's own reports and traces need plugins.
- **A Screenplay layer of our own,** chosen by the owner as "option A".
  - **Why:** a receipt is split by several people at once, which is a story about actors. The pattern also lets an actor hold an ability for an interface other than the browser ([Screenplay](testing-conventions.meta.md#screenplay)).
  - **Not taken: Serenity/JS** 3.49.0, the main TypeScript Screenplay library. Its Playwright packages pin `playwright-core ~1.64.0` while the repository is on 1.65.0, and its Gherkin support runs through Cucumber ([Serenity/JS](testing-conventions.meta.md#serenity-js)).
  - **Not taken: page objects,** which most comparisons find simpler but less reusable once journeys span several users or interfaces.
  - **Reopen when:** the layer grows enough that maintaining it costs more than adopting a library that follows Playwright's releases.

## Linting and formatting features

Researched on 2026-11-22. The owner approved `@cucumber/gherkin-utils` 12.0.2 and `gplint` 2.6.1 in the session that day, to add to [PR #57](https://github.com/DetweilerRyan/split/pull/57).

- **Precedents:** the owner's `gol` and `gol2` repositories.
  - **`gol`** formats features with Prettier's `prettier-plugin-gherkin` and gates them with `gherkin-lint-plus`. Its config turns on every structure rule, plus `no-restricted-patterns` as a check that scenarios stay at domain altitude. It also has a report-only checker for duplicated step wording.
  - **`gol2`** lints Markdown beside oxfmt. Its rule is that only one tool formats, and the linter's style rules are pinned to what the formatter writes, because "the two tools rewrite each other's output".
- **Formatter: `@cucumber/gherkin-utils`,** Cucumber's own, the same project as the parser.
  - **Why:** oxfmt doesn't read `.feature` files. Cucumber's editor language server depends on the same library, so editors that use it should format the same way.
  - **In the editor:** the dev container installs Cucumber's VS Code extension, `CucumberOpen.cucumber-official`, approved by the owner on 2026-11-22. It formats `.feature` files and links steps to `e2e/steps`. Version 1.12.1 was checked that day: updated 2026-11-07, about 473,000 installs, source in `cucumber/vscode`.
  - **Not checked:** which `@cucumber/gherkin-utils` version the extension bundles, because its code is minified, so its formatting isn't confirmed to match `npm run format`. `npm run format:check` decides.
  - **Its CLI has no check mode,** so `scripts/format-features.ts` pipes each file through it and compares the output.
  - **Not taken:** `prettier-plugin-gherkin`, `gol`'s choice. It would add Prettier as a second formatter beside oxfmt, and `gol`'s own move to oxfmt still kept Prettier for this reason.
- **Linter: `gplint`,** with `gol`'s rules and a list of banned implementation words. Why gplint, where each rule comes from, and the research behind the word list are in [`.gplintrc.meta.md`](../../../.gplintrc.meta.md).
- **Not taken: a checker for duplicated step wording** like `gol`'s. Two features don't have enough steps to drift.
  - **Reopen when:** features grow enough that similar steps are written twice.

## Shared `.gplintrc` rules

- **Every other `.gplintrc` copies the root's structural rules,** decided on [#65](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227) for oxCrap's features, because gplint 2.6.1 can't extend another config.

## Unused step definitions fail lint

- **The rule:** every step definition is used by some feature, and steps don't call other steps. `scripts/check-unused-steps.ts` enforces the first half, and the second half keeps it free of its usual false positive.
- **Where the reasons are:** the decision, the research behind it, and how the script works are in [`scripts/check-unused-steps.meta.md`](../../../scripts/check-unused-steps.meta.md).

## Feature contracts

**The definition of a deep module lives in [code design principles](../code-design-principles.md)' _deep modules_,** since #115, at the owner's request. Why it covers more than dev tools is in [that document's sidecar](../code-design-principles.meta.md#added-on-115). The owner also asked, on #66, that "deep modules in general will leverage bdd", so [Feature contracts for deep modules](feature-testing-conventions.md#feature-contracts-for-deep-modules) sets up features for them. The program kind is set up in tooling testing's "A deep module that's a program", as oxCrap is the only one yet.

**Whether a module is deep is the owner's call.** A second draft listed checks for when a script is deep: its own folder, a README describing its interface, and modules with unit tests. The owner said in [review](https://github.com/DetweilerRyan/split/pull/66#discussion_r4668423016) that "a script may check all three of them but still not be a deep module", and "really, the only definition is that the complexity ratio from a modules interface to it's internals exceeds a certain threshold". They went on: "in lieu of measuring the complexity ratio we'll just have to leave the deep module distinction to a judgment call made by the owner with input from an agent." So an agent proposes, and the owner decides. The table of deep modules records each decision.

**Why features for a deep module's contract:** the contract (what you write, what the check reports, what it exits with) is the interface that survives a rewrite. Replacing oxlint with oxCrap's own counter in #64 left the end-to-end tests intact apart from their numbers.

**What the pilot measured,** replacing `oxcrap.real.test.ts`:

- **Size:** the 29 tests were one 500-line file. The contract is now 35 scenarios in 419 lines of features, plus 366 lines of steps, screenplay and config and a 52-line `.gplintrc`. That's about 1.6 times the lines: the features are longer than the test code they replace, and the glue is new.
- **The steps reuse well:** 17 step definitions serve all 35 scenarios. The first 2 scenarios needed 7; the other 33 needed 10 more, and most needed none.
- **Adding a scenario** usually means editing one feature file and nothing else.
- **They catch real breaks:** with the CLI's findings made to exit 0 and its help line reworded, 9 scenarios failed, exactly the ones asserting a failing check or a help line.
- **Gherkin cost two things:**
  - A `{string}` parameter can't hold double quotes, so messages quoting a name go in DocStrings.
  - The 110-character step limit sends long messages there too.
- **Every assertion the old test made is kept,** word for word. A test that made several runs became one scenario per run, since a scenario has one When.
