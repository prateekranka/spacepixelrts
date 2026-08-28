/**
 * Forge Art Lab v1 — 2D canvas painting helpers (FAL-VIEWS).
 *
 * All paint functions are pure Canvas2D drawn from Pix / RgbaImage bytes:
 * enlarged cells, passes, diff overlays and grid sheets. Nearest-neighbor
 * scaling throughout (putImageData on an offscreen, then drawImage scaled with
 * imageSmoothingEnabled=false). No WebGL here — the workbench page holds zero
 * live GL contexts; the rig page hosts the one GameRenderer (A5 §7.1).
 *
 * Passes are 2D pixel transforms applied to BOTH sides identically
 * (FORGE_ART_LAB §6) and never mutate source pixels.
 */
import type { BackgroundId, PassId } from './store';

/** Structural Pix / RgbaImage input. */
export interface PixelImage {
  w: number;
  h: number;
  d: Uint8Array | Uint8ClampedArray;
}

export type PassName = PassId | 'none';

export const CHECKER_A = '#171326';
export const CHECKER_B = '#211B31';
export const INK_BG = '#0B0A12';
export const SLATE_BG = '#2A203B';
const GRID_LINE = 'rgba(42, 32, 59, 0.9)';

export function toClamped(pix: PixelImage): Uint8ClampedArray {
  return pix.d instanceof Uint8ClampedArray ? pix.d : Uint8ClampedArray.from(pix.d);
}

export function toImageData(pix: PixelImage): ImageData {
  const data = new Uint8ClampedArray(pix.w * pix.h * 4);
  data.set(pix.d.subarray(0, pix.w * pix.h * 4));
  return new ImageData(data, pix.w, pix.h);
}

/** Stage backdrop: checker (alpha inspection), ink, or slate. */
export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BackgroundId,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  if (bg === 'ink') {
    ctx.fillStyle = INK_BG;
    ctx.fillRect(x, y, w, h);
    return;
  }
  if (bg === 'slate') {
    ctx.fillStyle = SLATE_BG;
    ctx.fillRect(x, y, w, h);
    return;
  }
  const size = 8;
  ctx.fillStyle = CHECKER_A;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = CHECKER_B;
  const x0 = Math.floor(x / size) * size;
  const y0 = Math.floor(y / size) * size;
  for (let cy = y0; cy < y + h; cy += size) {
    for (let cx = x0; cx < x + w; cx += size) {
      if (((cx / size + cy / size) & 1) === 0) continue;
      ctx.fillRect(cx, cy, size, size);
    }
  }
}

function makeOffscreen(w: number, h: number): CanvasRenderingContext2D | null {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas.getContext('2d');
}

/**
 * Draw one Pix cell into a 2D context at x,y scaled by `scale` (or an explicit
 * drawW/drawH for non-uniform roster projections), nearest-neighbor.
 */
export function drawCellTo(
  ctx: CanvasRenderingContext2D,
  pix: PixelImage,
  x: number,
  y: number,
  scale: number,
  opts: { background?: BackgroundId; drawW?: number; drawH?: number } = {},
): void {
  const w = Math.max(1, Math.round(opts.drawW ?? pix.w * scale));
  const h = Math.max(1, Math.round(opts.drawH ?? pix.h * scale));
  drawBackground(ctx, opts.background ?? 'checker', x, y, w, h);
  const off = makeOffscreen(pix.w, pix.h);
  if (!off) return;
  off.putImageData(toImageData(pix), 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off.canvas, x, y, w, h);
  ctx.restore();
}

/**
 * Pixel pass transforms. Every pass returns a NEW {w,h,data} image; the source
 * is never mutated. Compose order = PASS_IDS (UI order); workbench applies the
 * enabled passes in that fixed order.
 */
export function applyPass(pix: PixelImage, pass: PassName): PixelImage {
  const src = pix.d;
  const out = new Uint8ClampedArray(src.length);
  const n = pix.w * pix.h;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    const r = src[o];
    const g = src[o + 1];
    const b = src[o + 2];
    const a = src[o + 3];
    switch (pass) {
      case 'none':
        out[o] = r;
        out[o + 1] = g;
        out[o + 2] = b;
        out[o + 3] = a;
        break;
      case 'silhouette':
        // alpha>0 -> opaque white, else transparent (shape only)
        if (a > 0) {
          out[o] = 255;
          out[o + 1] = 255;
          out[o + 2] = 255;
          out[o + 3] = 255;
        }
        break;
      case 'value': {
        // grayscale rec709 luminance ramp, alpha preserved
        const l = Math.round(0.2126 * r + 0.7152 * g + 0.0722 * b);
        out[o] = l;
        out[o + 1] = l;
        out[o + 2] = l;
        out[o + 3] = a;
        break;
      }
      case 'alpha':
        // white with alpha as opacity
        out[o] = 255;
        out[o + 1] = 255;
        out[o + 2] = 255;
        out[o + 3] = a;
        break;
      case 'team': {
        // MAG [255,0,255] highlighted magenta; everything else dimmed to 25%
        const mag = r === 255 && g === 0 && b === 255;
        if (mag) {
          out[o] = 255;
          out[o + 1] = 0;
          out[o + 2] = 255;
          out[o + 3] = a;
        } else {
          out[o] = Math.round(r * 0.25);
          out[o + 1] = Math.round(g * 0.25);
          out[o + 2] = Math.round(b * 0.25);
          out[o + 3] = a;
        }
        break;
      }
      case 'emissive': {
        // MAG only; everything else opaque black (alpha shape preserved)
        const mag = r === 255 && g === 0 && b === 255;
        if (mag) {
          out[o] = 255;
          out[o + 1] = 0;
          out[o + 2] = 255;
          out[o + 3] = a;
        } else {
          out[o] = 0;
          out[o + 1] = 0;
          out[o + 2] = 0;
          out[o + 3] = a;
        }
        break;
      }
    }
  }
  return { w: pix.w, h: pix.h, d: out };
}

/**
 * Difference overlay: red where the two images differ (full RGBA byte
 * equality), with a 1px outline around the differing-pixel bbox. Returns the
 * differing-pixel count (NaN when dims differ; nothing drawn besides the
 * backdrop). Never mutates inputs.
 */
export function diffImages(
  ctx: CanvasRenderingContext2D,
  a: PixelImage,
  b: PixelImage,
  x: number,
  y: number,
  scale: number,
  opts: { background?: BackgroundId } = {},
): number {
  const w = Math.max(1, Math.round(a.w * scale));
  const h = Math.max(1, Math.round(a.h * scale));
  drawBackground(ctx, opts.background ?? 'checker', x, y, w, h);
  if (a.w !== b.w || a.h !== b.h) return NaN;
  const off = makeOffscreen(a.w, a.h);
  if (!off) return NaN;
  const img = off.createImageData(a.w, a.h);
  let count = 0;
  let minX = a.w;
  let minY = a.h;
  let maxX = -1;
  let maxY = -1;
  for (let py = 0; py < a.h; py++) {
    for (let px = 0; px < a.w; px++) {
      const i = (px + py * a.w) * 4;
      const same =
        a.d[i] === b.d[i] &&
        a.d[i + 1] === b.d[i + 1] &&
        a.d[i + 2] === b.d[i + 2] &&
        a.d[i + 3] === b.d[i + 3];
      if (same) continue;
      img.data[i] = 255;
      img.data[i + 3] = 255;
      count++;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }
  off.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(off.canvas, x, y, w, h);
  if (count > 0) {
    ctx.strokeStyle = '#FF5A5A';
    ctx.lineWidth = Math.max(1, scale * 0.75);
    ctx.strokeRect(
      x + minX * scale,
      y + minY * scale,
      (maxX - minX + 1) * scale,
      (maxY - minY + 1) * scale,
    );
  }
  ctx.restore();
  return count;
}

/**
 * Compose a grid sheet canvas from frame cells (dir-major layout, matching
 * baseline grids): `cols` columns, ceil(n/cols) rows. Each cell drawn at
 * cellScale with the given pass and backdrop; faint grid lines between cells.
 */
export function composeSheet(
  frames: readonly PixelImage[],
  cols: number,
  cellScale = 1,
  pass: PassName = 'none',
  opts: { background?: BackgroundId; grid?: boolean } = {},
): HTMLCanvasElement {
  const first = frames[0];
  const cw = first ? first.w : 1;
  const ch = first ? first.h : 1;
  const rows = Math.max(1, Math.ceil(frames.length / cols));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, cols * cw * cellScale);
  canvas.height = Math.max(1, rows * ch * cellScale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  frames.forEach((frame, i) => {
    const cx = (i % cols) * cw * cellScale;
    const cy = Math.floor(i / cols) * ch * cellScale;
    drawCellTo(ctx, applyPass(frame, pass), cx, cy, cellScale, {
      background: opts.background ?? 'checker',
    });
  });
  if (opts.grid !== false) {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < cols; c++) {
      ctx.moveTo(c * cw * cellScale + 0.5, 0);
      ctx.lineTo(c * cw * cellScale + 0.5, canvas.height);
    }
    for (let r = 1; r < rows; r++) {
      ctx.moveTo(0, r * ch * cellScale + 0.5);
      ctx.lineTo(canvas.width, r * ch * cellScale + 0.5);
    }
    ctx.stroke();
  }
  return canvas;
}

/**
 * Pure (DOM-free) blit of frame cells into one RGBA sheet buffer, dir-major,
 * matching baseline grid geometry — used for candidate sheet hashing.
 */
export function sheetBytes(
  frames: readonly PixelImage[],
  cols: number,
): { w: number; h: number; data: Uint8ClampedArray } {
  const first = frames[0];
  if (!first) return { w: 0, h: 0, data: new Uint8ClampedArray(0) };
  const rows = Math.max(1, Math.ceil(frames.length / cols));
  const sheetW = cols * first.w;
  const sheetH = rows * first.h;
  const out = new Uint8ClampedArray(sheetW * sheetH * 4);
  frames.forEach((frame, i) => {
    const cx = (i % cols) * first.w;
    const cy = Math.floor(i / cols) * first.h;
    const rowBytes = frame.w * 4;
    for (let py = 0; py < frame.h; py++) {
      const srcOff = py * rowBytes;
      const dstOff = ((cy + py) * sheetW + cx) * 4;
      out.set(frame.d.subarray(srcOff, srcOff + rowBytes), dstOff);
    }
  });
  return { w: sheetW, h: sheetH, data: out };
}
