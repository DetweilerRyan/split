# Agent guidelines

How AI coding agents work on SplitSmart. Keep this file a map: rules that apply to every session live here, and everything else lives in the document a pointer below names.

## Product guidance

Use a mobile-first design language consistent with the existing interface: prioritize clear hierarchy, compact layouts, touch-friendly controls, and important status information that remains easy to find on small screens.

For extracting receipt data and generating SplitSmart room links, follow the [receipt-generation skill](skills/receipt-generation/SKILL.md).

## Where to read more

| Document                                                                       | Read when                                                                                                                                                                      |
| :----------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`docs/engineering/`](docs/engineering/README.md)                              | Before writing or changing code or tests, adding a dependency, or any branch, pull request, or post-merge task. Read the index, then each procedure whose "Read when" matches. |
| [`docs/prose/single-source-of-truth.md`](docs/prose/single-source-of-truth.md) | Before writing, moving, or reviewing documentation, skill files, config comments, or issue and pull request text.                                                              |
| [`docs/sandbox/secrets.md`](docs/sandbox/secrets.md)                           | When a task needs a credential for a service, or an authenticated request is refused in a sandbox.                                                                             |
| [Sandbox kit README](.sbx-kits/splitsmart/README.md)                           | Before starting, changing, or troubleshooting the Docker Sandbox or the VS Code dev container.                                                                                 |

## Boundaries

- **Don't add a dependency without the owner's approval.** Follow [Choosing and adding dependencies](docs/engineering/dependencies.md) before proposing or adding one.
- **Don't merge `main` into a feature branch.** Rebase onto `origin/main` and update the branch with `git push --force-with-lease`. Never force-push `main`.
- **Don't open a pull request as ready, merge one, or push to `main`.** Open pull requests as drafts and follow [Pull requests](docs/engineering/pull-requests.md). The owner merges.
- **Don't keep project knowledge in agent memory.** Claude Code auto memory is off for this repository (`autoMemoryEnabled: false` in [`.claude/settings.json`](.claude/settings.json)). Anything worth keeping (conventions, environment quirks, deferred work) belongs in the repository or in a GitHub issue.
- **Don't put a credential in the repository or the sandbox.** Follow [Sandbox secrets](docs/sandbox/secrets.md).

## Definition of done

A change is not done until each of these exits with code 0, run from the repository root. The repository has no CI, so nothing runs them for you; Vercel's preview build runs only the build.

| Check            | Command                |
| :--------------- | :--------------------- |
| Lint             | `npm run lint`         |
| Formatting       | `npm run format:check` |
| Types            | `npm run typecheck`    |
| Tests            | `npm test`             |
| Production build | `npm run build`        |

`npm run format` fixes formatting in place. Lint rules are in [`.oxlintrc.json`](.oxlintrc.json) and formatter settings in [`.oxfmtrc.json`](.oxfmtrc.json); a warning fails the lint check. Disable a rule only on the line it flags, with a comment saying why the rule doesn't fit there.

In a Docker Sandbox, wait until `~/.cache/splitsmart-kit.log` says `SplitSmart setup complete` before running them; the [kit README](.sbx-kits/splitsmart/README.md) says what to do if setup failed. Say in the pull request which checks you ran and which you did not.
