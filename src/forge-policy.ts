/**
 * FTR-1 policies — deterministic legal traced match policies (docs/FORGE_TRACE.md §8).
 *
 * Owned by FTR-POLICY (src/forge-policy.ts). Imported only by Forge Trace tooling,
 * never by the production graph. The policy drives the world ONLY through the legal
 * public seams: tryPlace, tryTrain, tryCommitPath, issue, step (plus reading public
 * state); world.kill() appears only in prepareLostScoutRecovery.
 *
 * Determinism rules (frozen by the FTR-1 brief):
 *  - no Date / Math.random / wall-clock anything; every decision comes exclusively
 *    from the current public world state;
 *  - fixed iteration orders: entity scans walk the ents array in index order;
 *  - every tryTrain / tryPlace / tryCommitPath call is prefaced by the exact
 *    STATS-table affordability checks the sim itself performs, so failed attempts
 *    are rare — but any failure is still recorded naturally through the collector's
 *    wrapped seams (placement-attempt / training-attempt / path-commit-attempt).
 *
 * Setup contract (FORGE_TRACE.md §7–8): world.reset() invalidates an attached
 * collector, so the CALLER either (a) leaves the world fresh and lets this policy
 * configure civ[0]/civ[1] via factionToLegacyCiv, fogOfWarEnabled = true,
 * aiDifficulty, and reset(seed) itself — the standard-opening flow — or
 * (b) performs that exact configuration + reset itself BEFORE constructing and
 * attaching the collector — the lost-scout-recovery flow, where the rival Scout
 * must be killed (prepareLostScoutRecovery) before any stepping and a re-reset
 * would resurrect it. This policy detects (b) and never re-resets a world that is
 * already prepared for the requested match. It never attaches/detaches the
 * collector; it only calls observe() — after every world.step() and after every
 * bare mutation (issue/tryPlace/tryTrain/tryCommitPath), since there is no RAF
 * loop here — and once right after setup so the collector has a clean baseline.
 */

import { Kind, Ord, Tile } from './engine';
import type { Ent } from './engine';
import type { World } from './sim';
import { STATS } from './content';
import type { TechPathId } from './content';
import { factionToLegacyCiv, STANDARD_PATH_FOR_FACTION, TERMINAL_BY_TICK, uniqueUnitFor } from './pacing-contract';
import { SEEN_PLAYER } from './discovery';
import type { Difficulty, FactionId } from './match-config';
import type { ForgeTraceCollector } from './forge-collector';

/** Ring offsets around the Core tried in frozen order for the Yard (VS-2A/VS5 proven). */
const YARD_RING_OFFSETS = [
  { dx: -3.4, dz: -3.4 },
  { dx: 0, dz: -4.4 },
  { dx: 3.4, dz: -3.4 },
  { dx: 4.4, dz: 0 },
] as const;

/** Path-commit funding, mirrored from sim.ts (PATH_COMMIT_ORE / PATH_COMMIT_CHARGE). */
const PATH_COMMIT_ORE = 400;
const PATH_COMMIT_CHARGE = 80;

export interface StandardOpeningResult {
  /** Last stepped tick (the tick the winner latched on, or maxTicks). */
  terminalTick: number;
  /** -1 | 0 | 1 — sim team indices, as read from world.winner. */
  winner: number;
}

/**
 * Run the standard legal opening to terminal or tick cap.
 *
 * The caller passes a world and an ALREADY-ATTACHED collector. If the world is not
 * yet prepared for this match (fresh, or configured for a different match), this
 * function sets civ[0]/civ[1] via the canonical→legacy adapter, fogOfWarEnabled,
 * aiDifficulty and calls reset(seed) — the collector attached before that reset
 * must tolerate it (attach wraps instance methods only). If the world is already
 * prepared exactly for this match (the lost-scout-recovery flow, where
 * prepareLostScoutRecovery already ran), it is left untouched.
 *
 * Opening (all through legal seams, ents in index order):
 *  1. place the Yard via tryPlace at the first legal spot of the frozen ring
 *     around the Core, using canPlace with STATS[Kind.Barracks].radius;
 *  2. Workers 0+1 Gather the nearest discovered Ore node, Worker 2 the nearest
 *     discovered Solar node (world.issue(ids, Ord.Gather, x, z, nodeId));
 *  3. when the Yard completes, the builder (Worker 3) returns to Ore;
 *  4. once the Yard is up and the Core idle with ore >= 400 and energy >= 80,
 *     tryCommitPath(0, STANDARD_PATH_FOR_FACTION[playerFaction]);
 *  5. after the path locks, train Fighter then the faction unique through
 *     tryTrain when affordable and within the population cap;
 *  6. when both are alive, AttackMove the pair (and Move the Scout) to the
 *     Central Lumen Field landmark;
 *  7. once lumenState().owner === 0: AttackMove toward the rival Hall if it is
 *     seen by the player, otherwise keep scouting with the Scout (Move toward the
 *     expansion-rival landmark, then the rival Hall);
 *  8. once the rival Core is discovered, Attack it with all combat units.
 * Step until winner !== -1 or tick >= maxTicks (default TERMINAL_BY_TICK).
 */
export function runStandardOpening(
  world: World,
  options: {
    seed: number;
    difficulty: Difficulty;
    playerFaction: FactionId;
    rivalFaction: FactionId;
    collector: ForgeTraceCollector;
    maxTicks?: number;
  },
): StandardOpeningResult {
  const { seed, difficulty, playerFaction, rivalFaction, collector } = options;
  const maxTicks = options.maxTicks ?? TERMINAL_BY_TICK;

  prepareWorld(world, { seed, difficulty, playerFaction, rivalFaction });
  collector.observe();

  const path = STANDARD_PATH_FOR_FACTION[playerFaction] as TechPathId;
  const uniqueKind = uniqueUnitFor(playerFaction);
  const central = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field') ?? null;
  const expansionRival = world.landmarks.find((landmark) => landmark.id === 'expansion-rival') ?? null;

  // --- Opening snapshot (fixed order; positions are deterministic post-reset). ---
  const hall = firstAlive(world, 0, Kind.Hall);
  const workers = aliveOfKind(world, 0, Kind.Worker);
  const ore = nearestDiscoveredNode(world, hall, Tile.Ore);
  const solar = nearestDiscoveredNode(world, hall, Tile.Solar);
  const builder = workers.length >= 4 ? workers[3] : null;
  const yardSpot =
    hall === null
      ? null
      : (YARD_RING_OFFSETS.map((offset) => ({ x: hall.x + offset.dx, z: hall.z + offset.dz })).find(
          (candidate) => world.canPlace(candidate.x, candidate.z, STATS[Kind.Barracks].radius),
        ) ?? null);

  // --- Per-tick policy latches (decisions come only from public state). ---
  let yardPlaced = false;
  let workersAssigned = false;
  let builderReturned = false;
  let pathCommitted = false;
  let fighterStarted = false;
  let uniqueStarted = false;
  let pairOrdered = false;
  let armyPushed = false;
  let attacking = false;
  /** Scout legs after the Lumen is secured: 0 = none, 1 = expansion-rival landmark, 2 = rival Hall. */
  let scoutStage = 0;

  while (world.tick < maxTicks && world.winner === -1) {
    const scan = scanEnts(world, uniqueKind);
    const eco = world.teams[0];

    // 1. Yard placement — first legal spot of the frozen ring, guarded by the exact
    //    STATS affordability + canPlace checks tryPlace itself performs.
    if (!yardPlaced && hall !== null && yardSpot !== null && builder !== null && builder.alive) {
      const st = STATS[Kind.Barracks];
      if (eco.ore >= st.ore && eco.gas >= st.gas && eco.energy >= st.energy) {
        yardPlaced = world.tryPlace(0, Kind.Barracks, yardSpot.x, yardSpot.z, builder.id);
        collector.observe();
      }
    }

    // 2. Opening gather assignments — two Workers to the nearest discovered Ore
    //    node, one to the nearest discovered Solar node.
    if (!workersAssigned && workers.length >= 3 && ore !== null && solar !== null) {
      world.issue([workers[0].id, workers[1].id], Ord.Gather, ore.x, ore.z, ore.id);
      world.issue([workers[2].id], Ord.Gather, solar.x, solar.z, solar.id);
      collector.observe();
      workersAssigned = true;
    }

    // 3. Return the builder to Ore once the Yard completes.
    if (
      !builderReturned &&
      scan.yard !== null &&
      scan.yard.progress >= 1 &&
      builder !== null &&
      builder.alive &&
      ore !== null &&
      !(builder.order === Ord.Gather && builder.tid === ore.id)
    ) {
      world.issue([builder.id], Ord.Gather, ore.x, ore.z, ore.id);
      collector.observe();
      builderReturned = builder.order === Ord.Gather && builder.tid === ore.id;
    }

    // 4. Fund and commit the faction standard path once the Yard is up and the
    //    Core is idle — the exact tryCommitPath preconditions.
    if (
      !pathCommitted &&
      scan.yard !== null &&
      scan.yard.progress >= 1 &&
      scan.hall !== null &&
      scan.hall.trainT <= 0 &&
      eco.epoch === 0 &&
      eco.ageT <= 0 &&
      eco.techPath === null &&
      eco.ore >= PATH_COMMIT_ORE &&
      eco.energy >= PATH_COMMIT_CHARGE
    ) {
      pathCommitted = world.tryCommitPath(0, path);
      collector.observe();
      pathCommitted = pathCommitted || world.pendingPathOf(0) !== null || world.techPathOf(0) !== null;
    }

    // 5. After the path locks, train Fighter then the faction unique through the
    //    Yard, each guarded by the exact tryTrain affordability + pop-cap checks.
    if (world.techPathOf(0) !== null && scan.yard !== null && scan.yard.progress >= 1 && scan.yard.trainT <= 0) {
      if (!fighterStarted && affordableWithRoom(world, Kind.Fighter)) {
        fighterStarted = world.tryTrain(scan.yard, Kind.Fighter);
        collector.observe();
      } else if (fighterStarted && !uniqueStarted && affordableWithRoom(world, uniqueKind)) {
        uniqueStarted = world.tryTrain(scan.yard, uniqueKind);
        collector.observe();
      }
    }

    // 6. March the mixed pair to the Central Lumen Field; the Scout walks ahead.
    if (!pairOrdered && scan.fighter !== null && scan.unique !== null && central !== null) {
      if (scan.scout !== null) world.issue([scan.scout.id], Ord.Move, central.x, central.z, -1);
      world.issue([scan.fighter.id, scan.unique.id], Ord.AttackMove, central.x, central.z, -1);
      collector.observe();
      pairOrdered = true;
    }

    // 7. Once the Lumen is secured: AttackMove toward the rival Hall if it is seen
    //    by the player; otherwise keep scouting with the Scout (first leg toward
    //    the expansion-rival landmark, then toward the rival Hall itself).
    if (world.lumenState().owner === 0 && !armyPushed) {
      if (scan.rivalHall !== null && (scan.rivalHall.seenBy & SEEN_PLAYER) !== 0) {
        if (scan.combat.length > 0) {
          world.issue(scan.combat, Ord.AttackMove, scan.rivalHall.x, scan.rivalHall.z, -1);
          if (scan.scout !== null) world.issue([scan.scout.id], Ord.Move, scan.rivalHall.x, scan.rivalHall.z, -1);
          collector.observe();
        }
        armyPushed = true;
      } else if (scan.scout !== null) {
        if (scoutStage < 2 && expansionRival !== null &&
            Math.hypot(scan.scout.x - expansionRival.x, scan.scout.z - expansionRival.z) < 1.0) {
          scoutStage = 2;
        }
        const leg = scoutStage >= 2 ? scan.rivalHall : expansionRival;
        if (leg !== null &&
            !(scan.scout.order === Ord.Move && scan.scout.tx === leg.x && scan.scout.tz === leg.z && scan.scout.tid === -1)) {
          world.issue([scan.scout.id], Ord.Move, leg.x, leg.z, -1);
          collector.observe();
        }
      }
    }

    // 8. Attack the rival Core with all combat units once it is discovered.
    if (!attacking && scan.rivalHall !== null && (scan.rivalHall.seenBy & SEEN_PLAYER) !== 0) {
      if (scan.combat.length > 0) {
        world.issue(scan.combat, Ord.Attack, scan.rivalHall.x, scan.rivalHall.z, scan.rivalHall.id);
        collector.observe();
      }
      attacking = true;
    }

    world.step();
    collector.observe();
  }

  return { terminalTick: world.tick, winner: world.winner };
}

/**
 * Lost-scout-recovery preparation: kill the original rival Scout (the one spawned
 * at reset) and record the fault-injection event the collector must emit.
 *
 * Call this AFTER the world has been configured + reset(seed) and the collector
 * has been constructed and attached, and BEFORE runStandardOpening (which will
 * then run the standard opening against the already-prepared world and must not
 * re-reset it — see the setup contract in the file header).
 *
 * The collector MUST have been constructed with faultInjectionAllowed: true,
 * otherwise no fault-injection event is emitted and faultEventSeq is -1. The
 * rival replaces the lost Scout through ordinary Hall training at real cost/time
 * (sim rule); no replacement is trained after the player Core is discovered.
 */
export function prepareLostScoutRecovery(
  collector: ForgeTraceCollector,
  world: World,
): { killedEntityId: number; faultEventSeq: number } {
  const scout = world.ents.find((entity) => entity.alive && entity.hp > 0 && entity.team === 1 && entity.kind === Kind.Scout);
  if (scout === undefined) return { killedEntityId: -1, faultEventSeq: -1 };
  const killedEntityId = scout.id;
  world.kill(scout);
  collector.observe();
  let faultEventSeq = -1;
  for (let i = collector.events.length - 1; i >= 0; i--) {
    const event = collector.events[i];
    if (event.type === 'fault-injection') {
      faultEventSeq = event.seq;
      break;
    }
  }
  return { killedEntityId, faultEventSeq };
}

// --- Module-private helpers ------------------------------------------------------

/**
 * Configure the world for the requested match unless it is already prepared for
 * exactly this match. A prepared world has tick 0, the requested seed, the mapped
 * civs, fog enabled, the requested difficulty AND a spawned scenario (alive ents).
 * A fresh World constructor happens to match the seed/civ/fog/difficulty defaults
 * for sunweaver-vs-gravemark at seed 0x5eed, so the alive-ents check is what
 * separates "fresh, needs reset" from "runner already reset (lost-scout flow)".
 */
function prepareWorld(
  world: World,
  options: { seed: number; difficulty: Difficulty; playerFaction: FactionId; rivalFaction: FactionId },
): void {
  const { seed, difficulty, playerFaction, rivalFaction } = options;
  const playerCiv = factionToLegacyCiv(playerFaction);
  const rivalCiv = factionToLegacyCiv(rivalFaction);
  const alreadyPrepared =
    world.tick === 0 &&
    world.seed === seed &&
    world.civ[0] === playerCiv &&
    world.civ[1] === rivalCiv &&
    world.fogOfWarEnabled === true &&
    world.aiDifficulty === difficulty &&
    world.ents.some((entity) => entity.alive);
  if (alreadyPrepared) return;
  world.civ[0] = playerCiv;
  world.civ[1] = rivalCiv;
  world.fogOfWarEnabled = true;
  world.aiDifficulty = difficulty;
  world.reset(seed);
}

/** First living entity of a team+kind, walking the ents array in index order. */
function firstAlive(world: World, team: number, kind: Kind): Ent | null {
  for (let i = 0; i < world.ents.length; i++) {
    const entity = world.ents[i];
    if (entity.alive && entity.hp > 0 && entity.team === team && entity.kind === kind) return entity;
  }
  return null;
}

/** All living entities of a team+kind, in ents index order. */
function aliveOfKind(world: World, team: number, kind: Kind): Ent[] {
  const out: Ent[] = [];
  for (let i = 0; i < world.ents.length; i++) {
    const entity = world.ents[i];
    if (entity.alive && entity.hp > 0 && entity.team === team && entity.kind === kind) out.push(entity);
  }
  return out;
}

/** Nearest resource node of a cargo type already discovered by team 0 (VS5 policy). */
function nearestDiscoveredNode(world: World, hall: Ent | null, cargo: Tile): Ent | null {
  if (hall === null) return null;
  let best: Ent | null = null;
  let bestD = Infinity;
  for (let i = 0; i < world.ents.length; i++) {
    const entity = world.ents[i];
    if (!entity.alive || entity.kind !== Kind.Resource || entity.cargoType !== cargo) continue;
    if ((entity.seenBy & SEEN_PLAYER) === 0) continue;
    const d = Math.hypot(entity.x - hall.x, entity.z - hall.z);
    if (d < bestD) {
      bestD = d;
      best = entity;
    }
  }
  return best;
}

/** Exact tryTrain affordability + pop-cap precondition copied from sim.ts (STATS table). */
function affordableWithRoom(world: World, kind: Kind): boolean {
  const st = STATS[kind];
  const eco = world.teams[0];
  return eco.ore >= st.ore && eco.gas >= st.gas && eco.energy >= st.energy && eco.pop + st.pop <= eco.cap;
}

interface EntScan {
  hall: Ent | null;
  yard: Ent | null;
  fighter: Ent | null;
  unique: Ent | null;
  scout: Ent | null;
  rivalHall: Ent | null;
  /** Combat unit ids (Fighter + faction unique), ents index order. */
  combat: number[];
}

/** One ents pass per tick: every relevant living entity, first of each kind in index order. */
function scanEnts(world: World, uniqueKind: Kind): EntScan {
  const scan: EntScan = { hall: null, yard: null, fighter: null, unique: null, scout: null, rivalHall: null, combat: [] };
  for (let i = 0; i < world.ents.length; i++) {
    const entity = world.ents[i];
    if (!entity.alive || entity.hp <= 0) continue;
    if (entity.team === 0) {
      if (entity.kind === Kind.Hall) scan.hall ??= entity;
      else if (entity.kind === Kind.Barracks) scan.yard ??= entity;
      else if (entity.kind === Kind.Fighter) {
        scan.fighter ??= entity;
        scan.combat.push(entity.id);
      } else if (entity.kind === Kind.Scout) scan.scout ??= entity;
      else if (entity.kind === uniqueKind) {
        scan.unique ??= entity;
        scan.combat.push(entity.id);
      }
    } else if (entity.team === 1 && entity.kind === Kind.Hall) {
      scan.rivalHall ??= entity;
    }
  }
  return scan;
}
