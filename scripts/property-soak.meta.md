# `property-soak`: reasons

Why [`property-soak`](property-soak.md) works the way it does, and what it doesn't do. Read this only when changing or questioning it. Using it needs nothing from this file.

The fast-check behaviour below was checked on fast-check 4.10.2 and Vitest 5.0.5.

## Design

- **A setup file, so no test changes.** fast-check's per-assertion parameters override `fc.configureGlobal`: a global `numRuns` of 5,000 with 50 in the assertion runs 50. So no global setting can raise the count of a property that sets its own, and a soak by settings alone would mean editing each test. Replacing `assert` in a setup file soaks any property as written, new or old.
- **`vi.doMock`, not `vi.mock`.** `vi.mock` is hoisted and always applies; `vi.doMock` is registered only when a variable is set, so a normal run loads the real fast-check. The setup file runs before each test file imports fast-check, so the mock is in place in time. The setup file loads the real module for the soak itself before it registers the mock.
- **Nothing is faked.** The stand-in runs fast-check's own `check` and `assert`, with other parameters.
- **A time budget, not a count.** A fixed count means guessing how fast a property runs, so the same count is seconds for one property and hours for another. A budget spends the same time on each. Hypothesis's adaptive fuzzer, [HypoFuzz](https://github.com/Zac-HD/hypofuzz), makes the same point about a large `max_examples`, and [fast-check's fuzzing guide](https://fast-check.dev/docs/advanced/fuzzing/) runs with a time limit.
- **The `fc.interruptAfterTimeLimit` plugin,** not the `interruptAfterTimeLimit` and `markInterruptAsFailure` parameters, which fast-check 4.10.2 deprecates. The plugin's default treats a run interrupted with no failure as a pass.
- **`fc.check` for a timed soak.** `fc.assert` returns nothing, so it can't say how many inputs ran. `fc.check` returns the run's details. The stand-in logs `numRuns` from them on a pass, and throws `fc.defaultReportMessage` on a failure, which is the report `fc.assert` would have thrown.
- **The time limit also stops shrinking.** fast-check's interrupt applies to every run, shrinks included: a failure planted 10 ms before the limit came back after 2 shrinks, with `interrupted: true`. So the report adds the seed and path to replay when `interrupted` is set, and a replay without the budget finishes the shrink.
- **A replay goes through `fc.assert`,** so it shrinks to the end, reports as a normal failure does, and runs an async property as `fc.assert` does. fast-check carries on through the test's count after a replayed path that passes.
- **The test's own parameters are kept.** `examples` and `plugins` stay, so a soak runs the cases a test pins and the plugins it relies on. The time limit is added after the test's plugins. `examples` count towards `numRuns` in fast-check, which an infinite count makes moot.
- **Strict variables.** A malformed value fails the run instead of being ignored, since a soak that silently runs the usual count would look like a pass. A path without its seed fails too, since a path means nothing without the seed it came from.

## What it doesn't do

- **A timed soak of an async property.** `fc.check` returns a promise for one, which the stand-in would have to await, making it async for every property. Replays of async properties work.
- **Soak `fc.check` calls, or other runners such as `@fast-check/vitest`.** It replaces only `assert`.
- **Split the budget between properties.** Each property gets the whole budget, so the run takes the budget times the number of properties it reaches. `-t` picks one.

## Options not taken

- **A helper each test imports,** such as wrapping its parameters in `soak(params)`. It needs an edit to every property, and an import that some projects' boundaries forbid, such as a tool's tests that may import only from the tool's folder.
- **A global `numRuns` in a setup file** with `fc.configureGlobal`, which per-assertion counts override, as above.
- **A multiplier on each test's count,** instead of a time budget, which keeps the guess about speed.

## Tests

- [`property-soak.test.ts`](property-soak.test.ts) covers reading the variables, the parameters, the report and the stand-in, including a replay of an async property and of a passing seed.
- [`property-soak.property.test.ts`](property-soak.property.test.ts) checks that every whole number reads back, and that anything else is refused.
- [`property-soak.real.test.ts`](property-soak.real.test.ts) runs Vitest for real, in a temporary project with the setup file:
  - a run with no variables is left alone;
  - a soak reports its count and finds a planted failure;
  - a replay of that failure's seed and path reproduces it.

  It also checks that the configs it's given load the setup file.

## Reopen when

- **A timed soak of async properties is needed,** which would make the stand-in async.
- **fast-check removes or changes the `interruptAfterTimeLimit` plugin,** or `RunDetails`' `numRuns`, `interrupted`, `seed` or `counterexamplePath`.
- **Vitest stops applying a setup file's `vi.doMock` to the test files' imports,** which the real test would show.
