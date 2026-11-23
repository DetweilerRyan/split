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
- **It watches tooling too, and runs only what a change needs.** When the tooling tests left `npm test` ([#65](https://github.com/DetweilerRyan/split/issues/65)), a session editing `scripts/` would otherwise have had no advice. The owner said "Yes, watch scripts/ too" ([decisions](https://github.com/DetweilerRyan/split/issues/65#issuecomment-7091028227)).
  - **An app change** runs `npm test` and oxCrap.
  - **A tooling change** runs `npm run test:tooling`.
  - **Lint runs once** for either.
  - **Beyond `scripts/`,** the session added the root files each suite depends on: `vitest.config.ts` for the app; `vitest.tooling.config.ts`, `.oxlintrc.json` and its test for tooling; and `package.json` for both, since scripts and dependencies live there.
- **It stays quiet when nothing in `src/` or `app/` changed since the session's last stop,** by comparing a fingerprint of the work.
  - **Why:** an [independent review](https://github.com/DetweilerRyan/split/pull/64#issuecomment-7087852542) noted that, comparing only with the merge base, every stop on a branch with changes ran lint and the whole suite, Q&A turns included, and repeated any failure left from earlier. After research, the owner said "add the fingerprint and fix the review findings".
  - **What the research found:** Claude Code's Stop input has no "changed this turn" field, and its docs suggest a Stop hook that scans the working tree ([hooks reference](https://code.claude.com/docs/en/hooks)). Its `FileChanged` event can't watch folders, since its matcher takes literal file names. The common community pattern, a `PostToolUse` hook marking Edit and Write as dirty, misses edits made through Bash ([one test](https://pub.towardsai.net/does-your-claude-code-hook-see-every-edit-an-edit-write-matcher-saw-3-of-7-5ca1defab37e) saw 3 of 7 edits).
  - **What the fingerprint hashes:** the commit, `git diff HEAD` for the watched folders, and untracked files' names and contents. So it changes however an edit was made.
  - **Where it's kept:** one file per `session_id`, in `git rev-parse --git-path claude-stop-hook`. That keeps it out of the working tree, uncommitted and per worktree. It's saved before the checks run, so a failure is reported once, and again after the next change. Files older than 7 days are deleted.
  - **It also guards against a reported bug,** where `stop_hook_active` stays false on repeated fires ([issue #54360](https://github.com/anthropics/claude-code/issues/54360), closed without a fix): unchanged work stays quiet whatever that flag says.
- **On Windows, npm runs through a shell,** because it's `npm.cmd` there, which Node won't start without one.
- **It runs lint first and the tests second, and oxCrap only when the tests pass,** since a failing test run writes no coverage report.
- **It doesn't add its own pointer to the CRAP procedure.** `npm run oxcrap` already ends its findings with `Get help:`, from `helpUrl` in [`.oxcraprc.json`](../.oxcraprc.json).
- **No skill.** A hook defined in a skill runs only after the skill is invoked, a hook can't invoke a skill, and [`AGENTS.md`](../AGENTS.md) sends every agent to `docs/engineering/` for procedures.

## What would reopen this

- **The suite grows slow enough that the hook delays sessions noticeably:** run only the tests related to the change in the hook, and keep the full run in CI. A partial run's coverage report then needs oxCrap to know which functions it covers, so revisit its stale-report rule too.

## Options not taken

- **Running on every stop while the branch has changes,** as the hook first did: every stop ran the whole suite, and repeated old failures.
- **A `PostToolUse` hook marking edits as dirty:** it misses edits made through Bash, and it adds a second hook.
- **`FileChanged`:** it can't watch a folder.
- **Reading the turn's tool calls from the transcript:** it depends on the transcript's format, and misses Bash edits too.
