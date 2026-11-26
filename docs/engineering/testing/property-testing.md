# Property testing

The rules every test follows, such as staying offline, are in [testing conventions](testing-conventions.md); this document adds the ones for property tests.

A property test checks a rule that should hold for every input, against many inputs [fast-check](https://fast-check.dev/) generates. When one fails, fast-check shrinks the input to the smallest one that still breaks the rule.

`scripts/oxcrap/complexity.property.test.ts` is an example.

## When to write one

- **Write one when you can state a rule for all inputs, and check it without working out the answer the way the code does.** For example:
  - **a round trip:** decoding what was encoded gives back the original;
  - **an invariant:** the shares of a split add up to the total;
  - **an answer the generator knows:** oxCrap's generated functions record how many branches they have;
  - **agreement with a simpler version** of the same code.
- **Don't write one** for components, or for code whose right answer you'd have to work out the same way the code does. Example tests say those more clearly.
- **Keep the example tests too.** A property test adds inputs nobody thought of; it doesn't replace the cases a reader needs to see.
- **Put it in its own sidecar,** named as [testing conventions](testing-conventions.md#which-project-a-test-belongs-in) say.

## Writing one

`npm run lint` checks several of these rules in every `*.property.test.ts`, through the local plugin [`property/*`](../../../scripts/lint/property.md). Its README lists what each rule reports and what to write instead.

- **Generate every way the input can be written, not just its plainest form.** List the rules the code decides, from its issue's decisions or its README, and give the arbitrary a dimension for each:
  - **where the thing lives,** such as in the file or imported from another;
  - **the forms it can take,** such as wrappers, casts or aliases;
  - **code nearby that must, or must not, change the answer.**

  A generator of the plainest shape checks the headline claim and none of the decisions around it.

- **For code that recognises a pattern, generate the dodges and the look-alikes:** rewrites that get around it, and code it must leave alone. Each should give the answer the plain version gives, or the answer for no pattern at all, such as the same code reading a name that isn't a table.
- **Build inputs from fast-check's arbitraries,** and assert with `expect` inside `fc.property`. Return nothing from the property.
- **Make assertions specific,** as [testing conventions](testing-conventions.md#what-a-test-checks) says. For a property, the rule itself:

  ```ts
  // ✅ Specific: the shares add up to exactly the total
  expect(allocateMinor(total, weights).reduce((sum, share) => sum + share, 0)).toBe(total);

  // ❌ Vague: some shares came back, which passes whatever the split does
  expect(allocateMinor(total, weights)).toBeDefined();
  ```

- **Build constraints into the arbitraries,** such as `fc.integer({ min: 1 })`, rather than filtering inputs out with `fc.pre` or `.filter`. Filtering wastes runs and can leave few inputs that test anything.
- **Don't write a property that only restates what the generator guarantees,** such as checking that a generated positive number is positive. It passes whatever the code does.
- **Show a new property can fail.** Break the code it checks, for example by removing a branch or changing a rule, and confirm the property fails. Then put the code back. A property that passes either way tests nothing.
  - **Mutation testing breaks most of the rules a generator varies for you,** where it runs, as [Mutation testing](mutation-testing.md) says. A mutant on such a rule that survives means no dimension reaches it. Break by hand only the rules no mutant can undo, such as a call wrapped around a value, which no mutator removes.
- **When a review or a mutation run finds a bug a property test missed,** add the dimension that would have caught it, and confirm the property fails with the fix undone.
- **Leave `numRuns` and `seed` out of a new property until it has been soaked.** A soak can't reach a property that sets its own.
- **Keep it fast.** fast-check runs 100 inputs by default. After the soak, raise `numRuns` only for a check that's cheap to run, as oxCrap's complexity property is. This is the count CI runs.

## Soaking a new property

Before you commit a new property, run it for two minutes rather than its usual count, and keep running it until a full run passes. The soak is set by environment variables, which [`property-soak`](../../../scripts/property-soak.md) reads. Don't edit the test to soak it.

1. **Start the soak as a background command,** and keep working until it finishes. For a property under `src/` or `app/`:

   ```bash
   PROPERTY_SOAK_SECONDS=120 npx vitest run <path> -t "<test name>" --testTimeout=0 --silent=false --coverage.enabled=false
   ```

   For one under `scripts/`, add `-c vitest.tooling.config.ts`. `-t` takes a regular expression, so escape characters such as `(` or `.` in the name. Leave out `-t` to soak every property in the file, each for the full two minutes.

2. **Read the result when it finishes.**
   - **`Soak passed:`** gives how many inputs the property ran.
   - **`Not soaked:`** means the property sets its own `numRuns`. Take it out and soak again.
   - **A failure** prints the shrunk input, the seed, and how many tests it took to fail.
3. **If the soak says the time limit cut shrinking short,** replay the seed and count it gives on that test alone, as [When one fails](#when-one-fails) shows, and use the input that run shrinks to.
4. **Handle each failure** as [When one fails](#when-one-fails) says.
5. **Soak it again.**

Once a soak passes, say in the pull request how many inputs it ran and what it found.

## When one fails

- **Its output gives a seed, and how many tests it took to fail.** Run the same input again, with full shrinking, on that test alone. Every property the command runs uses the seed, so name the file and the test:

  ```bash
  PROPERTY_SEED=<seed> PROPERTY_RUNS=<tests it took> npx vitest run <path to file> -t "<test name>" --testTimeout=0 --coverage.enabled=false
  ```

  For a failure from a normal run or CI, rather than a soak, `PROPERTY_SEED` alone is enough. For a file under `scripts/`, add `-c vitest.tooling.config.ts`. A replay of a soak's failure takes about as long as the soak took to reach it, so run it as a background command too.

- **Decide where the fault is.** The property or its generator may be wrong, such as a rule that doesn't hold for an input the code handles correctly, or the code may be.
- **Keep the shrunk input** as [Keeping a failing input](#keeping-a-failing-input) says, before you fix anything.
- **If the code is wrong,** confirm the new example test fails, then fix the code, as [Fixing a bug](testing-conventions.md#fixing-a-bug) says. If the property is wrong, fix the property.

## Keeping a failing input

Keep every shrunk input a property test fails on, whether a soak, a local run or CI found it, in two places:

- **As an example test** in the module's `.test.ts`, asserting the right answer for that input.
- **In the property's `examples`.** fast-check counts `examples` towards `numRuns`, so if the property sets `numRuns`, raise it by the number of examples you add.

Beside both, say where it was found:

- `// Found by a soak run on #<pull request>.`
- `// Found by CI on #<pull request>.`
- `// Found by a local run on #<pull request>.`

## Changing this document

The reasons for these rules, their sources, and the cases behind them are in [property-testing.meta.md](property-testing.meta.md). Read it only when changing or questioning a rule here.
