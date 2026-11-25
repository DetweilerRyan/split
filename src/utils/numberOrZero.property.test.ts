import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { numberOrZero } from './numberOrZero';

/** Any number but zero or NaN. */
const nonZero = fc.oneof(
  fc.double({ min: Number.MIN_VALUE, noNaN: true }),
  fc.double({ max: -Number.MIN_VALUE, noNaN: true }),
);

describe('numberOrZero', () => {
  it('reads back any non-zero number, as itself or written as text', () => {
    fc.assert(
      fc.property(nonZero, (number) => {
        expect(numberOrZero(number)).toBe(number);
        expect(numberOrZero(String(number))).toBe(number);
      }),
    );
  });

  it('never reads any value as NaN or minus zero', () => {
    fc.assert(
      fc.property(fc.oneof(fc.anything(), nonZero.map(String), fc.constant('-0')), (value) => {
        const number = numberOrZero(value);
        expect(Number.isNaN(number) || Object.is(number, -0)).toBe(false);
      }),
    );
  });
});
