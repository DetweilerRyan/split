# SplitSmart P2P

A collaborative receipt splitter built with Next.js, React, TypeScript, and Yjs. Room data is persisted locally with IndexedDB and synchronized between peers with WebRTC by default, with optional Liveblocks-hosted synchronization.

## Optional Liveblocks sync

To use Liveblocks-hosted Yjs synchronization and persistence instead of WebRTC, set `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` to a Liveblocks public API key before building or running the app. No application backend is needed; without this setting, the app keeps using its existing P2P sync.

Public-key mode is client-only and does not authenticate users or restrict access to individual rooms. New room links use a random UUID encoded in the URL to make rooms difficult to discover, but this is obfuscation—not authorization or encryption. Anyone who obtains a room link can access its data. Use it only for non-sensitive receipts; private rooms require Liveblocks token authentication through a trusted backend.

## Development

```sh
npm install
npm run dev
npm test
npm run test:tooling
npm run build
```

Run locally with `npm run dev`, build with `npm run build`, and serve the production build with `npm start`. The app's tests run with `npm test`, the tests of the repository's own tools in `scripts/` with `npm run test:tooling`, the end-to-end tests with `npm run test:e2e` (it builds the app first), and `npm run typecheck` checks types. Component and hook tests run in headless Chromium, so install it once with `npx playwright install --only-shell chromium`; on Linux, `sudo npx playwright install-deps chromium` adds the system libraries it needs. The Docker Sandbox kit and the dev container do both for you. Agents working on the repository follow [`AGENTS.md`](AGENTS.md).

### Docker Sandbox

For isolated agent development, see the [SplitSmart sandbox kit](.sbx-kits/splitsmart/README.md). It provisions Node.js and installs the dependencies pinned in `package-lock.json` (via `npm ci`) in a clone-mode sandbox, and describes the optional VS Code dev container. The ordinary local workflow above remains supported.

Vercel auto-detects Next.js; use its default build command and output with no `vercel.json` or SPA rewrites. The app uses Next.js's default server/hybrid deployment, and its pages are statically prerendered and `/api/mcp` is served on demand. Configure `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` in the Vercel Preview and Production environments only if using Liveblocks; it is client-exposed. WebRTC signaling uses the public signaling servers unless `NEXT_PUBLIC_WEBRTC_SIGNALING_URLS` lists others, comma-separated, before building; leave it unset on Vercel. The end-to-end tests set it to a local server. Room and ingest URL fragments and query parameters are handled client-side; ingest links live at `/ingest` (old root-level ingest links are forwarded there).

## MCP server

`/api/mcp` is an unauthenticated remote MCP server (Streamable HTTP). The `create_receipt_room` tool validates a receipt seed with the shared zod schema in `src/domain/receipt/receiptSeed.ts` (its field descriptions are the extraction rules agents see) and returns an `/ingest` link; the room is created when the link is opened. `skill://receipt-generation/SKILL.md` serves the skill file. POST bodies are capped at 64 KB (413), and `tools/call` is limited to 30/min per client IP (IPv6 by /64) with a JSON-RPC 429 and `Retry-After`. The in-app limiter is per-instance and best effort; use a Vercel Firewall rate-limit rule on `/api/mcp` as the global per-IP limit. Try it with `npx @modelcontextprotocol/inspector` against `http://localhost:3000/api/mcp`.

Room IDs use the `urn:split:room:<uuid>` format and are base64url-encoded in the URL path (`/r/<room>`); links to rooms created before that format still work when their id has the form the app generated then, `split-` and one to four base36 characters. Any other room id is rejected: a room path redirects home, and a `#room=` link opens a new room. Room ids are typed as `RoomId`, defined in `src/domain/room/roomId.ts` with the functions that create and parse them; only parsing produces one. Receipt seeds can be shared as compressed URL hash parameters. Claims are stored as flat `itemId::participantId` values in Yjs so independently hydrated rooms can merge claims without replacing nested item data.

## Currencies

Each receipt room stores an ISO 4217 `currency` (default `USD`, so legacy rooms and links without one open as USD). It is synced through Yjs and included in receipt seeds. Amounts are formatted with `Intl.NumberFormat`, and splitting is done in integer minor units using the currency's exponent (`JPY` 0, `USD` 2, `KWD` 3), with remainders distributed deterministically so shares add up exactly. New blank rooms default to the locale's currency.

Optionally choose a display currency in the edit drawer to see each share converted. Rates come from [Frankfurter](https://frankfurter.dev) (ECB data, no API key) fetched client-side and cached in IndexedDB; the rate and its date are stored on the receipt so all peers see identical values. Offline, with no cached or stored rate, amounts show in the receipt currency only. The rate can also be edited manually.
