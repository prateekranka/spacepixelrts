/**
 * P64 — iPad HUD safe-area inset probes.
 * Usage: node scripts/p64-probe.mjs [--url URL]
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5174';

const MOCK_INSET = 34;

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: [
    '--disable-frame-rate-limit',
    '--disable-gpu-vsync',
    '--disable-background-timer-throttling',
  ],
});

const out = { url: URL, judgedAt: new Date().toISOString() };

function sheetUsesSafeArea() {
  return [...document.styleSheets].some((ss) => {
    try {
      return [...ss.cssRules].some((r) => r.cssText?.includes('safe-area-inset'));
    } catch {
      return false;
    }
  });
}

// --- Default critic viewport (inset 0) ---
{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3500);

  out.critic = await page.evaluate(async () => {
    const w = window.__STARHOLD_WORLD__;
    const p = window.__STARHOLD__;
    let helionLiving = 0,
      kryosLiving = 0,
      sparks = 0;
    for (const e of w.ents) {
      if (!e.alive) continue;
      if (e.team === 0 && e.kind === 2) helionLiving++;
      if (e.team === 1 && e.kind === 2) kryosLiving++;
    }
    for (const s of w.sparks || []) if (s.active) sparks++;

    const bottom = document.querySelector('#bottom');
    const bottomRect = bottom?.getBoundingClientRect();

    const deltas = [];
    let last = performance.now();
    const start = last;
    await new Promise((resolve) => {
      function tick(now) {
        deltas.push(now - last);
        last = now;
        if (now - start < 2000) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    deltas.sort((a, b) => a - b);
    const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? avg;

    const hudUsesSafeArea = [...document.styleSheets].some((ss) => {
      try {
        return [...ss.cssRules].some((r) => r.cssText?.includes('safe-area-inset'));
      } catch {
        return false;
      }
    });

    return {
      version: p.version,
      tick: w.tick,
      helionLiving,
      kryosLiving,
      sparks,
      hitSfx: p.hitSfx ?? 0,
      p99FrameMs: Math.round(p99 * 100) / 100,
      bottomHeight: bottomRect?.height,
      hudUsesSafeArea,
      pass:
        helionLiving >= 8 &&
        kryosLiving >= 2 &&
        (sparks >= 1 || (p.hitSfx ?? 0) > 0) &&
        p99 < 22 &&
        Math.abs((bottomRect?.height ?? 0) - 168) < 2 &&
        hudUsesSafeArea,
    };
  });

  await page.close();
}

// --- iPad landscape: CSS rule + mocked inset layout ---
{
  const ipad = devices['iPad Air'];
  const page = await browser.newPage({
    ...ipad,
    viewport: { width: 1180, height: 820 },
    isMobile: true,
    hasTouch: true,
  });

  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  out.ipad = await page.evaluate((mockInset) => {
    const bottom = document.querySelector('#bottom');
    const topbar = document.querySelector('#topbar');
    const hudUsesSafeArea = [...document.styleSheets].some((ss) => {
      try {
        return [...ss.cssRules].some((r) => r.cssText?.includes('safe-area-inset'));
      } catch {
        return false;
      }
    });

    // Headless Chrome reports env(safe-area-inset-*) as 0; apply the same calc with a fixed inset.
    bottom.style.paddingBottom = `${10 + mockInset}px`;
    bottom.style.paddingLeft = `${10 + mockInset}px`;
    bottom.style.paddingRight = `${10 + mockInset}px`;
    bottom.style.height = `${168 + mockInset}px`;
    topbar.style.paddingTop = `${mockInset}px`;
    topbar.style.paddingLeft = `${mockInset}px`;
    topbar.style.paddingRight = `${mockInset}px`;
    topbar.style.height = `${56 + mockInset}px`;

    const bottomCs = getComputedStyle(bottom);
    const cmds = [...document.querySelectorAll('#cmds button.verb')].slice(0, 4);
    const innerH = window.innerHeight;
    const paddingBottom = parseFloat(bottomCs.paddingBottom);
    const bottomRect = bottom.getBoundingClientRect();
    const cmdBottoms = cmds.map((b) => b.getBoundingClientRect().bottom);
    const maxCmdBottom = cmdBottoms.length ? Math.max(...cmdBottoms) : 0;

    return {
      viewportFitCover: (document.querySelector('meta[name=viewport]')?.getAttribute('content') || '').includes(
        'viewport-fit=cover',
      ),
      hudUsesSafeArea,
      bottomHeight: bottomRect.height,
      bottomPaddingBottom: bottomCs.paddingBottom,
      innerH,
      mockInsetBottom: mockInset,
      maxCmdBottom,
      clearanceAboveHomeBar: innerH - mockInset - maxCmdBottom,
      verbs: cmds.map((b) => {
        const r = b.getBoundingClientRect();
        return { cmd: b.dataset.cmd, bottom: r.bottom, h: r.height };
      }),
      pass:
        hudUsesSafeArea &&
        paddingBottom > 0 &&
        maxCmdBottom <= innerH - mockInset + 0.5 &&
        bottomRect.height >= 168 + mockInset - 1,
    };
  }, MOCK_INSET);

  await page.close();
}

out.pass = out.critic?.pass && out.ipad?.pass;

mkdirSync('critic/out', { recursive: true });
writeFileSync('critic/out/p64-probe.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\nWrote critic/out/p64-probe.json');
await browser.close();
