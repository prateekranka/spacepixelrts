/**
 * P99 — Helion option-5 worker atlas cells and isolated action shots.
 *
 * The page is driven through the existing runtime harness. No second server is
 * started; each live shot freezes the world after staging the same camp workers.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv.includes('--url')
  ? process.argv[process.argv.indexOf('--url') + 1]
  : 'http://127.0.0.1:5173';
const OUT = 'critic/out';
const VIEWPORT = { width: 1180, height: 820 };
const MAP = 72;
const CX = MAP * 0.5;
const CZ = MAP * 0.52;

const ORD = {
  Idle: 0,
  Move: 1,
  Attack: 2,
  Gather: 3,
  Return: 4,
  Build: 5,
};
const TILE = {
  Ore: 3,
  Gas: 4,
  Solar: 5,
};

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--disable-frame-rate-limit', '--disable-gpu-vsync', '--disable-background-timer-throttling'],
});

async function ready(page) {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__STARHOLD_WORLD__ && window.__STARHOLD_INPUT__);
}

async function dumpCells() {
  const page = await browser.newPage({ viewport: VIEWPORT });
  try {
    await ready(page);
    await page.waitForFunction(() => window.__STARHOLD_VIEW__?.spriteAtlas?.canvas);
    const data = await page.evaluate(() => {
      const atlas = window.__STARHOLD_VIEW__.spriteAtlas;
      const source = atlas.canvas;
      const dirs = [
        [0, 'E'],
        [2, 'N'],
        [6, 'S'],
      ];
      const cells = {};
      for (const [dir, name] of dirs) {
        const c = document.createElement('canvas');
        c.width = atlas.cell * 6;
        c.height = atlas.worker8H * 6;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          source,
          dir * atlas.cell,
          atlas.worker8Y,
          atlas.cell,
          atlas.worker8H,
          0,
          0,
          c.width,
          c.height,
        );
        cells[name] = c.toDataURL('image/png');
      }
      const buildDirs = [
        [0, 'build-E'],
        [6, 'build-S'],
        [7, 'build-SE'],
      ];
      for (const [dir, name] of buildDirs) {
        const c = document.createElement('canvas');
        c.width = atlas.cell * 6;
        c.height = atlas.worker8ActionH * 6;
        const ctx = c.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
          source,
          dir * atlas.cell,
          atlas.worker8ActionY,
          atlas.cell,
          atlas.worker8ActionH,
          0,
          0,
          c.width,
          c.height,
        );
        cells[name] = c.toDataURL('image/png');
      }
      return {
        version: window.__STARHOLD__.version,
        width: atlas.width,
        height: atlas.height,
        worker8Y: atlas.worker8Y,
        worker8H: atlas.worker8H,
        worker8ActionY: atlas.worker8ActionY,
        worker8ActionH: atlas.worker8ActionH,
        cells,
      };
    });
    for (const [name, dataUrl] of Object.entries(data.cells)) {
      const file = `${OUT}/p99-cell-helion-${name}.png`;
      writeFileSync(file, Buffer.from(String(dataUrl).split(',')[1], 'base64'));
      console.log(file);
    }
    console.log(
      'atlas',
      data.version,
      `${data.width}x${data.height}`,
      `normalY=${data.worker8Y}`,
      `actionY=${data.worker8ActionY}`,
      `rowH=${data.worker8H}`,
    );
  } finally {
    await page.close();
  }
}

async function stage(page, spec) {
  await page.evaluate((p) => {
    const world = window.__STARHOLD_WORLD__;
    const input = window.__STARHOLD_INPUT__;
    const workers = world.ents.filter((e) => e.alive && e.team === 0 && e.kind === 0 && e.hp > 0);
    if (workers.length < 3) throw new Error(`P99 needs three living Helion workers, found ${workers.length}`);

    for (const e of world.ents) {
      e.vis = false;
      if (e.kind === 0) {
        e.vx = 0;
        e.vz = 0;
        e.path = null;
        e.tid = -1;
      }
    }

    const offsets = p.offsets ?? [-1, 0, 1];
    const facings = p.facings ?? [6, 0, 7];
    const velocities = p.velocities ?? offsets.map(() => [p.vx ?? 0, p.vz ?? 0]);
    workers.slice(0, 3).forEach((e, i) => {
      e.x = p.cx + offsets[i];
      e.z = p.cz + (p.zOffsets?.[i] ?? 0);
      e.px = e.x;
      e.pz = e.z;
      e.tx = e.x;
      e.tz = e.z;
      e.vx = velocities[i][0];
      e.vz = velocities[i][1];
      e.facing = facings[i] & 7;
      e.order = p.order;
      e.cargo = p.cargo;
      e.cargoType = p.cargoType;
      e.anim = p.anim ?? 0.25;
      e.hp = e.maxHp;
      e.dissolveT = 0;
      e.corpseT = 0;
      e.combatT = 0;
      e.vis = true;
    });

    world.flags.length = 0;
    world.bolts.length = 0;
    for (const spark of world.sparks) spark.active = false;
    world.tick = 300;
    world.step = () => {};
    input.selected.clear();
    input.box = null;
    input.pan.x = p.cx;
    input.pan.z = p.cz;
    input.halfH = p.halfH ?? 2.7;
  }, spec);
  await page.waitForTimeout(140);
}

async function liveShot(file, spec) {
  const page = await browser.newPage({ viewport: VIEWPORT });
  try {
    await ready(page);
    await stage(page, { cx: CX, cz: CZ, ...spec });
    await page.screenshot({ path: `${OUT}/${file}` });
    console.log(`${OUT}/${file}`);
  } finally {
    await page.close();
  }
}

try {
  await dumpCells();

  await liveShot('p99-helion-close.png', {
    order: ORD.Idle,
    cargo: 0,
    cargoType: TILE.Ore,
    facings: [6, 0, 2],
    offsets: [-1, 0, 1],
    halfH: 2.7,
  });
  await liveShot('p99-helion-walk.png', {
    order: ORD.Move,
    cargo: 0,
    cargoType: TILE.Ore,
    facings: [0, 6, 7],
    offsets: [-1, 0, 1],
    velocities: [[0.72, 0], [0, 0.72], [0.58, -0.58]],
    halfH: 2.7,
  });
  await liveShot('p99-helion-build.png', {
    order: ORD.Build,
    cargo: 0,
    cargoType: TILE.Ore,
    facings: [6, 0, 7],
    offsets: [-1.7, 0, 1.7],
    halfH: 2.7,
  });
  await liveShot('p99-helion-food.png', {
    order: ORD.Gather,
    cargo: 6,
    cargoType: TILE.Solar,
    facings: [6, 0, 7],
    offsets: [-1, 0, 1],
    halfH: 2.7,
  });
  await liveShot('p99-helion-crystal.png', {
    order: ORD.Return,
    cargo: 6,
    cargoType: TILE.Ore,
    facings: [6, 0, 7],
    offsets: [-1, 0, 1],
    halfH: 2.7,
  });
  await liveShot('p99-helion-attack.png', {
    order: ORD.Attack,
    cargo: 0,
    cargoType: TILE.Ore,
    facings: [6, 0, 7],
    offsets: [-1, 0, 1],
    halfH: 2.7,
  });
} finally {
  await browser.close();
}
