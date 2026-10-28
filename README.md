# SplitSmart P2P

A collaborative receipt splitter built with React, TypeScript, Vite, and Yjs. Room data is persisted locally with IndexedDB and synchronized between peers with WebRTC by default, with optional Liveblocks-hosted synchronization.

## Optional Liveblocks sync

To use Liveblocks-hosted Yjs synchronization and persistence instead of WebRTC, set `VITE_LIVEBLOCKS_PUBLIC_KEY` to a Liveblocks public API key before building or running the app. No application backend is needed; without this setting, the app keeps using its existing P2P sync.

Public-key mode is client-only and does not authenticate users or restrict access to individual rooms. New room links use a random UUID encoded in the URL to make rooms difficult to discover, but this is obfuscation—not authorization or encryption. Anyone who obtains a room link can access its data. Use it only for non-sensitive receipts; private rooms require Liveblocks token authentication through a trusted backend.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

The production build is written to `dist/`. GitHub Pages deployment is handled by `.github/workflows/deploy.yml`; the Vite base path is `/split/`.

Room IDs use the `urn:split:room:<uuid>` format and are base64url-encoded in the URL; existing links with legacy room IDs remain supported. Receipt seeds can be shared as compressed URL hash parameters. Claims are stored as flat `itemId::participantId` values in Yjs so independently hydrated rooms can merge claims without replacing nested item data.
