// Soaks fast-check property tests for a time budget, or replays one input, from environment
// variables, so a soak edits no test file. property-soak.setup.ts puts `soakAssert` in place of
// fast-check's `assert` when a variable is set. How to use it is in property-soak.md beside this
// file; why it works as it does is in property-soak.meta.md. Read the sidecar only when changing or
// questioning it.
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import fc from 'fast-check';

/** What the environment asks for: a time budget in seconds, a seed, and a path to replay. */
export type Soak = {
  readonly seconds: number | undefined;
  readonly seed: number | undefined;
  readonly path: string | undefined;
};

/** The variables `readSoak` reads, by name. */
export const SOAK_VARIABLES = {
  seconds: 'PROPERTY_SOAK_SECONDS',
  seed: 'PROPERTY_SEED',
  path: 'PROPERTY_PATH',
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

/**
 * Reads the soak variables. Returns `undefined` when none is set, so a normal run is untouched.
 * Throws when one is malformed, or when a path is given without the seed it belongs to.
 */
export function readSoak(env: Readonly<Record<string, string | undefined>>): Soak | undefined {
  const seconds = readInteger(env, SOAK_VARIABLES.seconds);
  const seed = readInteger(env, SOAK_VARIABLES.seed);
  const rawPath = env[SOAK_VARIABLES.path];
  const path = rawPath === undefined || rawPath === '' ? undefined : rawPath;
  if (seconds === undefined && seed === undefined && path === undefined) {
    return undefined;
  }
  if (seconds !== undefined && seconds <= 0) {
    throw new Error(`${SOAK_VARIABLES.seconds} must be more than 0, not ${String(seconds)}.`);
  }
  if (path !== undefined && seed === undefined) {
    throw new Error(
      `${SOAK_VARIABLES.path} replays an input only with the ${SOAK_VARIABLES.seed} it came from.`,
    );
  }
  return { seconds, seed, path };
}

/**
 * The parameters a property runs with under a soak: the test's own, such as its `examples`, with
 * the seed and path replaced, and, for a time budget, no limit on runs but the clock.
 */
export function soakParameters(
  soak: Soak,
  parameters: fc.Parameters<unknown> | undefined,
): fc.Parameters<unknown> {
  const replay = {
    ...(soak.seed === undefined ? {} : { seed: soak.seed }),
    ...(soak.path === undefined ? {} : { path: soak.path }),
  };
  if (soak.seconds === undefined) {
    return { ...parameters, ...replay };
  }
  return {
    ...parameters,
    ...replay,
    numRuns: Number.POSITIVE_INFINITY,
    plugins: [...(parameters?.plugins ?? []), fc.interruptAfterTimeLimit(soak.seconds * 1000)],
  };
}

/** What a soak says about a run that passed, or why one failed, from fast-check's details. */
export function soakReport(
  soak: Soak,
  details: fc.RunDetails<unknown>,
): { readonly passed: boolean; readonly message: string } {
  if (!details.failed) {
    return {
      passed: true,
      message: `Soak passed: ${String(details.numRuns)} inputs in ${String(soak.seconds)} s.`,
    };
  }
  const report = fc.defaultReportMessage(details);
  if (!details.interrupted) {
    return { passed: false, message: report };
  }
  const replay = `${SOAK_VARIABLES.seed}=${String(details.seed)} ${SOAK_VARIABLES.path}=${details.counterexamplePath ?? ''}`;
  return {
    passed: false,
    message: `${report}\n\nThe time limit cut shrinking short. To finish it, run this test alone again, with Vitest's -t, setting ${replay} and no ${SOAK_VARIABLES.seconds}.`,
  };
}

function isSynchronous(property: fc.IRawProperty<unknown>): property is fc.IProperty<unknown> {
  return !property.isAsync();
}

/**
 * Stands in for `fc.assert` under a soak. With a time budget, it runs the property until the
 * clock runs out, logs how many inputs passed, and throws fast-check's report on a failure; it
 * takes synchronous properties only. With only a seed and path, it replays that input through
 * `fc.assert`, async or not, so shrinking runs to the end.
 */
export function soakAssert(soak: Soak, log: (line: string) => void) {
  return (property: fc.IRawProperty<unknown>, parameters?: fc.Parameters<unknown>): unknown => {
    const soaked = soakParameters(soak, parameters);
    if (soak.seconds === undefined) {
      return fc.assert(property, soaked);
    }
    if (!isSynchronous(property)) {
      throw new Error(
        'A soak with a time budget runs synchronous properties only; this one is async.',
      );
    }
    const report = soakReport(soak, fc.check(property, soaked));
    if (!report.passed) {
      throw new Error(report.message);
    }
    log(report.message);
    return undefined;
  };
}
