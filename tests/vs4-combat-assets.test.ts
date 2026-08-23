// VS-4 — pure pixel contract for the four-unit directional combat strip.

import assert from 'node:assert/strict';
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
console.log('VS4 combat pixel contract: PASS');
