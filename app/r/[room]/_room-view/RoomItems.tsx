import { type ReactNode, useState } from 'react';
import { ItemList } from './_item-list/ItemList';
import { UnclaimedBanner } from './UnclaimedBanner';
import { computeReceiptMath } from '@/domain/receipt/math';
import type {
  ItemId,
  ParticipantId,
  Participant,
  RoomSnapshot,
} from '@/domain/receipt/roomSnapshot';
import { useReceiptStore } from '@/sync/useReceiptStore';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

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
};

/** The room's items: how much is still unclaimed, the filter, and the items to claim or edit. */
export function RoomItems({ store, you, mode }: RoomItemsProps) {
  const [filter, setFilter] = useState<ItemFilter>('all');
  const snapshot = useReceiptStore(store);
  const math = computeReceiptMath(snapshot);
  return (
    <div className="space-y-3">
      <UnclaimedBanner
        items={snapshot.items}
        total={math.itemsSubtotal}
        currency={math.currency}
        filter={filter}
        onFilter={setFilter}
      />
      {mode.kind === 'editing' && mode.editor}
      <ItemList
        items={snapshot.items}
        participants={snapshot.participants}
        activeId={you?.id ?? null}
        editing={mode.kind === 'editing'}
        currency={math.currency}
        filter={filter}
        onClaim={(itemId, participantId) => store.toggleClaim(itemId, participantId)}
        onClaimAll={(itemId, participants, claimed) =>
          store.setClaims(
            itemId,
            participants.map((person) => person.id),
            claimed,
          )
        }
        onUpdate={(itemId, field, value) => store.updateItem(itemId, field, value)}
        onDelete={(itemId) => store.deleteItem(itemId)}
      />
    </div>
  );
}
