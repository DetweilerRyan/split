# Testing conventions: reasons and sources

Why the rules in [testing conventions](testing-conventions.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the conventions needs nothing from this file.

Most of the advice comes from Kent C. Dodds. Each source below was opened and checked against what is attributed to it on 2026-11-20 or 2026-11-21.

## What a test checks

Why a component test checks only what a user can see and do moved with the rule to [component and hook testing's sidecar](component-and-hook-testing.meta.md).

- **Query order** follows Testing Library's [query priority](testing-conventions.meta.md#query-priority): `getByRole` first, test IDs last. Kent says to use `*ByRole` "most of the time", and to query "by the _actual_ text" rather than test IDs. Vitest's locators keep the same names except `getByPlaceholder` (Testing Library's `getByPlaceholderText`). Vitest has no `getByDisplayValue`, so it's left out of the order.

- **Use the code the way it's really used.** "The more your tests resemble the way your software is used, the more confidence they can give you", and Kent endorses Guillermo Rauch's "Write tests. Not too many. Mostly integration." ([The Testing Trophy](#testing-trophy)). The exception for collaborator-free logic is this repository's own: functions like `computeReceiptMath` have many edge cases that are clearest tested directly.
- **Specific assertions.** "Make assertions specific" and "Tests should resemble users" are two of [Epic Web's principles](#epic-web-principles). The Epic Stack's `epic-testing` skill shows the good-and-bad example pattern each kind's document uses ([epic-testing](#epic-testing)). It was written by a contributor and merged by Kent, so its wording isn't his.
- **Test files are exempt from `max-nested-callbacks`.** Decided by the owner on [#76](https://github.com/DetweilerRyan/split/issues/76), on 2026-11-24: "Tighter, tests exempt", with `max-depth` 3 and `max-nested-callbacks` 3 everywhere else. A test's callbacks nest by structure, not by logic: a property test is already three deep at `describe`, `it` and `fc.property`, so a fourth callback inside it, such as an `arbitrary.map`, would fail. When the rule was turned on, every place it flagged was in a test file. Flattening them would move a test's setup away from the property it serves.
  - **Not taken:** the issue's other options, ESLint's default limit of 10, which nothing broke, or a limit test files fit.
  - **What would reopen it:** a test whose nesting hides its logic, rather than its structure.

## Projects and file names

Why the `unit` project has no layout assertions moved with the rule to [unit testing's sidecar](unit-testing.meta.md).

Why tests run through the React Compiler moved with the rule to [component and hook testing's sidecar](component-and-hook-testing.meta.md).

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

## Writing component and hook tests

Moved with the rules to [component and hook testing's sidecar](component-and-hook-testing.meta.md).

## Mocking

- **Fake only what can't run, at the edge.** Kent: "Mocking severs the real-world connection between what you're testing and what you're mocking", and the payoff is "usually practicality". In UI tests, "I never make actual network calls." On speed: "trading confidence for a minute or two faster test suite is a bad trade" ([The Merits of Mocking](#merits-of-mocking)).
- **Never mock React's hooks.** Kent: "You throw away a LOT of confidence in doing so" ([How to test custom React hooks](#custom-hooks)).
- **`vi.mock` for directly imported third-party modules.** A repository rule, kept because `yjsProvider.ts` imports Liveblocks, `y-webrtc` and `y-indexeddb` directly. Passing them in would change its public interface for tests alone. A strict no-mocks rule, as market-research has, was not taken because it would contradict that existing test.

## End-to-end tests

Moved with the rules to [end-to-end testing's sidecar](end-to-end-testing.meta.md).

## Property tests

Moved with the rules to [property testing's sidecar](property-testing.meta.md).

## Tooling tests and feature contracts

Moved with the rules to [tooling testing's sidecar](tooling-testing.meta.md).

## Split into documents

- **Asked for by the owner on #154,** on 2026-11-25: "testing-conventions.md is getting too large, let's break it apart. make a docs/testing/ folder with an index readme with read triggers and seperate out a property-testing.md doc. the other testing types can be decomposed from testing-convetions.md in another pr" ([recorded](https://github.com/DetweilerRyan/split/pull/154#issuecomment-7174979414)). #154 moved property and mutation testing; [#156](https://github.com/DetweilerRyan/split/issues/156) moved the rest.
- **What moved, on [#159](https://github.com/DetweilerRyan/split/pull/159), the pull request for #156:** component and hook tests, end-to-end tests, tooling tests with feature contracts, and the `unit` project's own rule, which the owner asked for on that pull request, each into a document of its own in this folder, with its sidecar entries. Each left a one-line pointer in `testing-conventions.md`, as [the index's steps](README.md#adding-a-document) say.
- **The issue's open decisions, as that pull request took them:**
  - **`testing-conventions.md` moved into `docs/engineering/testing/` too,** keeping the rules every kind of test shares. So the folder owns every testing rule, and the engineering index's one testing row is the only pointer.
  - **The Sources list stays in this sidecar,** shared, since most entries back more than one document and each already has an anchor. The other sidecars link to it.
  - **One pull request for all the moves,** since they share one index and one set of links, and moving them together updates the index and the links once.
- **Three rules that apply to one kind of test moved on the owner's review** of #159, which said of "Check what a user can see and do": "this line seems only relevant to the component-and-hook-testing.md doc. scan through this file to see if there are others." That rule and "Tests run through the React Compiler" went to component and hook testing, and "End-to-end tests use servers on this machine only" to end-to-end testing, each with its reasons.
- **On the owner's answers on #159** ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195098152)): "Replacing external dependencies" moved to unit testing with its reasons, and "Make assertions specific" stayed here, reworded in general terms, with an example for its own kind of test in each kind's document, the component one being the example it had here.
- **Kinds' documents don't point to each other,** on the owner's comments on #159 ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195510825)): "the kind-testing files should not point to eachother", then "feature testing (gherkin rules and screenplay) should be moved into a feature-testing.md file as a kind of abstraction that doesn't mention e2e testing or tooling testing … maybe we can distinguish \"abstract\" testing docs from concrete ones with a naming convention. i.e. feature-testing-conventions.md". A rule two kinds share moves to a conventions document, the owner's answer to how such a rule is handled.
  - **`feature-testing-conventions.md`** holds what end-to-end and tooling testing shared: scenarios, steps and the Screenplay, and feature contracts for deep modules with deciding that a module is deep. Their wording was made general where it named the app or a tool. The concrete documents keep the abilities, paths and words that are theirs.
  - **"Find elements as a user would" and "Replacing external dependencies"** moved to `testing-conventions.md`, since component and end-to-end tests, and unit and component tests, share them.
  - **The naming rule** is in [the index's steps](README.md#adding-a-document): `<topic>-conventions.md` for a shared document, `<kind>-testing.md` for a kind's.
  - **Mutation testing isn't a kind of test,** it checks them, so its links to and from property and tooling testing stay, and it shows no example of a specific assertion.
- **The text moved as it was,** apart from links and these edits:
  - **Headings:** each document's own title replaced its section's heading, and the headings under it moved up a level, keeping their anchors.
  - **`testing-conventions.md`'s intro,** which named what left it, and now says each kind's document adds to these rules rather than replacing them.
  - **The project table's "Put here" cells,** which now link to each kind's own rules.
  - **Pointers:** each moved section left a one-line pointer in `testing-conventions.md`, and each moved entry one in this sidecar. Each kind's document opens with one back to `testing-conventions.md`, and each new sidecar's intro links to its document and, where it cites them, to the Sources below. Component and hook testing's sidecar also points to the Browser Mode decision kept here.
  - **Tooling testing's sidecar:** a sentence that had said "this section" now names tooling testing's "Feature contracts for deep modules" section, and the owner's quote about where a convention is written gains "then the only testing document".
  - **`mutation-testing.md`:** its step for a surviving mutant now names testing conventions and tooling testing, where it had said "testing conventions" alone, and property testing where it had said "those".
  - **Outside this folder:** sentences that named testing conventions as the owner of a moved rule now name its new document. In `.gplintrc.meta.md`, the sentence whose link said tooling testing "says why" now says it's where the rule is, since the reason isn't there.

## Changed test expectations

The rule that a changed expectation needs a reason in the pull request is owned by [reviewing work](../workflow/reviewing-work.md#changed-test-expectations); its source is in that document's sidecar.

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
