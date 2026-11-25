import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';
import { z } from 'zod';
import { hydrateFromSeed } from './seedCodec';
import type { ReceiptSeed } from '../domain/receipt/receiptSeed';
import type { RoomId } from '../domain/room/roomId';
import { storedTextSchema } from './storedText';
import { ReceiptStore } from './useReceiptStore';
import type { ParticipantId, RoomSnapshot } from '../domain/receipt/roomSnapshot';

export type RoomProvider = {
  readonly doc: Y.Doc;
  readonly store: ReceiptStore;
  readonly setIdentity: (
    identity: {
      readonly id: ParticipantId;
      readonly name: string;
      readonly colorIdx: number;
    } | null,
  ) => void;
};

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
  // oxlint-disable-next-line readonly/types -- a global cache, set on first use, that getRoomProvider adds to and removes from in place.
  __splitRoomProviders?: Map<RoomId, Promise<RoomProvider>>;
  // oxlint-disable-next-line readonly/types -- a global slot, set on first use, so every room shares one Liveblocks client.
  __splitLiveblocksClient?: ReturnType<typeof createClient>;
};

const providerRegistry: ProviderRegistry = globalThis;
/**
 * The part of a peer's awareness state the peer list shows. Any peer can set it to anything, so a
 * state that doesn't fit shows as a guest.
 */
const peerState = z
  .object({
    user: z.object({ name: z.string().optional(), color: z.string().optional() }).optional(),
  })
  .catch({});
const providers =
  providerRegistry.__splitRoomProviders ??
  (providerRegistry.__splitRoomProviders = new Map<RoomId, Promise<RoomProvider>>());
const liveblocksApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY?.trim() ?? '';
const publicSignalingUrls = ['wss://signaling.yjs.dev', 'wss://y-webrtc-eu.fly.dev'] as const;
const configuredSignalingUrls = (process.env.NEXT_PUBLIC_WEBRTC_SIGNALING_URLS ?? '')
  .split(',')
  .map((url) => url.trim())
  .filter(Boolean);
const signalingUrls =
  configuredSignalingUrls.length > 0 ? configuredSignalingUrls : publicSignalingUrls;
const participantColors = [
  '#4f46e5',
  '#059669',
  '#d97706',
  '#e11d48',
  '#7c3aed',
  '#0891b2',
  '#c026d3',
] as const;

/**
 * The room's Liveblocks room, entered without connecting, and the Yjs provider over it, or null when
 * no Liveblocks key is configured. Every room shares one Liveblocks client.
 */
function enterLiveblocksRoom(roomId: RoomId) {
  if (liveblocksApiKey === '') return null;
  providerRegistry.__splitLiveblocksClient ??= createClient({ publicApiKey: liveblocksApiKey });
  const { room } = providerRegistry.__splitLiveblocksClient.enterRoom(roomId, {
    autoConnect: false,
    initialPresence: { user: null },
  });
  return { room, yjs: getYjsProviderForRoom(room) };
}

/**
 * Shows the Liveblocks room's connection status in the store, now and as it changes, and returns
 * the awareness peers share their states through.
 */
function followLiveblocks(
  liveblocks: {
    readonly room: {
      readonly getStatus: () => string;
      readonly subscribe: (event: 'status', listener: (status: string) => void) => unknown;
    };
    readonly yjs: { readonly awareness: PeerAwareness };
  },
  store: Pick<ReceiptStore, 'setConnection'>,
): PeerAwareness {
  function updateStatus(status: string) {
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
  }
  updateStatus(liveblocks.room.getStatus());
  liveblocks.room.subscribe('status', updateStatus);
  return liveblocks.yjs.awareness;
}

/**
 * Connects the room's document to its peers over WebRTC, shows the connection's status in the
 * store as it changes, and returns the awareness peers share their states through.
 */
function connectWebrtc(roomId: RoomId, doc: Y.Doc, store: Pick<ReceiptStore, 'setConnection'>) {
  store.setConnection({ provider: 'WebRTC', status: 'connecting' });
  const webrtc = new WebrtcProvider(webrtcRoomName(roomId), doc, {
    signaling: [...signalingUrls],
  });
  webrtc.on('status', ({ connected }) => {
    store.setConnection({
      provider: 'WebRTC',
      status: connected ? 'connected' : 'disconnected',
    });
  });
  return webrtc.awareness;
}

/** What the room reads and sets of an awareness, which Liveblocks' and y-webrtc's both have. */
type PeerAwareness = {
  readonly getStates: () => ReadonlyMap<number, unknown>;
  readonly on: (event: 'change', listener: () => void) => void;
  readonly setLocalStateField: (field: 'user', user: SharedUser | null) => void;
};

/** The user a peer shares through its awareness: its identity, with the color it's shown in. */
type SharedUser = NonNullable<Parameters<RoomProvider['setIdentity']>[0]> & {
  readonly color: (typeof participantColors)[number] | undefined;
};

/** Keeps the store's list of peers in step with the states they share through `awareness`. */
function showPeers(awareness: PeerAwareness, store: Pick<ReceiptStore, 'setPeers'>) {
  function updatePeers() {
    const peers: RoomSnapshot['peers'] = Array.from(awareness.getStates().entries()).map(
      ([clientId, state]) => {
        const { user } = peerState.parse(state);
        return {
          id: String(clientId),
          name: storedTextSchema('Guest').parse(user?.name),
          ...(user?.color !== undefined && user.color !== '' ? { color: user.color } : {}),
        };
      },
    );
    store.setPeers(peers);
  }
  awareness.on('change', updatePeers);
  updatePeers();
}

async function createProvider(roomId: RoomId, seed: ReceiptSeed | null): Promise<RoomProvider> {
  const liveblocks = enterLiveblocksRoom(roomId);
  const doc = liveblocks?.yjs.getYDoc() ?? new Y.Doc();
  const persistence = new IndexeddbPersistence(indexedDbName(roomId), doc);
  await persistence.whenSynced;

  const items = doc.getMap('items');
  if (seed !== null && items.size === 0) {
    hydrateFromSeed(doc, seed);
  }

  const store = new ReceiptStore(doc);
  const awareness =
    liveblocks !== null ? followLiveblocks(liveblocks, store) : connectWebrtc(roomId, doc, store);
  showPeers(awareness, store);
  liveblocks?.room.connect();

  return {
    doc,
    store,
    setIdentity: (identity) => {
      awareness.setLocalStateField(
        'user',
        identity !== null
          ? {
              ...identity,
              color: participantColors[identity.colorIdx % participantColors.length],
            }
          : null,
      );
    },
  };
}

export function getRoomProvider(
  roomId: RoomId,
  seed: ReceiptSeed | null = null,
): Promise<RoomProvider> {
  let provider = providers.get(roomId);
  if (provider === undefined) {
    provider = createProvider(roomId, seed).catch((error: unknown) => {
      providers.delete(roomId);
      throw error;
    });
    providers.set(roomId, provider);
  }
  return provider;
}
