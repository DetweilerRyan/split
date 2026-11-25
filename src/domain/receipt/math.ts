import type { Participant, ReceiptItem, RoomSnapshot } from './roomSnapshot';
import { currencyExponent, fromMinor, normalizeCurrency, toMinor } from '../money/currency';

export type PersonTotal = {
  readonly participant: RoomSnapshot['participants'][number];
  readonly itemsSubtotalMinor: number;
  readonly cardTipShareMinor: number;
  readonly cashTipShareMinor: number;
  readonly totalMinor: number;
  /** Amounts in major units of the receipt currency. */
  readonly itemsSubtotal: number;
  readonly cardTipShare: number;
  readonly cashTipShare: number;
  readonly total: number;
  /** Total in display-currency major units, or null when no conversion applies. */
  readonly converted: number | null;
};

/** A receipt's totals, as computeReceiptMath works them out from a snapshot. */
export type ReceiptMath = {
  readonly currency: string;
  readonly exponent: number;
  readonly displayCurrency: string | null;
  readonly itemsSubtotal: number;
  readonly cardTotal: number;
  readonly grandTotal: number;
  readonly effectiveRate: number | null;
  readonly isEstimatedRate: boolean;
  /** Each participant's totals, by participant id. */
  readonly perPerson: Readonly<Record<string, PersonTotal>>;
};

/**
 * Splits `total` (integer minor units) across `weights` proportionally using the
 * largest-remainder method. Ties go to the lowest index, so the result is deterministic
 * and always sums to exactly `total`.
 */
export function allocateMinor(total: number, weights: readonly number[]): readonly number[] {
  return allocate(total, weights, (weight) => weight).map(({ share }) => share);
}

/** Each of `parts` with its share of `total`, split by `weightOf` as allocateMinor splits it. */
function allocate<T>(
  total: number,
  parts: readonly T[],
  weightOf: (part: T) => number,
): readonly { readonly part: T; readonly share: number }[] {
  const weightSum = parts.reduce((sum, part) => sum + weightOf(part), 0);
  if (weightSum <= 0) return parts.map((part) => ({ part, share: 0 }));
  const exact = parts.map((part, index) => {
    const value = (total * weightOf(part)) / weightSum;
    return { part, index, share: Math.floor(value), fraction: value - Math.floor(value) };
  });
  const remainder = total - exact.reduce((sum, { share }) => sum + share, 0);
  // The `remainder` parts with the largest fractions get one more unit each, then go back in order.
  return exact
    .sort((a, b) => (b.fraction !== a.fraction ? b.fraction - a.fraction : a.index - b.index))
    .map(({ part, index, share }, rank) => ({
      part,
      index,
      share: rank < remainder ? share + 1 : share,
    }))
    .sort((a, b) => a.index - b.index)
    .map(({ part, share }) => ({ part, share }));
}

/** One claimant's share of an item, in minor units of the receipt currency. */
export type ItemShare = {
  readonly id: Participant['id'];
  readonly minor: number;
};

/**
 * Splits the item at `itemIndex` of a receipt equally between the participants who claim it, in
 * minor units of `currency`, as computeReceiptMath charges them. Leftover units go to claimants in
 * a rotating order that starts one further along for each item, so identical items even out. The
 * shares come in the participants' order and add up to exactly the item's amount; an item no one
 * claims has none.
 */
export function splitItemMinor(
  item: ReceiptItem,
  itemIndex: number,
  participants: readonly Participant[],
  currency: string,
): readonly ItemShare[] {
  const itemMinor = toMinor(item.eur, currency);
  const claimants = participants.filter((person) => item.claims[person.id] === true);
  if (claimants.length === 0) return [];
  const base = Math.floor(itemMinor / claimants.length);
  const extra = itemMinor - base * claimants.length;
  return claimants.map(({ id }, index) => {
    const position = (index - (itemIndex % claimants.length) + claimants.length) % claimants.length;
    return { id, minor: base + (position < extra ? 1 : 0) };
  });
}

// @crap-allow CRAP 13, complexity 13. Most branches choose the display currency and the rate to convert at; #97 moved the item split out and left those, which read as one rule. Move them into their own function when the conversion rules next change.
export function computeReceiptMath(snapshot: RoomSnapshot): ReceiptMath {
  const currency = normalizeCurrency(snapshot.currency);
  const exp = currencyExponent(currency);
  // Filled in place below, as a local working value; ReceiptMath gives callers each total as readonly.
  const perPerson: Record<string, { -readonly [K in keyof PersonTotal]: PersonTotal[K] }> = {};

  const itemShares = snapshot.items.flatMap((item, itemIndex) =>
    splitItemMinor(item, itemIndex, snapshot.participants, currency),
  );
  snapshot.participants.forEach((participant) => {
    perPerson[participant.id] = {
      participant,
      itemsSubtotalMinor: itemShares
        .filter(({ id }) => id === participant.id)
        .reduce((sum, { minor }) => sum + minor, 0),
      cardTipShareMinor: 0,
      cashTipShareMinor: 0,
      totalMinor: 0,
      itemsSubtotal: 0,
      cardTipShare: 0,
      cashTipShare: 0,
      total: 0,
      converted: null,
    };
  });

  const itemsSubtotalMinor = snapshot.items.reduce(
    (sum, item) => sum + toMinor(item.eur, currency),
    0,
  );
  const people = Object.values(perPerson);
  const cardTipMinor = toMinor(snapshot.cardTipEur, currency);
  const cashTipMinor = toMinor(snapshot.cashTipEur, currency);
  allocate(cardTipMinor, people, (person) => person.itemsSubtotalMinor).forEach(
    ({ part: person, share }) => {
      person.cardTipShareMinor = share;
    },
  );
  allocate(cashTipMinor, people, (person) => person.itemsSubtotalMinor).forEach(
    ({ part: person, share }) => {
      person.cashTipShareMinor = share;
    },
  );
  people.forEach((person) => {
    person.totalMinor =
      person.itemsSubtotalMinor + person.cardTipShareMinor + person.cashTipShareMinor;
  });

  const cardTotalMinor = itemsSubtotalMinor + cardTipMinor;
  const cardTotal = fromMinor(cardTotalMinor, currency);

  const displayCurrency =
    snapshot.displayCurrency !== ''
      ? normalizeCurrency(snapshot.displayCurrency)
      : snapshot.bankUsd > 0
        ? 'USD'
        : null;
  let effectiveRate: number | null = null;
  let isEstimatedRate = true;
  let converting = false;
  if (displayCurrency !== null && displayCurrency !== currency) {
    if (snapshot.bankUsd > 0 && cardTotal > 0) {
      effectiveRate = snapshot.bankUsd / cardTotal;
      isEstimatedRate = false;
    } else if (snapshot.rate > 0) {
      effectiveRate = snapshot.rate;
    }
    converting = effectiveRate !== null;
  }

  if (converting && effectiveRate !== null && displayCurrency !== null) {
    const grandMinor = people.reduce((sum, person) => sum + person.totalMinor, 0);
    const convertedMinor = toMinor(
      fromMinor(grandMinor, currency) * effectiveRate,
      displayCurrency,
    );
    allocate(convertedMinor, people, (person) => person.totalMinor).forEach(
      ({ part: person, share }) => {
        person.converted = fromMinor(share, displayCurrency);
      },
    );
  }

  people.forEach((person) => {
    person.itemsSubtotal = fromMinor(person.itemsSubtotalMinor, currency);
    person.cardTipShare = fromMinor(person.cardTipShareMinor, currency);
    person.cashTipShare = fromMinor(person.cashTipShareMinor, currency);
    person.total = fromMinor(person.totalMinor, currency);
  });

  return {
    currency,
    exponent: exp,
    displayCurrency: converting ? displayCurrency : null,
    itemsSubtotal: fromMinor(itemsSubtotalMinor, currency),
    cardTotal,
    grandTotal: fromMinor(cardTotalMinor + cashTipMinor, currency),
    effectiveRate: converting ? effectiveRate : null,
    isEstimatedRate,
    perPerson,
  };
}
