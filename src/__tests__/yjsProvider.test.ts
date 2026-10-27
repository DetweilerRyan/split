import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getYjsProviderForRoom: vi.fn(),
  IndexeddbPersistence: vi.fn(),
  WebrtcProvider: vi.fn(),
}));

vi.mock('@liveblocks/client', () => ({ createClient: mocks.createClient }));
vi.mock('@liveblocks/yjs', () => ({ getYjsProviderForRoom: mocks.getYjsProviderForRoom }));
vi.mock('y-indexeddb', () => ({ IndexeddbPersistence: mocks.IndexeddbPersistence }));
vi.mock('y-webrtc', () => ({ WebrtcProvider: mocks.WebrtcProvider }));

type ProviderRegistry = typeof globalThis & {
  __splitRoomProviders?: Map<string, Promise<unknown>>;
  __splitLiveblocksClient?: unknown;
};

const registry = globalThis as ProviderRegistry;

describe('room sync provider selection', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete registry.__splitRoomProviders;
    delete registry.__splitLiveblocksClient;
    mocks.IndexeddbPersistence.mockImplementation(function () {
      return { whenSynced: Promise.resolve() };
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete registry.__splitRoomProviders;
    delete registry.__splitLiveblocksClient;
  });

  it('uses Liveblocks Yjs when a public key is configured', async () => {
    vi.stubEnv('VITE_LIVEBLOCKS_PUBLIC_KEY', 'pk_test');
    const doc = new Y.Doc();
    const states = new Map([
      [1, { user: { id: 'peer-1', name: 'Peer' } }],
      [2, { user: { id: 'peer-1', name: 'Duplicate identity' } }],
      [3, { user: { name: 'Missing id' } }],
    ]);
    let onAwarenessChange: (() => void) | undefined;
    const awareness = {
      getStates: () => states,
      on: vi.fn((_event: string, listener: () => void) => {
        onAwarenessChange = listener;
      }),
      setLocalStateField: vi.fn(),
    };
    const room = {
      connect: vi.fn(() => {
        expect(doc.getMap('meta').get('title')).toBe('Restored locally');
        expect(doc.getMap('items').has('seed-item')).toBe(true);
      }),
    };
    const client = { enterRoom: vi.fn(() => ({ room, leave: vi.fn() })) };
    let completePersistence!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      completePersistence = resolve;
    });
    mocks.IndexeddbPersistence.mockImplementation(function (_name: string, persistedDoc: Y.Doc) {
      persistedDoc.getMap('meta').set('title', 'Restored locally');
      return { whenSynced };
    });
    mocks.createClient.mockReturnValue(client);
    mocks.getYjsProviderForRoom.mockReturnValue({ getYDoc: () => doc, awareness });

    const { getRoomProvider } = await import('../store/yjsProvider');
    const seed = {
      title: 'Link title',
      cardTipEur: 0,
      cashTipEur: 0,
      bankUsd: 0,
      roster: [],
      items: [{ id: 'seed-item', name: 'Seed item', en: 'Seed item', eur: 1 }],
    };
    const providerPromise = getRoomProvider('room-liveblocks', seed);
    expect(getRoomProvider('room-liveblocks')).toBe(providerPromise);

    expect(mocks.createClient).toHaveBeenCalledWith({ publicApiKey: 'pk_test' });
    expect(client.enterRoom).toHaveBeenCalledWith('room-liveblocks', {
      autoConnect: false,
      initialPresence: { user: null },
    });
    expect(mocks.getYjsProviderForRoom).toHaveBeenCalledWith(room);
    expect(mocks.IndexeddbPersistence).toHaveBeenCalledWith(
      'splitsmart-p2p-room-liveblocks',
      doc,
    );
    expect(room.connect).not.toHaveBeenCalled();

    completePersistence();
    const provider = await providerPromise;

    expect(provider.doc).toBe(doc);
    expect(room.connect).toHaveBeenCalledOnce();
    expect(provider.store.getSnapshot().title).toBe('Restored locally');
    expect(provider.store.getSnapshot().items.map((item) => item.id)).toEqual(['seed-item']);
    expect(provider.store.getSnapshot().peers).toEqual([{ id: 'peer-1', name: 'Peer' }]);
    expect(mocks.WebrtcProvider).not.toHaveBeenCalled();

    states.set(4, { user: { id: 'peer-2', name: 'Another peer' } });
    onAwarenessChange?.();
    expect(provider.store.getSnapshot().peers).toEqual([
      { id: 'peer-1', name: 'Peer' },
      { id: 'peer-2', name: 'Another peer' },
    ]);
    states.delete(1);
    states.delete(2);
    states.delete(4);
    onAwarenessChange?.();
    expect(provider.store.getSnapshot().peers).toEqual([]);

    provider.setIdentity({ id: 'person-1', name: 'Person', colorIdx: 0 });
    expect(awareness.setLocalStateField).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ id: 'person-1', name: 'Person', color: '#4f46e5' }),
    );
    provider.setIdentity(null);
    expect(awareness.setLocalStateField).toHaveBeenLastCalledWith('user', null);
    doc.destroy();
  });

  it('keeps WebRTC as the default when no Liveblocks key is configured', async () => {
    vi.stubEnv('VITE_LIVEBLOCKS_PUBLIC_KEY', '');
    const doc = new Y.Doc();
    let completePersistence!: () => void;
    const whenSynced = new Promise<void>((resolve) => {
      completePersistence = resolve;
    });
    const awareness = {
      getStates: () => new Map(),
      on: vi.fn(),
      setLocalStateField: vi.fn(),
    };
    mocks.IndexeddbPersistence.mockImplementation(function () {
      return { whenSynced };
    });
    mocks.WebrtcProvider.mockImplementation(function () {
      return { awareness };
    });

    const { getRoomProvider } = await import('../store/yjsProvider');
    const providerPromise = getRoomProvider('room-p2p');

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getYjsProviderForRoom).not.toHaveBeenCalled();
    expect(mocks.WebrtcProvider).not.toHaveBeenCalled();

    completePersistence();
    const provider = await providerPromise;

    expect(mocks.WebrtcProvider).toHaveBeenCalledWith(
      'splitsmart-p2p-room-room-p2p',
      expect.any(Y.Doc),
      expect.objectContaining({ signaling: expect.any(Array) }),
    );
    expect(provider.store.getSnapshot().items.length).toBeGreaterThan(0);
    expect(provider.doc).toBe(mocks.IndexeddbPersistence.mock.calls[0][1]);
    expect(provider.doc).toBe(mocks.WebrtcProvider.mock.calls[0][1]);
    doc.destroy();
  });
});
