# Testing conventions: reasons and sources

Why the rules in [testing conventions](testing-conventions.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the conventions needs nothing from this file.

Most of the advice comes from Kent C. Dodds. Each source below was opened and checked against what is attributed to it on 2026-11-20 or 2026-11-21.

## What a test checks

- **User-visible behaviour, not implementation details.** Kent defines implementation details as "things which users of your code will not typically use, see, or even know about". He names two users of a component, "End-users and developers", and says a test "should typically only see/interact with the props that are passed, and the rendered output" ([Testing Implementation Details](#testing-implementation-details)). Vitest's component testing guide gives the same advice: test user-facing behaviour, not state or internals ([Vitest](#vitest-component-testing)).
- **Use the code the way it's really used.** "The more your tests resemble the way your software is used, the more confidence they can give you", and Kent endorses Guillermo Rauch's "Write tests. Not too many. Mostly integration." ([The Testing Trophy](#testing-trophy)). The exception for collaborator-free logic is this repository's own: functions like `computeReceiptMath` have many edge cases that are clearest tested directly.
- **Specific assertions.** "Make assertions specific" and "Tests should resemble users" are two of [Epic Web's principles](#epic-web-principles). The Epic Stack's `epic-testing` skill shows the good-and-bad example pattern used in the doc ([epic-testing](#epic-testing)). It was written by a contributor and merged by Kent, so its wording isn't his.

## Projects and file names

- **Component and hook tests run in a real browser.** Decided by the owner on [#38](https://github.com/DetweilerRyan/split/issues/38#issuecomment-7053714472) ("approved"), choosing Vitest Browser Mode over jsdom with React Testing Library.
  - **Kent:** in 2026 he recommends Vitest's or Playwright's built-in user events and locators for new browser tests, and moving important interaction tests to a real browser rather than relying more on simulated events ([user-event#1319](#user-event-1319)).
  - **Courses and tools:** his Epic Web workshop teaches Browser Mode, with a section titled "Sunsetting JSDOM" ([Epic Web workshop](#epic-web-workshop)). Vitest calls Browser Mode "the recommended approach for component testing" ([Vitest](#vitest-component-testing)).
  - **Not taken:** jsdom with React Testing Library. It's cheaper to set up, but it keeps testing in the simulated DOM Kent and Vitest are moving away from, and it would need `@testing-library/user-event`, which is no longer getting feature work. The trial and comparison are on #38.
- **`<module>.browser.test.ts(x)` names browser tests.** Decided by the owner on #38: "go with `<module>.browser.test.ts(x)`". The alternative was choosing the project by folder (`src/components/`, `src/hooks/`). A suffix keeps the file a sidecar and shows the environment in its name.
- **`<module>.real.test.ts` names tests that run real programs or touch the file system.** Asked for by the owner in review on [#39](https://github.com/DetweilerRyan/split/pull/39#discussion_r4649529184), who suggested `.real.test.ts` and asked for precedent.
  - **The distinction:** Google's _Software Engineering at Google_ separates a test's size, "the resources that are required to run a test case", from its scope, "the specific code paths we are verifying" ([test size and scope](#swe-test-sizes)). A small test "must run in a single process" and isn't "allowed to access the network or disk". A medium test "can span multiple processes" but reaches no system other than `localhost`.
  - **Where `prepare-sandbox` falls:** its test is narrow in scope, one script, but medium in size: it runs subprocesses and writes files.
  - **Why not `.integration.test.ts`:** it's what a Vitest maintainer suggests for separating such tests, with projects named `unit` and `integration` and files `**/*.unit.test.ts` and `**/*.integration.test.ts` ([Vitest discussion #4675](#vitest-4675)). But "integration" names scope, so it would mislabel a narrow test.
  - **Precedent:** `.real.` names the size property, and matches the `_real.py` tests in the owner's market-research repository, which use real binaries and loopback without the internet.
  - **Not taken:** Google's own `.medium.test.ts`, a term readers would have to look up.
- **No layout assertions in jsdom.** jsdom does no layout, so `toBeVisible` there checks only attributes and inline styles.
- **Tests run through the React Compiler.** Decided by the owner in the session on 2026-11-21: "add the @vitejs/plugin-react package to make sure the tests do run through React Compiler. memoisation can affect the results of tests." `next.config.ts` builds the app with `reactCompiler: true`.
  - **What changed:** `vitest.config.ts` runs `babel-plugin-react-compiler` first through `@vitejs/plugin-react`.
  - **Version:** 5.2.0, the newest release that supports the Vite 6 inside Vitest 5.0.5, since 6.x needs Vite 8.
  - **Guard:** `vitest.config.browser.test.ts` checks a component compiles to the compiler's memo cache (`const $ = _c(<slots>)`). With the plugin line removed it fails, and every other test still passes.
  - **Reopen when:** Vitest moves to Vite 8; plugin-react can then move to 6.x.
  - **The case that showed why it matters:** with the compiler on, it memoized a `localStorage` read in `useActiveIdentity` on inputs that didn't include storage. See [#37](https://github.com/DetweilerRyan/split/pull/37#discussion_r4649234960).

## Writing component and hook tests

These rules come from Kent's [Common mistakes with React Testing Library](#common-mistakes) (2020), adapted to Vitest's browser API.

- **Query order** follows Testing Library's [query priority](#query-priority): `getByRole` first, test IDs last. Kent says to use `*ByRole` "most of the time", and to query "by the _actual_ text" rather than test IDs. Vitest's locators keep the same names except `getByPlaceholder` (Testing Library's `getByPlaceholderText`). Vitest has no `getByDisplayValue`, so it's left out of the order.
- **`userEvent` from `vitest/browser`, not `@testing-library/user-event`.** Kent's 2020 advice was "Use `@testing-library/user-event` over `fireEvent` where possible." His 2026 recommendation supersedes it for browser tests: use Vitest's built-in `userEvent` and don't add `@testing-library/user-event` ([user-event#1319](#user-event-1319)).
- **`expect.element` instead of waits.** Kent: "use `find*` any time you want to query for something that may not be available right away", and "put side-effects outside `waitFor` callbacks and reserve the callback for assertions only." `expect.element` retries the way `find*` and `waitFor` do, so the rule becomes: no waits of your own, and actions outside the assertion.
- **Absence with `not.toBeInTheDocument()`.** Kent: "Only use the `query*` variants for asserting that an element cannot be found." Vitest's locators are lazy, so there's no `query*` variant; the negated assertion does that job.
- **No `act`.** Kent: "Learn when `act` is necessary and don't wrap things in `act` unnecessarily." `vitest-browser-react` uses `act` internally for rendering, and `userEvent` waits for the browser. `renderHook` returns its own `act` for calling a hook's functions.
- **Hooks through components.** Kent: "In most situations, this is how I would recommend testing this kind of a hook", and for complicated hooks `renderHook` "is more useful" than a hand-written test component, which must reimplement rerendering, unmounting and async waiting ([How to test custom React hooks](#custom-hooks)). The post (2020) predates `renderHook` living in `vitest-browser-react`, but its reasoning carries over.
- **The stylesheet import** makes `toBeVisible` reflect the app's real CSS (Tailwind, through PostCSS), so a hidden element can't pass as visible.

## Mocking

- **Fake only what can't run, at the edge.** Kent: "Mocking severs the real-world connection between what you're testing and what you're mocking", and the payoff is "usually practicality". In UI tests, "I never make actual network calls." On speed: "trading confidence for a minute or two faster test suite is a bad trade" ([The Merits of Mocking](#merits-of-mocking)).
- **Never mock React's hooks.** Kent: "You throw away a LOT of confidence in doing so" ([How to test custom React hooks](#custom-hooks)).
- **`vi.mock` for directly imported third-party modules.** A repository rule, kept because `yjsProvider.ts` imports Liveblocks, `y-webrtc` and `y-indexeddb` directly. Passing them in would change its public interface for tests alone. A strict no-mocks rule, as market-research has, was not taken because it would contradict that existing test.

## End-to-end tests

Researched on 2026-11-21 and settled on [#55](https://github.com/DetweilerRyan/split/issues/55); the owner's decisions are in [this comment](https://github.com/DetweilerRyan/split/issues/55#issuecomment-7071299115).

- **Gherkin run by Playwright Test through playwright-bdd.** Approved by the owner in the session on 2026-11-21, with `@playwright/test` 1.65.0 and `playwright-bdd` 9.2.1.
  - **How it works:** playwright-bdd turns each feature into an ordinary Playwright test file, so traces, sharding, fixtures and the HTML report all still work ([playwright-bdd](#playwright-bdd)).
  - **Not taken:** `@cucumber/cucumber` driving Playwright as a library. Cucumber would then run the tests, and Playwright's own reports and traces need plugins.
- **A Screenplay layer of our own,** chosen by the owner as "option A".
  - **Why:** a receipt is split by several people at once, which is a story about actors. The pattern also lets an actor hold an ability for an interface other than the browser ([Screenplay](#screenplay)).
  - **Not taken: Serenity/JS** 3.49.0, the main TypeScript Screenplay library. Its Playwright packages pin `playwright-core ~1.64.0` while the repository is on 1.65.0, and its Gherkin support runs through Cucumber ([Serenity/JS](#serenity-js)).
  - **Not taken: page objects,** which most comparisons find simpler but less reusable once journeys span several users or interfaces.
  - **Reopen when:** the layer grows enough that maintaining it costs more than adopting a library that follows Playwright's releases.
- **An MCP client is an actor's ability.** No published BDD or Screenplay tests of an MCP server turned up in the research. What exists either uses MCP to write Gherkin, or tests servers with the SDK's in-memory transport ([MCP SDK testing](#mcp-sdk-testing)). Treating the client as an ability follows Screenplay's own advice for APIs. `@modelcontextprotocol/client` 2.4.0 was approved by the owner on 2026-11-22 and stays behind `e2e/screenplay/mcp.ts`.
- **A separate `npm run test:e2e`,** decided by the owner on 2026-11-22. It is not part of `npm test`, so the fast Vitest run stays fast.
- **A local signaling server,** decided by the owner on 2026-11-22.
  - **Why:** room sync uses public WebRTC signaling servers, which would break [Tests stay offline](testing-conventions.md#tests-stay-offline). `NEXT_PUBLIC_WEBRTC_SIGNALING_URLS` points the app at `y-webrtc`'s own server instead, and actors' browsers refuse every request to another host.
  - **Not covered:** Liveblocks mode.
- **The app is built for every run.** Next.js inlines `NEXT_PUBLIC_` variables at build time, so a server already running might point at the public signaling servers. `reuseExistingServer` is off for that reason.
- **Features live in `e2e/features/`, not a top-level `features/`.** Decided by the owner in the session on 2026-11-22.
  - **Why:** everything for the suite stays under one folder named for the kind of test, as in Next.js's own `with-playwright` example (`testDir: path.join(__dirname, "e2e")`). A top-level `features/` can read as feature-sliced app code beside `app/` and `src/`.
  - **Not taken:** `features/`, Cucumber's default and the owner's `gol` repository's layout. With it, cucumber-js and Cucumber's VS Code extension need no paths configured. Here only the two `cucumber.*` settings in `.devcontainer/devcontainer.json` differ.
- **Actors browse on a phone.** `AGENTS.md` asks for a mobile-first interface, so the tests use what most people at the table will.
- **Actors claim with their name's button on the item,** not by choosing an identity first. The header's identity button is named after whoever is active, so no stable name finds it.
  - **Reopen when:** that button gets a fixed accessible name.
- **The first refusal scenario uses a duplicated item id,** not the tax line #55 suggested. The schema rejects duplicated ids, but leaving out tax lines is only an instruction in the field description, so no code refuses them.
- **Runs against Vercel previews are deferred** to [#56](https://github.com/DetweilerRyan/split/issues/56).

### Linting and formatting features

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
- **Linter: `gplint`,** with `gol`'s rules and a list of banned implementation words. Why gplint, where each rule comes from, and the research behind the word list are in [`.gplintrc.meta.md`](../../.gplintrc.meta.md).
- **Not taken: a checker for duplicated step wording** like `gol`'s. Two features don't have enough steps to drift.
  - **Reopen when:** features grow enough that similar steps are written twice.

### Unused step definitions fail lint

- **The rule:** every step definition is used by some feature, and steps don't call other steps. `scripts/check-unused-steps.ts` enforces the first half, and the second half keeps it free of its usual false positive.
- **Where the reasons are:** the decision, the research behind it, and how the script works are in [`scripts/check-unused-steps.meta.md`](../../scripts/check-unused-steps.meta.md).

## Tooling tests and feature contracts

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
- **Steps beside the features, with no `steps/` folder,** as first built: the oxlint rule then banned every `../` import in oxCrap's folder. With rev-dep checking where imports land, the layout matches `e2e/` ([feedback](https://github.com/DetweilerRyan/split/pull/66#issuecomment-7104488494)).
- **Running the features from the root `playwright.config.ts`:** that config starts the app's servers, and `npm run test:e2e` is the app's.
- **Two commands,** `test:tooling` and `test:contracts`: the owner chose one.
- **Tooling projects in `vitest.config.ts`:** they would run through the app's React Compiler, coverage and alias.

**What would reopen this:** the features growing slow enough to delay the hook, or a second deep module whose contract doesn't fit a command line.

## Changed test expectations

The rule that a changed expectation needs a reason in the pull request is owned by [reviewing work](workflow/reviewing-work.md#changed-test-expectations); its source is in that document's sidecar.

## Sources

- <a id="testing-implementation-details"></a>Kent C. Dodds, [Testing Implementation Details](https://kentcdodds.com/blog/testing-implementation-details), 2020-08-17.
- <a id="testing-trophy"></a>Kent C. Dodds, [The Testing Trophy and Testing Classifications](https://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications), 2021-06-03.
- <a id="common-mistakes"></a>Kent C. Dodds, [Common mistakes with React Testing Library](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library), 2020-05-04.
- <a id="custom-hooks"></a>Kent C. Dodds, [How to test custom React hooks](https://kentcdodds.com/blog/how-to-test-custom-react-hooks), 2020-03-22.
- <a id="merits-of-mocking"></a>Kent C. Dodds, [The Merits of Mocking](https://kentcdodds.com/blog/the-merits-of-mocking), 2018-11-05.
- <a id="user-event-1319"></a>Kent C. Dodds, [Migration recommendation: prefer Vitest browser mode or Playwright for new work](https://github.com/testing-library/user-event/issues/1319), testing-library/user-event#1319, opened 2026-08-03.
- <a id="epic-web-workshop"></a>Epic Web, [React Component Testing with Vitest](https://www.epicweb.dev/workshops/react-component-testing-with-vitest), taught by Artem Zakharenko.
- <a id="epic-web-principles"></a>Epic Web, [Principles](https://www.epicweb.dev/principles).
- <a id="epic-testing"></a>Epic Stack, [`epic-testing` skill](https://github.com/epicweb-dev/epic-stack/blob/main/docs/skills/epic-testing/SKILL.md), added in [epic-stack#1078](https://github.com/epicweb-dev/epic-stack/pull/1078).
- <a id="query-priority"></a>Testing Library, [About Queries: Priority](https://testing-library.com/docs/queries/about/#priority).
- <a id="vitest-component-testing"></a>Vitest, [Component Testing](https://vitest.dev/guide/browser/component-testing), v5.1.1.
- <a id="swe-test-sizes"></a>Titus Winters, Tom Manshreck and Hyrum Wright (eds.), _Software Engineering at Google_, [chapter 11, "Testing Overview"](https://abseil.io/resources/swe-book/html/ch11.html): test size and test scope.
- <a id="vitest-4675"></a>Vitest, [How to separate unit and integration test](https://github.com/vitest-dev/vitest/discussions/4675), discussion #4675.
- <a id="playwright-bdd"></a>Vitaliy Potapov, [playwright-bdd](https://github.com/vitalets/playwright-bdd), v9.2.1.
- <a id="screenplay"></a>John Ferguson Smart and Jan Molak, _BDD in Action_, 2nd ed., [chapter 12, "Scalable test automation with the Screenplay Pattern"](https://livebook.manning.com/book/bdd-in-action-second-edition/chapter-12).
- <a id="serenity-js"></a>Serenity/JS, [Playwright Test integration](https://serenity-js.org/handbook/test-runners/playwright-test/), v3.49.0.
- <a id="mcp-sdk-testing"></a>Model Context Protocol TypeScript SDK, [Test a server](https://ts.sdk.modelcontextprotocol.io/v2/testing.html), v2.
