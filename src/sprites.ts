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

// Wall tones sit above quiet-dust terrain (~102,88,108) so edges read at RTS zoom.
const WALL: Rgba = [118, 106, 124, 255];
const WALL_H: Rgba = [156, 146, 164, 255];
const WALL_D: Rgba = [82, 72, 92, 255];
const WIN: Rgba = [210, 228, 255, 255];
const DOOR: Rgba = [20, 14, 26, 255];

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

function drawDoor(p: Pix, cx: number, bottomY: number, w: number, h: number): void {
  const x0 = cx - Math.floor(w / 2);
  p.fillRect(x0, bottomY - h + 1, w, h, INK);
  p.fillRect(x0 + 1, bottomY - h + 2, w - 2, h - 2, DOOR);
  p.set(cx - 1, bottomY, WALL_D);
}

function drawWindows(p: Pix, slots: readonly (readonly [number, number])[]): void {
  for (const [x, y] of slots) {
    p.fillRect(x, y, 2, 2, WIN);
    p.set(x, y, [236, 244, 255, 255]);
  }
}

type IsoVerts = {
  footN: [number, number];
  footW: [number, number];
  footE: [number, number];
  footS: [number, number];
  roofN: [number, number];
  roofW: [number, number];
  roofE: [number, number];
  roofS: [number, number];
};

function isoVerts(cx: number, footY: number, footW: number, wallH: number, roofW: number): IsoVerts {
  const fh = footW / 4;
  const rw = roofW / 2;
  const rise = wallH;
  return {
    footN: [cx, footY - fh],
    footW: [cx - footW / 2, footY],
    footE: [cx + footW / 2, footY],
    footS: [cx, footY + fh],
    roofN: [cx, footY - fh - rise],
    roofW: [cx - rw, footY - fh - rise * 0.52],
    roofE: [cx + rw, footY - fh - rise * 0.52],
    roofS: [cx, footY - fh - rise * 0.08],
  };
}

function linePix(p: Pix, x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
  x0 = Math.round(x0);
  y0 = Math.round(y0);
  x1 = Math.round(x1);
  y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  const cap = dx + dy + 2;
  for (let n = 0; n < cap; n++) {
    p.set(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = err * 2;
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

function fillQuad(
  p: Pix,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
  c: Rgba,
): void {
  const verts = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
  ];
  const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2, y3)));
  const maxY = Math.min(p.h - 1, Math.floor(Math.max(y0, y1, y2, y3)));
  for (let y = minY; y <= maxY; y++) {
    const scan: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 4];
      if (a.y === b.y) continue;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        scan.push(a.x + t * (b.x - a.x));
      }
    }
    if (scan.length >= 2) {
      scan.sort((a, b) => a - b);
      const xA = Math.round(scan[0]);
      const xB = Math.round(scan[scan.length - 1]);
      for (let x = xA; x <= xB; x++) p.set(x, y, c);
    }
  }
}

function fillSouthWall(p: Pix, v: IsoVerts): void {
  const [x0, y0] = v.footW;
  const [x1, y1] = v.roofW;
  const [x2, y2] = v.roofS;
  const x3 = v.footS[0] - (v.footS[0] - v.footW[0]) * 0.42;
  const y3 = v.footS[1];
  const minY = Math.max(0, Math.ceil(Math.min(y0, y1, y2, y3)));
  const maxY = Math.min(p.h - 1, Math.floor(Math.max(y0, y1, y2, y3)));
  const verts = [
    { x: x0, y: y0 },
    { x: x1, y: y1 },
    { x: x2, y: y2 },
    { x: x3, y: y3 },
  ];
  for (let y = minY; y <= maxY; y++) {
    const scan: number[] = [];
    for (let i = 0; i < 4; i++) {
      const a = verts[i];
      const b = verts[(i + 1) % 4];
      if (a.y === b.y) continue;
      if ((a.y <= y && b.y > y) || (b.y <= y && a.y > y)) {
        const t = (y - a.y) / (b.y - a.y);
        scan.push(a.x + t * (b.x - a.x));
      }
    }
    if (scan.length >= 2) {
      scan.sort((a, b) => a - b);
      const xA = Math.round(scan[0]);
      const xB = Math.round(scan[scan.length - 1]);
      const span = Math.max(1, xB - xA);
      for (let x = xA; x <= xB; x++) {
        const t = (x - xA) / span;
        const u = (y - minY) / Math.max(1, maxY - minY);
        const c = u < 0.35 && t < 0.5 ? WALL_H : t > 0.72 ? WALL_D : WALL;
        p.set(x, y, c);
      }
    }
  }
}

function fillEastWall(p: Pix, v: IsoVerts): void {
  const [x0, y0] = v.footE;
  const [x1, y1] = v.roofE;
  const [x2, y2] = v.roofS;
  const x3 = v.footS[0] + (v.footE[0] - v.footS[0]) * 0.42;
  const y3 = v.footS[1];
  fillQuad(p, x0, y0, x1, y1, x2, y2, x3, y3, WALL_D);
}

function fillRoof3(p: Pix, v: IsoVerts, pal: CivPal): void {
  const cx = v.roofN[0];
  const w = v.roofE[0] - v.roofW[0];
  const yTop = v.roofN[1];
  const yBot = v.roofS[1];
  const halfH = (yBot - yTop) / 2;
  const cy = (yTop + yBot) / 2;
  for (let dy = -halfH; dy <= halfH; dy++) {
    const y = Math.round(cy + dy);
    const t = 1 - Math.abs(dy) / Math.max(1, halfH);
    const halfW = Math.round((w / 2) * t);
    for (let dx = -halfW; dx <= halfW; dx++) {
      const c = dy < -halfH * 0.25 ? pal.hi : dy > halfH * 0.25 ? pal.dk : pal.md;
      p.set(cx + dx, y, c);
    }
  }
}

function strokeIsoBox(p: Pix, v: IsoVerts): void {
  const { footN, footW, footE, footS, roofN, roofW, roofE, roofS } = v;
  linePix(p, footW[0], footW[1], footN[0], footN[1], INK);
  linePix(p, footN[0], footN[1], footE[0], footE[1], INK);
  linePix(p, footE[0], footE[1], footS[0], footS[1], INK);
  linePix(p, footS[0], footS[1], footW[0], footW[1], INK);
  linePix(p, footW[0], footW[1], roofW[0], roofW[1], INK);
  linePix(p, roofW[0], roofW[1], roofN[0], roofN[1], INK);
  linePix(p, roofN[0], roofN[1], roofE[0], roofE[1], INK);
  linePix(p, roofE[0], roofE[1], roofS[0], roofS[1], INK);
  linePix(p, roofS[0], roofS[1], footS[0], footS[1], INK);
  linePix(p, roofS[0], roofS[1], footW[0] + (footS[0] - footW[0]) * 0.42, footS[1], INK);
  linePix(p, roofS[0], roofS[1], footE[0] - (footE[0] - footS[0]) * 0.42, footS[1], INK);
}

function drawDoorOnSouth(p: Pix, v: IsoVerts, w: number, h: number): void {
  const cx = Math.round(v.footW[0] + (v.footS[0] - v.footW[0]) * 0.38);
  const bottomY = Math.round(v.footS[1] - 1);
  drawDoor(p, cx, bottomY, w, h);
}

function windowSlotsSouth(v: IsoVerts, count: number): [number, number][] {
  const slots: [number, number][] = [];
  const x0 = v.footW[0] + 2;
  const x1 = v.roofW[0] + 1;
  const y0 = v.roofW[1] + 2;
  const y1 = v.footW[1] - 2;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    slots.push([Math.round(x0 + (x1 - x0) * t * 0.55), Math.round(y0 + (y1 - y0) * (0.25 + t * 0.5))]);
  }
  return slots;
}

function windowSlotsEast(v: IsoVerts, count: number): [number, number][] {
  const slots: [number, number][] = [];
  const x0 = v.roofE[0] - 3;
  const x1 = v.footE[0] - 3;
  const y0 = v.roofE[1] + 2;
  const y1 = v.footE[1] - 2;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0.5 : i / (count - 1);
    slots.push([Math.round(x0 + (x1 - x0) * t * 0.4), Math.round(y0 + (y1 - y0) * (0.3 + t * 0.4))]);
  }
  return slots;
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

  if (civ < 0.5) {
    p.set(cx - 4, 10, hi);
    p.set(cx - 3, 9, hi);
  } else if (civ < 1.5) {
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

  // Team emissive — visor slit.
  p.set(cx - 1, 5, MAG);
  p.set(cx, 5, MAG);
  return p;
}

// ── Worker ──────────────────────────────────────────────────────────────────
function drawWorkerPix(civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const cx = 12;
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);
  const drill = civ >= 1.5 && frame >= 1;

  // Connected hunched silhouette — legs, torso, head, load tool overlapping thighs.
  dark(cx - 4, 18, 6, 12);
  dark(cx + 1, 18, 6, 12);
  dark(cx - 7, 8, 15, 12);
  dark(cx - 3, 3, 9, 7);

  if (drill) {
    dark(cx + 2, 10, 4, 4);
    dark(cx + 5, 11, 16, 3);
    dark(cx + 20, 10, 5, 5);
    shadeRect(p, cx + 5, 11, 16, 3, ROCK, ROCK_H, ROCK);
    shadeRect(p, cx + 20, 10, 5, 5, ROCK, ROCK_H, ROCK);
    p.set(cx + 24, 11, WHITE);
    p.set(cx + 3, 11, SKIN);
    p.set(cx + 4, 12, SKIN);
  } else {
    dark(cx + 5, 10, 15, 14);
    for (let y = 10; y < 24; y++) {
      for (let x = cx + 5; x < cx + 20; x++) {
        const edge = x === cx + 5 || x === cx + 19 || y === 10 || y === 23;
        const band = (y - 10) % 4 === 0;
        const c = edge || band ? INK : x < cx + 10 && y < 14 ? ORE_H : ORE;
        p.set(x, y, c);
      }
    }
    p.set(cx + 8, 11, WHITE);
    p.set(cx + 9, 12, ORE_H);
    dark(cx + 1, 10, 5, 3);
    dark(cx + 1, 19, 5, 3);
    p.fillRect(cx + 1, 10, 5, 3, md);
    p.fillRect(cx + 1, 19, 5, 3, dk);
    p.set(cx + 6, 11, SKIN);
    p.set(cx + 6, 20, SKIN_D);
  }

  shadeRect(p, cx - 6, 8, 13, 12, md, hi, dk);
  for (let y = 3; y < 10; y++) {
    const c = y < 6 ? hi : md;
    p.set(cx - 2, y, c);
    p.set(cx - 1, y, c);
    p.set(cx, y, c);
    p.set(cx + 1, y, y < 6 ? md : dk);
  }
  p.set(cx, 2, ORE_H);
  p.set(cx - 1, 1, WHITE);

  for (let y = 18; y < 30; y++) {
    const lit = y < 23;
    p.set(cx - 3, y, lit ? md : dk);
    p.set(cx - 4, y, dk);
    p.set(cx + 2, y, lit ? hi : md);
    p.set(cx + 3, y, dk);
  }
  p.fillRect(cx - 5, 29, 5, 2, dk);
  p.fillRect(cx + 1, 29, 5, 2, dk);

  if (civ < 0.5) {
    p.set(cx - 5, 9, hi);
    p.set(cx - 4, 8, hi);
  } else if (civ < 1.5) {
    p.set(cx - 6, 9, hi);
    p.set(cx - 5, 8, hi);
    p.set(cx - 4, 9, hi);
  } else {
    p.set(cx - 5, 9, VOID_H);
    p.set(cx - 4, 8, VOID_H);
  }

  // Team emissive — crate lamp or visor slit.
  if (drill) {
    p.set(cx + 24, 11, MAG);
    p.set(cx + 25, 11, MAG);
  } else {
    p.set(cx - 1, 5, MAG);
    p.set(cx, 5, MAG);
  }
  return p;
}

// ── Scout ───────────────────────────────────────────────────────────────────
function drawScoutPix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // Low hull on ground + sensor mast/dish + rear exhaust — one connected vehicle.
  dark(2, 22, 26, 8);
  dark(4, 18, 22, 6);
  dark(0, 10, 8, 10);
  dark(0, 4, 12, 8);
  dark(24, 20, 6, 8);

  shadeRect(p, 2, 22, 26, 8, dk, md, dk);
  shadeRect(p, 4, 18, 22, 6, md, hi, dk);
  p.fillRect(2, 28, 26, 2, dk);

  // Sensor dish (trapezoid on mast, not a floating orb).
  shadeRect(p, 0, 10, 8, 10, ROCK, ROCK_H, ROCK);
  for (let y = 4; y < 12; y++) {
    const half = 5 - Math.floor((y - 4) / 2);
    for (let x = 1; x <= 1 + half * 2; x++) {
      const c = x < 4 ? hi : x > 8 ? dk : md;
      p.set(x, y, c);
    }
  }
  p.set(2, 5, WHITE);
  p.set(3, 6, WHITE);
  dark(6, 12, 3, 4);

  // Exhaust stack connected to hull rear.
  shadeRect(p, 24, 20, 6, 8, SOL, SOL_H, ORE);
  p.fillRect(26, 18, 4, 4, ROCK);
  p.set(27, 19, SOL_H);
  p.set(28, 20, WHITE);

  if (civ < 0.5) {
    p.fillRect(8, 19, 12, 2, hi);
    p.set(10, 18, hi);
  } else if (civ < 1.5) {
    p.fillRect(8, 19, 10, 2, hi);
    p.set(12, 18, CRY_H);
    p.set(14, 19, hi);
  } else {
    p.fillRect(18, 19, 6, 3, VOID_D);
    p.set(20, 18, VOID_H);
  }

  // Team emissive — engine glow.
  p.set(27, 19, MAG);
  p.set(28, 20, MAG);
  return p;
}

// ── Siege ───────────────────────────────────────────────────────────────────
function drawSiegePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // Tread base + turret + raised cannon barrel (stock → receiver → barrel → muzzle).
  dark(1, 24, 30, 6);
  dark(3, 20, 26, 6);
  dark(6, 12, 20, 10);
  dark(18, 8, 8, 6);
  dark(24, 6, 7, 4);

  shadeRect(p, 1, 24, 30, 6, ROCK, ROCK_H, ROCK);
  p.fillRect(4, 26, 8, 4, dk);
  p.fillRect(20, 26, 8, 4, dk);
  shadeRect(p, 3, 20, 26, 6, ROCK, ROCK_H, ROCK);
  shadeRect(p, 6, 12, 20, 10, md, hi, dk);

  dark(14, 10, 6, 4);
  dark(18, 8, 6, 5);
  dark(22, 7, 9, 3);
  shadeRect(p, 14, 10, 6, 4, GUN, GUN_H, GUN);
  shadeRect(p, 18, 8, 6, 5, GUN, GUN_H, GUN);
  for (let x = 22; x <= 30; x++) {
    p.set(x, 7, x > 27 ? GUN_H : GUN);
    p.set(x, 8, GUN);
    p.set(x, 9, GUN);
  }
  p.set(30, 7, WHITE);
  p.set(31, 8, WHITE);

  if (civ < 0.5) {
    p.set(14, 14, hi);
    p.set(16, 13, hi);
    p.set(18, 14, md);
  } else if (civ < 1.5) {
    p.set(14, 14, hi);
    p.set(16, 13, CRY_H);
    p.set(18, 14, hi);
  } else {
    p.fillRect(14, 13, 4, 4, VOID_H);
    p.set(15, 14, VOID_D);
  }

  // Team emissive — muzzle crystal.
  p.set(30, 7, MAG);
  p.set(31, 8, MAG);
  return p;
}

// ── Ravager ─────────────────────────────────────────────────────────────────
function drawRavagerPix(civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const lunge = frame % 2 === 1 ? 2 : 0;
  const { md, hi, dk } = civPal(civ);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // Hunched predator — torso, head, legs on ground, scythe claws from shoulders.
  dark(9, 18, 6, 12);
  dark(17, 18, 6, 12);
  dark(8, 10, 16, 10);
  dark(11, 4, 10, 8);
  dark(3 - lunge, 8, 5, 12);
  dark(24 + lunge, 8, 5, 12);
  dark(2 - lunge, 4, 4, 6);
  dark(26 + lunge, 4, 4, 6);

  shadeRect(p, 8, 10, 16, 10, md, hi, dk);
  for (let y = 4; y < 12; y++) {
    p.set(14, y, y < 7 ? hi : md);
    p.set(15, y, y < 7 ? hi : md);
    p.set(16, y, md);
    p.set(17, y, dk);
  }
  p.set(14, 6, BLOOD);
  p.set(15, 6, BLOOD);
  p.set(16, 5, WHITE);

  for (let y = 18; y < 30; y++) {
    const lit = y < 23;
    p.set(11, y, lit ? md : dk);
    p.set(12, y, dk);
    p.set(19, y, lit ? hi : md);
    p.set(20, y, dk);
  }
  p.fillRect(9, 29, 5, 2, dk);
  p.fillRect(18, 29, 5, 2, dk);

  // Scythe claws — bone shaft + curved blade (not gold orbs).
  shadeRect(p, 3 - lunge, 8, 4, 10, BONE, WHITE, SKIN_D);
  shadeRect(p, 24 + lunge, 8, 4, 10, BONE, WHITE, SKIN_D);
  p.fillRect(1 - lunge, 4, 4, 5, GUN_H);
  p.fillRect(27 + lunge, 4, 4, 5, GUN_H);
  p.set(0 - lunge, 3, WHITE);
  p.set(31 + lunge, 3, WHITE);

  if (civ < 0.5) {
    p.set(10, 12, hi);
  } else if (civ < 1.5) {
    p.set(10, 12, CRY_H);
    p.set(20, 12, CRY_H);
  } else {
    p.set(10, 12, VOID_H);
    p.set(20, 12, VOID_H);
  }

  // Team emissive — predator eye.
  p.set(15, 6, MAG);
  p.set(16, 5, MAG);
  return p;
}

// ── Prism ───────────────────────────────────────────────────────────────────
function drawPrismPix(civ: number, frame: number): Pix {
  const p = Pix.alloc(32, 32);
  const hover = frame % 2 === 1 ? -1 : 0;
  const y0 = 4 + hover;
  const { md, hi, dk } = civPal(1);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // Floating crystal body + focus lens + beam weapon + stabilizer pods on stems.
  dark(8, y0 + 10, 16, 12);
  dark(10, y0 + 2, 12, 10);
  dark(6, y0 + 8, 4, 6);
  dark(22, y0 + 8, 4, 6);
  dark(20, y0 + 4, 10, 5);
  dark(28, y0 + 3, 3, 4);

  for (let y = y0 + 2; y < y0 + 12; y++) {
    for (let x = 10; x < 22; x++) {
      const c = x < 14 && y < y0 + 6 ? hi : x > 18 || y > y0 + 8 ? dk : md;
      p.set(x, y, c);
    }
  }
  for (let y = y0 + 10; y < y0 + 22; y++) {
    for (let x = 8; x < 24; x++) p.set(x, y, x < 13 ? md : dk);
  }
  // Focus lens — team emissive MAG facet.
  p.set(14, y0 + 3, MAG);
  p.set(15, y0 + 4, MAG);
  p.set(16, y0 + 4, MAG);

  // Beam extending right (civ palette, not team lamp).
  shadeRect(p, 20, y0 + 4, 6, 5, CRY_H, WHITE, CRY);
  for (let x = 24; x <= 30; x++) {
    const c = x > 28 ? CRY_H : x > 26 ? hi : md;
    p.set(x, y0 + 5, c);
    if (x > 26) p.set(x, y0 + 6, c);
  }

  // Stabilizer pods on stems (connected, not floating orbs).
  p.fillRect(10, y0 + 16, 2, 6, dk);
  p.fillRect(20, y0 + 16, 2, 6, dk);
  shadeRect(p, 6, y0 + 20, 6, 4, md, hi, dk);
  shadeRect(p, 20, y0 + 20, 6, 4, md, hi, dk);

  if (civ < 0.5) p.set(12, y0 + 8, HIVE_H);
  else if (civ >= 1.5) {
    p.set(16, y0 + 8, VOID_H);
    p.set(17, y0 + 9, VOID_H);
  }
  return p;
}

// ── Shade ───────────────────────────────────────────────────────────────────
function drawShadePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const { md, hi, dk } = civPal(civ);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // Cloaked figure — hood, cloak body, feet on ground, dagger with skin grip.
  dark(9, 18, 5, 12);
  dark(18, 18, 5, 12);
  dark(8, 6, 16, 14);
  dark(10, 2, 12, 6);
  dark(18, 12, 12, 3);
  dark(28, 11, 3, 5);

  shadeRect(p, 8, 6, 16, 14, md, hi, dk);
  for (let y = 2; y < 8; y++) {
    p.set(14, y, y < 5 ? hi : md);
    p.set(15, y, y < 5 ? hi : md);
    p.set(16, y, md);
    p.set(17, y, dk);
  }
  // Team emissive — glowing eye in hood.
  p.set(15, 5, MAG);
  p.set(16, 5, MAG);

  for (let y = 18; y < 30; y++) {
    p.set(11, y, y < 23 ? md : dk);
    p.set(12, y, dk);
    p.set(19, y, y < 23 ? hi : md);
    p.set(20, y, dk);
  }
  p.fillRect(9, 29, 5, 2, dk);
  p.fillRect(18, 29, 5, 2, dk);

  // Dagger — blade + hilt with skin-tone grip touching cloak hand.
  shadeRect(p, 18, 12, 10, 3, GUN, GUN_H, GUN);
  p.fillRect(28, 11, 3, 5, BONE);
  p.set(30, 12, WHITE);
  p.set(17, 13, SKIN);
  p.set(17, 14, SKIN_D);

  if (civ < 0.5) {
    p.set(10, 10, HIVE_H);
  } else if (civ < 1.5) {
    p.set(10, 10, CRY_H);
    p.set(20, 10, CRY_H);
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

// ── Buildings (iso 3/4 box: south + east walls + 2:1 roof diamond) ───────────

function drawHallPix(civ: number): Pix {
  const p = Pix.alloc(64, 64);
  const pal = civPal(civ);
  const cx = 32;
  const v = isoVerts(cx, 46, 50, 26, 42);

  strokeIsoBox(p, v);
  fillEastWall(p, v);
  fillSouthWall(p, v);
  fillRoof3(p, v, pal);
  strokeIsoBox(p, v);

  drawDoorOnSouth(p, v, 13, 7);
  drawWindows(p, [...windowSlotsSouth(v, 3), ...windowSlotsEast(v, 3)]);

  if (civ < 0.5) p.circ(v.roofN[0], v.roofN[1] + 4, 4, pal.hi);
  else if (civ < 1.5) {
    p.fillRect(cx - 1, v.roofN[1] + 2, 2, 8, CRY_H);
    p.set(cx, v.roofN[1] + 1, WHITE);
  } else {
    p.fillRect(cx - 2, v.roofN[1] + 2, 4, 10, VOID_D);
    p.circ(cx + 7, v.roofN[1] + 6, 2, VOID_H);
    p.circ(cx - 9, v.roofN[1] + 9, 2, VOID_H);
  }
  // Team emissive — spire orb on roof peak.
  p.set(cx, v.roofN[1], MAG);
  p.set(cx - 1, v.roofN[1] + 1, MAG);
  p.set(cx + 1, v.roofN[1] + 1, MAG);
  return p;
}

function drawHousePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const pal = civPal(civ);
  const cx = 16;
  const v = isoVerts(cx, 23, 24, 13, 20);

  strokeIsoBox(p, v);
  fillEastWall(p, v);
  fillSouthWall(p, v);
  fillRoof3(p, v, pal);
  strokeIsoBox(p, v);

  drawDoorOnSouth(p, v, 9, 5);
  drawWindows(p, [...windowSlotsSouth(v, 2), ...windowSlotsEast(v, 2)]);

  if (civ < 0.5) p.circ(v.roofN[0], v.roofN[1] + 2, 2, pal.hi);
  else if (civ < 1.5) p.set(cx, v.roofN[1] + 1, CRY_H);
  else p.set(cx - 1, v.roofN[1] + 2, VOID_D);
  // Team emissive — porch lantern beside door.
  p.set(cx - 5, v.footS[1] - 4, MAG);
  p.set(cx - 4, v.footS[1] - 4, MAG);
  return p;
}

function drawBarracksPix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const pal = civPal(civ);
  const cx = 16;
  const v = isoVerts(cx, 22, 26, 12, 22);

  strokeIsoBox(p, v);
  fillEastWall(p, v);
  fillSouthWall(p, v);
  fillRoof3(p, v, pal);
  strokeIsoBox(p, v);

  drawDoorOnSouth(p, v, 11, 5);
  drawWindows(p, [...windowSlotsSouth(v, 2), ...windowSlotsEast(v, 2)]);

  if (civ < 0.5) {
    p.fillRect(v.roofW[0] + 1, v.roofW[1] + 2, 2, 5, BONE);
    p.fillRect(v.roofE[0] - 3, v.roofE[1] + 2, 2, 5, BONE);
  } else if (civ < 1.5) {
    p.set(v.roofW[0] + 2, v.roofW[1] + 2, CRY_H);
    p.set(v.roofE[0] - 2, v.roofE[1] + 2, CRY_H);
    p.set(cx, v.roofN[1] + 1, WHITE);
  } else {
    p.fillRect(v.roofW[0] + 1, v.roofW[1] + 2, 2, 4, VOID_H);
    p.fillRect(v.roofE[0] - 3, v.roofE[1] + 2, 2, 4, VOID_H);
  }
  // Team emissive — gate lamp above door.
  p.set(cx - 1, v.footS[1] - 5, MAG);
  p.set(cx, v.footS[1] - 5, MAG);
  p.set(cx + 1, v.footS[1] - 4, MAG);
  return p;
}

function drawUniquePix(civ: number): Pix {
  const p = Pix.alloc(32, 32);
  const pal = civPal(civ);
  const cx = 16;
  const v = isoVerts(cx, 23, 24, 14, 21);

  strokeIsoBox(p, v);
  fillEastWall(p, v);
  fillSouthWall(p, v);
  fillRoof3(p, v, pal);
  strokeIsoBox(p, v);

  drawDoorOnSouth(p, v, 9, 5);
  drawWindows(p, [...windowSlotsSouth(v, 2), ...windowSlotsEast(v, 2)]);

  if (civ < 0.5) {
    p.circ(v.roofN[0], v.roofN[1] + 3, 3, pal.hi);
    p.set(cx, v.roofN[1], SOL_H);
    p.circ(cx, v.roofN[1] - 1, 2, SOL_H);
  } else if (civ < 1.5) {
    p.fillRect(cx - 1, v.roofN[1] + 1, 2, 6, CRY_H);
    p.set(cx, v.roofN[1], WHITE);
    p.fillRect(v.roofW[0] - 1, v.roofW[1] + 3, 3, 5, CRY_D);
    p.fillRect(v.roofE[0] - 2, v.roofE[1] + 3, 3, 5, CRY_D);
  } else {
    p.fillRect(cx - 1, v.roofN[1] + 2, 2, 8, VOID_D);
    p.circ(cx, v.roofN[1] + 1, 4, VOID_H);
    p.set(cx + 1, v.roofN[1], WHITE);
    p.circ(v.roofW[0] - 5, v.roofW[1] + 6, 2, VOID_H);
    p.circ(v.roofE[0] + 5, v.roofE[1] + 5, 2, VOID_H);
  }
  // Team emissive — staff orb / focus lens on roof peak.
  p.set(cx, v.roofN[1], MAG);
  p.set(cx - 1, v.roofN[1] + 1, MAG);
  p.set(cx + 1, v.roofN[1] + 1, MAG);
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
      const cell = bk === Kind.Hall ? HALL_CELL : ATLAS_CELL;
      const buildingBaseY = unitRows * ATLAS_CELL;
      const dy = buildingBaseY + (bk - Kind.Hall) * HALL_CELL + (cell - pix.h);
      const img = ctx.createImageData(pix.w, pix.h);
      img.data.set(pix.d);
      const off = document.createElement('canvas');
      off.width = pix.w;
      off.height = pix.h;
      off.getContext('2d')!.putImageData(img, 0, 0);
      const dx = bk === Kind.Hall ? col * HALL_CELL : col * ATLAS_CELL + (ATLAS_CELL - pix.w) / 2;
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
