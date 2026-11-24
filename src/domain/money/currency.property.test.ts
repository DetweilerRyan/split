import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { isValidCurrency, normalizeCurrency, toMinor, fromMinor } from './currency';

/** A string written in any mix of cases. */
function anyCase(text: string) {
  return fc
    .array(fc.boolean(), { minLength: text.length, maxLength: text.length })
    .map((upper) =>
      [...text].map((c, i) => (upper[i] ? c.toUpperCase() : c.toLowerCase())).join(''),
    );
}

/** Currencies with 0, 2 and 3 decimals, and the decimals each has. */
const knownCurrency = fc.constantFrom(
  { code: 'JPY', exponent: 0 },
  { code: 'KRW', exponent: 0 },
  { code: 'USD', exponent: 2 },
  { code: 'EUR', exponent: 2 },
  { code: 'GBP', exponent: 2 },
  { code: 'KWD', exponent: 3 },
  { code: 'BHD', exponent: 3 },
  { code: 'TND', exponent: 3 },
);

/** Any three ASCII letters, in any case: the shape of an ISO 4217 code, known or not. */
const threeLetters = fc.string({
  unit: fc.constantFrom(...'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  minLength: 3,
  maxLength: 3,
});

/** Values that only look like a code, or aren't one at all. */
const notACode = fc.oneof(
  fc.constantFrom(undefined, null, '', 'US', 'USDT', ' EUR', 'EUR ', 'E-R', '€€€', 'ÉUR', '123'),
  fc.string({ maxLength: 2 }),
  fc.string({ minLength: 4 }),
  threeLetters.map((code) => ` ${code}`),
  fc.integer(),
  fc.boolean(),
  fc.constant({ code: 'EUR' }),
);

const anyCurrency = fc.oneof(
  knownCurrency.chain(({ code }) => anyCase(code)),
  threeLetters,
  notACode,
);

const minorAmount = fc.integer({ min: -1_000_000_000_000, max: 1_000_000_000_000 });

describe('normalizeCurrency', () => {
  it('reads a three-letter code in any case as its upper case', () => {
    fc.assert(
      fc.property(threeLetters, (code) => {
        expect(isValidCurrency(code)).toBe(true);
        expect(normalizeCurrency(code)).toBe(code.toUpperCase());
      }),
    );
  });

  it('falls back to USD for anything that is not three letters', () => {
    fc.assert(
      fc.property(notACode, (value) => {
        expect(isValidCurrency(value)).toBe(false);
        expect(normalizeCurrency(value)).toBe('USD');
      }),
    );
  });

  it('gives a code that normalizes to itself', () => {
    fc.assert(
      fc.property(anyCurrency, (value) => {
        const code = normalizeCurrency(value);
        expect(normalizeCurrency(code)).toBe(code);
      }),
    );
  });
});

describe('minor units', () => {
  it("counts an amount in the currency's own minor units, in any case", () => {
    fc.assert(
      fc.property(
        knownCurrency.chain(({ code, exponent }) =>
          anyCase(code).map((written) => ({ written, exponent })),
        ),
        minorAmount,
        ({ written, exponent }, minor) => {
          expect(toMinor(minor / 10 ** exponent, written)).toBe(minor);
        },
      ),
    );
  });

  it('gets back the minor amount it started from, whatever the currency', () => {
    fc.assert(
      fc.property(anyCurrency, minorAmount, (code, minor) => {
        const written = code as string;
        expect(toMinor(fromMinor(minor, written), written)).toBe(minor);
      }),
    );
  });
});
