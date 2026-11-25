import { use } from 'react';
import { pendingSeedKey } from '@/sync/seedCodec';
import { type ReceiptSeed, validateSeed } from '@/domain/receipt/receiptSeed';
import type { RoomId } from '@/domain/room/roomId';
import { getRoomProvider, type RoomProvider } from '@/sync/yjsProvider';

// `use()` needs the same promise instance on every render, so loads are cached per room
// outside of React. A rejected load stays cached; recovering requires reloading the page.
const loads = new Map<RoomId, Promise<RoomProvider>>();

function readPendingSeed(roomId: RoomId): ReceiptSeed | null {
  try {
    const raw = window.sessionStorage.getItem(pendingSeedKey(roomId));
    return raw !== null ? validateSeed(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

function loadRoom(roomId: RoomId): Promise<RoomProvider> {
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
export function useRoomProvider(roomId: RoomId): RoomProvider {
  let load = loads.get(roomId);
  if (load === undefined) {
    load = loadRoom(roomId);
    loads.set(roomId, load);
  }
  return use(load);
}
