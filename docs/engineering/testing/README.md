# Testing

This folder says how tests are written and checked in this repository. Each document covers one kind of test, one check of the tests, or conventions several kinds share. The [engineering index](../README.md) points here rather than to each document. Read this index before writing, changing, moving or reviewing a test, then each document whose "Read when" matches.

## Index

| Document                                                      | Read when                                                                                                                                                                                                                                                                                                                 |
| :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Testing conventions](testing-conventions.md)                 | Before writing, changing, moving or reviewing any test or the code that supports one, or when a test fails. Every kind of test follows it, as well as its own document below                                                                                                                                              |
| [Unit testing](unit-testing.md)                               | Before writing, changing, moving or reviewing a test in the `unit` project: an app `<module>.test.ts(x)`, which runs in jsdom, an app `.property.test.ts` included                                                                                                                                                        |
| [Component and hook testing](component-and-hook-testing.md)   | Before writing, changing, moving or reviewing a test of a React component or hook, a `<module>.browser.test.ts(x)`, or the React Compiler in `vitest.config.ts`                                                                                                                                                           |
| [End-to-end testing](end-to-end-testing.md)                   | Before writing, changing, moving or reviewing anything under `e2e/`, `playwright.config.ts` or the root `.gplintrc`'s list of the app's words: a feature, a step definition or the screenplay; or when `npm run test:e2e` fails                                                                                           |
| [Tooling testing](tooling-testing.md)                         | Before writing, changing, moving or reviewing a test of the repository's own dev tools under `scripts/`, or the code that supports one, such as a tool's `features/`, or a test of root tooling config; or when `npm run test:tooling` fails                                                                              |
| [Feature testing conventions](feature-testing-conventions.md) | Before writing, changing, moving or reviewing a feature test, its steps or its screenplay, anywhere, or a `.gplintrc`; before deciding a module is deep or writing its feature contract; or when the lint of a `.feature` file or an unused step fails. Every feature test follows it, as well as its own kind's document |
| [Real testing](real-testing.md)                               | Before writing, changing, moving or reviewing a test in the `real` project, a `<module>.real.test.ts` outside `scripts/`, which runs real programs or touches the file system in Node                                                                                                                                     |
| [Property testing](property-testing.md)                       | Before writing, changing, moving or reviewing a `.property.test.ts`, deciding whether code needs a property test, or when a property test fails, locally or in CI                                                                                                                                                         |
| [Mutation testing practices](mutation-testing-practices.md)   | When oxCrap's code (`scripts/oxcrap/`) changes and the definition of done passes; before running `npm run test:mutation`, or handling a surviving mutant                                                                                                                                                                  |
| [CRAP testing practices](crap-testing-practices.md)           | When a CRAP report from the hook, CI or `npm run oxcrap` lists a function, or before adding or changing a `@crap-allow` comment                                                                                                                                                                                           |

## Adding a document

1. Write it as `docs/engineering/testing/<name>.md`, named as below, with one kind of test, check or set of shared rules per file. In the same change, move its rules out of the document that holds them, and leave a one-line pointer there.
   - **A document whose rules several kinds share** is named `<topic>-conventions.md`, as `testing-conventions.md` and `feature-testing-conventions.md` are. Its rules don't name the kinds that follow it. Testing conventions' project table and pointers name each kind only to send a reader to its document.
   - **A document for a kind of test** is named `<kind>-testing.md`, as `unit-testing.md` is.
   - **A document for a check of the tests, rather than a kind of test,** is named `<check>-testing-practices.md`, as `mutation-testing-practices.md` and `crap-testing-practices.md` are.
   - **A kind's document may point to a conventions or practices document,** never to another kind's. Put a rule two kinds need in a conventions document both point to.
   - **A kind's document has four sections,** in this order:
     - "What this kind of test is", naming its files;
     - "How the conventions apply", with its example of a specific assertion and each bullet that applies a conventions rule to it;
     - "Rules of its own", with these subsections:
       - "When to write one", "Writing one" and "When one fails", in that order;
       - the kind's own subsections, where they fit;
     - "Changing this document".

     A subsection the kind has no rule for points to the conventions rule that applies. A conventions document opens with what it covers, and a practices document with what its check is.
2. Add a row to the index above, with a "Read when" trigger specific enough that an agent knows whether it applies.
3. Put its reasons in a `<name>.meta.md` sidecar beside it, or where they already live, as [Reasons live in a `.meta.md` sidecar](../../prose/single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) says. The CRAP document's reasons, for example, live in `scripts/oxcrap/oxcrap.meta.md`. Move its entries out of the sidecar that holds them, and leave a one-line pointer there. Don't give the sidecar an index row.
4. Keep this index to the table and these steps. Put a rule in a document, not here.
