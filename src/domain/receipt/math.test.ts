import { assert, describe, expect, it } from 'vitest';
import { type RoomSnapshot, itemIdSchema, participantIdSchema } from './roomSnapshot';
import { computeReceiptMath, splitItemMinor } from './math';

const ryan = participantIdSchema.parse('p-ryan');
const jameson = participantIdSchema.parse('p-jameson');
const item0 = itemIdSchema.parse('item-0');
const item1 = itemIdSchema.parse('item-1');

/** The id of the participant `makeSnapshot` names `label`. */
function id(label: 'a' | 'b' | 'c') {
  return participantIdSchema.parse(`p-${label}`);
}

describe('receipt currency math', () => {
  it('uses the bank reconciliation rate and allocates tips proportionally', () => {
    const snapshot: RoomSnapshot = {
      title: 'Test receipt',
      address: '',
      phone: '',
      website: '',
      purchasedAt: '',
      mealType: '',
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
        { id: ryan, name: 'Ryan', colorIdx: 0 },
        { id: jameson, name: 'Jameson', colorIdx: 1 },
      ],
      items: [
        { id: item0, name: 'Meal A', en: '', eur: 100, order: 0, claims: { [ryan]: true } },
        { id: item1, name: 'Meal B', en: '', eur: 37, order: 1, claims: { [jameson]: true } },
      ],
    };

    const result = computeReceiptMath(snapshot);
    expect(result.itemsSubtotal).toBe(137);
    expect(result.cardTotal).toBe(140);
    expect(result.effectiveRate).toBe(1.1);
    expect(result.isEstimatedRate).toBe(false);
    expect(result.perPerson[ryan]?.cardTipShare).toBeCloseTo(3 * (100 / 137));
    expect(result.perPerson[ryan]?.cashTipShare).toBeCloseTo(10 * (100 / 137));
    expect(result.perPerson[ryan]?.converted).toBeCloseTo((100 + 13 * (100 / 137)) * 1.1);
    expect(result.perPerson[jameson]?.converted).toBeCloseTo((37 + 13 * (37 / 137)) * 1.1);
  });

  it('uses the estimated rate when no bank charge is entered', () => {
    const snapshot: RoomSnapshot = {
      title: 'Test receipt',
      address: '',
      phone: '',
      website: '',
      purchasedAt: '',
      mealType: '',
      cardTipEur: 0,
      cashTipEur: 5,
      bankUsd: 0,
      currency: 'EUR',
      displayCurrency: 'USD',
      rate: 1.085,
      rateDate: '2026-01-02',
      connection: { provider: 'WebRTC', status: 'connected' },
      peers: [],
      participants: [{ id: ryan, name: 'Ryan', colorIdx: 0 }],
      items: [{ id: item0, name: 'Meal', en: '', eur: 10, order: 0, claims: { [ryan]: true } }],
    };

    const result = computeReceiptMath(snapshot);
    expect(result.effectiveRate).toBe(1.085);
    expect(result.isEstimatedRate).toBe(true);
    expect(result.perPerson[ryan]?.converted).toBeCloseTo(15 * 1.085);
  });
});

function makeSnapshot(
  currency: string | undefined,
  amounts: readonly number[],
  claimants: readonly (readonly ('a' | 'b' | 'c')[])[],
  tips = { card: 0, cash: 0 },
): RoomSnapshot {
  const labels = ['a', 'b', 'c'] as const;
  return {
    title: 't',
    address: '',
    phone: '',
    website: '',
    purchasedAt: '',
    mealType: '',
    cardTipEur: tips.card,
    cashTipEur: tips.cash,
    bankUsd: 0,
    currency: currency as string,
    displayCurrency: '',
    rate: 0,
    rateDate: '',
    connection: { provider: 'WebRTC', status: 'connected' },
    peers: [],
    participants: labels.map((label, colorIdx) => ({ id: id(label), name: label, colorIdx })),
    items: amounts.map((eur, order) => ({
      id: itemIdSchema.parse(`i${order}`),
      name: 'x',
      en: '',
      eur,
      order,
      claims: Object.fromEntries(
        labels.map((label) => [id(label), claimants[order]?.includes(label) === true]),
      ),
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
    expect(Object.values(first.perPerson).map((p) => p.totalMinor)).toEqual(
      (['a', 'b', 'c'] as const).map((label) => second.perPerson[id(label)]?.totalMinor),
    );
  });

  it('allocates tips so totals add up exactly in 3-decimal currencies', () => {
    const snap = makeSnapshot('KWD', [1.001, 2.002, 3.003], [['a'], ['b'], ['c']], {
      card: 0.5,
      cash: 0.001,
    });
    const result = computeReceiptMath(snap);
    const people = Object.values(result.perPerson);
    expect(people.reduce((s, p) => s + p.cardTipShareMinor, 0)).toBe(500);
    expect(people.reduce((s, p) => s + p.cashTipShareMinor, 0)).toBe(1);
    expect(people.reduce((s, p) => s + p.totalMinor, 0)).toBe(1001 + 2002 + 3003 + 501);
  });

  it('gives callers readonly totals, which TypeScript refuses to change', () => {
    const result = computeReceiptMath(makeSnapshot('USD', [10], [['a']]));
    const a = result.perPerson[id('a')];
    assert(a !== undefined, 'a has totals');
    // @ts-expect-error A person's totals are readonly to callers.
    a.total = 1;
    // @ts-expect-error So is the record of them.
    result.perPerson[id('b')] = a;
    // @ts-expect-error And the receipt's own totals.
    result.grandTotal = 1;
  });

  it('falls back to USD when the receipt has no currency (legacy rooms)', () => {
    const result = computeReceiptMath(makeSnapshot(undefined, [10.5], [['a']]));
    expect(result.currency).toBe('USD');
    expect(result.perPerson[id('a')]?.totalMinor).toBe(1050);
  });

  it('converts shares using the stored rate and keeps converted totals exact', () => {
    const snap = {
      ...makeSnapshot('EUR', [10], [['a', 'b', 'c']]),
      displayCurrency: 'JPY',
      rate: 160.5,
      rateDate: '2026-01-02',
    };
    const result = computeReceiptMath(snap);
    expect(result.displayCurrency).toBe('JPY');
    const sum = Object.values(result.perPerson).reduce((s, p) => s + (p.converted ?? 0), 0);
    expect(sum).toBe(1605);
  });

  it('shows no conversion without a rate', () => {
    const snap = { ...makeSnapshot('EUR', [10], [['a']]), displayCurrency: 'JPY' };
    expect(computeReceiptMath(snap).perPerson[id('a')]?.converted).toBeNull();
  });
});

describe('splitItemMinor', () => {
  const snap = makeSnapshot(
    'USD',
    [1, 1, 1, 0],
    [['a', 'b', 'c'], ['a', 'b', 'c'], ['b', 'c'], []],
  );
  function split(itemIndex: number) {
    const item = snap.items[itemIndex];
    assert(item !== undefined, `the receipt has an item ${itemIndex}`);
    return splitItemMinor(item, itemIndex, snap.participants, 'USD');
  }

  it("gives the leftover cent of an item that doesn't divide evenly to its first claimant", () => {
    expect(split(0)).toEqual([
      { id: id('a'), minor: 34 },
      { id: id('b'), minor: 33 },
      { id: id('c'), minor: 33 },
    ]);
  });

  it("gives the next item's leftover cent to the next claimant", () => {
    expect(split(1)).toEqual([
      { id: id('a'), minor: 33 },
      { id: id('b'), minor: 34 },
      { id: id('c'), minor: 33 },
    ]);
  });

  it("splits only between an item's claimants, in the participants' order", () => {
    expect(split(2)).toEqual([
      { id: id('b'), minor: 50 },
      { id: id('c'), minor: 50 },
    ]);
  });

  it('gives no shares of an item no one claims', () => {
    expect(split(3)).toEqual([]);
  });

  it('adds up to the subtotals computeReceiptMath charges', () => {
    const { perPerson } = computeReceiptMath(snap);
    expect([
      perPerson[id('a')]?.itemsSubtotalMinor,
      perPerson[id('b')]?.itemsSubtotalMinor,
      perPerson[id('c')]?.itemsSubtotalMinor,
    ]).toEqual([34 + 33, 33 + 34 + 50, 33 + 33 + 50]);
  });
});
