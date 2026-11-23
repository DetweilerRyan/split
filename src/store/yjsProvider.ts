import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';
import { type ReceiptSeed, type RoomId, hydrateFromSeed } from './seedCodec';
import { type RoomSnapshot, ReceiptStore } from './useReceiptStore';

export interface RoomProvider {
  doc: Y.Doc;
  store: ReceiptStore;
  setIdentity: (identity: { id: string; name: string; colorIdx: number } | null) => void;
}

/** The IndexedDB database a room's document is persisted in. */
export type IndexedDbName = `splitsmart-p2p-${RoomId}`;
/** The WebRTC room peers join to sync a room's document. */
export type WebrtcRoomName = `splitsmart-p2p-room-${RoomId}`;

export function indexedDbName(roomId: RoomId): IndexedDbName {
  return `splitsmart-p2p-${roomId}` as const;
}

export function webrtcRoomName(roomId: RoomId): WebrtcRoomName {
  return `splitsmart-p2p-room-${roomId}` as const;
}

type ProviderRegistry = typeof globalThis & {
  __splitRoomProviders?: Map<RoomId, Promise<RoomProvider>>;
  __splitLiveblocksClient?: ReturnType<typeof createClient>;
};

const providerRegistry = globalThis as ProviderRegistry;
const providers =
  providerRegistry.__splitRoomProviders ??
  (providerRegistry.__splitRoomProviders = new Map<RoomId, Promise<RoomProvider>>());
const liveblocksApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim();
const publicSignalingUrls = ['wss://signaling.yjs.dev', 'wss://y-webrtc-eu.fly.dev'];
const configuredSignalingUrls = (process.env.NEXT_PUBLIC_WEBRTC_SIGNALING_URLS ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const signalingUrls = configuredSignalingUrls.length
  ? configuredSignalingUrls
  : publicSignalingUrls;
const participantColors = [
  '#4f46e5',
  '#059669',
  '#d97706',
  '#e11d48',
  '#7c3aed',
  '#0891b2',
  '#c026d3',
];

// @crap-allow CRAP 24, complexity 24. Debt from before the CRAP check (#63): too complex.
async function createProvider(roomId: RoomId, seed?: ReceiptSeed | null): Promise<RoomProvider> {
  const liveblocksRoom = liveblocksApiKey
    ? (providerRegistry.__splitLiveblocksClient ??= createClient({
        publicApiKey: liveblocksApiKey,
      })).enterRoom(roomId, {
        autoConnect: false,
        initialPresence: { user: null },
      }).room
    : null;
  const liveblocks = liveblocksRoom ? getYjsProviderForRoom(liveblocksRoom) : null;
  const doc = liveblocks?.getYDoc() ?? new Y.Doc();
  const persistence = new IndexeddbPersistence(indexedDbName(roomId), doc);
  await persistence.whenSynced;

  const items = doc.getMap('items');
  if (seed && items.size === 0) {
    hydrateFromSeed(doc, seed);
  }

  const store = new ReceiptStore(doc);
  const connectionProvider = liveblocksRoom ? 'Liveblocks' : 'WebRTC';
  const updateLiveblocksStatus = (status: string) => {
    store.setConnection({
      provider: 'Liveblocks',
      status:
        status === 'connected'
          ? 'connected'
          : status === 'reconnecting'
            ? 'reconnecting'
            : status === 'disconnected'
              ? 'disconnected'
              : 'connecting',
    });
  };
  if (liveblocksRoom) {
    updateLiveblocksStatus(liveblocksRoom.getStatus());
    liveblocksRoom.subscribe('status', updateLiveblocksStatus);
  } else {
    store.setConnection({ provider: connectionProvider, status: 'connecting' });
  }
  const webrtc = liveblocks
    ? null
    : new WebrtcProvider(webrtcRoomName(roomId), doc, {
        signaling: signalingUrls,
      });
  const awareness = liveblocks?.awareness ?? webrtc!.awareness;

  const updatePeers = () => {
    const peers: RoomSnapshot['peers'] = Array.from(awareness.getStates().entries()).map(
      ([clientId, state]) => {
        const user = (state as { user?: { name?: string; color?: string } }).user;
        return {
          id: String(clientId),
          name: user?.name || 'Guest',
          ...(user?.color ? { color: user.color } : {}),
        };
      },
    );
    store.setPeers(peers);
  };

  awareness.on('change', updatePeers);
  updatePeers();
  if (webrtc) {
    webrtc.on('status', ({ connected }) => {
      store.setConnection({
        provider: 'WebRTC',
        status: connected ? 'connected' : 'disconnected',
      });
    });
  }
  liveblocksRoom?.connect();

  return {
    doc,
    store,
    setIdentity: (identity) => {
      awareness.setLocalStateField(
        'user',
        identity
          ? {
              ...identity,
              color: participantColors[identity.colorIdx % participantColors.length],
            }
          : null,
      );
    },
  };
}

export function getRoomProvider(roomId: RoomId, seed?: ReceiptSeed | null): Promise<RoomProvider> {
  let provider = providers.get(roomId);
  if (!provider) {
    provider = createProvider(roomId, seed).catch((error: unknown) => {
      providers.delete(roomId);
      throw error;
    });
    providers.set(roomId, provider);
  }
  return provider;
}
