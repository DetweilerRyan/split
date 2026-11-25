# `property-soak`

A [Vitest](https://vitest.dev/) setup file that runs [fast-check](https://fast-check.dev/) property tests for a time budget instead of their usual count, or replays one input, from environment variables. It changes no test file, and with none of its variables set it does nothing.

Two files, with no dependencies but Vitest and fast-check:

- [`property-soak.setup.ts`](property-soak.setup.ts), the setup file, which puts the soak in place of fast-check's `assert` when a variable is set;
- [`property-soak.ts`](property-soak.ts), which reads the variables and runs the soak.

## Setting it up

1. **Copy both files** into the same folder.
2. **Load the setup file** in each Vitest config or project that runs property tests:

   ```ts
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: { setupFiles: ['path/to/property-soak.setup.ts'] },
   });
   ```

- **Requirements:** tested with Vitest 5.0.5 and fast-check 4.10.2.
  - **Extension in the import:** the setup file imports `./property-soak.ts` with its extension. A TypeScript project that type-checks it needs `allowImportingTsExtensions` or `rewriteRelativeImportExtensions`.
  - **No enums:** the files use only syntax that erases, so Node can also run them by stripping types.
- **What it replaces:** `assert` on fast-check's default export and its named export, so a test may `import fc from 'fast-check'` or `import { assert } from 'fast-check'`.

## The variables

| Variable                | Value                                          | Effect                                                                                                |
| :---------------------- | :--------------------------------------------- | :---------------------------------------------------------------------------------------------------- |
| `PROPERTY_SOAK_SECONDS` | A whole number of seconds, more than 0         | Each property runs until the time is up, with no limit on how many inputs                             |
| `PROPERTY_SEED`         | A whole number, the seed of a run              | The property runs from that seed. With a budget, the soak starts from it                              |
| `PROPERTY_PATH`         | A path, such as `3:1:0`, from a failure report | With `PROPERTY_SEED` and no budget, replays that input through `fc.assert`, and shrinks it to the end |

An empty value counts as unset. A value that isn't a whole number, a budget of 0 or less, and a path without a seed each fail the run with a message naming the variable.

## Soaking

Run only the file, and the test, you mean to soak:

```bash
PROPERTY_SOAK_SECONDS=120 npx vitest run <file> -t '<test name>' --testTimeout=0 --silent=false
```

- **`--testTimeout=0`** turns off Vitest's test timeout, which would otherwise stop a soak after 5 seconds.
- **`--silent=false`** shows the soak's log, which Vitest hides for a test that passes.
- **`--coverage.enabled=false`** keeps a coverage report from being replaced by this run's, if the config writes one.
- **`-t`** picks one test. Without it, each property in the file soaks for the whole budget, one after another.

Each property that passes logs:

```text
Soak passed: 22375334 inputs in 120 s.
```

A property that fails throws fast-check's report: the shrunk counterexample, its seed and its path. When the time limit also cut shrinking short, the report ends with the values to replay, so the shrink can finish.

The soak keeps the test's own parameters, such as `examples`, `plugins` and its `seed`, and replaces only `numRuns` and the time limit. A `PROPERTY_SEED` replaces the test's seed.

## Replaying a failure

Set the seed and path from the report, with no budget, on that test alone:

```bash
PROPERTY_SEED=<seed> PROPERTY_PATH=<path> npx vitest run <file> -t '<test name>'
```

- **One test only:** every property the run reaches replays the same seed and path, and another property's inputs don't match it, so name the test with `-t`.
- **The usual count:** the replay runs through `fc.assert` with the test's own parameters, so if that input now passes, the run carries on through the test's usual count.

## Limits

- **Async properties:** a replay runs them, but a timed soak refuses one, with an error saying so.
- **Only `fc.assert` is replaced.** A property run with `fc.check`, or through another runner such as `@fast-check/vitest`'s `test.prop`, runs as written.

## What it exports

`property-soak.ts` exports what the setup file uses, for a project that wires it in another way:

- **`readSoak(env)`** reads the variables, and returns `undefined` when none is set.
- **`soakParameters(soak, parameters)`** gives the parameters a property runs with under a soak.
- **`soakReport(soak, details)`** gives what a soak logs or throws, from fast-check's run details.
- **`soakAssert(soak, log)`** gives the function that stands in for `fc.assert`.
- **`SOAK_VARIABLES`** names the variables.

## Changing it

Why it works as it does is in [property-soak.meta.md](property-soak.meta.md). Read it only when changing or questioning the script.
