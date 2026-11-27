import { type ReactNode, useState } from 'react';
import { computeReceiptMath } from '@/domain/receipt/math';
import type {
  ItemId,
  Participant,
  ParticipantId,
  ReceiptItem,
  RoomSnapshot,
} from '@/domain/receipt/roomSnapshot';
import { useReceiptStore } from '@/sync/useReceiptStore';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

/**
 * What the room's items render, in their own terms: each slot is a render function given only the
 * props the items compute. Their composition root renders the real components from them; a test
 * renders fakes, to check only how the items wire them.
 */
export type ItemsSlots = {
  /** How much is still unclaimed, and the filter that chooses which items show. */
  readonly claimProgress: (props: {
    readonly items: readonly ReceiptItem[];
    readonly total: number;
    readonly currency: string;
    readonly filter: ItemFilter;
    readonly onFilter: (filter: ItemFilter) => void;
  }) => ReactNode;
  /** The items, to claim, or to edit while editing. */
  readonly itemList: (props: {
    readonly items: readonly ReceiptItem[];
    readonly participants: readonly Participant[];
    readonly activeId: ParticipantId | null;
    readonly editing: boolean;
    readonly currency: string;
    readonly filter: ItemFilter;
    readonly onClaim: (itemId: ItemId, participantId: ParticipantId) => void;
    readonly onClaimAll: (
      itemId: ItemId,
      participants: readonly Participant[],
      claimed: boolean,
    ) => void;
    readonly onUpdate: (
      itemId: ItemId,
      field: 'name' | 'en' | 'eur',
      value: string | number,
    ) => void;
    readonly onDelete: (itemId: ItemId) => void;
  }) => ReactNode;
};

/** The receipt store the items read and change, in their own terms. */
export type ItemsStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => RoomSnapshot;
  readonly toggleClaim: (itemId: ItemId, participantId: ParticipantId) => void;
  readonly setClaims: (
    itemId: ItemId,
    participantIds: readonly ParticipantId[],
    selected: boolean,
  ) => void;
  readonly updateItem: (id: ItemId, field: 'name' | 'en' | 'eur', value: string | number) => void;
  readonly deleteItem: (id: ItemId) => void;
};

/** Whether the items are being claimed or edited; only editing has an editor to show. */
export type ItemsMode =
  | { readonly kind: 'claiming' }
  | { readonly kind: 'editing'; readonly editor: ReactNode };

type RoomItemsProps = {
  /** The room's receipt. Pass the same one on every render. */
  readonly store: ItemsStore;
  /** Who you are in the room, whose claims a tap makes, or `null` before you choose. */
  readonly you: Participant | null;
  /** Claiming the items, or editing them with the editor shown between the progress and the list. */
  readonly mode: ItemsMode;
  readonly slots: ItemsSlots;
};

/** The room's items: how much is still unclaimed, the filter, and the items to claim or edit. */
export function RoomItems({ store, you, mode, slots }: RoomItemsProps) {
  const [filter, setFilter] = useState<ItemFilter>('all');
  const snapshot = useReceiptStore(store);
  const math = computeReceiptMath(snapshot);
  return (
    <div className="space-y-3">
      {slots.claimProgress({
        items: snapshot.items,
        total: math.itemsSubtotal,
        currency: math.currency,
        filter,
        onFilter: setFilter,
      })}
      {mode.kind === 'editing' && mode.editor}
      {slots.itemList({
        items: snapshot.items,
        participants: snapshot.participants,
        activeId: you?.id ?? null,
        editing: mode.kind === 'editing',
        currency: math.currency,
        filter,
        onClaim: (itemId, participantId) => store.toggleClaim(itemId, participantId),
        onClaimAll: (itemId, participants, claimed) =>
          store.setClaims(
            itemId,
            participants.map((person) => person.id),
            claimed,
          ),
        onUpdate: (itemId, field, value) => store.updateItem(itemId, field, value),
        onDelete: (itemId) => store.deleteItem(itemId),
      })}
    </div>
  );
}
