// Soaks fast-check property tests for a time budget, or replays a failure, from environment
// variables, so a soak edits no test file. property-soak.setup.ts applies `soakSettings` and
// `soakPlugins` through fast-check's global configuration when a variable is set. How to use it is
// in property-soak.md beside this file; why it works as it does is in property-soak.meta.md. Read
// the sidecar only when changing or questioning it.
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import fc from 'fast-check';

/** What the environment asks for: a time budget in seconds, a seed, and a count of runs. */
export type Soak = {
  readonly seconds: number | undefined;
  readonly seed: number | undefined;
  readonly runs: number | undefined;
};

/** The variables `readSoak` reads, by name. */
export const SOAK_VARIABLES = {
  seconds: 'PROPERTY_SOAK_SECONDS',
  seed: 'PROPERTY_SEED',
  runs: 'PROPERTY_RUNS',
} as const;

const INTEGER = /^-?\d+$/;

function readInteger(
  env: Readonly<Record<string, string | undefined>>,
  name: string,
): number | undefined {
  const value = env[name];
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!INTEGER.test(value)) {
    throw new Error(`${name} must be a whole number, not "${value}".`);
  }
  return Number(value);
}

function requirePositive(name: string, value: number | undefined): void {
  if (value !== undefined && value <= 0) {
    throw new Error(`${name} must be more than 0, not ${String(value)}.`);
  }
}

/**
 * Reads the soak variables. Returns `undefined` when none is set, so a normal run is untouched.
 * Throws when one is malformed, when a count of runs is given without the seed it belongs to, or
 * with a time budget, which it would contradict.
 */
export function readSoak(env: Readonly<Record<string, string | undefined>>): Soak | undefined {
  const seconds = readInteger(env, SOAK_VARIABLES.seconds);
  const seed = readInteger(env, SOAK_VARIABLES.seed);
  const runs = readInteger(env, SOAK_VARIABLES.runs);
  if (seconds === undefined && seed === undefined && runs === undefined) {
    return undefined;
  }
  requirePositive(SOAK_VARIABLES.seconds, seconds);
  requirePositive(SOAK_VARIABLES.runs, runs);
  if (runs !== undefined && seed === undefined) {
    throw new Error(
      `${SOAK_VARIABLES.runs} replays a failure only with the ${SOAK_VARIABLES.seed} it came from.`,
    );
  }
  if (runs !== undefined && seconds !== undefined) {
    throw new Error(
      `${SOAK_VARIABLES.runs} replays a set number of runs, so leave out ${SOAK_VARIABLES.seconds}.`,
    );
  }
  return { seconds, seed, runs };
}

/**
 * The global settings a soak runs with: no limit on runs for a time budget, or the count to
 * replay, and the seed when one is given. A property that sets its own `numRuns` or `seed` keeps
 * it, since fast-check's per-assertion parameters override these.
 */
export function soakSettings(soak: Soak): fc.GlobalParameters {
  const seed = soak.seed === undefined ? {} : { seed: soak.seed };
  if (soak.seconds !== undefined) {
    return { ...seed, numRuns: Number.POSITIVE_INFINITY };
  }
  if (soak.runs !== undefined) {
    return { ...seed, numRuns: soak.runs };
  }
  return seed;
}

/**
 * What a soak says about a finished property, or nothing. On a failure fast-check reports the
 * counterexample itself; this adds how to finish shrinking when the time limit cut it short.
 */
export function soakReport(soak: Soak, details: fc.RunDetails<unknown>): string | undefined {
  if (soak.seconds === undefined) {
    return undefined;
  }
  const configured = details.runConfiguration.numRuns;
  if (configured !== undefined && Number.isFinite(configured)) {
    return `Not soaked: this property sets its own numRuns (${String(configured)}), which overrides the soak.`;
  }
  if (!details.failed) {
    return `Soak passed: ${String(details.numRuns)} inputs in ${String(soak.seconds)} s.`;
  }
  if (!details.interrupted) {
    return undefined;
  }
  return `The time limit cut shrinking short. To finish it, run this test alone again, with Vitest's -t, setting ${SOAK_VARIABLES.seed}=${String(details.seed)} ${SOAK_VARIABLES.runs}=${String(details.numRuns)} and no ${SOAK_VARIABLES.seconds}.`;
}

/**
 * The plugins a soak installs globally: for a time budget, fast-check's time limit, and one that
 * logs `soakReport`. Neither throws, so `fc.assert` reports a failure as it always does, and
 * `fc.check` still returns its details.
 */
export function soakPlugins(
  soak: Soak,
  log: (line: string) => void,
): readonly fc.Plugin<unknown>[] {
  if (soak.seconds === undefined) {
    return [];
  }
  function report(): fc.PluginInstance<unknown> {
    return {
      onAllRunsComplete: (details) => {
        const line = soakReport(soak, details);
        if (line !== undefined) {
          log(line);
        }
      },
    };
  }
  return [fc.interruptAfterTimeLimit(soak.seconds * 1000), report];
}
