import { z } from 'zod';

// A participant id in the form participantId mints, since #100: `p-` and one or more words of
// letters, combining marks and digits, in any script, joined by `-`. Ids stored under the older
// ASCII-only rule, such as `p-jos`, have the same form. `p-` on its own, which that rule gave a
// name with no ASCII letter or digit, doesn't, and nor does any other string. The owner chose
// "Only today's format" on #124.
const participantIdPattern = /^p-[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u;

export const participantIdSchema = z
  .string()
  .regex(participantIdPattern, {
    message: 'Participant ids are p- and words of letters, marks and digits joined by -.',
  })
  .brand<'ParticipantId'>();

/** A participant id that has been checked. Only parsing, or `participantId`, produces one. */
export type ParticipantId = z.infer<typeof participantIdSchema>;

/** The participant id in `value`, or `null` when it isn't one. */
export function parseParticipantId(value: unknown): ParticipantId | null {
  const result = participantIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

export const MAX_ITEM_ID = 64;

// Item ids have never had a format: the app mints `item-<time>-<random>`, presets use `item-0`,
// and a seed may give any text up to 64 characters. So any non-empty string up to that length is
// one, as the owner chose on #124.
export const itemIdSchema = z.string().min(1).max(MAX_ITEM_ID).brand<'ItemId'>();

/** An item id that has been checked. Only parsing produces one. */
export type ItemId = z.infer<typeof itemIdSchema>;

/** The item id in `value`, or `null` when it isn't one. */
export function parseItemId(value: unknown): ItemId | null {
  const result = itemIdSchema.safeParse(value);
  return result.success ? result.data : null;
}

export type ReceiptItem = {
  readonly id: ItemId;
  readonly name: string;
  readonly en: string;
  readonly eur: number;
  readonly order: number;
  readonly claims: Readonly<Record<ParticipantId, boolean>>;
};

export type Participant = {
  readonly id: ParticipantId;
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
 * this; `findParticipant` still finds it by its name. One stored as `p-` isn't read at all, since
 * `participantIdSchema` refuses it.
 */
export function participantId(name: string): ParticipantId | null {
  const words = name
    .normalize('NFKC')
    .toLowerCase()
    .match(/[\p{L}\p{N}][\p{L}\p{M}\p{N}]*/gu);
  return words !== null ? parseParticipantId(`p-${words.join('-')}`) : null;
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
