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
  participants: readonly Participant[];
  items: readonly ReceiptItem[];
  peers: readonly { id: string; name: string; color?: string }[];
}
