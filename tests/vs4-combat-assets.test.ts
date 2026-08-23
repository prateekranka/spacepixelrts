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
  drawCombatSprite,
} from '../src/sprites';

const DIRECTIONS = 8;
const POSES = 2;
const ALPHA_MIN = COMBAT_CELL * COMBAT_CELL * 0.12;
const ALPHA_MAX = COMBAT_CELL * COMBAT_CELL * 0.55;
const metricValues = {
  alpha: [] as number[],
  connected: [] as number[],
  directionDelta: [] as number[],
  poseDelta: [] as number[],
  magShare: [] as number[],
  sourceHeight: [] as number[],
  guardIou: [] as number[],
  walkerIou: [] as number[],
};

function alphaAt(p: Pix, x: number, y: number): boolean {
  return p.d[(x + y * p.w) * 4 + 3] > 0;
}

function alphaCount(p: Pix): number {
  let count = 0;
  for (let i = 3; i < p.d.length; i += 4) if (p.d[i] > 0) count++;
  return count;
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
  guardSilhouetteIou: range(metricValues.guardIou),
  walkerSilhouetteIou: range(metricValues.walkerIou),
})}`);
console.log('VS4 combat pixel contract: PASS');
