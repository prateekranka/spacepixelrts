// Forge Review Deck — chromium launch with fallback chain.
// chrome channel -> /usr/bin/chromium -> playwright-bundled chromium.
// Always headless; background throttling disabled so perf samples stay honest.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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

function ensureWritableTmpDir() {
  if (process.env.TMPDIR) return process.env.TMPDIR;
  const candidates = [path.join(os.homedir(), '.cache'), '/tmp'];
  for (const candidate of candidates) {
    try {
      fs.mkdirSync(candidate, { recursive: true });
      const probe = path.join(candidate, `.frd-tmp-probe-${process.pid}`);
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      process.env.TMPDIR = candidate;
      return candidate;
    } catch {
      /* try next */
    }
  }
  return os.tmpdir();
}

export async function launchBrowser() {
  ensureWritableTmpDir();
  let lastError = null;
  for (const opts of LAUNCH_ATTEMPTS) {
    try {
      return await chromium.launch({
        headless: true,
        ignoreDefaultArgs: ['--disable-dev-shm-usage'],
        ...opts,
        args: BROWSER_ARGS,
      });
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('no chromium available');
}
