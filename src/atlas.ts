/** P11 / P20–P23 — pixel atlas. Magenta #FF00FF is the team-color key. */

export const CELL = 32;
export const SHEET = 1024;
export const COLS = SHEET / CELL;

export const MAG = [255, 0, 255, 255] as const;

export type Uv = { u0: number; v0: number; u1: number; v1: number; w: number; h: number };

export interface Atlas {
  canvas: HTMLCanvasElement;
  uv: Record<string, Uv>;
}

const PAL = {
  ink: [12, 8, 22, 255],
  void: [10, 8, 20, 255],
  dust: [28, 22, 42, 255],
  rock: [58, 48, 62, 255],
  rockH: [86, 72, 90, 255],
  ore: [198, 154, 72, 255],
  oreH: [240, 214, 120, 255],
  gas: [92, 168, 210, 255],
  gasH: [186, 230, 255, 255],
  sol: [240, 196, 72, 255],
  solH: [255, 236, 170, 255],
  hive: [46, 122, 58, 255],
  hiveH: [168, 230, 96, 255],
  hiveD: [22, 58, 32, 255],
  cry: [78, 186, 214, 255],
  cryH: [210, 244, 255, 255],
  cryD: [28, 72, 96, 255],
  voidC: [72, 42, 140, 255],
  voidH: [186, 140, 255, 255],
  voidD: [28, 14, 48, 255],
  bone: [232, 220, 196, 255],
  blood: [176, 42, 48, 255],
  white: [244, 238, 226, 255],
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
  hex(cx: number, cy: number, r: number, c: Rgba): void {
    for (let y = -r; y <= r; y++) {
      const half = Math.floor((r * 0.87 * (r - Math.abs(y))) / r);
      for (let x = -half; x <= half; x++) this.set(cx + x, cy + y, c);
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

function uvAt(col: number, row: number, w = 1, h = 1): Uv {
  const x = col * CELL;
  const y = row * CELL;
  const pw = w * CELL;
  const ph = h * CELL;
  return {
    u0: x / SHEET,
    v0: 1 - (y + ph) / SHEET,
    u1: (x + pw) / SHEET,
    v1: 1 - y / SHEET,
    w: pw,
    h: ph,
  };
}

function magBanner(p: Pix, x: number, y: number, w: number, h: number): void {
  p.fill(x, y, w, h, MAG);
}

/** Helion Compact — tall hex hull, sail, lance antenna. */
function hiveBody(p: Pix, ox: number, oy: number, frame: number): void {
  const bob = frame & 1;
  const y = oy + bob;
  p.hex(ox, y - 2, 13, PAL.hiveD);
  p.hex(ox, y - 3, 11, PAL.hive);
  p.hex(ox - 1, y - 6, 6, PAL.hiveH);
  magBanner(p, ox - 6, y - 14, 8, 10);
  p.fill(ox - 5, y - 13, 6, 2, PAL.bone);
  p.line(ox - 3, y - 14, ox - 3, y - 20, PAL.ink);
  p.line(ox + 3, y - 14, ox + 3, y - 20, PAL.ink);
  p.circ(ox - 3, y - 20, 2, PAL.hiveH);
  p.circ(ox + 3, y - 20, 2, PAL.hiveH);
  p.fill(ox - 12, y + 1, 6, 5, PAL.hiveD);
  p.fill(ox + 7, y + 1, 6, 5, PAL.hiveD);
  p.fill(ox - 3, y + 7, 8, 4, PAL.hiveD);
}

/** Kryos Conclave — squat diamond, vertical spire, bright core. */
function cryBody(p: Pix, ox: number, oy: number, frame: number): void {
  const bob = frame & 1;
  const y = oy + bob;
  p.diam(ox, y, 13, PAL.cryD);
  p.diam(ox, y - 1, 11, PAL.cry);
  p.diam(ox, y - 3, 7, PAL.cryH);
  magBanner(p, ox - 3, y - 3, 7, 7);
  p.fill(ox - 2, y - 2, 5, 3, PAL.white);
  p.line(ox, y - 9, ox, y - 19, PAL.cryH);
  p.fill(ox - 1, y - 19, 3, 3, PAL.white);
  p.fill(ox - 12, y + 3, 7, 4, PAL.cryD);
  p.fill(ox + 6, y + 3, 7, 4, PAL.cryD);
}

/** Nihiline — asymmetric tendrils, spore sac, no right angles. */
function voidBody(p: Pix, ox: number, oy: number, frame: number): void {
  const bob = frame & 1;
  const y = oy + bob;
  p.fill(ox - 10, y - 3, 18, 16, PAL.voidD);
  p.fill(ox - 8, y - 6, 14, 14, PAL.voidC);
  p.fill(ox + 5, y - 10, 8, 12, PAL.voidD);
  p.circ(ox + 8, y - 7, 5, PAL.voidH);
  p.fill(ox - 14, y + 1, 6, 12, PAL.voidD);
  p.fill(ox - 13, y + 3, 4, 8, PAL.voidC);
  p.fill(ox + 1, y + 7, 10, 6, PAL.voidD);
  magBanner(p, ox - 2, y - 4, 6, 6);
  p.line(ox - 9, y - 9, ox - 15, y - 16, PAL.voidH);
  p.line(ox + 6, y - 11, ox + 12, y - 17, PAL.voidH);
  p.circ(ox - 15, y - 16, 3, PAL.voidH);
  p.circ(ox + 12, y - 17, 3, PAL.voidH);
}

function drawUnit(civ: 'vespari' | 'aurion' | 'voidmarked', role: string, frame: number): Pix {
  const p = Pix.alloc(CELL, CELL);
  const ox = 16;
  const oy = 20;

  if (civ === 'vespari') hiveBody(p, ox, oy, frame);
  else if (civ === 'aurion') cryBody(p, ox, oy, frame);
  else voidBody(p, ox, oy, frame);

  if (role === 'worker') {
    p.fill(ox + 4, oy - 10, 9, 11, PAL.ore);
    p.fill(ox + 5, oy - 9, 7, 4, PAL.oreH);
    p.line(ox - 9, oy - 3, ox - 14, oy + 5, PAL.bone);
    p.fill(ox - 14, oy + 3, 4, 4, PAL.oreH);
    p.fill(ox - 4, oy + 8, 10, 4, PAL.hiveD);
  } else if (role === 'scout') {
    p.fill(ox - 15, oy - 5, 8, 4, PAL.white);
    p.fill(ox - 16, oy - 4, 3, 2, PAL.hiveH);
    p.fill(ox + 8, oy - 5, 8, 4, PAL.white);
    p.fill(ox + 14, oy - 4, 3, 2, PAL.hiveH);
    p.fill(ox - 3, oy - 16, 7, 5, PAL.hiveH);
    p.line(ox + 3, oy - 12, ox + 12, oy - 14, PAL.bone);
    p.set(ox + 12, oy - 14, PAL.white);
  } else if (role === 'fighter') {
    p.line(ox + 3, oy - 7, ox + 15, oy - 14, PAL.bone);
    p.line(ox + 4, oy - 6, ox + 16, oy - 13, PAL.white);
    magBanner(p, ox + 14, oy - 14, 3, 3);
    magBanner(p, ox - 5, oy - 7, 5, 6);
    p.fill(ox - 7, oy - 3, 5, 7, PAL.hiveD);
  } else if (role === 'siege') {
    p.fill(ox - 14, oy + 1, 28, 8, PAL.rock);
    p.fill(ox - 12, oy + 2, 24, 5, PAL.rockH);
    p.fill(ox + 1, oy - 12, 16, 6, PAL.rock);
    p.fill(ox + 14, oy - 13, 5, 4, PAL.ore);
    p.line(ox + 16, oy - 12, ox + 16, oy - 7, PAL.ink);
    p.circ(ox - 10, oy + 7, 4, PAL.rockH);
    p.circ(ox + 10, oy + 7, 4, PAL.rockH);
  } else if (role === 'ravager') {
    p.hex(ox, oy - 3, 10, PAL.hiveD);
    p.hex(ox, oy - 4, 8, PAL.blood);
    magBanner(p, ox - 3, oy - 10, 7, 6);
    p.line(ox - 8, oy - 6, ox - 15, oy - 12, PAL.bone);
    p.line(ox + 8, oy - 6, ox + 15, oy - 12, PAL.bone);
    p.set(ox - 15, oy - 12, PAL.solH);
    p.set(ox + 15, oy - 12, PAL.solH);
    p.line(ox + 3, oy - 2, ox + 16, oy - 8, PAL.sol);
    p.set(ox + 16, oy - 8, PAL.white);
  } else if (role === 'prism') {
    p.diam(ox, oy - 2, 13, PAL.cryD);
    p.diam(ox, oy - 3, 11, PAL.cry);
    p.diam(ox, oy - 4, 7, PAL.white);
    magBanner(p, ox - 3, oy - 4, 7, 7);
    p.line(ox, oy - 12, ox, oy - 20, PAL.cryH);
    p.fill(ox - 1, oy - 20, 3, 2, PAL.white);
    p.fill(ox - 13, oy + 4, 5, 4, PAL.cryD);
    p.fill(ox + 9, oy + 4, 5, 4, PAL.cryD);
  } else if (role === 'shade') {
    p.fill(ox - 10, oy - 10, 18, 16, PAL.voidD);
    p.fill(ox - 7, oy - 8, 12, 12, PAL.voidC);
    p.fill(ox + 2, oy - 14, 8, 10, PAL.voidD);
    magBanner(p, ox - 2, oy - 6, 5, 5);
    p.line(ox - 9, oy + 2, ox - 14, oy + 8, PAL.voidH);
    p.line(ox + 6, oy + 2, ox + 13, oy + 7, PAL.voidH);
    p.circ(ox - 14, oy + 8, 2, PAL.voidH);
    p.line(ox + 4, oy - 12, ox + 12, oy - 16, PAL.blood);
  }

  if (frame === 3) {
    p.circ(ox + 10, oy - 8, 3, PAL.white);
    p.circ(ox + 11, oy - 8, 2, PAL.solH);
  }
  if (frame === 4) {
    p.fill(0, 0, CELL, CELL, [0, 0, 0, 0]);
    p.circ(ox, oy + 2, 8, PAL.ink);
    p.circ(ox - 4, oy - 2, 3, civ === 'vespari' ? PAL.hive : civ === 'aurion' ? PAL.cry : PAL.voidC);
    p.circ(ox + 4, oy - 2, 2, MAG);
  }

  p.finish();
  return p;
}

function drawHall(civ: 'vespari' | 'aurion' | 'voidmarked'): Pix {
  const p = Pix.alloc(CELL * 2, CELL * 2);
  if (civ === 'vespari') {
    p.fill(8, 44, 48, 14, PAL.hiveD);
    p.circ(32, 42, 24, PAL.hiveD);
    p.circ(32, 38, 20, PAL.hive);
    p.circ(18, 30, 12, PAL.hiveD);
    p.circ(46, 30, 12, PAL.hiveD);
    p.circ(32, 22, 14, PAL.hive);
    p.circ(26, 18, 7, PAL.hiveH);
    magBanner(p, 28, 12, 9, 10);
    p.line(22, 14, 18, 4, PAL.ink);
    p.line(42, 14, 46, 4, PAL.ink);
    p.circ(18, 4, 3, PAL.hiveH);
    p.circ(46, 4, 3, PAL.hiveH);
    p.fill(14, 50, 36, 6, PAL.hiveD);
  } else if (civ === 'aurion') {
    p.diam(32, 40, 28, PAL.cryD);
    p.diam(32, 36, 22, PAL.cry);
    p.diam(32, 24, 14, PAL.cryH);
    magBanner(p, 28, 22, 9, 10);
    p.line(32, 10, 32, 0, PAL.white);
    p.fill(30, 0, 5, 4, PAL.cryH);
    p.line(14, 44, 2, 58, PAL.cryD);
    p.line(50, 44, 62, 58, PAL.cryD);
    p.fill(10, 52, 44, 8, PAL.cryD);
  } else {
    p.fill(6, 16, 52, 44, PAL.voidD);
    p.fill(12, 10, 40, 50, PAL.voidC);
    p.fill(20, 6, 24, 28, PAL.voidD);
    magBanner(p, 28, 18, 9, 10);
    p.line(10, 16, 2, 2, PAL.voidH);
    p.line(54, 16, 62, 2, PAL.voidH);
    p.fill(14, 48, 10, 18, PAL.voidD);
    p.fill(40, 48, 10, 18, PAL.voidD);
    p.circ(2, 2, 4, PAL.voidH);
    p.circ(62, 2, 4, PAL.voidH);
  }
  p.finish();
  return p;
}

function drawHouse(civ: 'vespari' | 'aurion' | 'voidmarked'): Pix {
  const p = Pix.alloc(CELL, CELL);
  if (civ === 'vespari') {
    p.fill(4, 22, 24, 8, PAL.hiveD);
    p.hex(16, 18, 12, PAL.hiveD);
    p.hex(16, 16, 10, PAL.hive);
    p.hex(14, 12, 5, PAL.hiveH);
    magBanner(p, 13, 8, 7, 8);
    p.line(12, 8, 10, 2, PAL.ink);
    p.line(20, 8, 22, 2, PAL.ink);
  } else if (civ === 'aurion') {
    p.fill(3, 22, 26, 8, PAL.cryD);
    p.diam(16, 18, 13, PAL.cryD);
    p.diam(16, 16, 10, PAL.cry);
    p.diam(16, 12, 5, PAL.cryH);
    magBanner(p, 13, 13, 7, 6);
    p.line(16, 6, 16, 1, PAL.white);
  } else {
    p.fill(2, 20, 28, 10, PAL.voidD);
    p.fill(5, 8, 22, 20, PAL.voidC);
    p.fill(8, 4, 16, 12, PAL.voidD);
    magBanner(p, 13, 12, 7, 6);
    p.line(6, 10, 2, 3, PAL.voidH);
    p.line(26, 12, 30, 5, PAL.voidH);
  }
  p.finish();
  return p;
}

function drawBarracks(civ: 'vespari' | 'aurion' | 'voidmarked'): Pix {
  const p = Pix.alloc(CELL, CELL);
  if (civ === 'vespari') {
    p.fill(2, 20, 28, 10, PAL.hiveD);
    p.fill(4, 8, 24, 16, PAL.hive);
    p.hex(16, 14, 9, PAL.hiveH);
    magBanner(p, 13, 10, 7, 8);
    p.line(16, 6, 16, 1, PAL.ink);
    p.line(6, 22, 2, 28, PAL.hiveD);
    p.line(26, 22, 30, 28, PAL.hiveD);
  } else if (civ === 'aurion') {
    p.fill(2, 20, 28, 10, PAL.cryD);
    p.fill(4, 10, 24, 14, PAL.cry);
    p.diam(16, 14, 10, PAL.cryH);
    magBanner(p, 13, 11, 7, 7);
    p.line(16, 6, 16, 0, PAL.white);
    p.fill(14, 0, 5, 3, PAL.cryH);
  } else {
    p.fill(1, 18, 30, 12, PAL.voidD);
    p.fill(4, 6, 24, 20, PAL.voidC);
    p.fill(10, 4, 12, 10, PAL.voidD);
    magBanner(p, 13, 10, 7, 7);
    p.line(4, 8, 0, 2, PAL.voidH);
    p.line(28, 10, 31, 3, PAL.voidH);
  }
  p.finish();
  return p;
}

function drawUnique(civ: 'vespari' | 'aurion' | 'voidmarked'): Pix {
  const p = Pix.alloc(CELL, CELL);
  if (civ === 'vespari') {
    p.fill(4, 20, 24, 10, PAL.hiveD);
    p.circ(16, 16, 11, PAL.hiveD);
    p.circ(16, 14, 8, PAL.sol);
    p.circ(10, 10, 5, PAL.hive);
    p.circ(22, 10, 5, PAL.hive);
    magBanner(p, 13, 10, 7, 8);
    p.line(16, 6, 16, 1, PAL.solH);
    p.circ(16, 1, 2, PAL.white);
  } else if (civ === 'aurion') {
    p.fill(2, 20, 28, 10, PAL.cryD);
    p.diam(16, 16, 14, PAL.cryD);
    p.diam(16, 14, 10, PAL.cry);
    magBanner(p, 13, 12, 7, 7);
    p.line(16, 16, 4, 4, PAL.cryH);
    p.line(16, 16, 28, 4, PAL.cryH);
    p.line(16, 16, 16, 28, PAL.cryH);
    p.set(16, 4, PAL.white);
  } else {
    p.fill(2, 18, 28, 12, PAL.voidD);
    p.circ(16, 14, 12, PAL.voidD);
    p.circ(16, 14, 7, PAL.voidH);
    magBanner(p, 13, 11, 7, 7);
    p.line(4, 6, 10, 12, PAL.voidH);
    p.line(28, 6, 22, 12, PAL.voidH);
    p.circ(4, 6, 3, PAL.voidC);
    p.circ(28, 6, 3, PAL.voidC);
    p.fill(12, 22, 8, 6, PAL.voidD);
  }
  p.finish();
  return p;
}

function drawTile(kind: 'void' | 'dust' | 'rock' | 'ore' | 'gas' | 'sol'): Pix {
  const p = Pix.alloc(CELL, CELL);
  const base =
    kind === 'void' ? PAL.void : kind === 'dust' ? PAL.dust : kind === 'rock' ? PAL.rock : kind === 'ore' ? PAL.dust : kind === 'gas' ? PAL.void : PAL.dust;
  p.fill(0, 0, CELL, CELL, base);
  for (let i = 0; i < 18; i++) {
    const x = (i * 7 + kind.length * 3) % 32;
    const y = (i * 13 + 5) % 32;
    if (kind === 'void') p.set(x, y, PAL.white);
    if (kind === 'dust') p.set(x, y, PAL.rock);
    if (kind === 'rock') p.circ(10, 12, 6, PAL.rockH);
    if (kind === 'ore') {
      p.circ(12, 14, 5, PAL.ore);
      p.set(11, 12, PAL.oreH);
      p.set(14, 15, PAL.oreH);
    }
    if (kind === 'gas') {
      p.circ(16, 16, 8, PAL.gas);
      p.circ(14, 14, 3, PAL.gasH);
    }
    if (kind === 'sol') {
      p.circ(16, 16, 7, PAL.sol);
      p.circ(16, 16, 3, PAL.solH);
    }
  }
  return p;
}

function drawShadow(): Pix {
  const p = Pix.alloc(CELL, CELL);
  p.circ(16, 22, 10, [0, 0, 0, 90]);
  p.circ(16, 22, 6, [0, 0, 0, 120]);
  return p;
}

function drawSel(): Pix {
  const p = Pix.alloc(CELL, CELL);
  for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2;
    p.set(16 + Math.round(Math.cos(t) * 12), 22 + Math.round(Math.sin(t) * 7), PAL.solH);
  }
  p.set(16, 22, MAG);
  return p;
}

function drawFlag(): Pix {
  const p = Pix.alloc(CELL, CELL);
  p.line(16, 4, 16, 28, PAL.white);
  magBanner(p, 16, 4, 10, 8);
  p.finish();
  return p;
}

function drawBolt(kind: 'sting' | 'beam' | 'void' | 'rock'): Pix {
  const p = Pix.alloc(16, 16);
  if (kind === 'beam') {
    p.fill(6, 0, 4, 16, PAL.cryH);
    p.fill(7, 0, 2, 16, PAL.white);
  } else if (kind === 'void') {
    p.circ(8, 8, 5, PAL.voidH);
    p.circ(8, 8, 3, PAL.white);
  } else if (kind === 'rock') {
    p.circ(8, 8, 5, PAL.ore);
    p.set(7, 7, PAL.oreH);
  } else {
    p.circ(8, 8, 4, PAL.hiveH);
    p.set(8, 8, PAL.white);
  }
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

  const put = (key: string, pix: Pix, col: number, row: number, w = 1, h = 1) => {
    blit(ctx, pix, col * CELL, row * CELL);
    uv[key] = uvAt(col, row, w, h);
  };

  put('tile-void', drawTile('void'), 0, 0);
  put('tile-dust', drawTile('dust'), 1, 0);
  put('tile-rock', drawTile('rock'), 2, 0);
  put('tile-ore', drawTile('ore'), 3, 0);
  put('tile-gas', drawTile('gas'), 4, 0);
  put('tile-sol', drawTile('sol'), 5, 0);
  put('shadow', drawShadow(), 6, 0);
  put('sel', drawSel(), 7, 0);
  put('flag', drawFlag(), 8, 0);
  put('bolt-sting', drawBolt('sting'), 9, 0);
  put('bolt-beam', drawBolt('beam'), 10, 0);
  put('bolt-void', drawBolt('void'), 11, 0);
  put('bolt-rock', drawBolt('rock'), 12, 0);

  const civs = ['vespari', 'aurion', 'voidmarked'] as const;
  const roles = ['worker', 'scout', 'fighter', 'siege', 'ravager', 'prism', 'shade'] as const;
  let col = 0;
  let row = 2;
  for (const civ of civs) {
    for (const role of roles) {
      for (let f = 0; f < 5; f++) {
        put(`${civ}-${role}-${f}`, drawUnit(civ, role, f), col, row);
        col++;
        if (col >= COLS) {
          col = 0;
          row++;
        }
      }
    }
    put(`${civ}-hall`, drawHall(civ), col, row, 2, 2);
    col += 2;
    put(`${civ}-house`, drawHouse(civ), col, row);
    col++;
    put(`${civ}-barracks`, drawBarracks(civ), col, row);
    col++;
    put(`${civ}-unique`, drawUnique(civ), col, row);
    col++;
    if (col >= COLS - 4) {
      col = 0;
      row += 2;
    } else row += 0;
    if (col !== 0) {
      col = 0;
      row += 2;
    }
  }

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
