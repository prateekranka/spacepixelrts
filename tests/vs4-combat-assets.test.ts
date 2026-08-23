// VS-4 — pure pixel contract for the four-unit directional combat strip.

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  COMBAT_AUTHORED_DIRS,
  COMBAT_CELL,
  COMBAT_COLS,
  COMBAT_LIVE_POSES,
  COMBAT_ROWS,
  MAG,
  Pix,
  applyCombatExteriorRim,
  drawCombatSprite,
} from '../src/sprites';
import { STARHOLD_PALETTE } from '../src/palette';

const DIRECTIONS = 8;
const POSES = 2;
const ALPHA_MIN = COMBAT_CELL * COMBAT_CELL * 0.12;
const ALPHA_MAX = COMBAT_CELL * COMBAT_CELL * 0.55;
const QUIET_TERRAIN_LUMA = 30;
const R3_LUMA_FLOOR = QUIET_TERRAIN_LUMA * 3;
const metricValues = {
  alpha: [] as number[],
  alphaWidth: [] as number[],
  alphaHeight: [] as number[],
  averageLuma: [] as number[],
  brightMaterialShare: [] as number[],
  rimOuterShare: [] as number[],
  rimInnerShare: [] as number[],
  connected: [] as number[],
  directionDelta: [] as number[],
  poseDelta: [] as number[],
  magShare: [] as number[],
  sourceHeight: [] as number[],
  guardIou: [] as number[],
  walkerIou: [] as number[],
};
const r2Failures: string[] = [];
const r3Failures: string[] = [];
const row2AnatomyFailures: string[] = [];
const row2AnatomyMetrics: Array<Record<string, unknown>> = [];

// SHA-256 of the complete deterministic RGBA cell emitted by the R3 renderer.
// Rows 0, 1, and 3 are frozen; row 2 is intentionally the VS4A replacement.
const FROZEN_R3_CELL_SHA256: Record<string, string> = {
  '0:0:0': 'd7741fab23ede149007a0799fe5c72fc9b5239f57e31bcae9b5e222f82957867',
  '0:0:1': 'f0570dbeeb99814e04cfc5378fe8f4ded31f94362cdf2adb2f23bca006b90ee1',
  '0:1:0': 'abcb42e56565b7cebdf12a0ead8a7dda4b437df75c31dad55ff263d8ac65d78e',
  '0:1:1': '9b8a7787456ebd2f4d356ef6475e7c1a20bdc94454fdd303fb0e1d5e28a16073',
  '0:2:0': '95051ce2a89a70f0ecfe7e78fad93633ac187e7b4e860bdaf700dd4fddca90c3',
  '0:2:1': 'f0caceda3d9f0404f56aed84c28ec146d9c081be0949cc12db64718f26624317',
  '0:3:0': '1ea11ded1350ed0512e459a7fbc0a6c110165f9683c632f18efb4d1673f6a1ec',
  '0:3:1': 'b46c042dc3b8ca4bdb3afdeb220e26735b7759e6d1ff56beec941c9c8f236b67',
  '0:4:0': '7dfc91b629d2ed1ddb7341154b2640c5a7209c02040fcb172cf5585b7ab2f0c0',
  '0:4:1': '697663070098e81d9bd2919928e6a8a43ae92f9666eb3fe2f2179f3634955c96',
  '0:5:0': 'f06a6bca3ae089d339dd87b15f45546c12a60480f99309f50532cd7378989376',
  '0:5:1': 'fd1647320a5007b4400b44774f80231489c8350ee1bf8a3a2da86cf44adbff57',
  '0:6:0': '5cfafcc0f89f6b93cdc707a8fb6bff3ce190635902e60bf8faecb11aea53d1fb',
  '0:6:1': '3e1b24b64422992d7b7fe9914da160eca3d1b248f224e7af26ce4e5380e149fe',
  '0:7:0': 'e76eb04d74d5707c992668867d11f8fbd1bf111ab71762d324274cbbd9912ce6',
  '0:7:1': '161482b9eb4eb686076286c9094d6aef7ea14ef9eb39636a6f478622291327fb',
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

function requireR2(condition: boolean, message: string): void {
  if (!condition) r2Failures.push(message);
}

function requireR3(condition: boolean, message: string): void {
  if (!condition) r3Failures.push(message);
}

function alphaAt(p: Pix, x: number, y: number): boolean {
  return p.d[(x + y * p.w) * 4 + 3] > 0;
}

function alphaCount(p: Pix): number {
  let count = 0;
  for (let i = 3; i < p.d.length; i += 4) if (p.d[i] > 0) count++;
  return count;
}

function brightMaterialShare(p: Pix): number {
  let bright = 0;
  let alpha = 0;
  for (let i = 0; i < p.d.length; i += 4) {
    if (p.d[i + 3] <= 0) continue;
    alpha++;
    const luma = 0.2126 * p.d[i] + 0.7152 * p.d[i + 1] + 0.0722 * p.d[i + 2];
    if (luma >= 65) bright++;
  }
  return bright / alpha;
}

function rec709Luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function averageLuma(p: Pix): number {
  let total = 0;
  let alpha = 0;
  for (let i = 0; i < p.d.length; i += 4) {
    if (p.d[i + 3] <= 0) continue;
    alpha++;
    total += rec709Luma(p.d[i], p.d[i + 1], p.d[i + 2]);
  }
  return total / alpha;
}

type Rgb = readonly [number, number, number];
type RimColors = { outer: Rgb; inner: Rgb };

function hexRgb(hex: string): Rgb {
  const value = Number.parseInt(hex.slice(1), 16);
  return [value >> 16 & 0xff, value >> 8 & 0xff, value & 0xff];
}

const RIM_COLORS: Record<number, RimColors> = {
  0: { outer: hexRgb(STARHOLD_PALETTE.amber), inner: hexRgb(STARHOLD_PALETTE.cream) },
  1: { outer: hexRgb(STARHOLD_PALETTE.amber), inner: hexRgb(STARHOLD_PALETTE.cream) },
  2: { outer: hexRgb(STARHOLD_PALETTE.ice), inner: hexRgb(STARHOLD_PALETTE.sky) },
  3: { outer: hexRgb(STARHOLD_PALETTE.ice), inner: hexRgb(STARHOLD_PALETTE.sky) },
};

function isRimColor(p: Pix, x: number, y: number, colors: RimColors): boolean {
  const i = (x + y * p.w) * 4;
  return (
    (p.d[i] === colors.outer[0] && p.d[i + 1] === colors.outer[1] && p.d[i + 2] === colors.outer[2]) ||
    (p.d[i] === colors.inner[0] && p.d[i + 1] === colors.inner[1] && p.d[i + 2] === colors.inner[2])
  );
}

function exteriorTransparency(p: Pix): Uint8Array {
  const exterior = new Uint8Array(p.w * p.h);
  const queue: number[] = [];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (x !== 0 && y !== 0 && x !== p.w - 1 && y !== p.h - 1) continue;
      const index = x + y * p.w;
      if (exterior[index] || alphaAt(p, x, y)) continue;
      exterior[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % p.w;
    const y = Math.floor(index / p.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
      const next = nx + ny * p.w;
      if (!exterior[next] && !alphaAt(p, nx, ny)) {
        exterior[next] = 1;
        queue.push(next);
      }
    }
  }
  return exterior;
}

function exteriorAlphaLayerShares(p: Pix, colors: RimColors): { outer: number; inner: number } {
  const exterior = exteriorTransparency(p);
  const counts = [0, 0];
  const allowed = [0, 0];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (!alphaAt(p, x, y)) continue;
      let layer = 0;
      for (let radius = 1; radius <= 2 && layer === 0; radius++) {
        for (let dy = -radius; dy <= radius && layer === 0; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < p.w && ny < p.h && exterior[nx + ny * p.w]) {
              layer = radius;
              break;
            }
          }
        }
      }
      if (layer < 1 || layer > 2) continue;
      counts[layer - 1]++;
      if (isRimColor(p, x, y, colors)) allowed[layer - 1]++;
    }
  }
  return {
    outer: counts[0] ? allowed[0] / counts[0] : 0,
    inner: counts[1] ? allowed[1] / counts[1] : 0,
  };
}

function alphaInRows(p: Pix, minY: number, maxY: number): number {
  let count = 0;
  for (let y = Math.max(0, minY); y <= Math.min(p.h - 1, maxY); y++) {
    for (let x = 0; x < p.w; x++) if (alphaAt(p, x, y)) count++;
  }
  return count;
}

// The documented core band is centered on the cowl/torso and excludes the
// exterior shield edge; weapon pixels remain outside it.
function guardBodyTop(p: Pix, row: number, dir: number): number {
  const colors = RIM_COLORS[row];
  const leftShield = row === 2 && (dir === 0 || dir === 3 || dir === 5);
  const [minX, maxX] = row === 2
    ? leftShield ? [34, 34] : [27, 29]
    : [29, 31];
  for (let y = 0; y < p.h; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (alphaAt(p, x, y) && !isRimColor(p, x, y, colors)) return y;
    }
  }
  return p.h;
}

function coreAlphaInRows(p: Pix, minY: number, maxY: number, row: number): number {
  const colors = RIM_COLORS[row];
  let count = 0;
  for (let y = Math.max(0, minY); y <= Math.min(p.h - 1, maxY); y++) {
    for (let x = 0; x < p.w; x++) if (alphaAt(p, x, y) && !isRimColor(p, x, y, colors)) count++;
  }
  return count;
}

type MaskBox = { count: number; minX: number; minY: number; maxX: number; maxY: number };
type MaskComponent = MaskBox;

function sha256(p: Pix): string {
  return createHash('sha256').update(Buffer.from(p.d)).digest('hex');
}

function coreMask(p: Pix, row: number): Uint8Array {
  const mask = new Uint8Array(p.w * p.h);
  const exteriorRim = new Uint8Array(p.w * p.h);
  const queue: number[] = [];
  const colors = RIM_COLORS[row];
  const traversable = (x: number, y: number): boolean => {
    if (!alphaAt(p, x, y)) return true;
    return isRimColor(p, x, y, colors);
  };
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (x !== 0 && y !== 0 && x !== p.w - 1 && y !== p.h - 1) continue;
      const index = x + y * p.w;
      if (traversable(x, y) && !exteriorRim[index]) {
        exteriorRim[index] = 1;
        queue.push(index);
      }
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % p.w;
    const y = Math.floor(index / p.w);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
      const next = nx + ny * p.w;
      if (!exteriorRim[next] && traversable(nx, ny)) {
        exteriorRim[next] = 1;
        queue.push(next);
      }
    }
  }
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (!alphaAt(p, x, y)) continue;
      if (!(exteriorRim[x + y * p.w] && isRimColor(p, x, y, colors))) mask[x + y * p.w] = 1;
    }
  }
  return mask;
}

function maskBox(mask: Uint8Array, minX: number, minY: number, maxX: number, maxY: number): MaskBox | null {
  let count = 0;
  let boxMinX = maxX + 1;
  let boxMinY = maxY + 1;
  let boxMaxX = minX - 1;
  let boxMaxY = minY - 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!mask[x + y * COMBAT_CELL]) continue;
      count++;
      boxMinX = Math.min(boxMinX, x);
      boxMinY = Math.min(boxMinY, y);
      boxMaxX = Math.max(boxMaxX, x);
      boxMaxY = Math.max(boxMaxY, y);
    }
  }
  return count ? { count, minX: boxMinX, minY: boxMinY, maxX: boxMaxX, maxY: boxMaxY } : null;
}

function maskComponents(mask: Uint8Array, minX: number, minY: number, maxX: number, maxY: number): MaskComponent[] {
  const seen = new Uint8Array(COMBAT_CELL * COMBAT_CELL);
  const components: MaskComponent[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const start = x + y * COMBAT_CELL;
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
        const qx = index % COMBAT_CELL;
        const qy = Math.floor(index / COMBAT_CELL);
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
            const next = nx + ny * COMBAT_CELL;
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

function boxWidth(box: MaskBox | null): number {
  return box ? box.maxX - box.minX + 1 : 0;
}

function boxHeight(box: MaskBox | null): number {
  return box ? box.maxY - box.minY + 1 : 0;
}

function longestIceRun(p: Pix, mask: Uint8Array, minX: number, minY: number, maxX: number, maxY: number): number {
  const ice = RIM_COLORS[2].outer;
  let longest = 0;
  for (let y = minY; y <= maxY; y++) {
    let run = 0;
    for (let x = minX; x <= maxX; x++) {
      const i = (x + y * p.w) * 4;
      const matches = mask[x + y * p.w] === 1 && p.d[i] === ice[0] && p.d[i + 1] === ice[1] && p.d[i + 2] === ice[2];
      run = matches ? run + 1 : 0;
      longest = Math.max(longest, run);
    }
  }
  return longest;
}

function boxCoordinates(mask: Uint8Array, minX: number, minY: number, maxX: number, maxY: number): Array<readonly [number, number]> {
  const result: Array<readonly [number, number]> = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) if (mask[x + y * COMBAT_CELL]) result.push([x, y]);
  }
  return result;
}

function hasCorePath(mask: Uint8Array, starts: Array<readonly [number, number]>, ends: Array<readonly [number, number]>): boolean {
  const target = new Uint8Array(COMBAT_CELL * COMBAT_CELL);
  for (const [x, y] of ends) target[x + y * COMBAT_CELL] = 1;
  const seen = new Uint8Array(COMBAT_CELL * COMBAT_CELL);
  const queue: number[] = [];
  for (const [x, y] of starts) {
    const index = x + y * COMBAT_CELL;
    if (!seen[index] && mask[index]) {
      seen[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (target[index]) return true;
    const x = index % COMBAT_CELL;
    const y = Math.floor(index / COMBAT_CELL);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= COMBAT_CELL || ny >= COMBAT_CELL) continue;
        const next = nx + ny * COMBAT_CELL;
        if (!seen[next] && mask[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
  }
  return false;
}

function polearmSpan(starts: Array<readonly [number, number]>, ends: Array<readonly [number, number]>): { distance: number; dx: number; dy: number; slope: number } {
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

function pixelMatches(p: Pix, x: number, y: number, color: Rgb): boolean {
  const i = (x + y * p.w) * 4;
  return p.d[i] === color[0] && p.d[i + 1] === color[1] && p.d[i + 2] === color[2];
}

function requireAnatomy(condition: boolean, message: string): void {
  if (!condition) row2AnatomyFailures.push(message);
}

function assertRimHelperContract(): void {
  const source = Pix.alloc(COMBAT_CELL, COMBAT_CELL);
  const sourceColor = [17, 29, 43, 255] as const;
  source.fillRect(20, 20, 24, 24, sourceColor);
  for (let y = 28; y < 32; y++) {
    for (let x = 28; x < 32; x++) source.set(x, y, [0, 0, 0, 0]);
  }
  const rimmed = applyCombatExteriorRim(source, [240, 193, 90, 255], [240, 231, 210, 255]);
  assert.deepEqual(Array.from(rimmed.d.slice((20 + 20 * rimmed.w) * 4, (20 + 20 * rimmed.w) * 4 + 4)), Array.from(sourceColor), 'rim overwrote source pixels');
  assert.deepEqual(Array.from(rimmed.d.slice((30 + 30 * rimmed.w) * 4, (30 + 30 * rimmed.w) * 4 + 4)), [0, 0, 0, 0], 'rim filled enclosed negative space');
  assert.deepEqual(Array.from(rimmed.d.slice((19 + 20 * rimmed.w) * 4, (19 + 20 * rimmed.w) * 4 + 4)), [240, 193, 90, 255], 'outer rim layer is not colorA');
  assert.deepEqual(Array.from(rimmed.d.slice((18 + 20 * rimmed.w) * 4, (18 + 20 * rimmed.w) * 4 + 4)), [240, 231, 210, 255], 'inner rim layer is not colorB');
}

function rgbaEqual(a: Pix, b: Pix, x: number, y: number): boolean {
  const ai = (x + y * a.w) * 4;
  const bi = (x + y * b.w) * 4;
  return a.d[ai] === b.d[bi] && a.d[ai + 1] === b.d[bi + 1] && a.d[ai + 2] === b.d[bi + 2] && a.d[ai + 3] === b.d[bi + 3];
}

function differingPixels(a: Pix, b: Pix): number {
  let count = 0;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (!rgbaEqual(a, b, x, y)) count++;
    }
  }
  return count;
}

function unionAlpha(a: Pix, b: Pix): number {
  let count = 0;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      if (alphaAt(a, x, y) || alphaAt(b, x, y)) count++;
    }
  }
  return count;
}

function meanRgbaDelta(a: Pix, b: Pix): number {
  let total = 0;
  for (let i = 0; i < a.d.length; i++) total += Math.abs(a.d[i] - b.d[i]);
  return total / a.d.length;
}

function silhouetteIou(a: Pix, b: Pix): number {
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < a.h; y++) {
    for (let x = 0; x < a.w; x++) {
      const aa = alphaAt(a, x, y);
      const bb = alphaAt(b, x, y);
      if (aa && bb) intersection++;
      if (aa || bb) union++;
    }
  }
  return intersection / union;
}

function sourceBounds(p: Pix): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = p.w;
  let minY = p.h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (!alphaAt(p, x, y)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}

function coreMinY(p: Pix, row: number): number {
  const colors = RIM_COLORS[row];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (alphaAt(p, x, y) && !isRimColor(p, x, y, colors)) return y;
    }
  }
  return p.h;
}

function primaryComponentShare(p: Pix): number {
  const seen = new Uint8Array(p.w * p.h);
  let largest = 0;
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      const start = x + y * p.w;
      if (seen[start] || !alphaAt(p, x, y)) continue;
      let size = 0;
      const queue: number[] = [start];
      seen[start] = 1;
      while (queue.length) {
        const index = queue.pop()!;
        const qx = index % p.w;
        const qy = Math.floor(index / p.w);
        size++;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = qx + dx;
            const ny = qy + dy;
            if (nx < 0 || ny < 0 || nx >= p.w || ny >= p.h) continue;
            const ni = nx + ny * p.w;
            if (!seen[ni] && alphaAt(p, nx, ny)) {
              seen[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }
      largest = Math.max(largest, size);
    }
  }
  return largest / alphaCount(p);
}

function magShare(p: Pix): number {
  let mag = 0;
  for (let i = 0; i < p.d.length; i += 4) {
    if (p.d[i] === MAG[0] && p.d[i + 1] === MAG[1] && p.d[i + 2] === MAG[2] && p.d[i + 3] === MAG[3]) mag++;
  }
  return mag / alphaCount(p);
}

assert.equal(COMBAT_CELL, 64, 'combat cells stay 64px');
assert.equal(COMBAT_COLS, 16, 'combat atlas has 16 live columns');
assert.equal(COMBAT_ROWS, 4, 'combat atlas has four frozen rows');
assert.equal(COMBAT_LIVE_POSES, POSES, 'combat strip has two live poses');
assert.deepEqual(COMBAT_AUTHORED_DIRS, [0, 1, 2, 6, 7], 'author only E/NE/N/S/SE');
assertRimHelperContract();

const cells: Pix[][][] = [];
for (let row = 0; row < COMBAT_ROWS; row++) {
  cells[row] = [];
  for (let dir = 0; dir < DIRECTIONS; dir++) {
    cells[row][dir] = [];
    for (let pose = 0; pose < POSES; pose++) {
      const p = drawCombatSprite(row, dir, pose);
      cells[row][dir][pose] = p;
      assert.equal(p.w, COMBAT_CELL, `row ${row} dir ${dir} pose ${pose} width`);
      assert.equal(p.h, COMBAT_CELL, `row ${row} dir ${dir} pose ${pose} height`);
      if (row === 0 || row === 1 || row === 3) {
        const key = `${row}:${dir}:${pose}`;
        assert.equal(sha256(p), FROZEN_R3_CELL_SHA256[key], `frozen R3 hash changed for row ${row} dir ${dir} pose ${pose}`);
      }
      const alpha = alphaCount(p);
      metricValues.alpha.push(alpha);
      assert.ok(alpha >= ALPHA_MIN && alpha <= ALPHA_MAX, `row ${row} dir ${dir} pose ${pose} alpha ${alpha}`);
      assert.ok(alpha > 0, `row ${row} dir ${dir} pose ${pose} is non-empty`);
      const connected = primaryComponentShare(p);
      metricValues.connected.push(connected);
      assert.ok(connected >= 0.96, `row ${row} dir ${dir} pose ${pose} connected`);
      const bounds = sourceBounds(p);
      assert.ok(bounds.minX >= 0 && bounds.minY >= 0 && bounds.maxX < COMBAT_CELL && bounds.maxY < COMBAT_CELL, `row ${row} dir ${dir} pose ${pose} bounds`);
      const alphaWidth = bounds.maxX - bounds.minX + 1;
      const alphaHeight = bounds.maxY - bounds.minY + 1;
      const brightShare = brightMaterialShare(p);
      const cellLuma = averageLuma(p);
      const rimShares = exteriorAlphaLayerShares(p, RIM_COLORS[row]);
      metricValues.alphaWidth.push(alphaWidth);
      metricValues.alphaHeight.push(alphaHeight);
      metricValues.averageLuma.push(cellLuma);
      metricValues.brightMaterialShare.push(brightShare);
      metricValues.rimOuterShare.push(rimShares.outer);
      metricValues.rimInnerShare.push(rimShares.inner);
      requireR3(cellLuma >= R3_LUMA_FLOOR, `row ${row} dir ${dir} pose ${pose} average luma ${cellLuma.toFixed(2)}, expected >=${R3_LUMA_FLOOR}`);
      requireR3(rimShares.outer >= 0.85, `row ${row} dir ${dir} pose ${pose} exterior outer rim ${(rimShares.outer * 100).toFixed(2)}%, expected >=85%`);
      requireR3(rimShares.inner >= 0.85, `row ${row} dir ${dir} pose ${pose} exterior inner rim ${(rimShares.inner * 100).toFixed(2)}%, expected >=85%`);
      if (row === 0 || row === 2) {
        requireR2(alphaWidth >= 24 && alphaHeight >= 44, `row ${row} dir ${dir} pose ${pose} guard alpha bound ${alphaWidth}x${alphaHeight}, expected >=24x44`);
        requireR2(bounds.minY <= 2, `row ${row} dir ${dir} pose ${pose} spear minY ${bounds.minY}, expected <=2`);
        requireR2(alphaInRows(p, 0, 2) >= 4, `row ${row} dir ${dir} pose ${pose} spear pixels rows0..2 ${alphaInRows(p, 0, 2)}, expected >=4`);
        const bodyTop = guardBodyTop(p, row, dir);
        requireR2(bodyTop >= 11, `row ${row} dir ${dir} pose ${pose} guard body top ${bodyTop}, expected >=11`);
        const coreSpearTop = coreMinY(p, row);
        requireR3(coreAlphaInRows(p, 0, 0, row) >= 2, `row ${row} dir ${dir} pose ${pose} spear tip has no connected core pixels in row0`);
        requireR3(bodyTop >= 16, `row ${row} dir ${dir} pose ${pose} guard core body top ${bodyTop}, expected >=16`);
        requireR3(bounds.maxY <= 51, `row ${row} dir ${dir} pose ${pose} guard final foot ${bounds.maxY}, expected <=51`);
        requireR3(bodyTop - coreSpearTop >= 16, `row ${row} dir ${dir} pose ${pose} spear extension ${bodyTop - coreSpearTop}px, expected >=16`);
      } else {
        requireR2(alphaWidth >= 44 && alphaHeight >= 28, `row ${row} dir ${dir} pose ${pose} walker alpha bound ${alphaWidth}x${alphaHeight}, expected >=44x28`);
      }
      requireR2(brightShare >= 0.30, `row ${row} dir ${dir} pose ${pose} bright material ${(brightShare * 100).toFixed(2)}%, expected >=30%`);
      const sourceHeight = bounds.maxY - bounds.minY + 1;
      metricValues.sourceHeight.push(sourceHeight);
      assert.ok(sourceHeight >= 40 && sourceHeight <= 52, `row ${row} dir ${dir} pose ${pose} source height`);
      const share = magShare(p);
      metricValues.magShare.push(share);
      assert.ok(share >= 0.005 && share <= 0.05, `row ${row} dir ${dir} pose ${pose} MAG share ${share}`);
    }
    const poseDelta = differingPixels(cells[row][dir][0], cells[row][dir][1]) / unionAlpha(cells[row][dir][0], cells[row][dir][1]) * 100;
    metricValues.poseDelta.push(poseDelta);
    assert.ok(poseDelta > 4 && poseDelta < 45, `row ${row} dir ${dir} pose delta ${poseDelta}`);
  }
  const ne = cells[row][2][0];
  const east = cells[row][0][0];
  const directionDelta = meanRgbaDelta(ne, east);
  metricValues.directionDelta.push(directionDelta);
  assert.ok(directionDelta > 18, `row ${row} N/E mean RGBA delta`);
}

for (const [source, mirror] of [[1, 3], [0, 4], [7, 5]] as const) {
  for (let row = 0; row < COMBAT_ROWS; row++) {
    for (let pose = 0; pose < POSES; pose++) {
      assert.deepEqual(
        Array.from(cells[row][mirror][pose].d),
        Array.from(cells[row][source][pose].flipX().d),
        `row ${row} dir ${mirror} mirrors dir ${source}`,
      );
    }
  }
}

function normalizedFacing(dir: number): number {
  if (dir === 3) return 1;
  if (dir === 4) return 0;
  if (dir === 5) return 7;
  return dir;
}

// VS4A anatomy is evaluated in the authored right-facing frame. Mirrored
// directions are flipped back to their exact authored source before measuring.
for (let dir = 0; dir < DIRECTIONS; dir++) {
  for (let pose = 0; pose < POSES; pose++) {
    const normalized = normalizedFacing(dir);
    const authored = dir === 3 || dir === 4 || dir === 5
      ? cells[2][dir][pose].flipX()
      : cells[2][dir][pose];
    const mask = coreMask(authored, 2);

    const head = maskBox(mask, 29, 16, 40, 27);
    const headComponents = maskComponents(mask, 29, 16, 40, 27);
    const headLargest = Math.max(0, ...headComponents.map((component) => component.count));
    const visorWidth = longestIceRun(authored, mask, 29, 16, 40, 27);
    requireAnatomy(head !== null && boxWidth(head) === 12 && boxHeight(head) === 12,
      `dir ${dir} pose ${pose} (authored ${normalized}) head outer mass ${head ? `${boxWidth(head)}x${boxHeight(head)}` : 'empty'}, expected 12x12`);
    requireAnatomy(headLargest >= 80,
      `dir ${dir} pose ${pose} (authored ${normalized}) head connected core ${headLargest}, expected >=80`);
    requireAnatomy(visorWidth >= 6,
      `dir ${dir} pose ${pose} (authored ${normalized}) ice visor ${visorWidth}px, expected >=6px`);

    const torso = maskBox(mask, 25, 27, 46, 43);
    requireAnatomy(torso !== null && boxWidth(torso) >= 18 && boxHeight(torso) >= 16 && torso.count >= 180,
      `dir ${dir} pose ${pose} (authored ${normalized}) torso ${torso ? `${boxWidth(torso)}x${boxHeight(torso)} ${torso.count}px` : 'empty'}, expected >=18x16 and >=180px`);

    const leftLegComponents = maskComponents(mask, 24, 42, 33, 51);
    const rightLegComponents = maskComponents(mask, 36, 42, 45, 51);
    const leftLeg = leftLegComponents.reduce((best, component) => boxWidth(component) > boxWidth(best) ? component : best, null as MaskComponent | null);
    const rightLeg = rightLegComponents.reduce((best, component) => boxWidth(component) > boxWidth(best) ? component : best, null as MaskComponent | null);
    requireAnatomy(leftLeg !== null && boxWidth(leftLeg) >= 6 && boxHeight(leftLeg) >= 6,
      `dir ${dir} pose ${pose} (authored ${normalized}) left leg ${leftLeg ? `${boxWidth(leftLeg)}x${boxHeight(leftLeg)}` : 'empty'}, expected separate >=6px-wide mass`);
    requireAnatomy(rightLeg !== null && boxWidth(rightLeg) >= 6 && boxHeight(rightLeg) >= 6,
      `dir ${dir} pose ${pose} (authored ${normalized}) right leg ${rightLeg ? `${boxWidth(rightLeg)}x${boxHeight(rightLeg)}` : 'empty'}, expected separate >=6px-wide mass`);
    const centerGap = maskBox(mask, 33, 45, 36, 51)?.count ?? 0;
    requireAnatomy(centerGap === 0,
      `dir ${dir} pose ${pose} (authored ${normalized}) leg center gap has ${centerGap} core pixels, expected 0`);

    const shield = maskBox(mask, 8, 19, 26, 49);
    requireAnatomy(shield !== null && boxWidth(shield) >= 16 && boxHeight(shield) >= 29,
      `dir ${dir} pose ${pose} (authored ${normalized}) shield ${shield ? `${boxWidth(shield)}x${boxHeight(shield)}` : 'empty'}, expected >=16x29 in x8..26/y19..49`);
    requireAnatomy(shield === null || (shield.minX >= 8 && shield.maxX <= 26 && shield.minY >= 19 && shield.maxY <= 49),
      `dir ${dir} pose ${pose} (authored ${normalized}) shield leaves x8..26/y19..49`);
    const braceRows: number[] = [];
    let bracePixels = 0;
    for (let y = 29; y <= 36; y++) {
      let rowPixels = 0;
      for (let x = 25; x <= 26; x++) if (mask[x + y * COMBAT_CELL]) rowPixels++;
      if (rowPixels) {
        braceRows.push(y);
        bracePixels += rowPixels;
      }
    }
    requireAnatomy(braceRows.length >= 2 && braceRows.length <= 3 && bracePixels >= 4 && bracePixels <= 6,
      `dir ${dir} pose ${pose} (authored ${normalized}) shield brace ${bracePixels}px over ${braceRows.length} rows, expected 2-3px thick`);
    const shieldAccentColors = [hexRgb(STARHOLD_PALETTE.sand), hexRgb(STARHOLD_PALETTE.ochre)];
    let headShieldAccents = 0;
    for (let y = 16; y <= 27; y++) {
      for (let x = 29; x <= 40; x++) {
        if (shieldAccentColors.some((color) => pixelMatches(authored, x, y, color)) || pixelMatches(authored, x, y, MAG)) headShieldAccents++;
      }
    }
    requireAnatomy(headShieldAccents === 0,
      `dir ${dir} pose ${pose} (authored ${normalized}) shield accent pixels in head center ${headShieldAccents}, expected 0`);

    const grip = boxCoordinates(mask, 41, 29, 46, 35);
    const corridorNear = maskBox(mask, 47, 22, 51, 28);
    const corridorFar = maskBox(mask, 53, 11, 57, 18);
    const tip = boxCoordinates(mask, 60, 0, 63, 6);
    requireAnatomy(grip.length > 0, `dir ${dir} pose ${pose} (authored ${normalized}) polearm grip is empty`);
    requireAnatomy(tip.length > 0, `dir ${dir} pose ${pose} (authored ${normalized}) polearm tip x>=60/y<=6 is empty`);
    requireAnatomy(corridorNear !== null && corridorFar !== null,
      `dir ${dir} pose ${pose} (authored ${normalized}) diagonal polearm corridor is incomplete`);
    const span = polearmSpan(grip, tip);
    requireAnatomy(hasCorePath(mask, grip, tip),
      `dir ${dir} pose ${pose} (authored ${normalized}) polearm has no connected grip-to-tip core path`);
    requireAnatomy(span.distance >= 32 && span.dx >= 16 && span.slope >= 0.8 && span.slope <= 2.0,
      `dir ${dir} pose ${pose} (authored ${normalized}) polearm span ${span.distance.toFixed(2)}px dx${span.dx} slope${span.slope.toFixed(2)}, expected >=32px/dx16/slope0.8..2.0`);

    row2AnatomyMetrics.push({
      dir,
      pose,
      normalizedDir: normalized,
      head: { pixels: head?.count ?? 0, bbox: [boxWidth(head), boxHeight(head)], connected: headLargest, visor: visorWidth },
      torso: { pixels: torso?.count ?? 0, bbox: [boxWidth(torso), boxHeight(torso)] },
      legs: { left: leftLeg ? [boxWidth(leftLeg), boxHeight(leftLeg)] : null, right: rightLeg ? [boxWidth(rightLeg), boxHeight(rightLeg)] : null, gapPixels: centerGap },
      shield: { pixels: shield?.count ?? 0, bbox: [boxWidth(shield), boxHeight(shield)], bracePixels, braceRows: braceRows.length, headShieldAccents },
      polearm: { gripPixels: grip.length, corridorNear: corridorNear?.count ?? 0, corridorFar: corridorFar?.count ?? 0, tipPixels: tip.length, distance: span.distance, horizontal: span.dx, slope: span.slope, connected: hasCorePath(mask, grip, tip) },
    });
  }
}

for (let dir = 0; dir < DIRECTIONS; dir++) {
  const guardIou = silhouetteIou(cells[0][dir][0], cells[2][dir][0]);
  const walkerIou = silhouetteIou(cells[1][dir][0], cells[3][dir][0]);
  metricValues.guardIou.push(guardIou);
  metricValues.walkerIou.push(walkerIou);
  assert.ok(guardIou < 0.78, `guard silhouette IoU dir ${dir}`);
  assert.ok(walkerIou < 0.78, `walker silhouette IoU dir ${dir}`);
}

function range(values: readonly number[]): { min: number; max: number } {
  return { min: Math.min(...values), max: Math.max(...values) };
}

console.log(`VS4 pixel metrics: ${JSON.stringify({
  cells: COMBAT_ROWS * DIRECTIONS * POSES,
  alphaPixels: range(metricValues.alpha),
  connectedShare: range(metricValues.connected),
  directionMeanRgbaDelta: range(metricValues.directionDelta),
  poseDeltaPercent: range(metricValues.poseDelta),
  magShare: range(metricValues.magShare),
  sourceHeight: range(metricValues.sourceHeight),
  averageLuma: range(metricValues.averageLuma),
  alphaWidth: range(metricValues.alphaWidth),
  alphaHeight: range(metricValues.alphaHeight),
  brightMaterialShare: range(metricValues.brightMaterialShare),
  rimOuterShare: range(metricValues.rimOuterShare),
  rimInnerShare: range(metricValues.rimInnerShare),
  guardSilhouetteIou: range(metricValues.guardIou),
  walkerSilhouetteIou: range(metricValues.walkerIou),
})}`);
console.log(`VS4 R2 readability failures: ${JSON.stringify(r2Failures)}`);
assert.equal(r2Failures.length, 0, `VS4 R2 readability contract RED: ${r2Failures.join('; ')}`);
console.log(`VS4 R3 readability failures: ${JSON.stringify(r3Failures)}`);
assert.equal(r3Failures.length, 0, `VS4 R3 final normal-scale contract RED: ${r3Failures.join('; ')}`);
console.log(`VS4A frozen row hash check: ${JSON.stringify({ cells: Object.keys(FROZEN_R3_CELL_SHA256).length, pass: true })}`);
console.log(`VS4A row2 anatomy metrics: ${JSON.stringify({ cells: row2AnatomyMetrics.length, failures: row2AnatomyFailures, metrics: row2AnatomyMetrics })}`);
assert.equal(row2AnatomyFailures.length, 0, `VS4A row2 anatomy contract RED: ${row2AnatomyFailures.join('; ')}`);
console.log('VS4 combat pixel contract: PASS');
