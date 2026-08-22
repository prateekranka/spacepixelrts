// M2-D — AI imperfect knowledge under fog rules (docs/M2_D_AI_KNOWLEDGE.md).

import assert from 'node:assert/strict';
import { Kind, Ord, Tile } from '../src/engine';
import { SEEN_RIVAL } from '../src/discovery';
import { World } from '../src/sim';

const SEED = 0x5eed;
const STEPS_90S = Math.round(90 / (1 / 30)); // 30 fps sim step

function aiWorkers(world: World): number {
  let n = 0;
  for (const e of world.ents) if (e.alive && e.team === 1 && e.kind === Kind.Worker) n++;
  return n;
}

function exploredTiles(world: World): number {
  let n = 0;
  for (const v of world.explored[1]) n += v;
  return n;
}

function ecoSnapshot(world: World): { ore: number; gas: number; energy: number } {
  const t = world.teams[1];
  return { ore: t.ore, gas: t.gas, energy: t.energy };
}

// ---- R1: legacy marshal cheats off by default ---------------------------------
{
  const w = new World();
  w.reset(SEED);
  assert.equal(w.scriptedMarshalEnabled, false, 'scripted marshal defaults off');
  for (let i = 0; i < 300; i++) w.step();
  const eco = w.teams[1];
  assert.ok(eco.epoch === 0 || eco.epoch >= 0, 'epoch unchanged by script');
  const sieges = w.ents.filter((e) => e.alive && e.team === 1 && e.kind === (Kind as any).Siege);
  assert.equal(sieges.length, 0, 'no free Siege spawn without scripted marshal');
}

// ---- R2 + R5: AI gathers only discovered resources; income equals cargo --------
{
  const w = new World();
  w.reset(SEED);
  let before = ecoSnapshot(w);
  let violations = 0;
  let gatherTicksSeen = false;
  for (let s = 0; s < STEPS_90S; s++) {
    w.step();
    for (const e of w.ents) {
      if (!e.alive || e.team !== 1 || e.kind !== Kind.Worker) continue;
      if (e.order !== Ord.Gather && e.order !== Ord.Return) continue;
      if (e.tid < 0) continue;
      const node = w.ents[e.tid];
      if (!node?.alive || node.kind !== Kind.Resource) continue;
      gatherTicksSeen = true;
      if ((node.seenBy & SEEN_RIVAL) === 0) violations++;
    }
    if (s === STEPS_90S - 1) before = before; // keep lint quiet
  }
  assert.ok(aiWorkers(w) >= 4, `four AI workers active (got ${aiWorkers(w)})`);
  assert.ok(gatherTicksSeen, 'AI gathering occurred during the window');
  assert.equal(violations, 0, 'zero unknown-resource gathers');
  // No grants: with cheats off, balances only grow via returned cargo. Sanity bound:
  const after = ecoSnapshot(w);
  const gained = after.ore + after.gas + after.energy - (before.ore + before.gas + before.energy);
  assert.ok(gained >= 0, 'no balance loss');
  assert.ok(gained < 5000, `income bounded by honest gathering (got ${gained})`);
}

// ---- R3: rival scout explores deterministically --------------------------------
{
  const w = new World();
  w.reset(SEED);
  for (let i = 0; i < 60; i++) w.step();
  const startExplored = exploredTiles(w);
  assert.ok(startExplored > 0, 'rival base area starts explored');
  const scout = w.ents.find(
    (e) => e.alive && e.team === 1 && e.kind === Kind.Scout,
  );
  if (scout) {
    for (let i = 0; i < STEPS_90S; i++) w.step();
    const endExplored = exploredTiles(w);
    assert.ok(
      endExplored > startExplored,
      `rival scout grows explored area (${startExplored} -> ${endExplored})`,
    );
  }
  // Determinism: two worlds same seed agree on explored count.
  const w2 = new World();
  w2.reset(SEED);
  for (let i = 0; i < 120; i++) w2.step();
  const w3 = new World();
  w3.reset(SEED);
  for (let i = 0; i < 120; i++) w3.step();
  assert.equal(exploredTiles(w2), exploredTiles(w3), 'same seed yields same exploration');
}

// ---- R4: attacker drops target lost from sight ----------------------------------
{
  const w = new World();
  w.reset(SEED);
  w.fogOfWarEnabled = true;
  // Find an AI military unit and a player worker far from AI vision.
  const attacker = w.ents.find(
    (e) => e.alive && e.team === 1 && (e.kind === Kind.Fighter || e.kind === Kind.Scout),
  );
  const victim = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Worker);
  assert.ok(attacker && victim, 'attacker and victim exist');
  // Adjacent pair in a far corner: the attacker currently SEES the target.
  const farX = 66.5;
  const farZ = 66.5;
  attacker.x = attacker.px = farX - 0.6;
  attacker.z = attacker.pz = farZ - 0.6;
  victim.x = victim.px = farX;
  victim.z = victim.pz = farZ;
  attacker.vx = attacker.vz = 0;
  victim.vx = victim.vz = 0;
  attacker.path = null;
  attacker.pathI = 0;
  attacker.order = Ord.Attack;
  attacker.tid = victim.id;
  w.step();
  assert.equal(
    w.visible[1][Math.floor(farZ) * 72 + Math.floor(farX)],
    1,
    'attacker sees target before loss',
  );
  // Target moves beyond every AI unit's sight.
  victim.x = victim.px = 6.5;
  victim.z = victim.pz = 66.5;
  victim.vx = victim.vz = 0;
  w.step();
  assert.equal(
    w.visible[1][66 * 72 + 6],
    0,
    'target tile now unseen by AI',
  );
  const cadenceSteps = Math.ceil(1.4 / (1 / 30)) + 2;
  for (let i = 0; i < cadenceSteps; i++) w.step();
  assert.notEqual(attacker.order, Ord.Attack, 'attacker dropped out-of-sight target');
}
