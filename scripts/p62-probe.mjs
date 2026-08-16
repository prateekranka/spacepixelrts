/**
 * P62 — screen-space attack pick probes.
 * Usage: node scripts/p62-probe.mjs [--url URL]
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5174';

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

const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);

out.opening = await page.evaluate(() => {
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
  return {
    tick: w.tick,
    version: p.version,
    ents: p.ents,
    helionLiving,
    kryosLiving,
    sparks,
  };
});

async function selectFighter(preOpeningOnly = false) {
  return page.evaluate((openingOnly) => {
    const w = window.__STARHOLD_WORLD__;
    const input = window.__STARHOLD_INPUT__;
    let fighter = null;
    for (const e of w.ents) {
      if (!e.alive || e.team !== 0 || e.kind !== 2) continue;
      if (openingOnly && w.tick >= 240) continue;
      fighter = e;
      break;
    }
    input.selected.clear();
    if (fighter) input.selected.add(fighter.id);
    return fighter ? fighter.id : null;
  }, preOpeningOnly);
}

// Ground move behind player rank (empty screen space, away from clash belt)
const groundSpot = await page.evaluate(() => {
  const view = window.__STARHOLD_VIEW__;
  const host = document.getElementById('app');
  const rect = host.getBoundingClientRect();
  const foot = view.project(28, 0.6, 40);
  return {
    x: rect.left + foot.x,
    y: rect.top + foot.y,
    worldX: 28,
    worldZ: 40,
  };
});

const fighterId = await selectFighter(true);
await page.mouse.click(groundSpot.x, groundSpot.y, { button: 'right' });

out.groundMove = await page.evaluate(
  ({ fid, wx, wz }) => {
    const w = window.__STARHOLD_WORLD__;
    const fighter = w.ents[fid];
    const Ord = { Move: 1, Attack: 2, Gather: 3 };
    if (!fighter?.alive) return { error: 'no fighter', tick: w.tick };
    return {
      tick: w.tick,
      order: fighter.order,
      isMove: fighter.order === Ord.Move,
      isAttack: fighter.order === Ord.Attack,
      isGather: fighter.order === Ord.Gather,
      tx: fighter.tx,
      tz: fighter.tz,
      clickX: wx,
      clickZ: wz,
      pass: fighter.order === Ord.Move,
    };
  },
  { fid: fighterId, wx: groundSpot.worldX, wz: groundSpot.worldZ },
);

// Attack on living Kryos hull (screen-space on sprite)
const hullSpot = await page.evaluate(() => {
  const w = window.__STARHOLD_WORLD__;
  const view = window.__STARHOLD_VIEW__;
  const host = document.getElementById('app');
  const rect = host.getBoundingClientRect();
  let kryos = null;
  for (const e of w.ents) {
    if (e.alive && e.team === 1 && e.kind === 2) {
      kryos = e;
      break;
    }
  }
  if (!kryos) return { error: 'no kryos' };
  const foot = view.project(kryos.x, 0.6, kryos.z);
  return {
    x: rect.left + foot.x,
    y: rect.top + foot.y,
    targetId: kryos.id,
  };
});

if (!hullSpot.error) {
  const helionId = await selectFighter(false);
  await page.mouse.click(hullSpot.x, hullSpot.y, { button: 'right' });
  out.hullAttack = await page.evaluate(
    ({ fid, targetId }) => {
      const w = window.__STARHOLD_WORLD__;
      const fighter = w.ents[fid];
      const Ord = { Attack: 2 };
      if (!fighter?.alive) return { error: 'no fighter' };
      return {
        tick: w.tick,
        order: fighter.order,
        tid: fighter.tid,
        targetId,
        isAttack: fighter.order === Ord.Attack,
        pass: fighter.order === Ord.Attack && fighter.tid === targetId,
      };
    },
    { fid: helionId, targetId: hullSpot.targetId },
  );
} else {
  out.hullAttack = hullSpot;
}

mkdirSync('critic/out', { recursive: true });
await page.screenshot({ path: 'critic/out/p62-opening.png' });
writeFileSync('critic/out/p62-probe.json', JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
await browser.close();
