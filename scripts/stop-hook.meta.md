# Stop hook: reasons and sources

Why [`stop-hook.ts`](stop-hook.ts) works the way [its README](stop-hook.md) describes. Read this only when changing or questioning the hook.

The hook came with the CRAP check, which the owner decided on [#63](https://github.com/DetweilerRyan/split/issues/63) and built on [#64](https://github.com/DetweilerRyan/split/pull/64). The owner asked in [review](https://github.com/DetweilerRyan/split/pull/64#discussion_r4660361387) for this sidecar and its README: "lets give the stop hook an md sidecar, effectively it's readme". The reasons below moved here from [`oxcrap/oxcrap.meta.md`](oxcrap/oxcrap.meta.md).

## Decisions

- **The hook is the project's own script, not a mode of oxCrap.** It's where this project's choices live: which folders count as changes, and running `npm run lint`, `npm test` and `npm run oxcrap` in that order. oxCrap stays independent of them, and of Claude Code. It began as oxCrap's `--hook` mode, and moved here when oxCrap stopped running the tests ([feedback](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7085342018)).
- **It advises and never blocks.** #63 chose advice inside the session and a gate in CI, following research that recommended both ([Stop hooks](https://fbakkensen.github.io/ai/devtools/development/2026/03/27/quality-gates-for-coding-agents-how-stop-hooks-make-validation-mandatory.html)).
  - **It sends findings through `hookSpecificOutput.additionalContext`,** which the [hooks reference](https://code.claude.com/docs/en/hooks) describes as "non-error feedback for Claude". Plain output from a Stop hook never reaches Claude.
  - **Exit code 2 and `"decision": "block"` would block instead.**
- **It advises once per stop:** it stays quiet when `stop_hook_active` is true, which means Claude is already continuing because of a stop hook. Claude Code also caps continuations in a row at 8 (`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`).
- **It runs nothing when `src/` and `app/` haven't changed,** so a session that only touches docs isn't slowed by a test run.
- **It runs lint first and the tests second, and oxCrap only when the tests pass,** since a failing test run writes no coverage report.
- **It doesn't add its own pointer to the CRAP procedure.** `npm run oxcrap` already ends its findings with `Get help:`, from `helpUrl` in [`.oxcraprc.json`](../.oxcraprc.json).
- **No skill.** A hook defined in a skill runs only after the skill is invoked, a hook can't invoke a skill, and [`AGENTS.md`](../AGENTS.md) sends every agent to `docs/engineering/` for procedures.

## What would reopen this

- **The suite grows slow enough that the hook delays sessions noticeably:** run only the tests related to the change in the hook, and keep the full run in CI. A partial run's coverage report then needs oxCrap to know which functions it covers, so revisit its stale-report rule too.
- **[#65](https://github.com/DetweilerRyan/split/issues/65)** pilots running tooling tests apart from the app's, which would change what `npm test` runs here.
