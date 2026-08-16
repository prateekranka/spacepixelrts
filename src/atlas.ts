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
  ink: [18, 14, 30, 255],
  void: [42, 36, 64, 255],
  dust: [102, 92, 128, 255],
  dustD: [88, 78, 108, 255],
  dustH: [148, 132, 168, 255],
  rock: [92, 82, 108, 255],
  rockH: [148, 136, 158, 255],
  dustE: [124, 112, 148, 255],
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

/** Kryos Conclave — squat diamond, vertical spire, bright ice core. */
function cryBody(p: Pix, ox: number, oy: number, frame: number): void {
  const bob = frame & 1;
  const y = oy + bob;
  p.diam(ox, y, 14, PAL.ink);
  p.diam(ox, y - 1, 12, PAL.cryD);
  p.diam(ox, y - 2, 10, PAL.cry);
  p.diam(ox, y - 4, 7, PAL.cryH);
  p.diam(ox, y - 5, 4, PAL.white);
  magBanner(p, ox - 3, y - 3, 7, 7);
  p.fill(ox - 2, y - 2, 5, 4, PAL.white);
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
    p.fill(ox + 6, oy - 8, 3, 8, PAL.white);
    p.fill(ox + 5, oy - 7, 5, 2, PAL.bone);
    p.line(ox - 9, oy - 3, ox - 14, oy + 5, PAL.bone);
    p.fill(ox - 14, oy + 3, 4, 4, PAL.oreH);
    p.circ(ox - 2, oy - 8, 2, PAL.white);
    p.fill(ox - 4, oy + 8, 10, 4, civ === 'vespari' ? PAL.bone : PAL.hiveD);
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
    if (civ === 'vespari') p.fill(ox - 7, oy - 3, 5, 7, PAL.hiveD);
    else if (civ === 'aurion') {
      p.fill(ox - 7, oy - 3, 5, 7, PAL.cryD);
      p.diam(ox - 4, oy, 4, PAL.white);
    } else p.fill(ox - 7, oy - 3, 5, 7, PAL.voidD);
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

function diamondEdge(p: Pix, edge: Rgba, shade: Rgba): void {
  for (let i = 0; i <= 15; i++) {
    p.set(16 - i, i, edge);
    p.set(16 + i, i, edge);
    p.set(16 - i, 31 - i, shade);
    p.set(16 + i, 31 - i, shade);
  }
  p.set(16, 0, PAL.white);
  p.set(31, 16, shade);
  p.set(16, 31, shade);
  p.set(0, 16, edge);
}

/** Tight ground gem — transparent padding, no magenta key. */
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

/** Quiet dust-belt floor — one purple-brown family; variants differ only in crack/pebble layout. */
const DUST_BASE = [106, 90, 112, 255] as const;
const DUST_DARK = [88, 76, 94, 255] as const;
const DUST_DEEP = [72, 62, 80, 255] as const;
const DUST_PEB = [96, 84, 100, 255] as const;

function drawDustTile(variant: 0 | 1 | 2): Pix {
  const p = Pix.alloc(CELL, CELL);
  p.fill(0, 0, CELL, CELL, DUST_BASE);
  const blobs: [number, number, number][] =
    variant === 0
      ? [
          [8, 6, 9],
          [22, 10, 8],
          [6, 20, 7],
          [24, 22, 9],
        ]
      : variant === 1
        ? [
            [10, 8, 8],
            [20, 18, 9],
            [5, 14, 7],
            [26, 8, 6],
          ]
        : [
            [14, 14, 10],
            [12, 12, 8],
            [20, 20, 9],
            [8, 22, 7],
          ];
  for (const [cx, cy, r] of blobs) p.circ(cx, cy, r, DUST_DARK);
  const cracks: [number, number, number, number][] =
    variant === 0
      ? [
          [6, 8, 18, 14],
          [20, 6, 26, 18],
          [10, 20, 22, 26],
        ]
      : variant === 1
        ? [
            [4, 12, 14, 22],
            [18, 4, 24, 16],
            [8, 24, 20, 28],
          ]
        : [
            [12, 5, 22, 11],
            [5, 18, 16, 28],
            [22, 20, 28, 27],
          ];
  for (const [x0, y0, x1, y1] of cracks) p.line(x0, y0, x1, y1, DUST_DEEP);
  const pebbles: [number, number, number][] =
    variant === 0
      ? [
          [9, 11, 2],
          [22, 9, 2],
          [14, 22, 2],
          [25, 20, 2],
          [17, 15, 2],
        ]
      : variant === 1
        ? [
            [7, 18, 2],
            [19, 7, 2],
            [24, 24, 2],
            [11, 26, 2],
            [15, 12, 2],
          ]
        : [
            [6, 6, 2],
            [17, 16, 2],
            [26, 12, 2],
            [13, 27, 2],
            [21, 21, 2],
          ];
  for (const [cx, cy, r] of pebbles) p.circ(cx, cy, r, DUST_PEB);
  return p;
}

function drawRockTile(): Pix {
  const p = Pix.alloc(CELL, CELL);
  p.fill(0, 0, CELL, CELL, DUST_BASE);
  // Boulder silhouette — irregular mass, lit rim top-left.
  const pts: [number, number][] = [
    [8, 22],
    [6, 16],
    [9, 10],
    [14, 7],
    [22, 8],
    [26, 13],
    [27, 20],
    [23, 26],
    [15, 27],
    [10, 25],
  ];
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    p.line(x0, y0, x1, y1, PAL.ink);
  }
  for (let y = 7; y <= 27; y++) {
    for (let x = 6; x <= 27; x++) {
      if (x + y > 34 && x * 1.1 + y * 0.85 < 42) p.set(x, y, PAL.rock);
    }
  }
  for (let y = 8; y <= 18; y++) {
    for (let x = 9; x <= 20; x++) {
      if (x + y < 28) p.set(x, y, PAL.rockH);
    }
  }
  p.line(10, 9, 18, 8, PAL.rockH);
  p.set(11, 9, PAL.rockH);
  p.set(17, 8, PAL.rockH);
  // Ground shadow wedge.
  for (let x = 8; x <= 26; x++) p.set(x, 28, [58, 50, 72, 255]);
  for (let x = 10; x <= 24; x++) p.set(x, 29, [48, 42, 62, 255]);
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
  for (let x = 6; x <= 17; x++) p.set(x, 18, [58, 50, 72, 255]);
  p.finish();
  return p;
}

function drawPropVent(): Pix {
  const p = Pix.alloc(18, 20);
  p.fill(6, 14, 6, 5, [58, 52, 68, 255]);
  p.circ(9, 15, 4, [72, 66, 82, 255]);
  p.circ(9, 11, 3, PAL.gas);
  p.circ(9, 8, 2, PAL.gasH);
  p.set(9, 5, PAL.solH);
  p.set(8, 4, PAL.sol);
  p.set(10, 6, PAL.gasH);
  p.line(9, 3, 9, 1, [186, 230, 255, 200]);
  p.set(8, 2, PAL.solH);
  p.finish();
  return p;
}

function drawTile(kind: 'void' | 'dust' | 'rock' | 'ore' | 'gas' | 'sol'): Pix {
  if (kind === 'dust') return drawDustTile(0);
  if (kind === 'rock') return drawRockTile();
  if (kind === 'ore' || kind === 'gas' || kind === 'sol') return drawDustTile(0);
  const p = Pix.alloc(CELL, CELL);
  p.fill(0, 0, CELL, CELL, PAL.void);
  diamondEdge(p, [32, 28, 52, 255], PAL.void);
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

function drawSpark(kind: 'muzzle' | 'impact', civ: 'vespari' | 'aurion' | 'voidmarked'): Pix {
  const p = Pix.alloc(16, 16);
  let core: Rgba = PAL.white;
  let halo: Rgba = PAL.solH;
  let edge: Rgba = PAL.sol;
  if (civ === 'aurion') {
    halo = PAL.cryH;
    edge = PAL.cry;
  } else if (civ === 'voidmarked') {
    halo = PAL.voidH;
    edge = PAL.voidC;
  }
  if (kind === 'muzzle') {
    p.circ(8, 8, 3, halo);
    p.circ(8, 8, 2, edge);
    p.circ(8, 8, 1, core);
    p.set(4, 8, halo);
    p.set(12, 8, halo);
    p.set(8, 4, halo);
    p.set(8, 12, halo);
    p.set(6, 6, edge);
    p.set(10, 10, edge);
  } else {
    p.circ(8, 8, 4, halo);
    p.circ(8, 8, 2, edge);
    p.circ(8, 8, 1, core);
    p.set(3, 6, edge);
    p.set(13, 10, edge);
    p.set(6, 13, edge);
    p.set(11, 3, edge);
    p.set(5, 11, halo);
    p.set(12, 5, halo);
  }
  p.finish();
  return p;
}

function drawBolt(kind: 'sting' | 'beam' | 'void' | 'rock'): Pix {
  const p = Pix.alloc(16, 16);
  if (kind === 'beam') {
    p.circ(8, 8, 4, PAL.cry);
    p.circ(8, 8, 1, PAL.white);
  } else if (kind === 'void') {
    p.circ(8, 8, 4, PAL.voidH);
    p.circ(8, 8, 2, PAL.voidC);
    p.circ(8, 8, 1, PAL.white);
  } else if (kind === 'rock') {
    p.circ(8, 8, 4, PAL.ore);
    p.circ(8, 8, 1, PAL.white);
  } else {
    p.circ(8, 8, 4, PAL.sol);
    p.circ(8, 8, 1, PAL.white);
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

  put('tile-void', drawTile('void'), 0, 0);
  put('tile-dust', drawDustTile(0), 1, 0);
  put('tile-dust-b', drawDustTile(1), 13, 0);
  put('tile-dust-c', drawDustTile(2), 14, 0);
  put('tile-rock', drawRockTile(), 2, 0);
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
  const sparkCivs = ['vespari', 'aurion', 'voidmarked'] as const;
  let sparkCol = 15;
  for (const civ of sparkCivs) {
    put(`spark-muzzle-${civ}`, drawSpark('muzzle', civ), sparkCol, 0);
    sparkCol++;
    put(`spark-impact-${civ}`, drawSpark('impact', civ), sparkCol, 0);
    sparkCol++;
  }
  putGem('gem-ore', drawGem('ore'), 0, 1);
  putGem('gem-gas', drawGem('gas'), 1, 1);
  putGem('gem-sol', drawGem('sol'), 2, 1);
  putGem('prop-wreck', drawPropWreck(), 3, 1);
  putGem('prop-vent', drawPropVent(), 4, 1);

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
