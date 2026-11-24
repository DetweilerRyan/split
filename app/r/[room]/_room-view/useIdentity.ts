import { useState } from 'react';
import { type Participant, participantId } from '@/domain/receipt/roomSnapshot';
import type { RoomId } from '@/domain/room/roomId';
import type { ReceiptStore } from '@/sync/useReceiptStore';
import type { RoomProvider } from '@/sync/yjsProvider';
import { useActiveIdentity } from '@/hooks/useActiveIdentity';

/** What `useIdentity` needs of the room's provider. */
export interface IdentityProvider {
  readonly store: Pick<ReceiptStore, 'addParticipant' | 'removeParticipant'>;
  readonly setIdentity: RoomProvider['setIdentity'];
}

/**
 * Who you are in the room, and the identity picker: whether it's open, and choosing, adding and
 * removing a participant. Pass the same `provider` on every render, since `useActiveIdentity`
 * tells it the identity again whenever it changes.
 */
export function useIdentity(
  provider: IdentityProvider,
  roomId: RoomId,
  participants: readonly Participant[],
  showToast: (message: string) => void,
) {
  const [activeId, setActiveId] = useActiveIdentity(provider, roomId, participants);
  const [pickerOpen, setPickerOpen] = useState(false);

  function openPicker() {
    setPickerOpen(true);
  }

  function closePicker() {
    setPickerOpen(false);
  }

  function choose(id: string) {
    setActiveId(id);
    setPickerOpen(false);
  }

  // Adding a name already on the bill chooses that participant instead.
  function add(name: string) {
    const participant = provider.store.addParticipant(name);
    const id = participantId(name);
    if (participant) choose(participant.id);
    else if (participants.some((person) => person.id === id)) choose(id);
    else showToast('Enter a participant name.');
  }

  function remove(id: string) {
    provider.store.removeParticipant(id);
    if (id === activeId) setActiveId(null);
  }

  return { activeId, pickerOpen, openPicker, closePicker, choose, add, remove } as const;
}
