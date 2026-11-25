import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

const root = fileURLToPath(new URL('..', import.meta.url));
const setup = fileURLToPath(new URL('./property-soak.setup.ts', import.meta.url));
const vitest = join(root, 'node_modules/.bin/vitest');

// A property that fails on one input in every 9,973. Its fixed seed, which a soak keeps, makes both
// runs the same every time: 20 runs pass, and a soak finds a failure within a second.
const tests = `import fc from 'fast-check';
import { expect, it } from 'vitest';

it('holds', () => {
  fc.assert(fc.property(fc.integer(), (n) => { expect(Number.isInteger(n)).toBe(true); }), { numRuns: 20 });
});

it('breaks', () => {
  fc.assert(fc.property(fc.integer({ min: 0, max: 2_000_000 }), (n) => { expect(n % 9_973 === 7 && n > 1000).toBe(false); }), { numRuns: 20, examples: [[0]], seed: 42 });
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
  writeFileSync(join(cwd, 'soak.test.ts'), tests);
  return cwd;
}

// The parent's environment, without any soak variable a shell may have set.
const inherited = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('PROPERTY_')),
);

function run(cwd: string, args: readonly string[], env: Readonly<Record<string, string>>) {
  const result = spawnSync(
    vitest,
    ['run', '--testTimeout=0', '--silent=false', '--coverage.enabled=false', ...args],
    {
      cwd,
      encoding: 'utf8',
      env: { ...inherited, NODE_ENV: 'test', CI: '1', ...env },
    },
  );
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

// Each test starts Vitest, and a soak runs for a second per property.
describe('property soak', { timeout: 60_000 }, () => {
  it('leaves a run without soak variables as the test wrote it', () => {
    const result = run(project(), [], {});

    expect(result.output).not.toContain('Soak passed');
    expect(result.status).toBe(0);
  });

  it('soaks each property for the budget, and reports the count or the failure', () => {
    const result = run(project(), [], { PROPERTY_SOAK_SECONDS: '1' });

    expect(result.output).toMatch(/Soak passed: \d+ inputs in 1 s\./);
    expect(result.output).toMatch(/Counterexample: \[\d+\]/);
    expect(result.status).toBe(1);
  });

  it('replays a seed and path with full shrinking and no budget', () => {
    const cwd = project();
    const soaked = run(cwd, ['-t', 'breaks'], { PROPERTY_SOAK_SECONDS: '1' }).output;
    const seed = /seed: (-?\d+)/.exec(soaked)?.[1] ?? '';
    const path = /path: "([\d:]+)"/.exec(soaked)?.[1] ?? '';
    const counterexample = /Counterexample: \[\d+\]/.exec(soaked)?.[0] ?? 'none';

    const replayed = run(cwd, ['-t', 'breaks'], { PROPERTY_SEED: seed, PROPERTY_PATH: path });

    expect(replayed.output).toContain(counterexample);
    expect(replayed.output).not.toContain('Soak passed');
    expect(replayed.status).toBe(1);
  });

  // A path without its seed makes the setup file throw before any test runs, so this shows each
  // config loads it without running the repository's own properties.
  it.each([
    ['vitest.config.ts', 'src/domain/money/currency.property.test.ts'],
    ['vitest.tooling.config.ts', 'scripts/mutation.property.test.ts'],
  ])('is loaded by %s', (config, file) => {
    const result = run(root, ['-c', config, file], { PROPERTY_PATH: '0' });

    expect(result.output).toContain(
      'PROPERTY_PATH replays an input only with the PROPERTY_SEED it came from.',
    );
    expect(result.output).not.toContain('Soak passed');
    expect(result.status).not.toBe(0);
  });
});
