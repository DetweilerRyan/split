// The identity a person last used in a room, kept in localStorage so it survives a reload.
// localStorage changes without React knowing, so components read it through
// useSyncExternalStore with these functions rather than during render.

import type { RoomId } from './seedCodec';

/** The `localStorage` key for the identity last used in a room. */
export type SavedIdentityKey = `splitsmart-user-${RoomId}`;

export function savedIdentityKey(roomId: RoomId): SavedIdentityKey {
  return `splitsmart-user-${roomId}` as const;
}

// Same-tab listeners. The browser's storage event fires only in other tabs, never in the tab
// that wrote, so a write here has to notify this tab's subscribers itself.
const listeners = new Set<() => void>();

export function readSavedIdentity(roomId: RoomId): string | null {
  return window.localStorage.getItem(savedIdentityKey(roomId));
}

export function saveIdentity(roomId: RoomId, id: string) {
  const key = savedIdentityKey(roomId);
  if (window.localStorage.getItem(key) === id) return;
  window.localStorage.setItem(key, id);
  for (const listener of listeners) listener();
}

export function subscribeToSavedIdentity(roomId: RoomId, onChange: () => void) {
  const key = savedIdentityKey(roomId);
  // event.key is null when another tab clears all of localStorage.
  const onStorage = (event: StorageEvent) => {
    if (event.key === key || event.key === null) onChange();
  };
  listeners.add(onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}
