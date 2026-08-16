/**
 * P90-v3 REFERENCE — how a real pixel-art unit/building is constructed.
 *
 * The lesson from 2 critic rounds: SDF primitives (circle+circle+rect+bar) read as
 * "a marble with a costume", not a character. Real pixel art draws CONNECTED anatomy
 * with a single unified silhouette, dither-shaded from one key light, and one dominant
 * readable weapon/tool.
 *
 * This file is the gold standard. A builder replicates THIS technique for the full
 * roster. It is procedural (no disk assets) — drawn with the Pix rasterizer.
 */

export type Rgba = readonly [number, number, number, number];

class Pix {
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
}

// ── palette (matches game) ─────────────────────────────────────────────
const INK: Rgba = [18, 14, 30, 255];
const SKIN: Rgba = [232, 220, 196, 255];
const SKIN_D: Rgba = [168, 148, 132, 255];
const HIVE: Rgba = [46, 122, 58, 255];
const HIVE_H: Rgba = [168, 230, 96, 255];
const HIVE_D: Rgba = [22, 58, 32, 255];
const BONE: Rgba = [232, 220, 196, 255];
const GUN: Rgba = [90, 96, 110, 255];
const GUN_H: Rgba = [150, 156, 170, 255];
const ORE: Rgba = [198, 154, 72, 255];
const ORE_H: Rgba = [240, 214, 120, 255];
const WHITE: Rgba = [244, 238, 226, 255];

/**
 * A Helion FIGHTER — a real connected soldier holding a rifle.
 * Silhouette: helmet → neck → torso → pelvis → two legs, one single form.
 * Rifle: stock (at shoulder) → receiver → barrel → muzzle (longer than torso).
 * Shading: key light top-left (HIVE_H on upper/left faces, HIVE on base, HIVE_D lower/right).
 */
export function drawFighter(): Pix {
  const p = Pix.alloc(32, 32);
  const cx = 15; // center x

  // 1. DARK SILHOUETTE first (this guarantees a connected outline, no floating parts).
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);

  // 2. LEGS (connected to pelvis, reach the ground). Torso will overlap the thigh tops.
  dark(cx - 4, 18, 6, 12); // left leg
  dark(cx + 1, 18, 6, 12); // right leg

  // 3. TORSO + PELVIS as one connected mass (overlaps leg tops = connection).
  dark(cx - 7, 8, 15, 12); // torso block

  // 4. HEAD + HELMET above neck.
  dark(cx - 4, 2, 9, 7); // head+helmet

  // 5. RIFLE — stock flairs at grip, receiver thick, barrel thin, muzzle brake bump.
  dark(cx - 4, 9, 5, 4); // stock flair (wider at bottom)
  dark(cx + 2, 6, 6, 4); // receiver block (thick)
  dark(cx + 8, 7, 10, 2); // barrel (thin pipe)
  dark(cx + 17, 6, 4, 4); // muzzle brake bump

  // Arms gripping — front forearm shoulder → trigger, hand ON barrel (no gap).
  dark(cx + 3, 9, 3, 3); // front upper arm / shoulder
  dark(cx + 5, 10, 4, 4); // front forearm to grip
  dark(cx - 6, 8, 4, 5); // back arm supporting stock

  // 6. Fill with lit colors from top-left, shadow lower-right.
  //    Legs: front leg lighter, back leg darker.
  for (let y = 18; y < 30; y++) {
    const lit = y < 23; // upper leg lit
    p.set(cx - 3, y, lit ? HIVE : HIVE_D); // left leg
    p.set(cx - 4, y, HIVE_D); // outer shadow
    p.set(cx + 2, y, lit ? HIVE_H : HIVE); // right leg (front = lighter)
    p.set(cx + 3, y, HIVE_D); // inner shadow edge
  }
  p.fillRect(cx - 5, 29, 5, 2, HIVE_D); // left boot
  p.fillRect(cx + 1, 29, 5, 2, HIVE_D); // right boot

  // Torso: lit top-left, shadow bottom-right.
  for (let y = 8; y < 19; y++) {
    for (let x = cx - 6; x <= cx + 6; x++) {
      const c = x < cx - 2 && y < 13 ? HIVE_H : ((x > cx + 2 || y > 15) ? HIVE_D : HIVE);
      p.set(x, y, c);
    }
  }
  p.set(cx - 2, 9, HIVE_H);
  p.set(cx - 3, 10, HIVE_H);

  // HEAD: helmet top-left lit, shadow right.
  for (let y = 2; y < 9; y++) {
    p.set(cx - 2, y, y < 5 ? HIVE_H : HIVE);
    p.set(cx - 1, y, y < 5 ? HIVE_H : HIVE);
    p.set(cx, y, y < 5 ? HIVE_H : HIVE);
    p.set(cx + 1, y, HIVE);
    p.set(cx + 2, y, y < 5 ? HIVE : HIVE_D);
  }
  p.set(cx + 2, 5, BONE); // visor slit (facing right)
  p.set(cx + 1, 5, BONE);

  // RIFLE fill: receiver thick, barrel thin, stock flair, muzzle brake.
  for (let y = 6; y <= 9; y++) {
    for (let x = cx + 2; x <= cx + 7; x++) {
      const c = y < 8 && x < cx + 5 ? GUN_H : GUN;
      p.set(x, y, c);
    }
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

  // ARMS (grip): front hand skin pixels touching barrel.
  for (let y = 9; y <= 12; y++) p.set(cx + 5, y, HIVE);
  for (let y = 10; y <= 12; y++) p.set(cx + 6, y, HIVE);
  p.set(cx + 7, 10, SKIN);
  p.set(cx + 7, 11, SKIN);
  p.set(cx + 8, 10, SKIN); // hand on barrel — no gap
  for (let x = cx - 5; x < cx - 2; x++) p.set(x, 9, HIVE_D);
  p.set(cx - 6, 9, SKIN_D);

  // 7. DITHER in the shadow zone.
  for (let y = 14; y < 19; y++) {
    if ((y & 1) === 0) p.set(cx + 5, y, HIVE_H);
  }

  return p;
}

/**
 * A Helion WORKER — hunched, both arms wrapping a big ore crate, hard-hat beacon.
 */
export function drawWorker(): Pix {
  const p = Pix.alloc(32, 32);
  const cx = 12;

  // silhouette first (connected)
  const dark = (x: number, y: number, w: number, h: number) => p.fillRect(x, y, w, h, INK);
  dark(cx - 3, 18, 6, 11); // legs
  dark(cx + 2, 18, 5, 10);
  dark(cx - 7, 8, 14, 12); // hunched torso (1px lower)
  dark(cx - 3, 4, 8, 6); // head tucked under load

  // THE CRATE — overlaps thighs (load on body, not floating).
  dark(cx + 6, 11, 13, 13); // crate silhouette down onto thighs
  // fill crate (ore) — gold, lit top-left
  for (let y = 11; y < 24; y++) {
    for (let x = cx + 6; x < cx + 19; x++) {
      const c = x < cx + 10 && y < 15 ? ORE_H : ORE;
      p.set(x, y, c);
    }
  }
  p.set(cx + 8, 12, WHITE);
  p.set(cx + 9, 13, ORE_H);

  // BODY fill (hunched, lit top-left)
  for (let y = 8; y < 20; y++) {
    for (let x = cx - 6; x <= cx + 5; x++) {
      const c = x < cx - 3 && y < 11 ? HIVE_H : ((x > cx + 2 || y > 15) ? HIVE_D : HIVE);
      p.set(x, y, c);
    }
  }
  // head + hard-hat (lit)
  for (let y = 4; y < 10; y++) {
    const c = y < 6 ? HIVE_H : HIVE;
    p.set(cx - 2, y, c);
    p.set(cx - 1, y, c);
    p.set(cx, y, c);
  }
  p.set(cx, 3, ORE_H);
  p.set(cx, 2, WHITE);

  // BOTH ARMS wrapping the crate.
  p.fillRect(cx + 1, 11, 6, 2, HIVE);
  p.fillRect(cx + 1, 20, 6, 2, HIVE_D);
  p.set(cx + 7, 12, SKIN);
  p.set(cx + 7, 21, SKIN_D);

  // legs (visible below crate overlap)
  for (let y = 20; y < 29; y++) {
    p.set(cx - 2, y, HIVE);
    p.set(cx - 1, y, y < 23 ? HIVE : HIVE_D);
    p.set(cx + 3, y, HIVE_D);
  }
  p.fillRect(cx - 3, 28, 3, 2, HIVE_D);
  p.fillRect(cx + 2, 28, 3, 2, HIVE_D);

  return p;
}

/**
 * A Helion HALL (town center) — real architecture: pitched roof plane above a wall plane,
 * a dark door opening, lit window slots, civ dome on top. 64×64.
 */
export function drawHall(): Pix {
  const p = Pix.alloc(64, 64);
  const cx = 32;

  // dark silhouette (the whole building footprint gives a connected outline)
  p.fillRect(8, 40, 48, 20, INK); // wall band (lower)
  p.fillRect(12, 18, 40, 22, INK); // upper structure
  // roof: a pitched dome (round, civ motif) sitting on top
  for (let y = 8; y <= 22; y++) {
    const half = Math.round(26 * (1 - (y - 8) / 16));
    p.fillRect(cx - half, y, half * 2, 1, INK);
  }

  // WALLS (lit top-left, shadow right): base stone color
  const WALL: Rgba = [58, 48, 62, 255];
  const WALL_H: Rgba = [96, 84, 100, 255];
  const WALL_D: Rgba = [40, 32, 44, 255];
  for (let y = 40; y < 60; y++) {
    for (let x = 10; x <= 54; x++) {
      const c = x < 24 ? WALL_H : (x > 44 ? WALL_D : WALL);
      p.set(x, y, c);
    }
  }
  // upper structure fill
  for (let y = 18; y < 40; y++) {
    for (let x = 14; x <= 50; x++) {
      const c = x < 24 ? WALL_H : (x > 44 ? WALL_D : WALL);
      p.set(x, y, c);
    }
  }

  // DOOR — short wide inset at bottom-center on the ground plane.
  p.fillRect(cx - 6, 55, 13, 5, INK);
  p.fillRect(cx - 5, 56, 11, 3, [20, 14, 26, 255]);
  p.set(cx - 4, 59, WALL_D); // threshold line

  // WINDOW slots (1px lit) on the upper wall.
  for (let i = 0; i < 3; i++) {
    const wy = 24 + i * 4;
    p.set(20, wy, [200, 220, 255, 255]);
    p.set(44, wy, [200, 220, 255, 255]);
  }

  // ROOF (civ dome) — hive green, lit top-left. Peak at top, WIDE AT EAVES (correct).
  const DOME: Rgba = HIVE;
  const DOME_H: Rgba = HIVE_H;
  const DOME_D: Rgba = HIVE_D;
  for (let y = 8; y <= 22; y++) {
    // widest at the base (y=22 → half=26), narrowest at peak (y=8 → half small)
    const half = Math.round(4 + 22 * (y - 8) / 14); // narrow top → wide bottom
    for (let x = cx - half; x <= cx + half; x++) {
      const c = x < cx - half / 2 ? DOME_H : (x > cx + half / 2 ? DOME_D : DOME);
      p.set(x, y, c);
    }
  }
  p.set(cx - 6, 9, WHITE); // dome glint (top-left)

  return p;
}

/** Compose all reference sprites into one sheet for visual review. */
export function renderReferenceSheet(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 32 * 3 + 64 + 60;
  c.height = 200; // taller so the hall door is visible
  const ctx = c.getContext('2d')!;
  const put = (pix: Pix, x: number, y: number, scale: number) => {
    const img = ctx.createImageData(pix.w, pix.h);
    img.data.set(pix.d);
    const off = document.createElement('canvas');
    off.width = pix.w;
    off.height = pix.h;
    off.getContext('2d')!.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(off, x, y, pix.w * scale, pix.h * scale);
  };
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, c.width, c.height);
  const sc = 2;
  put(drawFighter(), 4, 4, sc);
  put(drawWorker(), 4 + 32 * sc, 4, sc);
  put(drawHall(), 4 + 64 * sc, 4, sc);
  return c;
}
