import { type ReactNode, useState } from 'react';
import { ToastContext } from './Toast';
import { useIdentity } from './useIdentity';
import { useSeedImport } from './useSeedImport';
import { type CopyTarget, useSharing } from './useSharing';
import { useToast } from './useToast';
import type { ReceiptSeed } from '@/domain/receipt/receiptSeed';
import type { Participant, ParticipantId, RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import type { RoomId } from '@/domain/room/roomId';
import { useReceiptStore } from '@/sync/useReceiptStore';

/** What a dialog's slot is given; its dialog also shows the toast, which the page hides meanwhile. */
type DialogProps = { readonly onClose: () => void };

/**
 * What a room renders, in its own terms: each slot is a render function given only the props the
 * room computes, or an element it only shows. Its composition root renders the real components from
 * them, adding any props of its own; a test renders fakes, to check only how the room wires them.
 */
export type RoomSlots = {
  /** The bar: the receipt, who you are, and the details, identity, edit and share actions. */
  readonly appBar: (props: {
    /** Where the bar sits: it sticks to the top of the page. */
    readonly className: string;
    readonly title: string;
    readonly purchasedAt: string;
    readonly mealType: string;
    readonly connection: RoomSnapshot['connection'];
    readonly peers: RoomSnapshot['peers'];
    readonly you: Participant | null;
    readonly editing: boolean;
    readonly onDetails: () => void;
    readonly onIdentity: () => void;
    readonly onEdit: () => void;
    readonly onShare: () => void;
  }) => ReactNode;
  /** The receipt's items: how much is unclaimed, and the items to claim, or to edit while editing. */
  readonly items: (props: {
    readonly you: Participant | null;
    /** Claiming, or editing with the editor shown between the items' progress and their list. */
    readonly mode:
      | { readonly kind: 'claiming' }
      | { readonly kind: 'editing'; readonly editor: ReactNode };
  }) => ReactNode;
  /** Editing the receipt's details, currencies and new items, shown while editing. */
  readonly editor: (props: { readonly notify: (message: string) => void }) => ReactNode;
  /** The receipt's totals. */
  readonly summary: (props: {
    readonly snapshot: RoomSnapshot;
    readonly onCopySummary: () => void;
  }) => ReactNode;
  /** What each person pays. */
  readonly people: (props: { readonly snapshot: RoomSnapshot }) => ReactNode;
  /** The card that opens the seed dialog. */
  readonly seedCard: (props: {
    readonly participantCount: number;
    readonly itemCount: number;
    readonly onOpen: () => void;
  }) => ReactNode;
  readonly identityModal: (
    props: DialogProps & {
      readonly open: boolean;
      readonly participants: readonly Participant[];
      readonly activeId: ParticipantId | null;
      readonly onSelect: (id: ParticipantId) => void;
      readonly onAdd: (name: string) => void;
      readonly onRemove: (id: ParticipantId) => void;
    },
  ) => ReactNode;
  readonly restaurantModal: (
    props: DialogProps & {
      readonly open: boolean;
      readonly snapshot: RoomSnapshot;
    },
  ) => ReactNode;
  readonly shareModal: (
    props: DialogProps & {
      readonly open: boolean;
      readonly url: string;
      readonly onCopy: () => void;
    },
  ) => ReactNode;
  readonly seedModal: (
    props: DialogProps & {
      readonly open: boolean;
      readonly onImport: (seed: ReceiptSeed, forceReset: boolean) => void;
      readonly onPreset: (seed: ReceiptSeed) => void;
      readonly onBlankRoom: () => void;
    },
  ) => ReactNode;
  /** Shows the message in `ToastContext`, which the room provides, while no dialog is open. */
  readonly toast: ReactNode;
};

/** The receipt store the room reads, and what its hooks need of it, in its own terms. */
export type RoomStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => RoomSnapshot;
  readonly addParticipant: (name: string) => Participant | null;
  readonly removeParticipant: (id: ParticipantId) => void;
  readonly hydrateSeed: (
    seed: ReceiptSeed,
    options?: { readonly forceReset?: boolean | undefined },
  ) => void;
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
  /** Goes to another page of the app, such as a new room. */
  readonly navigate: (path: string) => void;
};

type RoomViewProps = {
  readonly roomId: RoomId;
  /** The room's store and presence. Pass the same one on every render. */
  readonly provider: RoomConnection;
  readonly slots: RoomSlots;
  readonly services: RoomServices;
};

/**
 * A receipt room: its bar, items and totals, and the dialogs they open. It lays its slots out, and
 * holds what crosses them: who you are, whether you're editing, which dialog is open, and the toast.
 */
export function RoomView({ roomId, provider, slots, services }: RoomViewProps) {
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { store } = provider;
  const snapshot = useReceiptStore(store);
  const toast = useToast();
  const identity = useIdentity(provider, roomId, snapshot.participants, toast.showToast);
  const sharing = useSharing(roomId, snapshot, services.clipboard, toast.showToast);
  const seed = useSeedImport(store, toast.showToast, services.navigate);
  const dialogOpen = [identity.pickerOpen, detailsOpen, sharing.open, seed.open].some(Boolean);

  return (
    <div className="min-h-screen pb-12">
      {slots.appBar({
        title: snapshot.title,
        purchasedAt: snapshot.purchasedAt,
        mealType: snapshot.mealType,
        connection: snapshot.connection,
        peers: snapshot.peers,
        you: identity.you,
        editing,
        onDetails: () => setDetailsOpen(true),
        onIdentity: identity.openPicker,
        onEdit: () => setEditing((value) => !value),
        onShare: sharing.openDialog,
        className: 'sticky top-0 z-20',
      })}
      <main className="page-column mt-3 grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        {slots.items({
          you: identity.you,
          mode: editing
            ? { kind: 'editing', editor: slots.editor({ notify: toast.showToast }) }
            : { kind: 'claiming' },
        })}
        <aside className="space-y-4">
          {slots.summary({ snapshot, onCopySummary: sharing.copySummary })}
          {slots.people({ snapshot })}
          {slots.seedCard({
            participantCount: snapshot.participants.length,
            itemCount: snapshot.items.length,
            onOpen: seed.openDialog,
          })}
        </aside>
      </main>
      <ToastContext value={toast.message}>
        {slots.identityModal({
          open: identity.pickerOpen,
          participants: snapshot.participants,
          activeId: identity.activeId,
          onClose: identity.closePicker,
          onSelect: identity.choose,
          onAdd: identity.add,
          onRemove: identity.remove,
        })}
        {slots.restaurantModal({
          open: detailsOpen,
          snapshot,
          onClose: () => setDetailsOpen(false),
        })}
        {slots.shareModal({
          open: sharing.open,
          url: sharing.url,
          onClose: sharing.closeDialog,
          onCopy: sharing.copyLink,
        })}
        {slots.seedModal({
          open: seed.open,
          onClose: seed.closeDialog,
          onImport: seed.importSeed,
          onPreset: seed.loadPreset,
          onBlankRoom: seed.newBlankRoom,
        })}
        {!dialogOpen && slots.toast}
      </ToastContext>
    </div>
  );
}
