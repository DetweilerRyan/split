import { use } from 'react';
import type { ReceiptSeed } from '../types/receipt';
import { getRoomProvider, type RoomProvider } from '../store/yjsProvider';
import { pendingSeedKey, validateSeed } from '../store/seedCodec';

// `use()` needs the same promise instance on every render, so loads are cached per room
// outside of React. A rejected load stays cached; recovering requires reloading the page.
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
    (cause: unknown) => {
      throw new Error('Could not open this receipt room.', { cause });
    },
  );
}

/** Suspends while the room loads; a failed load is thrown to the nearest error boundary. */
export function useRoomProvider(roomId: string): RoomProvider {
  let load = loads.get(roomId);
  if (!load) {
    load = loadRoom(roomId);
    loads.set(roomId, load);
  }
  return use(load);
}
