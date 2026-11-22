import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

// End-to-end acceptance tests: Gherkin features in e2e/features, run by Playwright Test through
// playwright-bdd. docs/engineering/testing-conventions.md says how to write them. Both servers
// are started here and stay on this machine, so a run makes no request to the internet.
const appPort = 3100;
const signalingPort = 4455;

const testDir = defineBddConfig({
  features: 'e2e/features/*.feature',
  steps: ['e2e/screenplay/fixtures.ts', 'e2e/steps/*.ts'],
});

export default defineConfig({
  testDir,
  outputDir: 'test-results/e2e',
  forbidOnly: Boolean(process.env.CI),
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${appPort}`,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      // y-webrtc's own signaling server, so peers find each other without the public ones.
      command: 'node node_modules/y-webrtc/bin/server.js',
      env: { PORT: String(signalingPort) },
      url: `http://localhost:${signalingPort}`,
      reuseExistingServer: false,
    },
    {
      // Built here rather than reused: NEXT_PUBLIC_ variables are fixed at build time, and a
      // server already listening could be an older build pointing at the public servers.
      command: `npm run build && npm run start -- --port ${appPort}`,
      env: { NEXT_PUBLIC_WEBRTC_SIGNALING_URLS: `ws://localhost:${signalingPort}` },
      url: `http://localhost:${appPort}`,
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
