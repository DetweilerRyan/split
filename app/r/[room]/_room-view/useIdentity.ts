import { useState } from 'react';
import {
  type Participant,
  type ParticipantId,
  findParticipant,
} from '@/domain/receipt/roomSnapshot';
import type { RoomId } from '@/domain/room/roomId';
import type { ReceiptStore } from '@/sync/useReceiptStore';
import type { RoomProvider } from '@/sync/yjsProvider';
import { useActiveIdentity } from './useActiveIdentity';

/** What `useIdentity` needs of the room's provider. */
export type IdentityProvider = {
  readonly store: Pick<ReceiptStore, 'addParticipant' | 'removeParticipant'>;
  readonly setIdentity: RoomProvider['setIdentity'];
};

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

  function choose(id: ParticipantId) {
    setActiveId(id);
    setPickerOpen(false);
  }

  // Adding a name already on the bill chooses that participant instead.
  function add(name: string) {
    const participant = provider.store.addParticipant(name) ?? findParticipant(participants, name);
    if (participant !== undefined) choose(participant.id);
    else if (name.trim() !== '') showToast('Enter a name with at least one letter or number.');
    else showToast('Enter a participant name.');
  }

  function remove(id: ParticipantId) {
    provider.store.removeParticipant(id);
    if (id === activeId) setActiveId(null);
  }

  // Who you are, or `null` before you choose or once you're removed.
  const you = participants.find((person) => person.id === activeId) ?? null;

  return { activeId, you, pickerOpen, openPicker, closePicker, choose, add, remove } as const;
}
