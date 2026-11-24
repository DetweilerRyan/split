# Code layout: reasons and decisions

Why [code layout](code-layout.md) puts code where it does, where its layers came from, and what was rejected. Read this only when changing or questioning a rule there.

## Decisions

### `src/utils/` holds no business or domain logic

- **The owner, on #73's `parseWebsiteLink`,** in the session on 2026-11-24, [recorded on #73](https://github.com/DetweilerRyan/split/pull/73#issuecomment-7121733496): "i'd rather that src/utils remain free of business logic and or domain logic. what are some other options for where websiteLink can live?"
- **The folder name was the owner's:** "what about src/domain/receipt/restarantLinks.ts?" The options offered had been a `src/receipt/` folder, beside `RestaurantModal`, `src/store/`, or a `src/domain/` or `src/lib/` folder.
- **The lint rule was asked for then:** "yes, and include the lint rule in the issue", which became [#94](https://github.com/DetweilerRyan/split/issues/94).
- **Reason:** a helper folder that holds business rules hides them from whoever looks for the rules, and lets UI and infrastructure code grow into them.

### `src/domain/` may import `src/utils/` and plain libraries

- **The owner, in the session on 2026-11-24,** [recorded on #94](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7121899237): "domain may also import from utils".
- **Plain libraries such as `zod` stay allowed,** because the receipt seed's schema and room ids are zod schemas. What's kept out is UI, Yjs, the sync providers and browser storage, which #94's layers table names.
- **The package list goes past #94's,** which named `react`, `yjs`, `y-*`, `@liveblocks/*` and `lucide-react`. `react-dom` and `next` are kept out as UI, and browser-storage packages the repository doesn't use today (`idb`, `idb-keyval`, `localforage`, `dexie`) so that one can't arrive under `src/domain/` unnoticed. They were added in #94's third pull request without the owner's input, as the reversible default: dropping a name loosens nothing else.

### `src/store/` was split, not moved, and renamed `src/sync/`

- **The owner asked:** "maybe store/ needs to be moved into domain??" ([recorded on #94](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7121899237)). The store mixed the receipt's rules with React, Yjs, the providers and browser storage, so its domain parts moved to `src/domain/` and the rest stayed as the sync and persistence layer.
- **"Rename to src/sync/"** was the owner's answer for what remained ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)).
- **`src/sync/` may not import `src/services/`.** The owner's decisions name what sync may import as `src/domain/`, `src/utils/` and its packages; sync imported nothing from `src/services/` when the rule was added, so the rule leaves it out.

### Money formatting is domain logic

- **"Domain, with the money rules":** all of `currency.ts`, formatting and currency labels included, moved to `src/domain/money/` ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)).
- **Not taken:** splitting formatting and labels out as display code beside the components.

### `src/services/` for code at the edge

- **"New src/services/":** `exchangeRates.ts` fetches and caches rates from a service, which is neither a business rule nor a helper. The owner: "It may import `domain/` and `utils/`, but nothing UI or sync" ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)).
- **Not taken:** putting it in `src/store/`, or leaving it in `src/utils/`.
- **"Nothing UI or sync" covers packages too:** React, Next, `lucide-react`, Yjs, the `y-*` providers and Liveblocks are kept out of `src/services/`. Browser storage stays allowed, since `exchangeRates.ts` caches rates in IndexedDB.

### The folder rule lives here

- **"New code-layout.md":** a procedure of its own, with an index row and this sidecar, while the import rules stay rows in [dependency direction](dependency-direction.md) ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)).
- **Not taken:** only rows in dependency direction. Where code belongs is a question asked before any import is written, and that procedure's "Read when" is about imports.

## Known gaps

- **`src/server/`, `src/data/` and `src/polyfills/` have no layer.** #94's table didn't place them, and placing them wasn't decided. `src/data/presets.ts` imports a domain type; `src/server/` serves the MCP route.
- **The UI row has no rule.** UI may import anything above it, so there is nothing to refuse.

## What would reopen this

- **A module that fits no row,** such as a second kind of outside service that the UI or sync must call directly.
- **Sync needing a service,** which `sync-imports-sync-domain-and-utils` refuses today.
- **`RoomSnapshot`'s sync fields growing** ([types and schemas](types-and-schemas.meta.md#where-a-type-lives)), which would put sync state in a domain type.
