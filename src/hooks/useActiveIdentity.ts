import { useEffect, useState } from 'react';
import type { RoomProvider } from '../store/yjsProvider';

interface Participant {
  id: string;
  name: string;
  colorIdx: number;
}

export function useActiveIdentity(
  provider: RoomProvider,
  roomId: string,
  participants: readonly Participant[],
) {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (participants.length === 0) return;
    if (!activeId || !participants.some((person) => person.id === activeId)) {
      const saved = window.localStorage.getItem(`splitsmart-user-${roomId}`);
      setActiveId(participants.find((person) => person.id === saved)?.id ?? participants[0].id);
    }
  }, [activeId, roomId, participants]);

  useEffect(() => {
    const identity = participants.find((person) => person.id === activeId);
    provider.setIdentity(
      identity ? { id: identity.id, name: identity.name, colorIdx: identity.colorIdx } : null,
    );
    if (identity) window.localStorage.setItem(`splitsmart-user-${roomId}`, identity.id);
  }, [activeId, provider, roomId, participants]);

  return [activeId, setActiveId] as const;
}
