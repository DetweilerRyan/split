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
    const states = new Map([[1, { user: { id: 'peer-1', name: 'Peer' } }]]);
    const awareness = {
      getStates: () => states,
      on: vi.fn((_event: string, listener: () => void) => listener()),
      setLocalStateField: vi.fn(),
    };
    const room = {};
    const client = { enterRoom: vi.fn(() => ({ room, leave: vi.fn() })) };
    mocks.createClient.mockReturnValue(client);
    mocks.getYjsProviderForRoom.mockReturnValue({ getYDoc: () => doc, awareness });

    const { getRoomProvider } = await import('../store/yjsProvider');
    const provider = await getRoomProvider('room-liveblocks');

    expect(mocks.createClient).toHaveBeenCalledWith({ publicApiKey: 'pk_test' });
    expect(client.enterRoom).toHaveBeenCalledWith('room-liveblocks', {
      initialPresence: { user: null },
    });
    expect(mocks.getYjsProviderForRoom).toHaveBeenCalledWith(room);
    expect(provider.doc).toBe(doc);
    expect(provider.store.getSnapshot().peers).toEqual([{ id: 'peer-1', name: 'Peer' }]);
    expect(mocks.WebrtcProvider).not.toHaveBeenCalled();

    provider.setIdentity({ id: 'person-1', name: 'Person', colorIdx: 0 });
    expect(awareness.setLocalStateField).toHaveBeenCalledWith(
      'user',
      expect.objectContaining({ id: 'person-1', name: 'Person', color: '#4f46e5' }),
    );
    doc.destroy();
  });

  it('keeps WebRTC as the default when no Liveblocks key is configured', async () => {
    vi.stubEnv('VITE_LIVEBLOCKS_PUBLIC_KEY', '');
    const doc = new Y.Doc();
    const awareness = {
      getStates: () => new Map(),
      on: vi.fn(),
      setLocalStateField: vi.fn(),
    };
    mocks.WebrtcProvider.mockImplementation(function () {
      return { awareness };
    });

    const { getRoomProvider } = await import('../store/yjsProvider');
    const provider = await getRoomProvider('room-p2p');

    expect(mocks.createClient).not.toHaveBeenCalled();
    expect(mocks.getYjsProviderForRoom).not.toHaveBeenCalled();
    expect(mocks.WebrtcProvider).toHaveBeenCalledWith(
      'splitsmart-p2p-room-room-p2p',
      expect.any(Y.Doc),
      expect.objectContaining({ signaling: expect.any(Array) }),
    );
    expect(provider.store.getSnapshot().items.length).toBeGreaterThan(0);
    doc.destroy();
  });
});
