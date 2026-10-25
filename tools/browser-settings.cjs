// Shared browser settings; the site itself has no package/build dependencies.
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const url = (process.env.PORTFOLIO_URL || 'http://127.0.0.1:8082').replace(/\/$/, '');
const shots = process.env.SCREENSHOT_DIR || '/tmp/portfolio-checks';
mkdirSync(shots, { recursive: true });
const browserOptions = { headless: true, executablePath: process.env.BROWSER_EXECUTABLE || undefined };
async function setSystemMotion(page, reducedMotion) {
  await page.emulateMedia({ reducedMotion });
  // MediaQueryList change is delivered asynchronously. Wait for the visible
  // control to acknowledge it before inspecting animations or clicking it.
  await page.waitForFunction(expected => document.querySelector('#motion').getAttribute('aria-pressed') === String(expected), reducedMotion === 'reduce');
}
module.exports = { chromium, url, shots, browserOptions, setSystemMotion };
