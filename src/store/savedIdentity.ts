// The identity a person last used in a room, kept in localStorage so it survives a reload.
// localStorage changes without React knowing, so components read it through
// useSyncExternalStore with these functions rather than during render.

const keyFor = (roomId: string) => `splitsmart-user-${roomId}`;

// Same-tab listeners. The browser's storage event fires only in other tabs, never in the tab
// that wrote, so a write here has to notify this tab's subscribers itself.
const listeners = new Set<() => void>();

export function readSavedIdentity(roomId: string): string | null {
  return window.localStorage.getItem(keyFor(roomId));
}

export function saveIdentity(roomId: string, id: string) {
  const key = keyFor(roomId);
  if (window.localStorage.getItem(key) === id) return;
  window.localStorage.setItem(key, id);
  for (const listener of listeners) listener();
}

export function subscribeToSavedIdentity(roomId: string, onChange: () => void) {
  const key = keyFor(roomId);
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
