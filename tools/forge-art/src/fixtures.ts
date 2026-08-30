/**
 * FAL-CONTEXT — fixtures.ts
 *
 * DOM-free deterministic scene staging for the real-renderer context rig
 * (tools/forge-art/rig.html). Operates on a World instance passed in — the
 * runtime World construction lives in context-rig.ts, so this module only
 * ever type-imports from src/sim.
 *
 * Recipes are verbatim from the binding audit A4 §2/§3 (stageFixture,
 * scripts/qa-vs4-combat-assets.mjs:763-843) and FORGE_ART_LAB §9 (13 scenes).
 */

import { Kind, MAP, Ord } from '../../../src/engine';
import type { World } from '../../../src/sim';

/** The 13 fixed scenes of spec §9, in order. */
export const SCENE_NAMES = [
  'quiet-helios',
  'unit-selected',
  'roster-sunweaver',
  'roster-gravemark',
  'confrontation',
  'battle-clump',
  'base-player',
  'base-rival',
  'construction',
  'fog-edge',
  'cam-close',
  'cam-normal',
  'cam-strategic',
] as const;

export type SceneName = (typeof SCENE_NAMES)[number];

/** Deterministic terrain/sim seed — the same value the rig boots with. */
export const STAGE_SEED = 0x5eed;
/** Frozen tick: > 240 keeps opening-clash flashes / worker diamonds / opening HP bars off. */
export const TICK_FROZEN = 600;
/** Rig camera presets (A4 §4): half vertical world span in world units. */
export const CAMERA_PRESETS = { close: 5, normal: 14, strategic: 32 } as const;

export interface SceneCamera {
  x: number;
  z: number;
  halfH: number;
}

export interface StagedScene {
  ids: number[];
  selected: Set<number>;
  camera: SceneCamera;
  fog: 'off' | 'rings';
}

/** A4 §3 spawn spec: {kind,civ,team,x,z,facing,order,tx,tz}. */
interface Spec {
  kind: Kind;
  civ: 'vespari' | 'aurion';
  team: number;
  x: number;
  z: number;
  facing: number;
  order: Ord;
  tx: number;
  tz: number;
}

/** A4 §4 suggested center target; OPENING_CENTER = (36, 37.44). */
const CENTER: SceneCamera = { x: 36, z: 37.44, halfH: CAMERA_PRESETS.normal };
const MID_MAP: SceneCamera = { x: 36, z: 36, halfH: CAMERA_PRESETS.normal };

function spec(
  kind: Kind,
  civ: Spec['civ'],
  team: number,
  x: number,
  z: number,
  facing: number,
  order: Ord,
  tx = x,
  tz = z,
): Spec {
  return { kind, civ, team, x, z, facing, order, tx, tz };
}

/**
 * A4 §3 base helper (verbatim from stageFixture, qa-vs4-combat-assets.mjs:793-815):
 * kill-all loop (Hall progress 0.5 preserved), landmarks undiscovered, winner=-1,
 * then spawn each spec with every override (x/px/z/pz/tx/tz/vx/vz/facing/order/
 * tid/path/pathI/anim/hp=maxHp/dissolveT/corpseT/combatT/hitFlash, vis=true).
 * Ent ids are stable array slots popped from the free list.
 */
function stage(world: World, specs: readonly Spec[]): number[] {
  for (const e of world.ents) {
    e.alive = false;
    e.vis = false;
    e.vx = 0;
    e.vz = 0;
    e.path = null;
    e.tid = -1;
    if (e.kind === Kind.Hall) e.progress = 0.5;
  }
  for (const lm of world.landmarks) lm.discoveredBy = 0;
  world.winner = -1;
  return specs.map((s) => {
    const e = world.spawn(s.kind, s.civ, s.team, s.x, s.z);
    if (!e) throw new Error(`fixture spawn failed for kind ${s.kind} (free list exhausted)`);
    e.x = e.px = s.x;
    e.z = e.pz = s.z;
    e.tx = s.tx;
    e.tz = s.tz;
    e.vx = 0;
    e.vz = 0;
    e.facing = s.facing;
    e.order = s.order;
    e.tid = -1;
    e.path = null;
    e.pathI = 0;
    e.anim = 0;
    e.hp = e.maxHp;
    e.dissolveT = 0;
    e.corpseT = 0;
    e.combatT = 0;
    e.hitFlash = 0;
    e.vis = true;
    return e.id;
  });
}

/** Pin the sim (A4 §2b): frozen tick, no winner, step is a no-op. */
function freeze(world: World): void {
  world.tick = TICK_FROZEN;
  world.winner = -1;
  world.step = () => {};
}

/** Fill a square-disc ring of radius r (tile-center convention, like sim LOS). */
function ring(buf: Uint8Array, cx: number, cz: number, r: number): void {
  for (let z = cz - r; z <= cz + r; z++) {
    if (z < 0 || z >= MAP) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= MAP) continue;
      const dx = x + 0.5 - cx;
      const dz = z + 0.5 - cz;
      if (dx * dx + dz * dz <= r * r) buf[x + z * MAP] = 1;
    }
  }
}

/** A4 §3 mixed roster split per faction: units spread around (36,36), facing 0/4. */
const ROSTER_OFFSETS: readonly (readonly [number, number])[] = [
  [-3.2, -3.2],
  [3.2, -3.2],
  [-3.2, 3.2],
  [3.2, 3.2],
  [0, 0],
  [-4.6, 0.6],
  [4.6, 0.6],
];

function roster(world: World, kinds: readonly Kind[], civ: Spec['civ'], team: number): number[] {
  const specs = kinds.map((kind, i) => {
    const [dx, dz] = ROSTER_OFFSETS[i % ROSTER_OFFSETS.length];
    return spec(kind, civ, team, MID_MAP.x + dx, MID_MAP.z + dz, i % 2 === 0 ? 0 : 4, Ord.Idle);
  });
  const ids = stage(world, specs);
  // Render skips team != 0 Shade with stealth > 0.7; a roster is a display scene,
  // so the gravemark Shade is shown with stealth forced to 0 (deviation, noted).
  for (const id of ids) {
    if (world.ents[id].kind === Kind.Shade) world.ents[id].stealth = 0;
  }
  return ids;
}

/** A4 §3 confrontation lineup — stageFixture `lineup` verbatim. */
const LINEUP: readonly Spec[] = [
  spec(Kind.Fighter, 'vespari', 0, 30, 34, 0, Ord.Idle),
  spec(Kind.Ravager, 'vespari', 0, 37, 34, 0, Ord.Idle),
  spec(Kind.Fighter, 'aurion', 1, 30, 42, 4, Ord.Idle),
  spec(Kind.Prism, 'aurion', 1, 37, 42, 4, Ord.Idle),
];

function confrontation(world: World, camera: SceneCamera): StagedScene {
  const ids = stage(world, LINEUP);
  world.fogOfWarEnabled = false;
  freeze(world);
  return { ids, selected: new Set(), camera, fog: 'off' };
}

/**
 * A4 §3 battle clump — stageFixture `clash` verbatim, then 32 real sim steps,
 * freeze, and clear flags/links/landmarks. Post-step tick is kept (per rig spec).
 */
function battleClump(world: World): StagedScene {
  const ids = stage(world, [
    spec(Kind.Fighter, 'vespari', 0, 29, 35, 1, Ord.AttackMove, 43, 41),
    spec(Kind.Ravager, 'vespari', 0, 31, 36, 1, Ord.AttackMove, 43, 41),
    spec(Kind.Fighter, 'aurion', 1, 43, 41, 5, Ord.AttackMove, 29, 35),
    spec(Kind.Prism, 'aurion', 1, 45, 42, 5, Ord.AttackMove, 29, 35),
  ]);
  world.fogOfWarEnabled = false;
  // A prior scene may have frozen step — restore the real one from the prototype.
  const proto: { step?: () => void } = Object.getPrototypeOf(world);
  if (typeof proto.step === 'function') world.step = proto.step;
  for (let i = 0; i < 32; i++) world.step();
  world.step = () => {};
  world.flags.length = 0;
  world.links.length = 0;
  world.landmarks.length = 0;
  world.winner = -1;
  return { ids, selected: new Set(), camera: { x: 36, z: 38, halfH: CAMERA_PRESETS.normal }, fog: 'off' };
}

/** A4 §3 player/rival base: reset, keep one team's spawns, kill the other, fog off. */
function base(world: World, keepTeam: 0 | 1): StagedScene {
  world.reset(STAGE_SEED >>> 0);
  const ids: number[] = [];
  for (const e of world.ents) {
    if (!e.alive) continue;
    if (e.team === keepTeam || e.kind === Kind.Resource) {
      e.vis = true; // fog-off full view; render gates on e.vis, and resources need it explicit
      ids.push(e.id);
      continue;
    }
    e.alive = false;
    e.vis = false;
    e.vx = 0;
    e.vz = 0;
    e.path = null;
    e.tid = -1;
    if (e.kind === Kind.Hall) e.progress = 0.5;
  }
  for (const lm of world.landmarks) lm.discoveredBy = 0;
  world.fogOfWarEnabled = false;
  freeze(world);
  return {
    ids,
    selected: new Set(),
    // OPENING_CAMERA positions (A4 §4): player ~(12,12), rival ~(56,56), halfH 9.
    camera: keepTeam === 0 ? { x: 12, z: 12, halfH: 9 } : { x: 56, z: 56, halfH: 9 },
    fog: 'off',
  };
}

/** A4 §3 construction: half-built Hall + two Build-ordered workers next to it. */
function construction(world: World): StagedScene {
  const ids = stage(world, [
    spec(Kind.Hall, 'vespari', 0, 36, 35, 1, Ord.Idle),
    spec(Kind.Worker, 'vespari', 0, 33.5, 35.2, 0, Ord.Build, 36, 35),
    spec(Kind.Worker, 'vespari', 0, 38.5, 35.2, 4, Ord.Build, 36, 35),
  ]);
  const hall = world.ents[ids[0]];
  hall.progress = 0.5; // buildings pin explicit progress + hp = maxHp * progress
  hall.hp = hall.maxHp * 0.5;
  for (const id of ids.slice(1)) {
    const w = world.ents[id];
    w.buildKind = Kind.House;
  }
  world.fogOfWarEnabled = false;
  freeze(world);
  return { ids, selected: new Set(), camera: { x: 36, z: 35, halfH: CAMERA_PRESETS.normal }, fog: 'off' };
}

/** A4 §3 fog edge: visible[0] clear disc r=3, explored[0] dim disc r=6, per-ent vis. */
function fogEdge(world: World): StagedScene {
  const ids = stage(world, [
    spec(Kind.Fighter, 'vespari', 0, 34, 36, 0, Ord.Idle),
    spec(Kind.Fighter, 'aurion', 1, 38, 36, 4, Ord.Idle),
    spec(Kind.Fighter, 'vespari', 0, 36, 33.5, 0, Ord.Idle),
    spec(Kind.Fighter, 'aurion', 1, 30.5, 30.5, 4, Ord.Idle),
    spec(Kind.Fighter, 'vespari', 0, 41.5, 41.5, 0, Ord.Idle),
  ]);
  world.fogOfWarEnabled = true;
  // Wipe reset()-era fog arrays, then paint rings by hand (sim's updateFog never
  // runs on a frozen fixture — draw honors these arrays per frame).
  world.visible[0].fill(0);
  world.explored[0].fill(0);
  ring(world.explored[0], 36, 36, 6); // dim purple band
  ring(world.visible[0], 36, 36, 3); // clear disc (supersedes explored)
  const r3 = 3 * 3;
  for (const id of ids) {
    const e = world.ents[id];
    const dx = e.x - 36;
    const dz = e.z - 36;
    e.vis = dx * dx + dz * dz <= r3; // inside the clear disc, or hidden in the fog
  }
  freeze(world);
  return { ids, selected: new Set(), camera: { x: 36, z: 36, halfH: 9 }, fog: 'rings' };
}

/**
 * Stage one of the 13 fixed scenes on an already-constructed World.
 * Every scene ends with the sim frozen: world.step is a no-op and tick is
 * TICK_FROZEN (except battle-clump, which keeps its post-step tick).
 */
export function stageScene(world: World, name: SceneName): StagedScene {
  switch (name) {
    case 'quiet-helios': {
      stage(world, []);
      world.fogOfWarEnabled = false;
      freeze(world);
      return { ids: [], selected: new Set(), camera: CENTER, fog: 'off' };
    }
    case 'unit-selected': {
      const ids = stage(world, [spec(Kind.Fighter, 'vespari', 0, 36, 36, 0, Ord.Idle)]);
      world.fogOfWarEnabled = false;
      freeze(world);
      return { ids, selected: new Set(ids), camera: MID_MAP, fog: 'off' };
    }
    case 'roster-sunweaver': {
      const ids = roster(world, [Kind.Fighter, Kind.Fighter, Kind.Ravager, Kind.Scout, Kind.Worker], 'vespari', 0);
      world.fogOfWarEnabled = false;
      freeze(world);
      return { ids, selected: new Set(), camera: MID_MAP, fog: 'off' };
    }
    case 'roster-gravemark': {
      const ids = roster(
        world,
        [Kind.Fighter, Kind.Fighter, Kind.Prism, Kind.Siege, Kind.Shade, Kind.Scout, Kind.Worker],
        'aurion',
        1,
      );
      world.fogOfWarEnabled = false;
      freeze(world);
      return { ids, selected: new Set(), camera: MID_MAP, fog: 'off' };
    }
    case 'confrontation':
      return confrontation(world, CENTER);
    case 'battle-clump':
      return battleClump(world);
    case 'base-player':
      return base(world, 0);
    case 'base-rival':
      return base(world, 1);
    case 'construction':
      return construction(world);
    case 'fog-edge':
      return fogEdge(world);
    case 'cam-close':
      return confrontation(world, { x: CENTER.x, z: CENTER.z, halfH: CAMERA_PRESETS.close });
    case 'cam-normal':
      return confrontation(world, CENTER);
    case 'cam-strategic':
      return confrontation(world, { x: CENTER.x, z: CENTER.z, halfH: CAMERA_PRESETS.strategic });
    default: {
      const never: never = name;
      throw new Error(`stageScene: unknown scene '${String(never)}'`);
    }
  }
}
