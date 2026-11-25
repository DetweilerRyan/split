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

/** One text field of a seed, with its limit and how to put a value in it. */
type TextField = {
  readonly path: string;
  readonly max: number;
  readonly set: (seed: ReceiptSeed, value: string) => ReceiptSeed;
};

const textFields: readonly TextField[] = [
  ...(['title', 'address', 'website'] as const).map((key) => ({
    path: key,
    max: MAX_TEXT,
    set: (s: ReceiptSeed, value: string) => ({ ...s, [key]: value }),
  })),
  ...(['phone', 'mealType'] as const).map((key) => ({
    path: key,
    max: 64,
    set: (s: ReceiptSeed, value: string) => ({ ...s, [key]: value }),
  })),
  ...(['purchasedAt', 'rateDate'] as const).map((key) => ({
    path: key,
    max: 32,
    set: (s: ReceiptSeed, value: string) => ({ ...s, [key]: value }),
  })),
  {
    path: 'roster[0]',
    max: MAX_TEXT,
    set: (s, value) => ({ ...s, roster: [value, ...s.roster.slice(1)] }),
  },
  ...(
    [
      ['id', 64],
      ['name', MAX_TEXT],
      ['en', MAX_TEXT],
    ] as const
  ).map(([key, max]) => ({
    path: `items[0].${key}`,
    max,
    set: (s: ReceiptSeed, value: string) => ({
      ...s,
      items: s.items.map((item, index) => (index === 0 ? { ...item, [key]: value } : item)),
    }),
  })),
];

describe('validateSeed', () => {
  it('returns every seed within the limits as it was given', () => {
    fc.assert(
      fc.property(seedWith({ minLength: 0, maxLength: MAX_ITEMS }), (given) => {
        expect(validateSeed(given)).toEqual(given);
      }),
    );
  });

  it('rejects each text field one unit over its limit, naming the field', () => {
    const overLimit = fc
      .tuple(seedWith({ minLength: 1, maxLength: MAX_ITEMS }), fc.constantFrom(...textFields))
      .chain(([s, field]) =>
        fc
          .string({ minLength: field.max + 1, maxLength: field.max + 1 })
          .map((value) => ({ seed: field.set(s, value), field })),
      );
    fc.assert(
      fc.property(overLimit, ({ seed: given, field }) => {
        expect(() => validateSeed(given)).toThrow(
          `${field.path} must be at most ${field.max} characters`,
        );
      }),
    );
  });

  it('names the later of two items that share an id, wherever they are', () => {
    const withDuplicate = seedWith({ minLength: 1, maxLength: MAX_ITEMS - 1 }).chain((s) =>
      fc
        .constantFrom(...s.items.map(({ id }, original) => ({ id, original })))
        .chain(({ id, original }) =>
          fc.record({
            seed: fc.constant(s),
            id: fc.constant(id),
            copyAt: fc.integer({ min: original + 1, max: s.items.length }),
            copy: item,
          }),
        ),
    );
    fc.assert(
      fc.property(withDuplicate, ({ seed: given, id, copyAt, copy }) => {
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
