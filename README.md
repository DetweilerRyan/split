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
npm run build
```

Run locally with `npm run dev`, build with `npm run build`, and serve the production build with `npm start`. The tests run with `npm test`.

Vercel auto-detects Next.js; use its default build command and output with no `vercel.json` or SPA rewrites. The app uses Next.js's default server/hybrid deployment, and its single route is statically prerendered. Configure `NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY` in the Vercel Preview and Production environments only if using Liveblocks; it is client-exposed. WebRTC signaling uses the existing public signaling servers and needs no environment variable. Room and ingest URL fragments and query parameters are handled client-side.

Room IDs use the `urn:split:room:<uuid>` format and are base64url-encoded in the URL; existing links with legacy room IDs remain supported. Receipt seeds can be shared as compressed URL hash parameters. Claims are stored as flat `itemId::participantId` values in Yjs so independently hydrated rooms can merge claims without replacing nested item data.
