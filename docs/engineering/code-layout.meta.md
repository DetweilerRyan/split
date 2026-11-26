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
- **Which packages each layer keeps out, and why,** is in [dependency direction's sidecar](dependency-direction.meta.md#which-packages-each-override-keeps-out), with the package bans.

### `src/store/` was split, not moved, and renamed `src/sync/`

- **The owner asked:** "maybe store/ needs to be moved into domain??" ([recorded on #94](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7121899237)). The store mixed the receipt's rules with React, Yjs, the providers and browser storage, so its domain parts moved to `src/domain/` and the rest stayed as the sync and persistence layer.
- **"Rename to src/sync/"** was the owner's answer for what remained ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)).
- **`src/sync/` may not import `src/services/`.** [#94's layers table](https://github.com/DetweilerRyan/split/issues/94) names what sync may import as `src/domain/`, `src/utils/` and its packages; sync imported nothing from `src/services/` when the rule was added, so the rule leaves it out.

### Money formatting is domain logic

- **"Domain, with the money rules":** all of `currency.ts`, formatting and currency labels included, moved to `src/domain/money/` ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)).
- **Not taken:** splitting formatting and labels out as display code beside the components.

### `src/services/` for code at the edge

- **"New src/services/"** was the owner's answer ([decisions](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375)), for `exchangeRates.ts`, which fetches and caches rates from a service and is neither a business rule nor a helper. The option the owner chose was described there as: `exchangeRates.ts` moves to `src/services/`, which may import `domain/` and `utils/`, but nothing UI or sync.
- **Not taken:** putting it in `src/store/`, or leaving it in `src/utils/`.

### Hooks per concern

- **"Hooks per concern":** the owner's answer on [#93](https://github.com/DetweilerRyan/split/issues/93) for splitting `RoomView`: `useIdentity`, `useSeedImport`, `useSharing`, `useExchangeRate`, `useToast` and so on, each a function of its inputs, with `RoomView` composing them and rendering.
- **Where they live** is the next decision's: beside `RoomView`, not in `src/hooks/`, where they first went as the reversible default, since #93 didn't name a folder.
- **Inputs are arguments** so that each hook is tested with fakes, as [unit testing](testing/unit-testing.md#replacing-external-dependencies) prefer, and so the owner's "each hook and component" are tested on their own.
- **Only outside effects and browser state are arguments.** A pure domain function, such as `createRoomId` or `localeCurrency`, runs the same in a test, so a hook calls it directly. A browser global, such as `sessionStorage` or `location`, defaults to the real one, so callers needn't pass it. Found in review of #93's pull request.
- **Not taken:** components that own their dialog's state, the other option #93 offered.

### Code one route or module uses lives beside it

- **The owner, on [#108](https://github.com/DetweilerRyan/split/pull/108#issuecomment-7138995165),** 2026-11-24: "the new hooks are pretty bespoke to RoomView so i don't like putting them in such a generalized locaion as src/hooks. the folder implies reuse yet these new hooks are not likely to be reused. i'd rather defined them colocated with RoomView until and unless they become more widely used. let's avoid hasty abstractions by isolating and encapsolating early/immature decomposed logic/behaviour locally."
- **In `app/`, beside the route:** "i'd even consider moving RoomView into app/. i'd like to minimize the number of top level code in src/", and then "fully colocated", choosing `app/r/[room]/_room-view/` over `app/r/_room-view/`, which avoids brackets in the path.
  - **Why it fits Next.js:** in the App Router only files with special names, such as `page` or `layout`, become routes, and a folder whose name starts with `_` is private, kept out of routing.
  - **One folder per module,** not loose files beside `page.tsx`, so the route's own files stay apart from the module's parts, and no file name can make one a route.
  - **The brackets' cost:** `[room]` is a glob character class, so a tool given the literal path as a glob needs it escaped. The `**` patterns the configs use are unaffected. `scripts/oxcrap/functions.real.test.ts` checks that oxCrap finds a file under it.
- **The split:** #108 moved only `RoomView` and the six files it added. The rest moved on [#112](https://github.com/DetweilerRyan/split/issues/112), after #109, so the open pull requests weren't restacked twice.
- **The rest of the room UI, on #112,** with the owner's choices ([recorded](https://github.com/DetweilerRyan/split/issues/112#issuecomment-7140124297)):
  - **"Folder per component with parts":** `_header/` and `_item-list/` inside `_room-view/`, the rest flat. Chosen over a flat folder, with parts beside their component, and over a folder for every component.
  - **`ModalDialog` and `Toast` moved too,** since every module that uses them is in `_room-view/`: "move them too but use .gitkeep to keep the componsts and hooks folders around". `src/hooks/` holds only its `.gitkeep`.
  - **`RoomEntry` went to `src/components/`,** because `/` and `/ingest` both use it. Chosen over `app/_room-entry/`, a private folder at `app/`'s root.
  - **`IngestEntry` went to `app/ingest/_ingest-entry/`,** and `index.css` beside `app/layout.tsx`, which imports it, as Next puts global CSS.
- **Display code beside its UI** was already a rule, from #94. This one generalises it, so it folds in.
- **The `@/` alias from `app/` into `src/`** was a reversible default, chosen without the owner's input on #108: the relative path from `app/r/[room]/_room-view/` is four folders up. tsconfig, Vitest and rev-dep already resolved it. Within a folder, imports stay relative, as everywhere else.
- **Not enforced:** nothing stops code outside a private folder importing its parts. rev-dep's rules limit what a folder imports, not who imports from it, and an oxlint pattern would be string matching, which [dependency direction](dependency-direction.meta.md) turned down. Review holds it until there's a second such folder. The owner kept it so on [#118](https://github.com/DetweilerRyan/split/issues/118), which checks only the other direction, [below](#shared-folders-are-checked).

### Shared folders are checked

[`scripts/check-shared-folders.ts`](../../scripts/check-shared-folders.ts), in `npm run lint`, fails a module in `src/components/` or `src/hooks/` that isn't imported from two or more folders. Before it, only review stopped a module one route uses from going there. Asked for on [#118](https://github.com/DetweilerRyan/split/issues/118), with the owner's choices [recorded there](https://github.com/DetweilerRyan/split/issues/118#issuecomment-7146409983):

- **A second user is "Another folder":** two importers in one folder count as one user. The other option was any second module, which would let a route's own two components share code through `src/components/`.
- **Imports into a private `_` folder from outside it stay left to review,** as on #112, so the check doesn't look at them.
- **Tests aren't users,** so a test importing a module doesn't keep it in a shared folder. A test is a file whose name holds `.test.`, as [testing conventions](testing/testing-conventions.md#which-project-a-test-belongs-in) name them. Nothing under `e2e/` imports from the two folders, so its files aren't counted as tests; one that did would count as a user.

Choices #118 didn't settle:

- **Each file below the two folders is checked,** in any subfolder, except `.gitkeep`, tests, and the parts in a private `_` folder there. A component with private parts gets such a folder, by the rule in code layout, and its parts have one user by design. Not taken: checking only the files directly in the two folders, which a plain subfolder would get around.
- **The folder is the importer's own folder,** not its route, so `app/RoomApp.tsx` (`app/`) and `app/ingest/_ingest-entry/IngestEntry.tsx` are two, as #118 expected for `RoomEntry`.
- **rev-dep finds the importers,** one `rev-dep imported-by --file` per module, so imports resolve as [dependency direction](dependency-direction.md)'s rules do: through `@/`, relative paths, type-only imports, re-exports and dynamic `import()`. Reading rev-dep's whole graph instead would be one call, but with one module today each call takes about a tenth of a second. A rev-dep error fails the check with its output, rather than passing a module it couldn't look at.
- **No sidecar of its own:** the script's reasons are this rule's, so they live here.
- **Its tests:** [`check-shared-folders.test.ts`](../../scripts/check-shared-folders.test.ts) covers which files are checked and what counts as a user, and [`check-shared-folders.real.test.ts`](../../scripts/check-shared-folders.real.test.ts) runs the script with the real rev-dep on throwaway projects. Each failing case was checked to fail with its rule broken: counting one folder as enough, and counting tests.

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

## Generic schemas in `src/utils/schemas/`

- **Decided by the owner** in review of [#152](https://github.com/DetweilerRyan/split/pull/152), in the session on 2026-11-25, [recorded there](https://github.com/DetweilerRyan/split/pull/152#issuecomment-7173455716): "let's move all utilty schemas into utils/schemas folder (i think it's just numberOrZero for now)".
- **What moved:** `numberOrZero.ts` and its tests, from `src/utils/` to `src/utils/schemas/`. It was the one generic zod schema in `src/utils/` when #152 made it one.
- **Indexed in READMEs, not listed here,** as the owner asked in [a review comment](https://github.com/DetweilerRyan/split/pull/152#discussion_r4700477089): "do away with the precedent here of listing out each of the things contained in src/utils or else the list will become too long. instead: add a src/utils/README.md to index the utilities. also add src/utils/schema/README.md". The owner wrote `schema/`; the folder is `schemas/`, as the owner named it in the first request. `src/utils/README.md` and `src/utils/schemas/README.md` each list their folder's files, and code layout's table points to the first.
- **What didn't:** `storedTextSchema` stays in `src/sync/storedText.ts`. Its body is generic, a non-empty string or a fallback, but it's named and documented for values a peer stored in the room's Yjs document, which is the sync layer's. Move it if another layer needs it.
