# Single source of truth

Every fact in this repository is written in one place, its **owner**, and everything else links to it. A fact written in two places drifts: a later edit updates one copy and misses the other, and the copies end up contradicting each other.

## Rules

1. **One owner per fact.** Before writing a fact (a command, a path, a setting, a rule), search for it with `git grep -n "<phrase>"`. If it already exists, link to it instead of restating it.
2. **Pointers say where and when, not what.** A pointer names the owner and when to read it. Don't summarize the owner; a summary is a copy.
3. **Put the owner nearest what it describes,** using the table below.
4. **Prefer owners that code reads.** When code depends on a fact, the code or its schema is the owner, and documents link to it. The receipt seed's extraction rules, for example, are the field descriptions in `src/types/seedSchema.ts`.
5. **Moving a fact is one change.** Delete the old copy in the same commit, and check that the fact still exists at its owner.

| Kind of fact                                                          | Owner                                                                            |
| :-------------------------------------------------------------------- | :------------------------------------------------------------------------------- |
| What the app is, how to run and deploy it, the MCP server, currencies | [`README.md`](../../README.md)                                                   |
| Boundaries for every agent session, and the definition of done        | [`AGENTS.md`](../../AGENTS.md)                                                   |
| How engineering work is done                                          | [`docs/engineering/`](../engineering/README.md)                                  |
| Receipt seed fields and their extraction rules                        | `src/types/seedSchema.ts`                                                        |
| How an agent extracts a receipt and makes a room link                 | [`skills/receipt-generation/SKILL.md`](../../skills/receipt-generation/SKILL.md) |
| The Docker Sandbox kit and dev container                              | [`.sbx-kits/splitsmart/README.md`](../../.sbx-kits/splitsmart/README.md)         |
| Sandbox credentials                                                   | [`docs/sandbox/secrets.md`](../sandbox/secrets.md)                               |
| Tool settings                                                         | The config file itself, with a comment saying why where the format allows one    |
| Writing conventions like this one                                     | `docs/prose/`                                                                    |

## Facts, not text

This applies to the same **fact**, not to similar-looking **text**. Two passages can read alike and still be separate facts that change for different reasons; leave those alone. To tell the cases apart, ask: **if this changed, would the other passage have to change too?** If yes, it's one fact; give it one owner.

## Allowed repetition

- **Commands meant to be copied** keep their literal values so they run as written.
- **Error text in troubleshooting notes** is quoted exactly so a search lands there.
- **A skill or prompt used outside this repository,** such as one served by the MCP server, may carry a copy of a rule it can't link to. Mark the copy as derived from its owner.
- **Pull request and issue descriptions** link to files rather than restating content that will keep changing.
