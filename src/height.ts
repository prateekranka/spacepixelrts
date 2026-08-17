/** P96 — CPU heightmap helpers (sim gen + render sampling). */

import { MAP, clamp } from './engine';

export const HEIGHT_SCALE = 0.9;

function hash21(x: number, z: number, seed: number): number {
  const n = Math.sin((x + seed * 0.013) * 127.1 + (z + seed * 0.029) * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

export function valueNoise2D(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const u = fx * fx * (3 - 2 * fx);
  const v = fz * fz * (3 - 2 * fz);
  const a = hash21(ix, iz, seed);
  const b = hash21(ix + 1, iz, seed);
  const c = hash21(ix, iz + 1, seed);
  const d = hash21(ix + 1, iz + 1, seed);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x: number, z: number, seed: number): number {
  let sum = 0;
  let amp = 0.55;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise2D(x * 0.045 * freq + 17, z * 0.045 * freq + 31, seed + o * 97);
    norm += amp;
    amp *= 0.5;
    freq *= 2.1;
  }
  return sum / norm;
}

/** Terrace raw 0–1 noise into stored levels 0–3. */
export function terraceStore(h: number): number {
  const band = h * 4;
  const level = Math.floor(band);
  const fract = band - level;
  const ramp = Math.min(2 * fract, 1);
  const ht = (level + ramp) / 4;
  return Math.round(ht * 3) | 0;
}

export function heightWorld(level: number): number {
  return level * HEIGHT_SCALE;
}

export function sampleHeight(height: Uint8Array, x: number, z: number): number {
  const tx = clamp(x | 0, 0, MAP - 1);
  const tz = clamp(z | 0, 0, MAP - 1);
  return heightWorld(height[tx + tz * MAP]);
}

export function sampleHeightBilinear(height: Uint8Array, x: number, z: number): number {
  const fx = clamp(x, 0, MAP - 1.001);
  const fz = clamp(z, 0, MAP - 1.001);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, MAP - 1);
  const z1 = Math.min(z0 + 1, MAP - 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const h00 = height[x0 + z0 * MAP];
  const h10 = height[x1 + z0 * MAP];
  const h01 = height[x0 + z1 * MAP];
  const h11 = height[x1 + z1 * MAP];
  const h0 = h00 + (h10 - h00) * tx;
  const h1 = h01 + (h11 - h01) * tx;
  return heightWorld(h0 + (h1 - h0) * tz);
}
