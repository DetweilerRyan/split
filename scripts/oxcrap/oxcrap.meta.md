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
- **Where the line falls:** Vitest's `real` and `browser` projects count, though they're broader than unit tests. Playwright scenarios against the app, and a deep module's feature contract against its CLI, don't.

### The Stop hook

The project's Claude Code Stop hook runs `npm run oxcrap` and passes its findings to Claude. It's the project's own script, not part of oxCrap: its README is [`../stop-hook.md`](../stop-hook.md), and its reasons are in [`../stop-hook.meta.md`](../stop-hook.meta.md).

### Our own complexity count

- **The owner asked for it** once `oxc-parser` was in: "i don't think it really matters if it drifts from ESLint's rules … this way the crap script does not need to have to read the output of oxlint."
- **Drift doesn't matter here.** Complexity has no single official count, and the limits are rules of thumb.
- **Owning the count keeps every comment's numbers stable.** An oxlint update that changed how it counts would have stopped every affected `@crap-allow` comment matching, and failed CI on the upgrade alone.
- **The rules are in [`complexity.ts`](complexity.ts).** Start at 1, then add 1 for each `if`, `?:`, loop, non-default `case`, `catch`, `&&`, `||` and `??`, including `&&=`, `||=` and `??=`.
  - **Nested functions** are scored on their own, never toward the function around them.
  - **Default parameter values and `?.` are left out,** unlike ESLint. Each one is a path, but counting them inflated the scores of plain data-handling code. That's why `getExchangeRate` scores 11 here against oxlint's 15: it has three default values and one `?.`.
  - **A JSX condition such as `{open && <Modal />}` counts,** as a branch it is.

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

| Module                           | Does                                                                                            | Tested by                                           |
| :------------------------------- | :---------------------------------------------------------------------------------------------- | :-------------------------------------------------- |
| [`oxcrap.ts`](oxcrap.ts)         | Command line: reads the report, refuses a stale one, prints findings                            | [the features](features/): the contract, end to end |
| [`functions.ts`](functions.ts)   | Parses a file into its functions and comments                                                   | [`functions.test.ts`](functions.test.ts)            |
| [`complexity.ts`](complexity.ts) | The counting rules                                                                              | [`complexity.test.ts`](complexity.test.ts)          |
| [`allow.ts`](allow.ts)           | Reads `@crap-allow` comments and matches them to functions                                      | [`allow.test.ts`](allow.test.ts)                    |
| [`coverage.ts`](coverage.ts)     | Reads a report; finds files newer than it; shares statements out to functions                   | [`coverage.test.ts`](coverage.test.ts)              |
| [`config.ts`](config.ts)         | Reads a config with `jsonc-parser`, checks it against the schema with `ajv`; holds the defaults | [`config.test.ts`](config.test.ts)                  |
| [`files.ts`](files.ts)           | Finds the files a config's globs pick out, with `fs.globSync`                                   | [the features](features/)                           |
| [`check.ts`](check.ts)           | The rules, on plain data                                                                        | [`check.test.ts`](check.test.ts)                    |

- **Every module but `oxcrap.ts` takes plain values,** such as source text, a config's text or a coverage report's text. Only `oxcrap.ts` and `files.ts` read the file system, and nothing runs a program.
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

[`complexity.test.ts`](complexity.test.ts) has a [fast-check](https://github.com/dubzzz/fast-check) property. It builds random functions from a small grammar that records how many branches it writes, and asserts the complexity is 1 plus that number. The grammar includes:

- ifs, else-ifs and loops;
- switches with and without `default`;
- catch and finally;
- `?:`, `&&` chains and logical assignments;
- optional chaining;
- nested functions, whose branches must not count.

- **The owner approved fast-check:** "Approve fast-check now" ([decisions](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227)).
  - **Version:** pinned at 4.10.2, published 2026-09-19. 4.11.0 and 4.10.3 were under two weeks old when it was added, against [the dependency rule](../../docs/engineering/dependencies.md#after-approval).
  - **What it brings:** one dependency, `pure-rand`, and no install scripts. It's used by this one test.
- **Why fast-check rather than a seeded generator:** shrinking. With catch clauses no longer counted, it reduced a failure to `try {} catch {}`. Counting a switch's `default:` failed too.
- **Cost:** 300 runs in about 0.1 s. The reformatting checks' 121 cases take about 2 s, so `npm run test:tooling` went from about 12 s to 12.9 s.

## How it works

- **`oxc-parser` gives functions, their places and the file's comments in one parse.** Offsets are UTF-16, as JavaScript strings are, and lines and columns come from them in `positions`.
- **Only real comments are read,** so text in a string that looks like a comment is never mistaken for one.
- **Each statement counts toward the innermost function that holds it,** matching how complexity leaves out nested functions. A function with no statements of its own, such as a one-line arrow, is covered when the report shows it was called.
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
