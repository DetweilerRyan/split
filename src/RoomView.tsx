import { useRouter } from 'next/navigation';
import { type ComponentProps, type ComponentType, useState } from 'react';
import { EditReceiptDrawer } from './components/EditReceiptDrawer';
import { Header } from './components/Header';
import { IdentityModal } from './components/IdentityModal';
import { ItemList } from './components/ItemList';
import { ParticipantCards } from './components/ParticipantCards';
import { ReceiptSummary } from './components/ReceiptSummary';
import { RestaurantModal } from './components/RestaurantModal';
import { SeedModal } from './components/SeedModal';
import { ShareModal } from './components/ShareModal';
import { Toast, ToastContext } from './components/Toast';
import { UnclaimedBanner } from './components/UnclaimedBanner';
import { useExchangeRate } from './hooks/useExchangeRate';
import { useIdentity } from './hooks/useIdentity';
import { useRoomProvider } from './hooks/useRoomProvider';
import { useSeedImport } from './hooks/useSeedImport';
import { useSharing } from './hooks/useSharing';
import { useToast } from './hooks/useToast';
import { computeReceiptMath } from './domain/receipt/math';
import type { RoomId } from './domain/room/roomId';
import { getExchangeRate } from './services/exchangeRates';
import { useReceiptStore } from './sync/useReceiptStore';
import type { RoomProvider } from './sync/yjsProvider';

type ItemFilter = 'all' | 'unclaimed' | 'mine';

/** The components a room is built from. A test passes fakes, to check only how the room wires them. */
export interface RoomParts {
  readonly Header: ComponentType<ComponentProps<typeof Header>>;
  readonly UnclaimedBanner: ComponentType<ComponentProps<typeof UnclaimedBanner>>;
  readonly EditReceiptDrawer: ComponentType<ComponentProps<typeof EditReceiptDrawer>>;
  readonly ItemList: ComponentType<ComponentProps<typeof ItemList>>;
  readonly ReceiptSummary: ComponentType<ComponentProps<typeof ReceiptSummary>>;
  readonly ParticipantCards: ComponentType<ComponentProps<typeof ParticipantCards>>;
  readonly IdentityModal: ComponentType<ComponentProps<typeof IdentityModal>>;
  readonly RestaurantModal: ComponentType<ComponentProps<typeof RestaurantModal>>;
  readonly ShareModal: ComponentType<ComponentProps<typeof ShareModal>>;
  readonly SeedModal: ComponentType<ComponentProps<typeof SeedModal>>;
  readonly Toast: ComponentType;
}

const roomParts: RoomParts = {
  Header,
  UnclaimedBanner,
  EditReceiptDrawer,
  ItemList,
  ReceiptSummary,
  ParticipantCards,
  IdentityModal,
  RestaurantModal,
  ShareModal,
  SeedModal,
  Toast,
};

interface RoomViewProps {
  readonly roomId: RoomId;
  /** The room's document, store and presence. Pass the same one on every render. */
  readonly provider: RoomProvider;
  /** Goes to another page of the app, such as a new room. */
  readonly navigate: (path: string) => void;
  readonly parts?: RoomParts;
}

/** A receipt room: its header, items and totals, and the dialogs they open. */
export function RoomView({ roomId, provider, navigate, parts = roomParts }: RoomViewProps) {
  const [editing, setEditing] = useState(false);
  const [filter, setFilter] = useState<ItemFilter>('all');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { store } = provider;
  const snapshot = useReceiptStore(store);
  const math = computeReceiptMath(snapshot);
  const toast = useToast();
  const identity = useIdentity(provider, roomId, snapshot.participants, toast.showToast);
  const sharing = useSharing(roomId, snapshot, navigator.clipboard, toast.showToast);
  const seed = useSeedImport(provider.doc, toast.showToast, navigate);
  const rates = useExchangeRate(store, snapshot, getExchangeRate, toast.showToast);
  const dialogOpen = [identity.pickerOpen, detailsOpen, sharing.open, seed.open].some(Boolean);
  const { Header, UnclaimedBanner, EditReceiptDrawer, ItemList, ReceiptSummary } = parts;
  const { ParticipantCards, IdentityModal, RestaurantModal, ShareModal, SeedModal, Toast } = parts;

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
              onDisplayCurrency={rates.changeDisplayCurrency}
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
          <ReceiptSummary snapshot={snapshot} onCopySummary={sharing.copySummary} />
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

/** The room at `roomId`, once its provider has loaded; it suspends until then. */
export default function LoadedRoomView({ roomId }: { readonly roomId: RoomId }) {
  const router = useRouter();
  const provider = useRoomProvider(roomId);
  return <RoomView roomId={roomId} provider={provider} navigate={(path) => router.push(path)} />;
}
