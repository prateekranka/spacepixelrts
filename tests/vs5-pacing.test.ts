import assert from 'node:assert/strict';
import { DT, Kind, Ord, Tile } from '../src/engine';
import type { Civ } from '../src/engine';
import { CIV_PROFILE, STATS, fighterName, labelOf, uniqueUnit } from '../src/content';
import { SEEN_PLAYER, SEEN_RIVAL } from '../src/discovery';
import { evaluateOpeningGuidance } from '../src/opening-guidance';
import { World, OPENING_ORE_RESERVE } from '../src/sim';
import type { TechPathId } from '../src/content';

const SEED = 0x5eed;
const START_ORE = CIV_PROFILE.vespari.startOre;
const COMPACT_OPENING_ORE = 150 + 400 + 60 + 70 + 90;

function baseNode(world: World, team: number, kind: Tile) {
  const hall = world.ents.find((entity) => entity.alive && entity.team === team && entity.kind === Kind.Hall);
  assert.ok(hall, `team ${team} Hall exists`);
  const node = world.ents
    .filter((entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === kind)
    .sort((a, b) => Math.hypot(a.x - hall.x, a.z - hall.z) - Math.hypot(b.x - hall.x, b.z - hall.z))[0];
  assert.ok(node, `team ${team} ${Tile[kind]} node exists`);
  return node;
}

assert.equal(OPENING_ORE_RESERVE, 700, 'VS5 opening Ore reserve is the frozen 700');
assert.ok(START_ORE + OPENING_ORE_RESERVE >= 770, 'one safe Ore node funds the compact opening');
assert.equal(
  START_ORE + OPENING_ORE_RESERVE - COMPACT_OPENING_ORE,
  150,
  'compact opening leaves the frozen 150 Ore buffer',
);

const world = new World();
world.reset(SEED);
for (const team of [0, 1]) {
  const ore = baseNode(world, team, Tile.Ore);
  const gas = baseNode(world, team, Tile.Gas);
  const solar = baseNode(world, team, Tile.Solar);
  assert.equal(ore.hp, 700, `team ${team} opening Ore hp`);
  assert.equal(ore.maxHp, 700, `team ${team} opening Ore maxHp`);
  assert.equal(gas.hp, 200, `team ${team} opening Volatiles reserve is unchanged`);
  assert.equal(gas.maxHp, 200, `team ${team} opening Volatiles maxHp is unchanged`);
  assert.equal(solar.hp, 160, `team ${team} opening Solar reserve is unchanged`);
  assert.equal(solar.maxHp, 160, `team ${team} opening Solar maxHp is unchanged`);
}

const first = world.ents
  .filter((entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === Tile.Ore)
  .map((entity) => `${entity.x}:${entity.z}:${entity.hp}:${entity.maxHp}`)
  .sort()
  .join('|');
world.reset(SEED);
const second = world.ents
  .filter((entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === Tile.Ore)
  .map((entity) => `${entity.x}:${entity.z}:${entity.hp}:${entity.maxHp}`)
  .sort()
  .join('|');
assert.equal(second, first, 'same-seed reset preserves opening Ore positions and reserves');

type GuidanceOverrides = Partial<{
  ore: number;
  energy: number;
  techPath: TechPathId | null;
  channelT: number;
}>;

function guidance(world: World, overrides: GuidanceOverrides = {}, selected: Iterable<number> = []) {
  const eco = world.teams[0];
  return evaluateOpeningGuidance(world.ents, world.landmarks, new Set(selected), {
    ore: overrides.ore ?? eco.ore,
    energy: overrides.energy ?? eco.energy,
    techPath: overrides.techPath === undefined ? eco.techPath : overrides.techPath,
    channelT: overrides.channelT ?? eco.ageT,
  });
}

function placePlayerYard(world: World): void {
  const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
  const worker = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Worker);
  assert.ok(hall && worker, 'guidance fixture has a player Hall and Worker');
  const spots = [
    { x: hall.x - 3.4, z: hall.z - 3.4 },
    { x: hall.x, z: hall.z - 4.4 },
    { x: hall.x + 3.4, z: hall.z - 3.4 },
    { x: hall.x + 4.4, z: hall.z },
  ];
  const spot = spots.find((candidate) => world.canPlace(candidate.x, candidate.z, 1.05));
  assert.ok(spot, 'guidance fixture has a legal Yard spot');
  assert.equal(world.tryPlace(0, Kind.Barracks, spot.x, spot.z, worker.id), true, 'guidance fixture places Yard legally');
}

// Pure evaluator order/copy — economy and progression outrank objective and Scout state.
{
  const fixture = new World();
  fixture.reset(SEED);
  assert.equal(guidance(fixture).id, 'build-yard');
  assert.equal(guidance(fixture).primary, 'Build a Yard');
  assert.equal(guidance(fixture).secondary, 'Select a Worker · 150 Ore + 20 Charge');

  placePlayerYard(fixture);
  const yard = fixture.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Barracks);
  assert.ok(yard);
  assert.equal(guidance(fixture).id, 'complete-yard');
  assert.equal(guidance(fixture).primary, 'Complete your Yard');
  assert.equal(guidance(fixture).secondary, 'Keep the assigned Worker on construction');

  yard.progress = 1;
  yard.hp = yard.maxHp;
  const central = fixture.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
  assert.ok(central);
  central.discoveredBy |= SEEN_PLAYER;
  const fund = guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 });
  assert.deepEqual(fund, {
    id: 'assign-ore',
    primary: 'Assign 2 Workers to Ore',
    secondary: 'Ore Workers 0/2 · Find Idle Worker → GATHER → marked Ore',
  });

  const workers = fixture.ents.filter(
    (entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Worker,
  );
  const ore = baseNode(fixture, 0, Tile.Ore);
  const gas = baseNode(fixture, 0, Tile.Gas);
  const firstOre = workers[0];
  const gasWorker = workers[1];
  const secondOre = workers[2];
  assert.ok(firstOre && gasWorker && secondOre);

  fixture.issue([firstOre.id], Ord.Gather, ore.x, ore.z, ore.id);
  assert.deepEqual(guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 }), {
    id: 'assign-ore',
    primary: 'Assign 2 Workers to Ore',
    secondary: 'Ore Workers 1/2 · Find Idle Worker → GATHER → marked Ore',
  });

  fixture.issue([gasWorker.id], Ord.Gather, gas.x, gas.z, gas.id);
  assert.equal(
    guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 }).secondary,
    'Ore Workers 1/2 · Find Idle Worker → GATHER → marked Ore',
    'Gas Gather does not count as an Ore Worker',
  );

  fixture.issue([secondOre.id], Ord.Gather, ore.x, ore.z, ore.id);
  assert.deepEqual(guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 }), {
    id: 'fund-path',
    primary: 'Fund technology',
    secondary: 'Ore 398/400 · Charge 79/80 · Ore Workers 2/2',
  });

  const hall = fixture.ents.find(
    (entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall,
  );
  const returning = workers[3];
  const rivalWorker = fixture.ents.find(
    (entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Worker,
  );
  const rivalOre = baseNode(fixture, 1, Tile.Ore);
  assert.ok(hall && returning && rivalWorker);
  fixture.issue([returning.id], Ord.Return, hall.x, hall.z, hall.id);
  returning.cargoType = Tile.Ore;
  assert.equal(
    guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 }).secondary,
    'Ore 398/400 · Charge 79/80 · Ore Workers 3/2',
    'returning Ore cargo counts as an Ore Worker',
  );
  returning.alive = false;
  assert.equal(
    guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 }).secondary,
    'Ore 398/400 · Charge 79/80 · Ore Workers 2/2',
    'dead Workers do not count',
  );
  rivalWorker.order = Ord.Gather;
  rivalWorker.tid = rivalOre.id;
  assert.equal(
    guidance(fixture, { ore: 398, energy: 79, techPath: null, channelT: 0 }).secondary,
    'Ore 398/400 · Charge 79/80 · Ore Workers 2/2',
    'rival Workers do not count',
  );

  const choose = guidance(fixture, { ore: 400, energy: 80, techPath: null, channelT: 0 });
  assert.equal(choose.id, 'choose-path');
  assert.equal(choose.primary, 'Choose a technology path');
  assert.equal(choose.secondary, 'Select your Nexus and commit one of two doctrines');

  const channel = guidance(fixture, { techPath: null, channelT: 39.01 });
  assert.equal(channel.id, 'path-channel');
  assert.equal(channel.primary, 'Technology locks in 40s');
  assert.equal(channel.secondary, 'Keep gathering Ore and Volatiles');
  const channelLater = guidance(fixture, { techPath: null, channelT: 2.01 });
  assert.equal(channelLater.id, 'path-channel');
  assert.equal(channelLater.primary, 'Technology locks in 3s');

  const train = guidance(fixture, { techPath: 'sky-dominion', channelT: 0 });
  assert.equal(train.id, 'train-army');
  assert.equal(train.primary, 'Train Lumen Guard + Solar Strider');
  assert.equal(train.secondary, 'Select your Yard · Habitat only if population is full');
  const fighter = fixture.spawn(Kind.Fighter, 'vespari', 0, yard.x, yard.z);
  assert.ok(fighter);
  assert.equal(guidance(fixture, { techPath: 'sky-dominion' }).primary, 'Train Solar Strider');
  const unique = fixture.spawn(Kind.Ravager, 'vespari', 0, yard.x, yard.z);
  assert.ok(unique);
  const scout = fixture.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Scout);
  assert.ok(scout);
  central.discoveredBy &= ~SEEN_PLAYER;
  assert.equal(guidance(fixture, { techPath: 'sky-dominion' }, [scout.id]).id, 'explore-signal');
  assert.equal(guidance(fixture, { techPath: 'sky-dominion' }).id, 'select-scout');
  assert.equal(guidance(fixture, { techPath: 'sky-dominion' }, [scout.id]).primary, 'Explore the nearby signal');
}

// The train copy is derived from the alive player faction, including Gravemark names.
{
  const gravemark = new World();
  gravemark.reset(SEED);
  const hall = gravemark.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
  assert.ok(hall);
  hall.civ = 'aurion';
  placePlayerYard(gravemark);
  const yard = gravemark.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Barracks);
  assert.ok(yard);
  yard.progress = 1;
  yard.hp = yard.maxHp;
  const expectedFighter = fighterName(hall.civ);
  const expectedUnique = labelOf(uniqueUnit(hall.civ), hall.civ);
  const train = guidance(gravemark, { ore: 400, energy: 80, techPath: 'iron-colossus', channelT: 0 });
  assert.equal(train.id, 'train-army');
  assert.equal(train.primary, `Train ${expectedFighter} + ${expectedUnique}`);
}

interface OpeningPolicyRun {
  civ: Civ;
  path: TechPathId;
  world: World;
  placement: { ok: boolean; kind: Kind; delta: { ore: number; gas: number; energy: number } };
  commit: { ok: boolean; delta: { ore: number; gas: number; energy: number } } | null;
  trains: { ok: boolean; kind: Kind; delta: { ore: number; gas: number; energy: number }; trainT: number }[];
  builderReturned: boolean;
  yardCompleteTick: number;
  pathLockTick: number;
  pairTick: number;
  maxPositiveStepGain: number;
}

function runOpeningPolicy(civ: Civ): OpeningPolicyRun {
  const world = new World();
  world.civ[0] = civ;
  world.civ[1] = civ === 'vespari' ? 'aurion' : 'vespari';
  world.reset(SEED);
  const path: TechPathId = civ === 'vespari' ? 'sky-dominion' : 'iron-colossus';
  const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
  const workers = world.ents.filter((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Worker);
  assert.ok(hall && workers.length === 4, `${civ} policy fixture has the opening Nexus and Workers`);
  const ore = baseNode(world, 0, Tile.Ore);
  const solar = baseNode(world, 0, Tile.Solar);
  const spots = [
    { x: hall.x - 3.4, z: hall.z - 3.4 },
    { x: hall.x, z: hall.z - 4.4 },
    { x: hall.x + 3.4, z: hall.z - 3.4 },
    { x: hall.x + 4.4, z: hall.z },
  ];
  const spot = spots.find((candidate) => world.canPlace(candidate.x, candidate.z, STATS[Kind.Barracks].radius));
  assert.ok(spot, `${civ} policy fixture has a legal Yard location`);

  const placementCalls: OpeningPolicyRun['placement'][] = [];
  const commitCalls: NonNullable<OpeningPolicyRun['commit']>[] = [];
  const trainCalls: OpeningPolicyRun['trains'] = [];
  const originalPlace = world.tryPlace.bind(world);
  const originalCommit = world.tryCommitPath.bind(world);
  const originalTrain = world.tryTrain.bind(world);
  const instrumented = world as World & {
    tryPlace: World['tryPlace'];
    tryCommitPath: World['tryCommitPath'];
    tryTrain: World['tryTrain'];
  };
  instrumented.tryPlace = (team, kind, x, z, builderId) => {
    const before = { ...world.teams[team] };
    const ok = originalPlace(team, kind, x, z, builderId);
    const after = world.teams[team];
    if (team === 0) {
      placementCalls.push({
        ok,
        kind,
        delta: { ore: before.ore - after.ore, gas: before.gas - after.gas, energy: before.energy - after.energy },
      });
    }
    return ok;
  };
  instrumented.tryCommitPath = (team, requestedPath) => {
    const before = { ...world.teams[team] };
    const ok = originalCommit(team, requestedPath);
    const after = world.teams[team];
    if (team === 0) {
      commitCalls.push({
        ok,
        delta: { ore: before.ore - after.ore, gas: before.gas - after.gas, energy: before.energy - after.energy },
      });
    }
    return ok;
  };
  instrumented.tryTrain = (building, kind) => {
    const before = { ...world.teams[building.team] };
    const ok = originalTrain(building, kind);
    const after = world.teams[building.team];
    if (building.team === 0 && (kind === Kind.Fighter || kind === uniqueUnit(civ))) {
      trainCalls.push({
        ok,
        kind,
        delta: { ore: before.ore - after.ore, gas: before.gas - after.gas, energy: before.energy - after.energy },
        trainT: building.trainT,
      });
    }
    return ok;
  };

  const builder = workers[3];
  assert.equal(world.tryPlace(0, Kind.Barracks, spot.x, spot.z, builder.id), true, `${civ} policy places Yard through tryPlace`);
  const yard = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Barracks);
  assert.ok(yard);
  world.issue([workers[0].id, workers[1].id], Ord.Gather, ore.x, ore.z, ore.id);
  world.issue([workers[2].id], Ord.Gather, solar.x, solar.z, solar.id);

  let builderReturned = false;
  let yardCompleteTick = -1;
  let pathLockTick = -1;
  let pairTick = -1;
  let commit: OpeningPolicyRun['commit'] = null;
  let maxPositiveStepGain = 0;
  let fighterIssued = false;
  let uniqueIssued = false;
  const unique = uniqueUnit(civ);
  const limit = Math.round((10 * 60) / DT);
  for (let step = 0; step < limit && world.winner === -1; step++) {
    const before = { ...world.teams[0] };
    world.step();
    const after = world.teams[0];
    maxPositiveStepGain = Math.max(
      maxPositiveStepGain,
      Math.max(0, after.ore - before.ore) + Math.max(0, after.gas - before.gas) + Math.max(0, after.energy - before.energy),
    );
    if (yard.progress >= 1 && yardCompleteTick < 0) yardCompleteTick = world.tick;
    if (yard.progress >= 1 && !builderReturned) {
      world.issue([builder.id], Ord.Gather, ore.x, ore.z, ore.id);
      builderReturned = builder.order === Ord.Gather && builder.tid === ore.id;
    }
    if (commit === null && yardCompleteTick >= 0 && world.teams[0].ore >= 400 && world.teams[0].energy >= 80) {
      const beforeCommit = { ...world.teams[0] };
      const ok = world.tryCommitPath(0, path);
      const afterCommit = world.teams[0];
      commit = {
        ok,
        delta: {
          ore: beforeCommit.ore - afterCommit.ore,
          gas: beforeCommit.gas - afterCommit.gas,
          energy: beforeCommit.energy - afterCommit.energy,
        },
      };
    }
    if (pathLockTick < 0 && world.techPathOf(0) === path) pathLockTick = world.tick;
    if (pathLockTick >= 0 && yard.trainT <= 0) {
      if (!fighterIssued) fighterIssued = world.tryTrain(yard, Kind.Fighter);
      else if (!uniqueIssued) uniqueIssued = world.tryTrain(yard, unique);
    }
    const fighterAlive = world.ents.some(
      (entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === Kind.Fighter,
    );
    const uniqueAlive = world.ents.some(
      (entity) => entity.alive && entity.hp > 0 && entity.team === 0 && entity.kind === unique,
    );
    if (pairTick < 0 && fighterAlive && uniqueAlive) pairTick = world.tick;
  }

  assert.equal(placementCalls.filter((call) => call.ok).length, 1, `${civ} policy has one successful Yard placement`);
  assert.equal(placementCalls[0]?.kind, Kind.Barracks, `${civ} policy placement kind is Yard`);
  assert.deepEqual(placementCalls[0]?.delta, {
    ore: STATS[Kind.Barracks].ore,
    gas: STATS[Kind.Barracks].gas,
    energy: STATS[Kind.Barracks].energy,
  }, `${civ} policy Yard uses the exact table cost`);
  assert.equal(builderReturned, true, `${civ} builder returns to the Ore node through Gather`);
  assert.equal(commitCalls.length, 1, `${civ} policy makes one captured commit call`);
  assert.ok(commit?.ok, `${civ} policy commits its path through tryCommitPath`);
  assert.deepEqual(commit?.delta, { ore: 400, gas: 0, energy: 80 }, `${civ} path uses exact 400 Ore + 80 Charge`);
  assert.ok(pathLockTick >= 0 && pathLockTick <= Math.round((8 * 60) / DT), `${civ} path locks by 8:00`);
  assert.equal(trainCalls.filter((call) => call.ok).length, 2, `${civ} policy trains Fighter + unique through tryTrain`);
  for (const call of trainCalls.filter((entry) => entry.ok)) {
    const stats = STATS[call.kind];
    assert.deepEqual(call.delta, { ore: stats.ore, gas: stats.gas, energy: stats.energy }, `${civ} ${Kind[call.kind]} exact training cost`);
    assert.equal(call.trainT, stats.train, `${civ} ${Kind[call.kind]} keeps ordinary train time`);
  }
  assert.ok(pairTick >= 0 && pairTick <= Math.round((10 * 60) / DT), `${civ} mixed pair is alive by 10:00`);
  assert.ok(maxPositiveStepGain <= 96, `${civ} policy economy has no hidden grant jump`);
  return {
    civ,
    path,
    world,
    placement: placementCalls[0],
    commit,
    trains: trainCalls.filter((call) => call.ok),
    builderReturned,
    yardCompleteTick,
    pathLockTick,
    pairTick,
    maxPositiveStepGain,
  };
}

const vespariPolicy = runOpeningPolicy('vespari');
const repeatVespariPolicy = runOpeningPolicy('vespari');
const aurionPolicy = runOpeningPolicy('aurion');
assert.equal(vespariPolicy.pathLockTick, repeatVespariPolicy.pathLockTick, 'same-seed Sunweaver policy is deterministic');
assert.equal(vespariPolicy.pairTick, repeatVespariPolicy.pairTick, 'same-seed Sunweaver pair timing is deterministic');
assert.equal(aurionPolicy.trains[1]?.kind, Kind.Prism, 'Gravemark policy maps unique training to Burden Walker/Prism');

// Eight normal fixed seeds still reach a real terminal without hidden targets or grants.
for (const seed of [0x5eed, 0x5eee, 0x5eef, 0x5ef0, 0x5ef1, 0x5ef2, 0x5ef3, 0x5ef4]) {
  const world = new World();
  world.reset(seed);
  const limit = Math.round((18 * 60) / DT);
  let maxPositiveStepGain = 0;
  let hiddenCoreTarget = false;
  let winnerTick = -1;
  for (let step = 0; step < limit && world.winner === -1; step++) {
    const before = { ...world.teams[1] };
    world.step();
    const after = world.teams[1];
    maxPositiveStepGain = Math.max(
      maxPositiveStepGain,
      Math.max(0, after.ore - before.ore) + Math.max(0, after.gas - before.gas) + Math.max(0, after.energy - before.energy),
    );
    const hall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
    if (hall && (hall.seenBy & SEEN_RIVAL) === 0) {
      hiddenCoreTarget ||= world.ents.some(
        (entity) => entity.alive && entity.hp > 0 && entity.team === 1
          && (entity.kind === Kind.Fighter || entity.kind === Kind.Ravager || entity.kind === Kind.Prism)
          && entity.tid === hall.id,
      );
    }
    if (winnerTick < 0 && world.winner !== -1) winnerTick = world.tick;
  }
  assert.equal(hiddenCoreTarget, false, `seed ${seed.toString(16)} has no hidden Core target`);
  assert.ok(maxPositiveStepGain <= 96, `seed ${seed.toString(16)} has no hidden economy grant`);
  assert.ok(world.winner !== -1 && winnerTick <= limit, `seed ${seed.toString(16)} has a real winner by 18:00`);
}

// Scout replacement RED — kill the actual rival Scout and run the real sim to 18:00.
{
  const replacement = new World();
  replacement.reset(SEED);
  const rivalScout = replacement.ents.find(
    (entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Scout,
  );
  const playerHall = replacement.ents.find(
    (entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall,
  );
  assert.ok(rivalScout && playerHall, 'replacement fixture starts with an actual rival Scout and player Nexus');
  replacement.kill(rivalScout);

  const trainCalls: {
    tick: number;
    team: number;
    buildingKind: Kind;
    kind: Kind;
    ok: boolean;
    delta: { ore: number; gas: number; energy: number };
    trainT: number;
  }[] = [];
  const originalTryTrain = replacement.tryTrain.bind(replacement);
  const instrumented = replacement as World & { tryTrain: World['tryTrain'] };
  instrumented.tryTrain = (building, kind) => {
    const before = { ...replacement.teams[building.team] };
    const ok = originalTryTrain(building, kind);
    const after = replacement.teams[building.team];
    trainCalls.push({
      tick: replacement.tick,
      team: building.team,
      buildingKind: building.kind,
      kind,
      ok,
      delta: {
        ore: before.ore - after.ore,
        gas: before.gas - after.gas,
        energy: before.energy - after.energy,
      },
      trainT: building.trainT,
    });
    return ok;
  };

  const limit = Math.round((18 * 60) / DT);
  let discoveryTick = -1;
  let attackTick = -1;
  let winnerTick = -1;
  for (let step = 0; step < limit; step++) {
    replacement.step();
    if (discoveryTick < 0 && (playerHall.seenBy & SEEN_RIVAL) !== 0) discoveryTick = replacement.tick;
    if (attackTick < 0) {
      const attacking = replacement.ents.some(
        (entity) => entity.alive && entity.hp > 0 && entity.team === 1
          && (entity.kind === Kind.Fighter || entity.kind === Kind.Ravager || entity.kind === Kind.Prism)
          && (entity.order === Ord.Attack || entity.order === Ord.AttackMove)
          && entity.tid === playerHall.id,
      );
      if (attacking) attackTick = replacement.tick;
    }
    if (winnerTick < 0 && replacement.winner !== -1) winnerTick = replacement.tick;
  }

  const scoutTrains = trainCalls.filter(
    (call) => call.ok && call.team === 1 && call.buildingKind === Kind.Hall && call.kind === Kind.Scout,
  );
  const scoutCost = STATS[Kind.Scout];
  const failures: string[] = [];
  if (scoutTrains.length === 0) failures.push('no successful normal Hall→Scout replacement');
  if (scoutTrains[0] && (
    scoutTrains[0].delta.ore !== scoutCost.ore
    || scoutTrains[0].delta.gas !== scoutCost.gas
    || scoutTrains[0].delta.energy !== scoutCost.energy
    || scoutTrains[0].trainT !== scoutCost.train
  )) failures.push(`replacement cost/time was ${JSON.stringify(scoutTrains[0])}`);
  if (discoveryTick < 0) failures.push('replacement did not discover the player Nexus');
  if (attackTick < Math.round((8 * 60) / DT)) failures.push(`first attack tick=${attackTick}`);
  if (winnerTick < 0 || winnerTick > limit) failures.push(`winner=${replacement.winner} at tick=${winnerTick}`);
  if (failures.length > 0) {
    throw new Error(`VS5 Scout replacement RED: ${failures.join('; ')}; observed winner=${replacement.winner}, discoveryTick=${discoveryTick}, attackTick=${attackTick}, winnerTick=${winnerTick}`);
  }
}

console.log('VS5 pacing tests: PASS');
