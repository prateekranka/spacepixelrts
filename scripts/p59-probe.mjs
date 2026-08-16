/**
 * P59 integrator probes — load stress, iPad touch, marshal bugs.
 * Usage: node scripts/p59-probe.mjs [--url URL]
 */
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const URL = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'https://spacepixelrts.pages.dev';

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

// --- Opening + desktop load stress ---
{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(URL, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2500);

  const opening = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const p = window.__STARHOLD__;
    let helionLiving = 0,
      kryosLiving = 0,
      kryosCorpses = 0,
      sparks = 0;
    for (const e of w.ents) {
      if (!e.alive) continue;
      if (e.team === 0 && e.kind === 2) helionLiving++;
      if (e.team === 1 && e.kind === 2) kryosLiving++;
      if (!e.alive && e.team === 1 && e.kind === 2 && e.corpseT > 0) kryosCorpses++;
    }
    for (const s of w.sparks || []) if (s.active) sparks++;
    // HP bar rule at opening
    let hpBars = 0;
    for (const e of w.ents) {
      if (!e.alive) continue;
      const damaged = e.hp < e.maxHp;
      const inCombat = e.order === 1; // Ord.Attack
      if (w.tick < 240 && damaged && !inCombat) hpBars++;
    }
    return {
      tick: w.tick,
      version: p.version,
      ents: p.ents,
      helionLiving,
      kryosLiving,
      kryosCorpses,
      sparks,
      hpBarsOpening: hpBars,
      hitSfx: p.hitSfx,
      civ: p.civ,
    };
  });
  out.opening = opening;

  // Attack-lock: select player fighter, right-click empty ground near clash — expect Move not Attack re-lock
  const attackLock = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const input = window.__STARHOLD_INPUT__;
    const view = window.__STARHOLD_VIEW__;
    let fighter = null;
    for (const e of w.ents) {
      if (e.alive && e.team === 0 && e.kind === 2 && w.tick < 240) {
        fighter = e;
        break;
      }
    }
    if (!fighter) return { error: 'no fighter' };
    input.selected.clear();
    input.selected.add(fighter.id);
    const before = fighter.order;
    // Ground behind clash belt
    const sx = view.project(28, 0.6, 40);
    const host = document.querySelector('#game');
    const r = host.getBoundingClientRect();
    const cx = r.left + sx.x;
    const cy = r.top + sx.y;
    host.dispatchEvent(
      new PointerEvent('pointerdown', { clientX: cx, clientY: cy, button: 2, bubbles: true }),
    );
    host.dispatchEvent(
      new PointerEvent('pointerup', { clientX: cx, clientY: cy, button: 2, bubbles: true }),
    );
    const after = fighter.order;
    return { tick: w.tick, before, after, tx: fighter.tx, tz: fighter.tz, reissuedAttack: after === 1 };
  });
  out.attackLock = attackLock;

  // Natural skirmish at tick 420
  const skirmish = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const target = 420;
    while (w.tick < target) w.step();
    let alive = 0,
      military = 0;
    for (const e of w.ents) {
      if (e.alive) {
        alive++;
        if (e.kind >= 1 && e.kind <= 6) military++;
      }
    }
    return { tick: w.tick, alive, military, teams: window.__STARHOLD__.teams };
  });
  out.skirmishTick420 = skirmish;

  const skirmishFps = await page.evaluate(async () => {
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
    const p = window.__STARHOLD__;
    return {
      avgFrameMs: Math.round(avg * 100) / 100,
      p99FrameMs: Math.round(p99 * 100) / 100,
      framesWorseThan45fps: deltas.filter((d) => d > 22).length,
      probeFps: p.fps,
      ents: p.ents,
      rendererInfo: p.rendererInfo,
    };
  }, 2000);
  out.skirmishFps = skirmishFps;

  // Stress spawn ~250 military
  const stress = await page.evaluate(() => {
    const w = window.__STARHOLD_WORLD__;
    const Kind = { Fighter: 2, Siege: 3, Scout: 1 };
    let spawned = 0;
    for (let z = 8; z < 64 && spawned < 180; z += 2) {
      for (let x = 8; x < 64 && spawned < 180; x += 2) {
        const team = spawned % 2;
        const kind = spawned % 5 === 0 ? Kind.Siege : Kind.Fighter;
        const e = w.spawn(kind, w.civ[team], team, x + 0.5, z + 0.5);
        if (e) {
          e.alive = true;
          e.hp = e.maxHp;
          e.vis = true;
          spawned++;
        }
      }
    }
    let alive = 0;
    for (const e of w.ents) if (e.alive) alive++;
    return { spawned, alive, max: window.__STARHOLD__.max };
  });
  out.stressSpawn = stress;

  const stressFps = await page.evaluate(async () => {
    const deltas = [];
    let last = performance.now();
    const start = last;
    // step sim during measure
    const w = window.__STARHOLD_WORLD__;
    let steps = 0;
    await new Promise((resolve) => {
      function frame(now) {
        deltas.push(now - last);
        last = now;
        if (steps++ % 2 === 0) w.step();
        if (now - start < 3000) requestAnimationFrame(frame);
        else resolve();
      }
      requestAnimationFrame(frame);
    });
    deltas.sort((a, b) => a - b);
    const avg = deltas.reduce((s, d) => s + d, 0) / deltas.length;
    const p99 = deltas[Math.floor(deltas.length * 0.99)] ?? avg;
    const p = window.__STARHOLD__;
    return {
      avgFrameMs: Math.round(avg * 100) / 100,
      p99FrameMs: Math.round(p99 * 100) / 100,
      framesWorseThan45fps: deltas.filter((d) => d > 22).length,
      framesWorseThan60fps: deltas.filter((d) => d > 16.67).length,
      probeFps: p.fps,
      ents: p.ents,
      rendererInfo: p.rendererInfo,
    };
  });
  out.stressFps = stressFps;

  await page.close();
}

// --- iPad Air landscape ---
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

  const touchTargets = await page.evaluate(() => {
    const vp = document.querySelector('meta[name=viewport]')?.getAttribute('content') || '';
    const idlew = document.querySelector('#idlew');
    const cmds = [...document.querySelectorAll('#cmds button.verb')].slice(0, 4);
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return {
        w: r.width,
        h: r.height,
        minW: cs.minWidth,
        minH: cs.minHeight,
      };
    };
    return {
      viewportMeta: vp,
      viewportFitCover: vp.includes('viewport-fit=cover'),
      idlew: idlew ? rect(idlew) : null,
      verbs: cmds.map((b) => ({ cmd: b.dataset.cmd, ...rect(b) })),
      bottomBar: document.querySelector('#bottom')?.getBoundingClientRect(),
      innerH: window.innerHeight,
      safeAreaPadding: {
        top: getComputedStyle(document.documentElement).getPropertyValue('padding-top'),
        bottom: getComputedStyle(document.body).getPropertyValue('padding-bottom'),
      },
      hudUsesSafeArea: [...document.styleSheets].some((ss) => {
        try {
          return [...ss.cssRules].some((r) => r.cssText?.includes('safe-area'));
        } catch {
          return false;
        }
      }),
    };
  });
  out.ipad = touchTargets;

  // Two-finger pan + pinch probe
  const gesture = await page.evaluate(() => {
    const input = window.__STARHOLD_INPUT__;
    const pan0 = { x: input.pan.x, z: input.pan.z };
    const zoom0 = input.halfH;
    const host = document.querySelector('#game');
    const r = host.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const d = 80;
    const mk = (id, x, y, type) =>
      new PointerEvent(type, {
        pointerId: id,
        pointerType: 'touch',
        clientX: x,
        clientY: y,
        bubbles: true,
        isPrimary: id === 1,
      });
    host.dispatchEvent(mk(1, cx - d, cy, 'pointerdown'));
    host.dispatchEvent(mk(2, cx + d, cy, 'pointerdown'));
    host.dispatchEvent(mk(1, cx - d - 40, cy - 20, 'pointermove'));
    host.dispatchEvent(mk(2, cx + d + 40, cy - 20, 'pointermove'));
    const pan1 = { x: input.pan.x, z: input.pan.z };
    // pinch out
    host.dispatchEvent(mk(1, cx - d - 60, cy, 'pointermove'));
    host.dispatchEvent(mk(2, cx + d + 60, cy, 'pointermove'));
    const zoom1 = input.halfH;
    host.dispatchEvent(mk(1, cx, cy, 'pointerup'));
    host.dispatchEvent(mk(2, cx, cy, 'pointerup'));
    return {
      panMoved: Math.hypot(pan1.x - pan0.x, pan1.z - pan0.z) > 0.5,
      zoomChanged: Math.abs(zoom1 - zoom0) > 0.01,
      pan0,
      pan1,
      zoom0,
      zoom1,
    };
  });
  out.ipadGestures = gesture;

  await page.close();
}

// third civ check
out.thirdCivOnScreen = {
  civsInProbe: out.opening?.civ,
  voidmarkedSpawnedInV1: false,
  note: 'main.ts sets vespari vs aurion only; voidmarked exists in type table but never spawns in skirmish',
};

await browser.close();

mkdirSync('critic/out', { recursive: true });
const path = 'critic/out/p59-probe.json';
writeFileSync(path, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 2));
console.log('\nWrote', path);
