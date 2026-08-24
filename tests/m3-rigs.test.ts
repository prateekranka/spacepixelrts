// M3-B — Gravemark extraction rigs (docs/M3_ECONOMIES.md B1–B5).

import assert from 'node:assert/strict';
import { DT, Kind, Ord, Tile } from '../src/engine';
import { World } from '../src/sim';

const SEED = 0x5eed;

function nearestOreNode(world: World, x: number, z: number) {
  let best = null;
  let bestD = Infinity;
  for (const e of world.ents) {
    if (!e.alive || e.kind !== Kind.Resource || e.cargoType !== Tile.Ore) continue;
    const d = (e.x - x) ** 2 + (e.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function nearestGasNode(world: World, x: number, z: number) {
  let best = null;
  let bestD = Infinity;
  for (const e of world.ents) {
    if (!e.alive || e.kind !== Kind.Resource || e.cargoType !== Tile.Gas) continue;
    const d = (e.x - x) ** 2 + (e.z - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function orderRigBuild(world: World, team: number, nodeId: number) {
  const w = world.ents.find((e) => e.alive && e.team === team && e.kind === Kind.Worker);
  assert.ok(w, 'worker exists');
  const node = world.ents[nodeId];
  w.x = w.px = node.x + 0.4;
  w.z = w.pz = node.z + 0.4;
  w.vx = w.vz = 0;
  w.order = Ord.Build;
  w.tid = nodeId;
  w.cargo = 0;
  w.path = null;
  w.pathI = 0;
  return w;
}

// ---- B1/B2: aurion worker raises a rig; progress -> complete -------------------
{
  const w = new World();
  w.civ[0] = 'aurion';
  w.reset(SEED);
  const node = nearestOreNode(w, 10.5, 10.5);
  assert.ok(node, 'ore node exists');
  const worker = orderRigBuild(w, 0, node.id);
  for (let i = 0; i < Math.ceil(1 / 0.1 / DT) + 5; i++) w.step();
  assert.equal(node.rigTeam, 0, 'rig owned by team 0');
  assert.equal(node.rigProgress, 1, 'rig finished');
  assert.ok(Math.abs(node.rigHp - 700) < 1, `rig hp 700 (got ${node.rigHp})`);
  assert.equal(worker.order, Ord.Gather, 'worker returns to gather after finish');
}

// ---- B2: solar nodes cannot be rigged -------------------------------------------
{
  const w = new World();
  w.civ[0] = 'aurion';
  w.reset(SEED);
  const solar = w.ents.find(
    (e) => e.alive && e.kind === Kind.Resource && e.cargoType === Tile.Solar,
  );
  assert.ok(solar, 'solar node exists');
  orderRigBuild(w, 0, solar.id);
  for (let i = 0; i < 40; i++) w.step();
  assert.equal(solar.rigTeam, -1, 'solar node never rigged');
}

// ---- B2: enemy rig cannot be stolen; worker stops ---------------------------------
{
  const w = new World();
  w.civ[0] = 'aurion';
  w.reset(SEED);
  const node = nearestOreNode(w, 10.5, 10.5);
  assert.ok(node, 'ore node exists');
  const worker = orderRigBuild(w, 0, node.id);
  for (let i = 0; i < Math.ceil(1 / 0.1 / DT) + 5; i++) w.step();
  assert.equal(node.rigTeam, 0, 'rig finished for team 0');
  // An enemy worker tries to build on the same node.
  const ew = w.spawn(Kind.Worker, 'vespari', 1, node.x + 0.4, node.z + 0.4);
  assert.ok(ew, 'enemy worker spawns');
  ew.order = Ord.Build;
  ew.tid = node.id;
  for (let i = 0; i < 10; i++) w.step();
  assert.equal(node.rigTeam, 0, 'rig ownership unchanged');
  assert.notEqual(ew.order, Ord.Build, 'enemy build order dropped');
}

// ---- B3: finished rig extracts ore slowly, refining at 0.5 hp/unit ----------------
{
  const w = new World();
  w.civ[0] = 'aurion';
  w.reset(SEED);
  const node = nearestOreNode(w, 10.5, 10.5);
  assert.ok(node, 'ore node exists');
  const builder = orderRigBuild(w, 0, node.id);
  for (let i = 0; i < Math.ceil(1 / 0.1 / DT) + 5; i++) w.step();
  // Park the builder far away so only the rig extracts (workers may gather a rig).
  builder.order = Ord.Idle;
  builder.tid = -1;
  builder.x = builder.px = 30;
  builder.z = builder.pz = 30;
  const ore0 = w.teams[0].ore;
  const hp0 = node.hp;
  const extractSteps = 60; // 2 sim seconds
  for (let i = 0; i < extractSteps; i++) w.step();
  const oreGain = w.teams[0].ore - ore0;
  const hpLoss = hp0 - node.hp;
  assert.ok(oreGain >= 1, `rig extracted ore (${oreGain})`);
  assert.ok(oreGain <= 3, `rig extraction slow (${oreGain} in 2 s)`);
  // Refining: 0.5 node hp per extracted unit — hp loss is half the ore gain.
  assert.ok(Math.abs(hpLoss - oreGain * 0.5) < 0.6, `refining ratio (${hpLoss} hp for ${oreGain} ore)`);
}

// ---- B3: gas rig feeds gas ---------------------------------------------------------
{
  const w = new World();
  w.civ[0] = 'aurion';
  w.reset(SEED);
  const node = nearestGasNode(w, 10.5, 10.5);
  assert.ok(node, 'gas node exists');
  orderRigBuild(w, 0, node.id);
  for (let i = 0; i < Math.ceil(1 / 0.1 / DT) + 5; i++) w.step();
  const gas0 = w.teams[0].gas;
  for (let i = 0; i < 60; i++) w.step();
  assert.ok(w.teams[0].gas > gas0, 'rig extracted gas');
}

// ---- B4: rig absorbs damage; node hp untouched until rig dies ----------------------
{
  const w = new World();
  w.civ[0] = 'aurion';
  w.reset(SEED);
  const node = nearestOreNode(w, 10.5, 10.5);
  assert.ok(node, 'ore node exists');
  // Raise an ENEMY rig directly (a team-1 attacker would drop the order via the
  // M2-D sight rule, which is correct; a player attacker is not subject to it).
  node.rigTeam = 1;
  node.rigProgress = 1;
  node.rigHp = 700;
  node.rigAccum = 0;
  const nodeHpBefore = node.hp;
  const attacker = w.spawn(Kind.Fighter, 'vespari', 0, node.x + 0.5, node.z + 0.5);
  assert.ok(attacker, 'attacker spawns');
  attacker.order = Ord.Attack;
  attacker.tid = node.id;
  for (let i = 0; i < 30; i++) w.step();
  assert.ok(node.rigHp < 700, 'rig took damage');
  // Extraction (enemy rig) consumes ~1 hp/s; combat would take tens of hp.
  const nodeHpLoss = nodeHpBefore - node.hp;
  assert.ok(nodeHpLoss <= 3, `node hp untouched by combat while rig lives (loss ${nodeHpLoss})`);
  // Keep hitting until the rig dies. Ranged bolts land on rigged nodes only
  // (pre-existing design: plain nodes are bolt-immune), so a melee Ravager
  // proves the node itself takes damage once the rig is gone.
  let swings = 0;
  while (node.rigTeam === 1 && swings < 4000) {
    w.step();
    swings++;
  }
  assert.equal(node.rigTeam, -1, 'rig destroyed by sustained attack');
  assert.ok(swings < 4000, 'rig died in bounded time');
  attacker.alive = false;
  const melee = w.spawn(Kind.Ravager, 'vespari', 0, node.x + 0.5, node.z + 0.5);
  assert.ok(melee, 'melee attacker spawns');
  melee.order = Ord.Attack;
  melee.tid = node.id;
  const hpAfterRig = node.hp;
  for (let i = 0; i < 40; i++) w.step();
  assert.ok(node.hp < hpAfterRig, 'node hp now takes damage');
}

// ---- B5: aurion AI assigns workers to rigs -----------------------------------------
{
  const w = new World();
  w.reset(SEED);
  w.civ[1] = 'aurion';
  // Step through several AI cadences so the AI scouts and rigs.
  for (let i = 0; i < Math.round(20 / DT); i++) w.step();
  const rigged = w.ents.filter(
    (e) => e.alive && e.kind === Kind.Resource && e.rigTeam === 1,
  );
  const building = w.ents.filter(
    (e) => e.alive && e.team === 1 && e.kind === Kind.Worker && e.order === Ord.Build,
  );
  assert.ok(
    rigged.length > 0 || building.length > 0,
    `aurion AI raised or is raising rigs (rigged ${rigged.length}, building ${building.length})`,
  );
  // Every rig builder targets a discovered node.
  for (const wkr of building) {
    const node = w.ents[wkr.tid];
    assert.ok(node?.alive && node.kind === Kind.Resource, 'builder targets a node');
  }
}

console.log('M3-B extraction rig tests: PASS');
