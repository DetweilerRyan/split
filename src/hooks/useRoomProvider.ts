import { use } from 'react';
import type { ReceiptSeed } from '../types/receipt';
import { getRoomProvider, type RoomProvider } from '../store/yjsProvider';
import { pendingSeedKey, validateSeed } from '../store/seedCodec';

type RoomLoad =
  | { status: 'pending'; promise: Promise<RoomProvider> }
  | { status: 'resolved'; promise: Promise<RoomProvider>; provider: RoomProvider }
  | { status: 'rejected'; promise: Promise<RoomProvider>; error: Error };

// `use()` needs the same promise instance on every render, so loads are cached per room
// outside of React. Rejected entries stay cached so the error boundary sees a stable
// rejection instead of re-triggering the load on every retry render.
const loads = new Map<string, RoomLoad>();

function readPendingSeed(roomId: string): ReceiptSeed | null {
  try {
    const raw = window.sessionStorage.getItem(pendingSeedKey(roomId));
    return raw ? validateSeed(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function startLoad(roomId: string): RoomLoad {
  const promise = getRoomProvider(roomId, readPendingSeed(roomId)).then(
    (provider) => {
      try {
        window.sessionStorage.removeItem(pendingSeedKey(roomId));
      } catch {}
      loads.set(roomId, { status: 'resolved', promise, provider });
      return provider;
    },
    (cause: unknown) => {
      const error = new Error('Could not open this receipt room.', { cause });
      loads.set(roomId, { status: 'rejected', promise, error });
      throw error;
    },
  );
  const load: RoomLoad = { status: 'pending', promise };
  loads.set(roomId, load);
  return load;
}

/** Suspends while the room loads; a failed load is thrown to the nearest error boundary. */
export function useRoomProvider(roomId: string): RoomProvider {
  const load = loads.get(roomId) ?? startLoad(roomId);
  return load.status === 'resolved' ? load.provider : use(load.promise);
}

/** Drop rejected loads so the next render retries them (call from an error boundary reset). */
export function clearFailedRoomLoads() {
  for (const [roomId, load] of loads) {
    if (load.status === 'rejected') loads.delete(roomId);
  }
}
