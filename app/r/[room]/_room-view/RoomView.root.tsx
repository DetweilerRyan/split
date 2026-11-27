import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppBar } from './_app-bar/AppBar';
import { IdentityModal } from './IdentityModal';
import { ItemList } from './_item-list/ItemList';
import { ParticipantCards } from './ParticipantCards';
import { ReceiptEditor } from './ReceiptEditor';
import { ReceiptSummary } from './ReceiptSummary';
import { RestaurantModal } from './RestaurantModal';
import { type ItemsSlots, type ItemsStore, RoomItems } from './RoomItems';
import { type RoomServices, type RoomSlots, RoomView } from './RoomView';
import { SeedCard } from './SeedCard';
import { SeedModal } from './SeedModal';
import { ShareModal } from './ShareModal';
import { Toast } from './Toast';
import { UnclaimedBanner } from './UnclaimedBanner';
import { useRoomProvider } from './useRoomProvider';
import { TOAST_MS } from './useToast';
import type { RoomId } from '@/domain/room/roomId';
import { getExchangeRate } from '@/services/exchangeRates';

/** The real components the room's items render. They need nothing of the room, so they're fixed. */
const itemsSlots: ItemsSlots = {
  claimProgress: (props) => <UnclaimedBanner {...props} />,
  itemList: (props) => <ItemList {...props} />,
};

/**
 * Renders the real components into `RoomView`'s slots. TypeScript checks here that each
 * component accepts what its slot passes; contract tests check it uses them. What a component
 * needs that the room doesn't compute is added here, so `RoomView` never sees it: the
 * restaurant dialog's `roomId`, the store the items and the editor read and change, and the
 * editor's exchange-rate service.
 */
function roomSlots(
  roomId: RoomId,
  store: ItemsStore & Parameters<typeof ReceiptEditor>[0]['store'],
): RoomSlots {
  return {
    appBar: (props) => <AppBar {...props} />,
    items: (props) => <RoomItems {...props} store={store} slots={itemsSlots} />,
    editor: (props) => <ReceiptEditor {...props} store={store} fetchRate={getExchangeRate} />,
    summary: (props) => <ReceiptSummary {...props} />,
    people: (props) => <ParticipantCards {...props} />,
    seedCard: (props) => <SeedCard {...props} />,
    identityModal: (props) => <IdentityModal {...props} />,
    restaurantModal: (props) => <RestaurantModal {...props} roomId={roomId} />,
    shareModal: (props) => <ShareModal {...props} />,
    seedModal: (props) => <SeedModal {...props} />,
    toast: <Toast />,
  };
}

function browserServices(navigate: (path: string) => void): RoomServices {
  return {
    clipboard: navigator.clipboard,
    navigate,
    toastMs: TOAST_MS,
  };
}

/**
 * The room at `roomId`, once its provider has loaded; it suspends until then. It's
 * `RoomView`'s composition root: it passes in the real provider, slots and services.
 */
export default function RoomViewRoot({ roomId }: { readonly roomId: RoomId }) {
  const router = useRouter();
  const provider = useRoomProvider(roomId);
  const [services] = useState(() => browserServices((path) => router.push(path)));
  return (
    <RoomView
      roomId={roomId}
      provider={provider}
      slots={roomSlots(roomId, provider.store)}
      services={services}
    />
  );
}
