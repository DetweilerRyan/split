# Tooling testing: reasons and sources

Why the rules in [tooling testing](tooling-testing.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file.

Piloted on oxCrap in [#65](https://github.com/DetweilerRyan/split/issues/65), which the owner raised while reviewing #64. These are the owner's decisions, from [the issue](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227):

- **The tooling tests run apart from the app's,** with one command, `npm run test:tooling`, which also runs oxCrap's features. That's one row in the definition of done and one CI step.
- **They have a separate config file,** `vitest.tooling.config.ts`, with no React Compiler, coverage or `@` alias.
- **The Stop hook watches tooling too:** "Yes, watch scripts/ too".
- **The tooling `.gplintrc` copies the root's structural rules** because gplint 2.6.1 can't extend another config.
- **The pull request proposes the rule,** and merging it adopts the rule: "each pull request writes the convention it pilots into `testing-conventions.md`".

**Why apart:**

- Most changes never touch dev-only scripts, yet `npm test` ran their tests. On 2026-11-23 they were 145 of the 224 tests.
- Taking them out cut `npm test` from 9.8 s to 3.5 s on the sandbox. `npm run test:tooling` takes 12.1 s, 2.8 s of it the features.
- The CRAP check's coverage run scores only `src/` and `app/`, so it no longer runs tests for code it never scores.

**The definition of a deep module lives in [code design principles](../code-design-principles.md)' _deep modules_,** since #115, at the owner's request. Why it covers more than dev tools is in [that document's sidecar](../code-design-principles.meta.md#added-on-115). The owner also asked, on #66, that "deep modules in general will leverage bdd", so [tooling testing's feature contracts](tooling-testing.md#feature-contracts-for-deep-modules) set up features for them. They set up only the program kind, as oxCrap is the only one yet.

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

**Options not taken:**

- **Sharing `e2e/screenplay`:** oxCrap imports nothing from outside its folder, and the e2e cast is built around a browser.
- **Steps beside the features, with no `steps/` folder,** as first built: the oxlint rule then banned every `../` import in oxCrap's folder. With rev-dep checking where imports land ([dependency direction](../dependency-direction.meta.md)), the layout matches `e2e/` ([feedback](https://github.com/DetweilerRyan/split/pull/66#issuecomment-7104488494)).
- **Running the features from the root `playwright.config.ts`:** that config starts the app's servers, and `npm run test:e2e` is the app's.
- **Two commands,** `test:tooling` and `test:contracts`: the owner chose one.
- **Tooling projects in `vitest.config.ts`:** they would run through the app's React Compiler, coverage and alias.

**What would reopen this:** the features growing slow enough to delay the hook, or the first deep module used through code, which needs its own layout and runner.
