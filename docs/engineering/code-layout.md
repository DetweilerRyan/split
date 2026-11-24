# Code layout

Which folder under `src/` a module belongs in. What each layer may import, and the packages it keeps out, are rules in [Dependency direction](dependency-direction.md#the-rules), which `npm run lint` checks. Read it before an import that crosses from one layer to another.

## The layers

| Folder                               | Holds                                                                                                                         |
| :----------------------------------- | :---------------------------------------------------------------------------------------------------------------------------- |
| `src/utils/`                         | Generic helpers with no business rules, such as `qr.ts`                                                                       |
| `src/domain/<subject>/`              | Business rules and the receipt's shape, one folder per subject: `receipt/`, `money/`, `room/`                                 |
| `src/services/`                      | Code that talks to an outside service, such as `exchangeRates.ts`                                                             |
| `src/sync/`                          | The Yjs store, its React hook, the sync providers, and persistence                                                            |
| `app/`                               | Routes, and each route's own UI in a private folder beside it, such as `app/r/[room]/_room-view/`                             |
| `src/components/`, `src/hooks/`      | UI that more than one route or module uses; [#112](https://github.com/DetweilerRyan/split/issues/112) moves out what one uses |
| The room entry points in `src/*.tsx` | `RoomEntry` and `IngestEntry`, until [#112](https://github.com/DetweilerRyan/split/issues/112) moves them beside their routes |

The last three rows are UI, which may import any layer. Folders not in the table, such as `src/server/`, `src/data/` and `src/polyfills/`, have no layer rule.

## Where a module goes

- **A business rule, or a type it decides, goes in `src/domain/<subject>/`,** even when only one component uses it today. Add a subject folder when no existing one fits. [Types and schemas](types-and-schemas.md#where-a-type-lives) says where its type lives.
- **A helper goes in `src/utils/` only if it knows nothing about receipts, money or rooms,** so it needs nothing [its rule](dependency-direction.md#the-rules) keeps out. One that does belongs in `src/domain/`.
- **Code that fetches from or calls an outside service goes in `src/services/`.** Pass it what it needs from a layer [its rule](dependency-direction.md#the-rules) keeps out, rather than importing it.
- **Code only one route or module uses lives beside it,** not in a shared folder, until a second one needs it.
  - **A route's own UI,** its components, hooks and display helpers, goes in a private folder in the route's folder under `app/`, named for the module it serves with a leading `_`, such as `app/r/[room]/_room-view/` for `RoomView`. Next.js keeps a folder that starts with `_` out of routing.
  - **A part of a component** goes beside that component, such as `src/components/connectionStatus.ts` beside `Header`.
  - **Move it to `src/components/` or `src/hooks/`** when a second route or module needs it, not before.
  - **From `app/`, import `src/` through the `@/` alias,** such as `@/domain/money/currency`. Within a folder, import relatively.
- **Write a React hook for one concern,** such as `useIdentity` or `useSharing`. It takes the outside effects and browser state it uses as arguments, such as the room's provider or store, a fetcher, the clipboard, `sessionStorage` or `location`, so its test can pass fakes. A browser global may be the argument's default. Pure functions, such as `src/domain/`'s, it calls directly. A component composes the hooks and renders.
- **Display code is UI,** so it goes beside the UI that uses it, by the rule above, not in `src/utils/` or `src/domain/`.
- **A new folder under `src/` that a layer rule should cover** needs a rule, added as [Adding or changing a rule](dependency-direction.md#adding-or-changing-a-rule) says, and a row in the table above.

## Changing this document

The reasons for these layers and the owner's decisions behind them are in [code-layout.meta.md](code-layout.meta.md). Read it only when changing or questioning a rule here.
