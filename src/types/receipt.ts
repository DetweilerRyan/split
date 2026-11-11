export interface ReceiptItem {
  id: string;
  name: string;
  en: string;
  eur: number;
  order: number;
  claims: Readonly<Record<string, boolean>>;
}

export interface Participant {
  id: string;
  name: string;
  colorIdx: number;
}

export type { ReceiptSeed } from './seedSchema';

export interface RoomSnapshot {
  title: string;
  cardTipEur: number;
  cashTipEur: number;
  bankUsd: number;
  currency: string;
  displayCurrency: string;
  rate: number;
  rateDate: string;
  participants: readonly Participant[];
  items: readonly ReceiptItem[];
  connection: {
    provider: 'Liveblocks' | 'WebRTC';
    status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  };
  peers: readonly { id: string; name: string; color?: string }[];
}
