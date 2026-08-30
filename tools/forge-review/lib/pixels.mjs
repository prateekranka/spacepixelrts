// Forge Review Deck — PNG analysis: luminance, nonblank checks, palette
// adherence vs src/palette.ts. Same math as scripts/self-view-harness.mjs
// analyzeCell so parity with the legacy board is preserved:
//   - stride-sample every 7th pixel row and column
//   - 5-bit color quantization map for distinct colors + adherence
//   - adherence = share of sampled pixels within RGB distance^2 <= 1600 of
//     the nearest palette token
//   - luma = 0.2126R + 0.7152G + 0.0722B
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

/** Parse src/palette.ts hex tokens -> [{ name, hex }] (repo-source sync). */
export function loadPalette(repoRoot) {
  const src = fs.readFileSync(path.join(repoRoot, 'src', 'palette.ts'), 'utf8');
  const tokens = [];
  const re = /(\w+):\s*'(#[0-9A-Fa-f]{6})'/g;
  let m;
  while ((m = re.exec(src)) !== null) tokens.push({ name: m[1], hex: m[2] });
  if (tokens.length === 0) throw new Error('could not parse palette from src/palette.ts');
  return tokens;
}

function hexToRgb(hex) {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

/** Parse src/palette.ts hex tokens -> [[r,g,b], ...]. */
export function loadPaletteRgb(repoRoot) {
  return loadPalette(repoRoot).map((token) => hexToRgb(token.hex));
}

/**
 * Analyze a PNG (Buffer or file path). Returns:
 * { width, height, minLuma, maxLuma, meanLuma, litRatio, distinctColors, paletteAdherence }
 */
export function analyzePng(fileOrBuffer, paletteRgb = []) {
  const buf = Buffer.isBuffer(fileOrBuffer) ? fileOrBuffer : fs.readFileSync(fileOrBuffer);
  const png = PNG.sync.read(buf);
  let min = 255;
  let max = 0;
  let sum = 0;
  let count = 0;
  let lit = 0;
  const colorCounts = new Map();
  for (let y = 0; y < png.height; y += 7) {
    for (let x = 0; x < png.width; x += 7) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (lum < min) min = lum;
      if (lum > max) max = lum;
      sum += lum;
      count += 1;
      if (lum > 10) lit += 1;
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      colorCounts.set(key, (colorCounts.get(key) ?? 0) + 1);
    }
  }
  let adherent = 0;
  for (const [key, n] of colorCounts) {
    const r = ((key >> 10) & 31) << 3;
    const g = ((key >> 5) & 31) << 3;
    const b = (key & 31) << 3;
    let best = Infinity;
    for (const [pr, pg, pb] of paletteRgb) {
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < best) best = d;
    }
    if (best <= 1600) adherent += n; // within 40 RGB units of some palette token
  }
  return {
    width: png.width,
    height: png.height,
    minLuma: Math.round(min * 100) / 100,
    maxLuma: Math.round(max * 100) / 100,
    meanLuma: Math.round((sum / Math.max(1, count)) * 100) / 100,
    litRatio: Math.round((lit / Math.max(1, count)) * 10000) / 10000,
    distinctColors: colorCounts.size,
    paletteAdherence: Math.round((adherent / Math.max(1, count)) * 10000) / 10000,
  };
}

/** Count sampled pixels within RGB tolerance of a target overlay color. */
export function countOverlayColorPixels(fileOrBuffer, hexColor, tolerance = 48) {
  const buf = Buffer.isBuffer(fileOrBuffer) ? fileOrBuffer : fs.readFileSync(fileOrBuffer);
  const png = PNG.sync.read(buf);
  const target = hexToRgb(hexColor);
  const tol2 = tolerance * tolerance;
  let hits = 0;
  for (let y = 0; y < png.height; y += 3) {
    for (let x = 0; x < png.width; x += 3) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const d = (r - target[0]) ** 2 + (g - target[1]) ** 2 + (b - target[2]) ** 2;
      if (d <= tol2) hits += 1;
    }
  }
  return hits;
}

/** True when the capture is effectively all-black (no scene content). */
export function isBlack(image) {
  return image.maxLuma <= 6;
}

/** True when the capture has essentially no lit pixels. */
export function isEmpty(image) {
  return image.litRatio < 0.002;
}
