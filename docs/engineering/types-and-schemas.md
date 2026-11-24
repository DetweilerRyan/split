# Types and schemas

Where TypeScript types and zod schemas are defined, how ids and the strings built from them are typed, how types are kept readonly, and how an indexed read is handled.

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

`npm run lint` checks every type in `app/`, `src/`, `scripts/` and `e2e/`, tests included, with `readonly/types`, a local rule in [`scripts/lint/readonly.ts`](../../scripts/lint/readonly.ts). [`.oxlintrc.json`](../../.oxlintrc.json) loads it under `jsPlugins` and turns it on under `rules`.

- **Write each type readonly, level by level, as the rule requires.** [Its README](../../scripts/lint/readonly.md) lists what it reports and what to write instead, and allows a mutable working value in a variable declared inside a function.
- **Don't change a readonly value in place.** Build a new one with `map`, `filter`, spread or a sorted copy.
- **Give a zod schema that owns a type `.readonly()`** on each object and array, so `z.infer` gives a readonly type. In `src/domain/receipt/receiptSeed.ts`, `immutable` does it for the seed, whose JSON Schema the MCP tool serves.
- **Write a module-level constant built from literals `as const`.** When a library's parameter takes a mutable array, pass it a copy, as in `[...signalingUrls]`.
- **When a type must stay mutable,** such as a library's type, a global cache or a list a recursive walk fills in place, disable the rule on that line with a reason, as [`AGENTS.md`](../../AGENTS.md#definition-of-done) requires:

  ```ts
  // oxlint-disable-next-line readonly/types -- the list callsIn's walk adds to in place.
  type Calls = Call[];
  ```

  Yjs types such as `Y.Map` and `Y.Doc` aren't checked, so they need no disable.

## Indexed reads and `!`

[`tsconfig.json`](../../tsconfig.json) turns on `noUncheckedIndexedAccess`, so `npm run typecheck` types a read by index or key, such as `items[i]` or `record[key]`, as possibly `undefined`. [`.oxlintrc.json`](../../.oxlintrc.json) turns on `typescript/no-non-null-assertion` outside tests.

- **Restructure so the type proves the value is there,** where it always is: iterate instead of indexing, destructure (`const [first] = items;`) and check what you get, or carry the value along with what you'd have indexed by, as `allocate` in `src/domain/receipt/math.ts` pairs each part with its share.
- **Otherwise handle the missing case** where you read it: skip it, return early, or throw an error that says what's missing.
- **Don't silence a read with `!` or a cast,** tests included, though tests may use `!` elsewhere.
- **In a test, read through `?.`** so the assertion fails when the value is missing, or narrow with Vitest's `assert(value, message)` when the value is passed on.
- **Let a table with known keys keep them:** write `satisfies Readonly<Record<string, T>>` instead of the annotation `: Readonly<Record<string, T>>`, as `PRESETS` in `src/data/presets.ts` does, so a read of one of its keys isn't possibly `undefined`.

## Checked, not asserted

`npm run lint` reports a type assertion, `x as T` or `<T>x`, outside tests, with oxlint's `typescript/consistent-type-assertions`. [`.oxlintrc.json`](../../.oxlintrc.json) turns it on, and exempts `*.test.*` files, `e2e/` and oxCrap's feature contract. `as const` is allowed.

- **Parse a value from outside the program with a zod schema,** as _honest types_ says: JSON, storage, a peer's state or a library's `any`. Check only what the code reads, so the parse refuses no more than the code did.
- **Narrow with a type guard,** a function returning `value is T` that checks what `T` claims, or a predicate passed to `every` or `filter`.
- **Write `satisfies T`** where the cast only checked a shape, and **a type annotation**, `const x: T = value`, where `value` is already assignable to `T`.
- **In oxCrap, read an oxc-parser AST field through `complexity.ts`'s parsers,** since oxCrap imports no zod: `parseNode`, `parseNodes`, `parseList` and `parseName` for a field the parser always fills, which throw if it doesn't, and `isNode` and `isNamed` for one it may not.
- **When no check is possible,** such as a library's declared type that's wrong, disable the rule on that line with a reason, as [`AGENTS.md`](../../AGENTS.md#definition-of-done) requires.

## Changing this document

The reasons for these rules and the decisions behind them are in [types-and-schemas.meta.md](types-and-schemas.meta.md). Read it only when changing or questioning a rule here.
