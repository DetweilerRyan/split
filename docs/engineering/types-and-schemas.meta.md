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

## Readonly by default

- **Asked for** on [#69](https://github.com/DetweilerRyan/split/issues/69): make immutability the default, sweep the code to it, and lint new code. Readonly types let TypeScript catch an accidental change to shared state, such as a snapshot's `items` or a prop's array, and tell a reader which values a function may change without reading its body.
- **Decided by the owner** in the session on 2026-11-24, [recorded on #69](https://github.com/DetweilerRyan/split/issues/69#issuecomment-7122175408): "Yes, all recommendations", which settled the issue's seven questions:
  1. types only (`readonly`, `Readonly<>`), plus `as const` on literal constants;
  2. readonly checked level by level, not deeply;
  3. local working arrays allowed inside a function;
  4. exemptions, such as Yjs and library types, as per-line disables with a reason;
  5. zod schemas get `.readonly()`, so `z.infer` is readonly;
  6. all of `app/`, `src/`, `scripts/` and `e2e/`, tests included;
  7. one pull request that sweeps the code and turns the rule on.

  The same comment: "It's a local oxlint JS plugin rule, the same mechanism as #83's, with no new dependency. `oxlint-tsgolint` isn't approved."

- **Not taken:**
  - **`oxlint-tsgolint`'s type-aware `prefer-readonly-parameter-types` and `prefer-readonly`,** which check a parameter deeply, through imported types. Not approved; it's a new package, and `--type-aware` turns on other rules too. The issue's trial found 134 findings with `ignoreInferredTypes` and `treatMethodsAsReadonly`.
  - **`eslint-plugin-functional`'s `type-declaration-immutability`,** through `jsPlugins`. It doesn't load under TypeScript 7, whose JS compiler API `ts-api-utils` reads.
  - **TypeScript and review only,** which leaves readonly to whoever remembers it.
  - **Runtime freezing** with `Object.freeze`, beyond `as const` and what zod's `.readonly()` does.
  - **Building working arrays with `map`, `filter` and `toSorted` only,** with no exemption for a local variable.
  - **A config-level exemption,** such as an `ignorePatterns` list, and **a rollout one directory at a time.**
- **What the rule checks is syntax.** It sees the types written in a file, not what an imported type holds, so a type from another module or a library is as readonly as its own declaration. That's the level-by-level check the owner chose; the deep check needs `oxlint-tsgolint`.
- **Decided while writing the rule,** under the owner's "pick the reversible default" for choices left open on #69. Each is a line or two in `scripts/lint/readonly.ts` to change.
  - **A mapped type needs `readonly` or `+readonly`, or `Readonly<…>` around it,** like an index signature, and `-readonly` is reported, so a type that strips readonly says why in its disable.
  - **`Readonly<…>` counts through a union or an intersection,** as TypeScript applies it, **but not through another generic,** such as `Readonly<Promise<{ a: string }>>`, and it never makes a `Map` or `Set` readonly, which TypeScript doesn't either.
  - **The local-variable exemption covers the whole annotation** of a `const`, `let` or `var` declared inside a function, nested types included. A type alias, a type argument, a cast, or a local arrow's parameters and return type there are still checked, since they aren't a variable's working value.
  - **Not reported:** method signatures, which can't be `readonly`; `WeakMap` and `WeakSet`, which have no readonly form; and qualified names such as `ns.Map`, which may be another type.
  - **A class field's own `readonly` modifier isn't required;** only the type written on the field is checked. [#83](https://github.com/DetweilerRyan/split/issues/83) bans classes other than Error subclasses, so few fields are left to need it.
  - **A module-level value whose mutable type is inferred isn't seen,** such as `const hits = new Map<string, readonly number[]>()` in `src/server/rateLimit.ts`. The rule reads only the types written out; an inferred type needs the type-aware checks it doesn't have.
- **zod's `.readonly()` also freezes the value it parses,** and JSON Schema marks a readonly schema `readOnly`. In the seed schema's JSON Schema, which the MCP tool `create_receipt_room` serves as its input, `readOnly` would tell a client the field is the server's and not to send it. So `immutable` in `src/domain/receipt/receiptSeed.ts` clears it with `.meta({ readOnly: undefined })`, and the schema the tool serves is unchanged; `receiptSeed.test.ts` checks both.
- **In-place `.sort` on a local working array stays.** The issue expected `participants.sort(...)` and `items.sort(...)` in the store to become `.toSorted`, but each sorts a local array the function has just built, which decision 3 allows. `toSorted` would also be the app's first ES2023 array method, which older browsers, such as Safari before 16, don't have.
- **The sweep, on [#69](https://github.com/DetweilerRyan/split/issues/69):** 487 findings when the rule was turned on. The mutable types that remain are each disabled on their line, with a reason: oxCrap's walks, which fill one list or set in place so deeply nested code keeps one stack frame per level, and a function's complexity, which `countRecursion` adds to through `parents`; oxCrap's cache of imported modules; and the provider cache and Liveblocks client on `globalThis`, which `src/sync/yjsProvider.ts` sets and its test deletes.
- **JS plugins are alpha in oxlint 1.91** and not covered by semver, so an oxlint update can change the plugin API. `scripts/lint/readonly.real.test.ts` runs the real oxlint with the repository's config, so a break shows there.

## The document's scope

- **Not taken:** a broader `code-conventions.md`, considered on #43. Its "Read when" would match almost every task, and it would collect unrelated rules.
