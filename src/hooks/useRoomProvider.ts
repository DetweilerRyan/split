import { use } from 'react';
import type { ReceiptSeed } from '../types/receipt';
import { getRoomProvider, type RoomProvider } from '../store/yjsProvider';
import { pendingSeedKey, validateSeed } from '../store/seedCodec';

const loads = new Map<string, Promise<RoomProvider>>();

function readPendingSeed(roomId: string): ReceiptSeed | null {
  try {
    const raw = window.sessionStorage.getItem(pendingSeedKey(roomId));
    return raw ? validateSeed(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function loadRoom(roomId: string): Promise<RoomProvider> {
  return getRoomProvider(roomId, readPendingSeed(roomId)).then(
    (provider) => {
      try {
        window.sessionStorage.removeItem(pendingSeedKey(roomId));
      } catch {}
      return provider;
    },
    () => {
      throw new Error('Could not open this receipt room.');
    },
  );
}

/** Suspends while the room loads; throws to the nearest error boundary on failure. */
export function useRoomProvider(roomId: string): RoomProvider {
  let load = loads.get(roomId);
  if (!load) {
    load = loadRoom(roomId);
    loads.set(roomId, load);
  }
  return use(load);
}

/** Forget settled loads so an error boundary reset can retry. */
export function resetRoomLoads() {
  loads.clear();
}
