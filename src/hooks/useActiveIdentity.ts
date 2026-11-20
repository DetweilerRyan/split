import { useEffect, useState } from 'react';
import type { RoomProvider } from '../store/yjsProvider';

interface Participant {
  id: string;
  name: string;
  colorIdx: number;
}

export function useActiveIdentity(
  provider: Pick<RoomProvider, 'setIdentity'>,
  roomId: string,
  participants: readonly Participant[],
) {
  const [chosenId, setActiveId] = useState<string | null>(null);
  const storageKey = `splitsmart-user-${roomId}`;
  const isParticipant = (id: string | null) =>
    id !== null && participants.some((person) => person.id === id);

  // The active identity is the one chosen, else the one saved for this room, else the first
  // participant. It is worked out during render, so no render goes by without one. RoomView is
  // loaded with ssr: false, so localStorage is always available here.
  let activeId: string | null = null;
  if (isParticipant(chosenId)) {
    activeId = chosenId;
  } else if (participants.length > 0) {
    const saved = window.localStorage.getItem(storageKey);
    activeId = isParticipant(saved) ? saved : participants[0].id;
  }

  useEffect(() => {
    const identity = participants.find((person) => person.id === activeId);
    provider.setIdentity(
      identity ? { id: identity.id, name: identity.name, colorIdx: identity.colorIdx } : null,
    );
    if (identity) window.localStorage.setItem(storageKey, identity.id);
  }, [activeId, provider, storageKey, participants]);

  return [activeId, setActiveId] as const;
}
