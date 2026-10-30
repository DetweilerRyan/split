---
name: receipt-generation
description: Extract a user-provided restaurant receipt or bill photo into SplitSmart seed data and generate a shareable receipt-room link. Use whenever the user uploads a receipt image, asks to parse or itemize a bill, or asks to generate a SplitSmart link.
---

# Receipt Generation

Use this skill when a user provides a receipt and wants to split it with SplitSmart.

## 1. Extract the receipt

Read the receipt and produce a seed object with this shape:

```json
{
  "title": "Restaurant or receipt title",
  "cardTipEur": 0,
  "cashTipEur": 0,
  "bankUsd": 0,
  "roster": [],
  "items": [
    {
      "id": "item-0",
      "name": "Text as printed on receipt (1/2)",
      "en": "English description",
      "eur": 6.0
    }
  ]
}
```

- **Order and IDs:** Keep the receipt's printed item order. Assign sequential IDs (`item-0`, `item-1`, and so on).
- **Unroll multi-quantity items:** If a printed line has a quantity greater than 1 (for example, `2.00 x 6.00 = 12.00`), unroll it into `N` separate `1x` entries named `"ITEM NAME (1/2)"`, `"ITEM NAME (2/2)"`, each with the single-unit price (`6.0`), so participants can claim individual units.
- **Bilingual text:** Preserve the printed item name in `name`. Put an English translation or concise explanation in `en`; for an English receipt, repeat the item name.
- **Numeric amounts and VAT:** Use numeric amounts, not formatted strings. Record item prices and both tip amounts in euros; `bankUsd` is the bank or card charge in US dollars when known. European receipts include VAT and consumption taxes (PDV, IVA, TVA, MwSt) in the item prices; never add VAT, tax breakdown, or subtotal lines as items. Verify that the sum of `items[].eur` equals the printed receipt total (`UKUPNO` / `TOTAL`).
- **Missing metadata vs. uncertain receipt text:**
  - Pause and ask if item text, quantities, or prices are illegible, if the sum of `items[].eur` does not match the printed total, or if the receipt is not in euros (ask for euro amounts or an exchange rate and permission to convert; never silently treat another currency as euros or invent a conversion).
  - Do not pause for missing optional metadata (`cardTipEur`, `cashTipEur`, `bankUsd`, `roster`, `title`). Immediately apply defaults (`0` for tips and `bankUsd`, `[]` for `roster`, the merchant name or `"Receipt"` for `title`), generate the link on the first turn, and list the applied defaults in the response.

## 2. Generate the ingest link

Use the GitHub Pages app URL `https://detweilerryan.github.io/split/`. Do not direct the user to a manual JSON import workflow.

Serialize the seed object as minified JSON (`JSON.stringify(seed)`) and percent-encode it with `encodeURIComponent` inside the `#ingest=` hash parameter:

```text
https://detweilerryan.github.io/split/#ingest=<percent-encoded JSON>
```

Equivalent JavaScript:

```js
const link = `https://detweilerryan.github.io/split/#ingest=${encodeURIComponent(JSON.stringify(seed))}`;
```

The app validates the seed, creates a fresh room, saves it, and replaces the ingest URL with the clean room link. Do not generate a room ID, compress the seed, or use an external script.

Tell the user the link can be opened by anyone who has it; it is not private or encrypted. Share the link, a concise summary of the extracted receipt, and any default values applied.
