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
    expect(result.itemsSubtotalEur).toBe(137);
    expect(result.cardTotalEur).toBe(140);
    expect(result.effectiveRate).toBe(1.1);
    expect(result.isEstimatedRate).toBe(false);
    expect(result.perPerson['p-ryan'].cardTipShareEur).toBeCloseTo(3 * (100 / 137));
    expect(result.perPerson['p-ryan'].cashTipShareEur).toBeCloseTo(10 * (100 / 137));
    expect(result.perPerson['p-ryan'].totalUsd).toBeCloseTo(
      (100 + 13 * (100 / 137)) * 1.1,
    );
    expect(result.perPerson['p-jameson'].totalUsd).toBeCloseTo(
      (37 + 13 * (37 / 137)) * 1.1,
    );
  });

  it('uses the estimated rate when no bank charge is entered', () => {
    const snapshot: RoomSnapshot = {
      title: 'Test receipt',
      cardTipEur: 0,
      cashTipEur: 5,
      bankUsd: 0,
      peers: [],
      participants: [{ id: 'p-ryan', name: 'Ryan', colorIdx: 0 }],
      items: [
        { id: 'item-0', name: 'Meal', en: '', eur: 10, order: 0, claims: { 'p-ryan': true } },
      ],
    };

    const result = computeReceiptMath(snapshot);
    expect(result.effectiveRate).toBe(1.085);
    expect(result.isEstimatedRate).toBe(true);
    expect(result.perPerson['p-ryan'].totalUsd).toBeCloseTo(15 * 1.085);
  });
});
