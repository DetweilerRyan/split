# Utility schemas

Generic zod schemas: each reads or refines a value without knowing what it's for, one per file, as [code layout](../../../docs/engineering/code-layout.md) says. Each file's doc comment says what it accepts and what it falls back to.

| Schema                               | Use it for                                                           |
| :----------------------------------- | :------------------------------------------------------------------- |
| [`numberOrZero.ts`](numberOrZero.ts) | A number from text or an untrusted value, reading anything else as 0 |

Add a row when you add a schema.
