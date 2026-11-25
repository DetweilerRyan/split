# Property testing

A property test checks a rule that should hold for every input, against many inputs [fast-check](https://fast-check.dev/) generates. When one fails, fast-check shrinks the input to the smallest one that still breaks the rule. Where a test file goes and which project runs it are in [testing conventions](../engineering/testing-conventions.md#which-project-a-test-belongs-in).

`scripts/oxcrap/complexity.property.test.ts` is an example.

## When to write one

- **Write one when you can state a rule for all inputs, and check it without working out the answer the way the code does.** For example:
  - **a round trip:** decoding what was encoded gives back the original;
  - **an invariant:** the shares of a split add up to the total;
  - **an answer the generator knows:** oxCrap's generated functions record how many branches they have;
  - **agreement with a simpler version** of the same code.
- **Don't write one** for components, or for code whose right answer you'd have to work out the same way the code does. Example tests say those more clearly.
- **Keep the example tests too.** A property test adds inputs nobody thought of; it doesn't replace the cases a reader needs to see.
- **Put it in its own sidecar,** `<module>.property.test.ts`, beside the module. It runs with the module's other unit tests, and counts towards the coverage report like them.

## Writing one

- **Generate every way the input can be written, not just its plainest form.** List the rules the code decides, from its issue's decisions or its README, and give the arbitrary a dimension for each:
  - **where the thing lives,** such as in the file or imported from another;
  - **the forms it can take,** such as wrappers, casts or aliases;
  - **code nearby that must, or must not, change the answer.**

  A generator of the plainest shape checks the headline claim and none of the decisions around it.

- **For code that recognises a pattern, generate the dodges and the look-alikes:** rewrites that get around it, and code it must leave alone. Each should give the answer the plain version gives, or the answer for no pattern at all, such as the same code reading a name that isn't a table.
- **Build inputs from fast-check's arbitraries,** and assert with `expect` inside `fc.property`. Return nothing from the property.
- **Build constraints into the arbitraries,** such as `fc.integer({ min: 1 })`, rather than filtering inputs out with `fc.pre` or `.filter`. Filtering wastes runs and can leave few inputs that test anything.
- **Don't write a property that only restates what the generator guarantees,** such as checking that a generated positive number is positive. It passes whatever the code does.
- **Show a new property can fail.** Break the code it checks, for example by removing a branch or changing a rule, and confirm the property fails. Then put the code back. A property that passes either way tests nothing.
  - **Mutation testing breaks most of the rules a generator varies for you,** where it runs, as [Mutation testing](mutation-testing.md) says. A mutant on such a rule that survives means no dimension reaches it. Break by hand only the rules no mutant can undo, such as a call wrapped around a value, which no mutator removes.
- **When a review or a mutation run finds a bug a property test missed,** add the dimension that would have caught it, and confirm the property fails with the fix undone.
- **Keep it fast.** fast-check runs 100 inputs by default. Raise `numRuns` only for a check that's cheap to run, as oxCrap's complexity property is. This is the count CI runs.

## Soaking a new property

Before you commit a new property, run it for two minutes rather than a fixed count, and keep running it until a full run passes.

1. **Hand the soak to a background subagent,** so the session keeps working while it runs. Give it the property's path and these steps up to the report. It changes no file but the property's, and puts that back. Don't edit the property's file while the soak runs.
2. **Give the property a time budget.** In its `fc.assert` parameters, put:

   ```ts
   { numRuns: Number.POSITIVE_INFINITY, interruptAfterTimeLimit: 120_000, markInterruptAsFailure: false }
   ```

   To see how many inputs ran, call `fc.check` with the same parameters and log the result's `numRuns`.

3. **Run only its file, with Vitest's timeout off,** or Vitest stops the test after 5 seconds:

   ```bash
   npx vitest run <path> --testTimeout=0
   ```

4. **Report, then put the property's parameters back.** The report gives how many inputs ran and, for each failure, the shrunk input, seed and path.
5. **For each failure, decide where the fault is.** If the code is wrong, fix the code. If the property or its generator is wrong, such as a rule that doesn't hold for an input the code handles correctly, fix the property.
6. **Keep the shrunk input twice.** CI runs far fewer inputs and may never generate it again.
   - **As an example test** in the module's `.test.ts`, asserting the right answer for that input. This checks the answer without the property.
   - **In the property's `examples`,** so the property itself always runs it. fast-check runs `examples` first, and counts them towards `numRuns`, so raise `numRuns` by the number of examples you add.
7. **Say where each one came from,** in a comment beside both: `// Found by a soak run on #<pull request>.` A later session can then tell it was kept on purpose, not added as a duplicate.
8. **Soak it again.**

Once a soak passes, say in the pull request how many inputs it ran and what it found.

## When one fails

- **Its output gives a seed and a path.** Pass them to `fc.assert` as `{ seed, path }` to run the same input again.
- **Once it's fixed, keep the shrunk input** as for a soak failure, saying where it was found.

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [property-testing.meta.md](property-testing.meta.md). Read it only when changing or questioning a rule here.
