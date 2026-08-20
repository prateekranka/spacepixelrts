/**
 * P90-v3 — startup-rasterized sprites (silhouette-first, top-left lit, connected anatomy).
 * Gold standard technique from art-reference.ts, full roster × civs × animation frames.
 */

import { Kind, type Civ } from './engine';
import { STARHOLD_PALETTE as P } from './palette';

export type Rgba = readonly [number, number, number, number];
export const MAG: Rgba = [255, 0, 255, 255];

function rgba(hex: string): Rgba {
  const n = Number.parseInt(hex.slice(1), 16);
  return [((n >> 16) & 0xff), ((n >> 8) & 0xff), (n & 0xff), 255];
}

const INK: Rgba = rgba(P.ink);
const SKIN: Rgba = rgba(P.sand);
const SKIN_D: Rgba = rgba(P.sienna);
const BONE: Rgba = rgba(P.sand);
const GUN: Rgba = rgba(P.steel);
const GUN_H: Rgba = rgba(P.muted);
const ORE: Rgba = rgba(P.copper);
const ORE_H: Rgba = rgba(P.ochre);
const SOL: Rgba = rgba(P.ochre);
const SOL_H: Rgba = rgba(P.amber);
const WHITE: Rgba = rgba(P.cream);
const ROCK: Rgba = rgba(P.slate);
const ROCK_H: Rgba = rgba(P.steel);
const BLOOD: Rgba = rgba(P.red);

const HIVE: Rgba = rgba(P.leaf);
const HIVE_H: Rgba = rgba(P.lime);
const HIVE_D: Rgba = rgba(P.moss);
const CRY: Rgba = rgba(P.sky);
const CRY_H: Rgba = rgba(P.ice);
const CRY_D: Rgba = rgba(P.fog);
const VOID: Rgba = rgba(P.plum);
const VOID_H: Rgba = rgba(P.coral);
const VOID_D: Rgba = rgba(P.shadow);

// Helion Compact option-5 Habitat Builder palette.
const HELION_SHIRT: Rgba = rgba(P.sienna);
const HELION_SHIRT_H: Rgba = rgba(P.sand);
const HELION_SHIRT_D: Rgba = rgba(P.rust);
const HELION_PANTS: Rgba = rgba(P.slate);
const HELION_PANTS_H: Rgba = rgba(P.steel);
const HELION_PANTS_D: Rgba = rgba(P.ink);
const HELION_BELT: Rgba = rgba(P.rust);
const HELION_BELT_H: Rgba = rgba(P.copper);
const HELION_BELT_D: Rgba = rgba(P.shadow);
const HELION_SKIN: Rgba = rgba(P.copper);
const HELION_SKIN_H: Rgba = rgba(P.ochre);
const HELION_SKIN_D: Rgba = rgba(P.sienna);
const HELION_BEARD: Rgba = rgba(P.shadow);
const HELION_BEARD_H: Rgba = rgba(P.rust);
const HELION_BEARD_D: Rgba = rgba(P.ink);
const HELION_BOOT: Rgba = rgba(P.plum);
const HELION_BOOT_H: Rgba = rgba(P.berry);
const HELION_BOOT_D: Rgba = rgba(P.shadow);
const HELION_WOOD: Rgba = rgba(P.sienna);
const HELION_WOOD_H: Rgba = rgba(P.ochre);
const HELION_WOOD_D: Rgba = rgba(P.rust);
const HELION_TOOL: Rgba = rgba(P.steel);
const HELION_TOOL_H: Rgba = rgba(P.cream);
const HELION_TOOL_D: Rgba = rgba(P.ink);
const HELION_CRATE: Rgba = rgba(P.sienna);
const HELION_CRATE_H: Rgba = rgba(P.copper);
const HELION_CRATE_D: Rgba = rgba(P.rust);
const HELION_FRUIT: Rgba = rgba(P.red);
const HELION_CRYSTAL: Rgba = rgba(P.lime);
const HELION_CRYSTAL_H: Rgba = rgba(P.ice);
const HELION_CRYSTAL_D: Rgba = rgba(P.leaf);
const HELION_SCOUT_PANEL: Rgba = rgba(P.berry);
const HELION_SCOUT_PANEL_H: Rgba = rgba(P.coral);

// Wall tones sit above quiet-dust terrain (~102,88,108) so edges read at RTS zoom.
const WALL: Rgba = rgba(P.steel);
const WALL_H: Rgba = rgba(P.muted);
const WALL_D: Rgba = rgba(P.slate);
const WIN: Rgba = rgba(P.ice);
const DOOR: Rgba = rgba(P.ink);

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
  flipX(): Pix {
    const p = Pix.alloc(this.w, this.h);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const si = (x + y * this.w) * 4;
        const di = (this.w - 1 - x + y * this.w) * 4;
        p.d[di] = this.d[si];
        p.d[di + 1] = this.d[si + 1];
        p.d[di + 2] = this.d[si + 2];
        p.d[di + 3] = this.d[si + 3];
      }
    }
    return p;
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

function civInk(civ: number): Rgba {
  if (civ < 0.5) return rgba(P.moss);
  if (civ < 1.5) return rgba(P.fog);
  return rgba(P.shadow);
}

function strokeOutline(p: Pix, c: Rgba): void {
  const a = new Uint8Array(p.w * p.h);
  for (let i = 0; i < p.w * p.h; i++) a[i] = p.d[i * 4 + 3];
  for (let y = 0; y < p.h; y++) {
    for (let x = 0; x < p.w; x++) {
      if (a[x + y * p.w]) continue;
      const n =
        (x > 0 && a[x - 1 + y * p.w]) ||
        (x + 1 < p.w && a[x + 1 + y * p.w]) ||
        (y > 0 && a[x + (y - 1) * p.w]) ||
        (y + 1 < p.h && a[x + (y + 1) * p.w]);
      if (n) p.set(x, y, c);
    }
  }
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
    p.set(x, y, rgba(P.cream));
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

// ── Worker 8-dir (Wave B) — 48px-tall humanoid, civ silhouette ──────────────
export const WORKER8_W = 32;
export const WORKER8_H = 48;
export const WORKER_ACTION_BASE = 7;
export const WORKER_ACTION_BUILD = WORKER_ACTION_BASE;
export const WORKER_ACTION_FOOD = WORKER_ACTION_BASE + 1;
export const WORKER_ACTION_CRYSTAL = WORKER_ACTION_BASE + 2;
export const WORKER_ACTION_ATTACK = WORKER_ACTION_BASE + 3;
export const WORKER_ACTION_ROWS = 4;

type HelionAction = -1 | 0 | 1 | 2 | 3;

/** Helion option 5: one stocky, bearded Habitat Builder in every state. */
function drawHelionVariant(dir: number, walk: boolean, action: HelionAction): Pix {
  const p = Pix.alloc(WORKER8_W, WORKER8_H);
  const side = dir === 0;
  const back = dir === 2;
  const front = dir === 6;
  const se = dir === 7;
  const ne = dir === 1;
  const { md: lime, hi: limeHi, dk: limeD } = civPal(0);
  const bob = walk ? 1 : 0;
  const cx = side ? 12 : se ? 14 : 15;
  const tx = side ? 6 : se ? 6 : 7;
  const tw = side ? 13 : 17;
  const hx = cx;
  const legW = side ? 5 : 6;
  const leftX = side ? 7 : se ? 8 : 9;
  const rightX = side ? 13 : se ? 15 : 16;
  const legTop = 30 + bob;
  const leftLift = walk ? 2 : 0;
  const rightLift = 0;
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);
  const wideLine = (x0: number, y0: number, x1: number, y1: number, c: Rgba) => {
    linePix(p, x0, y0, x1, y1, c);
    linePix(p, x0 + 1, y0, x1 + 1, y1, c);
  };

  // The complete silhouette is laid down before any fill, including held props.
  dark(leftX, legTop - leftLift, legW, 48 - legTop + leftLift);
  dark(rightX, legTop - rightLift, legW, 48 - legTop + rightLift);
  dark(tx + 2, 14 + bob, tw - 4, 3);
  dark(tx, 17 + bob, tw, 13);
  dark(tx + 1, 29 + bob, tw - 2, 4);
  dark(hx - 4, 8 + bob, 9, 9);
  dark(hx - 2, 13 + bob, 5, 6);
  dark(hx - 5, 7 + bob, 11, 5);
  dark(hx - 4, 5 + bob, 8, 4);
  dark(hx - 7, 10 + bob, 15, 2);

  const crate =
    action === 1
      ? front
        ? { x: 7, y: 23, w: 18, h: 14 }
        : side
          ? { x: 15, y: 23, w: 13, h: 13 }
          : se
            ? { x: 14, y: 23, w: 15, h: 14 }
            : back
              ? { x: 7, y: 23, w: 18, h: 13 }
              : { x: 12, y: 23, w: 16, h: 13 }
      : null;
  const crystalX = side ? 17 : se ? 15 : back ? 10 : 14;
  const crystalY = 20;

  if (action < 0) {
    if (front || back) {
      dark(tx - 3, 19 + bob, 5, 10);
      dark(tx - 4, 27 + bob, 5, 7);
      dark(tx + tw - 2, 19 + bob, 5, 10);
      dark(tx + tw - 1, 27 + bob, 5, 7);
    } else if (side) {
      dark(tx - 2, 19 + bob, 5, 9);
      dark(tx - 4, 27 + bob, 5, 7);
      dark(tx + tw - 2, 19 + bob, 5, 10);
      dark(tx + tw, 27 + bob, 5, 7);
    } else {
      dark(tx - 2, 19 + bob, 5, 10);
      dark(tx - 3, 27 + bob, 5, 7);
      dark(tx + tw - 2, 19 + bob, 5, 10);
      dark(tx + tw - 1, 27 + bob, 5, 7);
    }
  } else if (action === 1 && crate) {
    dark(crate.x, crate.y, crate.w, crate.h);
    dark(crate.x - 3, crate.y - 1, 4, 9);
    dark(crate.x + crate.w - 1, crate.y - 1, 4, 9);
  } else if (action === 2) {
    dark(crystalX - 1, crystalY + 1, 14, 13);
    dark(crystalX - 3, crystalY + 6, 4, 7);
    dark(crystalX + 11, crystalY + 5, 4, 8);
  }

  let attackHandX = 0;
  let attackHeadX = 0;
  let attackHeadY = 0;
  let buildHandleStartX = 0;
  let buildHandleStartY = 0;
  let buildSupportX = 0;
  let buildSupportY = 0;
  let buildPrimaryX = 0;
  let buildPrimaryY = 0;
  let buildUpperShoulderX = 0;
  let buildUpperShoulderY = 0;
  let buildLowerShoulderX = 0;
  let buildLowerShoulderY = 0;
  let buildHeadX = 0;
  let buildHeadY = 0;
  let buildFoundationX = 0;
  let buildFoundationY = 0;
  const paintMalletHead = (x: number, y: number): void => {
    p.fillRect(x - 4, y - 2, 8, 5, HELION_TOOL_D);
    p.fillRect(x - 3, y - 1, 6, 3, HELION_TOOL);
    p.fillRect(x - 2, y - 1, 3, 1, HELION_TOOL_H);
    p.set(x + 3, y, HELION_TOOL_H);
  };
  const paintBuildMalletHead = (x: number, y: number): void => {
    // A compact head crossing the shaft on the opposite diagonal. The stepped
    // silhouette keeps it tool-like instead of letting it become a second box.
    linePix(p, x - 4, y + 3, x + 3, y - 2, INK);
    linePix(p, x - 3, y + 3, x + 4, y - 2, INK);
    linePix(p, x - 3, y + 2, x + 3, y - 2, HELION_TOOL_D);
    linePix(p, x - 2, y + 2, x + 2, y - 1, HELION_TOOL);
    p.set(x - 3, y + 2, HELION_TOOL_H);
    p.set(x - 2, y + 1, HELION_TOOL_H);
    p.set(x + 2, y - 1, HELION_TOOL_H);
    p.set(x + 3, y - 2, HELION_TOOL_D);
  };
  const paintBuildFoundation = (x: number, y: number): void => {
    // Ground-level three-row rim only: transparent space stays inside and around it.
    p.fillRect(x - 2, y, 5, 1, limeHi);
    p.set(x - 4, y + 1, limeHi);
    p.fillRect(x - 3, y + 1, 7, 1, lime);
    p.set(x + 4, y + 1, limeD);
    p.set(x - 3, y + 2, limeD);
    p.fillRect(x - 2, y + 2, 5, 1, limeD);
    p.set(x + 3, y + 2, limeD);
  };

  if (action === 0) {
    // A full-body follow-through: the upper grip starts at shoulder height,
    // the second hand is lower on the shaft, and the head lands to the right.
    buildHandleStartX = side ? 12 : se ? 11 : 10;
    buildHandleStartY = side ? 18 : se ? 19 : 18;
    buildSupportX = side ? 13 : se ? 12 : 11;
    buildSupportY = side ? 21 : se ? 22 : 21;
    buildPrimaryX = side ? 18 : se ? 19 : 18;
    buildPrimaryY = 28;
    buildUpperShoulderX = side ? 16 : se ? 9 : 9;
    buildUpperShoulderY = side ? 19 : 20;
    buildLowerShoulderX = side ? 18 : se ? 20 : 20;
    buildLowerShoulderY = side ? 21 : 20;
    buildHeadX = side ? 24 : se ? 25 : 24;
    buildHeadY = 37;
    buildFoundationX = side ? 22 : se ? 23 : 22;
    buildFoundationY = 41;

    // Sleeves, two hands, shaft, head, and footing receive one connected outline first.
    wideLine(buildUpperShoulderX, buildUpperShoulderY, buildSupportX, buildSupportY, INK);
    wideLine(buildLowerShoulderX, buildLowerShoulderY, buildPrimaryX, buildPrimaryY, INK);
    wideLine(buildHandleStartX, buildHandleStartY, buildHeadX, buildHeadY, INK);
    dark(buildSupportX - 2, buildSupportY - 1, 5, 5);
    dark(buildPrimaryX - 2, buildPrimaryY - 1, 5, 5);
    linePix(p, buildHeadX - 4, buildHeadY + 3, buildHeadX + 3, buildHeadY - 2, INK);
    linePix(p, buildHeadX - 3, buildHeadY + 3, buildHeadX + 4, buildHeadY - 2, INK);
    dark(buildFoundationX - 2, buildFoundationY, 5, 1);
    dark(buildFoundationX - 5, buildFoundationY + 1, 11, 1);
    dark(buildFoundationX - 3, buildFoundationY + 2, 7, 1);
    p.set(buildHeadX - 5, buildFoundationY - 1, INK);
    p.set(buildHeadX + 5, buildFoundationY - 1, INK);
    paintBuildFoundation(buildFoundationX, buildFoundationY);
  } else if (action === 3) {
    attackHandX = back ? 13 : side ? 17 : se ? 18 : 19;
    attackHeadX = back ? 8 : side ? 23 : se ? 24 : 25;
    attackHeadY = back ? 8 : 7;
    dark(tx + tw - 2, 19 + bob, 5, 9);
    dark(attackHandX - 2, 22, 5, 7);
    wideLine(attackHandX, 25, attackHeadX, attackHeadY, INK);
    dark(attackHeadX - 4, attackHeadY - 3, 9, 7);
  }

  const paintLeg = (x: number, lift: number): void => {
    for (let y = legTop; y < 44 - lift; y++) {
      p.set(x + 1, y, y < 36 ? HELION_PANTS_H : HELION_PANTS);
      p.set(x + 2, y, y < 37 ? HELION_PANTS : HELION_PANTS_D);
      if (legW > 5) p.set(x + 3, y, HELION_PANTS_D);
      if (legW > 5) p.set(x + 4, y, y < 38 ? HELION_PANTS : HELION_PANTS_D);
    }
    p.fillRect(x, 44 - lift, legW, 3, HELION_BOOT_D);
    p.fillRect(x + 1, 44 - lift, legW - 2, 2, HELION_BOOT);
    p.fillRect(x + 1, 44 - lift, Math.max(1, legW - 3), 1, HELION_BOOT_H);
    p.set(x + 2, 46 - lift, HELION_BOOT_D);
    if (side || se || ne) p.set(x + legW, 45 - lift, HELION_BOOT_D);
    else p.set(x - 1, 45 - lift, HELION_BOOT_D);
  };

  paintLeg(leftX, leftLift);
  paintLeg(rightX, rightLift);

  shadeRect(p, tx + 1, 15 + bob, tw - 2, 15, HELION_SHIRT, HELION_SHIRT_H, HELION_SHIRT_D);
  p.fillRect(tx + 2, 19 + bob, 2, 8, HELION_SHIRT_D);
  p.fillRect(tx + tw - 4, 19 + bob, 2, 8, HELION_SHIRT_D);
  p.fillRect(hx - 3, 15 + bob, 3, 2, HELION_SHIRT_H);
  p.fillRect(hx, 15 + bob, 3, 2, HELION_SHIRT_D);
  if (!back) {
    for (let y = 18 + bob; y < 28 + bob; y += 3) p.set(hx, y, HELION_SHIRT_H);
  } else {
    p.fillRect(hx, 17 + bob, 1, 11, HELION_SHIRT_D);
    p.set(hx - 2, 19 + bob, HELION_SHIRT_H);
  }

  const beltY = 29 + bob;
  p.fillRect(tx, beltY, tw, 3, HELION_BELT_D);
  p.fillRect(tx + 1, beltY, tw - 2, 2, HELION_BELT);
  p.fillRect(tx - 2, beltY + 1, 4, 4, HELION_BELT_D);
  p.fillRect(tx - 1, beltY + 1, 2, 3, HELION_BELT_H);
  p.fillRect(tx + tw - 2, beltY + 1, 4, 4, HELION_BELT_D);
  p.fillRect(tx + tw - 1, beltY + 1, 2, 3, HELION_BELT_H);
  const buckleX = hx - 2;
  p.fillRect(buckleX, beltY, 5, 4, HELION_BELT_D);
  p.fillRect(buckleX + 1, beltY, 3, 1, limeHi);
  p.fillRect(buckleX, beltY + 1, 1, 2, limeHi);
  p.fillRect(buckleX + 4, beltY + 1, 1, 2, limeD);
  p.fillRect(buckleX + 1, beltY + 3, 3, 1, limeD);
  p.set(buckleX + 2, beltY + 1, lime);

  const paintHead = (): void => {
    if (back) {
      shadeRect(p, hx - 3, 9 + bob, 7, 7, HELION_BEARD, HELION_BEARD_H, HELION_BEARD);
      p.fillRect(hx - 2, 11 + bob, 5, 5, HELION_BEARD_D);
    } else if (side) {
      p.fillRect(hx - 2, 9 + bob, 6, 5, HELION_SKIN);
      p.fillRect(hx + 1, 9 + bob, 3, 3, HELION_SKIN_H);
      p.set(hx + 4, 11 + bob, HELION_SKIN_H);
      p.fillRect(hx - 1, 13 + bob, 6, 4, HELION_BEARD);
      p.set(hx, 13 + bob, HELION_BEARD_H);
      p.set(hx + 2, 11 + bob, INK);
    } else {
      p.fillRect(hx - 3, 9 + bob, 7, 5, HELION_SKIN);
      p.fillRect(hx - 2, 9 + bob, 4, 2, HELION_SKIN_H);
      p.set(hx + 3, 11 + bob, HELION_SKIN_H);
      p.fillRect(hx - 2, 13 + bob, 6, 4, HELION_BEARD);
      p.fillRect(hx - 1, 13 + bob, 3, 1, HELION_BEARD_H);
      p.set(hx - 2, 11 + bob, INK);
      p.set(hx + 2, 11 + bob, INK);
    }

    for (let y = 5 + bob; y <= 9 + bob; y++) {
      const half = y <= 6 + bob ? 3 : y <= 7 + bob ? 5 : 6;
      for (let dx = -half; dx <= half; dx++) {
        p.set(hx + dx, y, y < 7 + bob ? limeHi : y > 8 + bob ? limeD : lime);
      }
    }
    p.fillRect(hx - 6, 10 + bob, 13, 2, limeD);
    p.fillRect(hx - 5, 10 + bob, 11, 1, lime);
    p.fillRect(hx - 2, 5 + bob, 4, 1, limeHi);
    if (back) p.fillRect(hx, 6 + bob, 2, 5, limeD);
    if (!back) {
      if (side) {
        p.fillRect(hx - 2, 11 + bob, 6, 3, HELION_SKIN);
        p.fillRect(hx + 1, 11 + bob, 3, 1, HELION_SKIN_H);
        p.set(hx + 4, 12 + bob, HELION_SKIN_H);
        p.set(hx + 2, 12 + bob, INK);
        p.fillRect(hx - 1, 14 + bob, 6, 3, HELION_BEARD);
        p.set(hx, 14 + bob, HELION_BEARD_H);
      } else {
        p.fillRect(hx - 3, 11 + bob, 7, 3, HELION_SKIN);
        p.fillRect(hx - 2, 11 + bob, 4, 1, HELION_SKIN_H);
        p.set(hx - 2, 12 + bob, INK);
        p.set(hx + 2, 12 + bob, INK);
        p.fillRect(hx - 2, 14 + bob, 6, 3, HELION_BEARD);
        p.fillRect(hx - 1, 14 + bob, 3, 1, HELION_BEARD_H);
      }
    }
    const lampX = back ? hx + 1 : hx + 3;
    p.fillRect(lampX, 8 + bob, 2, 2, MAG);
  };

  paintHead();

  const paintOpenHand = (x: number, y: number, shadow: boolean): void => {
    p.fillRect(x, y, 3, 4, HELION_SKIN);
    p.set(x + 1, y - 1, HELION_SKIN_H);
    p.set(x, y, shadow ? HELION_SKIN_D : HELION_SKIN_H);
    p.set(x + 2, y, HELION_SKIN_H);
    p.set(x - 1, y + 1, shadow ? HELION_SKIN_D : HELION_SKIN);
    p.set(x + 3, y + 2, HELION_SKIN_D);
    p.set(x + 1, y + 4, shadow ? HELION_SKIN_D : HELION_SKIN);
  };
  const paintGrip = (x: number, y: number, shadow: boolean): void => {
    p.fillRect(x, y, 3, 3, shadow ? HELION_SKIN_D : HELION_SKIN);
    p.set(x + 1, y - 1, HELION_SKIN_H);
    p.set(x + 2, y + 2, HELION_SKIN_D);
  };
  const paintBracer = (x: number, y: number): void => {
    p.fillRect(x, y, 5, 4, INK);
    p.fillRect(x + 1, y, 3, 3, limeD);
    p.fillRect(x + 1, y, 2, 1, limeHi);
    p.set(x + 3, y + 1, lime);
    p.set(x + 2, y + 3, limeD);
  };

  if (action < 0) {
    if (front || back) {
      p.fillRect(tx - 1, 20 + bob, 3, 7, HELION_SHIRT_H);
      p.fillRect(tx - 2, 26 + bob, 3, 4, HELION_SKIN_D);
      paintBracer(tx - 2, 27 + bob);
      paintOpenHand(tx - 4, 29 + bob, true);
      p.fillRect(tx + tw - 2, 20 + bob, 3, 7, HELION_SHIRT);
      p.fillRect(tx + tw - 1, 26 + bob, 3, 4, HELION_SKIN_D);
      paintBracer(tx + tw - 2, 27 + bob);
      paintOpenHand(tx + tw, 29 + bob, false);
    } else if (side) {
      p.fillRect(tx - 1, 20 + bob, 3, 7, HELION_SHIRT_D);
      p.fillRect(tx - 3, 26 + bob, 3, 4, HELION_SKIN_D);
      paintBracer(tx - 3, 27 + bob);
      paintOpenHand(tx - 4, 29 + bob, true);
      p.fillRect(tx + tw - 2, 20 + bob, 3, 8, HELION_SHIRT_H);
      p.fillRect(tx + tw, 27 + bob, 3, 4, HELION_SKIN);
      paintBracer(tx + tw, 28 + bob);
      paintOpenHand(tx + tw, 30 + bob, false);
    } else {
      p.fillRect(tx - 1, 20 + bob, 3, 7, HELION_SHIRT_H);
      p.fillRect(tx - 2, 26 + bob, 3, 4, HELION_SKIN_D);
      paintBracer(tx - 2, 27 + bob);
      paintOpenHand(tx - 3, 29 + bob, true);
      p.fillRect(tx + tw - 2, 20 + bob, 3, 7, HELION_SHIRT);
      p.fillRect(tx + tw - 1, 26 + bob, 3, 4, HELION_SKIN);
      paintBracer(tx + tw - 2, 27 + bob);
      paintOpenHand(tx + tw, 29 + bob, false);
    }
  } else if (action === 1 && crate) {
    shadeRect(p, crate.x + 1, crate.y + 1, crate.w - 2, crate.h - 2, HELION_CRATE, HELION_CRATE_H, HELION_CRATE_D);
    p.fillRect(crate.x + 1, crate.y + 3, crate.w - 2, 2, HELION_CRATE_H);
    p.fillRect(crate.x + 1, crate.y + crate.h - 3, crate.w - 2, 2, HELION_CRATE_D);
    p.fillRect(crate.x + 3, crate.y + 1, 2, crate.h - 2, HELION_CRATE_D);
    p.fillRect(crate.x + crate.w - 5, crate.y + 1, 2, crate.h - 2, HELION_CRATE_D);
    const produceY = crate.y - 3;
    p.fillRect(crate.x + 3, produceY, 4, 4, limeD);
    p.fillRect(crate.x + 4, produceY - 1, 2, 2, limeHi);
    p.circ(crate.x + 9, produceY, 2, HELION_FRUIT);
    p.set(crate.x + 8, produceY - 1, HELION_FRUIT);
    p.fillRect(crate.x + 11, produceY + 1, 4, 3, SOL);
    p.set(crate.x + 12, produceY, SOL_H);
    p.fillRect(crate.x + 15, produceY - 2, 3, 5, lime);
    p.set(crate.x + 16, produceY - 3, limeHi);
    if (front || back) {
      p.fillRect(crate.x - 2, crate.y - 1, 3, 7, HELION_SHIRT_H);
      p.fillRect(crate.x + crate.w - 1, crate.y - 1, 3, 7, HELION_SHIRT);
      paintBracer(crate.x - 2, crate.y + 3);
      paintBracer(crate.x + crate.w - 1, crate.y + 3);
      paintGrip(crate.x - 1, crate.y + 4, true);
      paintGrip(crate.x + crate.w - 1, crate.y + 4, false);
    } else {
      p.fillRect(crate.x - 2, crate.y - 1, 3, 7, HELION_SHIRT_D);
      p.fillRect(crate.x + crate.w - 1, crate.y - 1, 3, 7, HELION_SHIRT_H);
      paintBracer(crate.x - 2, crate.y + 3);
      paintBracer(crate.x + crate.w - 1, crate.y + 3);
      paintGrip(crate.x - 1, crate.y + 4, true);
      paintGrip(crate.x + crate.w - 1, crate.y + 4, false);
    }
  } else if (action === 2) {
    const crystal = (x: number, y: number, w: number, h: number): void => {
      p.fillRect(x, y + 1, w, h - 1, HELION_CRYSTAL_D);
      p.fillRect(x + 1, y, w - 2, h - 2, HELION_CRYSTAL);
      p.fillRect(x + 1, y, w - 2, 2, HELION_CRYSTAL_H);
      p.set(x + w - 1, y + 2, HELION_CRYSTAL_H);
    };
    crystal(crystalX, crystalY + 3, 5, 9);
    crystal(crystalX + 4, crystalY, 6, 12);
    crystal(crystalX + 9, crystalY + 4, 5, 8);
    p.fillRect(crystalX - 2, crystalY + 7, 3, 6, HELION_SHIRT_D);
    p.fillRect(crystalX + 13, crystalY + 6, 3, 7, HELION_SHIRT_H);
    paintBracer(crystalX - 2, crystalY + 8);
    paintBracer(crystalX + 12, crystalY + 7);
    paintGrip(crystalX - 1, crystalY + 9, true);
    paintGrip(crystalX + 11, crystalY + 8, false);
  } else if (action === 0) {
    // Paint the shaft first, then put two separated gripping hands over it so the
    // diagonal remains continuous without turning either hand into a tool block.
    wideLine(buildHandleStartX, buildHandleStartY, buildHeadX, buildHeadY, HELION_WOOD_D);
    linePix(p, buildHandleStartX, buildHandleStartY, buildHeadX, buildHeadY, HELION_WOOD);
    p.set(buildHandleStartX, buildHandleStartY, HELION_WOOD_H);
    wideLine(buildUpperShoulderX, buildUpperShoulderY, buildSupportX, buildSupportY, HELION_SHIRT_D);
    linePix(p, buildUpperShoulderX, buildUpperShoulderY, buildSupportX, buildSupportY, HELION_SHIRT_H);
    wideLine(buildLowerShoulderX, buildLowerShoulderY, buildPrimaryX, buildPrimaryY, HELION_SHIRT_D);
    linePix(p, buildLowerShoulderX, buildLowerShoulderY, buildPrimaryX, buildPrimaryY, HELION_SHIRT);
    paintBracer(buildSupportX - 2, buildSupportY - 1);
    paintGrip(buildSupportX - 1, buildSupportY, true);
    paintBracer(buildPrimaryX - 2, buildPrimaryY - 1);
    paintGrip(buildPrimaryX - 1, buildPrimaryY, false);
    p.set(buildPrimaryX, buildPrimaryY, HELION_WOOD_H);
    paintBuildMalletHead(buildHeadX, buildHeadY);
    // A short follow-through arc and a few impact pixels make the contact point explicit.
    p.set(buildHeadX + 3, buildHeadY - 5, HELION_TOOL_H);
    p.set(buildHeadX + 5, buildHeadY - 4, limeHi);
    p.set(buildHeadX - 5, buildFoundationY - 1, SOL_H);
    p.set(buildHeadX - 3, buildFoundationY - 3, limeHi);
    p.set(buildHeadX + 4, buildFoundationY - 2, SOL_H);
  } else if (action === 3) {
    p.fillRect(tx + tw - 2, 20 + bob, 3, 6, HELION_SHIRT_H);
    paintBracer(attackHandX - 2, 22);
    p.fillRect(attackHandX - 2, 22, 4, 4, HELION_SKIN);
    p.set(attackHandX - 1, 22, HELION_SKIN_H);
    wideLine(attackHandX, 25, attackHeadX, attackHeadY, HELION_WOOD_D);
    linePix(p, attackHandX, 25, attackHeadX, attackHeadY, HELION_WOOD);
    p.set(attackHandX, 25, HELION_WOOD_H);
    paintMalletHead(attackHeadX, attackHeadY);
  }

  strokeOutline(p, civInk(0));
  return p;
}

/** Helion Build — a braced, two-handed mallet strike at a single shallow rim. */
function drawHelionBuildVariant(dir: number): Pix {
  const p = Pix.alloc(WORKER8_W, WORKER8_H);
  const side = dir === 0;
  const back = dir === 2;
  const se = dir === 7;
  const { md: lime, hi: limeHi, dk: limeD } = civPal(0);

  const dark = (x: number, y: number, w: number, h: number): void => p.fillRect(x, y, w, h, INK);
  const wideLine = (x0: number, y0: number, x1: number, y1: number, c: Rgba): void => {
    linePix(p, x0, y0, x1, y1, c);
    linePix(p, x0 + 1, y0, x1 + 1, y1, c);
  };

  // The lower body stays planted while the torso leans toward the blow.
  const torsoX = 4;
  const torsoW = side ? 14 : 16;
  const hx = side ? 11 : se ? 13 : 14;
  const legW = side ? 5 : 6;
  const leftLeg = side ? 6 : se ? 7 : 8;
  const rightLeg = side ? 12 : se ? 14 : 15;
  const torsoBand = (y: number): readonly [number, number] => {
    const lean = y < 20 ? 0 : y < 25 ? 2 : 3;
    const x = torsoX + lean;
    const w = y < 17 ? torsoW - 2 : y < 25 ? torsoW : torsoW - 1;
    return [x, w];
  };

  // The shaft and hands form one open diagonal, with a real gap between grips.
  const shaftStartX = side ? 14 : se ? 17 : 18;
  const shaftStartY = side ? 14 : 15;
  const upperShoulderX = side ? 16 : se ? 19 : 20;
  const upperHandX = side ? 19 : se ? 21 : 21;
  const upperHandY = 23;
  const lowerShoulderX = side ? 18 : se ? 20 : 21;
  const lowerHandX = side ? 22 : se ? 23 : 24;
  const lowerHandY = 30;
  const malletX = 24;
  const malletY = 39;
  const contactX = malletX - 5;
  const footingY = 44;
  const footingX = contactX;

  const paintMalletHead = (x: number, y: number): void => {
    // A broad transverse bar, perpendicular to the down-right shaft. The two
    // squared end caps are deliberately blunt so this cannot become a pick.
    fillQuad(p, x - 5, y + 2, x - 3, y + 5, x + 5, y - 1, x + 3, y - 4, INK);
    p.fillRect(x - 5, y + 1, 3, 4, INK);
    p.fillRect(x + 3, y - 4, 3, 4, INK);
    fillQuad(p, x - 4, y + 2, x - 3, y + 4, x + 4, y - 2, x + 3, y - 3, HELION_TOOL_D);
    linePix(p, x - 3, y + 2, x + 3, y - 3, HELION_TOOL);
    linePix(p, x - 3, y + 1, x + 3, y - 4, HELION_TOOL_H);
    p.fillRect(x - 4, y + 2, 2, 3, HELION_TOOL_D);
    p.fillRect(x + 3, y - 4, 3, 2, HELION_TOOL_D);
    p.set(x - 4, y + 2, HELION_TOOL_H);
    p.set(x + 4, y - 3, HELION_TOOL_H);
    p.fillRect(x - 5, y + 2, 2, 3, HELION_TOOL_H);
    p.fillRect(x + 4, y - 4, 2, 3, HELION_TOOL_H);
    p.set(x - 5, y + 4, HELION_TOOL_D);
    p.set(x + 5, y - 4, HELION_TOOL_D);
  };

  const paintFoundation = (x: number, y: number): void => {
    // Three authored rows: top and bottom rims with an empty middle, not a block.
    p.fillRect(x - 3, y, 7, 1, limeHi);
    p.set(x - 4, y + 1, limeD);
    p.set(x - 3, y + 1, lime);
    p.set(x + 3, y + 1, lime);
    p.set(x + 4, y + 1, limeD);
    p.fillRect(x - 4, y + 2, 9, 1, limeD);
    p.set(x - 2, y + 2, lime);
    p.set(x + 2, y + 2, lime);
  };

  const paintBracer = (x: number, y: number): void => {
    p.fillRect(x, y, 5, 4, INK);
    p.fillRect(x + 1, y, 3, 3, limeD);
    p.fillRect(x + 1, y, 2, 1, limeHi);
    p.set(x + 3, y + 1, lime);
    p.set(x + 2, y + 3, limeD);
  };
  const paintGrip = (x: number, y: number, shadow: boolean): void => {
    p.fillRect(x, y, 3, 3, shadow ? HELION_SKIN_D : HELION_SKIN);
    p.set(x + 1, y - 1, HELION_SKIN_H);
    p.set(x + 2, y + 2, HELION_SKIN_D);
  };

  // Full silhouette first: planted legs, leaning torso, both arms, long shaft,
  // transverse head, and the one ground contact are all connected before fill.
  for (let y = 16; y < 30; y++) {
    const [x, w] = torsoBand(y);
    dark(x, y, w, 1);
  }
  dark(torsoX + 3, 30, torsoW - 4, 4);
  for (let y = 30; y < 44; y++) {
    const lx = leftLeg + (y >= 37 ? -1 : 0);
    const rx = rightLeg + (y >= 38 ? 1 : 0);
    dark(lx, y, legW, 1);
    dark(rx, y, legW, 1);
  }
  dark(leftLeg - 1, 43, legW + 1, 5);
  dark(rightLeg + 1, 43, legW + 1, 5);

  dark(hx - 4, 8, 9, 9);
  dark(hx - 2, 13, 5, 6);
  dark(hx - 5, 7, 11, 5);
  dark(hx - 4, 5, 8, 4);
  dark(hx - 7, 10, 15, 2);

  wideLine(upperShoulderX, 17, upperHandX, upperHandY, INK);
  wideLine(lowerShoulderX, 23, lowerHandX, lowerHandY, INK);
  dark(upperHandX - 2, upperHandY - 2, 5, 5);
  dark(lowerHandX - 2, lowerHandY - 2, 5, 5);
  wideLine(shaftStartX, shaftStartY, malletX, malletY, INK);
  paintMalletHead(malletX, malletY);

  // The footing is a thin rim and the mallet face meets it at one pixel.
  p.fillRect(footingX - 3, footingY, 7, 1, INK);
  p.set(footingX - 4, footingY + 1, INK);
  p.set(footingX + 4, footingY + 1, INK);
  p.fillRect(footingX - 4, footingY + 2, 9, 1, INK);

  const paintLeg = (base: number, frontLeg: boolean): void => {
    for (let y = 30; y < 44; y++) {
      const x = base + (frontLeg ? (y >= 38 ? 1 : 0) : y >= 37 ? -1 : 0);
      p.set(x + 1, y, y < 36 ? HELION_PANTS_H : HELION_PANTS);
      p.set(x + 2, y, y < 37 ? HELION_PANTS : HELION_PANTS_D);
      if (legW > 5) p.set(x + 3, y, HELION_PANTS_D);
      if (legW > 5) p.set(x + 4, y, y < 38 ? HELION_PANTS : HELION_PANTS_D);
    }
    const footX = base + (frontLeg ? 1 : -1);
    p.fillRect(footX, 44, legW + 1, 4, HELION_BOOT_D);
    p.fillRect(footX + 1, 44, legW - 1, 2, HELION_BOOT);
    p.fillRect(footX + 1, 44, Math.max(1, legW - 2), 1, HELION_BOOT_H);
    p.set(footX + 2, 47, HELION_BOOT_D);
  };
  paintLeg(leftLeg, false);
  paintLeg(rightLeg, true);

  for (let y = 16; y < 30; y++) {
    const [x, w] = torsoBand(y);
    for (let xx = 0; xx < w; xx++) {
      const px = x + xx;
      const c = px < x + w * 0.4 && y < 21 ? HELION_SHIRT_H : px > x + w * 0.62 || y > 26 ? HELION_SHIRT_D : HELION_SHIRT;
      p.set(px, y, c);
    }
  }
  p.fillRect(torsoX + 3, 19, 2, 8, HELION_SHIRT_D);
  p.fillRect(torsoX + torsoW - 4, 19, 2, 8, HELION_SHIRT_D);
  for (let y = 18; y < 28; y += 3) p.set(torsoX + 7, y, HELION_SHIRT_H);

  const beltY = 29;
  const beltX = torsoX + 3;
  const beltW = torsoW - 2;
  p.fillRect(beltX, beltY, beltW, 3, HELION_BELT_D);
  p.fillRect(beltX + 1, beltY, beltW - 2, 2, HELION_BELT);
  p.fillRect(beltX - 2, beltY + 1, 4, 4, HELION_BELT_D);
  p.fillRect(beltX - 1, beltY + 1, 2, 3, HELION_BELT_H);
  p.fillRect(beltX + beltW - 2, beltY + 1, 4, 4, HELION_BELT_D);
  p.fillRect(beltX + beltW - 1, beltY + 1, 2, 3, HELION_BELT_H);
  const buckleX = hx - 2;
  p.fillRect(buckleX, beltY, 5, 4, HELION_BELT_D);
  p.fillRect(buckleX + 1, beltY, 3, 1, limeHi);
  p.set(buckleX, beltY + 1, limeHi);
  p.set(buckleX + 4, beltY + 1, limeD);
  p.fillRect(buckleX + 1, beltY + 3, 3, 1, limeD);
  p.set(buckleX + 2, beltY + 1, lime);

  const paintHead = (): void => {
    if (back) {
      shadeRect(p, hx - 3, 9, 7, 7, HELION_BEARD, HELION_BEARD_H, HELION_BEARD);
      p.fillRect(hx - 2, 11, 5, 5, HELION_BEARD_D);
    } else if (side) {
      p.fillRect(hx - 2, 9, 6, 5, HELION_SKIN);
      p.fillRect(hx + 1, 9, 3, 3, HELION_SKIN_H);
      p.set(hx + 4, 11, HELION_SKIN_H);
      p.fillRect(hx - 1, 13, 6, 4, HELION_BEARD);
      p.set(hx, 13, HELION_BEARD_H);
      p.set(hx + 2, 11, INK);
    } else {
      p.fillRect(hx - 3, 9, 7, 5, HELION_SKIN);
      p.fillRect(hx - 2, 9, 4, 2, HELION_SKIN_H);
      p.set(hx + 3, 11, HELION_SKIN_H);
      p.fillRect(hx - 2, 13, 6, 4, HELION_BEARD);
      p.fillRect(hx - 1, 13, 3, 1, HELION_BEARD_H);
      p.set(hx - 2, 11, INK);
      p.set(hx + 2, 11, INK);
    }

    for (let y = 5; y <= 9; y++) {
      const half = y <= 6 ? 3 : y <= 7 ? 5 : 6;
      for (let dx = -half; dx <= half; dx++) p.set(hx + dx, y, y < 7 ? limeHi : y > 8 ? limeD : lime);
    }
    p.fillRect(hx - 6, 10, 13, 2, limeD);
    p.fillRect(hx - 5, 10, 11, 1, lime);
    p.fillRect(hx - 2, 5, 4, 1, limeHi);
    if (back) p.fillRect(hx, 6, 2, 5, limeD);
    if (!back) {
      if (side) {
        p.fillRect(hx - 2, 11, 6, 3, HELION_SKIN);
        p.fillRect(hx + 1, 11, 3, 1, HELION_SKIN_H);
        p.set(hx + 4, 12, HELION_SKIN_H);
        p.set(hx + 2, 12, INK);
        p.fillRect(hx - 1, 14, 6, 3, HELION_BEARD);
        p.set(hx, 14, HELION_BEARD_H);
      } else {
        p.fillRect(hx - 3, 11, 7, 3, HELION_SKIN);
        p.fillRect(hx - 2, 11, 4, 1, HELION_SKIN_H);
        p.set(hx - 2, 12, INK);
        p.set(hx + 2, 12, INK);
        p.fillRect(hx - 2, 14, 6, 3, HELION_BEARD);
        p.fillRect(hx - 1, 14, 3, 1, HELION_BEARD_H);
      }
    }
    const lampX = back ? hx + 1 : hx + 3;
    p.fillRect(lampX, 8, 2, 2, MAG);
  };
  paintHead();

  // Shaft is visible across the open space, then each separated hand wraps it.
  wideLine(shaftStartX, shaftStartY, malletX, malletY, HELION_WOOD_D);
  linePix(p, shaftStartX, shaftStartY, malletX, malletY, HELION_WOOD);
  p.set(shaftStartX, shaftStartY, HELION_WOOD_H);
  wideLine(upperShoulderX, 17, upperHandX, upperHandY, HELION_SHIRT_D);
  linePix(p, upperShoulderX, 17, upperHandX, upperHandY, HELION_SHIRT_H);
  wideLine(lowerShoulderX, 23, lowerHandX, lowerHandY, HELION_SHIRT_D);
  linePix(p, lowerShoulderX, 23, lowerHandX, lowerHandY, HELION_SHIRT);
  paintBracer(upperHandX - 2, upperHandY - 1);
  paintGrip(upperHandX - 1, upperHandY, true);
  paintBracer(lowerHandX - 2, lowerHandY - 1);
  paintGrip(lowerHandX - 1, lowerHandY, false);
  p.set(lowerHandX, lowerHandY, HELION_WOOD_H);

  paintMalletHead(malletX, malletY);
  p.fillRect(malletX - 1, malletY - 1, 2, 3, HELION_WOOD_D);
  p.set(malletX, malletY, HELION_WOOD_H);
  paintFoundation(footingX, footingY);
  p.set(contactX, footingY - 1, HELION_TOOL_H);
  p.set(contactX - 2, footingY - 2, SOL_H);
  p.set(contactX + 2, footingY - 1, limeHi);
  p.set(contactX + 4, footingY - 3, SOL_H);

  // A broken, outlined arc carries the force of the follow-through above the head.
  linePix(p, malletX - 5, malletY - 8, malletX - 2, malletY - 11, INK);
  linePix(p, malletX - 4, malletY - 8, malletX - 1, malletY - 10, limeHi);
  linePix(p, malletX + 1, malletY - 11, malletX + 4, malletY - 10, INK);
  linePix(p, malletX + 1, malletY - 11, malletX + 3, malletY - 10, HELION_TOOL_H);

  strokeOutline(p, civInk(0));
  return p;
}

function drawHelionWorker(dir: number, walk: number): Pix {
  return drawHelionVariant(dir, walk > 0, -1);
}

function drawHelionAction(dir: number, action: number): Pix {
  if (action === 0) return drawHelionBuildVariant(dir);
  return drawHelionVariant(dir, false, action as HelionAction);
}

function drawHelionAction8Dir(dir: number, action: number): Pix {
  const d = ((dir | 0) + 8) % 8;
  if (d === 3) return drawHelionAction(1, action).flipX();
  if (d === 4) return drawHelionAction(0, action).flipX();
  if (d === 5) return drawHelionAction(7, action).flipX();
  return drawHelionAction(d, action);
}

/** Steal from Starhaven sheets: backpack + tool, hooded/hatted 4-head body, cloth+metal+one glow. */
function drawWorkerAuth(civ: number, dir: number, walk: number): Pix {
  if (civ < 0.5) return drawHelionWorker(dir, walk);
  const p = Pix.alloc(WORKER8_W, WORKER8_H);
  const { md, hi, dk } = civPal(civ);
  const side = dir === 0;
  const back = dir === 2;
  const front = dir === 6;
  const se = dir === 7;
  const ne = dir === 1;
  const behind = back || ne;
  const cx = side ? 13 : 16;
  const bounce = walk ? 1 : 0;
  const lLift = walk ? 2 : 0;
  const rLift = walk ? 0 : 0;
  let lX = side ? cx - 4 : cx - 6;
  let rX = side ? cx + 1 : cx + 2;
  if (walk) {
    lX += side ? 2 : 1;
    rX -= 1;
  }
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);
  const metal = civ < 1.5 ? CRY_H : VOID_H;
  const metalD = civ < 1.5 ? CRY_D : VOID_D;

  const fillLeg = (x: number, top: number, w: number, lift: number) => {
    const y0 = top - lift;
    dark(x, y0, w, 48 - y0);
    for (let y = top; y < 45 - lift; y++) {
      for (let i = 1; i < w - 1; i++) {
        p.set(x + i, y, y < top + 5 ? (i === 1 ? hi : md) : dk);
      }
    }
    p.fillRect(x, 45 - lift, w, 2, dk);
    p.fillRect(x - 1, 46 - lift, w + 1, 1, dk);
  };

  const straps = (sx: number, sy: number) => {
    p.set(sx - 3, sy, metalD);
    p.set(sx - 3, sy + 1, metal);
    p.set(sx + 3, sy, metalD);
    p.set(sx + 3, sy + 1, metal);
  };

  if (civ < 1.5) {
    // Kryos — Gravemark Stonemason: squat diamond cowl, ice-block pack, mallet.
    lX -= 1;
    rX += 1;
    const legTop = 33;
    fillLeg(lX, legTop, 7, lLift);
    fillLeg(rX, legTop, 7, rLift);
    dark(cx - 8, 17, 17, 18);
    dark(cx - 6, 7, 13, 12);
    const packX = behind || side ? cx - 10 : cx - 7;
    const packY = 16 + bounce;
    dark(packX, packY, behind || side ? 15 : 4, 14);
    if (front) dark(cx + 6, packY, 4, 14);
    const malX = behind ? cx - 2 : Math.min(27, cx + (side || se ? 10 : 8));
    const malY = 15;
    dark(malX, malY, 2, 18);
    dark(malX - 2, malY, 8, 6);
    if (front) {
      dark(cx - 10, 20, 4, 8);
      dark(cx + 6, 20, 5, 8);
    } else dark(cx + 5, 20, 5, 6);
    shadeRect(p, cx - 7, 18, 15, 16, md, hi, dk);
    for (let y = 31; y < 42; y++) {
      const flare = 1 + (((y - 31) / 3) | 0);
      p.set(cx - 8 - flare, y, dk);
      p.set(cx - 7 - flare, y, md);
      p.set(cx + 7 + flare, y, dk);
      p.set(cx + 6 + flare, y, md);
    }
    p.fillRect(cx - 7, 30, 15, 2, CRY_D);
    p.fillRect(cx - 5, 30, 11, 1, CRY_H);
    for (let y = 7; y < 19; y++) {
      const half = Math.max(1, 6 - Math.abs(y - 13));
      for (let dx = -half; dx <= half; dx++) {
        p.set(cx + dx, y, y < 11 ? hi : y > 16 ? dk : md);
      }
      p.set(cx - half, y, CRY_H);
      p.set(cx + half, y, CRY_D);
    }
    p.set(cx, 6, WHITE);
    p.fillRect(cx - 2, behind ? 12 : 13, 5, 2, MAG);
    if (behind || side) {
      shadeRect(p, packX + 1, packY + 1, 13, 12, CRY_D, CRY_H, dk);
      p.set(packX + 5, packY + 3, WHITE);
      p.set(packX + 6, packY + 4, CRY_H);
      straps(cx, 18);
    } else {
      shadeRect(p, cx - 8, packY + 1, 3, 11, CRY_D, CRY_H, dk);
      shadeRect(p, cx + 7, packY + 1, 3, 11, CRY_D, CRY_H, dk);
      straps(cx, 20);
    }
    shadeRect(p, malX - 2, malY, 8, 6, CRY_D, WHITE, dk);
    p.set(malX + 2, malY + 2, WHITE);
    for (let y = malY + 6; y < malY + 18; y++) {
      p.set(malX, y, CRY);
      p.set(malX + 1, y, CRY_D);
    }
    if (front) {
      p.fillRect(cx - 9, 21, 3, 6, md);
      p.fillRect(cx + 6, 21, 3, 6, md);
      p.set(cx - 8, 26, SKIN);
      p.set(malX, 22, SKIN);
      p.set(malX + 1, 23, SKIN);
    } else {
      p.fillRect(cx + 5, 21, 3, 4, md);
      p.set(malX, 22, SKIN);
      p.set(malX + 1, 23, SKIN);
    }
  } else {
    // Nihiline — 067B magitech: lean hood, tendril-staff + orb, spore-sac pack.
    const lean = behind ? 0 : 2;
    lX += lean;
    rX += lean;
    const hx = cx + lean;
    fillLeg(lX, 30, 5, lLift);
    fillLeg(rX, 30, 5, rLift);
    dark(hx - 6, 14, 13, 18);
    dark(hx - 5, 3, 11, 13);
    const sacX = behind || side ? hx - 9 : hx - 5;
    const sacY = 15 + bounce;
    if (behind || side) dark(sacX, sacY, 13, 15);
    if (front) dark(hx + 4, sacY, 4, 12);
    const staffX = behind ? hx - 4 : Math.min(26, hx + (side || se ? 9 : 7));
    const staffY = 7;
    dark(staffX, staffY, 2, 28);
    dark(staffX - 1, staffY, 6, 7);
    if (front) {
      dark(hx - 8, 17, 4, 9);
      dark(hx + 5, 17, 4, 8);
    } else dark(hx + 4, 17, 4, 6);
    shadeRect(p, hx - 5, 15, 11, 16, md, hi, dk);
    for (let y = 28; y < 42; y++) {
      const flare = 1 + (((y - 28) / 3) | 0);
      p.set(hx - 6 - flare, y, VOID_D);
      p.set(hx - 5 - flare, y, md);
      p.set(hx + 5 + flare, y, VOID_D);
      p.set(hx + 4 + flare, y, md);
    }
    p.fillRect(hx - 4, 27, 9, 1, VOID_H);
    for (let y = 4; y < 16; y++) {
      const half = y < 7 ? 5 : y < 11 ? 4 : 3;
      for (let dx = -half; dx <= half; dx++) {
        p.set(hx + dx, y, y < 7 ? VOID_D : y < 11 ? md : hi);
      }
    }
    p.fillRect(hx - 2, 8, 5, 5, INK);
    p.fillRect(hx - 2, behind ? 9 : 10, 2, 2, MAG);
    p.fillRect(hx + 1, behind ? 9 : 10, 2, 2, MAG);
    if (behind || side) {
      p.circ(sacX + 6, sacY + 7, 7, INK);
      p.circ(sacX + 6, sacY + 7, 6, VOID);
      p.circ(sacX + 6, sacY + 6, 3, VOID_H);
      p.set(sacX + 5, sacY + 5, WHITE);
    } else {
      p.circ(hx - 6, sacY + 6, 3, VOID);
      p.circ(hx + 6, sacY + 6, 3, VOID);
    }
    p.circ(staffX + (behind ? -3 : 2), staffY + 3, 3, INK);
    p.circ(staffX + (behind ? -3 : 2), staffY + 3, 2, VOID_H);
    p.set(staffX + (behind ? -3 : 2), staffY + 2, WHITE);
    for (let y = staffY + 7; y < staffY + 28; y++) {
      p.set(staffX, y, y < staffY + 14 ? VOID : VOID_D);
      p.set(staffX + 1, y, VOID_D);
    }
    if (front) {
      p.fillRect(hx - 7, 18, 3, 7, md);
      p.fillRect(hx + 5, 18, 3, 6, md);
      p.set(hx - 6, 24, SKIN);
      p.set(staffX, 18, SKIN);
      p.set(staffX + 1, 19, SKIN);
    } else {
      p.fillRect(hx + 4, 18, 3, 5, md);
      p.set(staffX, 18, SKIN);
      p.set(staffX + 1, 19, SKIN);
    }
  }

  strokeOutline(p, civInk(civ));
  return p;
}

export function drawWorker8Dir(civ: number, dir: number, walk: number): Pix {
  const d = ((dir | 0) + 8) % 8;
  const w = walk ? 1 : 0;
  if (d === 3) return drawWorkerAuth(civ, 1, w).flipX();
  if (d === 4) return drawWorkerAuth(civ, 0, w).flipX();
  if (d === 5) return drawWorkerAuth(civ, 7, w).flipX();
  return drawWorkerAuth(civ, d, w);
}

// ── Worker (legacy 32px slot; living workers use 8-dir strip) ───────────────
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
  if (civ < 0.5) return drawHelionScoutPix();
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

/** Helion Tri-Arc Surveyor — a narrow tripod scout with a solar sensor halo. */
function drawHelionScoutPix(): Pix {
  const p = Pix.alloc(32, 32);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // Three articulated legs and broad feet match the board's grounded tripod.
  linePix(p, 10, 22, 4, 29, INK);
  linePix(p, 11, 22, 5, 29, INK);
  linePix(p, 21, 22, 27, 29, INK);
  linePix(p, 20, 22, 26, 29, INK);
  p.fillRect(5, 23, 2, 6, ORE_H);
  p.fillRect(25, 23, 2, 6, ORE);
  p.fillRect(15, 23, 3, 8, INK);
  p.fillRect(16, 24, 1, 7, BONE);
  p.fillRect(3, 29, 5, 2, INK);
  p.fillRect(24, 29, 5, 2, INK);
  p.fillRect(14, 30, 5, 2, INK);
  p.circ(10, 23, 2, ROCK_H);
  p.circ(21, 23, 2, ROCK);

  // Faceted cream body: bright front plane, dark side plane, magenta top plate.
  dark(8, 17, 17, 8);
  fillQuad(p, 9, 19, 16, 15, 23, 18, 16, 24, BONE);
  fillQuad(p, 9, 19, 16, 15, 16, 22, 9, 23, ORE_H);
  fillQuad(p, 16, 15, 23, 18, 22, 24, 16, 24, ROCK);
  fillQuad(p, 16, 16, 21, 18, 19, 21, 15, 20, MAG);
  p.set(20, 18, ORE_H);
  p.fillRect(8, 22, 3, 2, ORE);
  p.circ(11, 21, 2, INK);
  p.circ(11, 21, 1, SOL_H);
  p.set(11, 20, SOL);
  p.circ(16, 15, 2, ROCK_H);
  p.set(16, 14, ORE_H);

  // Triangular sensor frame: gold rails, black solar-cell interior, amber lens.
  for (let y = 4; y <= 12; y++) {
    const half = y < 9 ? y - 3 : 12 - y;
    p.fillRect(16 - half - 1, y, half * 2 + 3, 1, INK);
    if (y >= 6 && y <= 11) p.fillRect(16 - half, y, Math.max(1, half * 2 + 1), 1, ROCK);
  }
  linePix(p, 16, 2, 7, 13, ORE_H);
  linePix(p, 17, 2, 25, 13, ORE);
  linePix(p, 7, 13, 25, 13, ORE_H);
  linePix(p, 7, 14, 25, 14, INK);
  linePix(p, 16, 4, 10, 12, ROCK_H);
  linePix(p, 16, 4, 22, 12, ROCK);
  p.fillRect(14, 2, 5, 2, ORE);
  p.set(16, 2, SOL_H);
  p.circ(16, 8, 2, SOL);
  p.set(16, 7, SOL_H);
  p.set(16, 8, ORE_H);

  // Short mast joins the sensor to the body; the panel stays the team-color key.
  dark(15, 13, 3, 4);
  p.fillRect(16, 13, 1, 4, ORE_H);
  p.set(24, 21, SOL_H);
  p.set(25, 22, MAG);
  return p;
}

/** 128px Helion Tri-Arc Surveyor for close-zoom, source-resolution art. */
function drawHelionScoutHdPix(): Pix {
  const p = Pix.alloc(128, 128);
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);
  const wideLine = (x0: number, y0: number, x1: number, y1: number, c: Rgba, width = 2) => {
    for (let i = 0; i < width; i++) linePix(p, x0 + i, y0 + i, x1 + i, y1 + i, c);
  };

  // Three articulated legs with dark outlines, bronze struts, joint caps, and
  // broad feet. The side legs angle outward while the front leg stays vertical.
  wideLine(37, 83, 26, 99, INK, 5);
  wideLine(39, 85, 28, 100, ORE, 3);
  wideLine(26, 99, 16, 119, INK, 5);
  wideLine(28, 100, 19, 118, ORE_H, 3);
  wideLine(91, 83, 102, 99, INK, 5);
  wideLine(89, 85, 100, 100, ORE_H, 3);
  wideLine(102, 99, 112, 119, INK, 5);
  wideLine(100, 100, 109, 118, ORE, 3);
  wideLine(59, 86, 59, 122, INK, 6);
  wideLine(68, 86, 68, 122, INK, 6);
  p.fillRect(63, 89, 4, 32, BONE);
  p.fillRect(64, 91, 2, 26, WHITE);
  p.fillRect(11, 118, 19, 7, INK);
  p.fillRect(99, 118, 19, 7, INK);
  p.fillRect(56, 121, 16, 6, INK);
  p.fillRect(14, 116, 12, 4, ORE_H);
  p.fillRect(102, 116, 12, 4, ORE);
  p.fillRect(60, 119, 9, 3, BONE);
  p.fillRect(15, 122, 10, 2, ROCK_H);
  p.fillRect(103, 122, 10, 2, ROCK);
  p.fillRect(62, 124, 6, 2, ROCK_H);
  p.circ(37, 84, 7, INK);
  p.circ(37, 84, 4, ROCK_H);
  p.circ(37, 84, 2, ORE_H);
  p.circ(91, 84, 7, INK);
  p.circ(91, 84, 4, ROCK);
  p.circ(91, 84, 2, ORE_H);
  p.circ(26, 100, 6, INK);
  p.circ(26, 100, 3, ORE_H);
  p.circ(102, 100, 6, INK);
  p.circ(102, 100, 3, ORE_H);

  // Faceted chassis: the board's body is nearly as wide as its sensor base.
  // Keep the bright front, bronze left cheek, graphite right cheek, and
  // smaller magenta top plate as separate planes.
  dark(21, 48, 86, 48);
  fillQuad(p, 24, 69, 64, 49, 104, 69, 64, 94, BONE);
  fillQuad(p, 24, 69, 64, 49, 64, 94, 24, 87, ORE_H);
  fillQuad(p, 64, 49, 104, 69, 98, 87, 64, 94, ROCK);
  fillQuad(p, 45, 59, 64, 50, 83, 59, 64, 69, HELION_SCOUT_PANEL);
  fillQuad(p, 51, 60, 64, 56, 77, 60, 64, 65, HELION_SCOUT_PANEL_H);
  p.fillRect(28, 73, 7, 14, ORE);
  p.fillRect(92, 73, 7, 12, ROCK_H);
  p.fillRect(58, 88, 13, 4, WHITE);
  p.fillRect(60, 92, 9, 3, ORE_H);
  p.fillRect(32, 65, 16, 3, WHITE);
  p.fillRect(78, 65, 13, 3, ORE);
  p.fillRect(26, 84, 10, 4, ROCK_H);
  p.fillRect(91, 84, 8, 4, INK);

  // Front survey lens and side service ports add the board's mechanical read.
  p.circ(39, 76, 10, INK);
  p.circ(39, 76, 7, ORE);
  p.circ(39, 75, 4, SOL);
  p.circ(38, 74, 2, SOL_H);
  p.set(37, 72, WHITE);
  p.circ(91, 75, 5, INK);
  p.circ(91, 75, 3, SOL_H);
  p.fillRect(48, 82, 11, 3, ROCK_H);
  p.fillRect(50, 86, 8, 2, ORE);
  p.fillRect(72, 79, 13, 3, ROCK_H);
  p.fillRect(74, 83, 10, 2, ORE_H);
  p.set(79, 77, WHITE);
  p.set(81, 77, WHITE);
  p.circ(64, 50, 6, ROCK_H);
  p.circ(64, 48, 3, ORE_H);

  // Triangular sensor halo. The frame is shorter and the lens smaller than
  // the first pass, matching the reference's body-to-sensor proportions.
  for (let y = 12; y <= 54; y++) {
    const half = Math.max(3, Math.round(((y - 10) / 44) * 43));
    const x0 = 64 - half;
    const width = half * 2 + 1;
    p.fillRect(x0, y, width, 2, INK);
    if (y >= 17 && y <= 50) p.fillRect(x0 + 4, y, Math.max(2, width - 8), 1, ROCK);
  }
  wideLine(62, 7, 19, 55, ORE_H, 3);
  wideLine(65, 7, 109, 55, ORE, 3);
  wideLine(19, 53, 109, 53, ORE_H, 3);
  wideLine(20, 57, 108, 57, INK, 3);
  wideLine(64, 13, 34, 51, ROCK_H, 2);
  wideLine(65, 13, 94, 51, ROCK, 2);
  wideLine(22, 43, 106, 43, ROCK_H, 2);
  p.fillRect(58, 4, 13, 5, ORE);
  p.fillRect(61, 4, 8, 3, ORE_H);
  p.fillRect(63, 3, 3, 2, SOL_H);
  p.fillRect(15, 51, 9, 8, ORE);
  p.fillRect(104, 51, 9, 8, ORE);
  p.fillRect(17, 52, 5, 4, ORE_H);
  p.fillRect(106, 52, 5, 4, ORE_H);
  p.circ(64, 29, 9, ORE);
  p.circ(64, 29, 7, SOL);
  p.circ(64, 28, 4, SOL_H);
  p.circ(62, 26, 2, WHITE);
  p.fillRect(62, 36, 4, 10, ORE_H);

  // Mast and beacon connect the triangle to the chassis without breaking its
  // silhouette. The beacon remains a team-color key; the armour stays magenta.
  dark(59, 50, 10, 20);
  p.fillRect(62, 50, 4, 20, ORE_H);
  p.fillRect(66, 51, 3, 17, ORE);
  p.fillRect(85, 75, 6, 6, SOL_H);
  p.fillRect(89, 79, 6, 6, MAG);
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
const SCOUT_CELL = 128;
const SCOUT_COLS = CIVS * UNIT_FRAMES;

export interface SpriteAtlas {
  canvas: HTMLCanvasElement;
  scoutCanvas: HTMLCanvasElement;
  scoutCell: number;
  scoutCols: number;
  scoutFrames: number;
  scoutWidth: number;
  scoutHeight: number;
  cell: number;
  hallCell: number;
  cols: number;
  unitRows: number;
  buildingRow: number;
  worker8Y: number;
  worker8H: number;
  worker8ActionY: number;
  worker8ActionH: number;
  worker8ActionBase: number;
  worker8ActionRows: number;
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
  const worker8Y = unitRows * ATLAS_CELL + buildingRows * HALL_CELL;
  const worker8ActionY = worker8Y + CIVS * WORKER8_H;
  const height = worker8ActionY + WORKER_ACTION_ROWS * WORKER8_H;
  const width = ATLAS_COLS * ATLAS_CELL;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Scouts use a separate 128px strip. This keeps the existing 32px atlas
  // layout stable for workers and buildings while giving the selected scout
  // enough source pixels to stay crisp when the camera zooms.
  const scoutWidth = SCOUT_COLS * SCOUT_CELL;
  const scoutHeight = SCOUT_CELL;
  const scoutCanvas = document.createElement('canvas');
  scoutCanvas.width = scoutWidth;
  scoutCanvas.height = scoutHeight;
  const scoutCtx = scoutCanvas.getContext('2d')!;
  scoutCtx.imageSmoothingEnabled = false;

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

  const blitScout = (pix: Pix, slot: number) => {
    const col = slot % SCOUT_COLS;
    const img = ctx.createImageData(pix.w, pix.h);
    img.data.set(pix.d);
    const off = document.createElement('canvas');
    off.width = pix.w;
    off.height = pix.h;
    off.getContext('2d')!.putImageData(img, 0, 0);
    scoutCtx.drawImage(off, col * SCOUT_CELL, 0, SCOUT_CELL, SCOUT_CELL);
  };

  const civs: Civ[] = ['vespari', 'aurion', 'voidmarked'];
  for (let kind = 0; kind < UNIT_KINDS; kind++) {
    for (let civ = 0; civ < CIVS; civ++) {
      for (let frame = 0; frame < UNIT_FRAMES; frame++) {
        blitUnit(drawUnitSprite(kind as Kind, civs[civ], frame), slotIndex(kind, civ, frame));
      }
    }
  }

  for (let civ = 0; civ < CIVS; civ++) {
    for (let frame = 0; frame < UNIT_FRAMES; frame++) {
      const pix = civ === 0 && frame < 4
        ? drawHelionScoutHdPix()
        : drawUnitSprite(Kind.Scout, civs[civ], frame);
      blitScout(pix, civ * UNIT_FRAMES + frame);
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

  for (let civ = 0; civ < CIVS; civ++) {
    for (let walk = 0; walk < 2; walk++) {
      for (let dir = 0; dir < 8; dir++) {
        const pix = drawWorker8Dir(civ, dir, walk);
        const col = dir + walk * 8;
        const img = ctx.createImageData(pix.w, pix.h);
        img.data.set(pix.d);
        const off = document.createElement('canvas');
        off.width = pix.w;
        off.height = pix.h;
        off.getContext('2d')!.putImageData(img, 0, 0);
        ctx.drawImage(off, col * ATLAS_CELL, worker8Y + civ * WORKER8_H);
      }
    }
  }

  for (let action = 0; action < WORKER_ACTION_ROWS; action++) {
    for (let dir = 0; dir < 8; dir++) {
      const pix = drawHelionAction8Dir(dir, action);
      const img = ctx.createImageData(pix.w, pix.h);
      img.data.set(pix.d);
      const off = document.createElement('canvas');
      off.width = pix.w;
      off.height = pix.h;
      off.getContext('2d')!.putImageData(img, 0, 0);
      ctx.drawImage(off, dir * ATLAS_CELL, worker8ActionY + action * WORKER8_H);
    }
  }

  return {
    canvas,
    scoutCanvas,
    scoutCell: SCOUT_CELL,
    scoutCols: SCOUT_COLS,
    scoutFrames: UNIT_FRAMES,
    scoutWidth,
    scoutHeight,
    cell: ATLAS_CELL,
    hallCell: HALL_CELL,
    cols: ATLAS_COLS,
    unitRows,
    buildingRow,
    worker8Y,
    worker8H: WORKER8_H,
    worker8ActionY,
    worker8ActionH: WORKER8_H,
    worker8ActionBase: WORKER_ACTION_BASE,
    worker8ActionRows: WORKER_ACTION_ROWS,
    width,
    height,
  };
}

export function atlasSlot(kind: number, civ: number, frame: number): number {
  return slotIndex(kind, civ, Math.min(6, Math.max(0, Math.floor(frame))));
}
