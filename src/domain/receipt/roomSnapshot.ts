export type ReceiptItem = {
  readonly id: string;
  readonly name: string;
  readonly en: string;
  readonly eur: number;
  readonly order: number;
  readonly claims: Readonly<Record<string, boolean>>;
};

export type Participant = {
  readonly id: string;
  readonly name: string;
  readonly colorIdx: number;
};

export type RoomSnapshot = {
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
};

/**
 * The id of the participant with this name, or `null` when the name has no letter or digit in any
 * script, so it names nobody.
 *
 * The id is `p-` and the name's words joined by hyphens. The name is first put in Unicode's NFKC
 * form and lower-cased, so the ways a keyboard can write the same letters (`é` as one character or
 * as `e` and an accent, fullwidth `Ｊ` or `J`, upper or lower case) give the same id. A word is a
 * letter or digit, in any script, and the letters, digits and combining marks that follow it, so
 * accents and the vowel signs of scripts such as Devanagari stay in their word. Every other
 * character separates words. So two names with the same words in the same order are the same
 * participant, whatever their case and whichever of those other characters sit between, before or
 * after the words.
 *
 * A participant stored before this rule keeps the id it was stored with, which may differ from
 * this; `findParticipant` still finds it by its name.
 */
export function participantId(name: string): string | null {
  const words = name
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu);
  return words !== null ? `p-${words.join('-')}` : null;
}

/**
 * The participant this name stands for, if one is on the bill: the one whose id is the name's, or
 * whose own name gives the same id, which finds a participant stored under an older id rule.
 */
export function findParticipant<P extends Pick<Participant, 'id' | 'name'>>(
  participants: Iterable<P>,
  name: string,
): P | undefined {
  const id = participantId(name);
  if (id === null) return undefined;
  for (const participant of participants) {
    if (participant.id === id || participantId(participant.name) === id) return participant;
  }
  return undefined;
}
