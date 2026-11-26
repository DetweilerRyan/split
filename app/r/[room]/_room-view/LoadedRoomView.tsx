import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EditReceiptDrawer } from './EditReceiptDrawer';
import { Header } from './_header/Header';
import { IdentityModal } from './IdentityModal';
import { ItemList } from './_item-list/ItemList';
import { ParticipantCards } from './ParticipantCards';
import { ReceiptSummary } from './ReceiptSummary';
import { RestaurantModal } from './RestaurantModal';
import { type RoomServices, type RoomSlots, RoomView } from './RoomView';
import { SeedModal } from './SeedModal';
import { ShareModal } from './ShareModal';
import { Toast } from './Toast';
import { UnclaimedBanner } from './UnclaimedBanner';
import { useRoomProvider } from './useRoomProvider';
import { TOAST_MS } from './useToast';
import type { RoomId } from '@/domain/room/roomId';
import { getExchangeRate } from '@/services/exchangeRates';

/** The real components the room renders. TypeScript checks each against `RoomView`'s slots here. */
const roomSlots: RoomSlots = {
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

function browserServices(): RoomServices {
  return { clipboard: navigator.clipboard, fetchRate: getExchangeRate, toastMs: TOAST_MS };
}

/**
 * The room at `roomId`, once its provider has loaded; it suspends until then. It's `RoomView`'s
 * composition root: it passes in the real provider, components and services.
 */
export default function LoadedRoomView({ roomId }: { readonly roomId: RoomId }) {
  const router = useRouter();
  const provider = useRoomProvider(roomId);
  const [services] = useState(browserServices);
  return (
    <RoomView
      roomId={roomId}
      provider={provider}
      navigate={(path) => router.push(path)}
      slots={roomSlots}
      services={services}
    />
  );
}
