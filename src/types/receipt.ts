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

export interface ReceiptSeed {
  title: string;
  cardTipEur: number;
  cashTipEur: number;
  bankUsd: number;
  /** ISO 4217 code of the receipt amounts; missing means USD (legacy links). */
  currency?: string;
  /** Optional ISO 4217 code that participant shares are converted to. */
  displayCurrency?: string;
  /** Receipt currency -> display currency rate, with the date it was published. */
  rate?: number;
  rateDate?: string;
  roster: string[];
  items: Array<{
    id: string;
    name: string;
    en: string;
    eur: number;
  }>;
}

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
