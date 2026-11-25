import { IndexeddbPersistence } from 'y-indexeddb';
import { WebrtcProvider } from 'y-webrtc';
import * as Y from 'yjs';
import { createClient } from '@liveblocks/client';
import { getYjsProviderForRoom } from '@liveblocks/yjs';
import { z } from 'zod';
import { hydrateFromSeed } from './seedCodec';
import type { ReceiptSeed } from '../domain/receipt/receiptSeed';
import type { RoomId } from '../domain/room/roomId';
import { storedText } from './storedText';
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

/** A WebRTC provider for the room's document, with the awareness it shares peers' states through. */
function connectWebrtc(roomId: RoomId, doc: Y.Doc) {
  const webrtc = new WebrtcProvider(webrtcRoomName(roomId), doc, {
    signaling: [...signalingUrls],
  });
  return { awareness: webrtc.awareness, webrtc };
}

// @crap-allow CRAP 22, complexity 22. Too complex: it sets up the room's document, storage, Liveblocks or WebRTC, connection status and presence in one place, each with branches of its own. Split the Liveblocks and the WebRTC setup into functions of their own when either next changes.
async function createProvider(roomId: RoomId, seed: ReceiptSeed | null): Promise<RoomProvider> {
  const liveblocksRoom =
    liveblocksApiKey !== ''
      ? (providerRegistry.__splitLiveblocksClient ??= createClient({
          publicApiKey: liveblocksApiKey,
        })).enterRoom(roomId, {
          autoConnect: false,
          initialPresence: { user: null },
        }).room
      : null;
  const liveblocks = liveblocksRoom !== null ? getYjsProviderForRoom(liveblocksRoom) : null;
  const doc = liveblocks?.getYDoc() ?? new Y.Doc();
  const persistence = new IndexeddbPersistence(indexedDbName(roomId), doc);
  await persistence.whenSynced;

  const items = doc.getMap('items');
  if (seed !== null && items.size === 0) {
    hydrateFromSeed(doc, seed);
  }

  const store = new ReceiptStore(doc);
  const connectionProvider = liveblocksRoom !== null ? 'Liveblocks' : 'WebRTC';
  function updateLiveblocksStatus(status: string) {
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
  if (liveblocksRoom !== null) {
    updateLiveblocksStatus(liveblocksRoom.getStatus());
    liveblocksRoom.subscribe('status', updateLiveblocksStatus);
  } else {
    store.setConnection({ provider: connectionProvider, status: 'connecting' });
  }
  const { awareness, webrtc } =
    liveblocks !== null
      ? { awareness: liveblocks.awareness, webrtc: null }
      : connectWebrtc(roomId, doc);

  function updatePeers() {
    const peers: RoomSnapshot['peers'] = Array.from(awareness.getStates().entries()).map(
      ([clientId, state]) => {
        const { user } = peerState.parse(state);
        return {
          id: String(clientId),
          name: storedText(user?.name, 'Guest'),
          ...(user?.color !== undefined && user.color !== '' ? { color: user.color } : {}),
        };
      },
    );
    store.setPeers(peers);
  }

  awareness.on('change', updatePeers);
  updatePeers();
  if (webrtc !== null) {
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
