---
name: receipt-generation
description: Extract a user-provided restaurant receipt or bill photo into SplitSmart seed data and generate a shareable receipt-room link. Use whenever the user uploads a receipt image, asks to parse or itemize a bill, or asks to generate a SplitSmart link.
---

# Receipt generation

Use this skill when a user provides a receipt and wants to split it with SplitSmart.

## Extract the receipt

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

## Generate the room link

Use the GitHub Pages app URL `https://detweilerryan.github.io/split/`. Generate both a fresh UUID v4 room ID and a link containing the seed; do not direct the user to an import workflow.

The app expects the room ID `urn:split:room:<uuid>` encoded as unpadded base64url, and the seed JSON compressed with `LZString.compressToEncodedURIComponent`. Use the same `lz-string` implementation and URI-safe encoding as the app. Preferred: run the bundled zero-dependency helper, which validates the seed, generates the link, and self-verifies it (no `npm install` needed):

```sh
node skills/receipt-generation/scripts/generate-link.mjs '<seed json>'   # or pipe the JSON on stdin
```

Equivalent Node.js with `lz-string` available:

```js
import { randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import LZString from 'lz-string';

const roomId = `urn:split:room:${randomUUID()}`;
const room = Buffer.from(roomId, 'utf8').toString('base64url');
const seedParam = LZString.compressToEncodedURIComponent(JSON.stringify(seed));
const url = new URL('https://detweilerryan.github.io/split/');
url.hash = new URLSearchParams({ room, seed: seedParam }).toString();
console.log(url.href);
```

Verify that the generated room ID is a UUID v4 and that decompressing `seedParam` returns the exact JSON seed before sharing the URL. If you cannot perform the required encoding and compression reliably, ask for a suitable tool rather than returning a guessed or malformed link.

Tell the user the link can be opened by anyone who has it; it is not private or encrypted. Share the link, a concise summary of the extracted receipt, and any default values applied.
