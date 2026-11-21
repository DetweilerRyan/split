# Types and schemas

Where TypeScript types and zod schemas are defined, and how ids and the strings built from them are typed.

## Where a type lives

- **Define a type or schema in the module that creates or holds the state it describes,** and export it from there. `RoomSnapshot` lives in `src/store/useReceiptStore.ts`, which builds it. `receiptSeedSchema` and `RoomId` live in `src/store/seedCodec.ts`, which parses and creates them.
- **Don't create a file only to hold types or schemas,** and don't add a shared types folder.
- **A type that many modules use still lives with its state.** Import it with `import type`, so the importer doesn't load the module's runtime code.

## A schema owns its type

- **Derive a schema's type with `z.infer`.** Never write a type by hand that duplicates a zod schema.
- **Export the inferred type from the schema's module,** so callers import the type instead of calling `z.infer` themselves:

  ```ts
  export const roomIdSchema = z.string().refine(isRoomId).brand<'RoomId'>();
  export type RoomId = z.infer<typeof roomIdSchema>;
  ```

## Ids and the strings built from them

- **Give an id that enters the app from a URL, storage or a link a zod brand,** as `RoomId` has. Parse it once where it enters, as `parseRoomId` and `decodeRoomId` do, and pass the branded type from there on. Code past that point takes the branded type, not `string`.
- **Type a string built from a branded id as a template literal,** and build it with one function that returns that type, as `pendingSeedKey` returns `PendingSeedKey`. `SavedIdentityKey`, `IndexedDbName` and `WebrtcRoomName` follow the same pattern. Define it beside the code that reads or writes the key.

## Changing this document

The reasons for these rules and the decisions behind them are in [types-and-schemas.meta.md](types-and-schemas.meta.md). Read it only when changing or questioning a rule here.
