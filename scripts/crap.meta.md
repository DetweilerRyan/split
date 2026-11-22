# `crap.ts`: reasons and sources

Why [`crap.ts`](crap.ts), its `crap-allow` comments, its Stop hook and its CI step work the way they do, and why [the CRAP score procedure](../docs/engineering/crap.md) says what it says. Read this only when changing or questioning them. Responding to a finding needs only the procedure.

Decided by the owner on [#63](https://github.com/DetweilerRyan/split/issues/63), which records the trial, the research and each decision, all approved on 2026-11-22. The owner then replaced the baseline file with `crap-allow` comments in feedback on [#64](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7083296497), the same day.

## What the research found

Checked 2026-11-22. Most sources are practitioner posts, vendor posts, tool documentation and a few 2026 preprints. None is a rigorous study of CRAP gates on coding agents' output.

- **Gate the functions a change touches.** The most complete CRAP gate built for agents, [smixs/code-quality](https://github.com/smixs/code-quality), uses complexity ≤ 10 and CRAP ≤ 30 on changed functions, and records existing findings as debt in a baseline.
- **More capable models still let complexity pile up.** [SlopCodeBench](https://arxiv.org/html/2603.24755) found "structural erosion", complexity collecting in functions over 10, rising in 77% of runs across 15 agents, including the strongest tested.
- **Coverage is the easiest part to game.** [Thoughtworks](https://www.thoughtworks.com/radar/techniques/mutation-testing) and [SpecBench](https://arxiv.org/html/2605.21384v1) report agents' tests reaching high coverage while catching little. Reported patterns include trivial assertions, skipped tests and splitting functions only to pass a limit ([understandingdata.com](https://understandingdata.com/posts/goodharting-prevention-agent-systems/), [Doug Haber](https://medium.com/@DougHaber/keeping-ai-generated-code-under-control-with-complexity-limits-46d701b4c1e3)).
- **Score with a script, not an LLM,** and fail loudly when a tool is missing rather than pass by never running.
- **Advise inside the agent's loop, block in CI** ([Stop hooks](https://fbakkensen.github.io/ai/devtools/development/2026/03/27/quality-gates-for-coding-agents-how-stop-hooks-make-validation-mandatory.html)).
- **Baseline files keyed by name or path break on renames and moves, and hold no reasons.** That covers [ESLint's bulk suppressions](https://eslint.org/docs/latest/use/suppressions) (file and rule, with a count), [oxlint's RFC](https://github.com/oxc-project/oxc/discussions/22198), [detekt](https://detekt.dev/docs/introduction/baseline/), PHPStan and [cargo-crap](https://docs.rs/cargo-crap/0.2.0/src/cargo_crap/delta.rs.html). Each falls back to regenerating or editing the file. cargo-crap pairs a moved function by a name that's unique on each side, and nothing more.
- **Inline exceptions with a required reason move with the code.** Examples are `@ts-expect-error <reason>`, `eslint-comments/require-description` and [Biome's suppressions](https://biomejs.dev/analyzer/suppressions).

## Decisions

- **Limits: CRAP 30, complexity 10.** CRAP 30 is crap4j's and cargo-crap's default. The complexity limit catches a well-tested function that is still too complex, since full coverage only brings CRAP down to the complexity.
- **Only changed functions are checked against the limits.** A function is changed when the diff from the merge base, working tree and new files included, touches a line between its first and last. A change inside a nested function also touches the functions around it.
- **Exceptions are `// crap-allow: CRAP <score>, complexity <n>. <reason>` comments directly above the function,** written by hand. The owner chose them over a baseline file so that exceptions survive renames and moves, and so that the script never writes to source files. In the owner's words: "not a big fan of --write-baseline modifying the code."
- **The comment carries the function's numbers, and every comment is checked against them,** whether or not the branch changes its function. In the owner's words, so "the crap script can flag (warn in the hook and error/fail in ci) when the numbers in a crap-allow comment don't match the function anymore."
  - **This is the ratchet #63 approved:** a function that gets worse, or better, no longer matches its comment, and the fix is a visible edit to the comment.
  - **It replaces the merge-base comparison** that research had suggested. With the numbers in the comment, there's nothing to compare against, so the script runs the tests once.
- **The hook warns and CI fails on the same findings.** The hook only ever advises; CI fails on each finding.
- **The 17 functions over the limits when the check started have comments** whose reason says so ("Debt from before the CRAP check (#63)"). Replace a reason with a real justification when you next work on its function.
- **A comment the branch adds or changes is a notice, not a failure,** so the owner sees each new or changed exception and its reason. CI shows it as a warning.
- **A comment is checked for its form, its reason, its place and its function's limits.** It fails when it doesn't match the form, gives no reason, isn't directly above a function, or sits on a function within the limits. A comment can sit above a doc comment, so the doc comment stays attached to the function.
- **Coverage comes from all three Vitest projects together.** Components and hooks are tested in the `browser` project ([testing conventions](../docs/engineering/testing-conventions.md#which-project-a-test-belongs-in)), so `unit` coverage alone would score every component at 0%. This is also why unit tests weren't renamed `*.unit.test.ts`.
- **The Stop hook advises and never blocks.** It sends findings through `hookSpecificOutput.additionalContext`, which the [hooks reference](https://code.claude.com/docs/en/hooks) describes as "non-error feedback for Claude"; plain output from a Stop hook never reaches Claude. It stays quiet when `stop_hook_active` is true, so it advises once per stop.
- **The hook runs lint and the tests first.** Lint failures come first in its message. While the tests fail it gives no score, since coverage from a failing run misleads.
- **No skill.** A hook defined in a skill runs only after the skill is invoked, a hook can't invoke a skill, and [`AGENTS.md`](../AGENTS.md) sends every agent to `docs/engineering/` for procedures. Revisit only for an on-demand report command.
- **CI runs the tests a second time** in the `CRAP score` step, with coverage on, rather than turning coverage on for every `npm test`. That keeps `npm test` as fast as it was.

## How it works

- **Complexity comes from oxlint's `eslint/complexity` rule** with a maximum of 0, so every function is reported, with `--format json`. The score appears only in the message text in every oxlint output format, so the script reads it with one pattern and exits with an error if a message doesn't match. An oxlint update that rewords the message breaks the check instead of dropping functions.
- **oxlint's offsets count bytes.** A `€` moves the next function by three, so the script converts offsets through the file's bytes. That conversion is in `position`.
- **Each statement counts toward the innermost function that holds it,** matching how the complexity rule counts each function without its nested functions. A function with no statements of its own, such as a one-line arrow, is covered when the report shows it was called.
- **A comment applies to the outermost function starting on the first non-comment line below it.** Its reason runs on through the `//` lines straight below it.
- **Findings label a function by the functions around it,** such as `RoomView > changeDisplayCurrency`. An anonymous function is labelled by the call it's passed to (`seed.items.forEach callback`) or the name it's assigned to. Labels are only for reading; nothing is keyed on them.
- **The tests run the script on throwaway git repositories,** with a fake `npm test` that writes a coverage report the test controls. That checks oxlint's real output, git's real diff, the comment rules and the hook's output without running Vitest inside Vitest.

## Options not taken

- **A baseline file,** first `scripts/crap-baseline.json`, then a commented `crap-baseline.jsonc` at the root with a `--baseline` path and `--write-baseline`. Its keys break when a function is renamed or a file moves, and rewriting it drops the reasons recorded for the old key. Comparable tools share the problem; see the research above.
- **`--write-baseline` writing the comments into source files:** the owner didn't want the script to modify code.
- **Comparing each changed function with its score at the merge base,** as Semgrep's `--baseline-commit` does: unnecessary once the comment carries the numbers. It would also have needed a second test run at the merge base.
- **A JSONC package such as `jsonc-parser`:** moot without a baseline file.
- **A CRAP package from npm** (`crap4ts`, `crap-ts`, `@crap4ts/crap4ts`, `@bladesk/crap-check`, `@barney-media/crap-typescript` and others): about a dozen similar packages all published in 2026, mostly by single maintainers, with no clear original. They fail [dependencies](../docs/engineering/dependencies.md)' maintenance checks.
- **`oxc-parser`, to count complexity ourselves:** it would rebuild the rule oxlint already has. It stays the fallback if reading oxlint's message stops working; propose it in a pull request.
- **`@vitest/istanbul-lib-coverage`, to read the coverage report:** it only wraps a simple, stable JSON format.
- **A blocking hook:** #63 chose advice inside the session and a gate in CI.
- **Mutation testing:** deferred. Revisit Stryker for `src/utils/math.ts` and `src/store/seedCodec.ts` in its own issue.

## What would reopen this

- oxlint gives complexity as its own field, or removes the rule: switch to the field, or to `oxc-parser`.
- Coverage proves unsteady between runs, so a comment's numbers drift without a code change: compare within a tolerance instead of exactly.
- Agents game the score in ways review misses, such as tests that run code without checking it: take up mutation testing.
- The suite grows slow enough that the Stop hook delays sessions noticeably: run only the tests related to the change in the hook, and keep the full run in CI.
