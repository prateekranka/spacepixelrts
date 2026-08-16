import { Kind, type Civ } from '../sim/engine';
import { MAG, PAL, type Rgba } from './palette';

export const CELL = 32;
export const SHEET = 1024;

export type Uv = { u0: number; v0: number; u1: number; v1: number; w: number; h: number };

export interface Atlas {
  canvas: HTMLCanvasElement;
  tex: Uint8ClampedArray;
  uv: Record<string, Uv>;
}

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
  hex(cx: number, cy: number, r: number, c: Rgba): void {
    for (let y = -r; y <= r; y++) {
      const w = r - (Math.abs(y) >> 1);
      for (let x = -w; x <= w; x++) this.set(cx + x, cy + y, c);
    }
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
          (y + 1 < h && opa(x, y + 1))
        )
          this.set(x, y, c);
      }
    }
  }
}

function blit(ctx: CanvasRenderingContext2D, pix: Pix, x: number, y: number): void {
  const img = ctx.createImageData(pix.w, pix.h);
  img.data.set(pix.d);
  ctx.putImageData(img, x, y);
}

function uvAt(x: number, y: number, w: number, h: number): Uv {
  return {
    u0: x / SHEET,
    v0: 1 - (y + h) / SHEET,
    u1: (x + w) / SHEET,
    v1: 1 - y / SHEET,
    w,
    h,
  };
}

function diamondTile(kind: 'void' | 'dust' | 'rock' | 'ore' | 'gas' | 'sol'): Pix {
  const p = Pix.alloc(64, 32);
  const base =
    kind === 'void' ? PAL.void : kind === 'dust' ? PAL.dust : kind === 'rock' ? PAL.rock : PAL.dust;
  const hi =
    kind === 'void' ? PAL.dust : kind === 'dust' ? PAL.dust2 : kind === 'rock' ? PAL.rockH : PAL.dust2;
  for (let y = 0; y < 32; y++) {
    const t = y < 16 ? y : 31 - y;
    const half = t * 2;
    for (let x = 32 - half; x < 32 + half; x++) {
      const edge = x === 32 - half || x === 32 + half - 1 || y === 0 || y === 31;
      p.set(x, y, edge ? PAL.ink : y < 15 ? hi : base);
    }
  }
  if (kind === 'void') {
    for (let i = 0; i < 8; i++) p.set(20 + ((i * 5) % 24), 8 + ((i * 3) % 14), PAL.white);
  }
  if (kind === 'dust') {
    p.set(24, 12, PAL.rock);
    p.set(40, 18, PAL.rock);
    p.set(30, 20, PAL.dust2);
  }
  if (kind === 'rock') {
    p.fill(26, 10, 12, 8, PAL.rockH);
    p.fill(28, 8, 8, 3, PAL.ink);
  }
  if (kind === 'ore') {
    p.circ(32, 16, 5, PAL.ore);
    p.set(30, 14, PAL.oreH);
    p.set(34, 17, PAL.oreH);
  }
  if (kind === 'gas') {
    p.circ(32, 15, 6, PAL.gas);
    p.circ(30, 13, 2, PAL.gasH);
  }
  if (kind === 'sol') {
    p.circ(32, 16, 6, PAL.sol);
    p.circ(32, 16, 2, PAL.solH);
  }
  return p;
}

function helionBody(p: Pix, ox: number, oy: number, bob: number): void {
  p.hex(ox, oy + 1 + bob, 7, PAL.hBron);
  p.hex(ox, oy + bob, 6, PAL.hGold);
  p.hex(ox, oy - 1 + bob, 3, PAL.hBone);
  p.fill(ox - 1, oy - 1 + bob, 3, 2, MAG);
  p.line(ox + 5, oy - 1 + bob, ox + 12, oy - 6 + bob, PAL.hRed);
  p.set(ox + 12, oy - 6 + bob, PAL.white);
  p.fill(ox - 6, oy + 4 + bob, 4, 3, PAL.hBron);
  p.fill(ox + 3, oy + 4 + bob, 4, 3, PAL.hBron);
}

function kryosBody(p: Pix, ox: number, oy: number, bob: number): void {
  p.diam(ox, oy + 2 + bob, 8, PAL.kAbyss);
  p.diam(ox, oy + bob, 6, PAL.kInd);
  p.diam(ox, oy - 1 + bob, 3, PAL.kIce);
  p.fill(ox - 1, oy + bob, 3, 2, MAG);
  p.line(ox, oy - 6 + bob, ox, oy - 12 + bob, PAL.kSil);
  p.set(ox, oy - 12 + bob, PAL.white);
}

function nihBody(p: Pix, ox: number, oy: number, bob: number): void {
  p.circ(ox, oy + 3 + bob, 7, PAL.nBru);
  p.fill(ox - 6, oy - 1 + bob, 13, 10, PAL.nSpore);
  p.circ(ox - 1, oy + bob, 3, PAL.nPale);
  p.fill(ox + 2, oy + bob, 3, 2, MAG);
  p.line(ox - 4, oy - 4 + bob, ox - 9, oy - 9 + bob, PAL.nVir);
  p.line(ox + 4, oy - 3 + bob, ox + 9, oy - 8 + bob, PAL.nVir);
  p.circ(ox - 9, oy - 9 + bob, 1, PAL.nVir);
  p.circ(ox + 9, oy - 8 + bob, 1, PAL.nPale);
}

function drawUnit(civ: Civ, role: string, frame: number): Pix {
  const p = Pix.alloc(CELL, CELL);
  const ox = 16;
  const oy = 18;
  const bob = frame & 1;
  if (civ === 'helion') helionBody(p, ox, oy, bob);
  else if (civ === 'kryos') kryosBody(p, ox, oy, bob);
  else nihBody(p, ox, oy, bob);

  if (role === 'worker') p.fill(ox + 6, oy + 3, 4, 3, PAL.ore);
  else if (role === 'scout') {
    p.fill(ox - 10, oy + 1, 4, 2, PAL.white);
    p.fill(ox + 7, oy + 1, 4, 2, PAL.white);
  } else if (role === 'fighter') {
    p.line(ox + 6, oy - 2, ox + 13, oy - 7, PAL.bone);
  } else if (role === 'siege') p.fill(ox - 5, oy + 6, 12, 5, PAL.rock);
  else if (role === 'lance') {
    p.line(ox + 4, oy - 2, ox + 14, oy - 10, PAL.hRed);
    p.line(ox + 4, oy - 1, ox + 14, oy - 9, PAL.hGold);
  } else if (role === 'titan') {
    p.diam(ox, oy, 11, PAL.kAbyss);
    p.diam(ox, oy, 7, PAL.kIce);
    p.fill(ox - 1, oy, 3, 2, MAG);
  } else if (role === 'rider') {
    p.circ(ox, oy, 8, PAL.nBru);
    p.circ(ox, oy, 5, PAL.nVir);
    p.fill(ox, oy, 3, 2, MAG);
  }
  if (frame === 3) p.circ(ox + 9, oy - 3, 2, PAL.white);
  if (frame === 4) {
    p.fill(0, 0, CELL, CELL, [0, 0, 0, 0]);
    p.circ(ox, oy + 4, 6, PAL.ink);
    p.circ(ox, oy + 3, 3, civ === 'helion' ? PAL.hGold : civ === 'kryos' ? PAL.kIce : PAL.nSpore);
  }
  p.outline();
  return p;
}

function drawNexus(civ: Civ): Pix {
  const p = Pix.alloc(64, 64);
  if (civ === 'helion') {
    p.hex(32, 40, 22, PAL.hBron);
    p.hex(32, 36, 16, PAL.hGold);
    p.hex(32, 26, 10, PAL.hBron);
    p.hex(32, 22, 7, PAL.hBone);
    p.fill(30, 20, 5, 4, MAG);
    p.line(32, 14, 32, 4, PAL.hRed);
    p.set(32, 4, PAL.solH);
  } else if (civ === 'kryos') {
    p.diam(32, 38, 24, PAL.kAbyss);
    p.diam(32, 34, 16, PAL.kInd);
    p.diam(32, 22, 8, PAL.kIce);
    p.fill(30, 20, 5, 4, MAG);
    p.line(32, 12, 32, 2, PAL.white);
    p.line(18, 42, 8, 56, PAL.kSil);
    p.line(46, 42, 56, 56, PAL.kSil);
  } else {
    p.circ(32, 42, 20, PAL.nBru);
    p.circ(32, 36, 16, PAL.nSpore);
    p.circ(22, 28, 8, PAL.nBru);
    p.circ(44, 26, 8, PAL.nSpore);
    p.circ(32, 20, 8, PAL.nVir);
    p.fill(30, 18, 5, 4, MAG);
    p.line(18, 16, 8, 6, PAL.nVir);
    p.line(48, 14, 58, 4, PAL.nPale);
  }
  p.outline();
  return p;
}

function drawHouse(civ: Civ): Pix {
  const p = Pix.alloc(CELL, CELL);
  if (civ === 'helion') {
    p.hex(16, 20, 9, PAL.hBron);
    p.hex(16, 18, 6, PAL.hGold);
    p.fill(15, 16, 3, 2, MAG);
  } else if (civ === 'kryos') {
    p.diam(16, 18, 10, PAL.kAbyss);
    p.diam(16, 17, 6, PAL.kIce);
    p.fill(15, 16, 3, 2, MAG);
  } else {
    p.circ(16, 20, 9, PAL.nBru);
    p.circ(16, 18, 6, PAL.nSpore);
    p.fill(15, 16, 3, 2, MAG);
  }
  p.outline();
  return p;
}

function drawYard(civ: Civ): Pix {
  const p = Pix.alloc(CELL, CELL);
  if (civ === 'helion') {
    p.fill(5, 10, 22, 16, PAL.hBron);
    p.hex(16, 16, 7, PAL.hGold);
    p.fill(15, 14, 3, 3, MAG);
  } else if (civ === 'kryos') {
    p.fill(4, 12, 24, 14, PAL.kAbyss);
    p.diam(16, 16, 8, PAL.kInd);
    p.fill(15, 14, 3, 3, MAG);
  } else {
    p.fill(4, 10, 24, 16, PAL.nBru);
    p.circ(16, 16, 7, PAL.nSpore);
    p.fill(15, 14, 3, 3, MAG);
  }
  p.outline();
  return p;
}

function drawShadow(): Pix {
  const p = Pix.alloc(CELL, CELL);
  p.circ(16, 20, 8, [0, 0, 0, 88]);
  p.circ(16, 20, 5, [0, 0, 0, 120]);
  return p;
}

function drawSel(): Pix {
  const p = Pix.alloc(CELL, CELL);
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2;
    p.set(16 + Math.round(Math.cos(t) * 12), 20 + Math.round(Math.sin(t) * 6), PAL.sel);
  }
  return p;
}

function drawBolt(kind: 'beam' | 'ice' | 'spore' | 'rock'): Pix {
  const p = Pix.alloc(16, 16);
  if (kind === 'beam') {
    p.fill(6, 0, 4, 16, PAL.hGold);
    p.fill(7, 0, 2, 16, PAL.white);
  } else if (kind === 'ice') {
    p.diam(8, 8, 5, PAL.kIce);
    p.set(8, 8, PAL.white);
  } else if (kind === 'spore') {
    p.circ(8, 8, 4, PAL.nSpore);
    p.circ(8, 8, 2, PAL.nVir);
  } else {
    p.circ(8, 8, 3, PAL.ore);
    p.set(8, 8, PAL.oreH);
  }
  return p;
}

function drawHp(): Pix {
  const p = Pix.alloc(16, 4);
  p.fill(0, 0, 16, 4, PAL.ink);
  p.fill(1, 1, 14, 2, PAL.hpG);
  return p;
}

export function buildAtlas(): Atlas {
  const canvas = document.createElement('canvas');
  canvas.width = SHEET;
  canvas.height = SHEET;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.clearRect(0, 0, SHEET, SHEET);
  const uv: Record<string, Uv> = {};
  let cursorX = 0;
  let cursorY = 0;
  let rowH = 32;

  const put = (key: string, pix: Pix) => {
    if (cursorX + pix.w > SHEET) {
      cursorX = 0;
      cursorY += rowH;
      rowH = 32;
    }
    rowH = Math.max(rowH, pix.h);
    blit(ctx, pix, cursorX, cursorY);
    uv[key] = uvAt(cursorX, cursorY, pix.w, pix.h);
    cursorX += pix.w;
  };

  put('tile-void', diamondTile('void'));
  put('tile-dust', diamondTile('dust'));
  put('tile-rock', diamondTile('rock'));
  put('tile-ore', diamondTile('ore'));
  put('tile-gas', diamondTile('gas'));
  put('tile-sol', diamondTile('sol'));
  put('shadow', drawShadow());
  put('sel', drawSel());
  put('bolt-beam', drawBolt('beam'));
  put('bolt-ice', drawBolt('ice'));
  put('bolt-spore', drawBolt('spore'));
  put('bolt-rock', drawBolt('rock'));
  put('hp', drawHp());

  const civs: Civ[] = ['helion', 'kryos', 'nihiline'];
  const roles = ['worker', 'scout', 'fighter', 'siege', 'lance', 'titan', 'rider'] as const;
  for (const civ of civs) {
    for (const role of roles) {
      for (let f = 0; f < 5; f++) put(`${civ}-${role}-${f}`, drawUnit(civ, role, f));
    }
    put(`${civ}-nexus`, drawNexus(civ));
    put(`${civ}-habitat`, drawHouse(civ));
    put(`${civ}-yard`, drawYard(civ));
    put(`${civ}-unique`, drawYard(civ));
  }

  const tex = ctx.getImageData(0, 0, SHEET, SHEET).data;
  return { canvas, tex: new Uint8ClampedArray(tex), uv };
}

export function spriteKey(kind: Kind, civ: Civ, frame: number): string {
  const f = frame | 0;
  switch (kind) {
    case Kind.Worker:
      return `${civ}-worker-${f}`;
    case Kind.Scout:
      return `${civ}-scout-${f}`;
    case Kind.Fighter:
      return `${civ}-fighter-${f}`;
    case Kind.Siege:
      return `${civ}-siege-${f}`;
    case Kind.SolarLance:
      return `${civ}-lance-${f}`;
    case Kind.GlacierTitan:
      return `${civ}-titan-${f}`;
    case Kind.SporeRider:
      return `${civ}-rider-${f}`;
    case Kind.Nexus:
      return `${civ}-nexus`;
    case Kind.Habitat:
      return `${civ}-habitat`;
    case Kind.Yard:
    case Kind.Foundry:
    case Kind.Outpost:
      return `${civ}-yard`;
    case Kind.Sunwell:
    case Kind.CryoBastion:
    case Kind.BloomNest:
      return `${civ}-unique`;
    default:
      return `${civ}-worker-${f}`;
  }
}

export function tileKey(t: number): string {
  switch (t) {
    case 1:
      return 'tile-dust';
    case 2:
      return 'tile-rock';
    case 3:
      return 'tile-ore';
    case 4:
      return 'tile-gas';
    case 5:
      return 'tile-sol';
    default:
      return 'tile-void';
  }
}
