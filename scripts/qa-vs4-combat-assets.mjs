#!/usr/bin/env node
/** VS-4 — deterministic combat-strip export and runtime proof. */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
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

const FROZEN_R3_CELL_SHA256 = {
  '0:0:0': '2775f085c85d329f9bcbd2b67a3d7b39b09955cc562f25a3c7c7a6d33c9c30b2',
  '0:0:1': '8c3283bb9d02c238ab973ea44525b7e666cf7ac460de5799293df0ed704b91c2',
  '0:1:0': 'be18e2e50844db15888ca3a1577d4a967e2aee739df4c5aa7d20a12ffc8c2e75',
  '0:1:1': 'bff9c1d96d94fbf6c10b70a9e50b358cf4fac8367dabde4ff4e5107afd830383',
  '0:2:0': 'a2be8af761e176708fa1eaf0ef6bb7c5cda1538f5841075154ad698842f67eb2',
  '0:2:1': 'afaaf5a4acdba51062bf11181a63599f3d8d13885317852ae67269910a6a277d',
  '0:3:0': 'b91edc67b60ae8d5451772f13e6d7f8f1a86e09ee90d4e074d4427bee9e44bad',
  '0:3:1': '86b2c40afce5a541d172e29c2dde6cd08ff1b833842c65a85375a1f16dcf9dba',
  '0:4:0': '1578b249c1d07a2d36e856687b7a680201542842387eee92afe8538e96cd05a0',
  '0:4:1': '0743c77514f454b84b59e8de075671e16e858bca37b2bdbcc9020981b55a5675',
  '0:5:0': '90d9ef1e0463de42918e5aa6f8f32d02a1f31ef44af9f3351166253a7c267078',
  '0:5:1': 'ff1017acc3819bc2a80fad501cf72806ae2d54462358b61d419019ec9451250f',
  '0:6:0': '17f205cdf0c99a1dc6697852cc356ac4c8b3f156282209853c4c18af8130c1d5',
  '0:6:1': 'ab7ffa3a520173571b8bace0d192cf5960c04fbe2bfc6d3a9aabe7991f4f6c4c',
  '0:7:0': 'ff6f312cbcf18ad9c277450ffec5163b966ee899391f65c07512ea9b9ae936de',
  '0:7:1': 'bf10e603a65ab7c5b541ccf61a0e59fc7ddd0f078bc37cfd12ab6d7f0be5dc3a',
  '1:0:0': '09cc1118e0dac599af575896b13080811a7f5d87439ce94557b8a2e0fb74a71b',
  '1:0:1': '2bc28f9b0ef9a9f8609899270d8f34031809a3d21bd378ab61afa930cc0dd0a4',
  '1:1:0': '53be7e31405ebab3afc15e53a9a0eb4899092dc4ce457641eb46df58389b33fa',
  '1:1:1': '6b033117ff7d87453421c3182fcd7b3de01a33699c9466762c1e751a0bc73200',
  '1:2:0': '88767a73da68cc9ea992668cbae7e5ad0cfea1e2e7f4ed8e182a82a19c0e341e',
  '1:2:1': '69f1b8add69edd1bfa9bd27105af2a68a91b255b7a0a46dc853b6e0cb41ef95a',
  '1:3:0': '55642e2d078deee9d84ef6692af7ad31f14e0dff111b162374fa24180fd360b8',
  '1:3:1': 'ee94bf4d0cb3eeeb3b27b359af888a982afb0cb735472623bb8ee1d1e4467b3d',
  '1:4:0': '2824426327c954786c2da9caa5314956ba6ae45fefceda1e656a2c09677163e3',
  '1:4:1': 'ebbded433156f48e87a9ced93c0a123d3239e903f80e24437d4562a1ca924291',
  '1:5:0': 'fd029555b067bf1bcda319de0510f3f1a09f86aebb42258dd2080c292db9dfc9',
  '1:5:1': '16843912ba473f530945cc32c2ccf187b7d63a79ad79da201479c19d37787308',
  '1:6:0': '88767a73da68cc9ea992668cbae7e5ad0cfea1e2e7f4ed8e182a82a19c0e341e',
  '1:6:1': '69f1b8add69edd1bfa9bd27105af2a68a91b255b7a0a46dc853b6e0cb41ef95a',
  '1:7:0': '79d53ccecbdcbbc20df502fc5b7b083c1440f7ca33506aa41a825e311c5a8faa',
  '1:7:1': '67d61e78c3217c5ee405809545f2d2f7c7ce8cb5396cb523a2f2db335cce6795',
  '3:0:0': 'c4fd63b3313fc5919de9441a8ba71dc69a717b712fb41bc9bc0535d72bda88eb',
  '3:0:1': '7a743db67c4180797d1fb8495ae2b7541856291b4f1be8840ce1039301795a8e',
  '3:1:0': 'b6ded6efd2cae76946d688bf44646035da0ad1125d9821b3e2088ed4e4972af8',
  '3:1:1': 'f9f717ba56f7cb8df43bd91f7ac69e529ffb3346dfc2d862ea165eea676562bd',
  '3:2:0': 'ca0322156cb71e94756b3b2b4e2f840e8f8c55d5d831de6b846c2308e7709c45',
  '3:2:1': '08f381a002321d0cd8acce11a6e015e6eb4a78ba9fea229cadfaa4f1c1c70111',
  '3:3:0': '9279ad48cfbe8ee2a56e1c91fd456b1def2b432c73040deea5e026a3680027e5',
  '3:3:1': 'b11044a9b467cf2ac4d2e8c6029780809ede0feb21f6803e8d306873cdc86c10',
  '3:4:0': 'f41f25ce1fdce9fb02b33184117e74286285ca00857c84206b4bf3bb87693625',
  '3:4:1': '1fb3ee813f327004b431a3380120ca1af8211f6252d56a81121cfd6cf158e3b0',
  '3:5:0': 'c1537b428225743f635b8bf5969afda80da29d12b92307605f84741c0b9b4bea',
  '3:5:1': '7021e526eb5b48f7c23878c7dabdb1731724c0ce8e54f6fb64afeb0ec81e2e1b',
  '3:6:0': 'ca0322156cb71e94756b3b2b4e2f840e8f8c55d5d831de6b846c2308e7709c45',
  '3:6:1': '08f381a002321d0cd8acce11a6e015e6eb4a78ba9fea229cadfaa4f1c1c70111',
  '3:7:0': 'de10a4500f40e7625b0f774f5cfd830069ce7f2e386fbef7f37b6ac157c66080',
  '3:7:1': '750fa277bef4c8f563fd17db9a17595e366e26ddfdb6d99db71f790610c892a6',
};

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

function cellRgba(png, originX, originY, x, y) {
  const index = ((originX + x) + (originY + y) * png.width) * 4;
  return [png.data[index], png.data[index + 1], png.data[index + 2], png.data[index + 3]];
}

function cellAlpha(png, originX, originY, x, y) {
  return cellRgba(png, originX, originY, x, y)[3] > 0;
}

function cellIsRimColor(png, originX, originY, x, y, row) {
  const rgba = cellRgba(png, originX, originY, x, y);
  const colors = RIM_COLORS[row];
  return (rgba[0] === colors.outer[0] && rgba[1] === colors.outer[1] && rgba[2] === colors.outer[2])
    || (rgba[0] === colors.inner[0] && rgba[1] === colors.inner[1] && rgba[2] === colors.inner[2]);
}

function cellCoreMask(png, originX, originY, row) {
  const exteriorRim = new Uint8Array(CELL * CELL);
  const queue = [];
  const traversable = (x, y) => !cellAlpha(png, originX, originY, x, y) || cellIsRimColor(png, originX, originY, x, y, row);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (x !== 0 && y !== 0 && x !== CELL - 1 && y !== CELL - 1) continue;
      const index = x + y * CELL;
      if (traversable(x, y) && !exteriorRim[index]) {
        exteriorRim[index] = 1;
        queue.push(index);
      }
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
      if (!exteriorRim[next] && traversable(nx, ny)) {
        exteriorRim[next] = 1;
        queue.push(next);
      }
    }
  }
  const mask = new Uint8Array(CELL * CELL);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      if (cellAlpha(png, originX, originY, x, y) && !(exteriorRim[x + y * CELL] && cellIsRimColor(png, originX, originY, x, y, row))) {
        mask[x + y * CELL] = 1;
      }
    }
  }
  return mask;
}

function maskBox(mask, minX, minY, maxX, maxY) {
  let count = 0;
  let boxMinX = maxX + 1;
  let boxMinY = maxY + 1;
  let boxMaxX = minX - 1;
  let boxMaxY = minY - 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!mask[x + y * CELL]) continue;
      count++;
      boxMinX = Math.min(boxMinX, x);
      boxMinY = Math.min(boxMinY, y);
      boxMaxX = Math.max(boxMaxX, x);
      boxMaxY = Math.max(boxMaxY, y);
    }
  }
  return count ? { count, minX: boxMinX, minY: boxMinY, maxX: boxMaxX, maxY: boxMaxY } : null;
}

function boxWidth(box) {
  return box ? box.maxX - box.minX + 1 : 0;
}

function boxHeight(box) {
  return box ? box.maxY - box.minY + 1 : 0;
}

function maskComponents(mask, minX, minY, maxX, maxY) {
  const seen = new Uint8Array(CELL * CELL);
  const components = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const start = x + y * CELL;
      if (seen[start] || !mask[start]) continue;
      const queue = [start];
      seen[start] = 1;
      let count = 0;
      let componentMinX = x;
      let componentMinY = y;
      let componentMaxX = x;
      let componentMaxY = y;
      for (let cursor = 0; cursor < queue.length; cursor++) {
        const index = queue[cursor];
        const qx = index % CELL;
        const qy = Math.floor(index / CELL);
        count++;
        componentMinX = Math.min(componentMinX, qx);
        componentMinY = Math.min(componentMinY, qy);
        componentMaxX = Math.max(componentMaxX, qx);
        componentMaxY = Math.max(componentMaxY, qy);
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = qx + dx;
            const ny = qy + dy;
            if (nx < minX || ny < minY || nx > maxX || ny > maxY) continue;
            const next = nx + ny * CELL;
            if (!seen[next] && mask[next]) {
              seen[next] = 1;
              queue.push(next);
            }
          }
        }
      }
      components.push({ count, minX: componentMinX, minY: componentMinY, maxX: componentMaxX, maxY: componentMaxY });
    }
  }
  return components;
}

function boxCoordinates(mask, minX, minY, maxX, maxY) {
  const result = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) if (mask[x + y * CELL]) result.push([x, y]);
  }
  return result;
}

function hasCorePath(mask, starts, ends) {
  const target = new Uint8Array(CELL * CELL);
  for (const [x, y] of ends) target[x + y * CELL] = 1;
  const seen = new Uint8Array(CELL * CELL);
  const queue = [];
  for (const [x, y] of starts) {
    const index = x + y * CELL;
    if (!seen[index] && mask[index]) {
      seen[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (target[index]) return true;
    const x = index % CELL;
    const y = Math.floor(index / CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= CELL || ny >= CELL) continue;
        const next = nx + ny * CELL;
        if (!seen[next] && mask[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
  }
  return false;
}

function polearmSpan(starts, ends) {
  let best = { distance: 0, dx: 0, dy: 0, slope: 0 };
  for (const [sx, sy] of starts) {
    for (const [ex, ey] of ends) {
      const dx = Math.abs(ex - sx);
      const dy = Math.abs(ey - sy);
      const distance = Math.hypot(dx, dy);
      if (distance > best.distance) best = { distance, dx, dy, slope: dx ? dy / dx : Number.POSITIVE_INFINITY };
    }
  }
  return best;
}

function normalizedRow2Cell(png, originX, originY, dir) {
  const actualMask = cellCoreMask(png, originX, originY, 2);
  const mirrored = dir === 3 || dir === 4 || dir === 5;
  const mask = new Uint8Array(CELL * CELL);
  const pixel = (x, y) => cellRgba(png, originX, originY, mirrored ? CELL - 1 - x : x, y);
  for (let y = 0; y < CELL; y++) {
    for (let x = 0; x < CELL; x++) {
      const actualX = mirrored ? CELL - 1 - x : x;
      mask[x + y * CELL] = actualMask[actualX + y * CELL];
    }
  }
  return { mask, pixel };
}

function matchesRgb(rgba, color) {
  return rgba[0] === color[0] && rgba[1] === color[1] && rgba[2] === color[2];
}

function longestIceRun(cell) {
  const ice = RIM_COLORS[2].outer;
  let longest = 0;
  for (let y = 16; y <= 27; y++) {
    let run = 0;
    for (let x = 29; x <= 40; x++) {
      const matches = cell.mask[x + y * CELL] && matchesRgb(cell.pixel(x, y), ice);
      run = matches ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  return longest;
}

function analyzeRow2Cell(png, originX, originY, dir, pose) {
  const normalizedDir = dir === 3 ? 1 : dir === 4 ? 0 : dir === 5 ? 7 : dir;
  const cell = normalizedRow2Cell(png, originX, originY, dir);
  const failures = [];
  const require = (condition, message) => { if (!condition) failures.push(message); };
  const mask = cell.mask;
  const head = maskBox(mask, 29, 16, 40, 27);
  const headComponents = maskComponents(mask, 29, 16, 40, 27);
  const headLargest = Math.max(0, ...headComponents.map((component) => component.count));
  const visorWidth = longestIceRun(cell);
  require(head && boxWidth(head) === 12 && boxHeight(head) === 12, `dir ${dir} pose ${pose} head ${head ? `${boxWidth(head)}x${boxHeight(head)}` : 'empty'}, expected 12x12`);
  require(headLargest >= 80, `dir ${dir} pose ${pose} head connected ${headLargest}, expected >=80`);
  require(visorWidth >= 6, `dir ${dir} pose ${pose} visor ${visorWidth}px, expected >=6px`);
  const torso = maskBox(mask, 25, 27, 46, 43);
  require(torso && boxWidth(torso) >= 18 && boxHeight(torso) >= 16 && torso.count >= 180, `dir ${dir} pose ${pose} torso ${torso ? `${boxWidth(torso)}x${boxHeight(torso)} ${torso.count}px` : 'empty'}, expected >=18x16/180px`);
  const leftComponents = maskComponents(mask, 24, 42, 33, 51);
  const rightComponents = maskComponents(mask, 36, 42, 45, 51);
  const leftLeg = leftComponents.reduce((best, component) => !best || boxWidth(component) > boxWidth(best) ? component : best, null);
  const rightLeg = rightComponents.reduce((best, component) => !best || boxWidth(component) > boxWidth(best) ? component : best, null);
  require(leftLeg && boxWidth(leftLeg) >= 6 && boxHeight(leftLeg) >= 6, `dir ${dir} pose ${pose} left leg is not a separate >=6px-wide mass`);
  require(rightLeg && boxWidth(rightLeg) >= 6 && boxHeight(rightLeg) >= 6, `dir ${dir} pose ${pose} right leg is not a separate >=6px-wide mass`);
  const centerGap = maskBox(mask, 33, 45, 36, 51)?.count ?? 0;
  require(centerGap === 0, `dir ${dir} pose ${pose} leg center gap ${centerGap}px, expected 0`);
  const shield = maskBox(mask, 8, 19, 26, 49);
  require(shield && boxWidth(shield) >= 16 && boxHeight(shield) >= 29, `dir ${dir} pose ${pose} shield ${shield ? `${boxWidth(shield)}x${boxHeight(shield)}` : 'empty'}, expected >=16x29`);
  require(!shield || (shield.minX >= 8 && shield.maxX <= 26 && shield.minY >= 19 && shield.maxY <= 49), `dir ${dir} pose ${pose} shield leaves x8..26/y19..49`);
  const braceRows = [];
  let bracePixels = 0;
  for (let y = 29; y <= 36; y++) {
    let rowPixels = 0;
    for (let x = 25; x <= 26; x++) if (mask[x + y * CELL]) rowPixels++;
    if (rowPixels) {
      braceRows.push(y);
      bracePixels += rowPixels;
    }
  }
  require(braceRows.length >= 2 && braceRows.length <= 3 && bracePixels >= 4 && bracePixels <= 6, `dir ${dir} pose ${pose} shield brace ${bracePixels}px/${braceRows.length} rows, expected 2-3px`);
  const headShieldAccents = [...Array(12 * 12).keys()].reduce((count, offset) => {
    const x = 29 + offset % 12;
    const y = 16 + Math.floor(offset / 12);
    const rgba = cell.pixel(x, y);
    return count + (matchesRgb(rgba, [214, 185, 138]) || matchesRgb(rgba, [208, 154, 78]) || matchesRgb(rgba, MAG) ? 1 : 0);
  }, 0);
  require(headShieldAccents === 0, `dir ${dir} pose ${pose} shield accent overlaps head center (${headShieldAccents}px)`);
  const grip = boxCoordinates(mask, 41, 29, 46, 35);
  const corridorNear = maskBox(mask, 47, 22, 51, 28);
  const corridorFar = maskBox(mask, 53, 11, 57, 18);
  const tip = boxCoordinates(mask, 60, 0, 63, 6);
  require(grip.length > 0, `dir ${dir} pose ${pose} polearm grip is empty`);
  require(tip.length > 0, `dir ${dir} pose ${pose} polearm tip is empty`);
  require(corridorNear && corridorFar, `dir ${dir} pose ${pose} polearm corridor is incomplete`);
  const span = polearmSpan(grip, tip);
  const connected = hasCorePath(mask, grip, tip);
  require(connected, `dir ${dir} pose ${pose} polearm grip-to-tip path is disconnected`);
  require(span.distance >= 32 && span.dx >= 16 && span.slope >= 0.8 && span.slope <= 2.0, `dir ${dir} pose ${pose} polearm span ${span.distance.toFixed(2)}px/dx${span.dx}/slope${span.slope.toFixed(2)}`);
  return {
    dir,
    pose,
    normalizedDir,
    failures,
    head: { pixels: head?.count ?? 0, bbox: [boxWidth(head), boxHeight(head)], connected: headLargest, visor: visorWidth },
    torso: { pixels: torso?.count ?? 0, bbox: [boxWidth(torso), boxHeight(torso)] },
    legs: { left: leftLeg ? [boxWidth(leftLeg), boxHeight(leftLeg)] : null, right: rightLeg ? [boxWidth(rightLeg), boxHeight(rightLeg)] : null, gapPixels: centerGap },
    shield: { pixels: shield?.count ?? 0, bbox: [boxWidth(shield), boxHeight(shield)], bracePixels, braceRows: braceRows.length, headShieldAccents },
    polearm: { gripPixels: grip.length, corridorNear: corridorNear?.count ?? 0, corridorFar: corridorFar?.count ?? 0, tipPixels: tip.length, distance: span.distance, horizontal: span.dx, slope: span.slope, connected },
  };
}

function cellSha256(png, originX, originY) {
  const bytes = Buffer.alloc(CELL * CELL * 4);
  for (let y = 0; y < CELL; y++) {
    const sourceStart = ((originX) + (originY + y) * png.width) * 4;
    bytes.set(png.data.subarray(sourceStart, sourceStart + CELL * 4), y * CELL * 4);
  }
  return createHash('sha256').update(bytes).digest('hex');
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
      const dir = column % 8;
      const pose = Math.floor(column / 8);
      const anatomy = row === 2 ? analyzeRow2Cell(png, column * CELL, row * CELL, dir, pose) : null;
      cells.push({
        dir,
        pose,
        alphaPixels,
        alphaWidth: maxX - minX + 1,
        alphaHeight: maxY - minY + 1,
        averageLuma: Math.round((lumaTotal / alphaPixels) * 10000) / 10000,
        brightMaterialShare: Math.round((brightPixels / alphaPixels) * 10000) / 10000,
        rimOuterShare: Math.round(rim.outer * 10000) / 10000,
        rimInnerShare: Math.round(rim.inner * 10000) / 10000,
        sha256: cellSha256(png, column * CELL, row * CELL),
        ...(anatomy ? { anatomy } : {}),
      });
    }
    const widths = cells.map((cell) => cell.alphaWidth);
    const heights = cells.map((cell) => cell.alphaHeight);
    const brightShares = cells.map((cell) => cell.brightMaterialShare);
    const averageLumas = cells.map((cell) => cell.averageLuma);
    const rimOuterShares = cells.map((cell) => cell.rimOuterShare);
    const rimInnerShares = cells.map((cell) => cell.rimInnerShare);
    const anatomy = row === 2
      ? {
          cells: cells.map((cell) => ({ ...cell.anatomy, sha256: cell.sha256 })),
          failures: cells.flatMap((cell) => cell.anatomy?.failures ?? []),
        }
      : null;
    rows.push({
      row,
      alphaWidth: { min: Math.min(...widths), max: Math.max(...widths) },
      alphaHeight: { min: Math.min(...heights), max: Math.max(...heights) },
      averageLuma: { min: Math.min(...averageLumas), max: Math.max(...averageLumas) },
      brightMaterialShare: { min: Math.min(...brightShares), max: Math.max(...brightShares) },
      rimOuterShare: { min: Math.min(...rimOuterShares), max: Math.max(...rimOuterShares) },
      rimInnerShare: { min: Math.min(...rimInnerShares), max: Math.max(...rimInnerShares) },
      anatomy,
      cells,
    });
  }
  const frozenFailures = [];
  for (const row of [0, 1, 3]) {
    for (const cell of rows[row].cells) {
      const key = `${row}:${cell.dir}:${cell.pose}`;
      if (cell.sha256 !== FROZEN_R3_CELL_SHA256[key]) frozenFailures.push(`${key} ${cell.sha256} !== ${FROZEN_R3_CELL_SHA256[key]}`);
    }
  }
  return {
    lumaThreshold: R3_LUMA_FLOOR,
    rimThreshold: 0.85,
    brightMaterialThreshold: 65,
    frozenRows: { cells: 48, failures: frozenFailures, pass: frozenFailures.length === 0 },
    row2Anatomy: rows[2].anatomy,
    rows,
  };
}

function attachErrors(page, manifest, label) {
  page.on('console', (message) => {
    if (message.type() === 'error') manifest.errors.push(`${label} console.error: ${message.text()}`);
  });
  page.on('pageerror', (error) => manifest.errors.push(`${label} pageerror: ${error?.stack ?? String(error)}`));
}

async function openPlayingPage(browser, server, manifest, label, candidateAsset = null) {
  const page = await browser.newPage({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  page.setDefaultTimeout(PROBE_TIMEOUT_MS);
  attachErrors(page, manifest, label);
  const candidateQuery = candidateAsset === null
    ? ''
    : `&forge-art-candidate=${encodeURIComponent(candidateAsset)}`;
  await page.goto(`${server.url}/?qa=opening&qa-run=1&ui=0&combat=1${candidateQuery}`, {
    waitUntil: 'load',
    timeout: NAV_TIMEOUT_MS,
  });
  await page.waitForFunction(() => globalThis.__STARHAVEN_QA__?.state === 'Playing', null, { timeout: PROBE_TIMEOUT_MS });
  await settleFrames(page);
  return page;
}

async function exportCombatCanvases(page, out, stem = null) {
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
        overrideRows: (view.combatRowOverrides ?? []).map((override) => override.row),
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
  const atlasPath = path.join(out, stem ? `${stem}-atlas.png` : 'combat-atlas.png');
  const contactPath = path.join(out, stem ? `${stem}-contact-sheet.png` : 'contact-sheet.png');
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
  const candidateManifest = JSON.parse(fs.readFileSync(
    path.join(REPO_ROOT, 'tools/forge-art/candidates/sunweaver-lumen-guard/manifest.json'),
    'utf8',
  ));
  const candidateStatus = candidateManifest.status;
  assertThat(candidateStatus === 'draft' || candidateStatus === 'approved', `unsupported candidate status ${String(candidateStatus)}`);
  const candidateShouldChangeRow0 = candidateStatus !== 'approved';
  fs.mkdirSync(out, { recursive: true });
  const manifest = {
    tool: 'qa-vs4-combat-assets',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    args: { out, viewport: VIEWPORT, route: 'opening', ui: false, terrain: 'quiet Helios', seed: 0x5eed, candidateStatus },
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
    manifest.checks.frozenRows = exportData.sourceMetrics.frozenRows;
    manifest.checks.row2Anatomy = exportData.sourceMetrics.row2Anatomy;
    const sourceReadabilityFailures = exportData.sourceMetrics.rows.flatMap((row) => row.cells.flatMap((cell) => {
      const failures = [];
      if (cell.averageLuma < R3_LUMA_FLOOR) failures.push(`row ${row.row} dir ${cell.dir} pose ${cell.pose} average luma ${cell.averageLuma}, expected >=${R3_LUMA_FLOOR}`);
      if (cell.rimOuterShare < 0.85) failures.push(`row ${row.row} dir ${cell.dir} pose ${cell.pose} outer rim ${cell.rimOuterShare}, expected >=0.85`);
      if (cell.rimInnerShare < 0.85) failures.push(`row ${row.row} dir ${cell.dir} pose ${cell.pose} inner rim ${cell.rimInnerShare}, expected >=0.85`);
      return failures;
    })).concat(exportData.sourceMetrics.row2Anatomy?.failures ?? []);
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

    // Candidate vertical slice: the query selects row 0 only, while the
    // remaining combat rows stay byte-identical to the accepted baseline.
    const candidatePage = await openPlayingPage(browser, server, manifest, 'candidate', 'sunweaver-lumen-guard');
    pages.push(candidatePage);
    const candidateData = await exportCombatCanvases(candidatePage, out, 'candidate');
    manifest.captures.candidateAtlas = { file: path.basename(candidateData.atlasPath), image: candidateData.atlasImage };
    manifest.captures.candidateContactSheet = { file: path.basename(candidateData.contactPath), image: candidateData.contactImage };
    const candidateProbe = await candidatePage.evaluate(() => ({
      qa: globalThis.__STARHAVEN_QA__,
      overrides: (globalThis.__STARHOLD_VIEW__?.combatRowOverrides ?? []).map((override) => override.row),
    }));
    const baselineCellsByRow = exportData.sourceMetrics.rows.map((row) => row.cells.map((cell) => cell.sha256));
    const candidateCellsByRow = candidateData.sourceMetrics.rows.map((row) => row.cells.map((cell) => cell.sha256));
    const candidateRow0Changed = candidateCellsByRow[0].some((sha, index) => sha !== baselineCellsByRow[0][index]);
    const candidateOtherRowsUnchanged = [1, 2, 3].every((row) =>
      JSON.stringify(candidateCellsByRow[row]) === JSON.stringify(baselineCellsByRow[row]));
    const candidateRow0Metrics = candidateData.sourceMetrics.rows[0];
    manifest.checks.candidateOverride = {
      assetId: candidateProbe.qa?.forgeArtCandidate ?? null,
      lifecycle: { status: candidateStatus, expectedRow0Changed: candidateShouldChangeRow0 },
      overrideRows: candidateProbe.overrides,
      atlas: candidateData.atlas,
      changedRow0Cells: candidateCellsByRow[0].filter((sha, index) => sha !== baselineCellsByRow[0][index]).length,
      row0: {
        averageLuma: candidateRow0Metrics.averageLuma,
        rimOuterShare: candidateRow0Metrics.rimOuterShare,
        rimInnerShare: candidateRow0Metrics.rimInnerShare,
      },
      row0Changed: candidateRow0Changed,
      rows1To3Unchanged: candidateOtherRowsUnchanged,
      noConsoleOrPageErrors: manifest.errors.length === 0,
    };
    assertThat(candidateProbe.qa?.state === 'Playing', 'candidate override did not reach Playing');
    assertThat(candidateProbe.qa?.forgeArtCandidate === 'sunweaver-lumen-guard', 'candidate query was not retained in QA probe');
    assertThat(JSON.stringify(candidateProbe.overrides) === JSON.stringify([0]), `candidate override rows are ${JSON.stringify(candidateProbe.overrides)}`);
    assertThat(
      candidateRow0Changed === candidateShouldChangeRow0,
      `candidate row-0 lifecycle mismatch for ${candidateStatus}: changed=${candidateRow0Changed}`,
    );
    assertThat(candidateOtherRowsUnchanged, 'candidate override changed a combat row other than row 0');
    assertThat(candidateRow0Metrics.averageLuma.min >= R3_LUMA_FLOOR, 'candidate row 0 luminance is below the gameplay floor');
    assertThat(candidateRow0Metrics.rimOuterShare.min >= 0.85 && candidateRow0Metrics.rimInnerShare.min >= 0.85, 'candidate row 0 lost the runtime exterior rim');
    assertThat(candidateData.atlas.width === 1024 && candidateData.atlas.height === 256, 'candidate combat atlas dimensions changed');

    const candidateLineup = await stageFixture(candidatePage, 'lineup');
    await settleFrames(candidatePage);
    const candidateLineupPath = path.join(out, 'candidate-lineup-after.png');
    await candidatePage.screenshot({ path: candidateLineupPath, type: 'png' });
    const candidateLineupImage = analyzePng(candidateLineupPath, VIEWPORT.width, VIEWPORT.height);
    manifest.captures.candidateLineup = { file: path.basename(candidateLineupPath), image: candidateLineupImage };
    manifest.checks.candidateLineup = { fixture: candidateLineup, noRuntimeMagenta: candidateLineupImage.exactMagenta === 0 };
    assertThat(candidateLineupImage.exactMagenta === 0, `candidate lineup contains ${candidateLineupImage.exactMagenta} exact MAG pixels`);
    await candidatePage.close();

    const candidateBattlePage = await openPlayingPage(browser, server, manifest, 'candidate-battle', 'sunweaver-lumen-guard');
    pages.push(candidateBattlePage);
    const candidateBattle = await stageFixture(candidateBattlePage, 'battle');
    await settleFrames(candidateBattlePage);
    const candidateBattlePath = path.join(out, 'candidate-battle-after.png');
    await candidateBattlePage.screenshot({ path: candidateBattlePath, type: 'png' });
    const candidateBattleImage = analyzePng(candidateBattlePath, VIEWPORT.width, VIEWPORT.height);
    const candidateBattleRenderer = await readRenderer(candidateBattlePage);
    manifest.captures.candidateBattle = { file: path.basename(candidateBattlePath), image: candidateBattleImage };
    manifest.checks.candidateBattle = {
      fixture: candidateBattle,
      renderer: candidateBattleRenderer,
      noRuntimeMagenta: candidateBattleImage.exactMagenta === 0,
      overrideRows: await candidateBattlePage.evaluate(() => (globalThis.__STARHOLD_VIEW__?.combatRowOverrides ?? []).map((override) => override.row)),
    };
    assertThat(candidateBattleImage.exactMagenta === 0, `candidate battle contains ${candidateBattleImage.exactMagenta} exact MAG pixels`);
    assertThat(candidateBattle.before.some((entry) => entry.order === 6), 'candidate battle fixture did not issue opposing orders');
    assertThat(candidateBattle.after.some((entry, index) => entry.x !== candidateBattle.before[index].x || entry.z !== candidateBattle.before[index].z), 'candidate battle fixture did not take actual movement steps');
    await candidateBattlePage.close();

    const lineup = await stageFixture(exportPage, 'lineup');
    await settleFrames(exportPage);
    const worldScales = await readCombatInstanceScales(exportPage);
    manifest.checks.worldScales = {
      expected: EXPECTED_WORLD_SCALES,
      actual: worldScales,
      allExact: worldScales.every((mapping) => mapping.pass),
    };
    assertThat(
      sourceReadabilityFailures.length === 0 && exportData.sourceMetrics.frozenRows.pass && worldScales.every((mapping) => mapping.pass),
      `VS4 R3/VS4A source/scale contract failed: ${JSON.stringify({ sourceReadabilityFailures, frozenRows: exportData.sourceMetrics.frozenRows, worldScales })}`,
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
    console.log(`candidateAtlas=${path.join(out, 'candidate-atlas.png')}`);
    console.log(`candidateContact=${path.join(out, 'candidate-contact-sheet.png')}`);
    console.log(`candidateLineup=${path.join(out, 'candidate-lineup-after.png')}`);
    console.log(`candidateBattle=${path.join(out, 'candidate-battle-after.png')}`);
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
