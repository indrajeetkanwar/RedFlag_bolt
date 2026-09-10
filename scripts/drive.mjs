/**
 * Drive the running app in a real browser and screenshot each key state.
 *
 * Prereq: the dev server must be running (`npm run dev`, http://localhost:5173).
 * Usage:  npm run screenshot
 *
 * Uses the system Chrome (channel: 'chrome') — no bundled browser download.
 * Screenshots land in ./screenshots/. Any console error or page error fails the run.
 */
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtures = (name) => resolve(here, 'fixtures', name);
const outDir = resolve(here, '..', 'screenshots');
mkdirSync(outDir, { recursive: true });

const BASE = process.env.APP_URL ?? 'http://localhost:5173';

const errors = [];
let shot = 0;

async function main() {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  const snap = async (label) => {
    const file = resolve(outDir, `${String(++shot).padStart(2, '0')}-${label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log('  saved', file);
  };

  // 1. Home
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.hero-section h1');
  console.log('home loaded:', await page.textContent('.hero-section h1'));
  await snap('home');

  // 2. Upload a normal screenshot from Home -> expect RED result (KA 01 AB 1234)
  await page.setInputFiles('#home-file', fixtures('ride.png'));
  await page.waitForSelector('.center-state h1'); // Analyzing
  console.log('analyzing:', await page.textContent('.center-state h1'));
  await page.waitForSelector('.result-card', { timeout: 15000 });
  const kindRed = await page.getAttribute('.result-card', 'class');
  console.log('result card class:', kindRed);
  console.log('result heading:', await page.textContent('.result-card h1'));
  await snap('result-red');
  if (!kindRed.includes('red')) errors.push(`expected red result, got "${kindRed}"`);

  // 3. Back to Check, upload a "blur" screenshot -> expect CANT READ screen
  await page.click('text=Check another ride');
  await page.waitForSelector('#ride-file', { state: 'attached' }); // hidden file input
  await page.setInputFiles('#ride-file', fixtures('blur.png'));
  await page.waitForSelector('.center-state h1');
  await page.waitForFunction(
    () => /couldn.t clearly read/i.test(document.querySelector('.center-state h1')?.textContent ?? ''),
    { timeout: 15000 }
  );
  console.log('cantRead heading:', await page.textContent('.center-state h1'));
  await snap('cant-read');

  // 4. From cantRead, "Enter vehicle number manually" -> Check screen
  await page.click('text=Enter vehicle number manually');
  await page.waitForSelector('#manual-number');
  await snap('check-manual');

  // 5. Manual check with a known CAUTION plate -> expect AMBER result
  await page.fill('#manual-number', 'KA 03 CD 4567');
  await page.click('button:has-text("Check vehicle")');
  await page.waitForSelector('.result-card', { timeout: 15000 });
  const kindAmber = await page.getAttribute('.result-card', 'class');
  console.log('manual result card class:', kindAmber);
  await snap('result-amber');
  if (!kindAmber.includes('caution')) errors.push(`expected caution result, got "${kindAmber}"`);

  await browser.close();
}

main()
  .then(() => {
    if (errors.length) {
      console.error('\nFAIL:\n - ' + errors.join('\n - '));
      process.exit(1);
    }
    console.log('\nOK — all states rendered, no console/page errors.');
  })
  .catch((e) => {
    console.error('\nDRIVER ERROR:', e);
    process.exit(1);
  });
