# Testing

How tests are written and checked in this repository, one kind of test, or check of the tests, per document. The [engineering index](../engineering/README.md) points here rather than to each document. Read this index before writing, changing, moving or reviewing a test, then each document whose "Read when" matches.

## Index

| Document                                                     | Read when                                                                                                                                                                                                                                |
| :----------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Testing conventions](../engineering/testing-conventions.md) | Before writing, changing, or moving any test, including a component or hook test, an end-to-end or tooling test, or replacing an external dependency in a test. It holds every kind of test that doesn't have its own document below yet |
| [Property testing](property-testing.md)                      | Before writing, changing or reviewing a `.property.test.ts`, deciding whether code needs a property test, or when a property test fails, locally or in CI                                                                                |
| [Mutation testing](mutation-testing.md)                      | When oxCrap's code (`scripts/oxcrap/`) changes and the definition of done passes; before running `npm run test:mutation`, or handling a surviving mutant                                                                                 |

## Adding a document

1. Write it as `docs/testing/<kind>.md`, one kind of test or check per file, and move that kind's rules out of [testing conventions](../engineering/testing-conventions.md) in the same change, leaving a one-line pointer there.
2. Add a row to the index above, with a "Read when" trigger specific enough that an agent knows whether it applies.
3. Put its reasons in a `<kind>.meta.md` sidecar, as [Reasons live in a `.meta.md` sidecar](../prose/single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) says, and move that kind's entries out of `testing-conventions.meta.md` with it. Don't give the sidecar an index row.
4. Keep this index to the table and these steps. A rule goes in a document, not here.
