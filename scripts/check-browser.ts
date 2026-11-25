// Launches the headless Chromium the browser test project uses and renders a page, so setup
// can report a broken browser instead of leaving it for a test to fail on. Run by
// scripts/prepare-sandbox.sh; exits 1 with Playwright's error when the browser can't start.
import { chromium } from 'playwright';

const marker = 'splitsmart-browser-check';

/** Launches the browser and renders a page in it, and throws if either fails. */
async function renderPage() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<p>${marker}</p>`);
    if ((await page.textContent('p')) !== marker) throw new Error('the page did not render');
  } finally {
    await browser.close();
  }
}

try {
  await renderPage();
  console.log('Headless Chromium launched and rendered a page.');
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Headless Chromium did not launch: ${message.split('\n')[0]}`);
  process.exitCode = 1;
}
