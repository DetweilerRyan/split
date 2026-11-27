import { type ReactNode, useState } from 'react';
import { ToastContext } from './Toast';
import { useIdentity } from './useIdentity';
import { useSeedImport } from './useSeedImport';
import { type CopyTarget, useSharing } from './useSharing';
import { useToast } from './useToast';
import { computeReceiptMath } from '@/domain/receipt/math';
import type { ReceiptSeed } from '@/domain/receipt/receiptSeed';
import type { Participant, ParticipantId, RoomSnapshot } from '@/domain/receipt/roomSnapshot';
import type { RoomId } from '@/domain/room/roomId';
import { useReceiptStore } from '@/sync/useReceiptStore';

/** Where a slot sits in the room's layout: Tailwind classes its component merges with its own. */
type Placed = { readonly className?: string | undefined };

/**
 * What a room renders, in its own terms: each slot is a render function given only the props the
 * room computes, and a slot in the page's flow is given where it sits. Its composition root renders
 * the real components from them, adding any props of its own; a test renders fakes, to check only
 * how the room wires them.
 */
export type RoomSlots = {
  /** The bar: the receipt, who you are, and the details, identity, edit and share actions. */
  readonly appBar: (
    props: Placed & {
      readonly snapshot: RoomSnapshot;
      readonly you: Participant | null;
      readonly editing: boolean;
      readonly onDetails: () => void;
      readonly onIdentity: () => void;
      readonly onEdit: () => void;
      readonly onShare: () => void;
    },
  ) => ReactNode;
  /** The receipt's items: how much is unclaimed, and the items to claim, or to edit while editing. */
  readonly items: (
    props: Placed & {
      readonly you: Participant | null;
      readonly editing: boolean;
      /** The editor, shown between the items' progress and their list while editing. */
      readonly editor: ReactNode;
    },
  ) => ReactNode;
  /** Editing the receipt's details, currencies and new items, shown while editing. */
  readonly editor: (props: Placed & { readonly notify: (message: string) => void }) => ReactNode;
  /** The receipt's totals. */
  readonly summary: (
    props: Placed & { readonly snapshot: RoomSnapshot; readonly onCopySummary: () => void },
  ) => ReactNode;
  /** What each person pays. */
  readonly people: (props: Placed & { readonly snapshot: RoomSnapshot }) => ReactNode;
  /** The card that opens the seed dialog. */
  readonly seedCard: (
    props: Placed & { readonly snapshot: RoomSnapshot; readonly onOpen: () => void },
  ) => ReactNode;
  readonly identityModal: (props: {
    readonly open: boolean;
    readonly participants: readonly Participant[];
    readonly activeId: ParticipantId | null;
    readonly onClose: () => void;
    readonly onSelect: (id: ParticipantId) => void;
    readonly onAdd: (name: string) => void;
    readonly onRemove: (id: ParticipantId) => void;
  }) => ReactNode;
  readonly restaurantModal: (props: {
    readonly open: boolean;
    readonly snapshot: RoomSnapshot;
    readonly onClose: () => void;
  }) => ReactNode;
  readonly shareModal: (props: {
    readonly open: boolean;
    readonly url: string;
    readonly onClose: () => void;
    readonly onCopy: () => void;
  }) => ReactNode;
  readonly seedModal: (props: {
    readonly open: boolean;
    readonly onClose: () => void;
    readonly onImport: (seed: ReceiptSeed, forceReset: boolean) => void;
    readonly onPreset: (seed: ReceiptSeed) => void;
    readonly onBlankRoom: () => void;
  }) => ReactNode;
  /** Shows the message in `ToastContext`, which the room provides. */
  readonly toast: () => ReactNode;
};

/** The receipt store the room reads, and what its hooks need of it, in its own terms. */
export type RoomStore = {
  readonly subscribe: (listener: () => void) => () => void;
  readonly getSnapshot: () => RoomSnapshot;
  readonly addParticipant: (name: string) => Participant | null;
  readonly removeParticipant: (id: ParticipantId) => void;
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
  /** How long a toast stays up, in milliseconds. */
  readonly toastMs: number;
};

type RoomViewRootProps = {
  readonly roomId: RoomId;
  /** The room's store and presence. Pass the same one on every render. */
  readonly provider: RoomConnection;
  /** Goes to another page of the app, such as a new room. */
  readonly navigate: (path: string) => void;
  readonly slots: RoomSlots;
  readonly services: RoomServices;
};

/**
 * A receipt room: its bar, items and totals, and the dialogs they open. It lays its slots out, and
 * holds what crosses them: who you are, whether you're editing, which dialog is open, and the toast.
 */
export function RoomViewRoot({ roomId, provider, navigate, slots, services }: RoomViewRootProps) {
  const [editing, setEditing] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { store } = provider;
  const snapshot = useReceiptStore(store);
  const math = computeReceiptMath(snapshot);
  const toast = useToast(services.toastMs);
  const identity = useIdentity(provider, roomId, snapshot.participants, toast.showToast);
  const sharing = useSharing(roomId, snapshot, services.clipboard, toast.showToast);
  const seed = useSeedImport(store, toast.showToast, navigate);
  const dialogOpen = [identity.pickerOpen, detailsOpen, sharing.open, seed.open].some(Boolean);

  return (
    <div className="min-h-screen pb-12">
      {slots.appBar({
        snapshot,
        you: identity.you,
        editing,
        onDetails: () => setDetailsOpen(true),
        onIdentity: identity.openPicker,
        onEdit: () => setEditing((value) => !value),
        onShare: sharing.openDialog,
        className: 'sticky top-0 z-20',
      })}
      <main className="mx-auto mt-3 grid max-w-6xl gap-4 px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.8fr)]">
        {slots.items({
          you: identity.you,
          editing,
          editor: editing && slots.editor({ notify: toast.showToast }),
        })}
        <aside className="space-y-4">
          {slots.summary({ snapshot, onCopySummary: sharing.copySummary })}
          {slots.people({ snapshot })}
          {slots.seedCard({ snapshot, onOpen: seed.openDialog })}
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
        {!dialogOpen && slots.toast()}
      </ToastContext>
      {Object.keys(math.perPerson).length === 0 && (
        <div className="sr-only">No participants yet.</div>
      )}
    </div>
  );
}
