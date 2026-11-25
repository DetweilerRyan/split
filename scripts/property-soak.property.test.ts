import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { readSoak } from './property-soak.ts';

describe('readSoak', () => {
  it('reads back every whole number it is given, in each variable that takes one', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1 }),
        fc.integer(),
        fc.string({ minLength: 1 }),
        (seconds, seed, path) => {
          expect(
            readSoak({
              PROPERTY_SOAK_SECONDS: String(seconds),
              PROPERTY_SEED: String(seed),
              PROPERTY_PATH: path,
            }),
          ).toStrictEqual({ seconds, seed, path });
        },
      ),
      { numRuns: 300 },
    );
  });

  it('refuses any budget that is not written as a whole number', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ noInteger: true, noDefaultInfinity: true, noNaN: true }).map(String),
          fc
            .tuple(fc.integer({ min: 1 }), fc.constantFrom(' ', 's', 'e3', '.0'))
            .map(([n, suffix]) => `${String(n)}${suffix}`),
        ),
        (value) => {
          expect(() => readSoak({ PROPERTY_SOAK_SECONDS: value })).toThrow(
            'must be a whole number',
          );
        },
      ),
      { numRuns: 300 },
    );
  });
});
