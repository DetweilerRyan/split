# `property-soak`: reasons

Why [`property-soak`](property-soak.md) works the way it does, and what it doesn't do. Read this only when changing or questioning it. Using it needs nothing from this file.

The fast-check behaviour below was checked on fast-check 4.10.2 and Vitest 5.0.5.

## Design

- **fast-check's global configuration, from a setup file.** This is fast-check's own way to run more inputs: its [fuzzing guide](https://fast-check.dev/docs/advanced/fuzzing/) sets `fc.configureGlobal({ numRuns })`, and its [global settings page](https://fast-check.dev/docs/configuration/global-settings/) loads that from a test runner's setup file, Vitest's `setupFiles` included. Nothing is mocked or wrapped, so a test runs fast-check exactly as written.
- **Environment variables switch it on.** fast-check reads none itself, and has no command-line flag. Variables leave every normal run untouched, and need no edit to soak a test.
- **A property's own `numRuns` wins.** fast-check's docs: "The per-assertion form always overrides the global one". So a property that sets `numRuns` isn't soaked, and the rule is to leave it out until a property has been soaked. The report plugin reads `runConfiguration.numRuns` and says "Not soaked" when it's finite, since a log of "Soak passed: 300 inputs" would look like a soak that ran.
- **A time budget, not a count.** A fixed count means guessing how fast a property runs, so the same count is seconds for one property and hours for another. A budget spends the same time on each. [HypoFuzz](https://github.com/Zac-HD/hypofuzz), a fuzzer for Hypothesis tests, makes the same point about a large `max_examples`.
- **Plugins, installed with `fc.installGlobalPlugin`.** `plugins` isn't a global parameter: `GlobalParameters` leaves out `path`, `examples` and `plugins`. The time limit is fast-check's `fc.interruptAfterTimeLimit` plugin, whose default treats a run interrupted with no failure as a pass. The `interruptAfterTimeLimit` and `markInterruptAsFailure` parameters, and the `reporter` parameter, are deprecated in 4.10.2 in favour of plugins.
- **The report plugin only logs.** Its `onAllRunsComplete` hook logs the count on a pass, and the replay values when shrinking was cut short. It never throws, because fast-check runs the hook for `fc.check` too, and a throw there would break `fc.check`, which should return its details. `fc.assert` throws its own report on a failure, as usual. One synchronous hook serves both sync and async properties.
- **A replay by seed and count, not seed and path.** `path` can't be set globally. The same seed generates the same inputs in the same order whatever the count (checked: a soak's failure after 359 tests came back, with the same shrunk counterexample, from that seed and `numRuns: 359`; 358 passed). So the seed and the count from "Property failed after N tests" replay it, with no time limit, and shrinking runs to the end. A failure from a normal run, at the test's usual count, replays from the seed alone.
- **The time limit also stops shrinking.** fast-check's interrupt applies to every run, shrinks included: a failure planted 10 ms before the limit came back after 2 shrinks, with `interrupted: true`. So the report plugin logs the seed and count to replay when a failure was interrupted.
- **Strict variables.** A malformed value fails the run instead of being ignored, since a soak that silently runs the usual count would look like a pass. A count without its seed fails too, since a count replays nothing without the seed it came from. A count with a budget fails, since the count would cap the budget.

## What it doesn't do

- **Soak a property that sets its own `numRuns`,** or replay one that sets its own `seed`, as above.
- **Split the budget between properties.** Each property gets the whole budget, so the run takes the budget times the number of properties it reaches. `-t` picks one.
- **Stop a predicate mid-run.** fast-check can't, so the time limit takes effect between inputs, and a slow predicate overruns it by up to one run.

## Options not taken

- **Replacing `fc.assert` with a mock** that sets the parameters on each call. It soaks a property that sets its own `numRuns` too, but it mocks a library, and changes what every test calls.
- **A helper each test imports,** such as wrapping its parameters in `soak(params)`. It needs an edit to every property, and an import that some projects' boundaries forbid, such as a tool's tests that may import only from the tool's folder.
- **A multiplier on each test's count,** instead of a time budget, which keeps the guess about speed.

## Tests

- [`property-soak.test.ts`](property-soak.test.ts) covers reading the variables, the settings, the report and the plugins, including an async property.
- [`property-soak.property.test.ts`](property-soak.property.test.ts) checks that every valid budget, seed and count reads back, and that a budget not written as a whole number is refused.
- [`property-soak.real.test.ts`](property-soak.real.test.ts) runs Vitest for real, in a temporary project with the setup file:
  - a run with no variables keeps fast-check's default count;
  - a soak reports its count, finds a planted failure, and says it can't soak a property with its own count;
  - a replay of that failure's seed and count reproduces it.

  It also checks that the configs it's given load the setup file.

## Reopen when

- **fast-check adds a global setting that overrides per-assertion counts,** or reads an environment variable itself.
- **fast-check changes `installGlobalPlugin`, `interruptAfterTimeLimit`, `onAllRunsComplete`,** or `RunDetails`' `numRuns`, `interrupted`, `seed` or `runConfiguration`.
- **A soak must reach properties that set their own `numRuns`,** which only replacing `fc.assert` does.
