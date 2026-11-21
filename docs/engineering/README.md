# Engineering procedures

How work on this repository gets done: writing and testing code, choosing dependencies, and the branches and pull requests around them. Each topic has one procedure file, listed below with when to read it.

[`AGENTS.md`](../../AGENTS.md) points to this index rather than to each procedure, so adding a procedure doesn't grow the instructions every session loads. Read the index before an engineering task, then open each procedure whose "Read when" matches.

## Index

| Procedure                                           | Read when                                                                                                                                                                                               |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [Branch setup](branch-setup.md)                     | Before starting work on a new branch                                                                                                                                                                    |
| [Resuming a branch](branch-resume.md)               | Before continuing work on a branch that an earlier session started, including after the session's context was cleared                                                                                   |
| [Pull requests](pull-requests.md)                   | Before opening a pull request, writing its description, or marking it ready; before pushing to a branch that has had a pull request; when `main` moves while a pull request is open; when reviewing one |
| [Post-merge cleanup](post-merge-cleanup.md)         | A pull request you worked on has been merged, before deleting any branch                                                                                                                                |
| [Testing conventions](testing-conventions.md)       | Before writing, changing, or moving a test, including a component or hook test, or replacing an external dependency in a test                                                                           |
| [Choosing and adding dependencies](dependencies.md) | Before adding or changing an entry in `package.json`, before importing a package the repository doesn't import yet, or before writing code for a general problem a library may already solve            |
| [Types and schemas](types-and-schemas.md)           | Before adding, moving or changing a type, interface or zod schema                                                                                                                                       |
| [CI](ci.md)                                         | Before changing `.github/workflows/`, updating `playwright` or a GitHub Action, or when a pull request's CI run fails                                                                                   |

## Adding a procedure

1. Write it as `docs/engineering/<topic>.md` (lowercase, hyphenated), one topic per file.
2. Add a row to the index above, with a "Read when" trigger specific enough that an agent knows whether it applies.
3. Don't add it to `AGENTS.md`; this index is the pointer. The exception is a boundary the owner has asked to have loaded in every session, which gets one line in `AGENTS.md`'s boundaries that links to the procedure.
4. Follow [single source of truth](../prose/single-source-of-truth.md): link to rules that live elsewhere instead of restating them.
5. Keep the procedure to instructions. Put its reasons, sources and the decisions behind it in a `docs/engineering/<topic>.meta.md` sidecar, linked from a final "Changing this document" section, as [Reasons live in a `.meta.md` sidecar](../prose/single-source-of-truth.md#reasons-live-in-a-metamd-sidecar) says. Don't give the sidecar an index row.
