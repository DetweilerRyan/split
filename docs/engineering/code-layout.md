# Code layout

Which folder under `src/` a module belongs in, and which layers it may import. The import rules are checked by `npm run lint`; [Dependency direction](dependency-direction.md#the-rules) lists them, and says what to do when one fails and how to change one.

## The layers

| Folder                                                                            | Holds                                                                                         | May import                                                                                                                    |
| :-------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/`                                                                      | Generic helpers with no business rules, such as `qr.ts`                                       | `src/utils/` and npm packages                                                                                                 |
| `src/domain/<subject>/`                                                           | Business rules and the receipt's shape, one folder per subject: `receipt/`, `money/`, `room/` | `src/domain/`, `src/utils/`, and plain libraries such as `zod`. No React, Next, icons, Yjs, sync providers or browser storage |
| `src/services/`                                                                   | Code that talks to an outside service, such as `exchangeRates.ts`                             | `src/services/`, `src/domain/`, `src/utils/`, and packages other than UI and sync ones                                        |
| `src/sync/`                                                                       | The Yjs store, its React hook, the sync providers, and persistence                            | `src/sync/`, `src/domain/`, `src/utils/`, and its packages. Nothing UI                                                        |
| `src/components/`, `src/hooks/`, `app/`, and the room entry points in `src/*.tsx` | UI                                                                                            | Anything above                                                                                                                |

Folders not in the table, such as `src/server/`, `src/data/` and `src/polyfills/`, have no layer rule.

## Where a module goes

- **A business rule, or a type it decides, goes in `src/domain/<subject>/`,** even when only one component uses it today. Add a subject folder when no existing one fits. [Types and schemas](types-and-schemas.md#where-a-type-lives) says where its type lives.
- **A helper goes in `src/utils/` only if it knows nothing about receipts, money or rooms.** If it would need to import `src/domain/`, it belongs in `src/domain/`.
- **Code that fetches from or calls an outside service goes in `src/services/`.** Pass it what it needs from the UI or the store, rather than importing them.
- **Display code goes beside the UI that uses it,** such as `src/components/connectionStatus.ts` beside `Header`, not in `src/utils/` or `src/domain/`.
- **A new folder under `src/` that a layer rule should cover** needs a rule, added as [Adding or changing a rule](dependency-direction.md#adding-or-changing-a-rule) says, and a row in the table above.

## Changing this document

The reasons for these layers and the owner's decisions behind them are in [code-layout.meta.md](code-layout.meta.md). Read it only when changing or questioning a rule here.
