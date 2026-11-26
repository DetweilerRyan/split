# Feature testing conventions

## What these conventions cover

A feature test checks what a system does for its user, through the interface that user has, in Gherkin scenarios. So far, this repository runs them with [Playwright Test](https://playwright.dev/docs/intro) through [playwright-bdd](https://vitalets.github.io/playwright-bdd/).

The rules under [Scenarios](#scenarios) and [Steps and the Screenplay](#steps-and-the-screenplay) are for the features playwright-bdd runs. So far, that's all of them. A set of features run another way says which of those rules it follows, in its kind's document. The rules in [Feature contracts for deep modules](#feature-contracts-for-deep-modules) apply to every deep module.

The user can be a person using the app, or a developer or an agent using a deep module. Each kind of feature test has its own document, listed in the [testing index](README.md). That document says:

- where its features live;
- what its actors can do;
- how it runs.

This document holds the rules those kinds share. [Testing conventions](testing-conventions.md) holds the rules every test follows.

## Scenarios

- **Write scenarios in the words of the feature's user,** such as the people at the table, or a developer using a tool.
- **Write a scenario only for what the whole system is needed to show.** Keep edge cases in the Vitest tests of the modules inside it.
- **Leave a feature's layout to `npm run format`,** table alignment included, and fix what `npm run lint` reports in it. Each set of features has its rules in a `.gplintrc`.
- **When a feature names how the system is built, reword it in its user's words.** A `.gplintrc`'s `no-restricted-patterns` list fails on such words. When a scenario uses a new one, add it to the list rather than to the scenario.
- **Every other `.gplintrc` copies the root `.gplintrc`'s structural rules:** change a structural rule in each of them.
- **Don't edit `.features-gen/`.** `bddgen` writes the Playwright tests there from the features, and git ignores it.

## Steps and the Screenplay

Steps follow the Screenplay pattern: **actors** use **abilities** to perform **tasks** and answer **questions**. A screenplay holds its cast in `fixtures.ts`, its actor in `actor.ts`, and its tasks and questions.

- **Name an actor in every step,** and get them with `actorCalled(name)`. The same name gives the same actor for the whole scenario. Each actor gets their abilities on first use.
- **Keep step definitions thin.** A step calls `actor.attemptsTo(...)` with tasks, or asserts on `actor.answer(...)` with a question. What the actor does belongs in tasks, and what they read belongs in questions. When a step needs one that doesn't exist, add it to the screenplay rather than doing the work in the step.
- **Every step definition is used by some feature, and steps don't call other steps.**
  - **What fails:** running the features fails on a step with no definition, or one that two definitions match. `npm run lint` fails on a definition no feature uses, through `scripts/check-unused-steps.ts`.
  - **Removing a scenario:** delete any definitions only it used.
  - **Sharing behaviour between steps:** put it in a task or question, not in a call from one step to another.
- **Carry what an actor learns to a later step** with `remember` and `recall`, adding the key and its type to `Notes` in the screenplay's `actor.ts`.
- **Import `test`, `Given`, `When` and `Then` from the screenplay's `fixtures.ts` only.** `createBdd` works only with the `test` that playwright-bdd exports.

## Feature contracts for deep modules

The code design principles' [_deep modules_](../code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour) says what a deep module is. Its contract is what its callers give it and get back, which is the part that survives rewriting its internals.

- **Test a deep module's contract with Gherkin features,** written in its callers' words and kept beside it.
- **Drive the features through the module's own interface.** Run a program end to end, as a process. Drive a module used through code through its functions, which needn't be end to end.
- **Don't keep a second test of the same contract,** such as a `real` test of the program, beside the features.
- **The first deep module used through code sets up its own layout and runner,** with its rules in the document for its kind of test.

### Deciding a module is deep

What makes a module deep is how much its internals outweigh its interface, and nothing measures that. So whether a module is deep is the owner's call.

- **An agent that thinks a module is deep proposes it** in the issue or pull request. It says what the interface is, and what it hides.
- **Until the owner agrees, test it as any other module.** A script keeps its `real` test.

| Deep module               | Decided on                                              |
| :------------------------ | :------------------------------------------------------ |
| oxCrap, `scripts/oxcrap/` | [#65](https://github.com/DetweilerRyan/split/issues/65) |

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [feature-testing-conventions.meta.md](feature-testing-conventions.meta.md). Read it only when changing or questioning a rule here.
