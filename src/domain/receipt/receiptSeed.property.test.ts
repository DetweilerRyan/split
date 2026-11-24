import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { MAX_ITEMS, MAX_ROSTER, MAX_TEXT, type ReceiptSeed, validateSeed } from './receiptSeed';

/** Text up to `max` UTF-16 units: printable ASCII, or any code point, astral ones included. */
function text(max = MAX_TEXT) {
  return fc.oneof(
    fc.string({ maxLength: max }),
    fc.string({ maxLength: Math.floor(max / 2), unit: 'binary' }),
  );
}

const amount = fc.double({ noNaN: true, noDefaultInfinity: true });

/** Currency codes the schema accepts, in the cases a receipt or an agent might write them. */
const currency = fc.constantFrom('USD', 'EUR', 'JPY', 'KWD', 'jpy', 'Chf');

const item = fc.record({ id: text(64), name: text(), en: text(), eur: amount });

/** A seed within the limits, with items whose ids are all different. */
function seedWith(itemCount: { readonly minLength: number; readonly maxLength: number }) {
  return fc.record(
    {
      title: text(),
      address: text(),
      phone: text(64),
      website: text(),
      purchasedAt: text(32),
      mealType: text(64),
      cardTipEur: amount,
      cashTipEur: amount,
      bankUsd: amount,
      currency,
      displayCurrency: currency,
      rate: fc.double({ min: Number.MIN_VALUE, max: 1e9, noNaN: true }),
      rateDate: text(32),
      roster: fc.array(text(), { maxLength: MAX_ROSTER }),
      items: fc.uniqueArray(item, { selector: (i) => i.id, ...itemCount }),
    },
    { requiredKeys: ['title', 'cardTipEur', 'cashTipEur', 'bankUsd', 'roster', 'items'] },
  ) satisfies fc.Arbitrary<ReceiptSeed>;
}

describe('validateSeed', () => {
  it('returns every seed within the limits as it was given', () => {
    fc.assert(
      fc.property(seedWith({ minLength: 0, maxLength: MAX_ITEMS }), (given) => {
        expect(validateSeed(given)).toEqual(given);
      }),
    );
  });

  it('names the later of two items that share an id, wherever they are', () => {
    const withDuplicate = seedWith({ minLength: 1, maxLength: MAX_ITEMS - 1 }).chain((s) =>
      fc.integer({ min: 0, max: s.items.length - 1 }).chain((original) =>
        fc.record({
          seed: fc.constant(s),
          original: fc.constant(original),
          copyAt: fc.integer({ min: original + 1, max: s.items.length }),
          copy: item,
        }),
      ),
    );
    fc.assert(
      fc.property(withDuplicate, ({ seed: given, original, copyAt, copy }) => {
        const id = given.items[original].id;
        const items = [
          ...given.items.slice(0, copyAt),
          { ...copy, id },
          ...given.items.slice(copyAt),
        ];
        expect(() => validateSeed({ ...given, items })).toThrow(
          `items[${copyAt}].id "${id}" is duplicated`,
        );
      }),
    );
  });
});
