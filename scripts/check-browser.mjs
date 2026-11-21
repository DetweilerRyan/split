// Launches the headless Chromium the browser test project uses and renders a page, so setup
// can report a broken browser instead of leaving it for a test to fail on. Run by
// scripts/prepare-sandbox.sh; exits 1 with Playwright's error when the browser can't start.
import { chromium } from 'playwright';

const marker = 'splitsmart-browser-check';
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setContent(`<p>${marker}</p>`);
  if ((await page.textContent('p')) !== marker) throw new Error('the page did not render');
  console.log('Headless Chromium launched and rendered a page.');
} catch (error) {
  console.error(`Headless Chromium did not launch: ${error.message.split('\n')[0]}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
}
