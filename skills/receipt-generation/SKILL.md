---
name: receipt-generation
description: Extract a user-provided restaurant receipt into SplitSmart seed data and generate a shareable receipt-room link.
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
  "roster": ["Person 1", "Person 2"],
  "items": [
    {
      "id": "item-0",
      "name": "Text as printed on receipt",
      "en": "English description",
      "eur": 12.5
    }
  ]
}
```

- Keep the receipt’s item order. Give each item a unique ID such as `item-0`, `item-1`, and so on.
- Preserve the printed item name in `name`. Put an English translation or concise explanation in `en`; for an English receipt, repeat the item name.
- Use numeric amounts, not formatted strings. Record item prices and both tip amounts in euros; `bankUsd` is the bank/card charge in US dollars when known.
- Do not guess illegible text, amounts, participants, tips, or bank charges. Ask the user to confirm uncertain or missing details before generating the link.
- If details are missing, suggest these defaults and use them only if the user agrees: `0` for missing tips or bank charge, `[]` for an unknown roster, and `"Receipt"` for an unknown title.
- If the receipt is not in euros, warn the user and ask for the euro amounts or an exchange rate and permission to convert. Do not silently treat another currency as euros or invent a conversion.

## Generate the room link

Use the GitHub Pages app URL `https://detweilerryan.github.io/split/`. Generate both a fresh UUID v4 room ID and a link containing the seed; do not direct the user to an import workflow.

The app expects the room ID `urn:split:room:<uuid>` encoded as unpadded base64url, and the seed JSON compressed with `LZString.compressToEncodedURIComponent`. Use the same `lz-string` implementation and URI-safe encoding as the app. For example, in Node.js with `lz-string` available:

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

Tell the user the link can be opened by anyone who has it; it is not private or encrypted. Share the link and a concise summary of the extracted receipt, and clearly call out any assumptions the user approved.
