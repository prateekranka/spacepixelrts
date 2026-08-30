// Lumen Guard image-candidate runtime seam — RED/GREEN contract tests.
//
// Covers the narrow optional combat override seam from
// docs/LUMEN_GUARD_IMAGE_CANDIDATE.md: one optional, row-scoped override
// feeding the normal combat atlas path, byte-compatible when absent,
// baseline-fallback for missing/unknown/malformed candidate data, and the
// existing exterior rim stage applied exactly once to candidate cells.
//
// The fixture override used here is a typed seam-mechanism test double (a
// solid 64x64 block) — it proves row-scoping and rim behavior WITHOUT
// substituting candidate pixels. Real candidate pixels come only from
// Builder 2's generated source (src/generated/sunweaver-lumen-guard-candidate.ts).

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  COMBAT_CELL,
  COMBAT_LIVE_POSES,
  COMBAT_ROWS,
  Pix,
  applyCombatExteriorRim,
  combatRowCell,
  drawCombatSprite,
  type CombatRowOverride,
} from '../src/sprites';
import {
  SUNWEAVER_LUMEN_GUARD_CANDIDATE,
  candidateCombatCell,
  resolveCombatOverride,
} from '../src/generated/sunweaver-lumen-guard-candidate';
import { lumenGuardAcceptedFrame } from '../src/generated/sunweaver-lumen-guard-accepted';
import { STARHOLD_PALETTE } from '../src/palette';

const sha = (pix: Pix): string => createHash('sha256').update(pix.d).digest('hex');

const paletteRgba = (hex: string): [number, number, number, number] => {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff, 255];
};

/** Row-0 rim colors, derived from the frozen palette (same values sprites.ts uses). */
const ROW0_RIM_A = paletteRgba(STARHOLD_PALETTE.amber);
const ROW0_RIM_B = paletteRgba(STARHOLD_PALETTE.cream);

/** Seam-mechanism fixture cell: opaque 56x56 magenta block, transparent border. */
function fixtureCell(): Pix {
  const p = Pix.alloc(COMBAT_CELL, COMBAT_CELL);
  for (let y = 4; y < COMBAT_CELL - 4; y++) {
    for (let x = 4; x < COMBAT_CELL - 4; x++) p.set(x, y, [255, 0, 255, 255]);
  }
  return p;
}

const fixtureOverride: CombatRowOverride = { row: 0, rawCell: () => fixtureCell() };

const allDirPose = (): Array<[number, number]> => {
  const cells: Array<[number, number]> = [];
  for (let dir = 0; dir < 8; dir++) {
    for (let pose = 0; pose < COMBAT_LIVE_POSES; pose++) cells.push([dir, pose]);
  }
  return cells;
};

// ── 1. Seam contract — Builder 2's generated source must keep these exports ──

assert.equal(SUNWEAVER_LUMEN_GUARD_CANDIDATE.id, 'sunweaver-lumen-guard');
assert.equal(SUNWEAVER_LUMEN_GUARD_CANDIDATE.row, 0);

// The generated source is present in the integrated vertical slice: every frame
// is a real 64x64 raw cell and the three permitted directions are derived by
// exact horizontal mirrors.
for (const [dir, pose] of allDirPose()) {
  const cell = candidateCombatCell(dir, pose);
  assert.ok(cell !== null, `candidateCombatCell(${dir},${pose}) must provide a frame`);
  assert.equal(cell.w, 64);
  assert.equal(cell.h, 64);
}
for (const [mirror, source] of [[3, 1], [4, 0], [5, 7]] as const) {
  for (let pose = 0; pose < COMBAT_LIVE_POSES; pose++) {
    const sourceCell = candidateCombatCell(source, pose);
    const mirrorCell = candidateCombatCell(mirror, pose);
    assert.ok(sourceCell && mirrorCell);
    assert.deepEqual(Array.from(mirrorCell.d), Array.from(sourceCell.flipX().d), `dir${mirror} must mirror dir${source}`);
  }
}

// ── 2. Override resolution — unknown/missing query ids fall back to baseline ──

assert.ok(resolveCombatOverride('sunweaver-lumen-guard') !== null, 'known candidate id must resolve');
assert.equal(resolveCombatOverride(null), null, 'missing query must not resolve an override');
assert.equal(resolveCombatOverride(''), null, 'empty query must not resolve an override');
assert.equal(resolveCombatOverride('not-a-real-candidate'), null, 'unknown query must not resolve an override');

// Resolved candidate flows through the normal rimmed atlas path. After formal
// acceptance, the no-query row-0 source must consume an independent accepted
// snapshot. The draft candidate module remains isolated for the next art round.
const resolved = resolveCombatOverride('sunweaver-lumen-guard');
assert.ok(resolved !== null);
let differingFrames = 0;
for (const [dir, pose] of allDirPose()) {
  const candidateRaw = candidateCombatCell(dir, pose);
  assert.ok(candidateRaw !== null);
  const acceptedRaw = lumenGuardAcceptedFrame(dir, pose);
  assert.deepEqual(
    Array.from(acceptedRaw.d),
    Array.from(candidateRaw.d),
    `accepted snapshot must begin byte-identical to approved candidate dir${dir}-pose${pose}`,
  );
  const actual = combatRowCell(0, dir, pose, resolved);
  const expected = applyCombatExteriorRim(acceptedRaw, ROW0_RIM_A, ROW0_RIM_B);
  assert.deepEqual(Array.from(actual.d), Array.from(expected.d), `candidate rim mismatch dir${dir}-pose${pose}`);
  if (sha(expected) !== sha(drawCombatSprite(0, dir, pose))) differingFrames++;
}
assert.equal(differingFrames, 0, 'accepted no-query row 0 must equal all 16 approved snapshot frames');

// ── 3. Default path is byte-identical (existing callers pass no override) ──

for (let row = 0; row < COMBAT_ROWS; row++) {
  for (const [dir, pose] of allDirPose()) {
    assert.equal(
      sha(combatRowCell(row, dir, pose, undefined)),
      sha(drawCombatSprite(row, dir, pose)),
      `no-override seam changed row ${row} cell dir${dir}-pose${pose}`,
    );
    assert.equal(
      sha(combatRowCell(row, dir, pose, null)),
      sha(drawCombatSprite(row, dir, pose)),
      `null-override seam changed row ${row} cell dir${dir}-pose${pose}`,
    );
  }
}

// ── 4. Row scoping — only row 0 changes under a row-0 override ──

for (const [dir, pose] of allDirPose()) {
  const overridden = combatRowCell(0, dir, pose, fixtureOverride);
  assert.notEqual(sha(overridden), sha(drawCombatSprite(0, dir, pose)), `row 0 dir${dir}-pose${pose} did not change`);
  for (let row = 1; row < COMBAT_ROWS; row++) {
    assert.equal(
      sha(combatRowCell(row, dir, pose, fixtureOverride)),
      sha(drawCombatSprite(row, dir, pose)),
      `row ${row} changed under a row-0 override (dir${dir}-pose${pose})`,
    );
  }
}

// ── 5. Existing exterior rim stage preserved — exactly once, same colors ──

{
  const raw = fixtureCell();
  const expected = applyCombatExteriorRim(raw, ROW0_RIM_A, ROW0_RIM_B);
  const actual = combatRowCell(0, 0, 0, fixtureOverride);
  assert.deepEqual(Array.from(actual.d), Array.from(expected.d), 'candidate cell rim must equal the single baseline rim stage');
  // The raw fixture had no amber/cream pixels; the rimmed cell must.
  let amber = 0;
  let cream = 0;
  for (let i = 0; i < actual.d.length; i += 4) {
    if (actual.d[i] === ROW0_RIM_A[0] && actual.d[i + 1] === ROW0_RIM_A[1] && actual.d[i + 2] === ROW0_RIM_A[2]) amber++;
    if (actual.d[i] === ROW0_RIM_B[0] && actual.d[i + 1] === ROW0_RIM_B[1] && actual.d[i + 2] === ROW0_RIM_B[2]) cream++;
  }
  assert.ok(amber > 0, 'candidate cell has no outer amber rim');
  assert.ok(cream > 0, 'candidate cell has no inner cream rim');
}

// ── 6. Missing / malformed / throwing candidate data falls back, no crash ──

const missingOverride: CombatRowOverride = { row: 0, rawCell: () => null };
const malformedOverride: CombatRowOverride = { row: 0, rawCell: () => Pix.alloc(32, 32) };
const throwingOverride: CombatRowOverride = {
  row: 0,
  rawCell: () => {
    throw new Error('candidate lookup exploded');
  },
};
for (const bad of [missingOverride, malformedOverride, throwingOverride]) {
  for (const [dir, pose] of allDirPose()) {
    assert.equal(
      sha(combatRowCell(0, dir, pose, bad)),
      sha(drawCombatSprite(0, dir, pose)),
      `bad override changed row 0 cell dir${dir}-pose${pose}`,
    );
  }
}

// ── 7. Frame identity of the generated source contract (16 frames, 64x64) ──

assert.equal(COMBAT_CELL, 64);
assert.equal(COMBAT_ROWS, 4);
assert.equal(COMBAT_LIVE_POSES, 2);

console.log('lumen-guard-seam: all assertions PASS');
