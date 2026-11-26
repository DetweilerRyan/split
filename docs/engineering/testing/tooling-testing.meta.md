# Tooling testing: reasons and sources

Why the rules in [tooling testing](tooling-testing.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file.

Piloted on oxCrap in [#65](https://github.com/DetweilerRyan/split/issues/65), which the owner raised while reviewing #64. These are the owner's decisions, from [the issue](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227):

- **The tooling tests run apart from the app's,** with one command, `npm run test:tooling`, which also runs oxCrap's features. That's one row in the definition of done and one CI step.
- **They have a separate config file,** `vitest.tooling.config.ts`, with no React Compiler, coverage or `@` alias.
- **The Stop hook watches tooling too:** "Yes, watch scripts/ too".
- **The pull request proposes the rule,** and merging it adopts the rule: "each pull request writes the convention it pilots into `testing-conventions.md`", then the only testing document.

**Why apart:**

- Most changes never touch dev-only scripts, yet `npm test` ran their tests. On 2026-11-23 they were 145 of the 224 tests.
- Taking them out cut `npm test` from 9.8 s to 3.5 s on the sandbox. `npm run test:tooling` takes 12.1 s, 2.8 s of it the features.
- The CRAP check's coverage run scores only `src/` and `app/`, so it no longer runs tests for code it never scores.

Why a deep module's contract is tested with features, and the oxCrap pilot that measured it, moved with the rules to [feature testing conventions' sidecar](feature-testing-conventions.meta.md#feature-contracts).

**Options not taken:**

- **Sharing `e2e/screenplay`:** oxCrap imports nothing from outside its folder, and the e2e cast is built around a browser.
- **Steps beside the features, with no `steps/` folder,** as first built: the oxlint rule then banned every `../` import in oxCrap's folder. With rev-dep checking where imports land ([dependency direction](../dependency-direction.meta.md)), the layout matches `e2e/` ([feedback](https://github.com/DetweilerRyan/split/pull/66#issuecomment-7104488494)).
- **Running the features from the root `playwright.config.ts`:** that config starts the app's servers, and `npm run test:e2e` is the app's.
- **Two commands,** `test:tooling` and `test:contracts`: the owner chose one.
- **Tooling projects in `vitest.config.ts`:** they would run through the app's React Compiler, coverage and alias.

**What would reopen this:** the features growing slow enough to delay the hook, or the first deep module used through code, which needs its own layout and runner.
