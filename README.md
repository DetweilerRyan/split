# SplitSmart P2P

A collaborative receipt splitter built with React, TypeScript, Vite, and Yjs. Room data is persisted locally with IndexedDB and synchronized between peers with WebRTC by default, with optional Liveblocks-hosted synchronization.

## Optional Liveblocks sync

To use Liveblocks-hosted Yjs synchronization and persistence instead of WebRTC, set `VITE_LIVEBLOCKS_PUBLIC_KEY` to a Liveblocks public API key before building or running the app. No application backend is needed; without this setting, the app keeps using its existing P2P sync.

Public-key mode is client-only and does not authenticate users or restrict access to individual rooms. Anyone with the deployed app can read and modify room data, so use it only for non-sensitive, intentionally public receipts. For private rooms, configure Liveblocks token authentication through a trusted backend.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

The production build is written to `dist/`. GitHub Pages deployment is handled by `.github/workflows/deploy.yml`; the Vite base path is `/split/`.

Receipt seeds can be shared as compressed URL hash parameters. Claims are stored as flat `itemId::participantId` values in Yjs so independently hydrated rooms can merge claims without replacing nested item data.
