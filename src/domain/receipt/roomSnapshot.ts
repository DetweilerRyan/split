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

export interface RoomSnapshot {
  title: string;
  address: string;
  phone: string;
  website: string;
  purchasedAt: string;
  mealType: string;
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

/**
 * The id of the participant with this name: `p-` and the name in lower case, with each run of
 * characters other than a to z and 0 to 9 replaced by one hyphen, and none at either end. Two
 * names that differ only in case or in those other characters are the same participant.
 */
export function participantId(name: string): string {
  return `p-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}
