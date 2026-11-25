import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { typedNumber } from './typedNumber';

/** Any number but zero or NaN. */
const nonZero = fc.oneof(
  fc.double({ min: Number.MIN_VALUE, noNaN: true }),
  fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
);

describe('typedNumber', () => {
  it('reads back any non-zero number written as text', () => {
    fc.assert(
      fc.property(nonZero, (number) => {
        expect(typedNumber(String(number))).toBe(number);
      }),
    );
  });

  it('never reads any text as NaN or minus zero', () => {
    fc.assert(
      fc.property(fc.oneof(fc.string(), nonZero.map(String), fc.constant('-0')), (text) => {
        const number = typedNumber(text);
        expect(Number.isNaN(number) || Object.is(number, -0)).toBe(false);
      }),
    );
  });
});
