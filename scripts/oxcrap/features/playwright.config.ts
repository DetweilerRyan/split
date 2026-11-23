import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// oxCrap's contract: Gherkin features beside this file, run end to end against the CLI by
// Playwright Test through playwright-bdd, with no browser. `npm run test:tooling` runs them.
// docs/engineering/testing-conventions.md says how to write them. Paths here are read from this
// file's folder.
const testDir = defineBddConfig({
  features: '*.feature',
  steps: ['screenplay/fixtures.ts', '*.steps.ts'],
});

export default defineConfig({
  testDir,
  outputDir: 'test-results',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
});
