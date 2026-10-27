# SplitSmart P2P

A collaborative receipt splitter built with React, TypeScript, Vite, and Yjs. Room data is persisted locally with IndexedDB and synchronized between peers with WebRTC.

## Development

```sh
npm install
npm run dev
npm test
npm run build
```

The production build is written to `dist/`. GitHub Pages deployment is handled by `.github/workflows/deploy.yml`; the Vite base path is `/split/`.

Receipt seeds can be shared as compressed URL hash parameters. Claims are stored as flat `itemId::participantId` values in Yjs so independently hydrated rooms can merge claims without replacing nested item data.
