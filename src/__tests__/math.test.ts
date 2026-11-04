import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from '../types/receipt';
import { computeReceiptMath } from '../utils/math';

describe('receipt currency math', () => {
  it('uses the bank reconciliation rate and allocates tips proportionally', () => {
    const snapshot: RoomSnapshot = {
      title: 'Test receipt',
      cardTipEur: 3,
      cashTipEur: 10,
      bankUsd: 154,
      currency: 'EUR',
      displayCurrency: 'USD',
      rate: 0,
      rateDate: '',
      connection: { provider: 'WebRTC', status: 'connected' },
      peers: [],
      participants: [
        { id: 'p-ryan', name: 'Ryan', colorIdx: 0 },
        { id: 'p-jameson', name: 'Jameson', colorIdx: 1 },
      ],
      items: [
        { id: 'item-0', name: 'Meal A', en: '', eur: 100, order: 0, claims: { 'p-ryan': true } },
        { id: 'item-1', name: 'Meal B', en: '', eur: 37, order: 1, claims: { 'p-jameson': true } },
      ],
    };

    const result = computeReceiptMath(snapshot);
    expect(result.itemsSubtotal).toBe(137);
    expect(result.cardTotal).toBe(140);
    expect(result.effectiveRate).toBe(1.1);
    expect(result.isEstimatedRate).toBe(false);
    expect(result.perPerson['p-ryan'].cardTipShare).toBeCloseTo(3 * (100 / 137));
    expect(result.perPerson['p-ryan'].cashTipShare).toBeCloseTo(10 * (100 / 137));
    expect(result.perPerson['p-ryan'].converted).toBeCloseTo(
      (100 + 13 * (100 / 137)) * 1.1,
    );
    expect(result.perPerson['p-jameson'].converted).toBeCloseTo(
      (37 + 13 * (37 / 137)) * 1.1,
    );
  });

  it('uses the estimated rate when no bank charge is entered', () => {
    const snapshot: RoomSnapshot = {
      title: 'Test receipt',
      cardTipEur: 0,
      cashTipEur: 5,
      bankUsd: 0,
      currency: 'EUR',
      displayCurrency: 'USD',
      rate: 1.085,
      rateDate: '2026-01-02',
      connection: { provider: 'WebRTC', status: 'connected' },
      peers: [],
      participants: [{ id: 'p-ryan', name: 'Ryan', colorIdx: 0 }],
      items: [
        { id: 'item-0', name: 'Meal', en: '', eur: 10, order: 0, claims: { 'p-ryan': true } },
      ],
    };

    const result = computeReceiptMath(snapshot);
    expect(result.effectiveRate).toBe(1.085);
    expect(result.isEstimatedRate).toBe(true);
    expect(result.perPerson['p-ryan'].converted).toBeCloseTo(15 * 1.085);
  });
});

function makeSnapshot(
  currency: string | undefined,
  amounts: number[],
  claimants: string[][],
  tips = { card: 0, cash: 0 },
): RoomSnapshot {
  const ids = ['a', 'b', 'c'];
  return {
    title: 't',
    cardTipEur: tips.card,
    cashTipEur: tips.cash,
    bankUsd: 0,
    currency: currency as string,
    displayCurrency: '',
    rate: 0,
    rateDate: '',
    connection: { provider: 'WebRTC', status: 'connected' },
    peers: [],
    participants: ids.map((id, colorIdx) => ({ id, name: id, colorIdx })),
    items: amounts.map((eur, order) => ({
      id: `i${order}`,
      name: 'x',
      en: '',
      eur,
      order,
      claims: Object.fromEntries(ids.map((id) => [id, claimants[order].includes(id)])),
    })),
  };
}

describe('integer minor-unit splitting', () => {
  it.each([
    ['JPY', 0, 100, 1],
    ['USD', 2, 1, 0.01],
    ['KWD', 3, 1, 0.001],
  ])('splits %s (%i decimals) exactly across three people', (currency, exp, majorTotal, unit) => {
    const total = majorTotal + unit; // not divisible by 3 in minor units
    const snap = makeSnapshot(currency, [total], [['a', 'b', 'c']]);
    const result = computeReceiptMath(snap);
    const minors = Object.values(result.perPerson).map((p) => p.totalMinor);
    const totalMinor = Math.round(total * 10 ** exp);
    expect(minors.reduce((a, b) => a + b, 0)).toBe(totalMinor);
    expect(Math.max(...minors) - Math.min(...minors)).toBeLessThanOrEqual(1);
    expect(result.exponent).toBe(exp);
  });

  it('distributes remainders deterministically', () => {
    const snap = makeSnapshot('USD', [1], [['a', 'b', 'c']]);
    const first = computeReceiptMath(snap);
    const second = computeReceiptMath(snap);
    expect(Object.values(first.perPerson).map((p) => p.totalMinor)).toEqual([1, 0, 0].map((n, i) => second.perPerson[['a', 'b', 'c'][i]].totalMinor));
  });

  it('allocates tips so totals add up exactly in 3-decimal currencies', () => {
    const snap = makeSnapshot('KWD', [1.001, 2.002, 3.003], [['a'], ['b'], ['c']], { card: 0.5, cash: 0.001 });
    const result = computeReceiptMath(snap);
    const people = Object.values(result.perPerson);
    expect(people.reduce((s, p) => s + p.cardTipShareMinor, 0)).toBe(500);
    expect(people.reduce((s, p) => s + p.cashTipShareMinor, 0)).toBe(1);
    expect(people.reduce((s, p) => s + p.totalMinor, 0)).toBe(1001 + 2002 + 3003 + 501);
  });

  it('falls back to USD when the receipt has no currency (legacy rooms)', () => {
    const result = computeReceiptMath(makeSnapshot(undefined, [10.5], [['a']]));
    expect(result.currency).toBe('USD');
    expect(result.perPerson.a.totalMinor).toBe(1050);
  });

  it('converts shares using the stored rate and keeps converted totals exact', () => {
    const snap = { ...makeSnapshot('EUR', [10], [['a', 'b', 'c']]), displayCurrency: 'JPY', rate: 160.5, rateDate: '2026-01-02' };
    const result = computeReceiptMath(snap);
    expect(result.displayCurrency).toBe('JPY');
    const sum = Object.values(result.perPerson).reduce((s, p) => s + (p.converted ?? 0), 0);
    expect(sum).toBe(1605);
  });

  it('shows no conversion without a rate', () => {
    const snap = { ...makeSnapshot('EUR', [10], [['a']]), displayCurrency: 'JPY' };
    expect(computeReceiptMath(snap).perPerson.a.converted).toBeNull();
  });
});
