/** P11 / P82 — tiny prop atlas (gems + wrecks). Units/buildings are GPU SDFs. */

import { STARHOLD_PALETTE as P } from './palette';

export const CELL = 32;
export const SHEET = 128;
export const COLS = SHEET / CELL;

export const MAG = [255, 0, 255, 255] as const;

function rgba(hex: string): [number, number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff), ((n >> 8) & 0xff), (n & 0xff), 255];
}

export type Uv = { u0: number; v0: number; u1: number; v1: number; w: number; h: number };

export interface Atlas {
  canvas: HTMLCanvasElement;
  uv: Record<string, Uv>;
}

const PAL = {
  ink: rgba(P.ink),
  rock: rgba(P.slate),
  rockH: rgba(P.steel),
  ore: rgba(P.copper),
  oreH: rgba(P.ochre),
  gas: rgba(P.sky),
  gasH: rgba(P.ice),
  sol: rgba(P.ochre),
  solH: rgba(P.amber),
  white: rgba(P.cream),
} as const;

type Rgba = readonly [number, number, number, number] | [number, number, number, number];

class Pix {
  constructor(
    readonly w: number,
    readonly h: number,
    readonly d: Uint8ClampedArray,
  ) {}
  static alloc(w: number, h: number): Pix {
    return new Pix(w, h, new Uint8ClampedArray(w * h * 4));
  }
  set(x: number, y: number, c: Rgba): void {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (x + y * this.w) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = c[3];
  }
  fill(x: number, y: number, w: number, h: number, c: Rgba): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, c);
  }
  circ(cx: number, cy: number, r: number, c: Rgba): void {
    const r2 = r * r;
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r2) this.set(cx + x, cy + y, c);
  }
  diam(cx: number, cy: number, r: number, c: Rgba): void {
    for (let y = -r; y <= r; y++)
      for (let x = -r; x <= r; x++) if (Math.abs(x) + Math.abs(y) <= r) this.set(cx + x, cy + y, c);
  }
  line(x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    let x = x0;
    let y = y0;
    for (let n = 0; n < 96; n++) {
      this.set(x, y, c);
      if (x === x1 && y === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
  }
  outline(c: Rgba = PAL.ink): void {
    const copy = this.d.slice();
    const w = this.w;
    const h = this.h;
    const opa = (x: number, y: number) => copy[(x + y * w) * 4 + 3] > 20;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (opa(x, y)) continue;
        if (
          (x > 0 && opa(x - 1, y)) ||
          (x + 1 < w && opa(x + 1, y)) ||
          (y > 0 && opa(x, y - 1)) ||
          (y + 1 < h && opa(x, y + 1)) ||
          (x > 0 && y > 0 && opa(x - 1, y - 1)) ||
          (x + 1 < w && y > 0 && opa(x + 1, y - 1)) ||
          (x > 0 && y + 1 < h && opa(x, y + 1)) ||
          (x + 1 < w && y + 1 < h && opa(x + 1, y + 1))
        )
          this.set(x, y, c);
      }
    }
  }
  finish(): void {
    this.outline();
    this.outline();
  }
}

function blit(ctx: CanvasRenderingContext2D, pix: Pix, x: number, y: number): void {
  const img = ctx.createImageData(pix.w, pix.h);
  img.data.set(pix.d);
  ctx.putImageData(img, x, y);
}

function drawGem(kind: 'ore' | 'gas' | 'sol'): Pix {
  const p = Pix.alloc(24, 24);
  if (kind === 'ore') {
    p.diam(12, 13, 9, PAL.ore);
    p.diam(12, 12, 6, PAL.oreH);
    p.set(8, 9, PAL.white);
    p.set(14, 10, PAL.oreH);
    p.set(12, 16, PAL.oreH);
    p.set(10, 12, PAL.white);
  } else if (kind === 'gas') {
    p.diam(12, 12, 10, PAL.gas);
    p.circ(9, 9, 4, PAL.gasH);
    p.circ(14, 11, 3, PAL.gasH);
    p.set(12, 7, PAL.white);
    p.set(10, 10, PAL.white);
  } else {
    p.circ(12, 12, 9, PAL.sol);
    p.circ(12, 12, 4, PAL.solH);
    p.set(12, 6, PAL.white);
    p.set(9, 10, PAL.solH);
    p.set(14, 10, PAL.white);
  }
  p.finish();
  return p;
}

function drawPropWreck(): Pix {
  const p = Pix.alloc(22, 20);
  const pts: [number, number][] = [
    [6, 17],
    [4, 12],
    [7, 7],
    [11, 4],
    [16, 5],
    [19, 10],
    [18, 16],
    [13, 18],
    [8, 17],
  ];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    p.line(x0, y0, x1, y1, PAL.ink);
  }
  // Fill the irregular hull so the salvage reads as a wreck, not a black
  // zig-zag mark when it is enlarged in the isometric view.
  p.fill(5, 11, 13, 6, PAL.rock);
  p.fill(7, 8, 10, 5, PAL.rock);
  for (let y = 5; y <= 17; y++) {
    for (let x = 5; x <= 18; x++) {
      if (x + y > 22 && x * 1.05 + y * 0.9 < 28) p.set(x, y, PAL.rock);
    }
  }
  for (let y = 6; y <= 13; y++) {
    for (let x = 8; x <= 15; x++) {
      if (x + y < 20) p.set(x, y, PAL.rockH);
    }
  }
  p.line(9, 7, 15, 6, PAL.rockH);
  p.set(10, 7, PAL.rockH);
  p.line(8, 15, 16, 13, PAL.ore);
  p.set(13, 11, PAL.oreH);
  for (let x = 6; x <= 17; x++) p.set(x, 18, PAL.rock);
  p.outline(PAL.ink);
  return p;
}

function drawPropVent(): Pix {
  const p = Pix.alloc(18, 20);
  p.fill(6, 14, 6, 5, PAL.rock);
  p.circ(9, 15, 4, PAL.rockH);
  p.circ(9, 11, 3, PAL.gas);
  p.circ(9, 8, 2, PAL.gasH);
  p.set(9, 5, PAL.solH);
  p.set(8, 4, PAL.sol);
  p.set(10, 6, PAL.gasH);
  p.line(9, 3, 9, 1, PAL.gasH);
  p.set(8, 2, PAL.solH);
  p.finish();
  return p;
}

export function buildAtlas(): Atlas {
  const canvas = document.createElement('canvas');
  canvas.width = SHEET;
  canvas.height = SHEET;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, SHEET, SHEET);
  const uv: Record<string, Uv> = {};

  const putGem = (key: string, pix: Pix, col: number, row: number) => {
    const ox = (CELL - pix.w) >> 1;
    const oy = (CELL - pix.h) >> 1;
    const x = col * CELL + ox;
    const y = row * CELL + oy;
    blit(ctx, pix, x, y);
    uv[key] = {
      u0: x / SHEET,
      v0: 1 - (y + pix.h) / SHEET,
      u1: (x + pix.w) / SHEET,
      v1: 1 - y / SHEET,
      w: pix.w,
      h: pix.h,
    };
  };

  putGem('gem-ore', drawGem('ore'), 0, 0);
  putGem('gem-gas', drawGem('gas'), 1, 0);
  putGem('gem-sol', drawGem('sol'), 2, 0);
  putGem('prop-wreck', drawPropWreck(), 3, 0);
  putGem('prop-vent', drawPropVent(), 4, 0);

  return { canvas, uv };
}

export function roleOfKind(kind: number): string {
  switch (kind) {
    case 0:
      return 'worker';
    case 1:
      return 'scout';
    case 2:
      return 'fighter';
    case 3:
      return 'siege';
    case 4:
      return 'ravager';
    case 5:
      return 'prism';
    case 6:
      return 'shade';
    default:
      return 'worker';
  }
}
