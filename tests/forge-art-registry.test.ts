// FAL — registry contract (FORGE_ART_LAB.md §4, §5; audits A2/A7 FAL-QA-01..05, FAL-QA-17).
// Frozen catalog: exactly 14 entries, canonical ids/labels, no legacy vocabulary in the
// public surface, correct adapter dims, worldScale table, mirror pairs, grid geometry.
// Conventions: node:assert/strict, top-level asserts, failure arrays asserted empty at END.

import assert from 'node:assert/strict';
import * as registryModule from '../tools/forge-art/src/registry';
import * as adapterModule from '../tools/forge-art/src/adapters';
import { gridGeometryFor } from '../tools/forge-art/src/baseline-schema';

const failures: string[] = [];
const requireOk = (cond: boolean, msg: string): void => { if (!cond) failures.push(msg); };

// ---- module surface ----
const registryAny = registryModule as unknown as Record<string, unknown>;
const entries = (registryAny.CATALOG ?? registryAny.catalog) as AssetDefinition[] | undefined;
assert.ok(Array.isArray(entries), 'registry must export the public catalog (CATALOG, 14 entries)');
const ASSET_BY_ID = registryAny.ASSET_BY_ID as Record<string, AssetDefinition> | undefined;
assert.equal(typeof ASSET_BY_ID, 'object', 'registry must export ASSET_BY_ID');

const adaptersAny = adapterModule as unknown as Record<string, unknown>;
const getFrames = (adaptersAny.getFrames ?? (adaptersAny.adapters as Record<string, unknown> | undefined)?.getFrames) as
  (assetId: string, group?: string) => FrameSource[];
assert.equal(typeof getFrames, 'function', 'adapters.getFrames(assetId, group?) must exist (§4)');

interface FrameSource { key: string; pix: { w: number; h: number; d: Uint8ClampedArray }; error?: string }
type AssetDefinition = {
  assetId: string; label: string; faction: string; category: string; role: string;
  adapterId: string; dims?: { w: number; h: number }; frames?: string[];
  anchor?: { x: number; y: number }; worldScale?: { x: number; y: number };
  mirrorPairs?: Array<readonly [number, number]>; legacyKind?: number; legacyCiv?: number;
};

// ---- §4 table: the 14 entries, verbatim ----
const EXPECTED_LABELS = [
  'Worker', 'Worker', 'Wind Strider', 'Grav-Skimmer', 'Lumen Guard', 'Solar Strider',
  'Rift Guard', 'Burden Walker', 'Core', 'Core', 'Habitat', 'Habitat', 'Yard', 'Yard',
].sort();

const EXPECTED_LEGACY: Record<string, { kind: number; civ: number }> = {
  'sunweaver-worker': { kind: 0, civ: 0 },
  'gravemark-worker': { kind: 0, civ: 1 },
  'sunweaver-wind-strider': { kind: 1, civ: 0 },
  'gravemark-grav-skimmer': { kind: 1, civ: 1 },
  'sunweaver-lumen-guard': { kind: 2, civ: 0 },
  'sunweaver-solar-strider': { kind: 4, civ: 0 },
  'gravemark-rift-guard': { kind: 2, civ: 1 },
  'gravemark-burden-walker': { kind: 5, civ: 1 },
  'sunweaver-core': { kind: 10, civ: 0 },
  'gravemark-core': { kind: 10, civ: 1 },
  'sunweaver-habitat': { kind: 11, civ: 0 },
  'gravemark-habitat': { kind: 11, civ: 1 },
  'sunweaver-yard': { kind: 12, civ: 0 },
  'gravemark-yard': { kind: 12, civ: 1 },
};

const EXPECTED_WORLD_SCALE: Record<string, [number, number]> = {
  'sunweaver-lumen-guard': [1.59, 1.89],
  'sunweaver-solar-strider': [2.05, 1.54],
  'gravemark-rift-guard': [1.67, 1.92],
  'gravemark-burden-walker': [2.05, 1.81],
  'sunweaver-worker': [1.55, 2.32],
  'gravemark-worker': [1.55, 2.32],
  'sunweaver-wind-strider': [0.96, 1.12],
  'gravemark-grav-skimmer': [0.96, 1.12],
  'sunweaver-core': [2.4, 2.4],
  'gravemark-core': [2.4, 2.4],
  'sunweaver-habitat': [1.75, 1.75],
  'gravemark-habitat': [1.75, 1.75],
  'sunweaver-yard': [1.85, 1.85],
  'gravemark-yard': [1.85, 1.85],
};

// §5 grid geometry: cols x rows of cellW x cellH cells (dir-major frame order).
const EXPECTED_GRID: Record<string, { cellW: number; cellH: number; cols: number; rows: number }> = {
  combat: { cellW: 64, cellH: 64, cols: 8, rows: 2 },
  worker: { cellW: 32, cellH: 48, cols: 8, rows: 2 },
  scout: { cellW: 128, cellH: 128, cols: 1, rows: 1 },
  core: { cellW: 64, cellH: 64, cols: 1, rows: 1 },
  small: { cellW: 32, cellH: 32, cols: 1, rows: 1 },
};

// Banned legacy vocabulary (A7 FAL-QA-02): absent from ALL public strings.
const BANNED = ['starhold', 'sunfold', 'sunwoven', 'helion compact', 'kryos conclave', 'nihiline', 'voidmarked', 'vespari', 'aurion'];

// ---- 1. exactly 14 entries; ids kebab-case + unique ----
assert.equal(entries.length, 14, `registry must contain exactly 14 entries, got ${entries.length}`);
const ids = entries.map((e) => e.assetId);
assert.ok(new Set(ids).size === ids.length, 'assetIds must be unique');
const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
for (const id of ids) {
  assert.ok(ID_RE.test(id), `assetId must be kebab-case lower: "${id}"`);
}
assert.deepEqual(Object.keys(ASSET_BY_ID).sort(), [...ids].sort(), 'ASSET_BY_ID must cover exactly the catalog ids');
console.log(`registry ids: ${JSON.stringify(ids)}`);

// ---- 2. factions + labels ----
for (const e of entries) {
  requireOk(e.faction === 'sunweaver' || e.faction === 'gravemark', `${e.assetId} faction "${e.faction}" must be sunweaver|gravemark`);
  requireOk(e.category === 'unit' || e.category === 'building', `${e.assetId} category "${e.category}" must be unit|building`);
}
assert.deepEqual(entries.map((e) => e.label).sort(), EXPECTED_LABELS,
  'labels must be exactly the frozen 14 (Worker x2, Wind Strider, Grav-Skimmer, Lumen Guard, Solar Strider, Rift Guard, Burden Walker, Core x2, Habitat x2, Yard x2)');

// ---- 3. banned terms absent from the public surface ----
// legacyKind/legacyCiv are the ONLY fields allowed to carry legacy references (as numbers).
const PUBLIC_JSON = JSON.stringify(entries.map((e) => {
  const copy: Record<string, unknown> = { ...(e as unknown as Record<string, unknown>) };
  delete copy.legacyKind;
  delete copy.legacyCiv;
  return copy;
}));
const lower = PUBLIC_JSON.toLowerCase();
for (const term of BANNED) {
  assert.ok(!lower.includes(term), `banned legacy term "${term}" leaked into the registry public surface`);
}
for (const e of entries) {
  assert.equal(typeof e.legacyKind, 'number', `${e.assetId} must expose legacyKind privately (number)`);
  assert.equal(typeof e.legacyCiv, 'number', `${e.assetId} must expose legacyCiv privately (number)`);
}

// ---- 4. hidden faction absent: no civ index 2, no Nihiline/voidmarked anywhere ----
for (const e of entries) {
  requireOk(e.legacyCiv === 0 || e.legacyCiv === 1, `${e.assetId} legacyCiv ${e.legacyCiv} must be 0|1 (hidden faction civ 2 absent)`);
}

// ---- 5. legacy kind/civ table matches §4 exactly ----
for (const e of entries) {
  const want = EXPECTED_LEGACY[e.assetId];
  assert.ok(want, `unexpected assetId in catalog: ${e.assetId}`);
  assert.equal(e.legacyKind, want.kind, `${e.assetId} legacyKind`);
  assert.equal(e.legacyCiv, want.civ, `${e.assetId} legacyCiv`);
}

// ---- 6. adapter dims / frame counts (via adapters.getFrames, §4) ----
const CLASS_BY_ID: Record<string, 'combat' | 'worker' | 'scout' | 'building'> = {
  'sunweaver-lumen-guard': 'combat', 'sunweaver-solar-strider': 'combat',
  'gravemark-rift-guard': 'combat', 'gravemark-burden-walker': 'combat',
  'sunweaver-worker': 'worker', 'gravemark-worker': 'worker',
  'sunweaver-wind-strider': 'scout', 'gravemark-grav-skimmer': 'scout',
  'sunweaver-core': 'building', 'gravemark-core': 'building',
  'sunweaver-habitat': 'building', 'gravemark-habitat': 'building',
  'sunweaver-yard': 'building', 'gravemark-yard': 'building',
};

// Expected frame counts + cell dims per class (task table; §4 frame keys, dir-major).
const EXPECTED_FRAMES: Record<string, { count: number; w: number; h: number; keys: (d: number, p: number) => string }> = {
  combat: { count: 16, w: 64, h: 64, keys: (d, p) => `dir${d}-pose${p}` },
  worker: { count: 16, w: 32, h: 48, keys: (d, w) => `dir${d}-walk${w}` },
  scout: { count: 1, w: 128, h: 128, keys: () => 'hd' },
};

for (const entry of entries) {
  const klass = CLASS_BY_ID[entry.assetId];
  const frames = getFrames(entry.assetId);
  const spec = EXPECTED_FRAMES[klass];
  const wantCount = spec ? spec.count : 1;
  const wantW = spec ? spec.w : (entry.legacyKind === 10 ? 64 : 32);
  const wantH = spec ? spec.h : (entry.legacyKind === 10 ? 64 : 32);
  requireOk(frames.length === wantCount, `${entry.assetId}: adapter produced ${frames.length} frames, expected ${wantCount}`);
  requireOk(frames.every((f) => f.pix.w === wantW && f.pix.h === wantH),
    `${entry.assetId}: every frame must be ${wantW}x${wantH} (got ${frames.map((f) => `${f.pix.w}x${f.pix.h}`).join(',')})`);
  requireOk(frames.every((f) => !f.error), `${entry.assetId}: no frame may carry a capture error`);
  if (spec) {
    const expectedKeys = Array.from({ length: spec.count }, (_, i) => spec.keys(i % 8, Math.floor(i / 8)));
    requireOk(JSON.stringify(frames.map((f) => f.key)) === JSON.stringify(expectedKeys),
      `${entry.assetId}: frame keys must be dir-major ${expectedKeys.join(',')} (got ${frames.map((f) => f.key).join(',')})`);
  } else {
    requireOk(frames.length === 1 && frames[0].key === 'iso', `${entry.assetId}: building must be 1 frame keyed "iso"`);
  }
  if (entry.dims) {
    requireOk(entry.dims.w === wantW && entry.dims.h === wantH,
      `${entry.assetId}: entry.dims ${entry.dims.w}x${entry.dims.h} must equal adapter cell dims ${wantW}x${wantH}`);
  }
}

// Sunweaver worker action group: 32 frames of 32x48 (§4 "action rows via drawWorkerAction8Dir");
// gravemark worker has NO action rows (helion-only).
{
  const sunActions = getFrames('sunweaver-worker', 'actions');
  requireOk(sunActions.length === 32, `sunweaver worker action group must have 32 frames, got ${sunActions.length}`);
  requireOk(sunActions.every((f) => f.pix.w === 32 && f.pix.h === 48),
    `sunweaver worker action frames must be 32x48 (got ${sunActions.map((f) => `${f.pix.w}x${f.pix.h}`).join(',')})`);
  requireOk(sunActions.every((f) => /^act\d-dir\d$/.test(f.key)),
    `sunweaver worker action keys must be act{a}-dir{d} (got ${sunActions.map((f) => f.key).join(',')})`);
  const graveActions = getFrames('gravemark-worker', 'actions');
  requireOk(graveActions.length === 0, `gravemark worker must have NO action group (got ${graveActions.length})`);
  console.log(`sunweaver worker action group: ${sunActions.length} frames 32x48 (${sunActions[0].key}..${sunActions[27].key}); gravemark: ${graveActions.length}`);
}

// ---- 7. worldScale table equals render.ts values exactly ----
for (const entry of entries) {
  const want = EXPECTED_WORLD_SCALE[entry.assetId];
  assert.ok(want, `unexpected assetId for worldScale: ${entry.assetId}`);
  assert.ok(entry.worldScale && typeof entry.worldScale.x === 'number' && typeof entry.worldScale.y === 'number',
    `${entry.assetId}: worldScale {x,y} numbers required`);
  assert.deepEqual([entry.worldScale.x, entry.worldScale.y], want, `${entry.assetId} worldScale must be [${want}]`);
}

// ---- 8. mirrorPairs: [[1,3],[0,4],[7,5]] on combat units + workers; absent on buildings ----
const MIRROR_PAIRS: Array<readonly [number, number]> = [[1, 3], [0, 4], [7, 5]];
for (const entry of entries) {
  const klass = CLASS_BY_ID[entry.assetId];
  if (klass === 'building') {
    requireOk(entry.mirrorPairs === undefined || entry.mirrorPairs.length === 0,
      `${entry.assetId}: buildings must NOT carry mirrorPairs`);
  } else if (klass === 'combat' || klass === 'worker') {
    assert.deepEqual(entry.mirrorPairs, MIRROR_PAIRS, `${entry.assetId} mirrorPairs must be [[1,3],[0,4],[7,5]]`);
  }
}

// ---- 9. gridGeometryFor matches §5 grid sizes ----
for (const entry of entries) {
  const klass = CLASS_BY_ID[entry.assetId];
  const want = klass === 'combat' ? EXPECTED_GRID.combat
    : klass === 'worker' ? EXPECTED_GRID.worker
      : klass === 'scout' ? EXPECTED_GRID.scout
        : entry.legacyKind === 10 ? EXPECTED_GRID.core : EXPECTED_GRID.small;
  let got: { cellW: number; cellH: number; cols: number; rows: number; width: number; height: number } | undefined;
  try { got = gridGeometryFor(entry.assetId); } catch (err) { failures.push(`${entry.assetId}: gridGeometryFor threw: ${(err as Error).message}`); }
  if (got) {
    requireOk(got.cellW === want.cellW && got.cellH === want.cellH && got.cols === want.cols && got.rows === want.rows,
      `${entry.assetId}: gridGeometryFor ${JSON.stringify(got)} must be ${JSON.stringify(want)}`);
  }
}

// ---- 10. light field validation per §4 AssetDefinition ----
for (const entry of entries) {
  requireOk(typeof entry.adapterId === 'string' && entry.adapterId.length > 0, `${entry.assetId}: adapterId string required`);
  requireOk(Array.isArray(entry.frames) && entry.frames.length > 0, `${entry.assetId}: frames: FrameKey[] required`);
  requireOk(entry.anchor != null && typeof entry.anchor.x === 'number' && typeof entry.anchor.y === 'number',
    `${entry.assetId}: anchor {x,y} numbers required`);
}

// ---- summary ----
console.log(`registry failures: ${JSON.stringify(failures)}`);
assert.equal(failures.length, 0, `registry contract RED: ${failures.join('; ')}`);
console.log('FAL registry contract: PASS');
