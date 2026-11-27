import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EditReceiptDrawer } from './EditReceiptDrawer';
import { Header } from './_header/Header';
import { IdentityModal } from './IdentityModal';
import { ItemList } from './_item-list/ItemList';
import { ParticipantCards } from './ParticipantCards';
import { ReceiptSummary } from './ReceiptSummary';
import { RestaurantModal } from './RestaurantModal';
import { type RoomServices, type RoomSlots, RoomViewRoot } from './RoomViewRoot';
import { SeedModal } from './SeedModal';
import { ShareModal } from './ShareModal';
import { Toast } from './Toast';
import { UnclaimedBanner } from './UnclaimedBanner';
import { useRoomProvider } from './useRoomProvider';
import { TOAST_MS } from './useToast';
import type { RoomId } from '@/domain/room/roomId';
import { getExchangeRate } from '@/services/exchangeRates';

/**
 * Renders the real components into `RoomViewRoot`'s slots. TypeScript checks each component's props
 * against what its slot passes, here. A component's props that the room doesn't compute, such as the
 * restaurant dialog's `roomId`, are added here, so `RoomViewRoot` never sees them.
 */
function roomSlots(roomId: RoomId): RoomSlots {
  return {
    header: (props) => <Header {...props} />,
    unclaimedBanner: (props) => <UnclaimedBanner {...props} />,
    editReceiptDrawer: (props) => <EditReceiptDrawer {...props} />,
    itemList: (props) => <ItemList {...props} />,
    receiptSummary: (props) => <ReceiptSummary {...props} />,
    participantCards: (props) => <ParticipantCards {...props} />,
    identityModal: (props) => <IdentityModal {...props} />,
    restaurantModal: (props) => <RestaurantModal {...props} roomId={roomId} />,
    shareModal: (props) => <ShareModal {...props} />,
    seedModal: (props) => <SeedModal {...props} />,
    toast: () => <Toast />,
  };
}

function browserServices(): RoomServices {
  return { clipboard: navigator.clipboard, fetchRate: getExchangeRate, toastMs: TOAST_MS };
}

/**
 * The room at `roomId`, once its provider has loaded; it suspends until then. It's
 * `RoomViewRoot`'s composition root: it passes in the real provider, slots and services.
 */
export default function RoomView({ roomId }: { readonly roomId: RoomId }) {
  const router = useRouter();
  const provider = useRoomProvider(roomId);
  const [services] = useState(browserServices);
  return (
    <RoomViewRoot
      roomId={roomId}
      provider={provider}
      navigate={(path) => router.push(path)}
      slots={roomSlots(roomId)}
      services={services}
    />
  );
}
