import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { readSoak, soakAssert, soakParameters, soakReport } from './property-soak.ts';

const budget = { seconds: 2, seed: undefined, path: undefined };

describe('readSoak', () => {
  it('returns nothing when no soak variable is set, so a normal run is untouched', () => {
    expect(readSoak({})).toBeUndefined();
    expect(
      readSoak({ PROPERTY_SOAK_SECONDS: '', PROPERTY_SEED: '', PROPERTY_PATH: '' }),
    ).toBeUndefined();
  });

  it('reads a time budget in seconds', () => {
    expect(readSoak({ PROPERTY_SOAK_SECONDS: '120' })).toStrictEqual({
      seconds: 120,
      seed: undefined,
      path: undefined,
    });
  });

  it('reads a seed and the path that belongs to it', () => {
    expect(readSoak({ PROPERTY_SEED: '-42', PROPERTY_PATH: '3:1:0' })).toStrictEqual({
      seconds: undefined,
      seed: -42,
      path: '3:1:0',
    });
  });

  it.each(['2m', '1.5', ' 120', 'ten'])(
    'refuses a budget of "%s", which is not a whole number',
    (value) => {
      expect(() => readSoak({ PROPERTY_SOAK_SECONDS: value })).toThrow(
        `PROPERTY_SOAK_SECONDS must be a whole number, not "${value}".`,
      );
    },
  );

  it.each(['0', '-5'])('refuses a budget of %s seconds', (value) => {
    expect(() => readSoak({ PROPERTY_SOAK_SECONDS: value })).toThrow(
      'PROPERTY_SOAK_SECONDS must be more than 0',
    );
  });

  it('refuses a path without its seed', () => {
    expect(() => readSoak({ PROPERTY_PATH: '3:1:0' })).toThrow(
      'PROPERTY_PATH replays an input only with the PROPERTY_SEED it came from.',
    );
  });
});

describe('soakParameters', () => {
  it('keeps the examples, and runs with no limit but the clock', () => {
    const parameters = soakParameters(budget, { numRuns: 300, examples: [[7]] });

    expect(parameters.numRuns).toBe(Number.POSITIVE_INFINITY);
    expect(parameters.examples).toStrictEqual([[7]]);
    expect(parameters.plugins).toHaveLength(1);
  });

  it('keeps the test plugins, and adds the time limit after them', () => {
    const own = fc.interruptAfterTimeLimit(60_000);

    expect(soakParameters(budget, { plugins: [own] }).plugins?.[0]).toBe(own);
    expect(soakParameters(budget, { plugins: [own] }).plugins).toHaveLength(2);
  });

  it('replays a seed and path with the test count, and no time limit', () => {
    const parameters = soakParameters(
      { seconds: undefined, seed: 9, path: '4:2' },
      { numRuns: 300, seed: 1 },
    );

    expect(parameters).toStrictEqual({ numRuns: 300, seed: 9, path: '4:2' });
  });
});

describe('soakReport', () => {
  const property: fc.IProperty<unknown> = fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
    expect(n).toBeLessThan(5);
  });

  it('says how many inputs passed in the budget', () => {
    const passing: fc.IProperty<unknown> = fc.property(fc.integer(), () => {});
    const details = fc.check(passing, { numRuns: 25 });

    expect(soakReport(budget, details)).toStrictEqual({
      passed: true,
      message: 'Soak passed: 25 inputs in 2 s.',
    });
  });

  it("gives fast-check's report when a property fails", () => {
    const details = fc.check(property, { seed: 1 });

    expect(soakReport(budget, details)).toStrictEqual({
      passed: false,
      message: fc.defaultReportMessage(details),
    });
  });

  it('says how to finish shrinking when the time limit cut it short', () => {
    const checked = fc.check(property, { seed: 1 });
    const details: fc.RunDetails<unknown> = { ...checked, interrupted: true };

    expect(soakReport(budget, details).message).toContain(
      `The time limit cut shrinking short. To finish it, run again with PROPERTY_SEED=${String(details.seed)} PROPERTY_PATH=${String(details.counterexamplePath)} and no PROPERTY_SOAK_SECONDS.`,
    );
  });
});

describe('soakAssert', () => {
  it('logs the count when a soak passes', () => {
    const lines: string[] = [];

    soakAssert({ seconds: 1, seed: undefined, path: undefined }, (line) => {
      lines.push(line);
    })(fc.property(fc.boolean(), () => {}));

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Soak passed: \d+ inputs in 1 s\.$/);
  });

  it('throws when a soak fails', () => {
    const failing = fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
      expect(n).toBeLessThan(5);
    });

    expect(() => {
      soakAssert({ seconds: 1, seed: undefined, path: undefined }, () => {})(failing);
    }).toThrow('Counterexample: [5]');
  });

  it('replays through fc.assert when there is no budget', () => {
    const failing = fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
      expect(n).toBeLessThan(5);
    });
    const { seed, counterexamplePath } = fc.check(failing, { seed: 3 });

    expect(() => {
      soakAssert({ seconds: undefined, seed, path: counterexamplePath ?? undefined }, () => {})(
        failing,
      );
    }).toThrow('Counterexample: [5]');
  });

  it('refuses an async property', () => {
    const async = fc.asyncProperty(fc.boolean(), async () => {});

    expect(() => {
      // @ts-expect-error -- the soak takes synchronous properties only, and checks at run time too.
      soakAssert(budget, () => {})(async);
    }).toThrow('A soak runs synchronous properties only; this one is async.');
  });
});
