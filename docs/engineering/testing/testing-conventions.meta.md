# Testing conventions: reasons and sources

Why the rules in [testing conventions](testing-conventions.md) are as they are, where they come from, and what was rejected. Read this only when changing or questioning one of them. Following the conventions needs nothing from this file.

Most of the advice comes from Kent C. Dodds. Each source below was opened and checked against what is attributed to it on 2026-11-20 or 2026-11-21, apart from those for collaboration and contract tests, checked on 2026-11-26.

## What a test checks

Why a component test checks only what a user can see and do moved with the rule to [component and hook testing's sidecar](component-and-hook-testing.meta.md).

- **Query order** comes from Kent's [Common mistakes with React Testing Library](#common-mistakes) (2020), and follows Testing Library's [query priority](#query-priority): `getByRole` first, test IDs last. Kent says to use `*ByRole` "most of the time", and to query "by the _actual_ text" rather than test IDs. Vitest's locators keep the same names except `getByPlaceholder` (Testing Library's `getByPlaceholderText`). Vitest has no `getByDisplayValue`, so it's left out of the order. Playwright names the label locator `getByLabel`, so the rule names both.
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
- **`<module>.real.test.ts` names tests that run real programs or touch the file system.** Why, and the names not taken, are in [real testing's sidecar](real-testing.meta.md).

## Writing component and hook tests

Moved with the rules to [component and hook testing's sidecar](component-and-hook-testing.meta.md).

## Mocking

- **Fake only what can't run, at the edge.** Kent: "Mocking severs the real-world connection between what you're testing and what you're mocking", and the payoff is "usually practicality". In UI tests, "I never make actual network calls." On speed: "trading confidence for a minute or two faster test suite is a bad trade" ([The Merits of Mocking](#merits-of-mocking)).
- **Never mock React's hooks.** Kent: "You throw away a LOT of confidence in doing so" ([How to test custom React hooks](#custom-hooks)).
- **`vi.mock` for directly imported third-party modules.** A repository rule, kept because `yjsProvider.ts` imports Liveblocks, `y-webrtc` and `y-indexeddb` directly. Passing them in would change its public interface for tests alone. A strict no-mocks rule, as market-research has, was not taken because it would contradict that existing test.

## End-to-end tests

Moved with the rules to [end-to-end testing's sidecar](end-to-end-testing.meta.md), and, for what every feature test shares, to [feature testing conventions' sidecar](feature-testing-conventions.meta.md).

## Property tests

Moved with the rules to [property testing's sidecar](property-testing.meta.md).

## Tooling tests and feature contracts

Moved with the rules to [tooling testing's sidecar](tooling-testing.meta.md), and, for feature contracts, to [feature testing conventions' sidecar](feature-testing-conventions.meta.md#feature-contracts).

## Collaboration and contract tests

Moved with the rules to [collaboration testing conventions' sidecar](collaboration-testing-conventions.meta.md).

## When a collaboration test earns its cost

Moved with the rules to [collaboration testing conventions' sidecar](collaboration-testing-conventions.meta.md).

## Clarity and brevity

- **Asked for by the owner on #159,** on 2026-11-26: "can you do a clarity and brevity review of the testing-conventions.md doc. things like use the active voice, prefer bulleted lists over comma seperated ones, no sentences over 25 words and unambigious instructions. feel free to also take a look at what agentpatterns.ai has to say on this sort of thing" ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7200675081)).
- **What changed:** every sentence is 25 words or fewer, counting a list's lead-in and each item apart (25 of 106 were longer). Lists that set a rule's scope, and long ones, became bullets or numbered steps; short noun lists stayed inline. Rules became imperatives in the active voice, one instruction to a bullet; a bold name that defines a term stayed a statement. Every heading, so every anchor, stayed.
- **Meaning kept:** a review compared the old and new text rule by rule, and found that a first draft had changed four rules. It had widened a ban on parameters, dropped the condition on collaboration tests, turned "`vi.fn()` is fine" and "the browser is installed by setup" into orders, and moved a qualifier; each was put back.
- **From agentpatterns.ai,** checked 2026-11-26:
  - **Positive phrasing first:** "Tell Claude what to do instead of what not to do", keeping negatives for absolute bans ([Instruction Polarity](https://agentpatterns.ai/instructions/instruction-polarity/)). So "Don't depend on state outside the test" became "Set up every piece of state the test reads inside the test", while "Never mock React or its hooks" stayed a ban.
  - **One rule, one example:** "state the rule, then show one example" ([Example-Driven vs Rule-Driven Instructions](https://agentpatterns.ai/instructions/example-driven-vs-rule-driven-instructions/)), which each kind's document already does for specific assertions.
  - **No blind references:** a path with no note on when or why to read it is a smell ([Configuration Smells in AGENTS.md Files](https://agentpatterns.ai/patterns/anti-patterns/configuration-smells-agents-md/)), which "Kinds of test" already avoided; it now leads each item with its link.
  - **The site has no page on sentence length or active voice;** the 25-word limit and the active voice are the owner's.
- **Checked by a script** that counts the words in each sentence outside code, tables and link targets.
- **The other testing documents had the same pass,** as the owner asked: "run the same review on the other testing docs" ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7201084924)). It covered the index and every kind's and practices document, following `docs/prose/clarity-and-brevity.md` from #167:
  - **Before:** 38 sentences over 25 words across nine documents; `unit-testing.md` had none, and needed no edits.
  - **After:** none, by the same script, now fixed to split a sentence that starts with a link.
  - **Kept:** every heading, code block, quotation, number, command and bold rule name. "Keep actions, such as clicks, outside the assertion" became its own bold bullet in component testing, the same rule as before.
  - **The comparison,** by a subagent given old and new text, found no rule whose meaning changed. It found one ambiguous sentence, in the CRAP document's step 3, where "the rule holds wherever the table is" had become a consequence of oxCrap's counting; it's a sentence of its own again. Three wording nits were fixed too.
- **Collaboration testing split out** after the clarity passes, as the owner asked: "Collaboration and contract tests" and "When a collaboration test earns its cost" moved to `collaboration-testing-conventions.md`, with their reasons, and every link to them was repointed. Why, the name and the trigger are in [its sidecar](collaboration-testing-conventions.meta.md#split-from-testing-conventions).

## Split into documents

- **Asked for by the owner on #154,** on 2026-11-25: "testing-conventions.md is getting too large, let's break it apart. make a docs/testing/ folder with an index readme with read triggers and seperate out a property-testing.md doc. the other testing types can be decomposed from testing-convetions.md in another pr" ([recorded](https://github.com/DetweilerRyan/split/pull/154#issuecomment-7174979414)). #154 moved property and mutation testing; [#156](https://github.com/DetweilerRyan/split/issues/156) moved the rest.
- **What moved, on [#159](https://github.com/DetweilerRyan/split/pull/159), the pull request for #156:** component and hook tests, end-to-end tests, tooling tests, the `real` project's definition and naming reasons (to real testing), and the `unit` project's own rule, which the owner asked for on that pull request, each into a document of its own in this folder, with its sidecar entries. Each left a one-line pointer in `testing-conventions.md`, as [the index's steps](README.md#adding-a-document) say.
- **The issue's open decisions, as that pull request took them:**
  - **`testing-conventions.md` moved into `docs/engineering/testing/` too,** keeping the rules every kind of test shares. So the folder owns every testing rule, and the engineering index's one testing row is the only pointer.
  - **The Sources list stays in this sidecar,** shared, since most entries back more than one document and each already has an anchor. The other sidecars link to it.
  - **One pull request for all the moves,** since they share one index and one set of links, and moving them together updates the index and the links once.
- **Three rules that apply to one kind of test moved on the owner's review** of #159, which said of "Check what a user can see and do": "this line seems only relevant to the component-and-hook-testing.md doc. scan through this file to see if there are others." That rule and "Tests run through the React Compiler" went to component and hook testing, and "End-to-end tests use servers on this machine only" to end-to-end testing, each with its reasons.
- **On the owner's answers on #159** ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195098152)): "Replacing external dependencies" first moved to unit testing with its reasons, then back, as below, and "Make assertions specific" stayed here, reworded in general terms, with an example for its own kind of test in each kind's document, the component one being the example it had here.
- **Kinds' documents don't point to each other,** on the owner's comments on #159 ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195510825)): "the kind-testing files should not point to eachother", then "feature testing (gherkin rules and screenplay) should be moved into a feature-testing.md file as a kind of abstraction that doesn't mention e2e testing or tooling testing … maybe we can distinguish \"abstract\" testing docs from concrete ones with a naming convention. i.e. feature-testing-conventions.md". A rule two kinds share moves to a conventions document, the owner's answer to how such a rule is handled.
  - **`feature-testing-conventions.md`** holds what end-to-end and tooling testing shared: scenarios, steps and the Screenplay, and feature contracts for deep modules with deciding that a module is deep. Their wording was made general where it named the app or a tool. The concrete documents keep the abilities, paths and words that are theirs.
  - **"Find elements as a user would" and "Replacing external dependencies"** moved to `testing-conventions.md`, since component and end-to-end tests, and unit and component tests, share them.
  - **Rule text made general or merged for it:** "Find elements as a user would" names what each locator matches, with Vitest's and Playwright's names for a label; feature testing's "Every other `.gplintrc`" names the root as the one copied; and its edge-case rule for deep modules merged into the scenario rule it repeated.
  - **Feature testing conventions doesn't require more than `main` did:** "What these conventions cover" says the rules under Scenarios and Steps and the Screenplay are for the features playwright-bdd runs, all of them so far, and that a set run another way says in its kind's document which it follows. Feature contracts for deep modules, and deciding that a module is deep, apply to every deep module, as they did on `main`.
  - **Its first wording of that:** its opening says this repository runs feature tests through playwright-bdd so far, rather than that every feature test does; its screenplay sentence describes a screenplay's files rather than requiring each set of features to have one of its own; and its import rule is for features playwright-bdd runs.
  - **Other wording the move changed:**
    - **Made general, itemised:** in feature testing conventions, "`npm run test:e2e` fails" became "running the features fails", "`Notes` in `actor.ts`" became "in the screenplay's `actor.ts`", "whole app" became "whole system", "how the app is built … in the words of the person doing it" became "how the system is built … in its user's words", and "What the actor does belongs in tasks, and what they read belongs in questions" is new; in end-to-end testing, "When a step needs one that doesn't exist, add it" became "Add one", and the `no-restricted-patterns` bullet names the root `.gplintrc` and says the list bans the app's words for how it's built.
    - **Tooling testing:** "A root file's test is tooling when it tests tooling config" moved into its definition and the `include` and `ignored` step for such a test into "Writing one"; its program subsection says it holds the layout and wiring; "They get no React Compiler" became "Tooling tests get"; "The screenplay is the tool's own" became "Its screenplay is the tool's own"; and its second edge-case rule, "Keep edge cases in the modules' unit tests", merged into feature testing's scenario rule along with the first.
    - **End-to-end testing:** "reading the page or a tool result belongs in questions" became "reading the page or a tool result in questions".
    - **The CRAP document** calls itself a document where it had said "procedure", as do the sentences in `oxcrap.meta.md` that named it.
    - **File names in each kind's definition** repeat the project table's, as the owner asked when they said to "point out the file naming convention". Change both together.
    - **Rewordings for the documents' structure:** the feature sidecar's "It sets up only the program kind" names where the program kind is set up; tooling testing's "Tooling tests check" and "They run" read "A tooling test checks" and "Tooling tests run"; and end-to-end testing's "in the order component tests use" reads "as testing conventions says".
    - **Feature testing conventions:**
      - "Write scenarios in the words of the feature's user" gathers what the two path tables said;
      - "Each set of features has its rules in a `.gplintrc`" is new;
      - "change a rule in both" became "change a structural rule in each of them";
      - the sentence listing a screenplay's files is new;
      - "rather than using `page` in the step" became "rather than doing the work in the step".
    - **Tooling testing:** "Follow the end-to-end tests' Screenplay rules, with these differences" and "Steps import…" are gone, since feature testing conventions now holds those rules, and the tool's screenplay rule leads its abilities and fixtures.
    - **Sidecars:**
      - the "Query order" entry gained its source and Playwright's label locator;
      - "pattern used in the doc" became "each kind's document uses";
      - feature testing conventions' sidecar notes that the end-to-end tests were the first feature tests;
      - the `.gplintrc` copy decision cites #65;
      - feature contracts' entry names the section it links to.
  - **The naming rule** is in [the index's steps](README.md#adding-a-document): `<topic>-conventions.md` for a shared document, `<kind>-testing.md` for a kind's.
  - **Mutation testing isn't a kind of test,** it checks them, so its links to and from property and tooling testing stay, and it shows no example of a specific assertion.
- **Each document's structure,** on the owner's comment on #159 ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7195935985)): "each of the testing files needs to defined their kind of testing at the top … including a section in each kind doc that explains how the general rules from the convention documents applies to this kind of testing", with the answers [recorded here](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7196053471).
  - **A kind's document** opens with what its kind of test is, naming its files as the owner asked, then "How the conventions apply", which holds each specific-assertion example and the bullets that apply a conventions rule to that kind, then its own rules. The index's steps set this order.
  - **A conventions document** opens with what it covers.
  - **Mutation testing and the CRAP score are checks of the tests,** in `<check>-testing-practices.md` documents. The owner suggested `mutation-testing-practice.md` and `crap-testing-practices.md`, then confirmed the plural for both: "plural is right for both docs" ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7196305974)). `crap.md` moved into this folder for it, and its row from the engineering index to this one, reversing the session's earlier advice that it stay in engineering: like mutation testing, it scores the code against what its tests cover.
  - **Wording changed for round 10 of the review:** the kinds' headings became "What this kind of test is" and "Rules of its own", so no heading defines a kind's name; unit testing's definition doesn't define "unit test", which the CRAP document and oxCrap use for more than the `unit` project; feature testing's edge-case rule says "Vitest tests", as `main`'s end-to-end document did, so a conventions rule names no kind; definitions name their files and point to the project table rather than restate it; end-to-end testing's definition says it's a feature test, and tooling testing's that a tool's feature contract is one; the conventions rule on `vi.fn()` says "a callback the test passes in" for "a component's callback props"; and the CRAP document's step for finding tests points to the index's document for the function's kind.
  - **True inversion:** the owner chose it over typing parts from the real ones, so the rule asks for interfaces in the code's own terms, no defaults, and a composition root; "Prefer passing the dependency in" no longer calls passing in inversion. The contract-test rule adds what the type checker can't see, Kent C. Dodds' counter-position says fakes meet the interface rather than being typed from the real collaborators, the component rule adds where the composition root is and that a context a part reads is part of its interface, and component testing's sidecar records the owner's choice. "Collaboration and contract tests" added a bullet, since superseded by the rewrite below, saying a store or service is a dependency, not a collaborator, component testing adds one for the store and services a container calls or hands its hooks, and code design principles' "When two principles pull apart" says such a dependency has no default and its interface isn't a counted seam, with a reason in its sidecar, as the owner asked ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7199099995)). `RoomView`'s code change is #165. Reopen it if the declared interfaces drift from the real parts in ways contract tests keep missing.
  - **`RoomView` is no longer an exception:** the owner asked for a general rule, which is [Collaboration and contract tests](#collaboration-and-contract-tests) in testing conventions, made specific for container components in component and hook testing. It replaces the `RoomView` rule and its pointer. For it, "Fake only what can't run" names the exception, "Prefer passing the dependency in" links to the section, "Make the test use the code the way it's really used" names wiring code as its exception, "Test a hook through the component" allows `renderHook` for a container's hooks, and code design principles' _core and shell_ and its sidecar describe `RoomView`'s `parts` as an example rather than an exception. Testing conventions' pointers moved under "Kinds of test". After round 18, "Collaboration and contract tests" was rewritten as one rule: it names its two sorts of dependency, collaborators and stores or services, inverts both, and says how a test treats each, as the owner's choices on #159 asked. After round 19, it inverts only what the code can take as a parameter, calling hooks and pure functions directly; it says where the edge is; it allows a fake store only where the test can't replace the effects under the real one; and it says the collaboration test earns the parameters once, so a collaborator with no tests is still a parameter, passed in real. That last is the session's call, made so that one composition root wires every collaborator, as true inversion asks; reopen it if a container's untested parts are better imported directly. "Fake only what can't run" and _core and shell_ now point to the fakes the section allows, and component testing keeps only what's specific to components. After round 20, a store or service runs for real when it takes its effects as parameters and is faked when it opens them itself; "imports nothing that implements it" means no implementing value or type, not the whole module; the root binds nested code once or memoizes it, since React remounts a component defined during render; and code design principles' "When two principles pull apart" names the untested-collaborator exception. After round 21, _core and shell_ owns one wording, "importing no value or type that implements it", which testing conventions and this sidecar repeat; component testing says a container may import a context a part reads, and that a browser global a hook defaults isn't one of its services; and a nested binding is created once, at module level or with a `useState` initializer, since React may drop a `useMemo` cache. After the owner's comments on the ready pull request, testing conventions gained "When a collaboration test earns its cost", as asked ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7200406868)), which took the "earns the parameters" bullet and "split the code" from "Collaboration and contract tests"; container rules say slots, not parts, in bullets; and real testing was split out with the `real` project's definition and its naming entry, while the offline rule for every `.real.test.ts` stayed in "Tests stay offline". After round 22, the earned section says most collaborators have tests rather than each, narrows an interface to what the code uses, prefers an element slot to a component slot, and qualifies "don't add a parameter" for code no collaboration test has earned.
  - **Common subsections,** on the owner's comment on #159 and answer ([recorded](https://github.com/DetweilerRyan/split/pull/159#issuecomment-7196584610)): every kind's "Rules of its own" has "When to write one", "Writing one" and "When one fails", from property testing's headings, filled only from rules that already existed, with a pointer to the conventions rule where a kind has none. "When to write one" points to testing conventions' "What a test checks" in unit, component and tooling testing, and to feature testing's "Scenarios" in end-to-end testing; "When one fails" points to "Fixing a bug", and in end-to-end and tooling testing also to feature testing's steps.
  - **Tooling testing's program rules** (its screenplay's abilities and fixtures, running the program as a process, a scenario's scope, and the tool's own words) apply feature testing conventions, so they sit in "How the conventions apply" under a bullet that names a deep module that's a program, keeping the scope they had under that heading on `main`.
  - **Wording changed for it:** testing conventions' intro now defines its scope; each kind's definition states its files' names, which the project table also sets; property testing's "Put it in its own sidecar" folded into its definition; and the first deep module used through code now puts its rules in its kind's document, a sentence that moved from tooling testing to feature testing conventions.
- **The text moved as it was,** apart from links and these edits:
  - **Headings:** each document's own title replaced its section's heading, and the headings under it moved up a level, keeping their anchors.
  - **`testing-conventions.md`'s intro,** which named what left it, and now says each kind's document adds to these rules rather than replacing them.
  - **The project table's "Put here" cells,** which now link to each kind's own rules.
  - **Pointers:** each moved section left a one-line pointer in `testing-conventions.md`, now gathered under its "Kinds of test", and each moved entry one in this sidecar. Each kind's "How the conventions apply" points back to `testing-conventions.md`, and each new sidecar's intro links to its document and, where it cites them, to the Sources below. Component and hook testing's sidecar also points to the Browser Mode decision kept here.
  - **Feature contracts' sidecar entry,** which had said "this section", now names the section it links to, and the owner's quote in tooling testing's sidecar about where a convention is written gains "then the only testing document".
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
- <a id="rainsberger-contract-tests"></a>J. B. Rainsberger, [Who Tests the Contract Tests?](https://blog.thecodewhisperer.com/permalink/who-tests-the-contract-tests), 2018, updated 2020.
- <a id="rainsberger-getting-started"></a>J. B. Rainsberger, [Getting Started with Contract Tests](https://blog.thecodewhisperer.com/permalink/getting-started-with-contract-tests), 2017-06-25.
- <a id="mock-roles"></a>Steve Freeman, Nat Pryce, Tim Mackinnon and Joe Walnes, [Mock Roles, not Objects](http://jmock.org/oopsla2004.pdf), OOPSLA 2004.
- <a id="mocks-arent-stubs"></a>Martin Fowler, [Mocks Aren't Stubs](https://martinfowler.com/articles/mocksArentStubs.html), 2007-01-02.
- <a id="fowler-unit-test"></a>Martin Fowler, [UnitTest](https://martinfowler.com/bliki/UnitTest.html), 2014, revised 2017.
- <a id="humble-dialog-box"></a>Michael Feathers, [The Humble Dialog Box](https://martinfowler.com/articles/images/humble-dialog-box/TheHumbleDialogBox.pdf), 2002.
- <a id="react-composition"></a>React, [Composition vs Inheritance](https://legacy.reactjs.org/docs/composition-vs-inheritance.html), legacy docs, no longer updated; checked 2026-11-26.
- <a id="react-rules-hooks"></a>React, [React calls Components and Hooks](https://react.dev/reference/rules/react-calls-components-and-hooks), checked 2026-11-26.
- <a id="rtl-faq"></a>Testing Library, [React Testing Library FAQ](https://testing-library.com/docs/react-testing-library/faq), checked 2026-11-26.
- <a id="martin-dip"></a>Robert C. Martin, [The Dependency Inversion Principle](https://cs.utexas.edu/~downing/papers/DIP-1996.pdf), _C++ Report_, 1996; checked 2026-11-26.
- <a id="seemann-abstract-factories"></a>Mark Seemann, [Placement of Abstract Factories](https://blog.ploeh.dk/2014/12/24/placement-of-abstract-factories/), 2014-12-24.
- <a id="dip-in-the-wild"></a>Brett L. Schuchert, [DIP in the Wild](https://martinfowler.com/articles/dipInTheWild.html), 2013-05.
- <a id="seemann-succeeding-di"></a>Mark Seemann, [Succeeding with Dependency Injection](https://www.infoq.com/articles/Succeeding-Dependency-Injection), InfoQ, 2011-12-19.
- <a id="seemann-composition-root"></a>Mark Seemann, [Composition Root](https://blog.ploeh.dk/2011/07/28/CompositionRoot/), 2011-07-28.
- <a id="react-select-components"></a>react-select, [`components/index.ts`](https://github.com/JedWatson/react-select/blob/master/packages/react-select/src/components/index.ts); checked 2026-11-26.
- <a id="ts-type-compatibility"></a>TypeScript, [Type Compatibility](https://www.typescriptlang.org/docs/handbook/type-compatibility.html); checked 2026-11-26.
- <a id="react-context"></a>React, [Passing Data Deeply with Context](https://react.dev/learn/passing-data-deeply-with-context); checked 2026-11-26.
- <a id="kcd-state-management"></a>Kent C. Dodds, [Application State Management with React](https://kentcdodds.com/blog/application-state-management-with-react), 2020-07-21.
- <a id="react-redux-701"></a>React Redux, [v7.0.1 release notes](https://github.com/reduxjs/react-redux/releases/tag/v7.0.1), 2019-04-09.
- <a id="tkdodo-zustand-context"></a>Dominik Dorfmeister, [Zustand and React Context](https://tkdodo.eu/blog/zustand-and-react-context), 2024-04-14.
- <a id="react-pure"></a>React, [Components and Hooks must be pure](https://react.dev/reference/rules/components-and-hooks-must-be-pure); checked 2026-11-26.
- <a id="tanstack-testing"></a>TanStack Query, [Testing](https://tanstack.com/query/latest/docs/framework/react/guides/testing); checked 2026-11-26.
- <a id="react-use-sync-external-store"></a>React, [`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore); checked 2026-11-26.
