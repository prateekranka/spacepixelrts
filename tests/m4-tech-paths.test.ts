// M4-A — technology path commit, gates, effects (docs/M4_TECH_PATHS.md).

import assert from 'node:assert/strict';
import { DT, Kind, Ord, Tile } from '../src/engine';
import type { TechPathId } from '../src/content';
import { PATH_EFFECTS, TECH_PATHS, gateOpen, isPathGated, pathEffects, pathsForCiv } from '../src/content';
import { World } from '../src/sim';

const SEED = 0x5eed;
const CHANNEL_STEPS = Math.round((40 + 1) / DT);

/** Grant funds, commit, and fast-forward past the 40 s channel. */
function commitPath(w: World, team: number, path: TechPathId): void {
  const eco = w.teams[team];
  eco.ore = Math.max(eco.ore, 500);
  eco.energy = Math.max(eco.energy, 120);
  assert.ok(w.tryCommitPath(team, path), `commit ${path} accepted`);
  for (let i = 0; i < CHANNEL_STEPS; i++) w.step();
  assert.equal(w.techPathOf(team), path, `${path} locked in after channel`);
}

function yardOf(w: World, team: number) {
  const yard = w.spawn(Kind.Barracks, w.civ[team], team, 14.5, 14.5);
  assert.ok(yard, 'yard spawns');
  yard.progress = 1;
  return yard;
}

// ---- content tables: two paths per faction, numbers in one table -------------------
{
  assert.deepEqual(pathsForCiv('vespari'), ['solar-ascendancy', 'sky-dominion']);
  assert.deepEqual(pathsForCiv('aurion'), ['iron-colossus', 'rift-engineering']);
  assert.deepEqual(pathsForCiv('voidmarked'), []);
  for (const p of TECH_PATHS) {
    assert.ok(p.name.length > 0 && p.blurb.length > 0, `${p.id} has metadata`);
    const fx = PATH_EFFECTS[p.id];
    assert.ok(fx, `${p.id} has effects`);
    const neutral = pathEffects(null);
    const keys = Object.keys(fx).filter(
      (k) => fx[k as keyof typeof fx] !== neutral[k as keyof typeof neutral],
    );
    assert.equal(keys.length, 2, `${p.id} declares exactly two effects`);
  }
  assert.equal(isPathGated(Kind.Fighter), true);
  assert.equal(isPathGated(Kind.Siege), true);
  assert.equal(isPathGated(Kind.Ravager), true);
  assert.equal(isPathGated(Kind.Prism), true);
  assert.equal(isPathGated(Kind.Shade), true);
  assert.equal(isPathGated(Kind.Worker), false);
  assert.equal(isPathGated(Kind.Scout), false);
  assert.equal(gateOpen({ techPath: null }, Kind.Fighter), false);
  assert.equal(gateOpen({ techPath: 'iron-colossus' }, Kind.Fighter), true);
}

// ---- happy path: resources deducted, channel elapses, gates open --------------------
{
  const w = new World();
  w.reset(SEED);
  const eco = w.teams[0];
  eco.ore = 500;
  eco.energy = 120;
  const hall = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  assert.ok(hall, 'hall exists');
  assert.ok(w.tryCommitPath(0, 'solar-ascendancy'), 'commit accepted');
  assert.equal(eco.ore, 100, '400 ore deducted');
  assert.equal(eco.energy, 40, '80 charge deducted');
  assert.ok(w.pathChannelT(0) > 39 && w.pathChannelT(0) <= 40, 'channel started');
  assert.equal(w.techPathOf(0), null, 'path not applied mid-channel');
  assert.equal(w.tryTrain(hall, Kind.Worker), false, 'Hall cannot train while channeling');
  for (let i = 0; i < CHANNEL_STEPS; i++) w.step();
  assert.equal(w.techPathOf(0), 'solar-ascendancy');
  assert.equal(w.pathChannelT(0), 0, 'channel elapsed');
  assert.equal(eco.epoch, 1, 'epoch written once for legacy readers');
  const yard = yardOf(w, 0);
  eco.ore = 200;
  eco.energy = 100;
  assert.ok(w.tryTrain(yard, Kind.Fighter), 'gated kind trains after commit');
}

// ---- base kit: Yard refuses gated kinds before commit, Scout still trains ----------
{
  const w = new World();
  w.reset(SEED);
  const yard = yardOf(w, 0);
  const eco = w.teams[0];
  eco.ore = 500;
  eco.gas = 100;
  eco.energy = 100;
  assert.equal(w.tryTrain(yard, Kind.Fighter), false, 'Fighter gated');
  assert.equal(w.tryTrain(yard, Kind.Ravager), false, 'faction unique gated');
  assert.ok(w.tryTrain(yard, Kind.Scout), 'base kit unaffected');
}

// ---- wrong-faction path rejected with zero state change -----------------------------
{
  const w = new World();
  w.reset(SEED);
  const eco = w.teams[0];
  eco.ore = 600;
  eco.energy = 200;
  const before = { ...eco };
  assert.equal(w.tryCommitPath(0, 'iron-colossus'), false, 'gravemark path refused');
  assert.equal(w.tryCommitPath(0, 'rift-engineering'), false, 'gravemark path refused');
  assert.equal(eco.ore, before.ore, 'ore untouched');
  assert.equal(eco.energy, before.energy, 'charge untouched');
  assert.equal(eco.epoch, before.epoch, 'epoch untouched');
  assert.equal(w.techPathOf(0), null, 'no path applied');
  assert.equal(w.pathChannelT(0), 0, 'no channel started');

  const g = new World();
  g.reset(SEED);
  g.civ[0] = 'aurion';
  g.reset(SEED);
  assert.equal(g.tryCommitPath(0, 'solar-ascendancy'), false, 'sunweaver path refused');
  assert.equal(g.tryCommitPath(0, 'sky-dominion'), false, 'sunweaver path refused');
}

// ---- double-commit rejected forever (irreversible under public API) -----------------
{
  const w = new World();
  w.reset(SEED);
  commitPath(w, 0, 'solar-ascendancy');
  assert.equal(w.tryCommitPath(0, 'solar-ascendancy'), false, 'same path refused');
  assert.equal(w.tryCommitPath(0, 'sky-dominion'), false, 'sibling path refused');
  assert.equal(w.tryCommitPath(0, 'iron-colossus'), false, 'foreign path refused');
  assert.equal(w.techPathOf(0), 'solar-ascendancy', 'choice immutable');
}

// ---- second commit during an active channel rejected --------------------------------
{
  const w = new World();
  w.reset(SEED);
  w.teams[0].ore = 900;
  w.teams[0].energy = 300;
  assert.ok(w.tryCommitPath(0, 'sky-dominion'), 'first commit accepted');
  assert.ok(w.pathChannelT(0) > 0, 'channel running');
  const ore = w.teams[0].ore;
  assert.equal(w.tryCommitPath(0, 'solar-ascendancy'), false, 'channel blocks recommit');
  assert.equal(w.teams[0].ore, ore, 'rejected recommit spends nothing');
}

// ---- poor funds rejected with no state change ---------------------------------------
{
  const w = new World();
  w.reset(SEED);
  const eco = w.teams[0];
  eco.ore = 399;
  eco.energy = 120;
  const before = JSON.stringify(eco);
  assert.equal(w.tryCommitPath(0, 'solar-ascendancy'), false, 'poor commit refused');
  assert.equal(JSON.stringify(eco), before, 'eco byte-identical after reject');
  assert.equal(w.pathChannelT(0), 0, 'no channel');
  assert.equal(w.techPathOf(0), null, 'no path');
}

// ---- Hall state gates: must exist, be complete, and not be training ------------------
{
  const w = new World();
  w.reset(SEED);
  const hall = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  assert.ok(hall, 'hall exists');
  hall.trainT = 3;
  assert.equal(w.tryCommitPath(0, 'solar-ascendancy'), false, 'training Hall blocks commit');
  hall.trainT = 0;
  w.teams[0].ore = 500;
  w.teams[0].energy = 120;
  assert.ok(w.tryCommitPath(0, 'solar-ascendancy'), 'idle Hall allows commit');

  const g = new World();
  g.reset(SEED);
  const dead = g.ents.find((e) => e.alive && g.teams[0] && e.team === 0 && e.kind === Kind.Hall);
  assert.ok(dead, 'hall exists');
  g.kill(dead);
  assert.equal(g.tryCommitPath(0, 'sky-dominion'), false, 'no standing Hall, no commit');
}

// ---- solar-ascendancy: boost drain x0.75 --------------------------------------------
{
  const base = new World();
  base.reset(SEED);
  base.boosts[0] = 1;
  const e0 = base.teams[0].energy;
  for (let i = 0; i < Math.round(1 / DT); i++) base.step();
  const dBase = e0 - base.teams[0].energy;

  const w = new World();
  w.reset(SEED);
  commitPath(w, 0, 'solar-ascendancy');
  w.teams[0].energy = 200;
  w.boosts[0] = 1;
  const e1 = w.teams[0].energy;
  for (let i = 0; i < Math.round(1 / DT); i++) w.step();
  const dSolar = e1 - w.teams[0].energy;

  assert.ok(Math.abs(dBase - 8) < 1, `baseline drains ~8/s (got ${dBase})`);
  assert.ok(Math.abs(dSolar - 6) < 1, `solar-ascendancy drains ~6/s (got ${dSolar})`);
  assert.ok(dSolar < dBase - 1, 'drain observably lower');
}

// ---- solar-ascendancy: severed link re-forms in half the time ------------------------
{
  function severDelta(committed: boolean): number {
    const w = new World();
    w.reset(SEED);
    if (committed) commitPath(w, 0, 'solar-ascendancy');
    const node = w.ents.find(
      (e) => e.alive && e.kind === Kind.Resource && e.cargoType === Tile.Solar,
    );
    assert.ok(node, 'solar node exists');
    const worker = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Worker);
    assert.ok(worker, 'worker exists');
    worker.x = worker.px = node.x + 0.4;
    worker.z = worker.pz = node.z + 0.4;
    worker.vx = worker.vz = 0;
    worker.order = Ord.Gather;
    worker.tid = node.id;
    worker.cooldown = 0;
    worker.cargo = 0;
    worker.path = null;
    worker.pathI = 0;
    w.step();
    const link = w.links.find((l) => l.nodeId === node!.id && l.team === 0);
    assert.ok(link, 'link created');
    const hall = w.ents[link.hallId];
    const enemy = w.spawn(
      Kind.Scout,
      'aurion',
      1,
      (node.x + hall.x) * 0.5,
      (node.z + hall.z) * 0.5,
    );
    assert.ok(enemy, 'sever unit spawns');
    enemy.order = Ord.Idle;
    for (let i = 0; i < 30 && link.severedUntil <= w.tick; i++) w.step();
    assert.ok(link.severedUntil > w.tick, 'link severed');
    return link.severedUntil - w.tick;
  }
  const plain = severDelta(false);
  const solar = severDelta(true);
  assert.ok(Math.abs(plain - 300) <= 3, `base sever window ~300 ticks (got ${plain})`);
  assert.ok(Math.abs(solar - 150) <= 3, `solar-ascendancy halves it (got ${solar})`);
}

// ---- sky-dominion: non-worker combat speed x1.12 -------------------------------------
{
  function marchDistance(committed: boolean): number {
    const w = new World();
    w.reset(SEED);
    if (committed) commitPath(w, 0, 'sky-dominion');
    const scout = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Scout);
    assert.ok(scout, 'scout exists');
    const sx = scout.x;
    const sz = scout.z;
    scout.order = Ord.Move;
    scout.tx = 60.5;
    scout.tz = 60.5;
    scout.tid = -1;
    scout.path = null;
    scout.pathI = 0;
    for (let i = 0; i < 90; i++) w.step();
    return Math.hypot(scout.x - sx, scout.z - sz);
  }
  const plain = marchDistance(false);
  const sky = marchDistance(true);
  const ratio = sky / plain;
  assert.ok(Math.abs(ratio - 1.12) < 0.04, `speed ratio ~1.12 (got ${ratio.toFixed(3)})`);
}

// ---- sky-dominion: Scout LOS +2 lights tiles beyond base sight ------------------------
{
  function tileLit(x: number, z: number, committed: boolean): number {
    const w = new World();
    w.reset(SEED);
    if (committed) commitPath(w, 0, 'sky-dominion');
    const scout = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Scout);
    assert.ok(scout, 'scout exists');
    scout.order = Ord.Idle;
    scout.x = scout.px = x;
    scout.z = scout.pz = z;
    scout.path = null;
    w.step();
    return w.visible[0][(x + 10.5 | 0) + (z | 0) * 72];
  }
  assert.equal(tileLit(36, 36, false), 0, 'base Scout LOS stops short of 10.5 tiles');
  assert.equal(tileLit(36, 36, true), 1, 'sky-dominion Scout sees the far tile');
}

// ---- iron-colossus: finished rig HP x1.5 ---------------------------------------------
{
  function finishRig(committed: boolean) {
    const w = new World();
    w.civ[0] = 'aurion';
    w.reset(SEED);
    if (committed) commitPath(w, 0, 'iron-colossus');
    const hall = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
    assert.ok(hall, 'hall exists');
    const node = w.ents
      .filter(
        (e) =>
          e.alive &&
          e.kind === Kind.Resource &&
          (e.cargoType === Tile.Ore || e.cargoType === Tile.Gas),
      )
      .sort((a, b) => (a.x - hall.x) ** 2 + (a.z - hall.z) ** 2 - ((b.x - hall.x) ** 2 + (b.z - hall.z) ** 2))[0];
    assert.ok(node, 'node exists');
    const worker = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Worker);
    assert.ok(worker, 'worker exists');
    worker.x = worker.px = node.x + 0.4;
    worker.z = worker.pz = node.z + 0.4;
    worker.vx = worker.vz = 0;
    worker.order = Ord.Build;
    worker.tid = node.id;
    worker.path = null;
    worker.pathI = 0;
    for (let i = 0; i < 260 && node.rigProgress < 1; i++) w.step();
    assert.ok(node.rigProgress >= 1, 'rig finished');
    worker.order = Ord.Idle;
    worker.tid = -1;
    return { w, node };
  }
  const plain = finishRig(false);
  const colossus = finishRig(true);
  assert.ok(Math.abs(plain.node.rigHp - 700) < 1, `base rig hp 700 (got ${plain.node.rigHp})`);
  assert.ok(
    Math.abs(colossus.node.rigHp - 1050) < 1,
    `iron-colossus rig hp 1050 (got ${colossus.node.rigHp})`,
  );

  // ---- iron-colossus: rig extraction interval 0.75 s pumps faster --------------------
  const extract = (world: ReturnType<typeof finishRig>['w'], node: ReturnType<typeof finishRig>['node']): number => {
    const res0 = world.teams[0].ore + world.teams[0].gas;
    for (let i = 0; i < 150; i++) world.step();
    return world.teams[0].ore + world.teams[0].gas - res0;
  };
  const plainGain = extract(plain.w, plain.node);
  const colGain = extract(colossus.w, colossus.node);
  assert.ok(plainGain >= 6, `base rig extracts ~1/s (got ${plainGain})`);
  assert.ok(colGain > plainGain, 'colossus rig extracts observably faster');
  assert.ok(colGain >= 9, `colossus rig ~1.33/s (got ${colGain})`);
}

// ---- rift-engineering: ranged attacks reach +1.0 --------------------------------------
{
  function boltAtRange(committed: boolean): boolean {
    const w = new World();
    w.civ[0] = 'aurion';
    w.reset(SEED);
    if (committed) commitPath(w, 0, 'rift-engineering');
    const prism = w.spawn(Kind.Prism, 'aurion', 0, 60, 60);
    assert.ok(prism, 'prism spawns');
    prism.order = Ord.Attack;
    prism.cooldown = 0;
    const target = w.spawn(Kind.Fighter, 'vespari', 1, 66.4, 60);
    assert.ok(target, 'target spawns');
    prism.tid = target.id;
    w.step();
    return w.bolts.some((b) => b.team === 0);
  }
  assert.equal(boltAtRange(false), false, 'base Prism cannot reach 6.4 tiles');
  assert.equal(boltAtRange(true), true, 'rift-engineering Prism strikes at 6.4 tiles');
}

// ---- rift-engineering: Siege train time x0.7 ------------------------------------------
{
  const trainSiege = (path: TechPathId): number => {
    const w = new World();
    w.civ[0] = 'aurion';
    w.reset(SEED);
    commitPath(w, 0, path);
    const yard = yardOf(w, 0);
    w.teams[0].ore = 500;
    w.teams[0].gas = 200;
    w.teams[0].energy = 200;
    assert.ok(w.tryTrain(yard, Kind.Siege));
    return yard.trainT;
  };
  const plain = trainSiege('iron-colossus');
  const rift = trainSiege('rift-engineering');
  assert.ok(Math.abs(plain - 16) < 1e-9, `other paths keep 16 s (got ${plain})`);
  assert.ok(Math.abs(rift - 11.2) < 1e-9, `rift Siege trains 11.2 s (got ${rift})`);
}

// ---- enemy marshal commits doctrine instantly at tick 240 ------------------------------
{
  const w = new World();
  w.scriptedMarshalEnabled = true;
  w.reset(SEED);
  for (let i = 0; i <= 240; i++) w.step();
  assert.equal(w.techPathOf(1), 'iron-colossus', 'aurion doctrine commits');
  assert.equal(w.pathChannelT(1), 0, 'instant commit, no channel');
  assert.equal(w.teams[1].epoch, 0, 'legacy epoch write removed');

  const v = new World();
  v.scriptedMarshalEnabled = true;
  v.civ[1] = 'vespari';
  v.reset(SEED);
  for (let i = 0; i <= 240; i++) v.step();
  assert.equal(v.techPathOf(1), 'sky-dominion', 'vespari doctrine commits');

  const quiet = new World();
  quiet.reset(SEED);
  for (let i = 0; i <= 300; i++) quiet.step();
  assert.equal(quiet.techPathOf(1), null, 'marshal off by default leaves path unchosen');
}

// ---- accessors and reset hygiene -------------------------------------------------------
{
  const w = new World();
  w.reset(SEED);
  assert.equal(w.techPathOf(0), null, 'fresh team uncommitted');
  assert.equal(w.techPathOf(3), null, 'unused team reads null');
  assert.equal(w.pathChannelT(0), 0, 'no channel on fresh team');
  commitPath(w, 0, 'sky-dominion');
  w.reset(SEED);
  assert.equal(w.techPathOf(0), null, 'reset clears commitment');
  assert.equal(w.pathChannelT(0), 0, 'reset clears channel');
}

console.log('M4-A tech path tests: PASS');
