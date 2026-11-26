import { type ComponentType, useState } from 'react';
import { ToastContext } from './Toast';
import { type FetchRate, useExchangeRate } from './useExchangeRate';
import { useIdentity } from './useIdentity';
import { useSeedImport } from './useSeedImport';
import { type CopyTarget, useSharing } from './useSharing';
import { useToast } from './useToast';
import { type ReceiptMath, computeReceiptMath } from '@/domain/receipt/math';
import type { ReceiptSeed } from '@/domain/receipt/receiptSeed';
import type {
  ItemId,
  Participant,
  ParticipantId,
  ReceiptItem,
  RoomSnapshot,
} from '@/domain/receipt/roomSnapshot';
import type { RoomId } from '@/domain/room/roomId';
import { useReceiptStore } from '@/sync/useReceiptStore';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

/**
 * The components a room renders, in its own terms: each takes only the props the room passes. Its
 * composition root passes the real ones; a test passes fakes, to check only how the room wires them.
 */
export type RoomSlots = {
  readonly Header: ComponentType<{
    readonly title: string;
    readonly purchasedAt: string;
    readonly mealType: string;
    readonly onDetails: () => void;
    readonly activeId: ParticipantId | null;
    readonly connection: RoomSnapshot['connection'];
    readonly peers: RoomSnapshot['peers'];
    readonly participants: readonly Participant[];
    readonly editing: boolean;
    readonly onIdentity: () => void;
    readonly onEdit: () => void;
    readonly onShare: () => void;
  }>;
  readonly UnclaimedBanner: ComponentType<{
    readonly items: readonly ReceiptItem[];
    readonly total: number;
    readonly currency: string;
    readonly filter: ItemFilter;
    readonly onFilter: (filter: ItemFilter) => void;
  }>;
  readonly EditReceiptDrawer: ComponentType<{
    readonly snapshot: RoomSnapshot;
    readonly onMeta: (
      key: 'title' | 'cardTipEur' | 'cashTipEur' | 'bankUsd',
      value: string | number,
    ) => void;
    readonly onCurrency: (code: string) => void;
    readonly onDisplayCurrency: (code: string, force?: boolean) => void;
    readonly onRate: (rate: number) => void;
    readonly onAddItem: (name: string, en: string, eur: number) => void;
  }>;
  readonly ItemList: ComponentType<{
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
  }>;
  readonly ReceiptSummary: ComponentType<{
    readonly snapshot: RoomSnapshot;
    readonly math: ReceiptMath;
    readonly onCopySummary: () => void;
  }>;
  readonly ParticipantCards: ComponentType<{ readonly snapshot: RoomSnapshot }>;
  readonly IdentityModal: ComponentType<{
    readonly open: boolean;
    readonly participants: readonly Participant[];
    readonly activeId: ParticipantId | null;
    readonly onClose: () => void;
    readonly onSelect: (id: ParticipantId) => void;
    readonly onAdd: (name: string) => void;
    readonly onRemove: (id: ParticipantId) => void;
  }>;
  readonly RestaurantModal: ComponentType<{
    readonly open: boolean;
    readonly snapshot: RoomSnapshot;
    readonly roomId: RoomId;
    readonly onClose: () => void;
  }>;
  readonly ShareModal: ComponentType<{
    readonly open: boolean;
    readonly url: string;
    readonly onClose: () => void;
    readonly onCopy: () => void;
  }>;
  readonly SeedModal: ComponentType<{
    readonly open: boolean;
    readonly onClose: () => void;
    readonly onImport: (seed: ReceiptSeed, forceReset: boolean) => void;
    readonly onPreset: (seed: ReceiptSeed) => void;
    readonly onBlankRoom: () => void;
  }>;
  /** Shows the message in `ToastContext`, which the room provides. */
  readonly Toast: ComponentType;
};

/** The receipt store the room reads and changes, in its own terms, with what its hooks need of it. */
export type RoomStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => RoomSnapshot;
  readonly setMeta: (
    key:
      | 'title'
      | 'cardTipEur'
      | 'cashTipEur'
      | 'bankUsd'
      | 'currency'
      | 'displayCurrency'
      | 'rate'
      | 'rateDate',
    value: string | number,
  ) => void;
  readonly setExchangeRate: (displayCurrency: string, rate: number, rateDate: string) => void;
  readonly addParticipant: (name: string) => Participant | null;
  readonly removeParticipant: (id: ParticipantId) => void;
  readonly toggleClaim: (itemId: ItemId, participantId: ParticipantId) => void;
  readonly setClaims: (
    itemId: ItemId,
    participantIds: readonly ParticipantId[],
    selected: boolean,
  ) => void;
  readonly updateItem: (id: ItemId, field: 'name' | 'en' | 'eur', value: string | number) => void;
  readonly addItem: (name: string, en: string, eur: number) => void;
  readonly deleteItem: (id: ItemId) => void;
  readonly hydrateSeed: (seed: ReceiptSeed, options?: { readonly forceReset?: boolean }) => void;
};

/** The room's store, and who you are to its peers, in the room's own terms. */
export type RoomConnection = {
  readonly store: RoomStore;
  readonly setIdentity: (
    identity: {
      readonly id: ParticipantId;
      readonly name: string;
      readonly colorIdx: number;
    } | null,
  ) => void;
};

/** What the room reaches outside itself for. Its composition root passes the real ones. */
export type RoomServices = {
  /** Where the room's link and summary are copied to. */
  readonly clipboard: CopyTarget;
  /** Gets the rate to the currency the receipt is shown in. */
  readonly fetchRate: FetchRate;
  /** How long a toast stays up, in milliseconds. */
  readonly toastMs: number;
};

type RoomViewProps = {
  readonly roomId: RoomId;
  /** The room's store and presence. Pass the same one on every render. */
  readonly provider: RoomConnection;
  /** Goes to another page of the app, such as a new room. */
  readonly navigate: (path: string) => void;
  readonly slots: RoomSlots;
  readonly services: RoomServices;
};

/** A receipt room: its header, items and totals, and the dialogs they open. */
// oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- `slots` are React's `ComponentType`, whose class-component form has mutable fields, such as `contextType`, that a slot's type can't make readonly.
export function RoomView({ roomId, provider, navigate, slots, services }: RoomViewProps) {
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { store } = provider;
  const snapshot = useReceiptStore(store);
  const math = computeReceiptMath(snapshot);
  const toast = useToast(services.toastMs);
  const identity = useIdentity(provider, roomId, snapshot.participants, toast.showToast);
  const sharing = useSharing(roomId, snapshot, services.clipboard, toast.showToast);
  const seed = useSeedImport(store, toast.showToast, navigate);
  const rates = useExchangeRate(store, snapshot, services.fetchRate, toast.showToast);
  const dialogOpen = [identity.pickerOpen, detailsOpen, sharing.open, seed.open].some(Boolean);
  const { Header, UnclaimedBanner, EditReceiptDrawer, ItemList, ReceiptSummary } = slots;
  const { ParticipantCards, IdentityModal, RestaurantModal, ShareModal, SeedModal, Toast } = slots;

  return (
    <div className="min-h-screen pb-12">
      <Header
        title={snapshot.title}
        purchasedAt={snapshot.purchasedAt}
        mealType={snapshot.mealType}
        onDetails={() => setDetailsOpen(true)}
        activeId={identity.activeId}
        connection={snapshot.connection}
        peers={snapshot.peers}
        participants={snapshot.participants}
        editing={editing}
        onIdentity={identity.openPicker}
        onEdit={() => setEditing((value) => !value)}
        onShare={sharing.openDialog}
      />
      <UnclaimedBanner
        items={snapshot.items}
        total={math.itemsSubtotal}
        currency={math.currency}
        filter={filter}
        onFilter={setFilter}
      />
      <main className="mx-auto grid max-w-6xl gap-4 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        <div className="space-y-4">
          {editing && (
            <EditReceiptDrawer
              snapshot={snapshot}
              onMeta={(key, value) => store.setMeta(key, value)}
              onCurrency={rates.changeCurrency}
              onDisplayCurrency={(code, force) => void rates.changeDisplayCurrency(code, force)}
              onRate={rates.setRate}
              onAddItem={(name, en, eur) => store.addItem(name, en, eur)}
            />
          )}
          <ItemList
            items={snapshot.items}
            participants={snapshot.participants}
            activeId={identity.activeId}
            editing={editing}
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
        <aside className="space-y-4">
          <ReceiptSummary snapshot={snapshot} math={math} onCopySummary={sharing.copySummary} />
          <ParticipantCards snapshot={snapshot} />
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-extrabold">Receipt seed</h2>
              <button className="button-secondary" onClick={seed.openDialog}>
                Seed / presets
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Data persists on this device and syncs with room peers.
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {snapshot.participants.length} people · {snapshot.items.length} items
            </p>
          </section>
        </aside>
      </main>
      <ToastContext value={toast.message}>
        <IdentityModal
          open={identity.pickerOpen}
          participants={snapshot.participants}
          activeId={identity.activeId}
          onClose={identity.closePicker}
          onSelect={identity.choose}
          onAdd={identity.add}
          onRemove={identity.remove}
        />
        <RestaurantModal
          open={detailsOpen}
          snapshot={snapshot}
          roomId={roomId}
          onClose={() => setDetailsOpen(false)}
        />
        <ShareModal
          open={sharing.open}
          url={sharing.url}
          onClose={sharing.closeDialog}
          onCopy={sharing.copyLink}
        />
        <SeedModal
          open={seed.open}
          onClose={seed.closeDialog}
          onImport={seed.importSeed}
          onPreset={seed.loadPreset}
          onBlankRoom={seed.newBlankRoom}
        />
        {!dialogOpen && <Toast />}
      </ToastContext>
      {Object.keys(math.perPerson).length === 0 && (
        <div className="sr-only">No participants yet.</div>
      )}
    </div>
  );
}
