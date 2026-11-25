# Sync: reasons and sources

Why [sync.md](sync.md)'s rules are as they are. Read it only when changing or questioning a rule there.

## The document

- **Its own document,** not a section of [types and schemas](types-and-schemas.md), as the owner asked in review of [#152](https://github.com/DetweilerRyan/split/pull/152), [recorded there](https://github.com/DetweilerRyan/split/pull/152#issuecomment-7173455716): "let's create a new sync.md doc instead of puting the new yjs validation apporach in types-and-schemas". It's about reading a peer-written CRDT document, which has rules of its own, such as never writing a repair back, that aren't about types.

## Reading the document

- **Asked for** by the owner in the session on 2026-11-25: "i'd like us to leverage zod as much as possible for validation, parsing and refinment. spike out using zod 4's .catch()". The spike, [#152](https://github.com/DetweilerRyan/split/pull/152), replaced the hand-written `storedText` and `numberOrZero` with schemas, and the owner adopted it: "adpot it", [recorded there](https://github.com/DetweilerRyan/split/pull/152#issuecomment-7172534333).
- **Cost:** about 5 times the hand-written reads, measured on #152 with 12 people and 200 items. A rebuild went from 0.35 ms to 1.8 ms, and nearly all of it is zod's parse, mostly the `.catch()` path for missing fields, not `toJSON()`. That's far inside a 16 ms frame even on every keystroke, and real receipts are much smaller. Reopen this if a room grows large enough for a rebuild to show.
- **Infinity reads as 0,** since zod 4's `z.number()` refuses it. Before, `numberOrZero` returned it. An infinite amount is no amount.
- **Never writing repairs back, and adding fields rather than renaming them,** come from research in the same session: the [Yjs forum's thread on migrations](https://discuss.yjs.dev/t/what-is-the-correct-way-to-apply-document-migrations/2321) reports repairs and migrations racing between peers under last-writer-wins, with the winner effectively random. [Loro's maintainer](https://github.com/loro-dev/loro/discussions/314) argues that validation belongs in the app layer, since refusing updates can break a CRDT's consistency.
