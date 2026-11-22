# oxCrap: reasons and sources

Why oxCrap, the CRAP script in this folder, its `@crap-allow` comments, the Stop hook in [`../stop-hook.ts`](../stop-hook.ts) and the CI step work the way they do, and why [the CRAP score procedure](../../docs/engineering/crap.md) says what it says. Read this only when changing or questioning them. Responding to a finding needs only the procedure.

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
- **The script knows nothing of this project.** It takes the report (`--coverage`), the paths to score and an optional document to point to (`--guide`). It reads files and runs nothing: no tests, no git, nothing from npm. It works on any folder of code, in a git repository or not, skipping `node_modules` and dot-folders. [`package.json`](../../package.json)'s `oxcrap` script supplies this repository's values.
- **A stale report is refused, not scored.** The script fails when the report is older than any file under the scored paths, tests included. That way a report from before the latest edits can't make a function look covered.
  - **A failed test run can't leave a stale report behind:** Vitest empties `coverage/` at the start of a run, and writes no report when a test fails.
  - **A partial run is the one gap:** a run of some test files writes a fresh report with only their coverage. That can only lower coverage, so it makes false findings, never a false pass.

### The Stop hook

- **The hook is the project's own script, [`scripts/stop-hook.ts`](../stop-hook.ts),** not a mode of the CRAP script. It's where this project's choices live: which folders count as changes, and running `npm run lint`, `npm test` and `npm run oxcrap` in that order. The CRAP script stays independent of them, and of Claude Code.
- **It advises and never blocks.** It sends what fails through `hookSpecificOutput.additionalContext`, which the [hooks reference](https://code.claude.com/docs/en/hooks) describes as "non-error feedback for Claude"; plain output from a Stop hook never reaches Claude.
  - It stays quiet when `stop_hook_active` is true, so it advises once per stop.
  - It runs nothing when `src/` and `app/` haven't changed.
  - CI fails on the same checks.
- **It runs lint first and the tests second, and the CRAP check only when the tests pass,** since a failing run writes no report.
- **No skill.** A hook defined in a skill runs only after the skill is invoked, a hook can't invoke a skill, and [`AGENTS.md`](../../AGENTS.md) sends every agent to `docs/engineering/` for procedures.
- **[#65](https://github.com/DetweilerRyan/split/issues/65)** pilots running tooling tests apart from the app's.

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

### The folder and its modules

The owner asked to "nest it into it's own folder scripts/crap/ and decompose the script itself so that non real tests can be written for it's constituint parts."

| Module                           | Does                                                                          | Tested by                                                              |
| :------------------------------- | :---------------------------------------------------------------------------- | :--------------------------------------------------------------------- |
| [`oxcrap.ts`](oxcrap.ts)         | Command line: reads the report, refuses a stale one, prints findings          | [`oxcrap.real.test.ts`](oxcrap.real.test.ts): the contract, end to end |
| [`functions.ts`](functions.ts)   | Parses a file into its functions and comments                                 | [`functions.test.ts`](functions.test.ts)                               |
| [`complexity.ts`](complexity.ts) | The counting rules                                                            | [`complexity.test.ts`](complexity.test.ts)                             |
| [`allow.ts`](allow.ts)           | Reads `@crap-allow` comments and matches them to functions                    | [`allow.test.ts`](allow.test.ts)                                       |
| [`coverage.ts`](coverage.ts)     | Reads a report; finds files newer than it; shares statements out to functions | [`coverage.test.ts`](coverage.test.ts)                                 |
| [`check.ts`](check.ts)           | The rules, on plain data                                                      | [`check.test.ts`](check.test.ts)                                       |

- **Every module but `oxcrap.ts` takes plain values,** such as source text or a coverage report's text. Only `oxcrap.ts` reads files, and nothing runs a program.
- **[`../stop-hook.ts`](../stop-hook.ts) is outside this folder** because it's the project's hook, not part of the CRAP script. [`../stop-hook.real.test.ts`](../stop-hook.real.test.ts) tests it with fake npm scripts.
- **The modules import each other with `.ts` extensions,** which Node needs to run them by stripping types. So `tsconfig.json` sets `allowImportingTsExtensions`, which `noEmit` permits.

### Nothing imported from outside the folder

- **The owner asked for the rule** "that oxcrap must not import anything from outside it's own folder", and chose to add it to #64 ([choice](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085786799)).
- **oxlint enforces it, with no new dependency.** An override in [`.oxlintrc.json`](../../.oxlintrc.json) scopes two rules to `scripts/oxcrap/**`:
  - `import/no-relative-parent-imports` stops any import through a parent folder: a value or type-only import, a re-export, or a dynamic `import()`.
  - `no-restricted-imports` with the pattern `@/**` stops the app's `@/` alias. Its patterns follow `.gitignore` rules, where `*` doesn't cross a `/`, so `@/*` alone wouldn't match `@/utils/math`.
- **Siblings, Node built-ins and npm packages stay allowed.** That covers `./allow.ts`, `node:fs` and `oxc-parser`.
- **[`oxlintrc.real.test.ts`](../../oxlintrc.real.test.ts) runs the real oxlint with the real config** on throwaway files laid out like the repository, so dropping the override, or a pattern that stops matching, fails a test.
- **What the rules don't catch:**
  - an import by absolute path;
  - loading a file with `new URL('../…', import.meta.url)`, which isn't an import;
  - an npm package that isn't meant to be used.
    oxCrap does none of these today.

## How it works

- **`oxc-parser` gives functions, their places and the file's comments in one parse.** Offsets are UTF-16, as JavaScript strings are, and lines and columns come from them in `positions`.
- **Only real comments are read,** so text in a string that looks like a comment is never mistaken for one.
- **Each statement counts toward the innermost function that holds it,** matching how complexity leaves out nested functions. A function with no statements of its own, such as a one-line arrow, is covered when the report shows it was called.
- **Findings label a function by the functions around it,** such as `RoomView > changeDisplayCurrency`. An unnamed function is labelled by what it's assigned to, the call it's passed to (`seed.items.forEach callback`), or its JSX attribute (`onClick`). Labels are only for reading; nothing is keyed on them.

## Options not taken

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
- **Other ways to enforce the import rule,** checked 2026-11-22:
  - **[dependency-cruiser](https://github.com/sverweij/dependency-cruiser)** 18.9.0 checks the resolved import graph, and could allow only specific npm packages. It has 18 dependencies of its own, for a one-folder rule. Revisit if the rule grows, such as an allowlist of packages before publishing.
  - **TypeScript's `rootDir`,** in a `tsconfig.json` of the folder's own, caught the same imports, but needs a second typecheck command and reports per imported file rather than per import.
  - **[eslint-plugin-boundaries](https://github.com/javierbrea/eslint-plugin-boundaries)** needs ESLint, which this repository doesn't use, and reports disagree on whether it runs under oxlint.
  - **oxlint-plugin-boundaries** is third-party and young, and it matches files by path rather than resolving imports.
- **A separate pull request for the import rule,** off `main` with #64 stacked on it: `scripts/oxcrap/` exists only on #64's branch, so the rule would have enforced nothing until #64 merged.
- **Mutation testing:** deferred. Revisit Stryker for `src/utils/math.ts` and `src/store/seedCodec.ts` in its own issue.

## What would reopen this

- **`oxc-parser` changes its AST shape in an update:** `functions.test.ts` and `complexity.test.ts` should fail first. Fix the module, not the tests.
- **Coverage proves unsteady between runs,** so a comment's numbers drift without a code change: compare within a tolerance instead of exactly.
- **Agents game the score** in ways review misses, such as tests that run code without checking it: take up mutation testing.
- **The suite grows slow enough** that the Stop hook delays sessions noticeably: run only the tests related to the change in the hook, and keep the full run in CI. A partial run's report then needs the script to know which functions it covers, so revisit the stale-report rule with it.
- **Coverage on every `npm test` costs too much:** move it to a separate script, such as `test:coverage`, and run that before `npm run oxcrap`.
