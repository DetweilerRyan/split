import { use } from 'react';
import type { ReceiptSeed } from '../types/receipt';
import { getRoomProvider, type RoomProvider } from '../store/yjsProvider';
import { pendingSeedKey, validateSeed } from '../store/seedCodec';

// `use()` needs the same promise instance on every render, so loads are cached per room
// outside of React. Failed entries stay cached so the error boundary sees a stable
// rejection instead of re-triggering the load on every retry render.
const loads = new Map<string, { promise: Promise<RoomProvider>; failed: boolean }>();

function readPendingSeed(roomId: string): ReceiptSeed | null {
  try {
    const raw = window.sessionStorage.getItem(pendingSeedKey(roomId));
    return raw ? validateSeed(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function startLoad(roomId: string) {
  const entry = {
    failed: false,
    promise: getRoomProvider(roomId, readPendingSeed(roomId)).then(
      (provider) => {
        try {
          window.sessionStorage.removeItem(pendingSeedKey(roomId));
        } catch {}
        return provider;
      },
      (cause: unknown) => {
        entry.failed = true;
        throw new Error('Could not open this receipt room.', { cause });
      },
    ),
  };
  loads.set(roomId, entry);
  return entry;
}

/** Suspends while the room loads; a failed load is thrown to the nearest error boundary. */
export function useRoomProvider(roomId: string): RoomProvider {
  return use((loads.get(roomId) ?? startLoad(roomId)).promise);
}

/** Drop failed loads so the next render retries them (call from an error boundary reset). */
export function clearFailedRoomLoads() {
  for (const [roomId, entry] of loads) {
    if (entry.failed) loads.delete(roomId);
  }
}
