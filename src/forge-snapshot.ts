/**
 * FTR-CORE — deterministic world identity hashing (docs/FORGE_TRACE.md §6, frozen).
 *
 * The canonical snapshot is a fixed-order integer sequence over the LIVE world
 * (pure read-only observation — nothing is mutated, nothing is stored). Floats
 * are quantized onto a fixed grid before hashing: 3 decimals (0.001 grid) for
 * positions / hp / progress / energy-transfer floats, 2 decimals (0.01 grid)
 * for timers. `q(v, decimals)` returns the INTEGER grid value (e.g. q(12.3456,
 * 3) === 12346) so the stream contains integers only, exactly as the contract
 * requires ("Hash integers only"). Non-finite input throws — a non-finite
 * world field is a programming error, not something to hash.
 *
 * worldIdentityHash folds the sequence with the repo-proven FNV-1a 32-bit
 * recipe (tests/vs2b-lumen-field.test.ts): h = 2166136261; h ^= v;
 * h = Math.imul(h, 16777619); h >>> 0 at the end; output is lowercase 8-hex.
 * The sequence is streamed through a preallocated scratch buffer — no giant
 * intermediate array is built per hash.
 */

import { MAX_ENTS } from './engine';
import type { Civ } from './engine';
import type { World } from './sim';
import { ALL_CIVS } from './content';
import { DIFFICULTIES, TECH_PATH_IDS } from './pacing-contract';

/**
 * Quantize a float onto the `decimals` grid and return the integer grid value.
 * Throws on non-finite input.
 */
export function q(v: number, decimals: number): number {
  if (!Number.isFinite(v)) {
    throw new Error(`forge-snapshot: cannot quantize non-finite value ${v}`);
  }
  let f = 1;
  for (let i = 0; i < decimals; i++) f *= 10;
  return Math.round(v * f);
}

/** Fixed discovery-kind code table (entities + landmarks, merged). */
const DISCOVERY_KIND_CODES: Record<string, number> = {
  entity: 0,
  resource: 1,
  'enemy-structure': 2,
  'central-objective': 3,
  relic: 4,
  expansion: 5,
  'safe-route': 6,
  'danger-route': 7,
};

/** Fixed landmark-id code table (same order as makeHeliosLandmarks). */
const LANDMARK_ID_CODES: Record<string, number> = {
  'central-lumen-field': 0,
  'neutral-tech-relic': 1,
  'expansion-player': 2,
  'expansion-rival': 3,
  'safe-route': 4,
  'danger-route': 5,
};

function civIndex(civ: Civ): number {
  const index = ALL_CIVS.indexOf(civ);
  if (index < 0) throw new Error(`forge-snapshot: unknown civ "${String(civ)}"`);
  return index;
}

function techPathCode(path: string | null): number {
  if (path === null) return -1;
  const index = TECH_PATH_IDS.indexOf(path);
  if (index < 0) throw new Error(`forge-snapshot: unknown tech path "${path}"`);
  return index;
}

type SequenceSink = (value: number) => void;

/**
 * Walk the canonical fixed-order sequence (docs/FORGE_TRACE.md §6) and emit
 * every integer to the sink. Field order is frozen: schemaVersion, seed, fog
 * flag, difficulty index, civ indices, tick, winner, per-team eco, links,
 * flags, lumenState, landmark latches, alive ents in id order, matchStats
 * counters, fog bytes of visible[0..1] + explored[0..1] as four length-prefixed
 * runs, then the discovery log.
 */
function walkCanonical(world: World, emit: SequenceSink): void {
  emit(1); // schemaVersion
  emit(world.seed >>> 0);
  emit(world.fogOfWarEnabled ? 1 : 0);
  const difficultyIndex = DIFFICULTIES.indexOf(world.aiDifficulty);
  if (difficultyIndex < 0) throw new Error(`forge-snapshot: unknown aiDifficulty "${String(world.aiDifficulty)}"`);
  emit(difficultyIndex);
  for (let t = 0; t < 2; t++) emit(civIndex(world.civ[t]));
  emit(world.tick);
  emit(world.winner);

  // Per-team economy: { ore, gas, pop, cap, epoch, ageT, techPathCode, pendingPathCode, boost }.
  for (let t = 0; t < 2; t++) {
    const eco = world.teams[t];
    emit(eco.ore);
    emit(eco.gas);
    emit(eco.pop);
    emit(eco.cap);
    emit(eco.epoch);
    emit(q(eco.ageT, 2));
    emit(techPathCode(world.techPathOf(t)));
    emit(techPathCode(world.pendingPathOf(t)));
    emit(world.boosts[t]);
  }

  // Solar links: count + fields in array order.
  emit(world.links.length);
  for (const link of world.links) {
    emit(link.nodeId);
    emit(link.hallId);
    emit(link.team);
    emit(link.severedUntil);
  }

  // Flags: count + fields in array order (positions 3dp, timer 2dp).
  emit(world.flags.length);
  for (const flag of world.flags) {
    emit(q(flag.x, 3));
    emit(q(flag.z, 3));
    emit(q(flag.t, 2));
  }

  // Central Lumen Field state.
  const lumen = world.lumenState();
  emit(lumen.owner);
  emit(lumen.capturing);
  emit(q(lumen.progress, 2));
  emit(lumen.contested ? 1 : 0);
  emit(q(lumen.pulseRemaining[0], 2));
  emit(q(lumen.pulseRemaining[1], 2));

  // Landmark discovery latches in fixed table order.
  for (const landmark of world.landmarks) emit(landmark.discoveredBy);

  // Alive entities in id order (id === index). Excluded per §6: path arrays,
  // px/pz, anim, facing, hitFlash, combatT, vis, rigAccum, private scratch.
  for (let i = 0; i < MAX_ENTS; i++) {
    const e = world.ents[i];
    if (!e.alive) continue;
    emit(e.id);
    emit(e.kind);
    emit(civIndex(e.civ));
    emit(e.team);
    emit(q(e.x, 3));
    emit(q(e.z, 3));
    emit(q(e.vx, 3));
    emit(q(e.vz, 3));
    emit(q(e.hp, 3));
    emit(q(e.maxHp, 3));
    emit(e.order);
    emit(q(e.tx, 3));
    emit(q(e.tz, 3));
    emit(e.tid);
    emit(e.cargo);
    emit(e.cargoType);
    emit(q(e.cooldown, 2));
    emit(q(e.stealth, 3));
    emit(q(e.frenzy, 3));
    emit(q(e.blinkCd, 2));
    emit(q(e.progress, 3));
    emit(e.trainKind);
    emit(q(e.trainT, 2));
    emit(q(e.rallyX, 3));
    emit(q(e.rallyZ, 3));
    emit(e.pathI);
    emit(e.seenBy);
    emit(e.rigTeam);
    emit(q(e.rigProgress, 3));
    emit(q(e.rigHp, 3));
    emit(q(e.dissolveT, 2));
    emit(q(e.corpseT, 2));
  }

  // matchStats() counters: { ore, gas, energy, unitsTrained, unitsLost, coreDamage } per team.
  const stats = world.matchStats();
  for (let t = 0; t < 2; t++) {
    const team = stats.teams[t];
    emit(team.resources.ore);
    emit(team.resources.gas);
    emit(team.resources.energy);
    emit(team.unitsTrained);
    emit(team.unitsLost);
    emit(q(team.coreDamage, 3));
  }

  // Fog bytes folded raw: visible[0], visible[1], explored[0], explored[1]
  // as four length-prefixed runs.
  for (const array of [world.visible[0], world.visible[1], world.explored[0], world.explored[1]]) {
    emit(array.length);
    for (let j = 0; j < array.length; j++) emit(array[j]);
  }

  // Discovery log: count + per-event fields in array order.
  emit(world.discoveryLog.length);
  for (const entry of world.discoveryLog) {
    emit(entry.team);
    emit(entry.tick);
    const kindCode = DISCOVERY_KIND_CODES[entry.kind];
    if (kindCode === undefined) throw new Error(`forge-snapshot: unknown discovery kind "${String(entry.kind)}"`);
    emit(kindCode);
    if (typeof entry.id === 'number') {
      emit(entry.id);
    } else {
      const idCode = LANDMARK_ID_CODES[entry.id];
      if (idCode === undefined) throw new Error(`forge-snapshot: unknown landmark id "${entry.id}"`);
      emit(idCode);
    }
    emit(q(entry.x, 3));
    emit(q(entry.z, 3));
  }
}

interface ScratchBuffer {
  buf: Float64Array;
  len: number;
}

const scratch: ScratchBuffer = { buf: new Float64Array(1 << 15), len: 0 };

function pushScratch(value: number): void {
  if (scratch.len >= scratch.buf.length) {
    const next = new Float64Array(scratch.buf.length * 2);
    next.set(scratch.buf);
    scratch.buf = next;
  }
  scratch.buf[scratch.len++] = value;
}

/**
 * Canonical integer snapshot of the live world (docs/FORGE_TRACE.md §6).
 * Returns a fresh Float64Array of grid integers (the same sequence the hash
 * folds), so callers may hold snapshots across later calls. Float64Array holds
 * the full unsigned-32-bit seed without wrapping, unlike Int32Array.
 */
export function canonicalWorldSnapshot(world: World): Float64Array {
  const out: number[] = [];
  walkCanonical(world, (value) => out.push(value));
  return Float64Array.from(out);
}

/**
 * 8-char lowercase hex FNV-1a identity hash of the live world. Streamed through
 * a preallocated scratch buffer — no per-call array allocation in the steady
 * state. Pure read-only observation; same seed + config + operations => same
 * hash, every time.
 */
export function worldIdentityHash(world: World): string {
  scratch.len = 0;
  walkCanonical(world, pushScratch);
  let hash = 2166136261;
  const buf = scratch.buf;
  for (let i = 0; i < scratch.len; i++) {
    hash ^= buf[i];
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}
