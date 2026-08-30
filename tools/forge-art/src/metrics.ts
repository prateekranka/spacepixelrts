// Forge Art Lab — metrics library (FAL-METRICS).
//
// Pure, DOM-free, import-safe from tsx tests, node scripts, and the browser
// workbench. Adapted from the accepted VS-4 gate algorithms in
// tests/vs4-combat-assets.test.ts (the algorithm oracle; that file stays
// verbatim and keeps its own copies). Conventions locked (A2 §2 / §5):
//   - alpha convention: a pixel is "alpha" when alpha >= minAlpha (default 1),
//     which reproduces the VS-4 `alpha > 0` rule exactly for integer alpha.
//   - connectivity: alpha components / maskComponents / hasCorePath are
//     8-neighbor; exterior flood fills (exteriorTransparency, coreMask) are
//     4-neighbor. Enclosed holes are interior — never exterior.
//   - meanRgbaDelta divides by d.length (w*h*4), NOT alphaCount (VS-4
//     convention; do not "fix").
//   - color equality is exact byte equality (RGB-only for Rgb colors; full
//     RGBA for Rgba colors). Palette matching has zero tolerance.
//   - mask operations take explicit w/h stride parameters (never hardcoded).
//   - division-by-zero guards return NaN (documented per function). Never
//     crashes mid-report; never mutates inputs.
//   - hashing: node:crypto behind a lazy, window-guarded lookup; browsers fall
//     back to the bundled pure-JS SHA-256 (jsSha256). Both produce identical
//     hex digests (calibrated).

// ---------------------------------------------------------------------------
// Shared types (A2 §2, verbatim)
// ---------------------------------------------------------------------------

/** RGBA interleave, row stride = width*4. Structural: Pix and pngjs both fit. */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

export type Rgb = readonly [number, number, number];
export type Rgba = readonly [number, number, number, number];

export interface Box {
  count: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RimColors {
  outer: Rgb;
  inner: Rgb;
}

export interface Span {
  distance: number;
  dx: number;
  dy: number;
  slope: number;
}

/** Adapter: `Pix` (src/sprites) -> RgbaImage, sharing the same buffer (read-only usage). */
export function pixView(pix: {
  readonly w: number;
  readonly h: number;
  readonly d: Uint8Array | Uint8ClampedArray;
}): RgbaImage {
  return { width: pix.w, height: pix.h, data: pix.d };
}

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

type NodeCrypto = {
  createHash: (algorithm: string) => {
    update: (data: Uint8Array | Uint8ClampedArray) => { digest: (encoding: 'hex') => string };
  };
};

/**
 * Lazy node:crypto lookup, guarded so browsers never touch node builtins.
 * Uses process.getBuiltinModule (Node >= 22.3) or a CJS global require.
 * Returns null when unavailable (browser / worker) — callers fall back to
 * the pure-JS implementation.
 */
function nodeCrypto(): NodeCrypto | null {
  try {
    const g = globalThis as {
      window?: unknown;
      process?: { getBuiltinModule?: (name: string) => unknown };
      require?: (name: string) => unknown;
    };
    if (typeof g.window !== 'undefined') return null;
    if (typeof g.process !== 'undefined' && typeof g.process.getBuiltinModule === 'function') {
      return g.process.getBuiltinModule('node:crypto') as NodeCrypto;
    }
    if (typeof g.require === 'function') return g.require('node:crypto') as NodeCrypto;
  } catch {
    // fall through to the pure-JS implementation
  }
  return null;
}

const SHA256_K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr32(x: number, n: number): number {
  return (x >>> n) | (x << (32 - n));
}

/**
 * Pure-JS SHA-256 (FIPS 180-4) over raw bytes -> lowercase hex.
 * Browser fallback for sha256Bytes; digests are byte-identical to node:crypto
 * (verified in calibration over thousands of inputs).
 */
export function jsSha256(bytes: Uint8Array | Uint8ClampedArray): string {
  const bitLenHi = Math.floor(bytes.length / 0x20000000); // (len*8) high 32 bits
  const bitLenLo = (bytes.length * 8) >>> 0;
  const padded = Math.ceil((bytes.length + 9) / 64) * 64;
  const msg = new Uint8Array(padded);
  msg.set(bytes);
  msg[bytes.length] = 0x80;
  const dv = new DataView(msg.buffer);
  dv.setUint32(padded - 8, bitLenHi);
  dv.setUint32(padded - 4, bitLenLo);

  const H = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);

  for (let offset = 0; offset < padded; offset += 64) {
    for (let i = 0; i < 16; i++) w[i] = dv.getUint32(offset + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr32(w[i - 15], 7) ^ rotr32(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr32(w[i - 2], 17) ^ rotr32(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }
    let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
    for (let i = 0; i < 64; i++) {
      const S1 = rotr32(e, 6) ^ rotr32(e, 11) ^ rotr32(e, 25);
      const ch = (e & f) ^ (~e & g);
      const t1 = (h + S1 + ch + SHA256_K[i] + w[i]) | 0;
      const S0 = rotr32(a, 2) ^ rotr32(a, 13) ^ rotr32(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const t2 = (S0 + maj) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }

  let hex = '';
  for (let i = 0; i < 8; i++) hex += H[i].toString(16).padStart(8, '0');
  return hex;
}

/** SHA-256 hex over arbitrary bytes (node:crypto when available, else jsSha256). */
export function sha256Bytes(bytes: Uint8Array | Uint8ClampedArray): string {
  const crypto = nodeCrypto();
  if (crypto !== null) return crypto.createHash('sha256').update(bytes).digest('hex');
  return jsSha256(bytes);
}

/** SHA-256 over the image's full RGBA stream (first w*h*4 bytes of data, alpha included). */
export function imageSha256(img: RgbaImage): string {
  return sha256Bytes(img.data.subarray(0, img.width * img.height * 4));
}

/**
 * SHA-256 over a size x size cell region at atlas offset (ox, oy), copied
 * row-by-row with the atlas row stride (cell stride != cell size in atlases).
 * Throws when the region falls outside the image.
 */
export function regionSha256(img: RgbaImage, ox: number, oy: number, size: number): string {
  if (ox < 0 || oy < 0 || size <= 0 || ox + size > img.width || oy + size > img.height) {
    throw new Error(`regionSha256: region (${ox},${oy},${size}) outside ${img.width}x${img.height} image`);
  }
  const out = new Uint8Array(size * size * 4);
  const stride = img.width * 4;
  for (let y = 0; y < size; y++) {
    out.set(img.data.subarray((oy + y) * stride + ox * 4, (oy + y) * stride + ox * 4 + size * 4), y * size * 4);
  }
  return sha256Bytes(out);
}

// ---------------------------------------------------------------------------
// Alpha coverage & bounds
// ---------------------------------------------------------------------------

/** True when the pixel's alpha >= minAlpha (VS-4 `alpha > 0` == `>= 1`). */
export function alphaAt(img: RgbaImage, x: number, y: number, minAlpha = 1): boolean {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return false;
  return img.data[(x + y * img.width) * 4 + 3] >= minAlpha;
}

/** Count of pixels with alpha >= minAlpha. */
export function alphaCount(img: RgbaImage, minAlpha = 1): number {
  let count = 0;
  for (let i = 3; i < img.data.length; i += 4) if (img.data[i] >= minAlpha) count++;
  return count;
}

/** alphaCount / (w*h). NaN when the image has zero pixels. */
export function alphaCoverage(img: RgbaImage, minAlpha = 1): number {
  const total = img.width * img.height;
  if (total === 0) return NaN;
  return alphaCount(img, minAlpha) / total;
}

/** Tight bbox of alpha pixels (count = alphaCount); null when empty. */
export function sourceBounds(img: RgbaImage, minAlpha = 1): Box | null {
  let minX = img.width;
  let minY = img.height;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!alphaAt(img, x, y, minAlpha)) continue;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  if (maxX < 0) return null;
  return { count: alphaCount(img, minAlpha), minX, minY, maxX, maxY };
}

/** Count of alpha pixels within rows minY..maxY (clamped to the image). */
export function alphaInRows(img: RgbaImage, minY: number, maxY: number, minAlpha = 1): number {
  let count = 0;
  const y0 = Math.max(0, minY);
  const y1 = Math.min(img.height - 1, maxY);
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < img.width; x++) if (alphaAt(img, x, y, minAlpha)) count++;
  }
  return count;
}

/** Last alpha row (sourceBounds.maxY); null when the image has no alpha. */
export function groundContactRow(img: RgbaImage, minAlpha = 1): number | null {
  const bounds = sourceBounds(img, minAlpha);
  return bounds === null ? null : bounds.maxY;
}

/** (h-1) - groundContactRow. NaN when the image has no alpha. */
export function bottomGapRows(img: RgbaImage, minAlpha = 1): number {
  const row = groundContactRow(img, minAlpha);
  return row === null ? NaN : img.height - 1 - row;
}

// ---------------------------------------------------------------------------
// Luminance
// ---------------------------------------------------------------------------

/** Rec. 709 luma: 0.2126r + 0.7152g + 0.0722b. */
export function rec709Luma(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Mean rec709Luma over alpha pixels only. NaN when no alpha pixels. */
export function averageLuma(img: RgbaImage, minAlpha = 1): number {
  let total = 0;
  let alpha = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < minAlpha) continue;
    alpha++;
    total += rec709Luma(img.data[i], img.data[i + 1], img.data[i + 2]);
  }
  return alpha ? total / alpha : NaN;
}

/** Share of alpha pixels with luma >= lumaFloor (default 65). NaN when no alpha pixels. */
export function brightMaterialShare(img: RgbaImage, lumaFloor = 65, minAlpha = 1): number {
  let bright = 0;
  let alpha = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (img.data[i + 3] < minAlpha) continue;
    alpha++;
    if (rec709Luma(img.data[i], img.data[i + 1], img.data[i + 2]) >= lumaFloor) bright++;
  }
  return alpha ? bright / alpha : NaN;
}

/** Maximum rec709Luma over ALL pixels (frame-level probe; not alpha-filtered). 0 when empty. */
export function maxLuma(img: RgbaImage): number {
  let max = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    max = Math.max(max, rec709Luma(img.data[i], img.data[i + 1], img.data[i + 2]));
  }
  return max;
}

/** Share of ALL pixels with luma > lumaFloor (default 10). NaN when the image has zero pixels. */
export function litRatio(img: RgbaImage, lumaFloor = 10): number {
  const total = img.width * img.height;
  if (total === 0) return NaN;
  let lit = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (rec709Luma(img.data[i], img.data[i + 1], img.data[i + 2]) > lumaFloor) lit++;
  }
  return lit / total;
}

/** True when the frame fails the VS-4 mjs non-empty probe: !(maxLuma > 6 && litRatio(10) > 0.002). */
export function isEmptyOrBlack(img: RgbaImage): boolean {
  return !(maxLuma(img) > 6 && litRatio(img, 10) > 0.002);
}

// ---------------------------------------------------------------------------
// Connectivity / regions (mask ops take explicit stride w; regions clamp)
// ---------------------------------------------------------------------------

/** Count + tight bbox of set bits in region (clamped to mask bounds); null when empty. */
export function maskBox(mask: Uint8Array, w: number, h: number, region: Box): Box | null {
  const minX = Math.max(0, region.minX);
  const minY = Math.max(0, region.minY);
  const maxX = Math.min(w - 1, region.maxX);
  const maxY = Math.min(h - 1, region.maxY);
  let count = 0;
  let boxMinX = maxX + 1;
  let boxMinY = maxY + 1;
  let boxMaxX = minX - 1;
  let boxMaxY = minY - 1;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (!mask[x + y * w]) continue;
      count++;
      boxMinX = Math.min(boxMinX, x);
      boxMinY = Math.min(boxMinY, y);
      boxMaxX = Math.max(boxMaxX, x);
      boxMaxY = Math.max(boxMaxY, y);
    }
  }
  return count ? { count, minX: boxMinX, minY: boxMinY, maxX: boxMaxX, maxY: boxMaxY } : null;
}

/** Box width in pixels; 0 for null. */
export function boxWidth(box: Box | null): number {
  return box ? box.maxX - box.minX + 1 : 0;
}

/** Box height in pixels; 0 for null. */
export function boxHeight(box: Box | null): number {
  return box ? box.maxY - box.minY + 1 : 0;
}

/** List of set [x, y] pixels within region (clamped to mask bounds). */
export function boxCoordinates(mask: Uint8Array, w: number, h: number, region: Box): Array<readonly [number, number]> {
  const result: Array<readonly [number, number]> = [];
  const minX = Math.max(0, region.minX);
  const minY = Math.max(0, region.minY);
  const maxX = Math.min(w - 1, region.maxX);
  const maxY = Math.min(h - 1, region.maxY);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) if (mask[x + y * w]) result.push([x, y]);
  }
  return result;
}

/** 8-neighbor connected components of set bits inside region (BFS stays inside region). */
export function maskComponents(mask: Uint8Array, w: number, h: number, region: Box): Box[] {
  const minX = Math.max(0, region.minX);
  const minY = Math.max(0, region.minY);
  const maxX = Math.min(w - 1, region.maxX);
  const maxY = Math.min(h - 1, region.maxY);
  const seen = new Uint8Array(w * h);
  const components: Box[] = [];
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const start = x + y * w;
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
        const qx = index % w;
        const qy = Math.floor(index / w);
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
            const next = nx + ny * w;
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

/** True when an 8-neighbor path over set mask bits connects any start to any end. */
export function hasCorePath(
  mask: Uint8Array,
  w: number,
  h: number,
  starts: Array<readonly [number, number]>,
  ends: Array<readonly [number, number]>,
): boolean {
  const target = new Uint8Array(w * h);
  for (const [x, y] of ends) {
    if (x >= 0 && y >= 0 && x < w && y < h) target[x + y * w] = 1;
  }
  const seen = new Uint8Array(w * h);
  const queue: number[] = [];
  for (const [x, y] of starts) {
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const index = x + y * w;
    if (!seen[index] && mask[index]) {
      seen[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    if (target[index]) return true;
    const x = index % w;
    const y = Math.floor(index / w);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const next = nx + ny * w;
        if (!seen[next] && mask[next]) {
          seen[next] = 1;
          queue.push(next);
        }
      }
    }
  }
  return false;
}

/** Largest 8-neighbor alpha component / alphaCount. NaN when no alpha pixels. */
export function primaryComponentShare(img: RgbaImage, minAlpha = 1): number {
  const total = alphaCount(img, minAlpha);
  if (total === 0) return NaN;
  const seen = new Uint8Array(img.width * img.height);
  let largest = 0;
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const start = x + y * img.width;
      if (seen[start] || !alphaAt(img, x, y, minAlpha)) continue;
      let size = 0;
      const queue: number[] = [start];
      seen[start] = 1;
      while (queue.length) {
        const index = queue.pop()!;
        const qx = index % img.width;
        const qy = Math.floor(index / img.width);
        size++;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = qx + dx;
            const ny = qy + dy;
            if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
            const ni = nx + ny * img.width;
            if (!seen[ni] && alphaAt(img, nx, ny, minAlpha)) {
              seen[ni] = 1;
              queue.push(ni);
            }
          }
        }
      }
      largest = Math.max(largest, size);
    }
  }
  return largest / total;
}

/**
 * Longest run of pixels that are in-mask (mask stride = img.width; null mask =
 * all in-mask) AND exactly match color (RGB-only). axis 'x' scans rows
 * horizontally; 'y' scans columns vertically. Region clamps to the image.
 */
export function longestColorRun(
  img: RgbaImage,
  mask: Uint8Array | null,
  color: Rgb,
  region: Box,
  axis: 'x' | 'y',
): number {
  const w = img.width;
  const minX = Math.max(0, region.minX);
  const minY = Math.max(0, region.minY);
  const maxX = Math.min(w - 1, region.maxX);
  const maxY = Math.min(img.height - 1, region.maxY);
  const matches = (x: number, y: number): boolean => {
    if (mask !== null && mask[x + y * w] !== 1) return false;
    const i = (x + y * w) * 4;
    return img.data[i] === color[0] && img.data[i + 1] === color[1] && img.data[i + 2] === color[2];
  };
  let longest = 0;
  if (axis === 'x') {
    for (let y = minY; y <= maxY; y++) {
      let run = 0;
      for (let x = minX; x <= maxX; x++) {
        run = matches(x, y) ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
    }
  } else {
    for (let x = minX; x <= maxX; x++) {
      let run = 0;
      for (let y = minY; y <= maxY; y++) {
        run = matches(x, y) ? run + 1 : 0;
        longest = Math.max(longest, run);
      }
    }
  }
  return longest;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Max pairwise hypot over starts x ends; slope = |dy|/|dx| (Infinity when
 * dx = 0). Empty input yields the zero span {distance: 0, dx: 0, dy: 0, slope: 0}.
 */
export function polearmSpan(
  starts: Array<readonly [number, number]>,
  ends: Array<readonly [number, number]>,
): Span {
  let best: Span = { distance: 0, dx: 0, dy: 0, slope: 0 };
  for (const [sx, sy] of starts) {
    for (const [ex, ey] of ends) {
      const dx = Math.abs(ex - sx);
      const dy = Math.abs(ey - sy);
      const distance = Math.hypot(dx, dy);
      if (distance > best.distance) {
        best = { distance, dx, dy, slope: dx ? dy / dx : Number.POSITIVE_INFINITY };
      }
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Silhouette / diff (all require equal dims; NaN on empty union)
// ---------------------------------------------------------------------------

/** Full 4-channel byte equality at (x, y). False when either pixel is out of bounds. */
export function rgbaEqual(a: RgbaImage, b: RgbaImage, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= a.width || y >= a.height || x >= b.width || y >= b.height) return false;
  const ai = (x + y * a.width) * 4;
  const bi = (x + y * b.width) * 4;
  return (
    a.data[ai] === b.data[bi] &&
    a.data[ai + 1] === b.data[bi + 1] &&
    a.data[ai + 2] === b.data[bi + 2] &&
    a.data[ai + 3] === b.data[bi + 3]
  );
}

function sameDims(a: RgbaImage, b: RgbaImage): boolean {
  return a.width === b.width && a.height === b.height;
}

/** Count of pixels where the two images differ (full RGBA). NaN when dims differ. */
export function differingPixels(a: RgbaImage, b: RgbaImage): number {
  if (!sameDims(a, b)) return NaN;
  let count = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (!rgbaEqual(a, b, x, y)) count++;
    }
  }
  return count;
}

/** Count of pixels with alpha in either image. NaN when dims differ. */
export function unionAlpha(a: RgbaImage, b: RgbaImage): number {
  if (!sameDims(a, b)) return NaN;
  let count = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      if (alphaAt(a, x, y) || alphaAt(b, x, y)) count++;
    }
  }
  return count;
}

/** Intersection / union of the alpha masks. NaN when dims differ or union is 0. */
export function silhouetteIou(a: RgbaImage, b: RgbaImage): number {
  if (!sameDims(a, b)) return NaN;
  let intersection = 0;
  let union = 0;
  for (let y = 0; y < a.height; y++) {
    for (let x = 0; x < a.width; x++) {
      const aa = alphaAt(a, x, y);
      const bb = alphaAt(b, x, y);
      if (aa && bb) intersection++;
      if (aa || bb) union++;
    }
  }
  return union ? intersection / union : NaN;
}

/**
 * Mean absolute RGBA byte delta: Σ|a-b| / (w*h*4) — the VS-4 convention
 * (divides by d.length, NOT alphaCount; transparent background dilutes the
 * mean by design). NaN when dims differ.
 */
export function meanRgbaDelta(a: RgbaImage, b: RgbaImage): number {
  if (!sameDims(a, b)) return NaN;
  let total = 0;
  for (let i = 0; i < a.data.length; i++) total += Math.abs(a.data[i] - b.data[i]);
  return total / a.data.length;
}

/** differingPixels / unionAlpha * 100. NaN when dims differ or union is 0. */
export function poseDeltaPercent(a: RgbaImage, b: RgbaImage): number {
  const union = unionAlpha(a, b);
  if (Number.isNaN(union) || union === 0) return NaN;
  return (differingPixels(a, b) / union) * 100;
}

// ---------------------------------------------------------------------------
// Mirror verification (never mutates)
// ---------------------------------------------------------------------------

/** Horizontal flip into a NEW image; the source is never touched. */
export function flipX(img: RgbaImage): RgbaImage {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      const si = (x + y * img.width) * 4;
      const di = (img.width - 1 - x + y * img.width) * 4;
      out[di] = img.data[si];
      out[di + 1] = img.data[si + 1];
      out[di + 2] = img.data[si + 2];
      out[di + 3] = img.data[si + 3];
    }
  }
  return { width: img.width, height: img.height, data: out };
}

/** True when mirror.data deep-equals flipX(source).data (full RGBA). False when dims differ. */
export function isMirrorPair(source: RgbaImage, mirror: RgbaImage): boolean {
  if (!sameDims(source, mirror)) return false;
  const flipped = flipX(source).data;
  for (let i = 0; i < mirror.data.length; i++) {
    if (flipped[i] !== mirror.data[i]) return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Facing / pose variance
// ---------------------------------------------------------------------------

/** Adjacent-dir (i, i+1 mod n) meanRgbaDelta stats. {NaN,NaN,NaN} when no cells. */
export function facingVariance(cells: RgbaImage[]): { meanDelta: number; maxDelta: number; minDelta: number } {
  const deltas: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    const d = meanRgbaDelta(cells[i], cells[(i + 1) % cells.length]);
    if (!Number.isNaN(d)) deltas.push(d);
  }
  if (deltas.length === 0) return { meanDelta: NaN, maxDelta: NaN, minDelta: NaN };
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const d of deltas) {
    sum += d;
    max = Math.max(max, d);
    min = Math.min(min, d);
  }
  return { meanDelta: sum / deltas.length, maxDelta: max, minDelta: min };
}

/**
 * Union of per-facing alpha bounds plus the spread of per-facing box sizes.
 * widthSwim/heightSwim = max(width) - min(width) across facings (footing &
 * silhouette stability). All NaN when no cell has alpha.
 */
export function facingBoundsSwim(cells: RgbaImage[]): {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  widthSwim: number;
  heightSwim: number;
} {
  let unionMinX = Infinity;
  let unionMaxX = -Infinity;
  let unionMinY = Infinity;
  let unionMaxY = -Infinity;
  let minW = Infinity;
  let maxW = -Infinity;
  let minH = Infinity;
  let maxH = -Infinity;
  let seen = 0;
  for (const cell of cells) {
    const bounds = sourceBounds(cell);
    if (bounds === null) continue;
    seen++;
    unionMinX = Math.min(unionMinX, bounds.minX);
    unionMaxX = Math.max(unionMaxX, bounds.maxX);
    unionMinY = Math.min(unionMinY, bounds.minY);
    unionMaxY = Math.max(unionMaxY, bounds.maxY);
    const width = bounds.maxX - bounds.minX + 1;
    const height = bounds.maxY - bounds.minY + 1;
    minW = Math.min(minW, width);
    maxW = Math.max(maxW, width);
    minH = Math.min(minH, height);
    maxH = Math.max(maxH, height);
  }
  if (!seen) {
    return { minX: NaN, maxX: NaN, minY: NaN, maxY: NaN, widthSwim: NaN, heightSwim: NaN };
  }
  return {
    minX: unionMinX,
    maxX: unionMaxX,
    minY: unionMinY,
    maxY: unionMaxY,
    widthSwim: maxW - minW,
    heightSwim: maxH - minH,
  };
}

/**
 * Max pairwise centroid distance across facings (centroid = mean of alpha
 * pixel coords). NaN with no alpha-bearing cell; 0 with exactly one.
 */
export function facingCentroidSwim(cells: RgbaImage[]): number {
  const centroids: Array<[number, number]> = [];
  for (const cell of cells) {
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (let y = 0; y < cell.height; y++) {
      for (let x = 0; x < cell.width; x++) {
        if (alphaAt(cell, x, y)) {
          sx += x;
          sy += y;
          n++;
        }
      }
    }
    if (n === 0) continue;
    centroids.push([sx / n, sy / n]);
  }
  if (centroids.length < 2) return centroids.length === 0 ? NaN : 0;
  let best = 0;
  for (let i = 0; i < centroids.length; i++) {
    for (let j = i + 1; j < centroids.length; j++) {
      best = Math.max(best, Math.hypot(centroids[i][0] - centroids[j][0], centroids[i][1] - centroids[j][1]));
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Color share / emissive
// ---------------------------------------------------------------------------

/**
 * Share of pixels exactly matching color (full RGBA) / alphaCount.
 * Counted over all pixels (VS-4 magShare convention); NaN when no alpha pixels.
 */
export function colorShare(img: RgbaImage, color: Rgba, minAlpha = 1): number {
  const total = alphaCount(img, minAlpha);
  if (total === 0) return NaN;
  let match = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    if (
      img.data[i] === color[0] &&
      img.data[i + 1] === color[1] &&
      img.data[i + 2] === color[2] &&
      img.data[i + 3] === color[3]
    ) {
      match++;
    }
  }
  return match / total;
}

/** Share of exact MAG [255,0,255,255] pixels / alphaCount. */
export function magShare(img: RgbaImage): number {
  return colorShare(img, [255, 0, 255, 255]);
}

/**
 * Share of pixels whose RGB exactly matches ANY of the given colors (alpha
 * ignored in the match) / alphaCount. NaN when no alpha pixels.
 */
export function teamColorShare(img: RgbaImage, colors: readonly Rgb[], minAlpha = 1): number {
  const total = alphaCount(img, minAlpha);
  if (total === 0) return NaN;
  let match = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    for (const color of colors) {
      if (img.data[i] === color[0] && img.data[i + 1] === color[1] && img.data[i + 2] === color[2]) {
        match++;
        break;
      }
    }
  }
  return match / total;
}

// ---------------------------------------------------------------------------
// Rim / core (faction parameterized via RimColors)
// ---------------------------------------------------------------------------

/** True when the pixel's RGB exactly equals the outer or inner rim color (alpha ignored — VS-4 test convention). */
function isRimColor(img: RgbaImage, x: number, y: number, rim: RimColors): boolean {
  const i = (x + y * img.width) * 4;
  return (
    (img.data[i] === rim.outer[0] && img.data[i + 1] === rim.outer[1] && img.data[i + 2] === rim.outer[2]) ||
    (img.data[i] === rim.inner[0] && img.data[i + 1] === rim.inner[1] && img.data[i + 2] === rim.inner[2])
  );
}

/**
 * Marks transparent pixels connected to the border through transparent pixels
 * (4-neighbor BFS). Enclosed holes (e.g. shield interior negative space) stay
 * interior and are NOT marked. Returns a w*h byte mask (1 = exterior).
 */
export function exteriorTransparency(img: RgbaImage, minAlpha = 1): Uint8Array {
  const exterior = new Uint8Array(img.width * img.height);
  const queue: number[] = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (x !== 0 && y !== 0 && x !== img.width - 1 && y !== img.height - 1) continue;
      const index = x + y * img.width;
      if (exterior[index] || alphaAt(img, x, y, minAlpha)) continue;
      exterior[index] = 1;
      queue.push(index);
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % img.width;
    const y = Math.floor(index / img.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
      const next = nx + ny * img.width;
      if (!exterior[next] && !alphaAt(img, nx, ny, minAlpha)) {
        exterior[next] = 1;
        queue.push(next);
      }
    }
  }
  return exterior;
}

/**
 * For each alpha pixel, nearest exterior pixel within Chebyshev radius 1..depth
 * (ring scan per radius); layer-1 (outer) and layer-2 (inner) pixels are
 * counted, and share = pixels whose RGB exactly matches the layer color /
 * layer count. 0 when a layer has no pixels. Only the two nearest layers are
 * reported regardless of depth.
 */
export function rimLayerShares(
  img: RgbaImage,
  rim: RimColors,
  depth = 2,
  minAlpha = 1,
): { outer: number; inner: number } {
  const exterior = exteriorTransparency(img, minAlpha);
  const counts = [0, 0];
  const allowed = [0, 0];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!alphaAt(img, x, y, minAlpha)) continue;
      let layer = 0;
      for (let radius = 1; radius <= depth && layer === 0; radius++) {
        for (let dy = -radius; dy <= radius && layer === 0; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== radius) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < img.width && ny < img.height && exterior[nx + ny * img.width]) {
              layer = radius;
              break;
            }
          }
        }
      }
      if (layer < 1 || layer > Math.min(depth, 2)) continue;
      counts[layer - 1]++;
      if (isRimColor(img, x, y, rim)) allowed[layer - 1]++;
    }
  }
  return {
    outer: counts[0] ? allowed[0] / counts[0] : 0,
    inner: counts[1] ? allowed[1] / counts[1] : 0,
  };
}

/**
 * Core mask: body minus the exterior rim keyline. 4-neighbor flood from the
 * border through `!alpha || isRimColor` (rim pixels fully traversable —
 * the VS-4 oracle verbatim; thin rim-only structures such as the guard's
 * spear shaft are entirely exterior and excluded from the core). mask =
 * alpha && !(exteriorRim && isRimColor). Returns a w*h byte mask (1 = core);
 * enclosed rim/negative space is interior and stays in the core.
 *
 * `depth` is accepted for A2 signature compatibility but does NOT cap the
 * flood — the oracle algorithm is depth-unbounded, and any cap deviates on
 * thin rim structures. Layer-distance semantics live in rimLayerShares(depth).
 */
export function coreMask(img: RgbaImage, rim: RimColors, depth = 2, minAlpha = 1): Uint8Array {
  void depth; // reserved: A2 signature compatibility; flood is depth-unbounded (see above)
  const mask = new Uint8Array(img.width * img.height);
  const exteriorRim = new Uint8Array(img.width * img.height);
  const queue: number[] = [];
  const traversable = (x: number, y: number): boolean => {
    if (!alphaAt(img, x, y, minAlpha)) return true;
    return isRimColor(img, x, y, rim);
  };
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (x !== 0 && y !== 0 && x !== img.width - 1 && y !== img.height - 1) continue;
      const index = x + y * img.width;
      if (traversable(x, y) && !exteriorRim[index]) {
        exteriorRim[index] = 1;
        queue.push(index);
      }
    }
  }
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const index = queue[cursor];
    const x = index % img.width;
    const y = Math.floor(index / img.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= img.width || ny >= img.height) continue;
      const next = nx + ny * img.width;
      if (!exteriorRim[next] && traversable(nx, ny)) {
        exteriorRim[next] = 1;
        queue.push(next);
      }
    }
  }
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (!alphaAt(img, x, y, minAlpha)) continue;
      const index = x + y * img.width;
      if (!(exteriorRim[index] && isRimColor(img, x, y, rim))) mask[index] = 1;
    }
  }
  return mask;
}

/** First row with an alpha pixel that is NOT a rim color (any column); img.height when none. */
export function coreMinY(img: RgbaImage, rim: RimColors, minAlpha = 1): number {
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alphaAt(img, x, y, minAlpha) && !isRimColor(img, x, y, rim)) return y;
    }
  }
  return img.height;
}

/** Count of non-rim alpha pixels in rows minY..maxY (clamped to the image). */
export function coreAlphaInRows(
  img: RgbaImage,
  minY: number,
  maxY: number,
  rim: RimColors,
  minAlpha = 1,
): number {
  let count = 0;
  const y0 = Math.max(0, minY);
  const y1 = Math.min(img.height - 1, maxY);
  for (let y = y0; y <= y1; y++) {
    for (let x = 0; x < img.width; x++) {
      if (alphaAt(img, x, y, minAlpha) && !isRimColor(img, x, y, rim)) count++;
    }
  }
  return count;
}

/** First row with a non-rim alpha pixel inside columnBand [minX,maxX] (clamped); img.height when none. */
export function bodyTop(
  img: RgbaImage,
  rim: RimColors,
  columnBand: readonly [number, number],
  minAlpha = 1,
): number {
  const minX = Math.max(0, Math.min(columnBand[0], img.width - 1));
  const maxX = Math.max(0, Math.min(columnBand[1], img.width - 1));
  for (let y = 0; y < img.height; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (alphaAt(img, x, y, minAlpha) && !isRimColor(img, x, y, rim)) return y;
    }
  }
  return img.height;
}
