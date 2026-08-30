/**
 * sunweaver-lumen-guard-candidate.ts — LUMEN-ART-R3 candidate (critic round 3).
 *
 * Owner: Builder 2 (candidate pixel art). Contract: docs/LUMEN_GUARD_IMAGE_CANDIDATE.md.
 *
 * Deterministic RAW source cells for a replacement Lumen Guard: 16 cells of
 * 64x64 transparent RGBA in exact contract order:
 *   dir0-pose0 .. dir7-pose0, dir0-pose1 .. dir7-pose1  (dir-major).
 * Authored directions 0,1,2,6,7; directions 3,4,5 are exact horizontal mirrors
 * of 1,0,7 (derived by flipX at lookup time, never hand-pasted).
 *
 * R3 revision (fresh blind critic losses → one-gap corrections):
 *   (1) TALL HEROIC PROPORTIONS: lengthened legs (12 rows, feet at 49) with a
 *       narrow 7-8px waist and 13px-wide shoulders — a clear V taper; chest /
 *       waist / legs are separated by dark undersuit gaps (waist row, belt
 *       shadow band, thigh ink, ankle ink) so nothing merges at 1x.
 *   (2) 2-TONE CREST: red plume/fan with an amber top edge, ink under-shadow
 *       and a gold fin tip, sweeping 8px on the side views (3+ px sweep),
 *       full fan on the back, band + side fins on the front — always keeping
 *       the center band x29..31 clear of non-rim pixels above row 16 so the
 *       frozen guard-body-top gate holds.
 *   (3) SPEAR: 1px dark shaft + elongated 15px solar leaf head, with an ink
 *       outline, ivory key edge, amber/gold body, and red inner facet. It keeps
 *       the row-0 core and >= 16px extension while reading as a blade, not orb.
 *   (4) SHIELD: dominant circular solar hoplon — ink edge, gold rim, broad
 *       ivory ring, dark field, 8 long gold rays, bright boss, and 8 isolated
 *       MAG team accents between rays. The solar motif reads before team color.
 *   (5) DARK VISOR + UNDERSUIT GAPS: T-visor on front views, side slit on
 *       profile, ink neck, ink waist band, ink thigh/ankle joints, separated
 *       legs with a visible background gap.
 *   (6) DISTINCT POSE 1: spear grip raised 3px with the shaft shifted, legs
 *       scissor with the front foot lifted, shield advances, crest streams —
 *       part-wise changes, never a whole-sprite offset.
 *   Value groups stay 5: ink / ivory cream / gold / amber / red (+ MAG lens).
 *
 * RAW cells contain NO automatic two-layer combat rim; the runtime seam
 * (lumenGuardCandidateRimmed / Builder 3 callback) applies
 * applyCombatExteriorRim exactly once.
 *
 * Production-safe and INACTIVE: exports a pure frame lookup and a false
 * active flag; imports only production modules (Pix, palette, rim helper).
 * No DOM, fs, Three.js, or Forge imports. The normal game route never
 * references this module until formal lead replacement.
 */

import { Pix, MAG, applyCombatExteriorRim } from '../sprites';
import type { Rgba } from '../sprites';

/** Inactive until the lead performs formal replacement. */
export const LUMEN_GUARD_CANDIDATE_ACTIVE = false;

export const LUMEN_GUARD_CANDIDATE_CELL = 64;
export const LUMEN_GUARD_CANDIDATE_DIRS = {
  authored: [0, 1, 2, 6, 7] as const,
  mirrored: [3, 4, 5] as const,
  mirrorOf: { 3: 1, 4: 0, 5: 7 } as const,
};

/** 5-group Sunweaver palette (reference-derived). All STARHOLD tokens. */
const INK: Rgba = [0x0b, 0x0a, 0x12, 255]; // P.ink   — dark undersuit / outline
const CREAM: Rgba = [0xf0, 0xe7, 0xd2, 255]; // P.cream — ivory armor
const GOLD: Rgba = [0xd0, 0x9a, 0x4e, 255]; // P.ochre — polished gold trim
const AMBER: Rgba = [0xf0, 0xc1, 0x5a, 255]; // P.amber — bright gold / rim
const RED: Rgba = [0xb8, 0x4b, 0x45, 255]; // P.red   — crest / sash / belt

/** Runtime exterior rim colors (same two-layer amber/cream as the frozen rows). */
export const LUMEN_GUARD_CANDIDATE_RIM_COLORS: Readonly<{ outer: Rgba; inner: Rgba }> = {
  outer: AMBER,
  inner: CREAM,
};

/** Feet bottom row of the RAW cells; the rim adds 2px to reach anchor row 51. */
const FEET = 49;

/** 1px Bresenham-ish line (all-integer). */
function line(p: Pix, x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let x = x0;
  let y = y0;
  for (;;) {
    p.set(x, y, c);
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

/** 2px-thick line (main line + one offset row), keeps clusters connected. */
function line2(p: Pix, x0: number, y0: number, x1: number, y1: number, c: Rgba): void {
  line(p, x0, y0, x1, y1, c);
  line(p, x0, y0 + 1, x1, y1 + 1, c);
}

/** Ivory plate: ink outline, cream fill, gold top trim, ink bottom shadow. */
function plate(p: Pix, x: number, y: number, w: number, h: number): void {
  p.fillRect(x, y, w, h, INK);
  if (w < 3 || h < 3) return;
  p.fillRect(x + 1, y + 1, w - 2, h - 2, CREAM);
  p.fillRect(x + 1, y + 1, w - 2, 1, GOLD);
  if (h >= 5) p.fillRect(x + 1, y + h - 2, w - 2, 1, INK);
}

/** Small five-pixel gold sun emblem; preserves a broad ivory chest field. */
function sunDisc(p: Pix, cx: number, cy: number): void {
  p.set(cx, cy, AMBER);
  p.set(cx - 2, cy, GOLD);
  p.set(cx + 2, cy, GOLD);
  p.set(cx, cy - 2, GOLD);
  p.set(cx, cy + 2, GOLD);
}

/**
 * Solar shield (reference hoplon), R3: dominant ink/gold/ivory disc with a
 * dark inner field, eight long gold sun rays, restrained red heat accents,
 * gold boss, and one MAG team lens pixel. The motif must read before the lens.
 */
function solarShield(p: Pix, cx: number, cy: number, r: number): void {
  p.circ(cx, cy, r, INK);
  if (r < 2) return;
  p.circ(cx, cy, r - 1, GOLD);
  if (r < 4) return;
  p.circ(cx, cy, r - 3, CREAM); // broad ivory ring inside the gold rim
  if (r < 7) return;
  p.circ(cx, cy, r - 6, INK); // dark solar field

  const rayEnd = r - 3;
  for (let d = 3; d <= rayEnd; d++) {
    p.set(cx - d, cy, GOLD);
    p.set(cx + d, cy, GOLD);
    p.set(cx, cy - d, GOLD);
    p.set(cx, cy + d, GOLD);
  }
  const diagonalEnd = Math.max(3, Math.floor((r - 3) * 0.7));
  for (let d = 3; d <= diagonalEnd; d++) {
    p.set(cx - d, cy - d, GOLD);
    p.set(cx + d, cy - d, GOLD);
    p.set(cx - d, cy + d, GOLD);
    p.set(cx + d, cy + d, GOLD);
  }
  // Eight one-pixel team lenses sit between the gold rays. They echo the
  // reference's red heat marks without obscuring the solar boss.
  for (const [dx, dy] of [
    [-3, -1], [3, -1], [-3, 1], [3, 1],
    [-1, -3], [1, -3], [-1, 3], [1, 3],
  ] as const) p.set(cx + dx, cy + dy, MAG);

  p.circ(cx, cy, 2, GOLD);
  p.circ(cx, cy, 1, AMBER);
  p.set(cx, cy, CREAM); // bright gold-boss glint; never a pink center
  p.set(cx - r + 1, cy - 1, CREAM); // key-light sparkle on the rim
}

/**
 * Long spear, R3: 1px dark shaft + an oversized 9x10 solar leaf head. The
 * stepped ink silhouette, ivory key edge, amber/gold body, and restrained red
 * inner facet preserve the reference's heroic flame-tip read at exact 1x.
 * `gripY` is the grip center; pose 1 raises the grip 3px up the shaft.
 */
function spear(p: Pix, x: number, gripY: number): void {
  // Solar leaf head: a 15px vertical blade so the rimmed silhouette stays
  // visibly longer than it is wide. The narrow base cannot collapse into an orb.
  const halfWidths = [1, 1, 2, 2, 3, 3, 3, 3, 2, 2, 2, 1, 1, 1, 0] as const;
  for (let y = 0; y < halfWidths.length; y++) {
    const half = halfWidths[y];
    p.fillRect(x - half, y, half * 2 + 1, 1, INK);
    if (half > 0) {
      p.fillRect(x - half + 1, y, half * 2 - 1, 1, y < 5 ? GOLD : AMBER);
    } else {
      p.set(x, y, GOLD);
    }
    if (y <= 7) p.set(x - Math.max(0, half - 1), y, CREAM);
    if (y >= 4 && y <= 10 && half >= 2) p.set(x + 1, y, RED);
  }
  // 1px dark shaft from the tapered socket through the hand.
  p.fillRect(x, halfWidths.length, 1, gripY - halfWidths.length + 1, INK);
  // gold grip rings below the gloved hand
  p.fillRect(x - 1, gripY + 1, 3, 1, INK);
  p.fillRect(x, gripY + 1, 1, 1, GOLD);
  p.fillRect(x - 1, gripY + 2, 3, 1, INK);
  p.fillRect(x, gripY + 2, 1, 1, GOLD);
}

/**
 * Separated guard leg, R2: dark ink thigh (undersuit), gold knee cap, ivory
 * greave with gold trim, dark ankle gap, gold boot with ink sole. Narrow
 * 3px column so the leg gap reads at 1x; boots flare 1px each side.
 */
function guardLeg(
  p: Pix,
  x: number,
  top: number,
  footLeft: number,
  footRight: number,
  footDrop: number,
): void {
  p.fillRect(x, top, 3, FEET - top + 1, INK); // thigh undersuit
  const kneeY = FEET - 8;
  p.fillRect(x, kneeY, 3, 2, GOLD); // knee cap
  p.fillRect(x, kneeY + 2, 3, FEET - kneeY - 6, CREAM); // greave
  p.fillRect(x, FEET - 4, 3, 1, GOLD); // greave trim
  // boot: gold, ink sole; footDrop lifts the foot in pose 1
  p.fillRect(footLeft, FEET - 2 + footDrop, footRight - footLeft + 1, 2, GOLD);
  p.fillRect(footLeft, FEET + footDrop, footRight - footLeft + 1, 1, INK);
}

/** Red belt with gold buckle, dark under-band and hanging tassels. */
function belt(p: Pix, x: number, w: number, buckleX: number, y: number): void {
  p.fillRect(x, y, w, 1, INK);
  p.fillRect(x + 1, y, w - 2, 1, RED);
  p.fillRect(buckleX, y, 3, 1, GOLD);
  p.fillRect(x, y + 1, w, 1, INK); // dark undersuit band under the belt
  p.set(buckleX + 1, y + 2, RED);
  p.set(buckleX + 1, y + 3, RED);
  p.set(buckleX, y + 3, RED);
}

// ── Authored directions ──────────────────────────────────────────────────────
// Each direction is a distinct composition (shield position/size, spear x,
// crest presentation, body width, visor) — no mechanical rotation of one pose.
//
// Pose 0 = ready guard (spear high and straight, grip low, crest tall, stance
// planted). Pose 1 = advance (grip raised 3px, spear shifted, legs scissor
// with the front foot lifted, shield advances, crest streams) — a real gait,
// part-wise changes, never a whole-sprite offset.

/** dir 0 — E, full right profile. Shield far side, spear near side, plume back. */
function drawSide(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const spearX = pose ? 13 : 11;
  const gripY = pose ? 36 : 39;
  const plumeDX = pose ? -1 : 0; // crest streams back harder in pose 1
  const shieldCX = 48;
  const shieldCY = 29;
  const backX = pose ? 24 : 25;
  const frontX = pose ? 35 : 33;
  const frontFootL = pose ? 36 : 34;
  const frontFootR = pose ? 40 : 38;
  const frontDrop = pose ? -1 : 0;

  // Plume: 2-tone red sweep (amber top edge, ink under-shadow, gold tip),
  // sweeping 8px back from the helmet; outside the x29..31 gate band.
  p.fillRect(22 + plumeDX, 11, 7, 1, AMBER);
  p.fillRect(21 + plumeDX, 12, 8, 3, RED);
  p.fillRect(21 + plumeDX, 15, 8, 1, INK);
  p.set(28 + plumeDX, 11, GOLD);
  // Gold comb at y16-17 (two rows so the plume reaches the helmet bowl below)
  // keeps the guard-body-top gate (band top = 16). The fin at x35 mirrors to
  // x28, outside the x29..31 gate band.
  p.fillRect(26, 16, 11, 2, GOLD);
  p.set(35, 15, GOLD); // small fin above the comb

  // Corinthian helmet: ivory bowl, dark side visor slit, gold trim + ear boss.
  p.fillRect(28, 18, 8, 8, INK);
  p.fillRect(29, 19, 6, 5, CREAM);
  p.fillRect(32, 20, 3, 2, INK); // visor slit facing right
  p.fillRect(28, 21, 1, 2, GOLD); // ear boss at the back
  p.fillRect(30, 23, 5, 1, GOLD); // cheek trim
  p.fillRect(28, 24, 8, 2, GOLD); // chin band
  p.fillRect(29, 26, 7, 2, INK); // neck joint

  // Torso: back pauldron, chest with sun emblem, front pauldron, red sash.
  plate(p, 23, 27, 4, 4);
  plate(p, 26, 28, 10, 7);
  sunDisc(p, 32, 31);
  plate(p, 34, 27, 4, 4);
  p.fillRect(25, 31, 3, 4, RED); // sash on the back side
  p.fillRect(27, 35, 8, 1, INK); // dark waist gap
  belt(p, 27, 11, 31, 36);

  // Legs: back leg (left) and front leg (right); pose 1 scissors the front
  // leg forward and lifts it, the back leg steps back.
  guardLeg(p, backX, 38, backX - 1, backX + 2, 0);
  guardLeg(p, frontX, 38, frontFootL, frontFootR, frontDrop);

  // Spear on the near-left; arm bridge from the chest to the gloved grip.
  spear(p, spearX, gripY);
  line2(p, 26, 32, spearX + 1, gripY - 1, INK);
  p.fillRect(spearX - 1, gripY - 1, 3, 2, INK);

  // Shield: dominant solar hoplon forward of the body; the arm stays behind it.
  line2(p, 35, 31, shieldCX - 10, shieldCY, INK);
  solarShield(p, shieldCX, shieldCY, 11);
  return p;
}

/** dir 6 — S, front. T-visor, red crest band, shield front-right, spear left. */
function drawFront(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const spearX = pose ? 22 : 20;
  const gripY = pose ? 36 : 39;
  const crestDX = pose ? 1 : 0;
  const shieldCX = 46;
  const shieldCY = 30;
  const backX = pose ? 26 : 27;
  const frontX = pose ? 36 : 34;
  const frontFootL = pose ? 35 : 33;
  const frontFootR = pose ? 39 : 37;
  const frontDrop = pose ? -1 : 0;

  // Crest: 2-tone band (amber top edge, red body, gold side fins).
  p.fillRect(25 + crestDX, 16, 14, 1, AMBER);
  p.fillRect(24 + crestDX, 17, 16, 1, RED);
  p.fillRect(25 + crestDX, 18, 14, 1, RED);
  p.fillRect(23 + crestDX, 16, 2, 2, GOLD);
  p.fillRect(39 + crestDX, 16, 2, 2, GOLD);

  // Helmet bowl + dark T-visor + gold ear bosses + chin band.
  p.fillRect(28, 18, 8, 8, INK);
  p.fillRect(29, 19, 6, 5, CREAM);
  p.fillRect(30, 19, 3, 5, INK); // vertical visor slit
  p.fillRect(28, 20, 7, 1, INK); // horizontal visor slit
  p.fillRect(27, 21, 1, 2, GOLD); // ear bosses (adjacent to the bowl)
  p.fillRect(36, 21, 1, 2, GOLD);
  p.fillRect(28, 24, 8, 2, GOLD); // chin band
  p.fillRect(29, 26, 7, 2, INK); // neck

  // Pauldrons + narrow chest with sun emblem + dark waist + red belt.
  plate(p, 25, 27, 3, 4);
  plate(p, 35, 27, 3, 4);
  plate(p, 28, 28, 8, 7);
  sunDisc(p, 31, 31);
  p.fillRect(28, 35, 8, 1, INK);
  belt(p, 27, 11, 30, 36);

  // Legs spread: back leg (left) and front leg (right); pose 1 scissors.
  guardLeg(p, backX, 38, backX - 1, backX + 2, 0);
  guardLeg(p, frontX, 38, frontFootL, frontFootR, frontDrop);

  // Spear at the left of the body; arm bridge from the chest.
  spear(p, spearX, gripY);
  line2(p, 28, 32, spearX + 1, gripY - 1, INK);
  p.fillRect(spearX - 1, gripY - 1, 3, 2, INK);

  // Shield front-right; dominant disc covers the arm bridge.
  line2(p, 35, 31, shieldCX - 10, shieldCY, INK);
  solarShield(p, shieldCX, shieldCY, 11);
  return p;
}

/** dir 2 — N, back. Full red plume fan, shield slung on the back, spear behind. */
function drawBack(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const spearX = pose ? 22 : 20;
  const gripY = pose ? 36 : 39;
  const fanDX = pose ? 1 : 0;
  const shieldCX = 42;
  const shieldCY = 30;
  const backX = pose ? 26 : 27;
  const frontX = pose ? 35 : 34;
  const frontFootL = pose ? 34 : 33;
  const frontFootR = pose ? 38 : 37;
  const frontDrop = pose ? -1 : 0;

  // Full 2-tone plume fan (amber top edge, red body, gold comb at the base).
  p.fillRect(25 + fanDX, 16, 14, 1, AMBER);
  p.fillRect(24 + fanDX, 17, 16, 2, RED);
  p.fillRect(25 + fanDX, 19, 14, 1, RED);
  p.fillRect(29 + fanDX, 19, 5, 1, GOLD);

  // Helmet back: ivory bowl, gold trim, ear bosses, dark neck.
  p.fillRect(28, 20, 8, 6, INK);
  p.fillRect(29, 21, 6, 4, CREAM);
  p.fillRect(27, 21, 1, 2, GOLD);
  p.fillRect(36, 21, 1, 2, GOLD);
  p.fillRect(29, 24, 6, 1, GOLD);
  p.fillRect(29, 26, 7, 2, INK);

  // Backplate + pauldrons + spinal ridge + red sash.
  plate(p, 24, 27, 4, 4);
  plate(p, 36, 27, 4, 4);
  plate(p, 27, 28, 10, 7);
  p.fillRect(30, 29, 2, 5, INK); // ridge
  p.fillRect(28, 31, 8, 1, RED); // sash
  p.fillRect(29, 32, 6, 1, RED);
  p.fillRect(28, 35, 8, 1, INK); // dark waist gap
  belt(p, 27, 11, 30, 36);

  guardLeg(p, backX, 38, backX - 1, backX + 2, 0);
  guardLeg(p, frontX, 38, frontFootL, frontFootR, frontDrop);

  // Spear behind, slightly right of center; bridge from the backplate.
  spear(p, spearX, gripY);
  line2(p, 27, 33, spearX + 1, gripY - 1, INK);
  p.fillRect(spearX - 1, gripY - 1, 3, 2, INK);

  // Shield slung on the back, partially behind the torso.
  solarShield(p, shieldCX, shieldCY, 10);
  return p;
}

/** dir 1 — NE, back three-quarter. Plume at the back-left, shield back-right. */
function drawBack3Q(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const spearX = pose ? 16 : 14;
  const gripY = pose ? 36 : 39;
  const plumeDX = pose ? -1 : 0;
  const shieldCX = 43;
  const shieldCY = 29;
  const backX = pose ? 25 : 26;
  const frontX = pose ? 36 : 35;
  const frontFootL = pose ? 36 : 35;
  const frontFootR = pose ? 39 : 38;
  const frontDrop = pose ? -1 : 0;

  // Plume on the back-left; gold comb spans the gate band at y16.
  p.fillRect(22 + plumeDX, 11, 7, 1, AMBER);
  p.fillRect(21 + plumeDX, 12, 8, 3, RED);
  p.fillRect(21 + plumeDX, 15, 8, 1, INK);
  p.set(28 + plumeDX, 11, GOLD);
  p.fillRect(26, 16, 11, 2, GOLD);

  // Helmet: bowl shifted right, visor slit on the visible side, ear boss.
  p.fillRect(29, 18, 8, 8, INK);
  p.fillRect(30, 19, 6, 5, CREAM);
  p.fillRect(33, 20, 3, 2, INK); // visor slit on the visible side
  p.fillRect(29, 21, 1, 2, GOLD);
  p.fillRect(31, 23, 5, 1, GOLD); // cheek trim
  p.fillRect(29, 24, 8, 2, GOLD); // chin band
  p.fillRect(30, 26, 7, 2, INK); // neck

  // 3Q torso: back pauldron, backplate with ridge + sash, front pauldron.
  plate(p, 24, 27, 4, 4);
  plate(p, 27, 28, 9, 7);
  p.fillRect(29, 30, 2, 4, INK);
  p.fillRect(29, 31, 5, 1, RED);
  p.fillRect(30, 32, 4, 1, RED);
  plate(p, 35, 27, 4, 4);
  p.fillRect(28, 35, 8, 1, INK);
  belt(p, 27, 12, 30, 36);

  guardLeg(p, backX, 38, backX - 1, backX + 2, 0);
  guardLeg(p, frontX, 38, frontFootL, frontFootR, frontDrop);

  // Spear front-left; bridge from the backplate.
  spear(p, spearX, gripY);
  line2(p, 27, 32, spearX + 1, gripY - 1, INK);
  p.fillRect(spearX - 1, gripY - 1, 3, 2, INK);

  // Shield on the back-right, partially behind the body.
  solarShield(p, shieldCX, shieldCY, 10);
  return p;
}

/** dir 7 — SE, front three-quarter. Crest band, shield front-right, spear left. */
function drawFront3Q(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const spearX = pose ? 18 : 16;
  const gripY = pose ? 36 : 39;
  const crestDX = pose ? 1 : 0;
  const shieldCX = 47;
  const shieldCY = 31;
  const backX = pose ? 26 : 27;
  const frontX = pose ? 36 : 34;
  const frontFootL = pose ? 35 : 33;
  const frontFootR = pose ? 39 : 37;
  const frontDrop = pose ? -1 : 0;

  // Crest: red sides with an amber top edge and gold side fins.
  p.fillRect(25 + crestDX, 16, 14, 1, AMBER);
  p.fillRect(24 + crestDX, 17, 16, 1, RED);
  p.fillRect(25 + crestDX, 18, 14, 1, RED);
  p.fillRect(23 + crestDX, 16, 2, 2, GOLD);
  p.fillRect(39 + crestDX, 16, 2, 2, GOLD);

  // Helmet: bowl shifted right, T-visor, ear bosses, chin band.
  p.fillRect(29, 18, 8, 8, INK);
  p.fillRect(30, 19, 6, 5, CREAM);
  p.fillRect(31, 19, 3, 5, INK);
  p.fillRect(30, 20, 7, 1, INK);
  p.fillRect(28, 21, 1, 2, GOLD);
  p.fillRect(37, 21, 1, 2, GOLD);
  p.fillRect(29, 24, 8, 2, GOLD);
  p.fillRect(30, 26, 7, 2, INK);

  // Pauldrons + chest with sun emblem + dark waist + red belt.
  plate(p, 24, 27, 4, 4);
  plate(p, 27, 28, 9, 7);
  sunDisc(p, 31, 31);
  plate(p, 35, 27, 4, 4);
  p.fillRect(28, 35, 8, 1, INK);
  belt(p, 26, 13, 30, 36);

  guardLeg(p, backX, 38, backX - 1, backX + 2, 0);
  guardLeg(p, frontX, 38, frontFootL, frontFootR, frontDrop);

  // Spear front-left; bridge from the chest.
  spear(p, spearX, gripY);
  line2(p, 27, 32, spearX + 1, gripY - 1, INK);
  p.fillRect(spearX - 1, gripY - 1, 3, 2, INK);

  // Shield front-right; dominant disc covers the arm bridge.
  line2(p, 35, 31, shieldCX - 10, shieldCY, INK);
  solarShield(p, shieldCX, shieldCY, 11);
  return p;
}

/** Authored painters by direction. */
const AUTHORED_PAINTERS: Readonly<Record<number, (pose: number) => Pix>> = {
  0: drawSide,
  1: drawBack3Q,
  2: drawBack,
  6: drawFront,
  7: drawFront3Q,
};

/**
 * RAW authored cell for directions 0,1,2,6,7 (throws otherwise — mirrors are
 * derived at lookup time, never hand-authored). `pose` 0|1, clamped.
 */
export function drawLumenGuardCandidate(dir: number, pose: number): Pix {
  const d = ((Math.floor(dir) % 8) + 8) % 8;
  const painter = AUTHORED_PAINTERS[d];
  if (!painter) throw new Error(`lumen-guard candidate: direction ${d} is not authored`);
  const p = Math.max(0, Math.min(1, Math.floor(pose)));
  return painter(p);
}

/**
 * Pure RAW frame lookup over all 8 directions x 2 poses (the contract seam).
 * Directions 3, 4, 5 are exact horizontal mirrors of 1, 0, 7.
 */
export function lumenGuardCandidateFrame(dir: number, pose: number): Pix {
  const d = ((Math.floor(dir) % 8) + 8) % 8;
  const p = Math.max(0, Math.min(1, Math.floor(pose)));
  if (d === 3) return drawLumenGuardCandidate(1, p).flipX();
  if (d === 4) return drawLumenGuardCandidate(0, p).flipX();
  if (d === 5) return drawLumenGuardCandidate(7, p).flipX();
  return drawLumenGuardCandidate(d, p);
}

/**
 * Runtime-ready cell: RAW source + the automatic two-layer combat exterior rim
 * applied EXACTLY ONCE (amber outer / cream inner), matching the frozen rows'
 * authoredCombatSprite behavior. Raw cells never carry the rim.
 */
export function lumenGuardCandidateRimmed(dir: number, pose: number): Pix {
  return applyCombatExteriorRim(
    lumenGuardCandidateFrame(dir, pose),
    LUMEN_GUARD_CANDIDATE_RIM_COLORS.outer,
    LUMEN_GUARD_CANDIDATE_RIM_COLORS.inner,
  );
}

/** 16 RAW cells in exact contract order (dir-major, poses inner). */
export const LUMEN_GUARD_CANDIDATE_RAW: readonly Pix[] = (() => {
  const frames: Pix[] = [];
  for (let pose = 0; pose < 2; pose++) {
    for (let dir = 0; dir < 8; dir++) frames.push(lumenGuardCandidateFrame(dir, pose));
  }
  return frames;
})();

export const LUMEN_GUARD_CANDIDATE_META = {
  assetId: 'sunweaver-lumen-guard',
  active: LUMEN_GUARD_CANDIDATE_ACTIVE,
  cell: LUMEN_GUARD_CANDIDATE_CELL,
  cols: 8,
  rows: 2,
  order: 'dir-major' as const,
  frameCount: 16,
  authored: LUMEN_GUARD_CANDIDATE_DIRS.authored,
  mirrored: LUMEN_GUARD_CANDIDATE_DIRS.mirrored,
  poseNames: ['primary', 'alternate'] as const,
  anchor: { x: 32, y: 63 },
};

// Compatibility exports for the Forge import CLI and the game override seam.
// The generated raw cells remain the single source of truth; no PNG or base64
// data is embedded here.
export const assetId = 'sunweaver-lumen-guard' as const;
export const algorithm = 'combat-reference-v1' as const;
export const cells = LUMEN_GUARD_CANDIDATE_RAW.map((frame, index) => ({
  key: `dir${index % 8}-pose${Math.floor(index / 8)}`,
  width: frame.w,
  height: frame.h,
  bytes: new Uint8Array(frame.d),
}));

export const SUNWEAVER_LUMEN_GUARD_CANDIDATE = {
  id: assetId,
  assetId,
  row: 0,
  frameCount: 16,
  cellW: LUMEN_GUARD_CANDIDATE_CELL,
  cellH: LUMEN_GUARD_CANDIDATE_CELL,
} as const;

/** Candidate override intentionally works before approval; normal source does not. */
export function candidateCombatCell(dir: number, pose: number): Pix {
  return lumenGuardCandidateFrame(dir, pose);
}

export function resolveCombatOverride(requestedAssetId: string | null | undefined):
  | { row: 0; rawCell: (dir: number, pose: number) => Pix }
  | null {
  return requestedAssetId === assetId ? { row: 0, rawCell: candidateCombatCell } : null;
}
