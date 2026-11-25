// The identity a person last used in a room, kept in localStorage so it survives a reload.
// localStorage changes without React knowing, so components read it through
// useSyncExternalStore with these functions rather than during render.

import { type ParticipantId, parseParticipantId } from '../domain/receipt/roomSnapshot';
import type { RoomId } from '../domain/room/roomId';

/** The `localStorage` key for the identity last used in a room. */
export type SavedIdentityKey = `splitsmart-user-${RoomId}`;

export function savedIdentityKey(roomId: RoomId): SavedIdentityKey {
  return `splitsmart-user-${roomId}` as const;
}

// Same-tab listeners. The browser's storage event fires only in other tabs, never in the tab
// that wrote, so a write here has to notify this tab's subscribers itself.
const listeners = new Set<() => void>();

/**
 * The participant id saved for this room, or `null` when none is. A saved value that isn't a
 * participant id, such as `p-`, reads as none, with a console warning naming it; it stays in
 * storage until another identity is saved over it. The owner chose that on #124.
 */
export function readSavedIdentity(roomId: RoomId): ParticipantId | null {
  const saved = window.localStorage.getItem(savedIdentityKey(roomId));
  if (saved === null) return null;
  const id = parseParticipantId(saved);
  if (id === null) {
    console.warn(
      `SplitSmart left out the identity saved for room ${roomId} as ${JSON.stringify(saved)}: that isn't a participant id.`,
    );
  }
  return id;
}

export function saveIdentity(roomId: RoomId, id: ParticipantId) {
  const key = savedIdentityKey(roomId);
  if (window.localStorage.getItem(key) === id) return;
  window.localStorage.setItem(key, id);
  for (const listener of listeners) listener();
}

export function subscribeToSavedIdentity(roomId: RoomId, onChange: () => void) {
  const key = savedIdentityKey(roomId);
  // event.key is null when another tab clears all of localStorage.
  function onStorage(event: StorageEvent) {
    if (event.key === key || event.key === null) onChange();
  }
  listeners.add(onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener('storage', onStorage);
  };
}
