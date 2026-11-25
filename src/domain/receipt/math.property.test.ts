import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { RoomSnapshot } from './roomSnapshot';
import { allocateMinor, computeReceiptMath } from './math';

/** A currency as a receipt might name it, with the code it stands for and its decimals. */
type WrittenCurrency = {
  readonly written: string | undefined;
  readonly code: string;
  readonly exponent: number;
};

/** A code written in any mix of cases. */
function anyCase(code: string) {
  return fc
    .array(fc.boolean(), { minLength: code.length, maxLength: code.length })
    .map((upper) =>
      [...code].map((c, i) => (upper[i] ? c.toUpperCase() : c.toLowerCase())).join(''),
    );
}

function writtenAs(code: string, exponent: number) {
  return anyCase(code).map((written): WrittenCurrency => ({ written, code, exponent }));
}

/** Currencies with 0, 2 and 3 decimals in any case, and the missing or invalid ones that mean USD. */
const receiptCurrency = fc.oneof(
  writtenAs('JPY', 0),
  writtenAs('KRW', 0),
  writtenAs('USD', 2),
  writtenAs('EUR', 2),
  writtenAs('KWD', 3),
  writtenAs('BHD', 3),
  fc
    .constantFrom(undefined, '', 'US', 'dollars', '12€', ' EUR')
    .map((written): WrittenCurrency => ({ written, code: 'USD', exponent: 2 })),
);

/** The display currency: none, the receipt's own in any case, another one, or an invalid one that means USD. */
const displayCurrency = fc.oneof(
  fc.constant(''),
  writtenAs('USD', 2),
  writtenAs('EUR', 2),
  writtenAs('JPY', 0),
  writtenAs('KWD', 3),
  fc
    .constantFrom('US', 'dollars', '12€', ' EUR')
    .map((written): WrittenCurrency => ({ written, code: 'USD', exponent: 2 })),
);

const ids = ['a', 'b', 'c', 'd'] as const;

/** Whom an item's claims name: each participant claiming, unclaiming or absent, plus a stranger. */
const claims = fc.record(
  { a: fc.boolean(), b: fc.boolean(), c: fc.boolean(), d: fc.boolean(), stranger: fc.boolean() },
  { requiredKeys: [] },
);

const minor = fc.integer({ min: 0, max: 1_000_000 });

const receipt = fc.record({
  currency: receiptCurrency,
  participantCount: fc.integer({ min: 0, max: ids.length }),
  // `offset` writes an amount up to 0.45 of a minor unit past its rounded value, as a receipt
  // might, so every amount still rounds to `minor`.
  items: fc.array(
    fc.record({ minor, claims, offset: fc.double({ min: 0, max: 0.45, noNaN: true }) }),
    {
      maxLength: 6,
    },
  ),
  cardTipMinor: fc.oneof(fc.constant(0), minor),
  cashTipMinor: fc.oneof(fc.constant(0), minor),
  display: displayCurrency,
  bankUsd: fc.oneof(fc.constant(0), fc.double({ min: 0.01, max: 100_000, noNaN: true })),
  rate: fc.oneof(fc.constant(0), fc.double({ min: 0.0001, max: 10_000, noNaN: true })),
});

type Receipt = typeof receipt extends fc.Arbitrary<infer R> ? R : never;

function major(amountMinor: number, exponent: number) {
  return amountMinor / 10 ** exponent;
}

function snapshotOf(r: Receipt): RoomSnapshot {
  const participants = ids
    .slice(0, r.participantCount)
    .map((id, colorIdx) => ({ id, name: id.toUpperCase(), colorIdx }));
  return {
    title: 'Receipt',
    address: '',
    phone: '',
    website: '',
    purchasedAt: '',
    mealType: '',
    cardTipEur: major(r.cardTipMinor, r.currency.exponent),
    cashTipEur: major(r.cashTipMinor, r.currency.exponent),
    bankUsd: r.bankUsd,
    currency: r.currency.written as string,
    displayCurrency: typeof r.display === 'string' ? r.display : (r.display.written as string),
    rate: r.rate,
    rateDate: '',
    connection: { provider: 'WebRTC', status: 'connected' },
    peers: [],
    participants,
    items: r.items.map((item, order) => ({
      id: `item-${order}`,
      name: `Item ${order}`,
      en: '',
      eur: major(item.minor + item.offset, r.currency.exponent),
      order,
      claims: item.claims,
    })),
  };
}

/** The ids of the participants who claim an item. */
function claimantsOf(r: Receipt, item: Receipt['items'][number]) {
  return ids
    .slice(0, r.participantCount)
    .filter((id) => item.claims[id as keyof typeof item.claims]);
}

function sum(values: readonly number[]) {
  return values.reduce((total, value) => total + value, 0);
}

describe('allocateMinor', () => {
  const weights = fc.array(fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 1_000_000 })), {
    maxLength: 8,
  });

  it('gives out exactly the total, each share within one unit of its exact proportion', () => {
    fc.assert(
      fc.property(minor, weights, (total, w) => {
        const shares = allocateMinor(total, w);
        const weightSum = sum(w);
        expect(shares).toHaveLength(w.length);
        if (weightSum === 0) {
          expect(shares.every((share) => share === 0)).toBe(true);
          return;
        }
        expect(sum(shares)).toBe(total);
        shares.forEach((share, i) => {
          expect(Number.isInteger(share)).toBe(true);
          expect(Math.abs(share - (total * (w[i] ?? NaN)) / weightSum)).toBeLessThan(1);
        });
      }),
    );
  });
});

describe('computeReceiptMath', () => {
  it('reads the receipt currency in any case, and falls back to USD', () => {
    fc.assert(
      fc.property(receipt, (r) => {
        const result = computeReceiptMath(snapshotOf(r));
        expect(result.currency).toBe(r.currency.code);
        expect(result.exponent).toBe(r.currency.exponent);
      }),
    );
  });

  it('gives each claimant an equal share of an item, to within one minor unit', () => {
    fc.assert(
      fc.property(receipt, (r) => {
        const result = computeReceiptMath(snapshotOf(r));
        ids.slice(0, r.participantCount).forEach((id) => {
          const claimed = r.items
            .map((item) => ({ item, claimants: claimantsOf(r, item) }))
            .filter(({ claimants }) => claimants.includes(id));
          const fewest = sum(
            claimed.map(({ item, claimants }) => Math.floor(item.minor / claimants.length)),
          );
          const most = sum(
            claimed.map(({ item, claimants }) => Math.ceil(item.minor / claimants.length)),
          );
          const subtotal = result.perPerson[id]?.itemsSubtotalMinor;
          expect(subtotal).toBeGreaterThanOrEqual(fewest);
          expect(subtotal).toBeLessThanOrEqual(most);
        });
      }),
    );
  });

  it('gives everyone the same subtotal when they share identical items, one per claimant', () => {
    // The leftover minor units of each item go to a different claimant in turn, so n identical
    // items split n ways leave no one ahead.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: ids.length }), minor, (count, amount) => {
        const everyone = Object.fromEntries(ids.slice(0, count).map((id) => [id, true]));
        const r: Receipt = {
          currency: { written: 'USD', code: 'USD', exponent: 2 },
          participantCount: count,
          items: Array.from({ length: count }, () => ({
            minor: amount,
            claims: everyone,
            offset: 0,
          })),
          cardTipMinor: 0,
          cashTipMinor: 0,
          display: '',
          bankUsd: 0,
          rate: 0,
        };
        const subtotals = Object.values(computeReceiptMath(snapshotOf(r)).perPerson).map(
          (p) => p.itemsSubtotalMinor,
        );
        expect(new Set(subtotals).size).toBe(1);
        expect(sum(subtotals)).toBe(amount * count);
      }),
    );
  });

  it('shares add up exactly to the claimed items and both tips', () => {
    fc.assert(
      fc.property(receipt, (r) => {
        const result = computeReceiptMath(snapshotOf(r));
        const people = Object.values(result.perPerson);
        const claimedMinor = sum(
          r.items.filter((item) => claimantsOf(r, item).length > 0).map((item) => item.minor),
        );
        const anyoneOwes = claimedMinor > 0;
        expect(sum(people.map((p) => p.itemsSubtotalMinor))).toBe(claimedMinor);
        expect(sum(people.map((p) => p.cardTipShareMinor))).toBe(anyoneOwes ? r.cardTipMinor : 0);
        expect(sum(people.map((p) => p.cashTipShareMinor))).toBe(anyoneOwes ? r.cashTipMinor : 0);
        people.forEach((p) => {
          expect(p.totalMinor).toBe(
            p.itemsSubtotalMinor + p.cardTipShareMinor + p.cashTipShareMinor,
          );
        });
        expect(Object.keys(result.perPerson)).toEqual(ids.slice(0, r.participantCount));
      }),
    );
  });

  it('splits each tip in proportion to what each person claimed', () => {
    fc.assert(
      fc.property(receipt, (r) => {
        const people = Object.values(computeReceiptMath(snapshotOf(r)).perPerson);
        const claimedMinor = sum(people.map((p) => p.itemsSubtotalMinor));
        if (claimedMinor === 0) return;
        people.forEach((p) => {
          const portion = p.itemsSubtotalMinor / claimedMinor;
          expect(Math.abs(p.cardTipShareMinor - r.cardTipMinor * portion)).toBeLessThan(1);
          expect(Math.abs(p.cashTipShareMinor - r.cashTipMinor * portion)).toBeLessThan(1);
        });
      }),
    );
  });

  it('converts every share at the bank charge, else the stored rate, else not at all', () => {
    fc.assert(
      fc.property(receipt, (r) => {
        const result = computeReceiptMath(snapshotOf(r));
        const people = Object.values(result.perPerson);
        const display =
          typeof r.display === 'string' ? (r.bankUsd > 0 ? 'USD' : null) : r.display.code;
        const displayExponent = typeof r.display === 'string' ? 2 : r.display.exponent;
        const cardTotalMinor = sum(r.items.map((item) => item.minor)) + r.cardTipMinor;
        const bankApplies = r.bankUsd > 0 && cardTotalMinor > 0;
        const converts =
          display !== null && display !== r.currency.code && (bankApplies || r.rate > 0);

        if (!converts) {
          expect(result.displayCurrency).toBeNull();
          expect(result.effectiveRate).toBeNull();
          expect(people.every((p) => p.converted === null)).toBe(true);
          return;
        }
        const rate = bankApplies ? r.bankUsd / major(cardTotalMinor, r.currency.exponent) : r.rate;
        expect(result.displayCurrency).toBe(display);
        expect(result.isEstimatedRate).toBe(!bankApplies);
        expect(result.effectiveRate).toBeCloseTo(rate, 9);
        people.forEach((p) => {
          // The converted grand total is rounded to the display currency's minor unit, then
          // split, so a share is within one and a half of those units of its exact conversion.
          const convertedMinor = (p.converted as number) * 10 ** displayExponent;
          const exact = major(p.totalMinor, r.currency.exponent) * rate * 10 ** displayExponent;
          expect(Math.abs(convertedMinor - exact)).toBeLessThanOrEqual(1.5 + 1e-6 * exact);
        });
      }),
    );
  });
});
