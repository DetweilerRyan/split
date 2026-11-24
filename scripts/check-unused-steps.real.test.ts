import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

const script = fileURLToPath(new URL('./check-unused-steps.ts', import.meta.url));
const nodeModules = fileURLToPath(new URL('../node_modules', import.meta.url));

const config = `import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';
export default defineConfig({
  testDir: defineBddConfig({ features: 'features/*.feature', steps: 'steps/*.ts' }),
});
`;
const feature = `Feature: Split a bill

  Scenario: Alice claims an item
    When Alice claims "Fries"
`;
const claimStep = `When('{word} claims {string}', async () => {});`;

/** A playwright-bdd project in a temporary folder, using this repository's packages. */
function project(steps: readonly string[]) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-steps-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  symlinkSync(nodeModules, join(cwd, 'node_modules'), 'dir');
  writeFileSync(join(cwd, 'playwright.config.ts'), config);
  mkdirSync(join(cwd, 'features'));
  writeFileSync(join(cwd, 'features/split.feature'), feature);
  mkdirSync(join(cwd, 'steps'));
  writeFileSync(
    join(cwd, 'steps/split.steps.ts'),
    `import { createBdd } from 'playwright-bdd';\nconst { Given, When } = createBdd();\n${steps.join('\n')}\n`,
  );
  return cwd;
}

function run(
  cwd: string,
  env: Readonly<Record<string, string>> = {},
  args: readonly string[] = [],
) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
}

describe('check-unused-steps', () => {
  it('passes when every step definition is used', () => {
    const result = run(project([claimStep]));
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No unused step definitions.');
  });

  it('fails and names a step definition no feature uses', () => {
    const result = run(project([claimStep, `Given('nobody writes this step', async () => {});`]));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unused steps (1):');
    expect(result.stderr).toContain('nobody writes this step');
    expect(result.stderr).toContain('steps/split.steps.ts:4');
  });

  it('checks each config -c names, and names the config with unused steps', () => {
    const cwd = project([claimStep]);
    mkdirSync(join(cwd, 'tool/features'), { recursive: true });
    mkdirSync(join(cwd, 'tool/steps'));
    writeFileSync(join(cwd, 'tool/playwright.config.ts'), config);
    writeFileSync(join(cwd, 'tool/features/split.feature'), feature);
    writeFileSync(
      join(cwd, 'tool/steps/split.steps.ts'),
      `import { createBdd } from 'playwright-bdd';\nconst { Given, When } = createBdd();\n${claimStep}\nGiven('only the tool has this step', async () => {});\n`,
    );

    const both = run(cwd, {}, ['-c', 'playwright.config.ts', '-c', 'tool/playwright.config.ts']);
    expect(both.status).toBe(1);
    expect(both.stderr).toContain('tool/playwright.config.ts:');
    expect(both.stderr).toContain('Unused steps (1):');
    expect(both.stderr).toContain('only the tool has this step');
    expect(run(cwd, {}, ['-c', 'playwright.config.ts']).status).toBe(0);
  });

  it("fails with bddgen's error when bddgen itself fails", () => {
    // Two definitions match "Alice claims "Fries"".
    const result = run(project([claimStep, `When('Alice claims {string}', async () => {});`]));
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Multiple definitions matched scenario step.');
  });

  it("fails when bddgen's output has no count to read", () => {
    const cwd = project([claimStep]);
    const fake = join(cwd, 'fake-bddgen.mjs');
    writeFileSync(fake, "console.log('Some other report format');\n");
    const result = run(cwd, { BDDGEN_CLI: fake });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Couldn\'t find the "Unused steps (<n>):" line');
    expect(result.stderr).toContain('Some other report format');
  });
});
