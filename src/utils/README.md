# Utilities

Generic helpers with no business rules: each knows nothing about receipts, money or rooms, as [code layout](../../docs/engineering/code-layout.md) says. Each file's doc comment says what it does.

| Utility                         | Use it for                                                  |
| :------------------------------ | :---------------------------------------------------------- |
| [`qr.ts`](qr.ts)                | Drawing a QR code as an SVG path, such as for a room's link |
| [`types/`](types/README.md)     | Generic type helpers, indexed in their own README           |
| [`schemas/`](schemas/README.md) | Generic zod schemas, indexed in their own README            |

Add a row when you add a utility.
