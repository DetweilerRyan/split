# oxCrap: reasons and sources

Why oxCrap, the CRAP script in this folder, its `@crap-allow` comments and the CI step work the way they do, and why [the CRAP score procedure](../../docs/engineering/crap.md) says what it says. Read this only when changing or questioning them. Responding to a finding needs only the procedure.

Decided by the owner on [#63](https://github.com/DetweilerRyan/split/issues/63), which records the trial, the research and each decision, all approved on 2026-11-22. In feedback on [#64](https://github.com/DetweilerRyan/split/pull/64) the same day, the owner then changed it in three rounds:

- **[`crap-allow` comments](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7083296497)** replaced the baseline file.
- **[`oxc-parser`, our own complexity count, `@crap-allow`, and this folder of modules](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7083803193).**
- **[The script reads a coverage report instead of running the tests](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085342018).**
- **[It checks every function, and reads no git diff](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085953510).**

[The name oxCrap](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085518444) came last; see [the name](#the-name).

## What the research found

Checked 2026-11-22. Most sources are practitioner posts, vendor posts, tool documentation and a few 2026 preprints. None is a rigorous study of CRAP gates on coding agents' output.

- **Gate the functions a change touches.** The most complete CRAP gate built for agents, [smixs/code-quality](https://github.com/smixs/code-quality), uses complexity ≤ 10 and CRAP ≤ 30 on changed functions.
- **More capable models still let complexity pile up.** [SlopCodeBench](https://arxiv.org/html/2603.24755) found "structural erosion", complexity collecting in functions over 10, rising in 77% of runs across 15 agents, including the strongest tested.
- **Coverage is the easiest part to game.** [Thoughtworks](https://www.thoughtworks.com/radar/techniques/mutation-testing) and [SpecBench](https://arxiv.org/html/2605.21384v1) report agents' tests reaching high coverage while catching little. Reported patterns include trivial assertions, skipped tests and splitting functions only to pass a limit ([understandingdata.com](https://understandingdata.com/posts/goodharting-prevention-agent-systems/), [Doug Haber](https://medium.com/@DougHaber/keeping-ai-generated-code-under-control-with-complexity-limits-46d701b4c1e3)).
- **Score with a script, not an LLM,** and fail loudly when a tool is missing rather than pass by never running.
- **Advise inside the agent's loop, block in CI** ([Stop hooks](https://fbakkensen.github.io/ai/devtools/development/2026/03/27/quality-gates-for-coding-agents-how-stop-hooks-make-validation-mandatory.html)).
- **Baseline files keyed by name or path break on renames and moves, and hold no reasons.** That covers [ESLint's bulk suppressions](https://eslint.org/docs/latest/use/suppressions), [oxlint's RFC](https://github.com/oxc-project/oxc/discussions/22198), [detekt](https://detekt.dev/docs/introduction/baseline/), PHPStan and [cargo-crap](https://docs.rs/cargo-crap/0.2.0/src/cargo_crap/delta.rs.html).
- **Inline exceptions with a required reason move with the code.** Examples are `@ts-expect-error <reason>`, `eslint-comments/require-description` and [Biome's suppressions](https://biomejs.dev/analyzer/suppressions).

## Decisions

- **Limits: CRAP 30, complexity 10.** CRAP 30 is crap4j's and cargo-crap's default. The complexity limit catches a well-tested function that is still too complex, since full coverage only brings CRAP down to the complexity.
- **Every function is checked against the limits,** not only those a branch changes.
  - **The owner's words:** "yes, check every function and drop the git diff".
  - **#63 first chose changed functions only,** so that existing debt wouldn't fail pull requests that never touched it. Once every function over the limits had to carry a `@crap-allow` comment, existing debt had a record of its own, and checking every function gave the same result on the code as it stood.
  - **It also catches an untouched function pushed over the limits,** for example by a pull request that deletes or weakens its tests. That's the one case where the two differ.
  - **Dropping the diff dropped git:** `--base`, the merge-base lookup and CI's full-history checkout all went with it.
- **Exceptions are hand-written `@crap-allow` comments directly above the function.** The owner chose them over a baseline file so that exceptions survive renames and moves, and so that the script never writes to source files ("not a big fan of --write-baseline modifying the code").
  - **It's `@crap-allow`, not `crap-allow`,** "following typescripts lead" with `@ts-expect-error`: a directive is a comment that starts with it. A comment that only mentions it is prose.
  - **The format is `// @crap-allow CRAP <score>, complexity <n>. <reason>`.** A longer reason goes in a block comment, which also serves JSX as `{/* … */}`. Continuing a reason over `//` lines was dropped: it swallowed lint directives on the lines below into the reason.
  - **A doc-comment tag form (`/** … @crap-allow … */`) was left out,** since there the directive wouldn't start the comment.
- **The comment carries the function's numbers, and every comment is checked against them.** The owner's words: so "the crap script can flag (warn in the hook and error/fail in ci) when the numbers in a crap-allow comment don't match the function anymore."
  - **This is the ratchet #63 approved.** A function that gets worse, or better, no longer matches its comment, and the fix is a visible edit to that comment.
  - **It replaces a merge-base comparison:** with the numbers in the comment, there's nothing to compare against.
- **A comment applies to the function starting on the next line of code.** Lines holding only other comments are skipped. It's an error, not a guess, when two functions that don't contain each other start on that line.
- **The 15 functions over the limits when the check started have comments** saying so ("Debt from before the CRAP check (#63)"). Replace a reason with a real justification when you next work on its function.
- **Coverage comes from all three Vitest projects together.** Components and hooks are tested in the `browser` project ([testing conventions](../../docs/engineering/testing-conventions.md#which-project-a-test-belongs-in)), so `unit` coverage alone would score every component at 0%.

### The script reads coverage; it doesn't run the tests

- **The owner's words:** "the test suite should write a coverage report to disk and the crap script should take the path to the coverage report as a command argument. the goal should be that the crap script is largely independant of the rest of the app and should not assume where or how to execute this project's unit tests."
- **Every `npm test` writes the report.** [`vitest.config.ts`](../../vitest.config.ts) turns coverage on for every run, writing `coverage/coverage-final.json`. It took the suite from about 4 s to 5 s. CI's `Tests` step writes the report and its `CRAP score` step reads it, so CI runs the suite once instead of twice.
- **The script knows nothing of this project.** It takes the report (`--coverage`), the paths to score and an optional place to get help (`--help-url`). It reads files and runs nothing: no tests, no git, nothing from npm. It works on any folder of code, in a git repository or not, skipping `node_modules` and dot-folders. [`package.json`](../../package.json)'s `oxcrap` script supplies this repository's values.
- **A stale report is refused, not scored.** The script fails when the report is older than any file under the scored paths, tests included. That way a report from before the latest edits can't make a function look covered.
  - **A failed test run can't leave a stale report behind:** Vitest empties `coverage/` at the start of a run, and writes no report when a test fails.
  - **A partial run is the one gap:** a run of some test files writes a fresh report with only their coverage. That can only lower coverage, so it makes false findings, never a false pass.

### Coverage never comes from end-to-end tests

- **The owner set the rule:** "crap testing should never include e2e tests" ([feedback](https://github.com/DetweilerRyan/split/pull/66#issuecomment-7106226667)). It came up when oxCrap was tried on itself: its CLI, tested only by its features, showed 0% coverage. Collecting coverage from the processes the features start was offered, and turned down.
- **Why:**
  - **A run of the whole program executes far more than it checks.** A scenario that asserts one line of output counts every line it passed through as covered. Coverage then overstates how well a function is tested, so its CRAP score comes out lower than it should.
  - **It would let a function pass by being run rather than tested,** instead of by being split up or unit tested. That's the pressure CRAP exists to apply.
- **It was already so:** the app's coverage came from Vitest's projects (`npm test`), and never from `npm run test:e2e`.
- **Where the line falls:** the `unit` and `browser` projects count, property tests included. `browser` holds the component and hook tests, which run in a browser only because jsdom does no layout. Playwright scenarios against the app, and a deep module's feature contract against its CLI, don't count.
- **`real` tests don't count either,** the owner decided after first leaving them in (session, 2026-11-23): "i'm not so sure that real tests should be covered by crap", then "yes and make the change now".
  - **Why:** a real test runs real programs and files, and tends to run far more code than it checks, as an end-to-end test does. oxCrap's reformatting check runs every function of its parser on 40 files, but asserts only that layout changes nothing.
  - **The same rule as mutation testing:** [#77](https://github.com/DetweilerRyan/split/issues/77) uses only unit and property tests, so both scores mean "tested" the same way.
  - **What it costs:** `.real.` names a test's size, not its scope, and a narrow real test, such as `prepare-sandbox.real.test.ts`, does check closely. Its coverage is lost. That's accepted, since logic worth checking closely belongs in a unit-tested module.
  - **How:** Vitest collects coverage across every project in a run, so `npm test` runs the `real` project in a second pass with coverage off. When the change was made, the app had no real tests, so no score changed.

### The Stop hook

The project's Claude Code Stop hook runs `npm run oxcrap:app` or `npm run oxcrap:tooling`, for what changed, and passes their findings to Claude. It's the project's own script, not part of oxCrap: its README is [`../stop-hook.md`](../stop-hook.md), and its reasons are in [`../stop-hook.meta.md`](../stop-hook.meta.md).

### Our own complexity count

- **The owner asked for it** once `oxc-parser` was in: "i don't think it really matters if it drifts from ESLint's rules … this way the crap script does not need to have to read the output of oxlint."
- **Drift doesn't matter here.** Complexity has no single official count, and the limits are rules of thumb.
- **Owning the count keeps every comment's numbers stable.** An oxlint update that changed how it counts would have stopped every affected `@crap-allow` comment matching, and failed CI on the upgrade alone.
- **The rules are in [`complexity.ts`](complexity.ts).** Start at 1, then add 1 for each `if`, `?:`, loop, non-default `case`, `catch`, `&&`, `||` and `??`, including `&&=`, `||=` and `??=`.
  - **Everything that branches counts by default** ([#74](https://github.com/DetweilerRyan/split/issues/74#issuecomment-7108596445)): nested functions' branches towards the outermost function, default values, and each `?.`. Each is a `counting` option.
  - **A JSX condition such as `{open && <Modal />}` counts,** as a branch it is.

### Counting everything that branches

[#74](https://github.com/DetweilerRyan/split/issues/74) changed what counts, as the owner decided ([decisions](https://github.com/DetweilerRyan/split/issues/74#issuecomment-7108596445)).

- **Why nested functions count towards the function around them:** the owner [argued](https://github.com/DetweilerRyan/split/pull/71#discussion_r4668877357) that a `filter` callback is the same logic as a `for` loop with an `if`, which counted. Scored apart, the same logic scored lower for being written as a callback. `hydrateFromSeed` scored 1, because its whole body was a `ydoc.transact` callback.
- **Every nested function, not only callbacks,** as SonarSource's Cognitive Complexity does: its [white paper](https://www.sonarsource.com/docs/CognitiveComplexity.pdf) (version 1.7) counts a lambda's contents towards the enclosing method. The owner chose this over callbacks only. A function written inside another is part of it.
- **Coverage rolls up with it,** since CRAP combines the two. Each statement counts towards the outermost function around it.
- **A comment above a nested function fails** and names the function to move it to, rather than being applied to the outer one silently.
- **A higher-order call isn't a branch in itself.** Neither ESLint nor Sonar counts one, and `items.filter(…)` can't be told from any other method call by name.
- **Default values and `?.` count,** as in ESLint's `complexity` rule ([docs](https://eslint.org/docs/latest/rules/complexity)): "`function c(a = {}) { // default parameter -> 2nd path`", and "optional chaining with two optional properties creates two additional branches". #64 had left them out because they inflated the scores of plain data-handling code. The owner chose to count all branching.
- **Each is an option, all on by default.** The owner said "we default to all complexity branching counted". ESLint's `variant` option is a precedent for configurable counting.
- **What it changed here:** 10 `@crap-allow` comments got new numbers, and 4 comments on nested functions moved up into 3 on the functions around them.
  - **The biggest changes:** `hydrateFromSeed` went to complexity 30, `createSnapshot` from 13 to 27, `createProvider` from 12 to 24, and `RoomView` from 10 to 22.
  - **Newly over the limits,** with stand-in comments citing #74: `ParticipantCards` and `useReceiptStore`.
- **Four more options, from precedent** ([feedback](https://github.com/DetweilerRyan/split/pull/75#issuecomment-7109114547)). Asked whether counting rules from before #74 should be options too, the owner said "let's add the new options to this pr. also, elts add the counts that sonar has and we don't".
  - **`switchCases`:** `"once"` counts a whole `switch` once. That's ESLint's `variant: "modified"`, and Sonar's rule that "a switch and all its cases combined incurs a single structural increment".
  - **`logicalOperators`:** `"sequence"` counts each run of the same operator once, as Sonar's "fundamental increment for each sequence of binary logical operators" does. Runs are read in source order, looking through parentheses: `a && b && c` and `(a && b) && c` are one run, `a && b || c` two, and `a || b && c || d` three.
  - **`recursion`:** Sonar counts "each method in a recursion cycle". oxCrap adds 1 to each scored function that calls itself, or calls one that leads back to it. [`recursion.ts`](recursion.ts) finds the cycles.
    - **How it resolves a call:** as JavaScript does, within the file, as [the README](README.md#how-oxcrap-scores) lists. Calls through other objects, variables or files aren't followed, since that needs type information a parser doesn't have.
    - **The scope rules #87 fixed,** found while killing mutants on [#79](https://github.com/DetweilerRyan/split/issues/79). Each changed scores:
      - **A static block opens its own scope,** for its `let`s and `const`s and for its `var`s, which stay in the block as a function's do (ECMA-262's ClassStaticBlockDefinitionEvaluation).
      - **Parameters get a scope of their own,** so a default value or a computed key in a pattern sees the scope around the function, not the body's names. The spec does this only when the parameters hold an expression (FunctionDeclarationInstantiation's `hasParameterExpressions`). oxCrap does it always: without such an expression no code in the parameter list runs, so the split changes no lookup, and the condition would be dead code.
      - **Private names are kept with their `#`,** so `this.#m()` reaches `#m` and never `m`, and `this.m()` never `#m`.
      - **An instance field hides a method of its name** wherever it's written, since it's set on the instance, in front of the prototype. A static field doesn't, being on the class.
      - **`new f()` inside `f` is recursion,** as the owner decided (session, 2026-11-24): the constructor runs `f`'s body again. It's followed for any callee, though calling an arrow or method with `new` throws.
      - **A `var` that declares a catch parameter again** gives the parameter its value inside the catch block (Annex B.3.4): there its name is the parameter. The function-level `var` it also declares still gets the value, though at run time it stays `undefined`.
    - **Calling a nested helper of your own isn't recursion,** though under `enclosing` the helper's code counts towards you. A nested callback that calls back into the function around it is recursion under `enclosing`, since its code is that function's. Under `own` it isn't, as the two are scored apart and neither calls the other by name.
    - **A property test checks it on random call graphs,** as the owner suggested ([feedback](https://github.com/DetweilerRyan/split/pull/75#issuecomment-7109824097)): "recursion seems like a good candidate for property tests".
      - **What it generates:** declarations, `const` arrows, or public or private class methods, with decoy calls that must never count. The decoys are a binding of the same name, another object's method, `this` inside a nested `function`, and a stub of the same name in the other privacy. Real calls are plain, through `new`, or in a default value past a body `const` of the same name. The hiding bindings include a static block's `const` and `var`, and a body `const` in a function with a default value. A public method may have an instance field of its name, before or after it, or a static one.
      - **Undoing each of #87's fixes fails it,** apart from the catch parameter's: under `enclosing`, a call to a nested function reaches nothing scored, so which binding it reaches doesn't change a score, and an example test checks it under `own`.
      - **What it compares with:** a plain search from each function, which shares nothing with the strongly-connected-components pass.
      - **It catches real breaks:** dropping self-calls, letting parameters stop hiding names, and letting a nested function keep the class's `this` each failed it. Each shrank to a one- or two-function case.
    - **The first version matched calls by display name,** across scopes. An independent review found it counted a bare `m()` as calling a class method `m`, and a parameter named `f` as `f` calling itself. It was also slow when many functions shared a name. Resolving by scope, and one strongly-connected-components pass, fixed both.
  - **`switchCases`' `"once"` mode counts a `switch` only if it has a case beyond `default:`,** so it never adds a path `"each"` wouldn't. ESLint's `"modified"` variant counts every `switch`.
  - **`labelledJumps`:** Sonar counts a `break` or `continue` to a label. A plain `break` adds nothing, since the loop it leaves is already counted.
  - **Defaults:** all count, except that a `switch` and a logical run count per case and per operator, as before. That's consistent with counting everything by default.
  - **Not added: `else`, and nesting increments.** Both are on Sonar's list, but they belong to Cognitive Complexity's readability score, not to paths through the code. An `if` already has two outcomes, so counting its `else` too would score every `if`/`else` 2. CRAP's formula is built on cyclomatic complexity.
    - **The owner decided:** "leave them out, open an issue for max-depth" ([decision](https://github.com/DetweilerRyan/split/pull/75#issuecomment-7109938912)).
    - **Why nesting gets its own limit:** research finds models understand deeply nested code worse ([arXiv 2609.37405](https://arxiv.org/abs/2609.37405)). Classical metrics, though, don't predict how models do on whole tasks once code length is controlled ([arXiv 2602.07882](https://arxiv.org/html/2602.07882v2)).
    - **Where it's limited:** nesting is a risk of its own, so [#76](https://github.com/DetweilerRyan/split/issues/76) limits it through oxlint's `max-depth` and `max-nested-callbacks`, as ESLint separates `complexity` from `max-depth`.
  - **Nothing in this repository changed:** `src/` and `app/` have no recursion and no labelled jumps.
- **The fast-check property** checks every combination of the options. Its grammar keeps a function's own branches, its default values, its `?.` links and its nested functions' contents apart.

### oxCrap scores itself

- **The owner's choices ([#70](https://github.com/DetweilerRyan/split/issues/70), session, 2026-11-23):**
  - the config is `scripts/oxcrap/.oxcraprc.json`;
  - `npm run oxcrap` scores the app, then oxCrap, so it stays one definition-of-done row and one CI step;
  - it scores oxCrap only, without its tests or `features/`, and other tooling waits for its own issues;
  - "Refactor everything": every function over the limits was refactored rather than allowed, except `adds` (below).
- **The tooling Vitest config split in two,** a unit config with coverage and a real config without, so only unit and property tests count, as [Coverage never comes from end-to-end tests](#coverage-never-comes-from-end-to-end-tests) says. The owner chose this over a third config just for Stryker ("add option 3 to #70"), which then points at the unit config.
- **`oxcrap:app` and `oxcrap:tooling`** exist so the Stop hook scores only what changed, and a fresh worktree with one report missing isn't refused.
- **Functions, not stateful classes.** The owner, on [#81](https://github.com/DetweilerRyan/split/pull/81#discussion_r4671675741): "i'm not a big fan of using stateful OOP when largely pure functional approaches result in simpler and less dynamic and therefore less error prone runtime execution."
  - **The call graph** is found by functions that pass an immutable context down (the scopes, the function and what `this` reaches) and return the calls they find, rather than a class pushing and popping stacks. Functions walk a file's tree the same way.
  - **A function is in a cycle when it leads back to itself.** That replaced Tarjan's algorithm, whose index, low-link and stack are the most state of all. Tarjan finds every component in linear time; checking each function's reach costs O(V·(V+E)) for V functions and E calls. On this repository's files that made no measurable difference: the largest file holds 43 functions, and a pass over every file went from about 100 ms to about 105 ms. A synthetic file of 2,000 functions in one call chain took about half a second instead of 22 ms. Nothing caps a file's size, so a generated file that big would be slow, though not wrong.
  - **Both walks add what they find to one list they pass down,** as `boundNames` does, rather than joining each child's list. That list is the only state, and it's local to one walk. It keeps each level of the tree to one small stack frame: oxCrap parses a chain of 3,750 nested `a + …`, against 4,199 with the classes and 1,329 when each level joined its children's lists. Nothing in this repository nests a tenth as deep.
  - **`run.ts`'s `Run` class stays:** it holds only the `Host` it's given, which never changes.
- **The command line's logic moved to `run.ts`,** behind a `Host` of file-system calls, so unit tests reach it. The feature contract still runs the real program, but counts for none of its coverage.
- **A report that isn't a JSON object is refused** as "isn't an istanbul JSON coverage report". Before, `null` crashed with a TypeError. An independent review flagged this as the refactor's one change in behaviour, and it was kept as a fix.

### Lookup tables don't lower a score

- **The owner set the rule** on [#81](https://github.com/DetweilerRyan/split/pull/81#discussion_r4671330070), where a refactor had moved `adds`'s cases into a `Map` of functions: "moving a switch statement (static) into a runtime data structure is never the right solution to reducing cyclomatic complexity. this is a cheat to get around the crap thresholds."
- **It covers lookups and `Set.has` too,** not only switches: the owner's answer on what the guard should count was "Lookups and Set.has" ([feedback](https://github.com/DetweilerRyan/split/pull/81#issuecomment-7112721212)), so a chain of conditions moved into a `Set`, or cases into an object, is the same move.
- **Why:** the paths are still there, chosen by a key instead of a `case`. Counting stops seeing them, so the score drops without the code getting any simpler to test.
- **`adds` is allowed instead.** It's one dispatch over the node types that add paths. The owner chose "Allow it" ([feedback](https://github.com/DetweilerRyan/split/pull/81#issuecomment-7112721212)).
- **oxCrap now counts the move,** as [Lookup tables count](#lookup-tables-count) says, so review no longer has to catch it alone.

### Lookup tables count

- **What counts was the owner's choice, in [#82](https://github.com/DetweilerRyan/split/issues/82#issuecomment-7114376828).** Asked whether oxCrap could tell "objects/maps that are used to control the flow of logic vs objects/maps/sets that are simply there to hold data", the owner chose "Yes, split them":
  - **a dispatch table,** one with a function among its entries, read with a runtime key, counts one per entry, as a switch does;
  - **a membership test,** `.has`, `.includes` or `in`, counts as an `||` chain does;
  - **a table of plain values** counts nothing.
- **Why the split falls there:** a table controls flow when a read decides which code runs, and holds data when it decides only which value comes back. Every key of a data table goes down the same path, so no entry needs a test of its own. The same mapping written as a switch of `case 'US': return 'USD'` lines would count each case, but there the switch is the poorer way to write it.
- **Why membership counts wherever it's written,** even in `return S.has(x)`: the `x === a || x === b` chain it stands for counts there too. A named predicate, such as `isFunctionType`, pays for it once, as a helper wrapping that chain would. That's how `FUNCTION_TYPES` became `isFunctionType` when this landed.
- **Judging by what the entries hold** is sturdier than judging by how a read is used. `const handler = T[k]; handler()` still counts, and so does passing the looked-up function on.
- **The owner's other choices** ([decisions](https://github.com/DetweilerRyan/split/issues/82#issuecomment-7114376828)):
  - "Yes, count it": a call through a computed member, `x[k]()` or `this[name]()`, adds 1. It catches behaviour named indirectly, such as a table of method names.
  - "Follow relative imports": otherwise moving the table into another module would dodge the count. Package imports aren't followed.
  - "Literal plus top-level adds": a table built empty and filled at the top level still counts. Additions inside a function make it state, not a table, and so does any other change a function makes: setting, bumping or deleting a key, or a method such as `.delete`, `.push` or `.sort`.
- **A table's entries can be functions from another module.** Following imports for tables alone left a dodge, which an independent review found: move the handlers into another file, and `{ a: h1, b: h2 }` looked like data. A module's exports carry the names of its functions as well as its tables, so a named import of one counts as a function.
- **A local of the same name hides the table,** as JavaScript resolves it: a parameter, a `const` or a hoisted `var` called `RULES` isn't the `RULES` table, so a read or a change through it doesn't count. `recursion.ts`'s scopes decide it, as they do for calls.
- **What the top level does to a table counts however it's written** ([#88](https://github.com/DetweilerRyan/split/issues/88)): a function declared with `export default function f() {}` names a function as `function f() {}` does, and `export = S.add('b')` or `export default S.add('b')` adds an entry as `S.add('b');` does. Killing `tables.ts`'s surviving mutants on #79 found both missed, and, in [a third item posted later as a comment](https://github.com/DetweilerRyan/split/issues/88#issuecomment-7122471415), that a read with no key, `T.get()`, counted as a dispatch; it reads `undefined`, a key known before it runs, so it's none. The issue thought `export =` might be left, since it's rare in ESM code, but counting it keeps the code to the README's rule that the top level's adds count. Only the add or the declaration itself counts: `export default S.add` with no call, an add inside an exported array, or `export default (function f() {})`, a function expression that binds no `f` in the module, adds nothing. A default export is followed only within its file: a default import isn't, as "What would reopen this" lists.
- **A cast on the table doesn't hide it:** `(T as Record<string, () => void>)[k]` counts as `T[k]`, since that's how TypeScript code usually indexes a literal object with a string key.
- **It counts under `switchCases` and `logicalOperators`,** so that with `once` or `sequence` a dispatch or a membership test adds 1, as the switch or chain it stands for would. A property test checks that a switch moved into a table, or a chain moved into a `Set`, `.includes` or `in`, scores as it did under every combination of the other counting options. It also varies where the table lives (in the file, imported whole, with its handlers imported, or with every entry naming one function the file declares, exports or default-exports, or a default-exported function expression that names none), whether the top level adds its last entry and how (as a statement, with `export =` or with `export default`), look-alike adds beside the table (`export default T.add` with no call, or an add inside an exported array), which must change nothing, casts on the read, static keys and a missing one, which must read as no table, decoy functions that change the table or something else, and locals of the same name, which must make the read count as if the name were no table at all. Undoing any of the four fixes an independent review prompted (imported handlers, casts, tables changed inside a function, shadowing), or any of #88's three (two in the issue, the third in its comment), makes it fail, and so does counting any of its look-alikes.
- **When it landed,** the app's code had no dispatch tables and no membership tests on a table, only data tables such as `REGION_CURRENCIES` and `COMMON_CURRENCIES`, so no app score changed. In oxCrap:
  - `adds` rose from 25 to 34, through its `BRANCHES` and `LOGICAL_ASSIGNMENTS` lookups, and its allow was updated;
  - `complexity` and `walk` went over through `FUNCTION_TYPES.has`, which became the `isFunctionType` predicate;
  - `walk` split its per-node recording into `record`.

### The name

- **The owner renamed it from `crap` to oxCrap** "so that it's more in line with the oxc family of tools. maybe we'd open source it some day."
- **"oxCrap" is the name in prose; files and commands are `oxcrap`:** the folder `scripts/oxcrap/`, its entry point `oxcrap.ts`, and `npm run oxcrap`.
  - The oxc tools are all lowercase: `oxlint`, `oxfmt`, `oxc-parser`.
  - npm refuses a package name with capitals, so a published package would have to be `oxcrap` anyway.
- **The metric keeps its name:**
  - the `@crap-allow` directive;
  - the `CRAP score` CI step;
  - the "CRAP findings" messages;
  - the [CRAP score procedure](../../docs/engineering/crap.md).

  They name the metric, not the tool, as `@ts-expect-error` names the language rather than `tsc`. Renaming the directive would also have meant rewriting every comment in `src/`.

- **Before publishing it,** weigh that an `ox` prefix can read as part of the official oxc project. Ask its maintainers, or say in the README that it's unofficial.

### The README

- **The owner asked for it:** "we should put a README.md file in the oxcrap folder. it should introduce the concept of crap and detail usage for the oxcrap cli tool."
- **[`README.md`](README.md) is the tool's documentation, and owns it.** It covers:
  - what CRAP measures;
  - how oxCrap scores;
  - the command line, its options and output;
  - the `@crap-allow` rules.
- **The `@crap-allow` rules moved there from the [CRAP score procedure](../../docs/engineering/crap.md), and the usage from `oxcrap.ts`'s header,** so each is written once ([single source of truth](../../docs/prose/single-source-of-truth.md)). The procedure keeps what's particular to this repository: where findings come from, how to respond, when to allow a function, and replacing the stand-in reasons.
- **The README links to the counting rules** in `complexity.ts` rather than restating them, since the code owns them. It does list the config's options and defaults, for people to read; `config.ts` owns them, `config.test.ts` checks the schema against it, and [`README.real.test.ts`](README.real.test.ts) checks the README. Its output example is real output, from a run on a small throwaway project.
- **It's written to stand alone,** with only a short "In this repository" section at the end, so it could serve as the README of a published package.

### The config file

- **The owner asked for it:** "the crap tool should take a config file as input. it can assume a default name and location while also accepting a config file path as an arg. the config file can include the threshold limits as well as path globs for which files to check against and anything else that you think may be useful. the config file format should follow oxc family precedents." ([feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7086228840))
- **It follows oxlint and oxfmt,** checked in their 1.91.0 and 0.76.0 releases:
  - **the name:** `.oxcraprc.json` or `.oxcraprc.jsonc`, looked up in the current directory, like `.oxlintrc.json` and `.oxfmtrc.json`;
  - **the flag:** `-c, --config <path>`;
  - **the format:** JSON with comments and trailing commas;
  - **the schema:** a `configuration_schema.json` beside the code, for a `$schema` key;
  - **the names:** camelCase keys. `ignorePatterns` is the name both tools use, and `files` is what oxlint's overrides call their globs.
- **The options are what a run needs to differ between projects:** `files`, `ignorePatterns`, `limits`, `coverage` and `helpUrl`. With `coverage` and `helpUrl` in the config, `npm run oxcrap` needs no arguments.
- **The command line overrides the config,** option by option, and paths given on it replace `files`, so one-off runs need no second config.
- **A config covers its own folder,** as oxlint's does, and oxCrap refuses a `files` glob reaching outside it. One reason found while building it: the default `**/.*/**` pattern, meant for dot-folders, also matches `..`.
- **Unknown options and wrong types are errors,** not warnings, and so are `files` that match nothing: a typo shouldn't quietly fall back to a default and pass.
- **JSONC is read with [`jsonc-parser`](https://www.npmjs.com/package/jsonc-parser), and checked against the schema with [`ajv`](https://ajv.js.org/).**
  - **The owner's words:** "let's go with jsonc-parser, i don't trust a nieve aprroach to stripping comments out of a jsonc file. make sure that config.ts also validates the config file using the schema file you wrote too", then "go with ajv" ([feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7086491294)).
  - **`configuration_schema.json` now owns which options there are and what each may hold.** `config.ts` keeps only the defaults and how they combine with the command line, so the schema an editor uses and the rules oxCrap enforces can't drift apart.
  - **`jsonc-parser` is Microsoft's,** the parser VS Code uses: 3.3.1, MIT, no dependencies of its own.
  - **`ajv` won a comparison made 2026-11-22.** It's the standard validator (8.20.0, MIT, 4 small dependencies, by far the most used), it supports the schema's draft-07, and its errors name the exact option. The others:
    - `@cfworker/json-schema` has no dependencies but a single maintainer;
    - `@exodus/schemasafe` showed little recent activity, and its errors are off by default;
    - `@hyperjump/json-schema` has 7 dependencies and the least use.

    Bowtie's compliance report couldn't be read without a browser.

  - **A `"__proto__"` key is refused before validation.** `jsonc-parser` assigns it, which sets the object's prototype, so the schema would never see it, and it would be quietly ignored.
- **Files are found with Node's `fs.globSync`.**
  - **The owner chose it** ("use fs.globSync", [feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7086720954)), after asking "i thought node had a glob package".
  - **It's been stable since Node 22.17,** below the README's 22.18 minimum. Its `exclude` has taken glob patterns since 22.14.
  - **An excluded folder isn't searched.** With `**/node_modules/**` excluded, a search of this repository fell from 131 ms over 4,980 files to 3 ms.
  - **It replaced a hand-written `glob.ts`.** An earlier version of this note said wrongly that Node's glob wasn't stable in Node 22, without checking which 22 release.
  - **`exclude` is a function asking `ignore` about each folder,** so a folder `ignorePatterns` matches isn't searched, while ignored files, such as tests, are left out of scoring but still count against the coverage report.
  - **`files.ts` is given `fs.globSync`, and `oxcrap.ts` reads the `.gitignore`,** so the pruning, the split between the `.gitignore` and `ignorePatterns`, and `matched` against `scored` have unit tests over files in memory. The owner chose it on [#79](https://github.com/DetweilerRyan/split/issues/79#issuecomment-7118031362): "Unit-test files.ts, exclude oxcrap.ts". Passing the real `globSync` in, rather than matching a listing by hand, keeps the glob semantics Node's. Those have quirks a hand-written match could miss: `**` skips dotfiles, except that `**/.*` searches a dot folder it matched, so it finds `.next/cache/.tsbuildinfo`; a symlink is neither a file nor searched; and a folder a pattern names outright isn't always offered to `exclude`.
  - **A single file named on the command line is passed through as it is,** not as a pattern. A folder whose name has glob characters is refused, because Node's glob has no escape that works on every platform.
- **The limits moved from constants in `check.ts` into the config,** with 30 and 10 as defaults in `config.ts`. This repository's [`.oxcraprc.json`](../../.oxcraprc.json) sets them explicitly, so a change to them shows up as a change to that file.

### gitignore-style `ignorePatterns`

- **The owner approved the [`ignore`](https://www.npmjs.com/package/ignore) package** ("yes, add the ignore package", [feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7086816626)), so `ignorePatterns` match as oxlint's do. oxlint's schema says its patterns "use gitignore-style matching, rooted at the directory containing the configuration file".
- **`ignore` 7.0.14** is MIT, with no dependencies of its own, and is what ESLint and Prettier use for gitignore matching.
- **The defaults became `node_modules/`, `.*/`, `*.test.*` and `*.spec.*`,** which match at any depth, as in a `.gitignore`.
- **`files` stay globs, as Node's `fs.globSync` takes them.** oxlint's overrides make the same split: their `files` are globs.

### Reading the `.gitignore`

- **The owner asked for it** ("yes, read the .gitignore too", [feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7086963677)) after a test of oxlint 1.91.0 in a throwaway folder:
  - **with no `.gitignore`,** it linted `node_modules/`, a nested `node_modules/` and a dot-folder;
  - **with a `.gitignore` of `node_modules/`,** even outside a git repository, it skipped both `node_modules` folders;
  - **in a git repository with no `.gitignore`,** it linted everything again;
  - **with `ignorePatterns`,** it skipped what they listed.

  So oxlint's own skipping comes from `.gitignore` files and its config, with no built-in list.

- **oxCrap reads the `.gitignore` in the config's folder,** or the current folder without a config, with the same `ignore` package as `ignorePatterns`. It keeps its stricter defaults too: `node_modules/` and dot-folders are skipped even without a `.gitignore`, since scoring them is never wanted.
- **What a `.gitignore` lists is left out of the stale-report check as well as scoring.** Only `ignorePatterns` files, such as tests, still count. Otherwise a gitignored build output written after the tests ran, such as `*.gen.js`, would make a fresh report look stale. A folder either lists isn't searched at all.

### `helpUrl`

- **It started as `guide`,** an option I added for a document to point to from the findings. The owner found it "kinda smelly" and asked for precedent, then said: "rename it to helpUrl and follow commitlint's precedent. consider also making sure that the file exsits when oxcrap runs" ([feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7087217244)).
- **The precedent is [commitlint's `helpUrl`](https://commitlint.js.org/reference/configuration),** "a custom URL to show upon failure". It prints a "Get help:" line under the errors, and none when no `helpUrl` is set. oxCrap does the same: `Get help: <url>` under findings, nothing otherwise. dependency-cruiser's per-rule `comment` and linters' per-rule docs links are related, but set by rule rather than once per project.
- **A URL is printed as it is,** and not checked, since that would need the network.
- **A path is checked on every run,** findings or not, and refused if the file is missing, so a moved or misspelled document can't go unnoticed. It's read from the config's folder (or from the current directory with `--help-url`), like the other paths, and printed from the current directory, so it points to the right file wherever oxCrap runs. `guide` had been printed as written, the only path option that wasn't resolved.
- **This repository's `.oxcraprc.json` points it at `docs/engineering/crap.md`,** a path, so it's checked to exist.

### What an independent review changed

A review by a subagent with none of the building session's context ([findings](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7087852542)) led to these fixes:

- **Coverage is matched by real path.** Both the report's paths and the scored files' are resolved through symlinks, with `/` separators, and compared case-insensitively on Windows. Matching by exact text gave false 0% findings through a symlinked config, under macOS's `/var` (a symlink to `/private/var`), and with Windows separators.
- **A report covering none of the scored files is an error,** rather than a 0% finding for every function. It's almost always the wrong report, or one written from another folder.
- **A line holding only a JSX comment counts as a comment line** between a `@crap-allow` and its function. A second `{/* … */}` had broken the match.
- **`..` is refused anywhere in a `files` glob,** not only at its start. A `-c` naming a folder, and a report missing `fnMap` or `f`, are clear errors.
- **The score is compared with the limit to one decimal place,** as it's printed and written in comments, so 30.04 isn't a finding that reads "CRAP 30, over the limit of 30".
- **A `!` in `ignorePatterns` can't bring back what the `.gitignore` lists,** so scoring and the stale-report check agree.
- **Node 22.18, the README's minimum, was tested:** oxCrap's, the hook's and the lint config's tests pass on Node 22.18.0 in a container, with no experimental warnings.

### The folder and its modules

The owner asked to "nest it into it's own folder scripts/crap/ and decompose the script itself so that non real tests can be written for it's constituint parts."

| Module                           | Does                                                                                            | Tested by                                                                                                |
| :------------------------------- | :---------------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------- |
| [`oxcrap.ts`](oxcrap.ts)         | Command line: reads the report, refuses a stale one, prints findings                            | [the features](features/): the contract, end to end                                                      |
| [`functions.ts`](functions.ts)   | Parses a file into its functions and comments                                                   | [`functions.test.ts`](functions.test.ts)                                                                 |
| [`complexity.ts`](complexity.ts) | The counting rules                                                                              | [`complexity.test.ts`](complexity.test.ts), [`complexity.property.test.ts`](complexity.property.test.ts) |
| [`recursion.ts`](recursion.ts)   | Finds functions in a recursion cycle, resolving calls by scope                                  | [`recursion.test.ts`](recursion.test.ts), [`recursion.property.test.ts`](recursion.property.test.ts)     |
| [`allow.ts`](allow.ts)           | Reads `@crap-allow` comments and matches them to functions                                      | [`allow.test.ts`](allow.test.ts)                                                                         |
| [`coverage.ts`](coverage.ts)     | Reads a report; finds files newer than it; shares statements out to functions                   | [`coverage.test.ts`](coverage.test.ts)                                                                   |
| [`config.ts`](config.ts)         | Reads a config with `jsonc-parser`, checks it against the schema with `ajv`; holds the defaults | [`config.test.ts`](config.test.ts)                                                                       |
| [`files.ts`](files.ts)           | Finds the files a config's globs pick out, with the `fs.globSync` it's given                    | [`files.test.ts`](files.test.ts)                                                                         |
| [`check.ts`](check.ts)           | The rules, on plain data                                                                        | [`check.test.ts`](check.test.ts)                                                                         |

- **Every module but `oxcrap.ts` takes plain values,** such as source text, a config's text or a coverage report's text. Only `oxcrap.ts` reads the file system, and nothing runs a program.
- **[`../stop-hook.ts`](../stop-hook.ts) is outside this folder** because it's the project's hook, not part of the CRAP script. [`../stop-hook.real.test.ts`](../stop-hook.real.test.ts) tests it with fake npm scripts.
- **The modules import each other with `.ts` extensions,** which Node needs to run them by stripping types. So `tsconfig.json` sets `allowImportingTsExtensions`, which `noEmit` permits.

### Nothing imported from outside the folder

- **The owner asked for the rule** "that oxcrap must not import anything from outside it's own folder" ([choice](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085786799)), so oxCrap can be lifted out into a project of its own.
- **[Dependency direction](../../docs/engineering/dependency-direction.md) says how it's checked,** and [its sidecar](../../docs/engineering/dependency-direction.meta.md) why rev-dep checks it, what it doesn't catch, and the options not taken.

### Reliability tests

[#65](https://github.com/DetweilerRyan/split/issues/65) asked whether property testing would make oxCrap more reliable. Its riskiest parts are where it meets outside tools: oxc's positions, real TSX syntax and comment handling. So the tests that reach them use real code, or a generator with a known answer.

- **Sanity checks on real code were dropped** ([decision](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227)). The owner said "yes, drop item 1 and keep 2 and 3". Its four invariants hold by construction:
  - coverage is a ratio of covered statements;
  - the innermost function is a single answer;
  - function ranges come from the parser's offsets;
  - `npm run oxcrap` already checks every `@crap-allow` comment in CI.

#### Reformatting checks

[`functions.real.test.ts`](functions.real.test.ts) takes each of the 40 files oxCrap scores in `src/` and `app/` and changes only its layout:

- a blank line before every line;
- an unrelated comment before every line;
- oxfmt at 40 columns with tabs, far from the repository's settings, so it reflows.

It checks that each function's complexity, which functions a `@crap-allow` matches, and any problems stay the same.

- **Inserted lines skip JSX and template literals,** where a new line would change the code's text rather than its layout. The test finds those ranges with oxc-parser.
- **Names aren't compared.** A function's name comes from its source text, such as `seed.items.forEach callback`, so a reflow can change it. It only labels a finding. Two callbacks became `(anonymous)` under the 40-column reflow, which this accepts.
- **The files are read by path, as data.** The test imports nothing from outside oxCrap's folder, but it does depend on this repository's code. A copy of oxCrap lifted out would point it at other code, or drop it.
- **It found a real limitation.**
  - **The case:** a `@crap-allow` comment applied only to a function starting on the next code line. When oxfmt wrapped a call so its callback started a line later, the comment in `src/store/seedCodec.ts` detached.
  - **The decision:** the owner chose to widen the match ([decision](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7107043936)): "option 1". When no function starts on that line, the comment applies to the one outermost function in the statement that does. Two such functions stay an error.
  - **The alternative:** keep the rule, and document that a wrapped call can detach a comment.
  - **Narrowed, from an independent review:** at first "statement" meant any statement or declaration. So a comment above `class C {`, an object literal, or `if (x) {` holding one callback matched a function several lines down. Now the fallback applies only to an expression, a variable declaration, a `return` or an export, and only to a function passed straight to a call. That's the case the decision was for.
  - **Still detached by a wrap:** a class or object property whose function a formatter moves to the next line, and a JSX attribute. This repository has none today.

#### A generator-checked complexity count

[`complexity.property.test.ts`](complexity.property.test.ts) has a [fast-check](https://github.com/dubzzz/fast-check) property. It builds random functions from a small grammar that records how many branches it writes, and asserts the complexity is 1 plus that number. The grammar includes:

- ifs, else-ifs and loops;
- switches with and without `default`;
- catch and finally;
- `?:`, `&&` chains and logical assignments;
- optional links (`?.`) and default values, in destructuring and in nested functions' parameters;
- nested functions, assigned and passed to calls, whose branches count or not as `counting.nestedFunctions` says.

- **The owner approved fast-check:** "Approve fast-check now" ([decisions](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227)).
  - **Version:** pinned at 4.10.2, published 2026-09-19. 4.11.0 and 4.10.3 were under two weeks old when it was added, against [the dependency rule](../../docs/engineering/dependencies.md#after-approval).
  - **What it brings:** one dependency, `pure-rand`, and no install scripts. It's used by this one test.
- **Why fast-check rather than a seeded generator:** shrinking. With catch clauses no longer counted, it reduced a failure to `try {} catch {}`. Counting a switch's `default:` failed too.
- **Cost:** 500 runs, one per drawn combination of the counting options, in about 0.2 s. The reformatting checks run under the default counting and with each function on its own, 242 cases in about 4 s, so `npm run test:tooling` went from about 12 s to 12.9 s.

## How it works

- **`oxc-parser` gives functions, their places and the file's comments in one parse.** Offsets are UTF-16, as JavaScript strings are, and lines and columns come from them in `positions`.
- **Only real comments are read,** so text in a string that looks like a comment is never mistaken for one.
- **Each statement counts toward the function scored for it:** the outermost function around it by default, as complexity counts nested functions, or the innermost with `own` counting. A function with no statements of its own, such as a one-line arrow, is covered when the report shows it was called.
- **Findings label a function by the functions around it,** such as `RoomView > changeDisplayCurrency`. An unnamed function is labelled by what it's assigned to, the call it's passed to (`seed.items.forEach callback`), or its JSX attribute (`onClick`). Labels are only for reading; nothing is keyed on them.

## Options not taken

- **`guide`, printed as written:** a vague name, and a path that wasn't resolved or checked. Replaced by `helpUrl`.
- **`.gitignore` files in subfolders,** which oxlint also reads: not asked for, and the one beside the config covers this repository. Add them if a project relies on nested ones.
- **A hand-written glob matcher and folder walk,** `glob.ts`: Node's `fs.globSync` does the same, stably, from Node 22.17.
- **`tinyglobby`** (already installed, through Vite and Vitest), **`fast-glob`**, **`picomatch`** or **`minimatch`:** each a dependency, for what Node now does itself.
- **`ignorePatterns` as globs, passed to `fs.globSync`'s `exclude`:** unlike oxlint's gitignore-style patterns, and needing a guess at which patterns named folders.
- **Reading the config with `oxc-parser`,** by parsing it as one JavaScript expression. It accepted syntax oxlint refuses, such as single quotes, unquoted keys, hex numbers and numeric separators. It mishandled a `__proto__` key, and its errors pointed at the wrapped text. The owner rejected it: "that doesn't make any sense at all."
- **Stripping comments and trailing commas by hand, then `JSON.parse`:** the owner didn't trust it ("i don't trust a nieve aprroach").
- **Hand-written type checks for each option,** as the first config reader had: they duplicated the schema, which `ajv` now applies directly.
- **Reading complexity from oxlint's `complexity` rule,** as the first version did. The score was only in its message text, and an oxlint update could change the counts under every comment.
- **A baseline file,** `scripts/crap-baseline.json` and then a commented `crap-baseline.jsonc` with `--baseline` and `--write-baseline`. Its keys break on renames and moves, and rewriting it dropped the reasons. Comparable tools share the problem; see the research above.
- **`--write-baseline` writing the comments into source files:** the owner didn't want the script to modify code.
- **Comparing each function with its score at the merge base,** as Semgrep's `--baseline-commit` does: unnecessary once the comment carries the numbers.
- **Checking only the functions a branch changes,** from `git diff` against the merge base. That was #63's choice, then dropped once comments recorded every exception; see the decisions above. It tied the script to git and to a base ref, and missed an untouched function pushed over the limits.
- **Notices for `@crap-allow` comments a branch adds or changes:** they needed the diff. A reviewer sees those comments in the pull request's own diff.
- **Text-only comment handling,** without a parser. It failed on comments that mention `crap-allow`, swallowed lint directives into the reason, mistook strings for comments, couldn't read JSX comments, and guessed between two functions on one line.
- **A CRAP package from npm** (`crap4ts`, `crap-ts`, `@crap4ts/crap4ts`, `@bladesk/crap-check`, `@barney-media/crap-typescript` and others): about a dozen similar packages all published in 2026, mostly by single maintainers, with no clear original. They fail [dependencies](../../docs/engineering/dependencies.md)' maintenance checks.
- **`@vitest/istanbul-lib-coverage`, to read the coverage report:** it only wraps a simple, stable JSON format.
- **The script running the tests itself,** as it did before the third round of feedback: it tied the script to `npm test`. CI also ran the suite twice.
- **A hook mode inside the CRAP script:** it tied the script to Claude Code, and to running lint and the tests.
- **A blocking hook:** #63 chose advice inside the session and a gate in CI.
- **Other ways to enforce the import rule:** in [dependency direction's sidecar](../../docs/engineering/dependency-direction.meta.md#options-not-taken).
- **Mutation testing:** deferred. Revisit Stryker for `src/utils/math.ts` and `src/store/seedCodec.ts` in its own issue.

## What would reopen this

- **`oxc-parser` changes its AST shape in an update:** `functions.test.ts` and `complexity.test.ts` should fail first. Fix the module, not the tests.
- **Coverage proves unsteady between runs,** so a comment's numbers drift without a code change: compare within a tolerance instead of exactly.
- **Agents game the score** in ways review misses, such as tests that run code without checking it: take up mutation testing.
- **The project runs only part of its suite before oxCrap,** such as the Stop hook running only related tests ([`../stop-hook.meta.md`](../stop-hook.meta.md#what-would-reopen-this)): a partial run's report needs oxCrap to know which functions it covers, so revisit the stale-report rule.
- **Coverage on every `npm test` costs too much:** move it to a separate script, such as `test:coverage`, and run that before `npm run oxcrap`.
- **oxCrap scores generated code or very large files,** where the cycle check's O(V·(V+E)) shows, as it does at about half a second for 2,000 functions in one chain: replace `reachable` with a linear strongly-connected-components algorithm, Tarjan or Kosaraju, written as one function whose index, stack and visited set are local to it. Don't go back to a class; the walks cost about the same either way ([feedback](https://github.com/DetweilerRyan/split/pull/81#issuecomment-7113779869)).
- **A table arrives by another route:** a namespace import (`import * as t`), a re-export (`export { T } from './t'`), a default import of a table or a function (`import T from './t'`), a package import, a table built by a function or with a spread, or another name for it (`const U = T`). None is followed today; follow the one that turns up.
- **Membership is tested another way:** `Object.hasOwn(O, k)`, `A.indexOf(x) >= 0` or `A.some(…)` on a static table. None is counted today; count the one that turns up as membership.
