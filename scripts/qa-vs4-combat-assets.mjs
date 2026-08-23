#!/usr/bin/env node
/** VS-4 — deterministic combat-strip export and runtime proof. */

import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIEWPORT = { width: 1366, height: 1024 };
const CELL = 64;
const MAG = [255, 0, 255, 255];
const P99_BUDGET_MS = 8;
const QUIET_TERRAIN_LUMA = 30;
const R3_LUMA_FLOOR = QUIET_TERRAIN_LUMA * 3;
const NAV_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 30000;
const SERVER_BOOT_TIMEOUT_MS = 120000;
const EXPECTED_MAPPINGS = [
  { kind: 2, civ: 0, row: 0 },
  { kind: 4, civ: 0, row: 1 },
  { kind: 2, civ: 1, row: 2 },
  { kind: 5, civ: 1, row: 3 },
];
const EXPECTED_WORLD_SCALES = [
  { kind: 2, civ: 0, row: 0, scale: [1.59, 1.89] },
  { kind: 4, civ: 0, row: 1, scale: [2.05, 1.54] },
  { kind: 2, civ: 1, row: 2, scale: [1.67, 1.92] },
  { kind: 5, civ: 1, row: 3, scale: [2.05, 1.81] },
];

const RIM_COLORS = [
  { outer: [240, 193, 90], inner: [240, 231, 210] },
  { outer: [240, 193, 90], inner: [240, 231, 210] },
  { outer: [183, 209, 208], inner: [127, 167, 184] },
  { outer: [183, 209, 208], inner: [127, 167, 184] },
];

function assertThat(condition, message) {
  if (!condition) throw new Error(message);
}

function parseArgs(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index++) {
    const raw = argv[index];
    if (!raw.startsWith('--')) continue;
    const equals = raw.indexOf('=');
    if (equals >= 0) result[raw.slice(2, equals)] = raw.slice(equals + 1);
    else if (argv[index + 1] && !argv[index + 1].startsWith('--')) result[raw.slice(2)] = argv[++index];
    else result[raw.slice(2)] = true;
  }
  return result;
}

function resolveOut(raw) {
  if (typeof raw !== 'string' || raw.trim() === '' || !path.isAbsolute(raw)) {
    throw new Error('--out is required and must be an absolute path outside the repository');
  }
  const out = path.resolve(raw.trim());
  const relative = path.relative(REPO_ROOT, out);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`--out must be outside the repository (${REPO_ROOT})`);
  }
  return out;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function findOpenPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('could not allocate a private QA port'));
        return;
      }
      const port = address.port;
      server.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

async function startServer() {
  const port = await findOpenPort();
  const url = `http://127.0.0.1:${port}`;
  const vite = path.join(REPO_ROOT, 'node_modules', '.bin', 'vite');
  const child = spawn(vite, ['--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
    cwd: REPO_ROOT,
    detached: true,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const state = { child, url, exited: false, stopped: false };
  child.on('exit', () => { state.exited = true; });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk) => process.stdout.write(`[dev:err] ${chunk}`));
  const deadline = Date.now() + SERVER_BOOT_TIMEOUT_MS;
  while (Date.now() < deadline && !state.exited) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1200) });
      if (response.ok) return state;
    } catch {}
    await delay(250);
  }
  await stopServer(state);
  throw new Error(state.exited ? 'Vite exited before becoming reachable' : `Vite did not become ready at ${url}`);
}

async function stopServer(server) {
  if (!server || server.stopped) return;
  server.stopped = true;
  const child = server.child;
  if (child.pid != null && child.exitCode === null && child.signalCode === null) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
    await Promise.race([once(child, 'exit').catch(() => {}), delay(4000)]);
  }
  child.stdout?.destroy();
  child.stderr?.destroy();
}

async function settleFrames(page) {
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

function dataUrlBuffer(dataUrl) {
  return Buffer.from(String(dataUrl).split(',')[1], 'base64');
}

function analyzePng(file, expectedWidth, expectedHeight) {
  const png = PNG.sync.read(fs.readFileSync(file));
  assertThat(png.width === expectedWidth && png.height === expectedHeight, `${path.basename(file)} is ${png.width}x${png.height}, expected ${expectedWidth}x${expectedHeight}`);
  let exactMagenta = 0;
  let maxLuma = 0;
  let lit = 0;
  for (let i = 0; i < png.data.length; i += 4) {
    if (png.data[i] === MAG[0] && png.data[i + 1] === MAG[1] && png.data[i + 2] === MAG[2] && png.data[i + 3] === MAG[3]) exactMagenta++;
    const luma = 0.2126 * png.data[i] + 0.7152 * png.data[i + 1] + 0.0722 * png.data[i + 2];
    maxLuma = Math.max(maxLuma, luma);
    if (luma > 10) lit++;
  }
  const pixelCount = png.width * png.height;
  assertThat(maxLuma > 6 && lit / pixelCount > 0.002, `${path.basename(file)} is black or empty`);
  return {
    width: png.width,
    height: png.height,
    exactMagenta,
    maxLuma: Math.round(maxLuma * 100) / 100,
    litRatio: Math.round((lit / pixelCount) * 10000) / 10000,
  };
}

function exteriorLayerShares(png, originX, originY, row) {
  const exterior = new Uint8Array(CELL * CELL);
  const queue = [];
  const alphaAt = (x, y) => png.data[((originX + x) + (originY + y) * png.width) * 4 + 3] > 0;
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (x !== 0 && y !== 0 && x !== CELL - 1 && y !== CELL - 1) continue;
      const index = x + y * CELL;
      if (exterior[index] || alphaAt(x, y)) continue;
      exterior[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % CELL;
    const y = Math.floor(index / CELL);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue;
      const next = nx + ny * CELL;
      if (!exterior[next] && !alphaAt(nx, ny)) {
        exterior[next] = 1;
        queue.push(next);
      }
    }
  }
  const counts = [0, 0];
  const allowed = [0, 0];
  const colors = RIM_COLORS[row];
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (!alphaAt(x, y)) continue;
      let layer = 0;
      for (let radius = 1; radius <= 2 && layer === 0; radius++) {
        for (let dy = -radius; dy <= radius && layer === 0; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < CELL && ny < CELL && exterior[nx + ny * CELL]) {
              layer = radius;
              break;
            }
          }
        }
      }
      if (layer < 1 || layer > 2) continue;
      counts[layer - 1]++;
      const index = ((originX + x) + (originY + y) * png.width) * 4;
      const matches = (color) => png.data[index] === color[0] && png.data[index + 1] === color[1] && png.data[index + 2] === color[2] && png.data[index + 3] === 255;
      if (matches(colors.outer) || matches(colors.inner)) allowed[layer - 1]++;
    }
  }
  return {
    outer: counts[0] ? allowed[0] / counts[0] : 0,
    inner: counts[1] ? allowed[1] / counts[1] : 0,
  };
}

function analyzeCombatRows(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  assertThat(png.width === 1024 && png.height === 256, 'combat atlas dimensions changed while measuring rows');
  const rows = [];
  for (let row = 0; row < 4; row++) {
    const cells = [];
    for (let column = 0; column < 16; column++) {
      let alphaPixels = 0;
      let brightPixels = 0;
      let minX = CELL;
      let minY = CELL;
      let maxX = -1;
      let maxY = -1;
      let lumaTotal = 0;
      for (let localY = 0; localY < CELL; localY++) {
        for (let localX = 0; localX < CELL; localX++) {
          const x = column * CELL + localX;
          const y = row * CELL + localY;
          const index = (x + y * png.width) * 4;
          const alpha = png.data[index + 3];
          if (alpha <= 0) continue;
          alphaPixels++;
          minX = Math.min(minX, localX);
          minY = Math.min(minY, localY);
          maxX = Math.max(maxX, localX);
          maxY = Math.max(maxY, localY);
          const luma = 0.2126 * png.data[index] + 0.7152 * png.data[index + 1] + 0.0722 * png.data[index + 2];
          lumaTotal += luma;
          if (luma >= 65) brightPixels++;
        }
      }
      assertThat(alphaPixels > 0, `combat atlas row ${row} column ${column} is empty while measuring rows`);
      const rim = exteriorLayerShares(png, column * CELL, row * CELL, row);
      cells.push({
        dir: column % 8,
        pose: Math.floor(column / 8),
        alphaPixels,
        alphaWidth: maxX - minX + 1,
        alphaHeight: maxY - minY + 1,
        averageLuma: Math.round((lumaTotal / alphaPixels) * 10000) / 10000,
        brightMaterialShare: Math.round((brightPixels / alphaPixels) * 10000) / 10000,
        rimOuterShare: Math.round(rim.outer * 10000) / 10000,
        rimInnerShare: Math.round(rim.inner * 10000) / 10000,
      });
    }
    const widths = cells.map((cell) => cell.alphaWidth);
    const heights = cells.map((cell) => cell.alphaHeight);
    const brightShares = cells.map((cell) => cell.brightMaterialShare);
    const averageLumas = cells.map((cell) => cell.averageLuma);
    const rimOuterShares = cells.map((cell) => cell.rimOuterShare);
    const rimInnerShares = cells.map((cell) => cell.rimInnerShare);
    rows.push({
      row,
      alphaWidth: { min: Math.min(...widths), max: Math.max(...widths) },
      alphaHeight: { min: Math.min(...heights), max: Math.max(...heights) },
      averageLuma: { min: Math.min(...averageLumas), max: Math.max(...averageLumas) },
      brightMaterialShare: { min: Math.min(...brightShares), max: Math.max(...brightShares) },
      rimOuterShare: { min: Math.min(...rimOuterShares), max: Math.max(...rimOuterShares) },
      rimInnerShare: { min: Math.min(...rimInnerShares), max: Math.max(...rimInnerShares) },
      cells,
    });
  }
  return { lumaThreshold: R3_LUMA_FLOOR, rimThreshold: 0.85, brightMaterialThreshold: 65, rows };
}

function attachErrors(page, manifest, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') manifest.errors.push(`${label} console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => manifest.errors.push(`${label} pageerror: ${error?.stack ?? String(error)}`));
}

async function openPlayingPage(browser, server, manifest, label) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.setDefaultTimeout(PROBE_TIMEOUT_MS);
  attachErrors(page, manifest, label);
  await page.goto(`${server.url}/?qa=opening&qa-run=1&ui=0&combat=1`, {
    waitUntil: 'load',
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
  await settleFrames(page);
  return page;
}

async function exportCombatCanvases(page, out) {
  const data = await page.evaluate(() => {
    const view = globalThis.__STARHOLD_VIEW__;
    if (!view?.spriteAtlas?.combatCanvas) throw new Error('combat atlas is not exposed');
    const atlas = view.spriteAtlas;
    const source = atlas.combatCanvas;
    const contact = document.createElement('canvas');
    contact.width = 8 * atlas.combatCell * 4;
    contact.height = 4 * atlas.combatCell * 4;
    const ctx = contact.getContext('2d');
    if (!ctx) throw new Error('contact sheet context missing');
    ctx.imageSmoothingEnabled = false;
    for (let row = 0; row < 4; row++) {
      for (let dir = 0; dir < 8; dir++) {
        ctx.drawImage(
          source,
          dir * atlas.combatCell,
          row * atlas.combatCell,
          atlas.combatCell,
          atlas.combatCell,
          dir * atlas.combatCell * 4,
          row * atlas.combatCell * 4,
          atlas.combatCell * 4,
          atlas.combatCell * 4,
        );
      }
    }
    const sourcePixels = source.getContext('2d')?.getImageData(0, 0, source.width, source.height).data;
    let sourceMagenta = 0;
    if (sourcePixels) {
      for (let i = 0; i < sourcePixels.length; i += 4) {
        if (sourcePixels[i] === 255 && sourcePixels[i + 1] === 0 && sourcePixels[i + 2] === 255 && sourcePixels[i + 3] === 255) sourceMagenta++;
      }
    }
    const combatMesh = [...view.scene.children].find((object) => object.isInstancedMesh && object.material?.uniforms?.uCombatAtlas);
    const uniforms = combatMesh?.material?.uniforms;
    return {
      atlasDataUrl: source.toDataURL('image/png'),
      contact: contact.toDataURL('image/png'),
      sourceMagenta,
      atlas: {
        width: source.width,
        height: source.height,
        cell: atlas.combatCell,
        cols: atlas.combatCols,
        rows: atlas.combatRows,
      },
      runtime: {
        combatEnabled: view.combatEnabled,
        mappings: JSON.parse(JSON.stringify(view.combatBranchMappings)),
        combatMeshCount: [...view.scene.children].filter((object) => object.isInstancedMesh && object.material?.uniforms?.uCombatAtlas).length,
        instancedMeshCount: [...view.scene.children].filter((object) => object.isInstancedMesh).length,
        textureNearest: uniforms
          ? { magFilter: uniforms.uCombatAtlas.value.magFilter, minFilter: uniforms.uCombatAtlas.value.minFilter }
          : null,
        uniforms: uniforms
          ? {
              size: [uniforms.uCombatAtlasSize.value.x, uniforms.uCombatAtlasSize.value.y],
              cell: uniforms.uCombatCell.value,
              cols: uniforms.uCombatCols.value,
              rows: uniforms.uCombatRows.value,
              enabled: uniforms.uCombatEnabled.value,
            }
          : null,
        shader: combatMesh?.material?.fragmentShader ?? '',
      },
    };
  });
  const atlasPath = path.join(out, 'combat-atlas.png');
  const contactPath = path.join(out, 'contact-sheet.png');
  fs.writeFileSync(atlasPath, dataUrlBuffer(data.atlasDataUrl));
  fs.writeFileSync(contactPath, dataUrlBuffer(data.contact));
  return {
    atlasPath,
    contactPath,
    atlasImage: analyzePng(atlasPath, 1024, 256),
    contactImage: analyzePng(contactPath, 2048, 1024),
    sourceMetrics: analyzeCombatRows(atlasPath),
    sourceMagenta: data.sourceMagenta,
    atlas: data.atlas,
    runtime: data.runtime,
  };
}

async function stageFixture(page, mode) {
  return page.evaluate((fixtureMode) => {
    const world = globalThis.__STARHOLD_WORLD__;
    const input = globalThis.__STARHOLD_INPUT__;
    if (!world || !input) throw new Error('VS4 fixture handles missing');
    const specs = fixtureMode === 'lineup'
      ? [
          { kind: 2, civ: 'vespari', team: 0, x: 30, z: 34, facing: 0, order: 0, tx: 30, tz: 34 },
          { kind: 4, civ: 'vespari', team: 0, x: 37, z: 34, facing: 0, order: 0, tx: 37, tz: 34 },
          { kind: 2, civ: 'aurion', team: 1, x: 30, z: 42, facing: 4, order: 0, tx: 30, tz: 42 },
          { kind: 5, civ: 'aurion', team: 1, x: 37, z: 42, facing: 4, order: 0, tx: 37, tz: 42 },
        ]
      : [
          { kind: 2, civ: 'vespari', team: 0, x: 29, z: 35, facing: 1, order: 6, tx: 43, tz: 41 },
          { kind: 4, civ: 'vespari', team: 0, x: 31, z: 36, facing: 1, order: 6, tx: 43, tz: 41 },
          { kind: 2, civ: 'aurion', team: 1, x: 43, z: 41, facing: 5, order: 6, tx: 29, tz: 35 },
          { kind: 5, civ: 'aurion', team: 1, x: 45, z: 42, facing: 5, order: 6, tx: 29, tz: 35 },
        ];
    for (const entity of world.ents) {
      entity.alive = false;
      entity.vis = false;
      entity.vx = 0;
      entity.vz = 0;
      entity.path = null;
      entity.tid = -1;
      if (entity.kind === 10) entity.progress = 0.5;
    }
    for (const landmark of world.landmarks) landmark.discoveredBy = 0;
    world.fogOfWarEnabled = false;
    world.winner = -1;
    const staged = specs.map((spec) => {
      const entity = world.spawn(spec.kind, spec.civ, spec.team, spec.x, spec.z);
      if (!entity) throw new Error(`fixture spawn failed for kind ${spec.kind}`);
      entity.x = entity.px = spec.x;
      entity.z = entity.pz = spec.z;
      entity.tx = spec.tx;
      entity.tz = spec.tz;
      entity.vx = 0;
      entity.vz = 0;
      entity.facing = spec.facing;
      entity.order = spec.order;
      entity.tid = -1;
      entity.path = null;
      entity.pathI = 0;
      entity.anim = 0;
      entity.hp = entity.maxHp;
      entity.dissolveT = 0;
      entity.corpseT = 0;
      entity.combatT = 0;
      entity.hitFlash = 0;
      entity.vis = true;
      return entity.id;
    });
    input.selected.clear();
    input.box = null;
    input.pan.x = 35;
    input.pan.z = 39;
    input.halfH = 10;
    const view = globalThis.__STARHOLD_VIEW__;
    view?.lookAt(input.pan.x, input.pan.z);
    view?.setZoom(input.halfH);
    const before = staged.map((id) => {
      const entity = world.ents[id];
      return { id, x: entity.x, z: entity.z, order: entity.order, facing: entity.facing };
    });
    if (fixtureMode === 'lineup') {
      world.tick = 600;
      world.step = () => {};
      return { mode: fixtureMode, ids: staged, before, after: before };
    }
    for (let step = 0; step < 32; step++) world.step();
    world.step = () => {};
    world.flags.length = 0;
    world.links.length = 0;
    world.landmarks.length = 0;
    const after = staged.map((id) => {
      const entity = world.ents[id];
      return { id, x: entity.x, z: entity.z, order: entity.order, facing: entity.facing };
    });
    return { mode: fixtureMode, ids: staged, before, after, tick: world.tick };
  }, mode);
}

async function readRenderer(page) {
  return page.evaluate(() => {
    const view = globalThis.__STARHOLD_VIEW__;
    const qa = globalThis.__STARHAVEN_QA__;
    if (!view || !qa) throw new Error('renderer/QA probe missing');
    const shaderMesh = [...view.scene.children].find((object) => object.isInstancedMesh && object.material?.uniforms?.uCombatAtlas);
    return {
      info: view.info(),
      p99FrameMs: qa.p99FrameMs,
      state: qa.state,
      scenario: qa.scenario,
      uiDisplay: document.querySelector('#hud') ? getComputedStyle(document.querySelector('#hud')).display : null,
      shader: shaderMesh?.material?.fragmentShader ?? '',
      instancedMeshCount: [...view.scene.children].filter((object) => object.isInstancedMesh).length,
    };
  });
}

async function readCombatInstanceScales(page) {
  return page.evaluate((expectedMappings) => {
    const view = globalThis.__STARHOLD_VIEW__;
    const mesh = [...view.scene.children].find((object) => object.isInstancedMesh && object.material?.uniforms?.uCombatAtlas);
    if (!mesh) throw new Error('combat mesh missing for matrix scale probe');
    const meta = mesh.geometry.getAttribute('iMeta')?.array;
    const matrices = mesh.instanceMatrix?.array;
    if (!meta || !matrices) throw new Error('combat instance attributes missing for matrix scale probe');
    return expectedMappings.map((mapping) => {
      let index = -1;
      for (let candidate = 0; candidate < mesh.count; candidate++) {
        const base = candidate * 4;
        if (Math.round(meta[base]) === mapping.kind && Math.round(meta[base + 1]) === mapping.civ) {
          index = candidate;
          break;
        }
      }
      if (index < 0) return { ...mapping, instance: -1, actual: null, pass: false };
      const base = index * 16;
      const scaleX = Math.hypot(matrices[base], matrices[base + 1], matrices[base + 2]);
      const scaleY = Math.hypot(matrices[base + 4], matrices[base + 5], matrices[base + 6]);
      const actual = [Math.round(scaleX * 10000) / 10000, Math.round(scaleY * 10000) / 10000];
      return {
        ...mapping,
        instance: index,
        actual,
        pass: Math.abs(actual[0] - mapping.scale[0]) < 0.0001 && Math.abs(actual[1] - mapping.scale[1]) < 0.0001,
      };
    });
  }, EXPECTED_WORLD_SCALES);
}

async function measurePolicy(page) {
  const measure = await page.evaluate(() => {
    const world = globalThis.__STARHOLD_WORLD__;
    if (!world) throw new Error('__STARHOLD_WORLD__ missing for performance probe');
    for (let i = 0; i < 120; i++) world.step();
    const start = performance.now();
    for (let i = 0; i < 600; i++) world.step();
    const simStepMs = (performance.now() - start) / 600;
    const qa = globalThis.__STARHAVEN_QA__;
    const canvas = document.querySelector('#game');
    let renderer = 'none';
    try {
      const gl = canvas?.getContext('webgl2') || canvas?.getContext('webgl');
      const debug = gl?.getExtension('WEBGL_debug_renderer_info');
      renderer = debug ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'masked';
    } catch {
      renderer = 'err';
    }
    return {
      p99FrameMs: qa?.p99FrameMs ?? 0,
      simStepMs: Math.round(simStepMs * 10000) / 10000,
      simShareMs: Math.round(simStepMs * 5 * 10000) / 10000,
      renderer,
      softwareGl: /swiftshader|llvmpipe|software/i.test(renderer),
    };
  });
  if (measure.softwareGl) {
    assertThat(measure.simShareMs < P99_BUDGET_MS, `sim share ${measure.simShareMs}ms exceeds ${P99_BUDGET_MS}ms`);
    return { ...measure, mode: 'sim-share (software GL)', budgetMs: P99_BUDGET_MS };
  }
  assertThat(measure.p99FrameMs > 0 && measure.p99FrameMs < P99_BUDGET_MS, `p99 ${measure.p99FrameMs}ms outside ${P99_BUDGET_MS}ms`);
  return { ...measure, mode: 'render-p99', budgetMs: P99_BUDGET_MS };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-vs4-combat-assets',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, viewport: VIEWPORT, route: 'opening', ui: false, terrain: 'quiet Helios', seed: 0x5eed },
    checks: {},
    captures: {},
    errors: [],
    ok: false,
  };
  let server = null;
  let browser = null;
  const pages = [];
  try {
    server = await startServer();
    console.log(`qa-vs4: dev server ready at ${server.url}`);
    browser = await chromium.launch({
      channel: 'chrome',
      headless: true,
      args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
    }).catch(() => chromium.launch({ headless: true, args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding'] }));

    const exportPage = await openPlayingPage(browser, server, manifest, 'export');
    pages.push(exportPage);
    const qaEntry = await exportPage.evaluate(() => globalThis.__STARHAVEN_QA__);
    assertThat(qaEntry.scenario === 'opening' && qaEntry.state === 'Playing', `unexpected QA entry ${qaEntry.scenario}/${qaEntry.state}`);
    const exportData = await exportCombatCanvases(exportPage, out);
    manifest.captures.combatAtlas = { file: path.basename(exportData.atlasPath), image: exportData.atlasImage };
    manifest.captures.contactSheet = { file: path.basename(exportData.contactPath), image: exportData.contactImage };
    manifest.checks.sourceAtlas = {
      ...exportData.atlas,
      sourceMagentaPixels: exportData.sourceMagenta,
      expectedSourceMagenta: true,
    };
    manifest.checks.sourceMetrics = exportData.sourceMetrics;
    const sourceReadabilityFailures = exportData.sourceMetrics.rows.flatMap((row) => row.cells.flatMap((cell) => {
      const failures = [];
      if (cell.averageLuma < R3_LUMA_FLOOR) failures.push(`row ${row.row} dir ${cell.dir} pose ${cell.pose} average luma ${cell.averageLuma}, expected >=${R3_LUMA_FLOOR}`);
      if (cell.rimOuterShare < 0.85) failures.push(`row ${row.row} dir ${cell.dir} pose ${cell.pose} outer rim ${cell.rimOuterShare}, expected >=0.85`);
      if (cell.rimInnerShare < 0.85) failures.push(`row ${row.row} dir ${cell.dir} pose ${cell.pose} inner rim ${cell.rimInnerShare}, expected >=0.85`);
      return failures;
    }));
    manifest.checks.sourceReadability = {
      averageLuma: { min: Math.min(...exportData.sourceMetrics.rows.map((row) => row.averageLuma.min)), max: Math.max(...exportData.sourceMetrics.rows.map((row) => row.averageLuma.max)) },
      rimOuterShare: { min: Math.min(...exportData.sourceMetrics.rows.map((row) => row.rimOuterShare.min)), max: Math.max(...exportData.sourceMetrics.rows.map((row) => row.rimOuterShare.max)) },
      rimInnerShare: { min: Math.min(...exportData.sourceMetrics.rows.map((row) => row.rimInnerShare.min)), max: Math.max(...exportData.sourceMetrics.rows.map((row) => row.rimInnerShare.max)) },
      failures: sourceReadabilityFailures,
      pass: sourceReadabilityFailures.length === 0,
    };
    manifest.checks.runtimeContract = exportData.runtime;
    assertThat(exportData.atlas.width === 1024 && exportData.atlas.height === 256, 'combat atlas dimensions are not 1024x256');
    assertThat(exportData.atlas.cell === 64 && exportData.atlas.cols === 16 && exportData.atlas.rows === 4, 'combat atlas cell grid is not 64/16/4');
    assertThat(exportData.sourceMagenta > 0, 'source combat atlas has no MAG focus pixels');
    assertThat(JSON.stringify(exportData.runtime.mappings) === JSON.stringify(EXPECTED_MAPPINGS), `combat branch mappings changed: ${JSON.stringify(exportData.runtime.mappings)}`);
    assertThat(exportData.runtime.combatMeshCount === 1, `combat texture is attached to ${exportData.runtime.combatMeshCount} meshes`);
    assertThat(exportData.runtime.textureNearest?.magFilter === 1003 && exportData.runtime.textureNearest?.minFilter === 1003, `combat texture filters are not NearestFilter: ${JSON.stringify(exportData.runtime.textureNearest)}`);
    assertThat(JSON.stringify(exportData.runtime.uniforms?.size) === JSON.stringify([1024, 256]), 'combat texture uniform size is wrong');
    assertThat(exportData.runtime.uniforms?.enabled === 1, 'combat texture is not enabled by default');
    const requiredShaderClauses = [
      'kind > 1.5 && kind < 2.5 && civ < 0.5',
      'kind > 3.5 && kind < 4.5 && civ < 0.5',
      'kind > 1.5 && kind < 2.5 && civ > 0.5 && civ < 1.5',
      'kind > 4.5 && kind < 5.5 && civ > 0.5 && civ < 1.5',
      'frame < 4.0',
    ];
    assertThat(requiredShaderClauses.every((clause) => exportData.runtime.shader.includes(clause)), 'SDF shader branch mapping/frame gate is incomplete');
    manifest.checks.branchMapping = {
      mappings: exportData.runtime.mappings,
      shaderClauses: requiredShaderClauses,
      liveFrames: [0, 1, 2, 3],
      legacyCorpseFrames: [4, 5, 6],
    };

    const lineup = await stageFixture(exportPage, 'lineup');
    await settleFrames(exportPage);
    const worldScales = await readCombatInstanceScales(exportPage);
    manifest.checks.worldScales = {
      expected: EXPECTED_WORLD_SCALES,
      actual: worldScales,
      allExact: worldScales.every((mapping) => mapping.pass),
    };
    assertThat(
      sourceReadabilityFailures.length === 0 && worldScales.every((mapping) => mapping.pass),
      `VS4 R3 source/scale contract failed: ${JSON.stringify({ sourceReadabilityFailures, worldScales })}`,
    );
    const lineupPath = path.join(out, 'lineup-after.png');
    await exportPage.screenshot({ path: lineupPath, type: 'png' });
    const lineupImage = analyzePng(lineupPath, VIEWPORT.width, VIEWPORT.height);
    assertThat(lineupImage.exactMagenta === 0, `lineup contains ${lineupImage.exactMagenta} exact MAG pixels`);
    const lineupRenderer = await readRenderer(exportPage);
    manifest.captures.lineup = { file: path.basename(lineupPath), image: lineupImage };
    manifest.checks.lineup = { fixture: lineup, renderer: lineupRenderer, noUi: lineupRenderer.uiDisplay === 'none' };
    assertThat(lineupRenderer.uiDisplay === 'none', `UI is visible in lineup (${lineupRenderer.uiDisplay})`);

    const battlePage = await openPlayingPage(browser, server, manifest, 'battle');
    pages.push(battlePage);
    const battle = await stageFixture(battlePage, 'battle');
    await settleFrames(battlePage);
    const battlePath = path.join(out, 'battle-after.png');
    await battlePage.screenshot({ path: battlePath, type: 'png' });
    const battleImage = analyzePng(battlePath, VIEWPORT.width, VIEWPORT.height);
    assertThat(battleImage.exactMagenta === 0, `battle contains ${battleImage.exactMagenta} exact MAG pixels`);
    assertThat(battle.tick > 0 && battle.before.some((entry) => entry.order === 6), 'battle fixture did not issue opposing orders');
    assertThat(battle.after.some((entry, index) => entry.x !== battle.before[index].x || entry.z !== battle.before[index].z), 'battle fixture did not take actual movement steps');
    const battleRenderer = await readRenderer(battlePage);
    manifest.captures.battle = { file: path.basename(battlePath), image: battleImage };
    manifest.checks.battle = { fixture: battle, renderer: battleRenderer, noUi: battleRenderer.uiDisplay === 'none' };
    assertThat(battleRenderer.uiDisplay === 'none', `UI is visible in battle (${battleRenderer.uiDisplay})`);

    const offPage = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    pages.push(offPage);
    attachErrors(offPage, manifest, 'combat=0');
    await offPage.goto(`${server.url}/?qa=opening&qa-run=1&ui=0&combat=0`, { waitUntil: 'load', timeout: NAV_TIMEOUT_MS });
    await offPage.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
    await stageFixture(offPage, 'lineup');
    await settleFrames(offPage);
    const onCalls = lineupRenderer.info.calls;
    const offRenderer = await readRenderer(offPage);
    const drawCalls = { combatOn: onCalls, combatOff: offRenderer.info.calls, equal: onCalls === offRenderer.info.calls };
    manifest.checks.drawCalls = drawCalls;
    assertThat(drawCalls.equal, `combat=0 draw calls changed (${onCalls} -> ${offRenderer.info.calls})`);
    const offEnabled = await offPage.evaluate(() => globalThis.__STARHOLD_VIEW__?.combatEnabled);
    assertThat(offEnabled === false, 'combat=0 did not disable the new sample');

    await exportPage.close();
    await battlePage.close();
    await offPage.close();
    const perfPage = await openPlayingPage(browser, server, manifest, 'perf');
    pages.push(perfPage);
    await delay(650);
    const frameBudget = await measurePolicy(perfPage);
    manifest.checks.frameBudget = frameBudget;

    manifest.checks.noRuntimeMagenta = {
      lineup: lineupImage.exactMagenta,
      battle: battleImage.exactMagenta,
      assertedZero: true,
    };
    manifest.ok = manifest.errors.length === 0;
  } catch (error) {
    manifest.errors.push(error?.stack ?? String(error));
    manifest.ok = false;
  } finally {
    for (const page of pages) {
      try { await page.close(); } catch {}
    }
    try { if (browser) await browser.close(); } catch {}
    try { await stopServer(server); } catch {}
    manifest.finishedAt = new Date().toISOString();
    const manifestPath = path.join(out, 'manifest.json');
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log('--- qa-vs4 summary ---');
    console.log(`ok=${manifest.ok}`);
    console.log(`atlas=${path.join(out, 'combat-atlas.png')}`);
    console.log(`contact=${path.join(out, 'contact-sheet.png')}`);
    console.log(`lineup=${path.join(out, 'lineup-after.png')}`);
    console.log(`battle=${path.join(out, 'battle-after.png')}`);
    console.log(`drawCalls=${JSON.stringify(manifest.checks.drawCalls ?? null)}`);
    console.log(`manifest=${manifestPath}`);
    if (manifest.errors.length) {
      console.log('errors:');
      for (const error of manifest.errors) console.log(`  - ${String(error).split('\n')[0]}`);
    }
    if (!manifest.ok) process.exitCode = 1;
  }
}

await main();
