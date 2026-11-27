# Code layout

Which folder under `src/` a module belongs in. What each layer may import, and the packages it keeps out, are rules in [Dependency direction](dependency-direction.md#the-rules), which `npm run lint` checks. Read it before an import that crosses from one layer to another.

## The layers

| Folder                          | Holds                                                                                      |
| :------------------------------ | :----------------------------------------------------------------------------------------- |
| `src/utils/`                    | Generic helpers with no business rules, indexed in [its README](../../src/utils/README.md) |
| `src/domain/<subject>/`         | Business rules and the receipt's shape, one folder per subject                             |
| `src/services/`                 | Code that talks to an outside service                                                      |
| `src/sync/`                     | The Yjs store, its React hook, the sync providers, and persistence                         |
| `app/`                          | Routes, and each route's own UI in a private folder beside it                              |
| `src/components/`, `src/hooks/` | UI that more than one route uses. A `.gitkeep` keeps a folder with nothing shared yet      |

The last two rows are UI, which may import any layer. Folders not in the table have no layer rule.

## Where a module goes

- **A business rule, or a type it decides, goes in `src/domain/<subject>/`,** even when only one component uses it today. Add a subject folder when no existing one fits. [Types and schemas](types-and-schemas.md#where-a-type-lives) says where its type lives.
- **A helper goes in `src/utils/` only if it knows nothing about receipts, money or rooms,** so it needs nothing [its rule](dependency-direction.md#the-rules) keeps out. One that does belongs in `src/domain/`. A generic zod schema, one that reads or refines a value without knowing what it's for, goes in `src/utils/schemas/`, one per file. A generic type helper goes in `src/utils/types/`, as [types and schemas](types-and-schemas.md#where-a-type-lives) says. Add a row for a new one to its folder's README.
- **Code that fetches from or calls an outside service goes in `src/services/`.** Pass it what it needs from a layer [its rule](dependency-direction.md#the-rules) keeps out, rather than importing it.
- **Code only one route or module uses lives beside it,** not in a shared folder, until a second one needs it.
  - **A route's own UI,** its components, hooks and display helpers, goes in a private folder in the route's folder under `app/`, named for the module it serves with a leading `_`, such as `app/<route>/_order-view/` for `OrderView`. Next.js keeps a folder that starts with `_` out of routing.
  - **A component with private parts gets a private folder of its own,** inside the folder that holds it, named for it with a leading `_`. For example, `_order-view/_summary/` holds `Summary` and its `SummaryRow`. A component with no parts sits directly in the folder.
  - **Code that routes or modules in one folder share stays in that folder.**
  - **Move it to `src/components/` or `src/hooks/`** when a second route needs it, not before. `npm run lint` fails a module there that isn't imported from two or more folders, not counting tests, through [`scripts/check-shared-folders.ts`](../../scripts/check-shared-folders.ts).
  - **From `app/`, import `src/` through the `@/` alias,** such as `@/domain/<subject>/<module>`. Within a folder, import relatively.
- **Write a React hook for one concern.** It takes the outside effects and browser state it uses as arguments, such as the room's provider or store, a fetcher, the clipboard, `sessionStorage` or `location`, so its test can pass fakes. That's stricter than [_core and shell_](code-design-principles.md#1-core-and-shell-keep-essential-logic-apart-from-the-machinery-around-it), which asks it of code that decides: a hook takes them even when it only wraps the provider. A browser global may be the argument's default. Pure functions, such as `src/domain/`'s, it calls directly. A component composes the hooks and renders.
- **Display code is UI,** so it goes beside the UI that uses it, by the rule above, not in `src/utils/` or `src/domain/`.
- **A new folder under `src/` that a layer rule should cover** needs a rule, added as [Adding or changing a rule](dependency-direction.md#adding-or-changing-a-rule) says, and a row in the table above.

## Changing this document

The reasons for these layers and the owner's decisions behind them are in [code-layout.meta.md](code-layout.meta.md). Read it only when changing or questioning a rule here.
