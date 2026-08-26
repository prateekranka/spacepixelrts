// Forge Review Deck — chromium launch with fallback chain.
// chrome channel -> /usr/bin/chromium -> playwright-bundled chromium.
// Always headless; background throttling disabled so perf samples stay honest.
import { chromium } from 'playwright';

export const BROWSER_ARGS = [
  '--disable-background-timer-throttling',
  '--disable-renderer-backgrounding',
];

const LAUNCH_ATTEMPTS = [
  { channel: 'chrome' },
  { executablePath: '/usr/bin/chromium' },
  {},
];

export async function launchBrowser() {
  let lastError = null;
  for (const opts of LAUNCH_ATTEMPTS) {
    try {
      return await chromium.launch({ headless: true, ...opts, args: BROWSER_ARGS });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('no chromium available');
}
