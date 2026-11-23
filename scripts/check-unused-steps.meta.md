# `check-unused-steps.ts`: reasons and sources

Why [`check-unused-steps.ts`](check-unused-steps.ts) exists and works the way it does. Read this only when changing or questioning the script. Writing a step definition needs nothing from this file: [testing conventions](../docs/engineering/testing-conventions.md#end-to-end-tests) say what to do when the lint fails.

Decided by the owner in the session on 2026-11-22 ("i want the gate"), on [#59](https://github.com/DetweilerRyan/split/issues/59), after web research that day. The owner asked for this sidecar in review on [#60](https://github.com/DetweilerRyan/split/pull/60#discussion_r4658384821), so the reasons sit beside the script.

## What the research found

- **Undefined and ambiguous steps:** there is consensus.
  - **Undefined steps fail the run.** That's cucumber-js's default strict mode ([cucumber-js CLI](#cucumber-js-cli)), Behave's behaviour, and playwright-bdd's `missingSteps: 'fail-on-gen'`.
  - **A step two definitions match is an error,** as in Reqnroll ([Reqnroll](#reqnroll-scoped-bindings)).
  - **`bddgen` does both** while generating the tests, so `npm run test:e2e` covered them before this script.
- **Don't rely on a dry run for these.** cucumber-js changed `--dry-run` so undefined or ambiguous steps "no longer cause the process to exit with code 1" ([cucumber-js changelog](#cucumber-js-changelog)). playwright-bdd's check doesn't depend on running anything.
- **Unused definitions:** no consensus on gating.
  - **Every ecosystem reports them:** Cucumber's `usage` and `stepdefs` formatters, SpecFlow LivingDoc, Reqnroll's extension, a Behat extension, SpecHygiene, and `bddgen export --unused-steps` ([makandra](#makandra-unused-steps)).
  - **Gating is a team's own check,** like one Cucumber-JVM team's that "prevents new ones in the future" ([JDriven](#jdriven-plugin)).

## Why gate here

- **The usual objection is a false positive:** a step called only from another step looks unused ([makandra](#makandra-unused-steps)).
- **It can't arise here:** steps don't call other steps. The testing conventions say so, and shared behaviour lives in `e2e/screenplay` tasks and questions.
- **Part of `npm run lint`,** not a command of its own, so the definition-of-done table and CI don't change.

## How it works

- **`bddgen export --unused-steps` exits 0 whatever it finds,** so the script reads the count from its `Unused steps (<n>):` line and fails when it isn't 0.
- **If the line is missing, the script fails rather than passing.** A playwright-bdd update that rewords the report then breaks the lint instead of switching the check off.
  - **Not taken: a shell one-liner** such as `bddgen export --unused-steps | grep 'Unused steps (0)'`. It would pass silently once the wording changed.
- **`BDDGEN_CLI`** points the script at a different CLI. Only [its test](check-unused-steps.real.test.ts) uses it, to supply output with no count.
- **The script runs playwright-bdd's CLI from this repository's `node_modules`,** in the folder it was started from. That lets its test run it on throwaway projects, with this repository's `node_modules` linked in.

## Checked

- A definition planted in `e2e/steps` failed `npm run lint`, naming its file and line. The lint passed once it was removed.
- With the count check removed from the script, its test for an unused definition failed.
- The report takes under a second.

## Sources

- <a id="cucumber-js-cli"></a>cucumber-js, [CLI documentation](https://github.com/DanForys/cucumber-js/blob/master/docs/cli.md): strict mode.
- <a id="cucumber-js-changelog"></a>cucumber-js, [changelog](https://www.github.com/cucumber/cucumber-js/blob/main/CHANGELOG.md), #1814: `--dry-run` exit codes.
- <a id="reqnroll-scoped-bindings"></a>Reqnroll, [Scoped bindings](https://docs.reqnroll.net/latest/automation/scoped-bindings.html): ambiguous step definitions.
- <a id="makandra-unused-steps"></a>makandra, [Cucumber: How to find unused step definitions](https://makandracards.com/makandra/59552-cucumber-how-to-find-unused-step-definitions).
- <a id="jdriven-plugin"></a>JDriven, [Cucumber JVM plugin](https://jdriven.com/blog/2019/01/cucumber-jvm-plugin), 2019-01.

## More than one config

- **`-c <config>` names each playwright-bdd config to check;** with none, it reads `playwright.config.ts`.
- **`npm run lint` passes both of the repository's configs:** the app's and oxCrap's features ([#65](https://github.com/DetweilerRyan/split/issues/65)).
- **The list lives in `package.json`,** not in the script, so the script's tests can run it on a throwaway project with one config.
