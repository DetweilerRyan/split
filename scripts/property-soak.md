# `property-soak`

A [Vitest](https://vitest.dev/) setup file that runs [fast-check](https://fast-check.dev/) property tests for a time budget instead of their usual count, or replays a failure, from environment variables. It works through fast-check's global configuration, as [fast-check's fuzzing guide](https://fast-check.dev/docs/advanced/fuzzing/) does, so it changes no test file. With none of its variables set, it does nothing.

Two files, with no dependencies but Vitest and fast-check:

- [`property-soak.setup.ts`](property-soak.setup.ts), the setup file, which applies the soak to fast-check's global settings and plugins when a variable is set;
- [`property-soak.ts`](property-soak.ts), which reads the variables and builds those settings and plugins.

## Setting it up

1. **Copy both files** into the same folder.
2. **Load the setup file** in each Vitest config or project that runs property tests:

   ```ts
   import { defineConfig } from 'vitest/config';

   export default defineConfig({
     test: { setupFiles: ['path/to/property-soak.setup.ts'] },
   });
   ```

- **Requirements:** tested with Vitest 5.0.5 and fast-check 4.10.2. It needs fast-check 4.10 or later, for global plugins.
  - **Extension in the import:** the setup file imports `./property-soak.ts` with its extension. A TypeScript project that type-checks it needs `allowImportingTsExtensions` or `rewriteRelativeImportExtensions`.
  - **No enums:** the files use only syntax that erases, so Node can also run them by stripping types.

## Writing a property a soak can reach

fast-check's per-assertion parameters override its global ones, so **a property that sets its own `numRuns` isn't soaked**, and one that sets its own `seed` isn't replayed. Leave both out of a new property until it has been soaked. Add `numRuns` afterwards if it should run more than fast-check's default of 100 inputs.

A soak says when it couldn't reach a property:

```text
Not soaked: this property sets its own numRuns (300), which overrides the soak.
```

## The variables

| Variable                | Value                                                 | Effect                                                                  |
| :---------------------- | :---------------------------------------------------- | :---------------------------------------------------------------------- |
| `PROPERTY_SOAK_SECONDS` | A whole number of seconds, more than 0                | Each property runs until the time is up, with no limit on inputs        |
| `PROPERTY_SEED`         | A whole number: the seed from a failure report        | Properties run from that seed, so they generate the same inputs again   |
| `PROPERTY_RUNS`         | A whole number, more than 0: the tests a failure took | With `PROPERTY_SEED`, runs exactly that many inputs, with no time limit |

An empty value counts as unset. Each of these fails the run, with a message naming the variable:

- a value that isn't a whole number;
- a budget or count of 0 or less;
- `PROPERTY_RUNS` without `PROPERTY_SEED`;
- `PROPERTY_RUNS` with `PROPERTY_SOAK_SECONDS`.

## Soaking

Run only the file, and the test, you mean to soak:

```bash
PROPERTY_SOAK_SECONDS=120 npx vitest run <file> -t "<test name>" --testTimeout=0 --silent=false --coverage.enabled=false
```

- **`--testTimeout=0`** turns off Vitest's test timeout, which would otherwise stop a soak after 5 seconds.
- **`--silent=false`** shows the soak's log, which Vitest hides for a test that passes.
- **`--coverage.enabled=false`** keeps a coverage report from being replaced by this run's, if the config writes one.
- **`-t`** picks one test. It takes a regular expression matched against test names, so escape characters such as `(` or `.` in a name. Without it, each property in the file soaks for the whole budget, one after another.

Each property that passes logs:

```text
Soak passed: 22375334 inputs in 120 s.
```

A property that fails throws fast-check's usual report: the shrunk counterexample, the seed, and how many tests it took to fail. When the time limit also cut shrinking short, the soak logs the values to replay, so the shrink can finish.

## Replaying a failure

Set the seed, and the count from "Property failed after N tests", on that test alone:

```bash
PROPERTY_SEED=<seed> PROPERTY_RUNS=<N> npx vitest run <file> -t "<test name>" --testTimeout=0
```

The same seed generates the same inputs, so the run fails on the same input and shrinks it to the end. It takes about as long as the soak took to reach the failure, so keep `--testTimeout=0`. For a failure from a normal run, at the test's usual count, `PROPERTY_SEED` alone is enough.

Every property the run reaches uses the same seed, so name the test with `-t`.

## Limits

- **A property's own `numRuns` or `seed` wins,** as above.
- **Counts left to the default:** during a soak, fast-check's default count is unlimited, so `fc.sample` and `fc.statistics` called without a count never finish. Pass them a count.
- **Where it reaches:** the soak sets fast-check's global configuration for each test file the run loads, through `setupFiles`, so it reaches every property those files run. With Vitest's `isolate: false`, the files share one module graph, and the setup file installs its plugins once.

## What it exports

`property-soak.ts` exports what the setup file uses, for a project that wires it in another way:

- **`readSoak(env)`** reads the variables, and returns `undefined` when none is set.
- **`soakSettings(soak)`** gives the global parameters for `fc.configureGlobal`.
- **`soakPlugins(soak, log)`** gives the plugins for `fc.installGlobalPlugin`: the time limit, and one that logs what the soak found.
- **`soakReport(soak, details)`** gives the line that plugin logs for a property, if any.
- **`SOAK_VARIABLES`** names the variables.

## Changing it

Why it works as it does is in [property-soak.meta.md](property-soak.meta.md). Read it only when changing or questioning the script.
