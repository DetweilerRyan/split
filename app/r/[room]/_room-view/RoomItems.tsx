import { type ReactNode, useState } from 'react';
import { computeReceiptMath } from '@/domain/receipt/math';
import type {
  ItemId,
  Participant,
  ParticipantId,
  ReceiptItem,
  RoomSnapshot,
} from '@/domain/receipt/roomSnapshot';
import { mergeClasses } from '@/utils/mergeClasses';
import { useReceiptStore } from '@/sync/useReceiptStore';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

/** Where a slot sits in the items' layout: Tailwind classes its component merges with its own. */
type Placed = { readonly className?: string | undefined };

/**
 * What the room's items render, in their own terms: each slot is a render function given only the
 * props the items compute. Their composition root renders the real components from them; a test
 * renders fakes, to check only how the items wire them.
 */
export type ItemsSlots = {
  /** How much is still unclaimed, and the filter that chooses which items show. */
  readonly claimProgress: (
    props: Placed & {
      readonly items: readonly ReceiptItem[];
      readonly total: number;
      readonly currency: string;
      readonly filter: ItemFilter;
      readonly onFilter: (filter: ItemFilter) => void;
    },
  ) => ReactNode;
  /** The items, to claim, or to edit while editing. */
  readonly itemList: (
    props: Placed & {
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
    },
  ) => ReactNode;
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

type RoomItemsProps = {
  /** The room's receipt. Pass the same one on every render. */
  readonly store: ItemsStore;
  /** Who you are in the room, whose claims a tap makes, or `null` before you choose. */
  readonly you: Participant | null;
  readonly editing: boolean;
  /** What shows between the progress and the list while editing, such as the receipt's editor. */
  readonly editor?: ReactNode;
  readonly slots: ItemsSlots;
  /** Where the caller places them; merged with their own classes. */
  readonly className?: string | undefined;
};

/** The room's items: how much is still unclaimed, the filter, and the items to claim or edit. */
export function RoomItems({ store, you, editing, editor, slots, className }: RoomItemsProps) {
  const [filter, setFilter] = useState<ItemFilter>('all');
  const snapshot = useReceiptStore(store);
  const math = computeReceiptMath(snapshot);
  return (
    <div className={mergeClasses('space-y-3', className)}>
      {slots.claimProgress({
        items: snapshot.items,
        total: math.itemsSubtotal,
        currency: math.currency,
        filter,
        onFilter: setFilter,
      })}
      {editor}
      {slots.itemList({
        items: snapshot.items,
        participants: snapshot.participants,
        activeId: you?.id ?? null,
        editing,
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
