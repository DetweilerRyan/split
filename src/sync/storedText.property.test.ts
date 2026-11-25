import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { storedTextSchema } from './storedText';

describe('storedTextSchema', () => {
  it('reads every non-empty string as it is', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), fc.string(), (value, fallback) => {
        expect(storedTextSchema(fallback).parse(value)).toBe(value);
      }),
    );
  });

  it('reads anything a peer could write that is not a non-empty string as the fallback', () => {
    const notText = fc.oneof(
      fc.constant(''),
      fc.anything().filter((value) => typeof value !== 'string'),
    );
    fc.assert(
      fc.property(notText, fc.string(), (value, fallback) => {
        expect(storedTextSchema(fallback).parse(value)).toBe(fallback);
      }),
    );
  });
});
