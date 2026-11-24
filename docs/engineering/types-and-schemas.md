# Types and schemas

Where TypeScript types and zod schemas are defined, how ids and the strings built from them are typed, and how types are kept readonly.

## Where a type lives

- **Define a domain type or schema in `src/domain/<subject>/`,** beside the rules about it, and export it from there. A domain type is the receipt's shape, or a value a business rule decides, such as which strings are room ids. The code that builds or holds its state, such as the sync layer in `src/sync/`, imports it. `RoomSnapshot` lives in `src/domain/receipt/roomSnapshot.ts`, and `src/sync/useReceiptStore.ts` builds it. `receiptSeedSchema` lives in `src/domain/receipt/receiptSeed.ts`, and `RoomId` in `src/domain/room/roomId.ts`.
- **Define any other type or schema in the module that creates or holds the state it describes,** and export it from there, as `src/sync/yjsProvider.ts` does `RoomProvider`.
- **Don't create a file only to hold types or schemas,** and don't add a shared types folder. A domain module holds its types with the rules about them, as `roomId.ts` holds `RoomId` with its parsing and creation.
- **A type that many modules use still has the one home above.** Import it with `import type`, so the importer doesn't load the module's runtime code.

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

## Readonly by default

`npm run lint` checks these rules with `readonly/types`, a local rule in [`scripts/lint/readonly.ts`](../../scripts/lint/readonly.ts). [`.oxlintrc.json`](../../.oxlintrc.json) loads it under `jsPlugins` and turns it on under `rules`. They apply to every type in `app/`, `src/`, `scripts/` and `e2e/`, tests included, wherever it's written: an alias, an interface, a parameter, a return type, a type argument, a cast or a module-level variable.

- **Write each type readonly:**
  - `readonly T[]` and `readonly [A, B]`, not `T[]` and `[A, B]`;
  - `ReadonlyArray<T>`, `ReadonlyMap<K, V>` and `ReadonlySet<T>`, not `Array`, `Map` and `Set`;
  - `Readonly<Record<K, V>>`, not `Record<K, V>`;
  - `readonly` on each property, index signature and mapped type, or the object type wrapped in `Readonly<…>`.
- **Make each level readonly on its own.** `Readonly<…>` reaches only the top level of its argument, through a union or an intersection: in `Readonly<{ a: { b: string } }>`, `b` still needs `readonly`, and a `Map` or `Set` inside is still mutable.
- **A variable declared inside a function may have a mutable type,** as a working value: `const out: string[] = []`, then `out.push(…)`. Return it as a readonly type. A type alias, a type argument or a cast inside a function is still checked.
- **Don't change a readonly value in place.** Build a new one with `map`, `filter`, spread or a sorted copy.
- **Give a zod schema that owns a type `.readonly()`** on each object and array, so `z.infer` gives a readonly type. In `src/domain/receipt/receiptSeed.ts`, `immutable` does it for the seed, whose JSON Schema the MCP tool serves.
- **Write a module-level constant built from literals `as const`.** When a library's parameter takes a mutable array, pass it a copy, as in `[...signalingUrls]`.
- **When a type must stay mutable,** such as a library's type, a global cache or a list a recursive walk fills in place, disable the rule on that line with a reason, as [`AGENTS.md`](../../AGENTS.md#definition-of-done) requires:

  ```ts
  // oxlint-disable-next-line readonly/types -- the list callsIn's walk adds to in place.
  type Calls = Call[];
  ```

  Yjs types such as `Y.Map` and `Y.Doc` aren't checked, so they need no disable.

## Changing this document

The reasons for these rules and the decisions behind them are in [types-and-schemas.meta.md](types-and-schemas.meta.md). Read it only when changing or questioning a rule here.
