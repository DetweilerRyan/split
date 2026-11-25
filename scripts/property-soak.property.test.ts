import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { readSoak } from './property-soak.ts';

describe('readSoak', () => {
  it('reads back every budget and seed it is given', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1 }), fc.integer(), (seconds, seed) => {
        expect(
          readSoak({ PROPERTY_SOAK_SECONDS: String(seconds), PROPERTY_SEED: String(seed) }),
        ).toStrictEqual({ seconds, seed, runs: undefined });
      }),
    );
  });

  it('reads back every seed and count of runs it is given', () => {
    fc.assert(
      fc.property(fc.integer(), fc.integer({ min: 1 }), (seed, runs) => {
        expect(
          readSoak({ PROPERTY_SEED: String(seed), PROPERTY_RUNS: String(runs) }),
        ).toStrictEqual({ seconds: undefined, seed, runs });
      }),
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
    );
  });
});
