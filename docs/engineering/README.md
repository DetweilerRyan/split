# Engineering procedures

How work on this repository gets done: writing and testing code, choosing dependencies, and the branches and pull requests around them. Each topic has one procedure file, listed below with when to read it.

[`AGENTS.md`](../../AGENTS.md) points to this index rather than to each procedure, so adding a procedure doesn't grow the instructions every session loads. Read the index before an engineering task, then open each procedure whose "Read when" matches.

## Index

| Procedure                                           | Read when                                                                                                                                                                                    |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Pull requests](pull-requests.md)                   | Before opening a pull request, writing its description, or marking it ready; before pushing to a branch that has had a pull request; when `main` moves while a pull request is open          |
| [Post-merge cleanup](post-merge-cleanup.md)         | A pull request you worked on has been merged, before deleting any branch                                                                                                                     |
| [Testing conventions](testing-conventions.md)       | Before writing, changing, or moving a test, or replacing an external dependency in a test                                                                                                    |
| [Choosing and adding dependencies](dependencies.md) | Before adding or changing an entry in `package.json`, before importing a package the repository doesn't import yet, or before writing code for a general problem a library may already solve |

## Adding a procedure

1. Write it as `docs/engineering/<topic>.md` (lowercase, hyphenated), one topic per file.
2. Add a row to the index above, with a "Read when" trigger specific enough that an agent knows whether it applies.
3. Don't add it to `AGENTS.md`; this index is the pointer. The exception is a boundary the owner has asked to have loaded in every session, which gets one line in `AGENTS.md`'s boundaries that links to the procedure.
4. Follow [single source of truth](../prose/single-source-of-truth.md): link to rules that live elsewhere instead of restating them.
