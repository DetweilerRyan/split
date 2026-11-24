export interface ReceiptItem {
  readonly id: string;
  readonly name: string;
  readonly en: string;
  readonly eur: number;
  readonly order: number;
  readonly claims: Readonly<Record<string, boolean>>;
}

export interface Participant {
  readonly id: string;
  readonly name: string;
  readonly colorIdx: number;
}

export interface RoomSnapshot {
  readonly title: string;
  readonly address: string;
  readonly phone: string;
  readonly website: string;
  readonly purchasedAt: string;
  readonly mealType: string;
  readonly cardTipEur: number;
  readonly cashTipEur: number;
  readonly bankUsd: number;
  readonly currency: string;
  readonly displayCurrency: string;
  readonly rate: number;
  readonly rateDate: string;
  readonly participants: readonly Participant[];
  readonly items: readonly ReceiptItem[];
  readonly connection: {
    readonly provider: 'Liveblocks' | 'WebRTC';
    readonly status: 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
  };
  readonly peers: readonly {
    readonly id: string;
    readonly name: string;
    readonly color?: string;
  }[];
}

/**
 * The id of the participant with this name: `p-` and the name in lower case, with each run of
 * characters other than a to z and 0 to 9 replaced by one hyphen, and none at either end. So two
 * names with the same words in the same order are the same participant, whatever their case and
 * whichever of those other characters sit between, before or after the words.
 */
export function participantId(name: string): string {
  return `p-${name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')}`;
}
