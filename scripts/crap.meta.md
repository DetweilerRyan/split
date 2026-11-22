# `crap.ts`: reasons and sources

Why [`crap.ts`](crap.ts), its baseline, its Stop hook and its CI step work the way they do, and why [the CRAP score procedure](../docs/engineering/crap.md) says what it says. Read this only when changing or questioning them. Responding to a finding needs only the procedure.

Decided by the owner on [#63](https://github.com/DetweilerRyan/split/issues/63), which records the trial, the research and each decision. The owner approved every decision there on 2026-11-22.

## What the research found

Checked 2026-11-22. Most sources are practitioner posts, vendor posts and tool READMEs, plus a few 2026 preprints. None is a rigorous study of CRAP gates on coding agents' output.

- **Gate the functions a change touches, against a baseline.** The most complete CRAP gate built for agents, [smixs/code-quality](https://github.com/smixs/code-quality), uses complexity ≤ 10 and CRAP ≤ 30 on changed functions, and records existing findings as debt. The [Better Stack guide](https://betterstack.com/community/guides/ai/crap-metric/) describes the same baseline mode.
- **More capable models still let complexity pile up.** [SlopCodeBench](https://arxiv.org/html/2603.24755) found "structural erosion", complexity collecting in functions over 10, rising in 77% of runs across 15 agents, including the strongest tested.
- **Coverage is the easiest part to game.** [Thoughtworks](https://www.thoughtworks.com/radar/techniques/mutation-testing) and [SpecBench](https://arxiv.org/html/2605.21384v1) report agents' tests reaching high coverage while catching little, and agents gaming tests when tests are the only feedback. Reported patterns include trivial assertions, skipped tests and splitting functions only to pass a limit ([understandingdata.com](https://understandingdata.com/posts/goodharting-prevention-agent-systems/), [Doug Haber](https://medium.com/@DougHaber/keeping-ai-generated-code-under-control-with-complexity-limits-46d701b4c1e3)).
- **Score with a script, not an LLM,** and fail loudly when a tool is missing rather than pass by never running.
- **Advise inside the agent's loop, block in CI** ([Stop hooks](https://fbakkensen.github.io/ai/devtools/development/2026/03/27/quality-gates-for-coding-agents-how-stop-hooks-make-validation-mandatory.html)).

## Decisions

- **Limits: CRAP 30, complexity 10.** CRAP 30 is crap4j's and cargo-crap's default. The complexity limit catches a well-tested function that is still too complex, since full coverage only brings CRAP down to the complexity.
- **Only changed functions are checked.** A function is changed when the diff from the merge base, working tree and new files included, touches a line between its first and last. A change inside a nested function also touches the functions around it.
- **The baseline is a ratchet.** A changed function the baseline records passes at its recorded score or lower, and fails when it gets worse. #63's decision says existing debt doesn't fail "until their function is touched" and also that the baseline is refreshed and flagged. The script reads these together: touching a recorded function doesn't fail by itself. Only making it worse does, which is what keeps the baseline meaningful.
- **A better score must be recorded.** The check fails until `--write-baseline` lowers the entry, so the ratchet tightens in the same pull request that earned it, as #63 asks.
- **An added or raised entry is a notice, not a failure.** #63 asks for it to be flagged for the owner. CI prints a GitHub warning, and the procedure requires a reason in the pull request.
- **Coverage comes from all three Vitest projects together.** Components and hooks are tested in the `browser` project ([testing conventions](../docs/engineering/testing-conventions.md#which-project-a-test-belongs-in)), so `unit` coverage alone would score every component at 0%. This is also why unit tests weren't renamed `*.unit.test.ts`.
- **The Stop hook advises and never blocks.** It sends findings through `hookSpecificOutput.additionalContext`, which the [hooks reference](https://code.claude.com/docs/en/hooks) describes as "non-error feedback for Claude"; plain output from a Stop hook never reaches Claude. It stays quiet when `stop_hook_active` is true, so it advises once per stop. CI is the gate.
- **The hook runs lint and the tests first.** Lint failures come first in its message. While the tests fail it gives no score, since coverage from a failing run misleads.
- **No skill.** A hook defined in a skill runs only after the skill is invoked, a hook can't invoke a skill, and [`AGENTS.md`](../AGENTS.md) sends every agent to `docs/engineering/` for procedures. Revisit only for an on-demand report command.
- **CI runs the tests a second time** in the `CRAP score` step, with coverage on, rather than turning coverage on for every `npm test`. That keeps `npm test` as fast as it was and keeps the script the only thing that needs a coverage report.

## How it works

- **Complexity comes from oxlint's `eslint/complexity` rule** with a maximum of 0, so every function is reported, with `--format json`. The score appears only in the message text in every oxlint output format, so the script reads it with one pattern and exits with an error if a message doesn't match. An oxlint update that rewords the message breaks the check instead of dropping functions.
- **oxlint's offsets count bytes.** A `€` moves the next function by three, so the script converts offsets through the file's bytes. That conversion is in `position`.
- **Each statement counts toward the innermost function that holds it,** matching how the complexity rule counts each function without its nested functions. A function with no statements of its own, such as a one-line arrow, is covered when the report shows it was called.
- **A function's key is its file and the chain of functions around it,** so it survives edits elsewhere in the file. An anonymous function is named by the call it's passed to (`seed.items.forEach callback`) or the name it's assigned to, and numbered only when two siblings share a name.
- **The tests run the script on throwaway git repositories,** with a fake `npm test` that writes a coverage report the test controls. That checks oxlint's real output, git's real diff, the baseline rules and the hook's output without running Vitest inside Vitest.

## Options not taken

- **A CRAP package from npm** (`crap4ts`, `crap-ts`, `@crap4ts/crap4ts`, `@bladesk/crap-check`, `@barney-media/crap-typescript` and others): about a dozen similar packages all published in 2026, mostly by single maintainers, with no clear original. They fail [dependencies](../docs/engineering/dependencies.md)' maintenance checks.
- **`oxc-parser`, to count complexity ourselves:** it would rebuild the rule oxlint already has. It stays the fallback if reading oxlint's message stops working; propose it in a pull request.
- **`@vitest/istanbul-lib-coverage`, to read the coverage report:** it only wraps a simple, stable JSON format.
- **A blocking hook:** #63 chose advice inside the session and a gate in CI.
- **Mutation testing:** deferred. Revisit Stryker for `src/utils/math.ts` and `src/store/seedCodec.ts` in its own issue.

## What would reopen this

- oxlint gives complexity as its own field, or removes the rule: switch to the field, or to `oxc-parser`.
- Agents game the score in ways review misses, such as tests that run code without checking it: take up mutation testing.
- The suite grows slow enough that the Stop hook delays sessions noticeably: run only the tests related to the change in the hook, and keep the full run in CI.
