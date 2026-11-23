# Stop hook

[`stop-hook.ts`](stop-hook.ts) is this repository's Claude Code Stop hook, set in [`.claude/settings.json`](../.claude/settings.json). It runs each time a Claude Code session in this repository finishes a turn. It checks the session's changes, and gives Claude what fails as advice, so Claude can fix it before you see the turn's result.

It never blocks a session and always exits 0. CI runs the same checks and fails on them, so the hook only gets findings to Claude sooner.

## What it does

The app is `src/`, `app/`, `vitest.config.ts`, `vitest.config.browser.test.ts`, `.oxcraprc.json` and `package.json`. Tooling is `scripts/`, `vitest.tooling.config.ts`, `.oxlintrc.json`, `oxlintrc.real.test.ts` and `package.json`. Changes count in either.

1. **Stays quiet if Claude is already continuing because of a stop hook,** so it advises at most once per stop.
2. **Stays quiet, and runs nothing, if neither the app nor tooling has changed** since the merge base with `origin/main`, or `main` if there's no `origin/main`. New, untracked files count as changes.
3. **Stays quiet if neither has changed since this session's last stop.** It compares a fingerprint: the commit, every change git sees there, and new files' contents, so an edit made any way counts, through a tool, a shell command or a commit. The fingerprint is saved per session in the repository's git folder before the checks run, so what they find is reported once, and again only after the next change.

4. **Runs `npm run lint`.** Failures come first in the advice.
5. **If the app changed, runs `npm test`,** which writes the coverage report. If a test fails, it says so and skips oxCrap: a failing run writes no report, so there's nothing to score.
6. **Runs `npm run oxcrap`** if those tests passed, and passes on its findings. They end with oxCrap's `Get help:` line.
7. **If tooling changed, runs `npm run test:tooling`.**
8. **Sends what failed to Claude** as `hookSpecificOutput.additionalContext`, ending with "This is advice; CI fails on each of these." If everything passed, it sends nothing.

## What Claude sees

```text
`npm run oxcrap` reports:
CRAP findings:
- src/utils/math.ts:45 computeReceiptMath: CRAP 15, complexity 15, coverage 97%, but its @crap-allow comment says CRAP 14, complexity 14. Update the comment to `// @crap-allow CRAP 15, complexity 15.`, and check its reason still holds.

Get help: docs/engineering/crap.md

This is advice; CI fails on each of these.
```

## Running it by hand

Pass it the JSON a Stop hook receives. Without a `session_id`, it checks every time, with no fingerprint:

```sh
echo "{\"cwd\": \"$PWD\", \"stop_hook_active\": false}" | node scripts/stop-hook.ts
```

It prints the JSON it would send Claude, or nothing.

## Changing it

- **Which paths count as changes:** `APP` and `TOOLING` at the top of `stop-hook.ts`.
- **What it runs:** the `npm run lint`, `npm test`, `npm run oxcrap` and `npm run test:tooling` calls in `advice`. Each is a [definition-of-done check](../AGENTS.md#definition-of-done), so the hook and CI stay in step.
- **Its tests:** [`stop-hook.real.test.ts`](stop-hook.real.test.ts) runs it on throwaway git repositories, with fake npm scripts. Add a case there for any change.
- **Turning it off:** remove its entry from `.claude/settings.json`.
- **Starting a session's fingerprint afresh:** delete its file from the `claude-stop-hook` folder that `git rev-parse --git-path claude-stop-hook` names. Fingerprints older than 7 days are deleted on their own.

## Changing this document

The reasons for the hook's design, and the options not taken, are in [`stop-hook.meta.md`](stop-hook.meta.md). Read it only when changing or questioning the hook.
