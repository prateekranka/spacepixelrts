// VS-2A — honest AI Yard, technology, army, and attack doctrine.

import { DT, Kind, MAP, Ord } from '../src/engine';
import type { Ent } from '../src/engine';
import { STATS } from '../src/content';
import { SEEN_RIVAL } from '../src/discovery';
import type { Difficulty } from '../src/match-config';
import { World } from '../src/sim';

const SEED = 0x5eed;
const MINUTE_12_STEPS = Math.round((12 * 60) / DT);
const CADENCE_STEPS = Math.round(80 / DT);
const HONEST_STEP_GAIN_BOUND = 96;
const CENTER = { x: MAP * 0.5, z: MAP * 0.52 };
const AI_PATH_EARLIEST_TICK = Math.round((4.5 * 60) / DT);
const AI_PATH_LATEST_TICK = Math.round((7.5 * 60) / DT);
const AI_ATTACK_EARLIEST_TICK = Math.round((8 * 60) / DT);
const AI_ATTACK_LATEST_TICK = Math.round((12 * 60) / DT);
const failures: string[] = [];

type WorldWithDifficulty = World & { aiDifficulty?: Difficulty };

interface EcoSnapshot {
  ore: number;
  gas: number;
  energy: number;
}

interface PlacementCall {
  tick: number;
  team: number;
  kind: Kind;
  x: number;
  z: number;
  builderId: number;
  ok: boolean;
  delta: EcoSnapshot;
}

interface CommitCall {
  tick: number;
  team: number;
  path: string;
  ok: boolean;
  delta: EcoSnapshot;
}

interface TrainCall {
  tick: number;
  team: number;
  buildingKind: Kind;
  kind: Kind;
  ok: boolean;
  delta: EcoSnapshot;
  trainT: number;
}

interface FrontierSample {
  tick: number;
  x: number;
  z: number;
  idx: number;
  explored: boolean;
  blocked: boolean;
  adjacentExplored: boolean;
}

interface CenterHoldSnapshot {
  tick: number;
  units: { id: number; order: Ord; tid: number; tx: number; tz: number }[];
}

interface DoctrineRun {
  world: World;
  placements: PlacementCall[];
  commits: CommitCall[];
  trains: TrainCall[];
  frontier: FrontierSample[];
  maxPositiveStepGain: number;
  exploredAtStart: number;
  exploredAtEnd: number;
  yardId: number;
  yardPosition: { x: number; z: number } | null;
  yardFirstSeenTick: number;
  yardCompleteTick: number;
  forceReadyTick: number;
  preAttackCenterHold: CenterHoldSnapshot | null;
  firstCoreDiscoveryTick: number;
  firstCoreTargetTick: number;
  firstAttackTick: number;
  firstAttackForce: number;
  maxFighters: number;
  maxUniques: number;
  hiddenCoreTargetTicks: number[];
  beforeAttackFloorCoreTargetTicks: number[];
  retiredKinds: Kind[];
}

function expect(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function ecoSnapshot(world: World, team = 1): EcoSnapshot {
  const eco = world.teams[team];
  return { ore: eco.ore, gas: eco.gas, energy: eco.energy };
}

function ecoDelta(before: EcoSnapshot, after: EcoSnapshot): EcoSnapshot {
  return {
    ore: before.ore - after.ore,
    gas: before.gas - after.gas,
    energy: before.energy - after.energy,
  };
}

function positiveGain(before: EcoSnapshot, after: EcoSnapshot): number {
  return Math.max(0, after.ore - before.ore)
    + Math.max(0, after.gas - before.gas)
    + Math.max(0, after.energy - before.energy);
}

function alive(world: World, team: number, kind: Kind): Ent[] {
  return world.ents.filter((e) => e.alive && e.hp > 0 && e.team === team && e.kind === kind);
}

function combatKinds(civ: string): Kind[] {
  return civ === 'vespari' ? [Kind.Fighter, Kind.Ravager] : [Kind.Fighter, Kind.Prism];
}

function countKindAndQueued(world: World, kind: Kind): number {
  let count = alive(world, 1, kind).length;
  for (const e of world.ents) {
    if (e.alive && e.team === 1 && e.trainT > 0 && e.trainKind === kind) count++;
  }
  return count;
}

function adjacentExplored(world: World, x: number, z: number): boolean {
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dz === 0) continue;
      const xx = x + dx;
      const zz = z + dz;
      if (xx < 0 || zz < 0 || xx >= MAP || zz >= MAP) continue;
      if (world.explored[1][xx + zz * MAP] !== 0) return true;
    }
  }
  return false;
}

function exploredTiles(world: World): number {
  let total = 0;
  for (const value of world.explored[1]) total += value;
  return total;
}

function installInstrumentation(world: World): {
  placements: PlacementCall[];
  commits: CommitCall[];
  trains: TrainCall[];
} {
  const placements: PlacementCall[] = [];
  const commits: CommitCall[] = [];
  const trains: TrainCall[] = [];
  const originalPlace = world.tryPlace.bind(world);
  const originalCommit = world.tryCommitPath.bind(world);
  const originalTrain = world.tryTrain.bind(world);
  const target = world as World & {
    tryPlace: World['tryPlace'];
    tryCommitPath: World['tryCommitPath'];
    tryTrain: World['tryTrain'];
  };

  target.tryPlace = (team, kind, x, z, builderId) => {
    const before = ecoSnapshot(world, team);
    const ok = originalPlace(team, kind, x, z, builderId);
    placements.push({
      tick: world.tick,
      team,
      kind,
      x,
      z,
      builderId,
      ok,
      delta: ecoDelta(before, ecoSnapshot(world, team)),
    });
    return ok;
  };
  target.tryCommitPath = (team, path) => {
    const before = ecoSnapshot(world, team);
    const ok = originalCommit(team, path);
    commits.push({
      tick: world.tick,
      team,
      path,
      ok,
      delta: ecoDelta(before, ecoSnapshot(world, team)),
    });
    return ok;
  };
  target.tryTrain = (building, kind) => {
    const before = ecoSnapshot(world, building.team);
    const ok = originalTrain(building, kind);
    trains.push({
      tick: world.tick,
      team: building.team,
      buildingKind: building.kind,
      kind,
      ok,
      delta: ecoDelta(before, ecoSnapshot(world, building.team)),
      trainT: building.trainT,
    });
    return ok;
  };
  return { placements, commits, trains };
}

function cadenceFirstTrainTick(difficulty: Difficulty): number {
  const world = new World() as WorldWithDifficulty;
  world.aiDifficulty = difficulty;
  world.reset(SEED);
  const scout = world.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Scout);
  let first = -1;
  let previousTarget = '';
  for (let i = 0; i < CADENCE_STEPS; i++) {
    world.step();
    const target = scout ? `${scout.order}:${scout.tx}:${scout.tz}` : '';
    if (scout?.order === Ord.Move && target !== previousTarget) {
      first = world.tick;
      break;
    }
    previousTarget = target;
  }
  return first;
}

function runDoctrine(difficulty: Difficulty, steps = MINUTE_12_STEPS): DoctrineRun {
  const world = new World() as WorldWithDifficulty;
  world.aiDifficulty = difficulty;
  world.reset(SEED);
  const instrumentation = installInstrumentation(world);
  const frontier: FrontierSample[] = [];
  const hiddenCoreTargetTicks: number[] = [];
  const beforeAttackFloorCoreTargetTicks: number[] = [];
  const exploredAtStart = exploredTiles(world);
  let maxPositiveStepGain = 0;
  let previousScoutTarget = '';
  let yardFirstSeenTick = -1;
  let yardCompleteTick = -1;
  let forceReadyTick = -1;
  let preAttackCenterHold: CenterHoldSnapshot | null = null;
  let firstCoreDiscoveryTick = -1;
  let firstCoreTargetTick = -1;
  let firstAttackTick = -1;
  let firstAttackForce = 0;
  let maxFighters = 0;
  let maxUniques = 0;
  let yardId = -1;
  let yardPosition: { x: number; z: number } | null = null;

  for (let i = 0; i < steps; i++) {
    const beforeEco = ecoSnapshot(world);
    const hallBefore = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
    const coreSeenBefore = hallBefore ? (hallBefore.seenBy & SEEN_RIVAL) !== 0 : false;
    const scoutBefore = world.ents.find(
      (e) => e.alive && e.team === 1 && e.kind === Kind.Scout,
    );
    const scoutBeforeTarget = scoutBefore ? `${scoutBefore.order}:${scoutBefore.tx}:${scoutBefore.tz}` : '';

    world.step();

    const afterEco = ecoSnapshot(world);
    maxPositiveStepGain = Math.max(maxPositiveStepGain, positiveGain(beforeEco, afterEco));
    const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
    const coreSeen = hall ? (hall.seenBy & SEEN_RIVAL) !== 0 : false;
    if (!coreSeenBefore && coreSeen && firstCoreDiscoveryTick < 0) firstCoreDiscoveryTick = world.tick;

    const scout = world.ents.find(
      (e) => e.alive && e.team === 1 && e.kind === Kind.Scout,
    );
    if (scout && scout.order === Ord.Move) {
      const target = `${scout.order}:${scout.tx}:${scout.tz}`;
      if (target !== previousScoutTarget && target !== scoutBeforeTarget) {
        const x = Math.floor(scout.tx);
        const z = Math.floor(scout.tz);
        if (x >= 0 && z >= 0 && x < MAP && z < MAP) {
          const idx = x + z * MAP;
          frontier.push({
            tick: world.tick,
            x,
            z,
            idx,
            explored: world.explored[1][idx] !== 0,
            blocked: world.block[idx] !== 0,
            adjacentExplored: adjacentExplored(world, x, z),
          });
        }
      }
      previousScoutTarget = target;
    }

    const yard = world.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Barracks);
    if (yard) {
      yardId = yard.id;
      yardPosition = { x: yard.x, z: yard.z };
      if (yardFirstSeenTick < 0) yardFirstSeenTick = world.tick;
      if (yard.progress >= 1 && yardCompleteTick < 0) yardCompleteTick = world.tick;
    }

    const force = alive(world, 1, Kind.Fighter).length
      + alive(world, 1, world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism).length;
    const field = world.ents.filter(
      (e) => e.alive && e.hp > 0 && e.team === 1
        && (e.kind === Kind.Fighter || e.kind === Kind.Ravager || e.kind === Kind.Prism),
    );
    maxFighters = Math.max(maxFighters, alive(world, 1, Kind.Fighter).length);
    maxUniques = Math.max(maxUniques, alive(world, 1, world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism).length);
    if (forceReadyTick < 0 && alive(world, 1, Kind.Fighter).length >= 2
      && alive(world, 1, world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism).length >= 2) {
      forceReadyTick = world.tick;
    }
    if (preAttackCenterHold === null && world.tick < AI_ATTACK_EARLIEST_TICK && field.length >= 4) {
      preAttackCenterHold = {
        tick: world.tick,
        units: field.map((unit) => ({
          id: unit.id,
          order: unit.order,
          tid: unit.tid,
          tx: unit.tx,
          tz: unit.tz,
        })),
      };
    }
    for (const unit of world.ents) {
      if (!unit.alive || unit.team !== 1 || (unit.kind !== Kind.Fighter && unit.kind !== Kind.Ravager && unit.kind !== Kind.Prism)) continue;
      const target = unit.tid >= 0 ? world.ents[unit.tid] : null;
      if (!target || target.id !== hall?.id) continue;
      if (!coreSeen) hiddenCoreTargetTicks.push(world.tick);
      if (world.tick < AI_ATTACK_EARLIEST_TICK) beforeAttackFloorCoreTargetTicks.push(world.tick);
      if (firstCoreTargetTick < 0) firstCoreTargetTick = world.tick;
      if (firstAttackTick < 0 && (unit.order === Ord.Attack || unit.order === Ord.AttackMove)) {
        firstAttackTick = world.tick;
        firstAttackForce = force;
      }
    }
  }

  const unique = world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism;
  const retiredKinds = world.ents
    .filter((e) => e.alive && e.team === 1 && (e.kind === Kind.Siege || e.kind === Kind.Shade))
    .map((e) => e.kind);
  const firstPlacement = instrumentation.placements.find((call) => call.ok);
  const firstYard = world.ents.find((e) => e.id === yardId);
  if (!yardPosition && firstPlacement) yardPosition = { x: firstPlacement.x, z: firstPlacement.z };
  if (yardFirstSeenTick < 0 && firstYard?.alive) yardFirstSeenTick = firstPlacement?.tick ?? -1;
  if (yardCompleteTick < 0 && firstYard?.alive && firstYard.progress >= 1) yardCompleteTick = world.tick;
  // Keep the variable in the report so the test explicitly checks the faction mapping.
  void unique;

  return {
    world,
    placements: instrumentation.placements,
    commits: instrumentation.commits,
    trains: instrumentation.trains,
    frontier,
    maxPositiveStepGain,
    exploredAtStart,
    exploredAtEnd: exploredTiles(world),
    yardId,
    yardPosition,
    yardFirstSeenTick,
    yardCompleteTick,
    forceReadyTick,
    preAttackCenterHold,
    firstCoreDiscoveryTick,
    firstCoreTargetTick,
    firstAttackTick,
    firstAttackForce,
    maxFighters,
    maxUniques,
    hiddenCoreTargetTicks,
    beforeAttackFloorCoreTargetTicks,
    retiredKinds,
  };
}

function validateRun(run: DoctrineRun, label: string): void {
  const { world } = run;
  const worldWithDifficulty = world as WorldWithDifficulty;
  const unique = world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism;
  const expectedPath = world.civ[1] === 'vespari' ? 'sky-dominion' : 'iron-colossus';
  const yardPlacements = run.placements.filter((call) => call.ok && call.kind === Kind.Barracks);
  const commitSuccesses = run.commits.filter((call) => call.ok);
  const yardTrainSuccesses = run.trains.filter(
    (call) => call.ok && call.team === 1 && call.buildingKind === Kind.Barracks,
  );
  const fighters = run.maxFighters;
  const uniques = run.maxUniques;
  const yards = alive(world, 1, Kind.Barracks);
  const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);

  expect(world.scriptedMarshalEnabled === false, `${label}: scripted marshal remains disabled`);
  expect(worldWithDifficulty.aiDifficulty === 'standard', `${label}: Standard is the default AI difficulty`);
  expect(yardPlacements.length === 1, `${label}: exactly one legal Yard placement succeeds (got ${yardPlacements.length})`);
  expect(run.placements.some((call) => call.kind === Kind.Barracks), `${label}: AI makes a tryPlace call for the Yard`);
  expect(yardPlacements[0]?.kind === Kind.Barracks, `${label}: the legal Yard placement uses the Yard kind`);
  expect(yards.length === 1, `${label}: exactly one alive AI Yard exists (got ${yards.length})`);
  expect(run.yardFirstSeenTick >= 0 && run.yardCompleteTick > run.yardFirstSeenTick, `${label}: Yard follows incomplete -> complete Worker construction`);
  expect(yardPlacements[0]?.delta.ore === STATS[Kind.Barracks].ore, `${label}: Yard deducts exactly ${STATS[Kind.Barracks].ore} Ore`);
  expect(yardPlacements[0]?.delta.gas === STATS[Kind.Barracks].gas, `${label}: Yard deducts exactly ${STATS[Kind.Barracks].gas} Volatiles`);
  expect(yardPlacements[0]?.delta.energy === STATS[Kind.Barracks].energy, `${label}: Yard deducts exactly ${STATS[Kind.Barracks].energy} Charge`);
  expect(run.yardPosition !== null, `${label}: Yard position is observable`);
  if (run.yardPosition) {
    const core = world.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Hall);
    expect(!!core && Math.hypot(run.yardPosition.x - core.x, run.yardPosition.z - core.z) < 8, `${label}: Yard is in the deterministic ring near the AI Core`);
  }

  expect(commitSuccesses.length === 1, `${label}: exactly one legal path commit succeeds (got ${commitSuccesses.length})`);
  expect(run.commits.length === 1, `${label}: AI makes exactly one tryCommitPath call (got ${run.commits.length})`);
  expect(commitSuccesses[0]?.path === expectedPath, `${label}: AI commits ${expectedPath}`);
  expect(
    commitSuccesses[0]?.tick >= AI_PATH_EARLIEST_TICK && commitSuccesses[0]?.tick <= AI_PATH_LATEST_TICK,
    `${label}: first legal path commit is in the 4:30–7:30 window (got tick ${commitSuccesses[0]?.tick ?? -1})`,
  );
  expect(commitSuccesses[0]?.delta.ore === 400, `${label}: path deducts exactly 400 Ore`);
  expect(commitSuccesses[0]?.delta.energy === 80, `${label}: path deducts exactly 80 Charge`);
  expect(world.techPathOf(1) === expectedPath, `${label}: path locks after the normal channel`);
  expect(world.pathChannelT(1) === 0, `${label}: path channel elapses normally`);

  expect(yardTrainSuccesses.length > 0, `${label}: completed Yard trains through tryTrain`);
  expect(yardTrainSuccesses.every((call) => call.kind === Kind.Fighter || call.kind === unique), `${label}: Yard trains only Fighter/${unique}`);
  expect(run.trains.every((call) => call.kind !== Kind.Siege && call.kind !== Kind.Shade), `${label}: no Siege or Shade training call occurs`);
  for (const call of yardTrainSuccesses) {
    const st = STATS[call.kind];
    expect(call.delta.ore === st.ore && call.delta.gas === st.gas && call.delta.energy === st.energy, `${label}: ${call.kind} uses its exact table cost`);
    expect(call.trainT > 0, `${label}: ${call.kind} keeps its normal positive training time`);
  }
  expect(fighters >= 2, `${label}: first field force has at least two Fighters (got ${fighters})`);
  expect(uniques >= 2, `${label}: first field force has at least two ${unique}s (got ${uniques})`);
  expect(run.forceReadyTick >= 0 && run.forceReadyTick <= AI_ATTACK_EARLIEST_TICK, `${label}: first 2+2 force is ready by 8:00 (got tick ${run.forceReadyTick})`);
  expect(run.preAttackCenterHold !== null, `${label}: a >=4 force snapshot exists before the 8:00 attack floor`);
  if (run.preAttackCenterHold) {
    expect(run.preAttackCenterHold.tick < AI_ATTACK_EARLIEST_TICK, `${label}: center hold snapshot is before 8:00`);
    expect(run.preAttackCenterHold.units.length >= 4, `${label}: center hold snapshot has a four-unit force`);
    expect(
      run.preAttackCenterHold.units.every(
        (unit) => unit.order === Ord.AttackMove
          && unit.tid === -1
          && Math.abs(unit.tx - CENTER.x) < 1e-9
          && Math.abs(unit.tz - CENTER.z) < 1e-9,
      ),
      `${label}: pre-8:00 force holds center with AttackMove and tid=-1`,
    );
  }
  expect(run.retiredKinds.length === 0, `${label}: no retired Siege/ Shade units exist`);
  const yard = yards[0];
  expect(!!yard && Math.abs(yard.rallyX - CENTER.x) < 1e-9 && Math.abs(yard.rallyZ - CENTER.z) < 1e-9, `${label}: Yard rally is the Central Lumen Field`);
  expect(yardTrainSuccesses.some((call) => call.kind === Kind.Fighter) && yardTrainSuccesses.some((call) => call.kind === unique), `${label}: mixed production is present rather than one unit type`);

  expect(run.maxPositiveStepGain <= HONEST_STEP_GAIN_BOUND, `${label}: max positive economy jump stays honest (got ${run.maxPositiveStepGain}, bound ${HONEST_STEP_GAIN_BOUND})`);
  expect(run.frontier.length > 0, `${label}: Scout receives an unexplored frontier target`);
  expect(run.frontier.every((sample) => !sample.explored && !sample.blocked && sample.adjacentExplored), `${label}: every Scout target is unexplored, open, and frontier-adjacent`);
  expect(run.exploredAtEnd > run.exploredAtStart, `${label}: explored area continues growing (${run.exploredAtStart} -> ${run.exploredAtEnd})`);

  expect(run.hiddenCoreTargetTicks.length === 0, `${label}: no combat unit targets the player Core before SEEN_RIVAL discovery`);
  expect(run.beforeAttackFloorCoreTargetTicks.length === 0, `${label}: no combat unit targets the player Core before the 8:00 attack floor`);
  expect(run.firstCoreDiscoveryTick >= 0, `${label}: AI Scout legitimately discovers the player Core`);
  expect(
    run.firstCoreTargetTick >= AI_ATTACK_EARLIEST_TICK && run.firstCoreTargetTick <= AI_ATTACK_LATEST_TICK,
    `${label}: first Core target is in the 8:00–12:00 window (got tick ${run.firstCoreTargetTick})`,
  );
  expect(run.firstAttackTick > run.firstCoreDiscoveryTick, `${label}: Core attack starts only after discovery (${run.firstCoreDiscoveryTick} -> ${run.firstAttackTick})`);
  expect(run.firstAttackTick >= AI_ATTACK_EARLIEST_TICK && run.firstAttackTick <= AI_ATTACK_LATEST_TICK, `${label}: first Core attack is by 12:00 (got tick ${run.firstAttackTick})`);
  expect(run.firstAttackForce >= 4, `${label}: first Core attack has a four-unit field force (got ${run.firstAttackForce})`);
  expect(!!hall && (hall.seenBy & SEEN_RIVAL) !== 0, `${label}: player Core retains its AI discovery latch`);
}

// ---- difficulty cadence and default ---------------------------------------------------
{
  const fresh = new World() as WorldWithDifficulty;
  expect(fresh.aiDifficulty === 'standard', 'default World.aiDifficulty is Standard');
  expect(cadenceFirstTrainTick('cadet') === Math.round(2.6 / DT), `Cadet AI cadence is 2.6s (${Math.round(2.6 / DT)} steps)`);
  expect(cadenceFirstTrainTick('standard') === Math.round(1.4 / DT), `Standard AI cadence is 1.4s (${Math.round(1.4 / DT)} steps)`);
  expect(cadenceFirstTrainTick('veteran') === Math.round(0.8 / DT), `Veteran AI cadence is 0.8s (${Math.round(0.8 / DT)} steps)`);
}

// ---- fixed-seed Standard doctrine -----------------------------------------------------
const standard = runDoctrine('standard');
validateRun(standard, 'Standard doctrine');

// ---- same seed + difficulty produces the same strategic milestones --------------------
const repeat = runDoctrine('standard');
expect(JSON.stringify(standard.yardPosition) === JSON.stringify(repeat.yardPosition), 'same seed+difficulty keeps the Yard position deterministic');
expect(standard.world.techPathOf(1) === repeat.world.techPathOf(1), 'same seed+difficulty keeps the path deterministic');
expect(standard.commits.find((call) => call.ok)?.tick === repeat.commits.find((call) => call.ok)?.tick, 'same seed+difficulty keeps path commit tick deterministic');
expect(standard.forceReadyTick === repeat.forceReadyTick, 'same seed+difficulty keeps 2+2 force-ready tick deterministic');
expect(alive(standard.world, 1, Kind.Fighter).length === alive(repeat.world, 1, Kind.Fighter).length, 'same seed+difficulty keeps Fighter count deterministic');
expect(alive(standard.world, 1, standard.world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism).length === alive(repeat.world, 1, repeat.world.civ[1] === 'vespari' ? Kind.Ravager : Kind.Prism).length, 'same seed+difficulty keeps unique count deterministic');
expect(standard.firstCoreTargetTick === repeat.firstCoreTargetTick, 'same seed+difficulty keeps first Core target tick deterministic');
expect(standard.firstAttackTick === repeat.firstAttackTick, 'same seed+difficulty keeps first Core attack tick deterministic');

if (failures.length > 0) {
  console.error(`VS2A AI doctrine RED: ${failures.length} failure(s)`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log('VS2A AI doctrine tests: PASS');
}
