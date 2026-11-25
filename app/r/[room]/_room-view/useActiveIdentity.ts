import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { readSavedIdentity, saveIdentity, subscribeToSavedIdentity } from '@/sync/savedIdentity';
import type { RoomProvider } from '@/sync/yjsProvider';
import type { ParticipantId } from '@/domain/receipt/roomSnapshot';
import type { RoomId } from '@/domain/room/roomId';

type Participant = {
  readonly id: ParticipantId;
  readonly name: string;
  readonly colorIdx: number;
};

export function useActiveIdentity(
  provider: Pick<RoomProvider, 'setIdentity'>,
  roomId: RoomId,
  participants: readonly Participant[],
) {
  const [chosenId, setActiveId] = useState<ParticipantId | null>(null);

  // The identity saved for this room lives in localStorage, which changes without React
  // knowing (another tab can save one), so it is read as an external store rather than during
  // render. There is no saved identity on the server.
  const subscribe = useCallback(
    (onChange: () => void) => subscribeToSavedIdentity(roomId, onChange),
    [roomId],
  );
  const savedId = useSyncExternalStore(
    subscribe,
    () => readSavedIdentity(roomId),
    () => null,
  );

  // The active identity is the one chosen, else the one saved for this room, else the first
  // participant. It is worked out during render from React's own values, so no render goes by
  // without one.
  function isParticipant(id: ParticipantId | null) {
    return id !== null && participants.some((person) => person.id === id);
  }
  const [firstParticipant] = participants;
  let activeId: ParticipantId | null = null;
  if (isParticipant(chosenId)) {
    activeId = chosenId;
  } else if (firstParticipant !== undefined) {
    activeId = isParticipant(savedId) ? savedId : firstParticipant.id;
  }

  useEffect(() => {
    const identity = participants.find((person) => person.id === activeId);
    provider.setIdentity(
      identity !== undefined
        ? { id: identity.id, name: identity.name, colorIdx: identity.colorIdx }
        : null,
    );
    if (identity !== undefined) saveIdentity(roomId, identity.id);
  }, [activeId, provider, roomId, participants]);

  return [activeId, setActiveId] as const;
}
