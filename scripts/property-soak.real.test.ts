import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const setup = fileURLToPath(new URL('./property-soak.setup.ts', import.meta.url));
const vitest = join(root, 'node_modules/.bin/vitest');

// A property that runs fast-check's default count, which a run without soak variables keeps.
const counts = `import fc from 'fast-check';
import { expect, it } from 'vitest';

it('runs the default count', () => {
  let runs = 0;
  fc.assert(fc.property(fc.integer(), () => { runs += 1; }));
  expect(runs).toBe(100);
});
`;

// A property that passes, one that fails on one input in every 9,973, which a soak finds within a
// second, and one that sets its own count, which a soak can't change.
const soaks = `import fc from 'fast-check';
import { expect, it } from 'vitest';

it('holds', () => {
  fc.assert(fc.property(fc.integer(), (n) => { expect(Number.isInteger(n)).toBe(true); }));
});

it('breaks', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 2_000_000 }), (n) => { expect(n % 9_973 === 7 && n > 1000).toBe(false); }));
});

it('sets its own count', () => {
  let runs = 0;
  fc.assert(fc.property(fc.integer(), () => { runs += 1; }), { numRuns: 20 });
  expect(runs).toBe(20);
});
`;

/** A Vitest project in a temporary folder, using this repository's packages and setup file. */
function project() {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-soak-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  symlinkSync(join(root, 'node_modules'), join(cwd, 'node_modules'), 'dir');
  writeFileSync(
    join(cwd, 'vitest.config.ts'),
    `export default { test: { include: ['*.test.ts'], setupFiles: [${JSON.stringify(setup)}] } };\n`,
  );
  writeFileSync(join(cwd, 'counts.test.ts'), counts);
  writeFileSync(join(cwd, 'soaks.test.ts'), soaks);
  return cwd;
}

// The parent's environment, without any soak variable a shell may have set, or the settings that
// change Vitest's output in CI: forced colour, and GitHub's reporter.
const inherited = Object.fromEntries(
  Object.entries(process.env).filter(
    ([name]) =>
      !name.startsWith('PROPERTY_') && name !== 'FORCE_COLOR' && name !== 'GITHUB_ACTIONS',
  ),
);

function run(cwd: string, args: readonly string[], env: Readonly<Record<string, string>>) {
  const result = spawnSync(
    vitest,
    ['run', '--testTimeout=0', '--silent=false', '--coverage.enabled=false', ...args],
    {
      cwd,
      encoding: 'utf8',
      env: { ...inherited, NODE_ENV: 'test', CI: '1', NO_COLOR: '1', ...env },
    },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

// Each test starts Vitest, and a soak runs for a second per property.
describe('property soak', { timeout: 60_000 }, () => {
  it('leaves a run without soak variables at the default count', () => {
    const result = run(project(), ['counts.test.ts'], {});

    expect(result.output).not.toContain('Soak passed');
    expect(result.status).toBe(0);
  });

  it('soaks each property without its own count, and says which it could not', () => {
    const result = run(project(), ['soaks.test.ts'], { PROPERTY_SOAK_SECONDS: '1' });

    expect(result.output).toMatch(/Soak passed: \d+ inputs in 1 s\./);
    expect(result.output).toMatch(/Counterexample: \[\d+\]/);
    expect(result.output).toContain(
      'Not soaked: this property sets its own numRuns (20), which overrides the soak.',
    );
    expect(result.output).toContain('1 failed | 2 passed');
    expect(result.status).toBe(1);
  });

  it('replays a failure from its seed and count of runs, with no budget', () => {
    const cwd = project();
    const soaked = run(cwd, ['soaks.test.ts', '-t', 'breaks'], {
      PROPERTY_SOAK_SECONDS: '1',
    }).output;
    const seed = /seed: (-?\d+)/.exec(soaked)?.[1] ?? '';
    const runs = /Property failed after (\d+) tests/.exec(soaked)?.[1] ?? '';
    const counterexample = /Counterexample: \[\d+\]/.exec(soaked)?.[0] ?? 'none';

    const replayed = run(cwd, ['soaks.test.ts', '-t', 'breaks'], {
      PROPERTY_SEED: seed,
      PROPERTY_RUNS: runs,
    });

    expect(replayed.output).toContain(`Property failed after ${runs} tests`);
    expect(replayed.output).toContain(counterexample);
    expect(replayed.output).not.toContain('Soak passed');
    expect(replayed.status).toBe(1);
  });

  // A count of runs without its seed makes the setup file throw before any test runs, so this
  // shows each config loads it without running the repository's own properties.
  it.each([
    ['vitest.config.ts', 'src/domain/money/currency.property.test.ts'],
    ['vitest.tooling.config.ts', 'scripts/mutation.property.test.ts'],
  ])('is loaded by %s', (config, file) => {
    const result = run(root, ['-c', config, file], { PROPERTY_RUNS: '1' });

    expect(result.output).toContain(
      'PROPERTY_RUNS replays a failure only with the PROPERTY_SEED it came from.',
    );
    expect(result.output).not.toContain('Soak passed');
    expect(result.status).not.toBe(0);
  });
});
