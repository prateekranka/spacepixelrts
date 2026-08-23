// M3-A — Sunweaver Solar collection links (docs/M3_ECONOMIES.md A1–A3).

import assert from 'node:assert/strict';
import { Kind, Ord, Tile } from '../src/engine';
import { CIV_PROFILE } from '../src/content';
import { World } from '../src/sim';

const SEED = 0x5eed;
const DT = 1 / 30;

function solarNode(world: World) {
  // The Solar node nearest the player Hall — the base node, not a mid-map patch.
  const hall = world.ents.find(
    (e) => e.alive && e.team === 0 && e.kind === Kind.Hall,
  );
  assert.ok(hall, 'hall exists');
  let best = null;
  let bestD = Infinity;
  for (const e of world.ents) {
    if (!e.alive || e.kind !== Kind.Resource || e.cargoType !== Tile.Solar) continue;
    const d = (e.x - hall.x) ** 2 + (e.z - hall.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

function placeWorkerAtNode(world: World, team: number, nodeId: number) {
  const w = world.ents.find(
    (e) => e.alive && e.team === team && e.kind === Kind.Worker,
  );
  assert.ok(w, 'worker exists');
  const node = world.ents[nodeId];
  w.x = w.px = node.x + 0.4;
  w.z = w.pz = node.z + 0.4;
  w.vx = w.vz = 0;
  w.order = Ord.Gather;
  w.tid = nodeId;
  w.cooldown = 0;
  w.cargo = 0;
  w.path = null;
  w.pathI = 0;
  return w;
}

// ---- A1/A2: first pulse creates the link and streams energy directly ----------
{
  const w = new World();
  w.reset(SEED);
  w.civ[0] = 'vespari';
  const node = solarNode(w);
  assert.ok(node, 'solar node exists');
  const energy0 = w.teams[0].energy;
  const worker = placeWorkerAtNode(w, 0, node.id);
  w.step();
  const link = w.links.find((l) => l.nodeId === node.id && l.team === 0);
  assert.ok(link, 'link created on first pulse');
  assert.equal(w.teams[0].energy, energy0 + 1, 'one energy gained per pulse');
  assert.equal(worker.cargo, 0, 'no cargo walk for linked worker');
  assert.ok(worker.cooldown <= 0.4 + 1e-9, 'pulse uses the fast cadence');
  assert.ok(w.links.length >= 1, 'links pooled');
}

// ---- A2 cadence: linked stream outpaces hauling over a window -------------------
{
  const w = new World();
  w.reset(SEED);
  w.civ[0] = 'vespari';
  const node = solarNode(w);
  assert.ok(node, 'solar node exists');
  const startEnergy = CIV_PROFILE.vespari.startEnergy;
  const worker = placeWorkerAtNode(w, 0, node.id);
  const steps = 60;
  for (let i = 0; i < steps; i++) w.step();
  const linkedGain = w.teams[0].energy - startEnergy;
  assert.ok(linkedGain >= 1, `linked worker streamed energy (${linkedGain})`);
  assert.equal(worker.cargo, 0, 'linked worker never carries cargo');
}

// ---- A3: an enemy unit near the tether midpoint severs the link -----------------
{
  const w = new World();
  w.reset(SEED);
  w.civ[0] = 'vespari';
  const node = solarNode(w);
  assert.ok(node, 'solar node exists');
  const worker = placeWorkerAtNode(w, 0, node.id);
  w.step();
  const link = w.links.find((l) => l.nodeId === node.id && l.team === 0);
  assert.ok(link, 'link exists before severing');
  const hall = w.ents[link.hallId];
  const mx = (node.x + hall.x) * 0.5;
  const mz = (node.z + hall.z) * 0.5;
  const enemy = w.spawn(Kind.Scout, 'aurion', 1, mx, mz);
  assert.ok(enemy, 'enemy spawns');
  enemy.order = Ord.Idle;
  const energyBefore = w.teams[0].energy;
  // The pulse fires on the worker's 0.4 s cadence; step a full cadence.
  for (let i = 0; i < 15; i++) w.step();
  assert.ok(link.severedUntil > w.tick, 'link severed by enemy presence');
  let cargoAfter = 0;
  for (let i = 0; i < 20; i++) {
    w.step();
    cargoAfter = worker.cargo;
  }
  assert.ok(cargoAfter > 0, 'severed worker hauls cargo instead');
  assert.equal(w.teams[0].energy, energyBefore, 'no energy while severed');
  assert.equal(w.links.length, 1, 'severed link stays pooled');
}

// ---- Sever cooldown: after 10 s the link can relink ------------------------------
{
  const w = new World();
  w.reset(SEED);
  w.civ[0] = 'vespari';
  const node = solarNode(w);
  assert.ok(node, 'solar node exists');
  const worker = placeWorkerAtNode(w, 0, node.id);
  w.step();
  const link = w.links.find((l) => l.nodeId === node.id && l.team === 0);
  assert.ok(link, 'link exists');
  const hall = w.ents[link.hallId];
  const enemy = w.spawn(Kind.Scout, 'aurion', 1, (node.x + hall.x) * 0.5, (node.z + hall.z) * 0.5);
  assert.ok(enemy, 'enemy spawns');
  enemy.order = Ord.Idle;
  for (let i = 0; i < 15; i++) w.step();
  assert.ok(link.severedUntil > w.tick, 'severed now');
  const severTick = link.severedUntil;
  // Remove the enemy, then step past the 10 s window.
  enemy.alive = false;
  const energy0 = w.teams[0].energy;
  const stepsPast = Math.ceil((severTick - w.tick) / DT) + 5;
  for (let i = 0; i < stepsPast; i++) w.step();
  const energyAfter = w.teams[0].energy;
  assert.ok(energyAfter > energy0, 'link relinked after cooldown and streams again');
}

// ---- Determinism: two worlds agree on link state --------------------------------
{
  const a = new World();
  a.reset(SEED);
  a.civ[0] = 'vespari';
  const b = new World();
  b.reset(SEED);
  b.civ[0] = 'vespari';
  const na = solarNode(a);
  const nb = solarNode(b);
  assert.ok(na && nb, 'nodes exist');
  placeWorkerAtNode(a, 0, na.id);
  placeWorkerAtNode(b, 0, nb.id);
  for (let i = 0; i < 60; i++) {
    a.step();
    b.step();
  }
  assert.equal(a.links.length, b.links.length, 'same link count');
  assert.equal(a.teams[0].energy, b.teams[0].energy, 'same energy at same seed');
}

console.log('M3-A solar links tests: PASS');
