/**
 * P98 — civ-specific 8-dir worker screenshots + atlas strip dump.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5173';

mkdirSync('critic/out', { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-frame-rate-limit', '--disable-gpu-vsync'],
});

async function shot(url, out, pan) {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__STARHOLD_VIEW__ && window.__STARHOLD_INPUT__);
  await page.waitForTimeout(800);
  if (pan) {
    await page.evaluate((p) => {
      const input = window.__STARHOLD_INPUT__;
      input.pan.x = p.x;
      input.pan.z = p.z;
      input.halfH = p.halfH;
    }, pan);
    await page.waitForTimeout(400);
  }
  const version = await page.evaluate(() => window.__STARHOLD__?.version);
  await page.screenshot({ path: out });
  await page.close();
  console.log(out, version);
}

async function dumpAtlas() {
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__STARHOLD_VIEW__?.spriteAtlas);
  const data = await page.evaluate(() => {
    const atlas = window.__STARHOLD_VIEW__.spriteAtlas;
    const src = atlas.canvas;
    const y = atlas.worker8Y;
    const h = atlas.worker8H * 3;
    const c = document.createElement('canvas');
    c.width = atlas.width;
    c.height = h;
    c.getContext('2d').drawImage(src, 0, y, atlas.width, h, 0, 0, atlas.width, h);
    return {
      version: window.__STARHOLD__.version,
      worker8Y: y,
      worker8H: atlas.worker8H,
      w: atlas.width,
      h: atlas.height,
      strip: c.toDataURL('image/png'),
    };
  });
  writeFileSync('critic/out/p98-worker8-strip.png', Buffer.from(data.strip.split(',')[1], 'base64'));
  console.log('strip', data.version, data.w, 'x', data.h, 'y', data.worker8Y, 'rowH', data.worker8H);

  const cells = await page.evaluate(() => {
    const atlas = window.__STARHOLD_VIEW__.spriteAtlas;
    const src = atlas.canvas;
    const y = atlas.worker8Y;
    const h = atlas.worker8H;
    const dirs = [
      [0, 'E'],
      [1, 'NE'],
      [2, 'N'],
      [6, 'S'],
      [7, 'SE'],
    ];
    const out = {};
    for (const [dir, name] of dirs) {
      const c = document.createElement('canvas');
      c.width = 32 * 6;
      c.height = h * 6;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(src, dir * 32, y, 32, h, 0, 0, 32 * 6, h * 6);
      out[name] = c.toDataURL('image/png');
    }
    const strip3 = document.createElement('canvas');
    strip3.width = atlas.width * 3;
    strip3.height = h * 3;
    const sctx = strip3.getContext('2d');
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(src, 0, y, atlas.width, h, 0, 0, atlas.width * 3, h * 3);
    out.strip3 = strip3.toDataURL('image/png');
    return out;
  });
  for (const [name, dataUrl] of Object.entries(cells)) {
    const file =
      name === 'strip3'
        ? 'critic/out/p98-worker8-helion-x3.png'
        : `critic/out/p98-cell-helion-${name}.png`;
    writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
    console.log(file);
  }
  await page.close();
}

const MAP = 72;
const cx = MAP * 0.5;
const cz = MAP * 0.52;

await dumpAtlas();
await shot(BASE, 'critic/out/p98-helion-camp.png', { x: cx, z: cz - 5.35, halfH: 4.2 });
await shot(BASE, 'critic/out/p98-helion-close.png', { x: cx - 0.2, z: cz - 5.35, halfH: 2.4 });
await shot(BASE, 'critic/out/p98-kryos-camp.png', { x: cx, z: cz + 5.35, halfH: 4.2 });
await shot(BASE, 'critic/out/p98-kryos-close.png', { x: cx - 0.2, z: cz + 5.35, halfH: 2.4 });
await shot(`${BASE}?civ=voidmarked`, 'critic/out/p98-nihiline-camp.png', { x: cx, z: cz - 5.35, halfH: 4.2 });
await shot(`${BASE}?civ=voidmarked`, 'critic/out/p98-nihiline-close.png', { x: cx - 0.2, z: cz - 5.35, halfH: 2.4 });
await shot(BASE, 'critic/out/p98-opening.png', { x: cx, z: cz, halfH: 7.2 });

{
  const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__STARHOLD_WORLD__ && window.__STARHOLD_INPUT__);
  await page.evaluate((p) => {
    const w = window.__STARHOLD_WORLD__;
    const input = window.__STARHOLD_INPUT__;
    const workers = w.ents.filter((e) => e.alive && e.kind === 0 && e.team === 0 && e.hp > 0);
    workers.sort((a, b) => a.x - b.x || a.z - b.z);
    const shown = workers.slice(0, 8);
    shown.forEach((e, i) => {
      e.x = p.cx - 2.8 + i * 0.85;
      e.z = p.cz;
      e.px = e.x;
      e.pz = e.z;
      e.vx = 0;
      e.vz = 0;
      e.facing = i;
      e.order = 0;
    });
    input.pan.x = p.cx;
    input.pan.z = p.cz;
    input.halfH = 2.6;
  }, { cx, cz: cz - 5.35 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'critic/out/p98-helion-8dir.png' });
  await page.close();
  console.log('critic/out/p98-helion-8dir.png');
}

await browser.close();
