# Feature testing conventions

A feature test checks what a system does for its user, through the interface that user has, in Gherkin scenarios that [Playwright Test](https://playwright.dev/docs/intro) runs through [playwright-bdd](https://vitalets.github.io/playwright-bdd/). The user can be a person using the app, or a developer or an agent using a deep module. Each kind of feature test's own document says where its features live, what its actors can do and how it runs; this document holds the rules they share. The rules every test follows are in [testing conventions](testing-conventions.md).

## Scenarios

- **Write scenarios in the words of the feature's user,** such as the people at the table, or a developer using a tool.
- **Write a scenario only for what the whole system is needed to show.** Keep edge cases in the tests of the modules inside it.
- **Leave a feature's layout to `npm run format`,** table alignment included, and fix what `npm run lint` reports in it. Each set of features has its rules in a `.gplintrc`.
- **When a feature names how the system is built, reword it in its user's words.** A `.gplintrc`'s `no-restricted-patterns` list fails on such words. When a scenario uses a new one, add it to the list rather than to the scenario.
- **Every `.gplintrc` copies the root `.gplintrc`'s structural rules:** change a structural rule in each of them.
- **Don't edit `.features-gen/`.** `bddgen` writes the Playwright tests there from the features, and git ignores it.

## Steps and the Screenplay

Steps follow the Screenplay pattern: **actors** use **abilities** to perform **tasks** and answer **questions**. Each set of features has a screenplay of its own: its cast in `fixtures.ts`, its actor in `actor.ts`, and its tasks and questions.

- **Name an actor in every step,** and get them with `actorCalled(name)`. The same name gives the same actor for the whole scenario. Each actor's abilities are created on first use.
- **Keep step definitions thin.** A step calls `actor.attemptsTo(...)` with tasks, or asserts on `actor.answer(...)` with a question. What the actor does belongs in tasks, and what they read belongs in questions. When a step needs one that doesn't exist, add it to the screenplay rather than doing the work in the step.
- **Every step definition is used by some feature, and steps don't call other steps.**
  - **What fails:** running the features fails on a step with no definition, or one that two definitions match. `npm run lint` fails on a definition no feature uses, through `scripts/check-unused-steps.ts`.
  - **Removing a scenario:** delete any definitions only it used.
  - **Sharing behaviour between steps:** put it in a task or question, not in a call from one step to another.
- **Carry what an actor learns to a later step** with `remember` and `recall`, adding the key and its type to `Notes` in the screenplay's `actor.ts`.
- **Import `test`, `Given`, `When` and `Then` from the screenplay's `fixtures.ts` only.** `createBdd` works only with the `test` that playwright-bdd exports.

## Feature contracts for deep modules

What a deep module is, is in the code design principles' [_deep modules_](../code-design-principles.md#5-deep-modules-give-each-module-a-small-interface-over-a-lot-of-behaviour). Its contract is what its callers give it and get back, which is the part that survives rewriting its internals.

- **Test a deep module's contract with Gherkin features,** written in its callers' words and kept beside it.
- **Drive the features through the module's own interface.** Run a program end to end, as a process. A module used through code is driven through its functions, which needn't be end to end.
- **Keep unit tests for the modules inside it,** for their edge cases.
- **Don't keep a second test of the same contract,** such as a `real` test of the program, beside the features.

### Deciding a module is deep

What makes a module deep is how much its internals outweigh its interface, and that isn't measured. So whether a module is deep is the owner's call.

- **An agent that thinks a module is deep proposes it** in the issue or pull request. It says what the interface is, and what it hides.
- **Until the owner agrees, test it as any other module.** A script keeps its `real` test.

| Deep module               | Decided on                                              |
| :------------------------ | :------------------------------------------------------ |
| oxCrap, `scripts/oxcrap/` | [#65](https://github.com/DetweilerRyan/split/issues/65) |

## Changing this document

The reasons for these rules, their sources, and the options not taken are in [feature-testing-conventions.meta.md](feature-testing-conventions.meta.md). Read it only when changing or questioning a rule here.
