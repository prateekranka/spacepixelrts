/**
 * Capture a PNG of the running game.
 * Usage: node scripts/screenshot.mjs [--url http://localhost:5173] [--out critic/out/shot.png]
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const args = process.argv.slice(2);
function argVal(flag, dflt) {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : dflt;
}
const URL = argVal('--url', 'http://localhost:5173');
const OUT = argVal('--out', 'critic/out/shot.png');
mkdirSync(dirname(OUT), { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: OUT });
console.log(OUT);
await browser.close();
