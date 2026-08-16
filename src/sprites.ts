/**
 * P90-v3 — startup-rasterized sprites (silhouette-first, top-left lit, connected anatomy).
 * Gold standard technique from art-reference.ts, full roster × civs × animation frames.
 */

import { Kind, type Civ } from './engine';

export type Rgba = readonly [number, number, number, number];
export const MAG: Rgba = [255, 0, 255, 255];

const INK: Rgba = [18, 14, 30, 255];
const SKIN: Rgba = [232, 220, 196, 255];
const SKIN_D: Rgba = [168, 148, 132, 255];
const BONE: Rgba = [232, 220, 196, 255];
const GUN: Rgba = [90, 96, 110, 255];
const GUN_H: Rgba = [150, 156, 170, 255];
const ORE: Rgba = [198, 154, 72, 255];
const ORE_H: Rgba = [240, 214, 120, 255];
const SOL: Rgba = [240, 196, 72, 255];
const SOL_H: Rgba = [255, 236, 170, 255];
const WHITE: Rgba = [244, 238, 226, 255];
const ROCK: Rgba = [92, 82, 108, 255];
const ROCK_H: Rgba = [148, 136, 158, 255];
const BLOOD: Rgba = [176, 42, 48, 255];

const HIVE: Rgba = [46, 122, 58, 255];
const HIVE_H: Rgba = [168, 230, 96, 255];
const HIVE_D: Rgba = [22, 58, 32, 255];
const CRY: Rgba = [78, 186, 214, 255];
const CRY_H: Rgba = [210, 244, 255, 255];
const CRY_D: Rgba = [28, 72, 96, 255];
const VOID: Rgba = [72, 42, 140, 255];
const VOID_H: Rgba = [186, 140, 255, 255];
const VOID_D: Rgba = [28, 14, 48, 255];

const WALL: Rgba = [58, 48, 62, 255];
const WALL_H: Rgba = [96, 84, 100, 255];
const WALL_D: Rgba = [40, 32, 44, 255];
const WIN: Rgba = [200, 220, 255, 255];

export class Pix {
  constructor(readonly w: number, readonly h: number, readonly d: Uint8ClampedArray) {}
  static alloc(w: number, h: number): Pix {
    return new Pix(w, h, new Uint8ClampedArray(w * h * 4));
  }
  set(x: number, y: number, c: Rgba): void {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (x + y * this.w) * 4;
    this.d[i] = c[0];
    this.d[i + 1] = c[1];
    this.d[i + 2] = c[2];
    this.d[i + 3] = c[3];
  }
  fillRect(x: number, y: number, w: number, h: number, c: Rgba): void {
    for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) this.set(x + xx, y + yy, c);
  }
  circ(cx: number, cy: number, r: number, c: Rgba): void {
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r2) this.set(cx + dx, cy + dy, c);
  }
}

type CivPal = { md: Rgba; hi: Rgba; dk: Rgba };

function civPal(civ: number): CivPal {
  if (civ < 0.5) return { md: HIVE, hi: HIVE_H, dk: HIVE_D };
  if (civ < 1.5) return { md: CRY, hi: CRY_H, dk: CRY_D };
  return { md: VOID, hi: VOID_H, dk: VOID_D };
}

function civIndex(civ: Civ): number {
  if (civ === 'vespari') return 0;
  if (civ === 'aurion') return 1;
  return 2;
}

function shadeRect(
  p: Pix,
  x: number,
  y: number,
  w: number,
  h: number,
  base: Rgba,
  lit: Rgba,
  dk: Rgba,
): void {
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const px = x + xx;
      const py = y + yy;
      const c =
        px < x + w * 0.4 && py < y + h * 0.4
          ? lit
          : px > x + w * 0.55 || py > y + h * 0.55
            ? dk
            : base;
      p.set(px, py, c);
    }
  }
}

function shadeDome(p: Pix, cx: number, yTop: number, yBot: number, pal: CivPal): void {
  for (let y = yTop; y <= yBot; y++) {
    const half = Math.round(4 + ((y - yTop) / Math.max(1, yBot - yTop)) * (yBot - yTop + 8));
    for (let x = cx - half; x <= cx + half; x++) {
      const c = x < cx - half / 2 ? pal.hi : x > cx + half / 2 ? pal.dk : pal.md;
      p.set(x, y, c);
    }
  }
}

// ── Fighter (reference technique) ───────────────────────────────────────────
function drawFighterPix(civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const cx = 15;
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  dark(cx - 4, 18, 6, 12);
  dark(cx + 1, 18, 6, 12);
  dark(cx - 7, 8, 15, 12);
  dark(cx - 4, 2, 9, 7);
  dark(cx - 4, 9, 5, 4);
  dark(cx + 2, 6, 6, 4);
  dark(cx + 8, 7, 10, 2);
  dark(cx + 17, 6, 4, 4);
  dark(cx + 3, 9, 3, 3);
  dark(cx + 5, 10, 4, 4);
  dark(cx - 6, 8, 4, 5);

  for (let y = 18; y < 30; y++) {
    const lit = y < 23;
    p.set(cx - 3, y, lit ? md : dk);
    p.set(cx - 4, y, dk);
    p.set(cx + 2, y, lit ? hi : md);
    p.set(cx + 3, y, dk);
  }
  p.fillRect(cx - 5, 29, 5, 2, dk);
  p.fillRect(cx + 1, 29, 5, 2, dk);

  shadeRect(p, cx - 6, 8, 13, 11, md, hi, dk);
  for (let y = 2; y < 9; y++) {
    p.set(cx - 2, y, y < 5 ? hi : md);
    p.set(cx - 1, y, y < 5 ? hi : md);
    p.set(cx, y, y < 5 ? hi : md);
    p.set(cx + 1, y, md);
    p.set(cx + 2, y, y < 5 ? md : dk);
  }
  p.set(cx + 2, 5, BONE);
  p.set(cx + 1, 5, BONE);

  for (let y = 6; y <= 9; y++) {
    for (let x = cx + 2; x <= cx + 7; x++) p.set(x, y, y < 8 && x < cx + 5 ? GUN_H : GUN);
  }
  for (let x = cx + 8; x <= cx + 17; x++) {
    p.set(x, 7, x > cx + 14 ? GUN_H : GUN);
    p.set(x, 8, GUN);
  }
  for (let y = 6; y <= 9; y++) {
    for (let x = cx + 17; x <= cx + 20; x++) p.set(x, y, GUN_H);
  }
  p.set(cx + 20, 7, WHITE);
  for (let y = 9; y <= 12; y++) {
    for (let x = cx - 4; x <= cx; x++) p.set(x, y, y > 10 ? GUN : GUN_H);
  }
  for (let y = 9; y <= 12; y++) p.set(cx + 5, y, md);
  for (let y = 10; y <= 12; y++) p.set(cx + 6, y, md);
  p.set(cx + 7, 10, SKIN);
  p.set(cx + 7, 11, SKIN);
  p.set(cx + 8, 10, SKIN);
  for (let x = cx - 5; x < cx - 2; x++) p.set(x, 9, dk);
  p.set(cx - 6, 9, SKIN_D);

  if (civ < 0.5) p.circ(cx - 2, 11, 2, hi);
  else if (civ < 1.5) {
    p.set(cx - 5, 10, hi);
    p.set(cx - 4, 9, hi);
    p.set(cx - 3, 10, hi);
  } else {
    p.set(cx - 5, 11, VOID_D);
    p.set(cx - 4, 12, VOID_D);
  }

  if (frame >= 3) {
    p.circ(26, 8, 3, WHITE);
    p.circ(27, 8, 2, SOL_H);
  }
  return p;
}

// ── Worker ──────────────────────────────────────────────────────────────────
function drawWorkerPix(civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const cx = 12;
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);
  const drill = civ >= 1.5 && frame >= 1;

  dark(cx - 3, 18, 6, 11);
  dark(cx + 2, 18, 5, 10);
  dark(cx - 7, 8, 14, 12);
  dark(cx - 3, 4, 8, 6);

  if (drill) {
    dark(cx + 4, 10, 14, 3);
    dark(cx + 17, 9, 4, 5);
    shadeRect(p, cx + 4, 10, 14, 3, ROCK, ROCK_H, ROCK);
    p.fillRect(cx + 17, 9, 4, 5, ROCK_H);
    p.set(cx + 20, 10, WHITE);
  } else {
    dark(cx + 6, 11, 13, 13);
    for (let y = 11; y < 24; y++) {
      for (let x = cx + 6; x < cx + 19; x++) {
        p.set(x, y, x < cx + 10 && y < 15 ? ORE_H : ORE);
      }
    }
    p.set(cx + 8, 12, WHITE);
    p.fillRect(cx + 1, 11, 6, 2, md);
    p.fillRect(cx + 1, 20, 6, 2, dk);
    p.set(cx + 7, 12, SKIN);
    p.set(cx + 7, 21, SKIN_D);
  }

  shadeRect(p, cx - 6, 8, 12, 12, md, hi, dk);
  for (let y = 4; y < 10; y++) {
    const c = y < 6 ? hi : md;
    p.set(cx - 2, y, c);
    p.set(cx - 1, y, c);
    p.set(cx, y, c);
  }
  p.set(cx, 3, ORE_H);
  p.set(cx, 2, WHITE);

  for (let y = 20; y < 29; y++) {
    p.set(cx - 2, y, md);
    p.set(cx - 1, y, y < 23 ? md : dk);
    p.set(cx + 3, y, dk);
  }
  p.fillRect(cx - 3, 28, 3, 2, dk);
  p.fillRect(cx + 2, 28, 3, 2, dk);

  if (civ < 0.5) p.circ(cx - 4, 10, 3, hi);
  else if (civ < 1.5) {
    p.set(cx - 6, 9, hi);
    p.set(cx - 5, 8, hi);
  }
  return p;
}

// ── Scout ───────────────────────────────────────────────────────────────────
function drawScoutPix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  dark(4, 20, 20, 8);
  dark(6, 18, 16, 4);
  dark(2, 8, 6, 6);
  dark(1, 4, 14, 12);
  dark(22, 20, 6, 5);

  shadeRect(p, 6, 18, 16, 10, dk, md, dk);
  shadeRect(p, 1, 4, 14, 12, WHITE, WHITE, ROCK);
  p.circ(6, 9, 5, hi);
  p.circ(6, 9, 3, md);
  p.set(3, 7, WHITE);

  shadeRect(p, 22, 20, 6, 5, SOL, SOL_H, ORE);
  p.set(24, 21, SOL_H);

  if (civ < 0.5) {
    p.fillRect(8, 19, 10, 2, hi);
  } else if (civ < 1.5) {
    p.set(10, 18, hi);
    p.set(12, 19, hi);
    p.set(14, 18, CRY_H);
  } else {
    p.fillRect(20, 19, 4, 3, VOID_D);
  }
  return p;
}

// ── Siege ───────────────────────────────────────────────────────────────────
function drawSiegePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  dark(2, 22, 28, 8);
  dark(4, 12, 24, 12);
  dark(8, 6, 16, 8);
  dark(20, 2, 10, 6);

  shadeRect(p, 2, 22, 28, 8, ROCK, ROCK_H, ROCK);
  p.circ(8, 26, 3, ROCK);
  p.circ(24, 26, 3, ROCK);
  shadeRect(p, 4, 12, 24, 12, md, hi, dk);
  shadeRect(p, 8, 6, 16, 8, dk, md, dk);
  shadeRect(p, 20, 2, 10, 6, ROCK, ROCK_H, ROCK);
  p.fillRect(28, 3, 3, 4, ROCK_H);
  p.set(29, 4, WHITE);

  if (civ < 0.5) p.circ(16, 16, 3, hi);
  else if (civ < 1.5) {
    p.set(14, 14, hi);
    p.set(16, 13, CRY_H);
    p.set(18, 14, hi);
  } else p.fillRect(14, 14, 4, 4, VOID_H);

  p.fillRect(10, 10, 4, 4, MAG);
  return p;
}

// ── Ravager ─────────────────────────────────────────────────────────────────
function drawRavagerPix(civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const lunge = frame % 2 === 1 ? 2 : 0;
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  dark(8, 14, 16, 12);
  dark(10, 6, 12, 10);
  dark(4 - lunge, 2, 4, 10);
  dark(24 + lunge, 2, 4, 10);
  dark(10, 20, 5, 10);
  dark(18, 20, 5, 10);

  shadeRect(p, 8, 14, 16, 12, HIVE_D, HIVE, HIVE_D);
  shadeRect(p, 10, 6, 12, 10, HIVE_D, HIVE, HIVE_D);
  p.set(14, 8, BLOOD);
  p.set(15, 8, BLOOD);
  p.set(16, 7, WHITE);

  p.fillRect(4 - lunge, 2, 3, 8, BONE);
  p.fillRect(24 + lunge, 2, 3, 8, BONE);
  p.set(2 - lunge, 1, SOL_H);
  p.set(28 + lunge, 1, SOL_H);

  for (let y = 20; y < 30; y++) {
    p.set(11, y, HIVE_D);
    p.set(12, y, y < 24 ? HIVE : HIVE_D);
    p.set(19, y, HIVE_D);
    p.set(20, y, y < 24 ? HIVE : HIVE_D);
  }

  if (civ >= 1.5) {
    p.set(12, 10, VOID_H);
    p.set(18, 10, VOID_H);
  }
  return p;
}

// ── Prism ───────────────────────────────────────────────────────────────────
function drawPrismPix(_civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const hover = frame % 2 === 1 ? -1 : 0;
  const y0 = 8 + hover;
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  dark(10, y0 + 6, 12, 10);
  dark(12, y0, 8, 8);
  dark(18, y0 + 2, 10, 4);
  dark(4, y0 + 14, 4, 4);
  dark(24, y0 + 14, 4, 4);

  for (let y = y0; y < y0 + 8; y++) {
    for (let x = 12; x < 20; x++) {
      const c = x < 15 && y < y0 + 4 ? CRY_H : x > 17 ? CRY_D : CRY;
      p.set(x, y, c);
    }
  }
  for (let y = y0 + 6; y < y0 + 16; y++) {
    for (let x = 10; x < 22; x++) p.set(x, y, x < 14 ? CRY : CRY_D);
  }
  p.set(14, y0 + 2, WHITE);
  p.circ(22, y0 + 4, 3, CRY_H);
  p.set(24, y0 + 3, WHITE);
  for (let x = 18; x < 28; x++) p.set(x, y0 + 4, x > 24 ? CRY_H : CRY);
  p.fillRect(4, y0 + 14, 4, 4, CRY_D);
  p.fillRect(24, y0 + 14, 4, 4, CRY_D);
  p.fillRect(12, y0 + 4, 8, 4, MAG);
  return p;
}

// ── Shade ───────────────────────────────────────────────────────────────────
function drawShadePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  dark(10, 4, 12, 24);
  dark(8, 22, 4, 6);
  dark(22, 20, 4, 6);
  dark(6, 2, 6, 4);
  dark(20, 2, 6, 4);

  shadeRect(p, 10, 4, 12, 24, VOID_D, VOID, VOID_D);
  shadeRect(p, 11, 6, 10, 20, VOID, VOID_H, VOID_D);
  p.set(16, 10, WHITE);
  p.set(17, 10, VOID_H);
  p.fillRect(14, 14, 4, 4, MAG);

  p.fillRect(18, 14, 10, 2, BONE);
  p.set(27, 13, INK);
  p.set(26, 14, SKIN_D);

  if (civ < 1.5) {
    p.set(8, 24, VOID_D);
    p.set(22, 22, VOID_D);
  }
  return p;
}

// ── Corpse ──────────────────────────────────────────────────────────────────
function drawCorpsePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md } = civPal(civ);
  p.circ(14, 22, 8, INK);
  p.circ(10, 20, 3, md);
  p.circ(18, 21, 2, MAG);
  return p;
}

function applyDissolve(pix: Pix, frame: number): void {
  const hash = (x: number, y: number) => (x * 17 + y * 31 + 5) % 8;
  for (let y = 0; y < pix.h; y++) {
    for (let x = 0; x < pix.w; x++) {
      const i = (x + y * pix.w) * 4;
      if (pix.d[i + 3] < 20) continue;
      const h = hash(x, y);
      if (frame >= 6 && h < 6) pix.d[i + 3] = 0;
      else if (frame >= 5 && h < 3) pix.d[i + 3] = 0;
    }
  }
}

// ── Buildings (y-down canvas, 64px hall) ────────────────────────────────────

function drawHallPix(civ: number): Pix {
  const p = Pix.alloc(64, 64);
  const pal = civPal(civ);
  const cx = 32;
  p.fillRect(8, 40, 48, 20, INK);
  p.fillRect(12, 18, 40, 22, INK);
  for (let y = 8; y <= 22; y++) {
    const half = Math.round(4 + ((y - 8) / 14) * 22);
    p.fillRect(cx - half, y, half * 2, 1, INK);
  }

  shadeRect(p, 10, 40, 45, 20, WALL, WALL_H, WALL_D);
  shadeRect(p, 14, 18, 37, 22, WALL, WALL_H, WALL_D);
  shadeDome(p, cx, 8, 22, pal);
  p.set(cx - 6, 9, WHITE);

  p.fillRect(cx - 6, 55, 13, 5, INK);
  p.fillRect(cx - 5, 56, 11, 3, [20, 14, 26, 255]);
  p.set(cx - 4, 59, WALL_D);

  for (let i = 0; i < 3; i++) {
    const wy = 24 + i * 4;
    p.set(20, wy, WIN);
    p.set(44, wy, WIN);
  }

  if (civ < 0.5) {
    p.circ(cx, 16, 5, pal.hi);
    p.circ(cx, 58, 2, SOL_H);
  } else if (civ < 1.5) {
    p.fillRect(cx - 2, 12, 4, 10, CRY_H);
    p.set(cx, 10, WHITE);
  } else {
    p.fillRect(cx - 3, 10, 6, 14, VOID_D);
    p.circ(cx + 8, 14, 3, VOID_H);
    p.circ(cx - 10, 18, 3, VOID_H);
  }
  p.fillRect(cx - 4, 28, 8, 6, MAG);
  return p;
}

function drawHousePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const pal = civPal(civ);
  const cx = 16;
  p.fillRect(4, 18, 24, 12, INK);
  for (let y = 6; y <= 18; y++) {
    const half = Math.round(2 + ((y - 6) / 12) * 12);
    p.fillRect(cx - half, y, half * 2, 1, INK);
  }

  shadeRect(p, 5, 18, 22, 12, WALL, WALL_H, WALL_D);
  shadeDome(p, cx, 6, 18, pal);

  p.fillRect(cx - 5, 26, 11, 4, INK);
  p.fillRect(cx - 4, 27, 9, 2, [20, 14, 26, 255]);
  p.set(10, 22, WIN);
  p.set(22, 22, WIN);

  if (civ < 0.5) p.circ(cx, 14, 3, pal.hi);
  else if (civ < 1.5) p.set(cx, 8, CRY_H);
  else p.set(cx - 2, 10, VOID_D);
  p.fillRect(cx - 3, 20, 6, 4, MAG);
  return p;
}

function drawBarracksPix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const pal = civPal(civ);
  const cx = 16;
  p.fillRect(2, 16, 28, 14, INK);
  p.fillRect(4, 12, 24, 6, INK);
  p.fillRect(2, 20, 6, 6, INK);
  p.fillRect(10, 20, 4, 6, INK);
  p.fillRect(18, 20, 4, 6, INK);
  p.fillRect(24, 20, 4, 6, INK);

  shadeRect(p, 4, 16, 24, 14, WALL, WALL_H, WALL_D);
  shadeRect(p, 6, 12, 20, 6, pal.dk, pal.md, pal.dk);

  p.fillRect(cx - 5, 24, 11, 5, INK);
  p.fillRect(cx - 4, 25, 9, 3, [20, 14, 26, 255]);
  p.set(8, 18, WIN);
  p.set(24, 18, WIN);

  p.fillRect(cx - 1, 8, 2, 8, BONE);
  p.fillRect(cx + 2, 10, 5, 4, pal.hi);

  if (civ < 0.5) {
    p.fillRect(6, 14, 2, 8, BONE);
    p.fillRect(24, 14, 2, 8, BONE);
  } else if (civ < 1.5) {
    p.set(8, 14, CRY_H);
    p.set(24, 14, CRY_H);
    p.set(cx, 6, WHITE);
  } else {
    p.fillRect(6, 14, 2, 6, VOID_H);
    p.fillRect(24, 14, 2, 6, VOID_H);
  }
  p.fillRect(cx - 3, 18, 6, 4, MAG);
  return p;
}

function drawUniquePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const pal = civPal(civ);
  const cx = 16;

  if (civ < 0.5) {
    p.fillRect(4, 20, 24, 10, INK);
    p.circ(10, 14, 7, INK);
    p.circ(22, 15, 6, INK);
    p.circ(cx, 10, 8, INK);
    shadeRect(p, 4, 20, 24, 10, pal.dk, pal.md, pal.dk);
    p.circ(10, 14, 5, SOL);
    p.circ(22, 15, 4, SOL);
    p.circ(cx, 10, 5, pal.hi);
    p.set(cx, 6, SOL_H);
    p.fillRect(cx - 1, 2, 2, 6, pal.hi);
    p.circ(cx, 2, 2, SOL_H);
  } else if (civ < 1.5) {
    p.fillRect(6, 22, 20, 8, INK);
    for (let y = 4; y <= 22; y++) {
      const half = Math.max(1, Math.round(3 + (22 - y) * 0.25));
      p.fillRect(cx - half, y, half * 2, 1, INK);
    }
    shadeRect(p, 6, 22, 20, 8, CRY_D, CRY, CRY_D);
    for (let y = 4; y <= 22; y++) {
      const half = Math.max(1, Math.round(3 + (22 - y) * 0.25));
      for (let x = cx - half; x <= cx + half; x++) {
        p.set(x, y, x < cx ? CRY_H : CRY);
      }
    }
    p.set(cx, 6, WHITE);
    p.fillRect(cx - 8, 12, 4, 8, CRY_D);
    p.fillRect(cx + 6, 12, 4, 8, CRY_D);
  } else {
    p.fillRect(6, 22, 20, 8, INK);
    p.fillRect(cx - 2, 8, 4, 16, INK);
    p.circ(cx, 6, 9, INK);
    shadeRect(p, 6, 22, 20, 8, VOID_D, VOID, VOID_D);
    shadeRect(p, cx - 2, 8, 4, 16, VOID_D, VOID, VOID_D);
    p.circ(cx, 6, 6, VOID_H);
    p.set(cx + 2, 5, WHITE);
    p.fillRect(cx - 14, 14, 10, 2, VOID_D);
    p.fillRect(cx + 6, 12, 10, 2, VOID_D);
    p.circ(cx - 14, 14, 2, VOID_H);
    p.circ(cx + 14, 12, 2, VOID_H);
  }

  p.fillRect(cx - 4, 24, 9, 4, INK);
  p.fillRect(cx - 3, 25, 7, 2, [20, 14, 26, 255]);
  p.set(12, 20, WIN);
  p.set(20, 20, WIN);
  p.fillRect(cx - 3, 16, 6, 4, MAG);
  return p;
}

export function drawUnitSprite(kind: Kind, civ: Civ, frame: number): Pix {
  const ci = civIndex(civ);
  if (frame >= 4) {
    const corpse = drawCorpsePix(ci);
    if (frame >= 5) applyDissolve(corpse, frame);
    return corpse;
  }
  switch (kind) {
    case Kind.Worker:
      return drawWorkerPix(ci, frame);
    case Kind.Scout:
      return drawScoutPix(ci);
    case Kind.Fighter:
      return drawFighterPix(ci, frame);
    case Kind.Siege:
      return drawSiegePix(ci);
    case Kind.Ravager:
      return drawRavagerPix(ci, frame);
    case Kind.Prism:
      return drawPrismPix(ci, frame);
    case Kind.Shade:
      return drawShadePix(ci);
    default:
      return drawFighterPix(ci, frame);
  }
}

export function drawBuildingSprite(kind: Kind, civ: Civ): Pix {
  const ci = civIndex(civ);
  switch (kind) {
    case Kind.Hall:
      return drawHallPix(ci);
    case Kind.House:
      return drawHousePix(ci);
    case Kind.Barracks:
      return drawBarracksPix(ci);
    case Kind.UniqueB:
      return drawUniquePix(ci);
    default:
      return drawHousePix(ci);
  }
}

export const UNIT_FRAMES = 7;
export const UNIT_KINDS = 7;
export const CIVS = 3;
const ATLAS_CELL = 32;
const HALL_CELL = 64;
const ATLAS_COLS = 16;

export interface SpriteAtlas {
  canvas: HTMLCanvasElement;
  cell: number;
  hallCell: number;
  cols: number;
  unitRows: number;
  buildingRow: number;
  width: number;
  height: number;
}

function slotIndex(kind: number, civ: number, frame: number): number {
  if (kind >= Kind.Hall) return (kind - Kind.Hall) * CIVS + civ;
  return kind * CIVS * UNIT_FRAMES + civ * UNIT_FRAMES + frame;
}

export function buildSpriteAtlas(): SpriteAtlas {
  const unitSlots = UNIT_KINDS * CIVS * UNIT_FRAMES;
  const unitRows = Math.ceil(unitSlots / ATLAS_COLS);
  const buildingRow = unitRows;
  const buildingRows = 4;
  const height = unitRows * ATLAS_CELL + buildingRows * HALL_CELL;
  const width = ATLAS_COLS * ATLAS_CELL;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  const blitUnit = (pix: Pix, slot: number) => {
    const col = slot % ATLAS_COLS;
    const row = Math.floor(slot / ATLAS_COLS);
    const img = ctx.createImageData(pix.w, pix.h);
    img.data.set(pix.d);
    const off = document.createElement('canvas');
    off.width = pix.w;
    off.height = pix.h;
    off.getContext('2d')!.putImageData(img, 0, 0);
    const dx = col * ATLAS_CELL + (ATLAS_CELL - pix.w) / 2;
    const dy = row * ATLAS_CELL + (ATLAS_CELL - pix.h);
    ctx.drawImage(off, dx, dy);
  };

  const civs: Civ[] = ['vespari', 'aurion', 'voidmarked'];
  for (let kind = 0; kind < UNIT_KINDS; kind++) {
    for (let civ = 0; civ < CIVS; civ++) {
      for (let frame = 0; frame < UNIT_FRAMES; frame++) {
        blitUnit(drawUnitSprite(kind as Kind, civs[civ], frame), slotIndex(kind, civ, frame));
      }
    }
  }

  for (let bk = Kind.Hall; bk <= Kind.UniqueB; bk++) {
    for (let civ = 0; civ < CIVS; civ++) {
      const pix = drawBuildingSprite(bk, civs[civ]);
      const col = civ;
      const row = buildingRow + (bk - Kind.Hall);
      const cell = bk === Kind.Hall ? HALL_CELL : ATLAS_CELL;
      const img = ctx.createImageData(pix.w, pix.h);
      img.data.set(pix.d);
      const off = document.createElement('canvas');
      off.width = pix.w;
      off.height = pix.h;
      off.getContext('2d')!.putImageData(img, 0, 0);
      const dx = col * ATLAS_CELL + (ATLAS_CELL - pix.w) / 2;
      const dy = row * HALL_CELL + (cell - pix.h);
      ctx.drawImage(off, dx, dy);
    }
  }

  return {
    canvas,
    cell: ATLAS_CELL,
    hallCell: HALL_CELL,
    cols: ATLAS_COLS,
    unitRows,
    buildingRow,
    width,
    height,
  };
}

export function atlasSlot(kind: number, civ: number, frame: number): number {
  return slotIndex(kind, civ, Math.min(6, Math.max(0, Math.floor(frame))));
}
