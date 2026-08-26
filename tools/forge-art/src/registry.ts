/**
 * Forge Art Lab v1 — asset registry (docs/FORGE_ART_LAB.md §4).
 *
 * Public catalog: exactly 11 logical assets => 14 registry entries (Core/Habitat/Yard
 * exist once per faction). Legacy kind numbers / civ ids appear ONLY as the internal
 * numeric fields legacyKind/legacyCiv (never in rendered text, DOM ids, probe JSON,
 * manifests' public fields, or URLs). Hidden faction (voidmarked, civ 2) and deferred
 * kinds (Siege/Shade/UniqueB) never appear here.
 */
import type { ThresholdsKey } from './thresholds';

export type Faction = 'sunweaver' | 'gravemark';
export type AssetCategory = 'unit' | 'building';
export type AdapterId = 'combat' | 'worker8' | 'scout' | 'building';
/** Frame-group selector for adapters / baseline schema. 'primary' is the default. */
export type FrameGroup = string;

export type CombatFrameKey = `dir${number}-pose${0 | 1}`;
export type WorkerFrameKey = `dir${number}-walk${0 | 1}`;
export type ActionFrameKey = `act${number}-dir${number}`;
export type FrameKey = CombatFrameKey | WorkerFrameKey | 'hd' | 'iso';
export type AnyFrameKey = FrameKey | ActionFrameKey;
export type MirrorPair = readonly [number, number];

export interface AssetDefinition {
  assetId: string;
  label: string;
  faction: Faction;
  category: AssetCategory;
  role: string;
  adapterId: AdapterId;
  /**
   * Internal-only legacy mapping (numbers; never rendered, never in DOM ids, probe
   * JSON, manifests' public fields, or URLs). civ index: vespari=0, aurion=1.
   */
  legacyKind: number;
  legacyCiv: number;
  /** Source cell size in pixels (pre-upscale). */
  dims: { w: number; h: number };
  /** Facings the workbench must present (0..requiredFacings-1). */
  requiredFacings: number;
  /** Distinct authored facing cells (remaining facings are flipX mirrors). */
  authoredFacings: number;
  /** Dir pairs that are exact flipX mirrors: [[1,3],[0,4],[7,5]] where applicable. */
  mirrorPairs: readonly MirrorPair[];
  /** Primary frame keys in grid order (dirs across columns, poses/walks down rows). */
  frames: readonly FrameKey[];
  /** Optional named frame groups beyond the primary set ('actions' on sunweaver-worker only). */
  groups?: Readonly<Record<string, readonly AnyFrameKey[]>>;
  /** Ground-contact point in cell-local pixels. */
  anchor: { x: number; y: number };
  /** Frozen world scales (from src/render.ts). */
  worldScale: { x: number; y: number };
  paletteFamily: Faction;
  teamColorRule: string;
  emissiveRule: string;
  /** Atlas region the asset occupies at runtime (informational). */
  runtimeMapping: string;
  /** Rig fixture names applicable to this asset (§9 scene list). */
  contextFixtures: readonly string[];
  thresholdsKey: ThresholdsKey;
  /** Accepted-baseline source revision; null = not yet accepted. */
  baselineRevision: string | null;
}

/**
 * Combat frame keys in grid order: dirs across columns, poses down rows
 * (d = i % 8, p = floor(i / 8)) — matches the §5 cell-origin rule
 * originX = dir*CELL, originY = pose*CELL.
 */
export function combatFrameKeys(): readonly CombatFrameKey[] {
  const keys: CombatFrameKey[] = [];
  for (let p = 0; p < 2; p++) {
    for (let d = 0; d < 8; d++) {
      const pose = p as 0 | 1;
      keys.push(`dir${d}-pose${pose}`);
    }
  }
  return keys;
}

/** Worker frame keys in grid order (same dir-across-columns layout). */
export function workerFrameKeys(): readonly WorkerFrameKey[] {
  const keys: WorkerFrameKey[] = [];
  for (let w = 0; w < 2; w++) {
    for (let d = 0; d < 8; d++) {
      const walk = w as 0 | 1;
      keys.push(`dir${d}-walk${walk}`);
    }
  }
  return keys;
}

/**
 * Sunweaver-worker action pseudo-set: act{a}-dir{d}, a=0..3 (build/food/crystal/attack),
 * d=0..7, act-major. Exposed only via adapters.getFrames(assetId, 'actions'); it is NOT
 * part of the asset's primary frame set or its baseline grid.
 */
export function actionFrameKeys(): readonly ActionFrameKey[] {
  const keys: ActionFrameKey[] = [];
  for (let a = 0; a < 4; a++) for (let d = 0; d < 8; d++) keys.push(`act${a}-dir${d}`);
  return keys;
}

const SUN_UNIT_FIXTURES: readonly string[] = [
  'quiet-helios', 'unit-selected', 'roster-sunweaver', 'confrontation', 'battle-clump',
  'fog-edge', 'cam-close', 'cam-normal', 'cam-strategic',
];
const GRAVE_UNIT_FIXTURES: readonly string[] = [
  'quiet-helios', 'unit-selected', 'roster-gravemark', 'confrontation', 'battle-clump',
  'fog-edge', 'cam-close', 'cam-normal', 'cam-strategic',
];
const BUILDING_FIXTURES: readonly string[] = [
  'base-player', 'base-rival', 'construction', 'fog-edge', 'cam-close', 'cam-normal', 'cam-strategic',
];

const UNIT_MIRRORS: readonly MirrorPair[] = [
  [1, 3],
  [0, 4],
  [7, 5],
] as const;

const ENTRIES: readonly AssetDefinition[] = [
  // ── units: workers ────────────────────────────────────────────────────────────
  {
    assetId: 'sunweaver-worker',
    label: 'Worker',
    faction: 'sunweaver',
    category: 'unit',
    role: 'worker',
    adapterId: 'worker8',
    legacyKind: 0,
    legacyCiv: 0,
    dims: { w: 32, h: 48 },
    requiredFacings: 8,
    authoredFacings: 5,
    mirrorPairs: UNIT_MIRRORS,
    frames: workerFrameKeys(),
    groups: { actions: actionFrameKeys() },
    anchor: { x: 16, y: 47 },
    worldScale: { x: 1.55, y: 2.32 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'mag-key',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas y576-624 (worker8 row 0) cols 0-15; action rows y720-912',
    contextFixtures: SUN_UNIT_FIXTURES,
    thresholdsKey: 'worker',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-worker',
    label: 'Worker',
    faction: 'gravemark',
    category: 'unit',
    role: 'worker',
    adapterId: 'worker8',
    legacyKind: 0,
    legacyCiv: 1,
    dims: { w: 32, h: 48 },
    requiredFacings: 8,
    authoredFacings: 5,
    mirrorPairs: UNIT_MIRRORS,
    frames: workerFrameKeys(),
    anchor: { x: 16, y: 47 },
    worldScale: { x: 1.55, y: 2.32 },
    paletteFamily: 'gravemark',
    teamColorRule: 'mag-key',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas y624-672 (worker8 row 1) cols 0-15',
    contextFixtures: GRAVE_UNIT_FIXTURES,
    thresholdsKey: 'worker',
    baselineRevision: null,
  },
  // ── units: scouts ─────────────────────────────────────────────────────────────
  {
    assetId: 'sunweaver-wind-strider',
    label: 'Wind Strider',
    faction: 'sunweaver',
    category: 'unit',
    role: 'scout',
    adapterId: 'scout',
    legacyKind: 1,
    legacyCiv: 0,
    dims: { w: 128, h: 128 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['hd'],
    anchor: { x: 64, y: 127 },
    worldScale: { x: 0.96, y: 1.12 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'mag-key',
    emissiveRule: 'none',
    runtimeMapping: 'scoutCanvas cols 0-3 (128px HD)',
    contextFixtures: SUN_UNIT_FIXTURES,
    thresholdsKey: 'scout',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-grav-skimmer',
    label: 'Grav-Skimmer',
    faction: 'gravemark',
    category: 'unit',
    role: 'scout',
    adapterId: 'scout',
    legacyKind: 1,
    legacyCiv: 1,
    dims: { w: 128, h: 128 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['hd'],
    anchor: { x: 64, y: 127 },
    worldScale: { x: 0.96, y: 1.12 },
    paletteFamily: 'gravemark',
    teamColorRule: 'mag-key',
    emissiveRule: 'none',
    runtimeMapping: 'scoutCanvas cols 7-13 (32px x4 nearest upscale)',
    contextFixtures: GRAVE_UNIT_FIXTURES,
    thresholdsKey: 'scout',
    baselineRevision: null,
  },
  // ── units: combat strip ───────────────────────────────────────────────────────
  {
    assetId: 'sunweaver-lumen-guard',
    label: 'Lumen Guard',
    faction: 'sunweaver',
    category: 'unit',
    role: 'guard',
    adapterId: 'combat',
    legacyKind: 2,
    legacyCiv: 0,
    dims: { w: 64, h: 64 },
    requiredFacings: 8,
    authoredFacings: 5,
    mirrorPairs: UNIT_MIRRORS,
    frames: combatFrameKeys(),
    anchor: { x: 32, y: 63 },
    worldScale: { x: 1.59, y: 1.89 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'mag-key',
    emissiveRule: 'combat-rim',
    runtimeMapping: 'combatCanvas row 0 cols 0-15',
    contextFixtures: SUN_UNIT_FIXTURES,
    thresholdsKey: 'combat-unit',
    baselineRevision: null,
  },
  {
    assetId: 'sunweaver-solar-strider',
    label: 'Solar Strider',
    faction: 'sunweaver',
    category: 'unit',
    role: 'strider',
    adapterId: 'combat',
    legacyKind: 4,
    legacyCiv: 0,
    dims: { w: 64, h: 64 },
    requiredFacings: 8,
    authoredFacings: 5,
    mirrorPairs: UNIT_MIRRORS,
    frames: combatFrameKeys(),
    anchor: { x: 32, y: 63 },
    worldScale: { x: 2.05, y: 1.54 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'mag-key',
    emissiveRule: 'combat-rim',
    runtimeMapping: 'combatCanvas row 1 cols 0-15',
    contextFixtures: SUN_UNIT_FIXTURES,
    thresholdsKey: 'combat-unit',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-rift-guard',
    label: 'Rift Guard',
    faction: 'gravemark',
    category: 'unit',
    role: 'guard',
    adapterId: 'combat',
    legacyKind: 2,
    legacyCiv: 1,
    dims: { w: 64, h: 64 },
    requiredFacings: 8,
    authoredFacings: 5,
    mirrorPairs: UNIT_MIRRORS,
    frames: combatFrameKeys(),
    anchor: { x: 32, y: 63 },
    worldScale: { x: 1.67, y: 1.92 },
    paletteFamily: 'gravemark',
    teamColorRule: 'mag-key',
    emissiveRule: 'combat-rim',
    runtimeMapping: 'combatCanvas row 2 cols 0-15',
    contextFixtures: GRAVE_UNIT_FIXTURES,
    thresholdsKey: 'combat-unit',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-burden-walker',
    label: 'Burden Walker',
    faction: 'gravemark',
    category: 'unit',
    role: 'walker',
    adapterId: 'combat',
    legacyKind: 5,
    legacyCiv: 1,
    dims: { w: 64, h: 64 },
    requiredFacings: 8,
    authoredFacings: 5,
    mirrorPairs: UNIT_MIRRORS,
    frames: combatFrameKeys(),
    anchor: { x: 32, y: 63 },
    worldScale: { x: 2.05, y: 1.81 },
    paletteFamily: 'gravemark',
    teamColorRule: 'mag-key',
    emissiveRule: 'combat-rim',
    runtimeMapping: 'combatCanvas row 3 cols 0-15',
    contextFixtures: GRAVE_UNIT_FIXTURES,
    thresholdsKey: 'combat-unit',
    baselineRevision: null,
  },
  // ── buildings ─────────────────────────────────────────────────────────────────
  {
    assetId: 'sunweaver-core',
    label: 'Core',
    faction: 'sunweaver',
    category: 'building',
    role: 'core',
    adapterId: 'building',
    legacyKind: 10,
    legacyCiv: 0,
    dims: { w: 64, h: 64 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['iso'],
    anchor: { x: 32, y: 63 },
    worldScale: { x: 2.4, y: 2.4 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'none',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas row 10 (y320-384) col 0 (64px)',
    contextFixtures: BUILDING_FIXTURES,
    thresholdsKey: 'building',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-core',
    label: 'Core',
    faction: 'gravemark',
    category: 'building',
    role: 'core',
    adapterId: 'building',
    legacyKind: 10,
    legacyCiv: 1,
    dims: { w: 64, h: 64 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['iso'],
    anchor: { x: 32, y: 63 },
    worldScale: { x: 2.4, y: 2.4 },
    paletteFamily: 'gravemark',
    teamColorRule: 'none',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas row 10 (y320-384) col 1 (64px)',
    contextFixtures: BUILDING_FIXTURES,
    thresholdsKey: 'building',
    baselineRevision: null,
  },
  {
    assetId: 'sunweaver-habitat',
    label: 'Habitat',
    faction: 'sunweaver',
    category: 'building',
    role: 'habitat',
    adapterId: 'building',
    legacyKind: 11,
    legacyCiv: 0,
    dims: { w: 32, h: 32 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['iso'],
    anchor: { x: 16, y: 31 },
    worldScale: { x: 1.75, y: 1.75 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'none',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas row 11 (y384-448) col 0',
    contextFixtures: BUILDING_FIXTURES,
    thresholdsKey: 'building',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-habitat',
    label: 'Habitat',
    faction: 'gravemark',
    category: 'building',
    role: 'habitat',
    adapterId: 'building',
    legacyKind: 11,
    legacyCiv: 1,
    dims: { w: 32, h: 32 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['iso'],
    anchor: { x: 16, y: 31 },
    worldScale: { x: 1.75, y: 1.75 },
    paletteFamily: 'gravemark',
    teamColorRule: 'none',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas row 11 (y384-448) col 1',
    contextFixtures: BUILDING_FIXTURES,
    thresholdsKey: 'building',
    baselineRevision: null,
  },
  {
    assetId: 'sunweaver-yard',
    label: 'Yard',
    faction: 'sunweaver',
    category: 'building',
    role: 'yard',
    adapterId: 'building',
    legacyKind: 12,
    legacyCiv: 0,
    dims: { w: 32, h: 32 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['iso'],
    anchor: { x: 16, y: 31 },
    worldScale: { x: 1.85, y: 1.85 },
    paletteFamily: 'sunweaver',
    teamColorRule: 'none',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas row 12 (y448-512) col 0',
    contextFixtures: BUILDING_FIXTURES,
    thresholdsKey: 'building',
    baselineRevision: null,
  },
  {
    assetId: 'gravemark-yard',
    label: 'Yard',
    faction: 'gravemark',
    category: 'building',
    role: 'yard',
    adapterId: 'building',
    legacyKind: 12,
    legacyCiv: 1,
    dims: { w: 32, h: 32 },
    requiredFacings: 1,
    authoredFacings: 1,
    mirrorPairs: [],
    frames: ['iso'],
    anchor: { x: 16, y: 31 },
    worldScale: { x: 1.85, y: 1.85 },
    paletteFamily: 'gravemark',
    teamColorRule: 'none',
    emissiveRule: 'none',
    runtimeMapping: 'main canvas row 12 (y448-512) col 1',
    contextFixtures: BUILDING_FIXTURES,
    thresholdsKey: 'building',
    baselineRevision: null,
  },
];

function byFactionCategoryLabel(a: AssetDefinition, b: AssetDefinition): number {
  return (
    a.faction.localeCompare(b.faction) ||
    a.category.localeCompare(b.category) ||
    a.label.localeCompare(b.label)
  );
}

/** All 14 public entries, sorted faction -> category -> label. */
export const CATALOG: readonly AssetDefinition[] = [...ENTRIES].sort(byFactionCategoryLabel);

/** Lowercase alias of CATALOG (workbench/store convenience). */
export const catalog: readonly AssetDefinition[] = CATALOG;

/** assetId -> definition lookup (identical content to CATALOG). */
export const ASSET_BY_ID: Readonly<Record<string, AssetDefinition>> = Object.fromEntries(
  CATALOG.map((a) => [a.assetId, a]),
);

export function isPublicAssetId(assetId: string): boolean {
  return Object.prototype.hasOwnProperty.call(ASSET_BY_ID, assetId);
}

/** Canonical public label per the frozen §4 table. Throws for unknown ids. */
export function labelOf(assetId: string): string {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`labelOf: unknown assetId "${assetId}"`);
  return def.label;
}

/**
 * Baseline PNG grid geometry for an asset definition (§5): combat 64px cols8 rows2 =>
 * 512x128; worker 32x48 cols8 rows2 => 256x96; scout 128x128 1x1; buildings 64x64
 * (core) or 32x32 (habitat/yard) 1x1. Frame i sits at cell (i % cols, floor(i / cols)).
 */
export function gridGeometryFor(def: AssetDefinition): {
  cellW: number;
  cellH: number;
  cols: number;
  rows: number;
  width: number;
  height: number;
} {
  const cols = def.adapterId === 'combat' || def.adapterId === 'worker8' ? 8 : 1;
  const rows = def.frames.length / cols;
  return {
    cellW: def.dims.w,
    cellH: def.dims.h,
    cols,
    rows,
    width: cols * def.dims.w,
    height: rows * def.dims.h,
  };
}
