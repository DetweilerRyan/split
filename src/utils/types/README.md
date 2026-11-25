# Utility types

Generic type helpers: each knows nothing about receipts, money or rooms, one per file, as [types and schemas](../../../docs/engineering/types-and-schemas.md#where-a-type-lives) says. Each file's doc comment says what it gives.

| Type                                 | Use it for                                                                  |
| :----------------------------------- | :-------------------------------------------------------------------------- |
| [`deepReadonly.ts`](deepReadonly.ts) | A type readonly at every level, such as for values a test's generator gives |

Add a row when you add a type.
