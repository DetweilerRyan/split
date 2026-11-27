# Sync

How the app reads and changes the room's shared Yjs document, in `src/sync/`. The document's layout is in `src/sync/useReceiptStore.ts`, which reads and writes it.

## Reading the document

Any peer in a room can write any value into its Yjs document, so the document is read like any other input from outside the program.

- **Read each Yjs map through a zod schema whose fields `.catch()`,** with `schema.parse(map.toJSON())`. Each schema is `.readonly()`, as [types and schemas](types-and-schemas.md#readonly-by-default) asks. Every field has its fallback, so the parse never fails: a missing or malformed value reads as its fallback. Use `storedTextSchema(fallback)` and `numberOrZeroSchema` for text and numbers.
- **Give a key whose schema is `z.unknown()` `.optional()`,** before any `.transform()`. zod 4 otherwise makes the key required, and a map without it fails the whole parse.
- **Parse an id on its own,** apart from the map's schema. Its fallback is the map's key, and a malformed one is left out with a warning, as #124 decided.
- **Never write a repaired value back** into the document. A repair written back races the other peers under last-writer-wins, and can erase what they wrote. Repair it in the snapshot only.
- **Change the document's shape by adding fields,** never by renaming or removing one. Peers on older versions, and copies kept in IndexedDB, still read and write the old keys.

## Changing this document

The reasons for these rules and the decisions behind them are in [sync.meta.md](sync.meta.md). Read it only when changing or questioning a rule here.
