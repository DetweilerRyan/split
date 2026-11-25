import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { readSoak, soakPlugins, soakReport, soakSettings } from './property-soak.ts';

const budget = { seconds: 2, seed: undefined, runs: undefined };

const failing: fc.IProperty<unknown> = fc.property(fc.integer({ min: 0, max: 10 }), (n) => {
  expect(n).toBeLessThan(5);
});
const passing: fc.IProperty<unknown> = fc.property(fc.integer(), () => {});

describe('readSoak', () => {
  it('returns nothing when no soak variable is set, so a normal run is untouched', () => {
    expect(readSoak({})).toBeUndefined();
    expect(
      readSoak({ PROPERTY_SOAK_SECONDS: '', PROPERTY_SEED: '', PROPERTY_RUNS: '' }),
    ).toBeUndefined();
  });

  it('reads a time budget in seconds, and a seed to soak from', () => {
    expect(readSoak({ PROPERTY_SOAK_SECONDS: '120', PROPERTY_SEED: '-42' })).toStrictEqual({
      seconds: 120,
      seed: -42,
      runs: undefined,
    });
  });

  it('reads a seed and the count of runs that reached its failure', () => {
    expect(readSoak({ PROPERTY_SEED: '-42', PROPERTY_RUNS: '359' })).toStrictEqual({
      seconds: undefined,
      seed: -42,
      runs: 359,
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

  it.each([
    ['PROPERTY_SOAK_SECONDS', '0'],
    ['PROPERTY_SOAK_SECONDS', '-5'],
    ['PROPERTY_RUNS', '0'],
  ])('refuses %s of %s', (name, value) => {
    expect(() => readSoak({ PROPERTY_SEED: '1', [name]: value })).toThrow(
      `${name} must be more than 0`,
    );
  });

  it('refuses a count of runs without its seed', () => {
    expect(() => readSoak({ PROPERTY_RUNS: '359' })).toThrow(
      'PROPERTY_RUNS replays a failure only with the PROPERTY_SEED it came from.',
    );
  });

  it('refuses a count of runs with a time budget', () => {
    expect(() =>
      readSoak({ PROPERTY_SOAK_SECONDS: '120', PROPERTY_SEED: '1', PROPERTY_RUNS: '359' }),
    ).toThrow('PROPERTY_RUNS replays a set number of runs, so leave out PROPERTY_SOAK_SECONDS.');
  });
});

describe('soakSettings', () => {
  it('runs with no limit but the clock under a time budget', () => {
    expect(soakSettings(budget)).toStrictEqual({ numRuns: Number.POSITIVE_INFINITY });
  });

  it('replays the seed for the count of runs that reached the failure', () => {
    expect(soakSettings({ seconds: undefined, seed: 9, runs: 359 })).toStrictEqual({
      seed: 9,
      numRuns: 359,
    });
  });

  it('replays a seed alone with the count the test runs anyway', () => {
    expect(soakSettings({ seconds: undefined, seed: 9, runs: undefined })).toStrictEqual({
      seed: 9,
    });
  });
});

describe('soakReport', () => {
  it('says how many inputs passed in the budget', () => {
    const details = fc.check(passing, {
      numRuns: Number.POSITIVE_INFINITY,
      plugins: [fc.interruptAfterTimeLimit(50)],
    });

    expect(soakReport(budget, details)).toBe(
      `Soak passed: ${String(details.numRuns)} inputs in 2 s.`,
    );
  });

  it('says a property that sets its own numRuns was not soaked', () => {
    expect(soakReport(budget, fc.check(passing, { numRuns: 25 }))).toBe(
      'Not soaked: this property sets its own numRuns (25), which overrides the soak.',
    );
  });

  it("adds nothing to fast-check's report of a failure it shrank to the end", () => {
    expect(
      soakReport(budget, fc.check(failing, { numRuns: Number.POSITIVE_INFINITY })),
    ).toBeUndefined();
  });

  it('says how to finish shrinking when the time limit cut it short', () => {
    const checked = fc.check(failing, { numRuns: Number.POSITIVE_INFINITY, seed: 1 });
    const details: fc.RunDetails<unknown> = { ...checked, interrupted: true };

    expect(soakReport(budget, details)).toBe(
      `The time limit cut shrinking short. To finish it, run this test alone again, with Vitest's -t and --testTimeout=0, setting PROPERTY_SEED=1 PROPERTY_RUNS=${String(checked.numRuns)} and no PROPERTY_SOAK_SECONDS.`,
    );
  });

  it('says when no input passed within the budget, which leaves nothing to replay', () => {
    const skipping: fc.IProperty<unknown> = fc.property(fc.integer(), () => {
      fc.pre(false);
    });
    const details = fc.check(skipping, {
      numRuns: Number.POSITIVE_INFINITY,
      plugins: [fc.interruptAfterTimeLimit(50)],
    });

    expect(soakReport(budget, details)).toBe(
      'No input passed within the budget: every input was skipped, or one ran longer than the budget.',
    );
  });

  it('says nothing for a replay, which fast-check reports itself', () => {
    expect(soakReport({ seconds: undefined, seed: 1, runs: 5 }, fc.check(passing))).toBeUndefined();
  });
});

describe('soakPlugins', () => {
  it('installs nothing for a replay', () => {
    expect(soakPlugins({ seconds: undefined, seed: 1, runs: 5 }, () => {})).toStrictEqual([]);
  });

  it('stops a run at the time limit and logs its count', () => {
    const lines: string[] = [];
    const plugins = soakPlugins({ seconds: 1, seed: undefined, runs: undefined }, (line) => {
      lines.push(line);
    });

    fc.assert(passing, { numRuns: Number.POSITIVE_INFINITY, plugins: [...plugins] });

    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^Soak passed: \d+ inputs in 1 s\.$/);
  });

  it("leaves a failure to fast-check's own report", () => {
    const plugins = soakPlugins(budget, () => {});

    expect(() => {
      fc.assert(failing, { numRuns: Number.POSITIVE_INFINITY, plugins: [...plugins] });
    }).toThrow('Counterexample: [5]');
  });

  it('logs for an async property too', async () => {
    const lines: string[] = [];
    const plugins = soakPlugins({ seconds: 1, seed: undefined, runs: undefined }, (line) => {
      lines.push(line);
    });

    await fc.assert(
      fc.asyncProperty(fc.integer(), async () => {}),
      { numRuns: Number.POSITIVE_INFINITY, plugins: [...plugins] },
    );

    expect(lines[0]).toMatch(/^Soak passed: \d+ inputs in 1 s\.$/);
  });
});
