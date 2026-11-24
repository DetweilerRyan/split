import type { Participant, ReceiptItem, RoomSnapshot } from './roomSnapshot';
import {
  DEFAULT_CURRENCY,
  currencyExponent,
  fromMinor,
  normalizeCurrency,
  toMinor,
} from '../money/currency';

export interface PersonTotal {
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
}

/** A receipt's totals, as computeReceiptMath works them out from a snapshot. */
export interface ReceiptMath {
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
}

/**
 * Splits `total` (integer minor units) across `weights` proportionally using the
 * largest-remainder method. Ties go to the lowest index, so the result is deterministic
 * and always sums to exactly `total`.
 */
export function allocateMinor(total: number, weights: readonly number[]): readonly number[] {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);
  const exact = weights.map((weight) => (total * weight) / weightSum);
  const shares = exact.map(Math.floor);
  let remainder = total - shares.reduce((sum, share) => sum + share, 0);
  const order = exact
    .map((value, index) => ({ index, fraction: value - Math.floor(value) }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);
  for (let i = 0; remainder > 0 && i < order.length; i += 1, remainder -= 1) {
    shares[order[i].index] += 1;
  }
  return shares;
}

/** One claimant's share of an item, in minor units of the receipt currency. */
export interface ItemShare {
  readonly id: Participant['id'];
  readonly minor: number;
}

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
  const claimants = participants.filter((person) => item.claims[person.id]);
  if (!claimants.length) return [];
  const base = Math.floor(itemMinor / claimants.length);
  const extra = itemMinor - base * claimants.length;
  return claimants.map(({ id }, index) => {
    const position = (index - (itemIndex % claimants.length) + claimants.length) % claimants.length;
    return { id, minor: base + (position < extra ? 1 : 0) };
  });
}

// @crap-allow CRAP 14, complexity 14. Most branches choose the display currency and the rate to convert at; #97 moved the item split out and left those, which read as one rule. Move them into their own function when the conversion rules next change.
export function computeReceiptMath(snapshot: RoomSnapshot): ReceiptMath {
  const currency = normalizeCurrency(snapshot.currency ?? DEFAULT_CURRENCY);
  const exp = currencyExponent(currency);
  // Filled in place below, as a local working value; ReceiptMath gives callers each total as readonly.
  const perPerson: Record<string, { -readonly [K in keyof PersonTotal]: PersonTotal[K] }> = {};

  snapshot.participants.forEach((participant) => {
    perPerson[participant.id] = {
      participant,
      itemsSubtotalMinor: 0,
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

  let itemsSubtotalMinor = 0;
  snapshot.items.forEach((item, itemIndex) => {
    itemsSubtotalMinor += toMinor(item.eur, currency);
    splitItemMinor(item, itemIndex, snapshot.participants, currency).forEach(({ id, minor }) => {
      perPerson[id].itemsSubtotalMinor += minor;
    });
  });

  const people = Object.values(perPerson);
  const weights = people.map((person) => person.itemsSubtotalMinor);
  const cardTipMinor = toMinor(snapshot.cardTipEur, currency);
  const cashTipMinor = toMinor(snapshot.cashTipEur, currency);
  const cardShares = allocateMinor(cardTipMinor, weights);
  const cashShares = allocateMinor(cashTipMinor, weights);
  people.forEach((person, index) => {
    person.cardTipShareMinor = cardShares[index];
    person.cashTipShareMinor = cashShares[index];
    person.totalMinor = person.itemsSubtotalMinor + cardShares[index] + cashShares[index];
  });

  const cardTotalMinor = itemsSubtotalMinor + cardTipMinor;
  const cardTotal = fromMinor(cardTotalMinor, currency);

  const displayCurrency = snapshot.displayCurrency
    ? normalizeCurrency(snapshot.displayCurrency)
    : snapshot.bankUsd > 0
      ? 'USD'
      : null;
  let effectiveRate: number | null = null;
  let isEstimatedRate = true;
  let converting = false;
  if (displayCurrency && displayCurrency !== currency) {
    if (snapshot.bankUsd > 0 && cardTotal > 0) {
      effectiveRate = snapshot.bankUsd / cardTotal;
      isEstimatedRate = false;
    } else if (snapshot.rate > 0) {
      effectiveRate = snapshot.rate;
    }
    converting = effectiveRate !== null;
  }

  if (converting && effectiveRate !== null && displayCurrency) {
    const grandMinor = people.reduce((sum, person) => sum + person.totalMinor, 0);
    const convertedMinor = toMinor(
      fromMinor(grandMinor, currency) * effectiveRate,
      displayCurrency,
    );
    const convertedShares = allocateMinor(
      convertedMinor,
      people.map((person) => person.totalMinor),
    );
    people.forEach((person, index) => {
      person.converted = fromMinor(convertedShares[index], displayCurrency);
    });
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
