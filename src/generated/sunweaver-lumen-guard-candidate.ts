/**
 * sunweaver-lumen-guard-candidate.ts — LUMEN-ART image-backed candidate.
 *
 * Owner: Builder 2 (candidate pixel art). Contract: docs/LUMEN_GUARD_IMAGE_CANDIDATE.md.
 *
 * Deterministic RAW source cells for a replacement Lumen Guard: 16 cells of
 * 64x64 transparent RGBA in exact contract order:
 *   dir0-pose0 .. dir7-pose0, dir0-pose1 .. dir7-pose1  (dir-major).
 * Authored directions 0,1,2,6,7; directions 3,4,5 are exact horizontal mirrors
 * of 1,0,7 (derived by flipX at lookup time, never hand-pasted).
 *
 * Design choices are named after the committed reference
 * (tools/forge-art/candidates/sunweaver-lumen-guard/reference.png, a premium
 * gold/ivory hoplite):
 *   - gold/ivory armored humanoid: ivory (cream) plates with polished gold
 *     (ochre/amber) trim, dark ink undersuit at joints — the reference's
 *     "ivory breastplate/pauldrons/tassets/greaves with gold trim over dark
 *     undersuit" mapped to the Sunweaver material language of VS-1.
 *   - long vertical spear with an ENLARGED bright tip (cross-flared leaf head,
 *     ink outline + amber fill + cream highlight), tip reaching row 0 while
 *     the main body begins >= 16, keeping the frozen >=16px weapon extension.
 *   - large circular solar shield (hoplon): ink disc, gold rim, ivory ring,
 *     dark solar field with an eight-ray gold sunburst, red accent ring around
 *     a gold boss, and the single #FF00FF team lens at the boss center —
 *     reference's "gold rim / dark interior / ivory ring / eight-point sunburst
 *     / red ring / gold boss" exactly.
 *   - red fan crest: reference's "fan-like red crest with vertical red lines
 *     and a gold fin at the front top" — compact red plume sweeping back on
 *     the side views, a red crest band on front views, a full fan on the back
 *     view, always keeping the center band x29..31 clear of plume pixels above
 *     row 16 so the frozen guard-body-top gate holds.
 *   - Corinthian helmet with a T-shaped dark visor on front views, a side slit
 *     on profile, gold ear bosses, dark neck joint.
 *   - wide planted stance with separated legs (ivory greaves, gold knee caps,
 *     gold boots) and red belt tassels between the legs (reference sash/belt).
 *
 * Pose 0 = ready guard (spear high and straight, shield up, crest tall).
 * Pose 1 = stride (legs scissor 1-2px, spear shifts 1px, shield dips 1px,
 * crest settles) — a real gait, not a one-pixel copy.
 *
 * RAW cells contain NO automatic two-layer combat rim; the runtime seam
 * (lumenGuardCandidateRimmed / Builder 3 callback) applies
 * applyCombatExteriorRim exactly once. Palette is a restrained 5-group
 * Sunweaver set — ink / ivory cream / gold+amber / red / MAG — all
 * STARHOLD_PALETTE tokens (MAG reserved for the single team lens).
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
  // bottom shadow only when the interior is at least 2 rows tall, so small
  // plates (pauldrons, h=4) keep a visible ivory row
  if (h >= 5) p.fillRect(x + 1, y + h - 2, w - 2, 1, INK);
}

/** Small gold sun-disc emblem (chest). */
function sunDisc(p: Pix, cx: number, cy: number): void {
  p.circ(cx, cy, 2, GOLD);
  p.set(cx, cy, AMBER);
  p.set(cx - 2, cy, GOLD);
  p.set(cx + 2, cy, GOLD);
  p.set(cx, cy - 2, GOLD);
  p.set(cx, cy + 2, GOLD);
}

/**
 * Solar shield (reference hoplon): ink disc, gold rim, ivory ring, dark field,
 * eight-ray gold sunburst with amber spoke tips, red accent ring, gold boss,
 * MAG team lens at the boss center.
 */
function solarShield(p: Pix, cx: number, cy: number, r: number): void {
  p.circ(cx, cy, r, INK);
  if (r < 2) return;
  p.circ(cx, cy, r - 1, GOLD);
  if (r < 3) return;
  p.circ(cx, cy, r - 2, CREAM);
  if (r < 4) return;
  p.circ(cx, cy, r - 3, INK); // dark solar field
  const s = r - 4; // spoke reach
  if (s >= 2) {
    // compass spokes (2px thick) with amber tips
    p.fillRect(cx - 1, cy - s, 2, s, GOLD);
    p.fillRect(cx - 1, cy + 1, 2, s, GOLD);
    p.fillRect(cx - s, cy - 1, s, 2, GOLD);
    p.fillRect(cx + 1, cy - 1, s, 2, GOLD);
    p.set(cx, cy - s, AMBER);
    p.set(cx, cy + s, AMBER);
    p.set(cx - s, cy, AMBER);
    p.set(cx + s, cy, AMBER);
    // diagonal spokes
    for (let i = 1; i <= s; i++) {
      p.set(cx - i, cy - i, GOLD);
      p.set(cx + i, cy - i, GOLD);
      p.set(cx - i, cy + i, GOLD);
      p.set(cx + i, cy + i, GOLD);
    }
    p.set(cx - s, cy - s, AMBER);
    p.set(cx + s, cy - s, AMBER);
    p.set(cx - s, cy + s, AMBER);
    p.set(cx + s, cy + s, AMBER);
  }
  // red accent ring around the boss (radius 3)
  p.set(cx - 3, cy, RED);
  p.set(cx + 3, cy, RED);
  p.set(cx, cy - 3, RED);
  p.set(cx, cy + 3, RED);
  p.set(cx - 2, cy - 2, RED);
  p.set(cx + 2, cy - 2, RED);
  p.set(cx - 2, cy + 2, RED);
  p.set(cx + 2, cy + 2, RED);
  // gold boss + single MAG team lens (3x3, the one emissive focus)
  p.circ(cx, cy, 2, GOLD);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) p.set(cx + dx, cy + dy, MAG);
  }
  // key-light sparkle on the gold rim
  p.set(cx - r + 2, cy - 2, CREAM);
}

/**
 * Long spear with an enlarged bright tip (reference's large cross-flared gold
 * spearhead): tip rows 0..5, 3px shaft rows 6..grip, gold grip bands, ink
 * outline throughout so row-0 ink core pixels keep the frozen gates.
 * `gripY` is the grip center; pose 1 slides the grip 1px up the shaft.
 */
function spear(p: Pix, x: number, gripY: number): void {
  // tip rows 0..5 (center x)
  p.fillRect(x - 2, 0, 5, 1, INK);
  p.fillRect(x - 1, 0, 3, 1, AMBER);
  p.fillRect(x - 3, 1, 7, 2, INK); // barbs
  p.fillRect(x - 2, 1, 5, 2, AMBER);
  p.fillRect(x - 1, 1, 3, 2, CREAM);
  p.fillRect(x - 2, 3, 5, 1, INK);
  p.fillRect(x - 1, 3, 3, 1, AMBER);
  p.set(x, 3, CREAM);
  p.fillRect(x - 2, 4, 5, 1, INK);
  p.fillRect(x - 1, 4, 3, 1, GOLD);
  p.fillRect(x - 1, 5, 3, 1, INK);
  p.set(x, 5, GOLD);
  // shaft rows 6..gripY
  p.fillRect(x - 1, 6, 3, gripY - 6 + 1, INK);
  p.fillRect(x, 6, 1, gripY - 6 + 1, GOLD);
  // gold grip rings
  p.fillRect(x - 2, gripY - 3, 5, 1, INK);
  p.fillRect(x - 1, gripY - 3, 3, 1, GOLD);
  p.fillRect(x - 2, gripY, 5, 1, INK);
  p.fillRect(x - 1, gripY, 3, 1, GOLD);
}

/** Separated guard leg: ink outline, gold knee cap, ivory greave, gold boot. */
function guardLeg(
  p: Pix,
  x: number,
  w: number,
  top: number,
  footLeft: number,
  footRight: number,
  footDrop: number,
): void {
  p.fillRect(x, top, w, FEET - top + 1, INK);
  p.fillRect(x + 1, top + 1, w - 2, 2, INK); // hip shadow stays dark
  const kneeY = FEET - 7;
  p.fillRect(x, kneeY, w, 2, GOLD); // knee cap
  p.fillRect(x + 1, kneeY + 2, w - 2, FEET - kneeY - 4, CREAM); // greave
  p.fillRect(x + 1, FEET - 2, w - 2, 1, GOLD); // greave trim
  // boot: gold top, ink sole
  p.fillRect(footLeft, FEET - 1 + footDrop, footRight - footLeft + 1, 1, GOLD);
  p.fillRect(footLeft, FEET + footDrop, footRight - footLeft + 1, 1, INK);
}

/** Red belt with gold buckle and hanging tassels between the legs. */
function belt(p: Pix, x: number, w: number, buckleX: number): void {
  p.fillRect(x, 37, w, 1, INK);
  p.fillRect(x + 1, 37, w - 2, 1, RED);
  p.fillRect(buckleX, 37, 3, 1, GOLD);
  // tassels hang into the leg gap
  p.set(buckleX + 1, 38, RED);
  p.set(buckleX + 1, 39, RED);
  p.set(buckleX + 2, 38, RED);
  p.set(buckleX, 39, RED);
}

// ── Authored directions ──────────────────────────────────────────────────────
// Each direction is a distinct composition (shield position/size, spear x,
// crest presentation, body width, visor) — no mechanical rotation of one pose.

/** dir 0 — E, full right profile. Shield far side, spear near side, plume back. */
function drawSide(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const s = pose ? 1 : 0; // stride: legs scissor, crest settles, grip slides
  const plumeY = pose ? 12 : 13;
  const gripY = pose ? 39 : 40;

  // Plume (red fan sweeping back, outside the x29..31 gate band) + gold tip.
  p.fillRect(24, plumeY - 1, 3, 1, GOLD); // gold crest point (reference fin)
  p.fillRect(22, plumeY, 7, 4, RED);
  // Crown band (gold comb) at y17 keeps bodyTop = 17; front ridge at y16.
  p.fillRect(26, 17, 11, 1, GOLD);
  p.set(34, 16, GOLD);
  p.set(35, 16, GOLD);

  // Corinthian helmet: ivory bowl, gold trim, side visor slit, gold ear boss.
  p.fillRect(28, 18, 8, 8, INK);
  p.fillRect(29, 19, 6, 5, CREAM);
  p.fillRect(29, 23, 6, 1, GOLD);
  p.fillRect(32, 20, 3, 2, INK); // visor slit facing right
  p.fillRect(28, 21, 1, 2, GOLD); // ear boss
  p.fillRect(29, 26, 7, 2, INK); // neck joint

  // Torso: back pauldron, breastplate with sun emblem, red back sash.
  plate(p, 24, 27, 8, 4);
  plate(p, 30, 28, 9, 9);
  sunDisc(p, 34, 32);
  p.fillRect(25, 32, 3, 5, RED); // sash on the back side
  belt(p, 27, 11, 31);

  // Legs: back leg (left, foot to the back) and front leg (right, foot forward);
  // pose 1 scissors the front leg 2px forward and lifts it 2px.
  guardLeg(p, 25 - s, 5, 38, 23 - s, 29 - s, 0);
  guardLeg(p, 33 + (pose ? 2 : 0), 5, 38 - (pose ? 2 : 0), 33 + (pose ? 2 : 0), 39 + (pose ? 2 : 0), 0);

  // Spear on the near-left; arm bridge from the shoulder blade to the grip.
  spear(p, 11, gripY);
  line2(p, 25, 32, 13, 38, INK);
  p.fillRect(9, gripY - 2, 5, 2, INK); // gloved hand over the grip

  // Shield: large solar hoplon forward of the body.
  solarShield(p, 48, 30, 11);
  return p;
}

/** dir 6 — S, front. T-visor, red crest band, shield front-right, spear left. */
function drawFront(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const s = pose ? 1 : 0;
  const crestY = pose ? 17 : 16;
  const gripY = pose ? 39 : 40;

  // Red crest band over the helmet (columns 29..31 covered -> bodyTop 16/17).
  p.fillRect(24, crestY, 15, 2, RED);
  // Helmet bowl + T-visor + gold ear bosses.
  p.fillRect(27, 18, 9, 8, INK);
  p.fillRect(28, 19, 7, 5, CREAM);
  p.fillRect(28, 23, 7, 1, GOLD);
  p.fillRect(30, 19, 3, 5, INK); // vertical visor slit
  p.fillRect(28, 20, 7, 1, INK); // horizontal visor slit
  p.fillRect(26, 21, 1, 2, GOLD); // ear bosses
  p.fillRect(36, 21, 1, 2, GOLD);
  p.fillRect(29, 26, 7, 2, INK); // neck

  // Pauldrons + breastplate with sun emblem + red sash.
  plate(p, 23, 27, 8, 4);
  plate(p, 32, 27, 8, 4);
  plate(p, 27, 29, 9, 8);
  sunDisc(p, 31, 33);
  p.set(24, 31, RED); // sash diagonal (left shoulder)
  p.set(25, 32, RED);
  p.set(25, 33, RED);
  p.set(26, 34, RED);
  belt(p, 26, 11, 30);

  // Legs spread wider in pose 1.
  guardLeg(p, 26 - s, 5, 38, 26 - s, 30 - s, 0);
  guardLeg(p, 33 + s, 5, 38 - s, 33 + s, 37 + s, 0);

  // Spear at the left of the body, arm bridge from the left pauldron.
  spear(p, 20, gripY);
  line2(p, 26, 31, 21, 38, INK);
  p.fillRect(18, gripY - 2, 5, 2, INK);

  // Shield front-right, overlapping the body edge.
  solarShield(p, 46, 30, 10);
  return p;
}

/** dir 2 — N, back. Full red plume fan, shield slung on the back, spear behind. */
function drawBack(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const s = pose ? 1 : 0;
  const plumeY = pose ? 17 : 16;
  const gripY = pose ? 39 : 40;

  // Full fan crest; gold comb at the fan base (ochre, not a rim color).
  p.fillRect(23, plumeY, 19, 3, RED);
  p.fillRect(24, plumeY + 3, 17, 1, RED);
  p.fillRect(29, plumeY + 3, 5, 1, GOLD); // comb at the helmet edge
  // Helmet back: ivory bowl, gold trim, ear bosses.
  p.fillRect(28, 20, 8, 6, INK);
  p.fillRect(29, 21, 6, 4, CREAM);
  p.fillRect(29, 24, 6, 1, GOLD);
  p.fillRect(26, 21, 1, 2, GOLD);
  p.fillRect(35, 21, 1, 2, GOLD);
  p.fillRect(29, 26, 7, 2, INK); // neck

  // Backplate + pauldrons + red back sash.
  plate(p, 25, 27, 7, 4);
  plate(p, 32, 27, 7, 4);
  plate(p, 27, 28, 9, 9);
  p.fillRect(30, 32, 5, 1, RED); // sash across the back
  p.fillRect(31, 33, 3, 1, RED);
  belt(p, 26, 11, 30);

  guardLeg(p, 27 - s, 4, 38, 27 - s, 30 - s, 0);
  guardLeg(p, 34 + s, 4, 38 - s, 34 + s, 37 + s, 0);

  // Spear behind, slightly right of center; bridge from the backplate.
  spear(p, 20, gripY);
  line2(p, 29, 32, 21, 38, INK);
  p.fillRect(18, gripY - 2, 5, 2, INK);

  // Shield slung on the back (smaller, far side).
  solarShield(p, 43, 30, 9);
  return p;
}

/** dir 1 — NE, back three-quarter. Plume at the back-left, shield back-right. */
function drawBack3Q(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const s = pose ? 1 : 0;
  const plumeY = pose ? 12 : 13;
  const gripY = pose ? 39 : 40;

  // Plume on the back-left; gold comb spans the gate band at y16.
  p.fillRect(22, plumeY, 7, 4, RED);
  p.fillRect(29, 16, 8, 2, GOLD);
  // Helmet: bowl + back-right visor slit + ear boss.
  p.fillRect(29, 18, 8, 8, INK);
  p.fillRect(30, 19, 6, 5, CREAM);
  p.fillRect(30, 23, 6, 1, GOLD);
  p.fillRect(33, 20, 3, 2, INK); // visor slit on the visible side
  p.fillRect(29, 21, 1, 2, GOLD);
  p.fillRect(30, 26, 7, 2, INK); // neck

  // Wider 3Q torso: back pauldron + front pauldron + one plate.
  plate(p, 24, 27, 8, 4);
  plate(p, 33, 27, 8, 4);
  plate(p, 26, 28, 13, 9);
  belt(p, 26, 13, 31);

  guardLeg(p, 27 - s, 4, 38, 27 - s, 30 - s, 0);
  guardLeg(p, 35 + s, 4, 38 - s, 35 + s, 38 + s, 0);

  // Spear front-left; bridge from the left pauldron to the grip.
  spear(p, 14, gripY);
  line2(p, 25, 32, 15, 38, INK);
  p.fillRect(12, gripY - 2, 5, 2, INK);

  // Shield on the back-right, partially behind the body.
  solarShield(p, 43, 29, 9);
  return p;
}

/** dir 7 — SE, front three-quarter. Crest band, shield front-right, spear left. */
function drawFront3Q(pose: number): Pix {
  const p = Pix.alloc(LUMEN_GUARD_CANDIDATE_CELL, LUMEN_GUARD_CANDIDATE_CELL);
  const s = pose ? 1 : 0;
  const crestY = pose ? 17 : 16;
  const gripY = pose ? 39 : 40;

  // Crest: red sides with a gold comb across the gate band at y16/17.
  p.fillRect(24, crestY, 5, 2, RED);
  p.fillRect(34, crestY, 5, 2, RED);
  p.fillRect(29, crestY, 5, 2, GOLD);
  // Helmet: bowl + T-visor + ear bosses.
  p.fillRect(27, 18, 9, 8, INK);
  p.fillRect(28, 19, 7, 5, CREAM);
  p.fillRect(28, 23, 7, 1, GOLD);
  p.fillRect(30, 19, 3, 5, INK);
  p.fillRect(28, 20, 7, 1, INK);
  p.fillRect(26, 21, 1, 2, GOLD);
  p.fillRect(36, 21, 1, 2, GOLD);
  p.fillRect(29, 26, 7, 2, INK); // neck

  // Pauldrons + breastplate + sun emblem + sash.
  plate(p, 23, 27, 8, 4);
  plate(p, 32, 27, 8, 4);
  plate(p, 27, 29, 9, 8);
  sunDisc(p, 31, 33);
  p.set(24, 31, RED);
  p.set(25, 32, RED);
  p.set(25, 33, RED);
  p.set(26, 34, RED);
  belt(p, 25, 14, 30);

  guardLeg(p, 27 - s, 4, 38, 27 - s, 30 - s, 0);
  guardLeg(p, 35 + s, 4, 38 - s, 35 + s, 38 + s, 0);

  // Spear front-left.
  spear(p, 16, gripY);
  line2(p, 26, 31, 15, 38, INK);
  p.fillRect(13, gripY - 2, 5, 2, INK);

  // Shield front-right, overlapping the body edge.
  solarShield(p, 47, 31, 10);
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
