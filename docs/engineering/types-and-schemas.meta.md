# Types and schemas: reasons and decisions

Why the rules in [types and schemas](types-and-schemas.md) are as they are, and what was rejected. Read this only when changing or questioning one of them. Following the rules needs nothing from this file.

## Where a type lives

- **Decided by the owner** in review on [#42](https://github.com/DetweilerRyan/split/pull/42#discussion_r4649801912): "i'm not a big fan of making files just to hold types and/or their zod schemas. I prefer to leave types defined where their state is defined."
- **Reason:** a type beside the code that makes the value is read and changed together with it. A separate types file splits one change across two places.
- **Applied:** #42 moved `RoomId` from `src/types/roomId.ts` into `src/store/seedCodec.ts`. [#43](https://github.com/DetweilerRyan/split/issues/43) moved `src/types/receipt.ts` into `src/store/useReceiptStore.ts` and `src/types/seedSchema.ts` into `src/store/seedCodec.ts`, and deleted `src/types/`.
- **Not taken:** a shared `src/types/` folder, the layout the repository had before #42.
- **Amended on [#94](https://github.com/DetweilerRyan/split/issues/94): domain types live in `src/domain/`,** and the sync layer that builds their state imports them. The issue's body, which the owner keeps, says: "Amend it to say domain types live in `src/domain/`, and the store builds them." It followed the owner's question in the session on 2026-11-24, [recorded on #94](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7121899237): "maybe store/ needs to be moved into domain??". `store/` mixed the receipt's rules with React, Yjs, the providers and browser storage, so it was split rather than moved, and the owner chose "Rename to src/sync/" for what remained, [recorded on #94](https://github.com/DetweilerRyan/split/issues/94#issuecomment-7122174375).
  - **Reason:** a type that states a business rule is read with that rule, not with the Yjs code that fills it in. In the store, a domain module such as `src/domain/receipt/math.ts` had to import its input type from the sync layer.
  - **Why types still don't get files of their own:** the reason from #42 holds. A type is read and changed with the code beside it, and the amendment only changes which code that is for a domain type: its rules, not the store that builds it. A types-only file in `src/domain/` would split one change across two places, as `src/types/` did.
  - **`RoomSnapshot` moved whole,** its `connection` and `peers` fields included, though they describe the sync layer's state. The issue's table put the type in `src/domain/receipt/`, and splitting it would change every component that takes a snapshot. Reopen it if the sync fields grow.
- **The seed schema's home was provisional, and #94 reopened it.** The owner chose `seedCodec.ts` "for now" in the session on 2026-11-21, [recorded on #43](https://github.com/DetweilerRyan/split/issues/43#issuecomment-7056479709); the alternative was a `src/store/receiptSeed.ts` holding the schema and `validateSeed`. On #94 the schema and `validateSeed` moved to `src/domain/receipt/receiptSeed.ts`, and `RoomId` with its parsing and creation to `src/domain/room/roomId.ts`. Compression, room URLs and hashes, and `hydrateFromSeed`, which writes into a Yjs doc, stayed in `src/sync/seedCodec.ts`.

## A schema owns its type

- **Decided by the owner** in the session on 2026-11-21, [recorded on #43](https://github.com/DetweilerRyan/split/issues/43#issuecomment-7056462985): "always use z.infer never duplicate a handwirtten type with it's zod schema. it is recommened that the inferred type be exported by the module so that callers don't have to use z.infer."
- **Reason:** a hand-written copy of a schema's type can drift from the schema, and the compiler won't notice when it does.
- **The export is recommended, not required,** in the owner's words.

## Ids and the strings built from them

- **Branded ids:** asked for by the owner on [#37](https://github.com/DetweilerRyan/split/pull/37#discussion_r4649349619) ("can we use a branded type or a string template type via zod to better type the key?"), filed as [#40](https://github.com/DetweilerRyan/split/issues/40) and done in #42. A brand stops a plain string, or a key built from an id, from being passed where an id is expected.
- **Which ids parse:** the owner chose, on [#40](https://github.com/DetweilerRyan/split/issues/40#issuecomment-7055361953), to accept only the forms the app has generated and to reject any other string. The patterns and that decision are documented in `src/domain/room/roomId.ts`.
- **Template literal keys:** from the same #37 question. A brand guards the id; a template literal type guards each key's shape, so `localStorage` and IndexedDB names can't be built from an unbranded string or with the wrong prefix. `src/sync/seedCodec.test.ts` pins this with `@ts-expect-error` checks.
- **Not taken:** `z.templateLiteral` schemas for the keys. The keys are built by the app, never parsed from input, so a type is enough.

## The document's scope

- **Not taken:** a broader `code-conventions.md`, considered on #43. Its "Read when" would match almost every task, and it would collect unrelated rules.
