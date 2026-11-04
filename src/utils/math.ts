import type { RoomSnapshot } from '../types/receipt';
import { DEFAULT_CURRENCY, currencyExponent, fromMinor, normalizeCurrency, toMinor } from './currency';

export interface PersonTotal {
  participant: RoomSnapshot['participants'][number];
  itemsSubtotalMinor: number;
  cardTipShareMinor: number;
  cashTipShareMinor: number;
  totalMinor: number;
  /** Amounts in major units of the receipt currency. */
  itemsSubtotal: number;
  cardTipShare: number;
  cashTipShare: number;
  total: number;
  /** Total in display-currency major units, or null when no conversion applies. */
  converted: number | null;
}

/**
 * Splits `total` (integer minor units) across `weights` proportionally using the
 * largest-remainder method. Ties go to the lowest index, so the result is deterministic
 * and always sums to exactly `total`.
 */
export function allocateMinor(total: number, weights: number[]): number[] {
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

export function computeReceiptMath(snapshot: RoomSnapshot) {
  const currency = normalizeCurrency(snapshot.currency ?? DEFAULT_CURRENCY);
  const exp = currencyExponent(currency);
  const perPerson: Record<string, PersonTotal> = {};

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
    const itemMinor = toMinor(item.eur, currency);
    itemsSubtotalMinor += itemMinor;
    const claimants = snapshot.participants.filter((person) => item.claims[person.id]);
    if (!claimants.length) return;
    // Equal split in minor units; leftover units go to claimants in a per-item rotating order.
    const base = Math.floor(itemMinor / claimants.length);
    const extra = itemMinor - base * claimants.length;
    claimants.forEach(({ id }, index) => {
      const position = (index - (itemIndex % claimants.length) + claimants.length) % claimants.length;
      perPerson[id].itemsSubtotalMinor += base + (position < extra ? 1 : 0);
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
    const convertedMinor = toMinor(fromMinor(grandMinor, currency) * effectiveRate, displayCurrency);
    const convertedShares = allocateMinor(convertedMinor, people.map((person) => person.totalMinor));
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
