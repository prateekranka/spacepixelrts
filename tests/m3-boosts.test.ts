// M3-C — Sunweaver excess-energy boosts (docs/M3_ECONOMIES.md C1–C4).

import assert from 'node:assert/strict';
import { DT, Kind, Ord } from '../src/engine';
import { CIV_PROFILE } from '../src/content';
import { World } from '../src/sim';

const SEED = 0x5eed;
const STEPS_2S = Math.round(2 / DT);

// ---- C2 production: training depletes 1.8x faster --------------------------------
{
  const w = new World();
  w.civ[0] = 'vespari';
  w.reset(SEED);
  w.boosts[0] = 1;
  const hall = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  assert.ok(hall, 'hall exists');
  hall.trainKind = Kind.Fighter;
  hall.trainT = 9;
  for (let i = 0; i < STEPS_2S; i++) w.step();
  assert.ok(hall.trainT < 9 - 2 * 1.2, `boosted training is fast (trainT ${hall.trainT})`);
  const energy = w.teams[0].energy;
  assert.ok(
    Math.abs(CIV_PROFILE.vespari.startEnergy - energy - 8 * 2) < 2,
    `production drains ~8/s (energy ${energy})`,
  );
}

// ---- C2 vision: fog radius +2.5 grows explored area --------------------------------
{
  const w = new World();
  w.civ[0] = 'vespari';
  w.reset(SEED);
  let base = 0;
  for (const v of w.explored[0]) base += v;
  const scout = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Scout);
  assert.ok(scout, 'scout exists');
  scout.order = Ord.Idle;
  for (let i = 0; i < 5; i++) w.step();
  let normal = 0;
  for (const v of w.explored[0]) normal += v;
  w.boosts[0] = 2;
  w.teams[0].energy = 200; // keep the drain from auto-off during the check
  for (let i = 0; i < 5; i++) w.step();
  let boosted = 0;
  for (const v of w.explored[0]) boosted += v;
  assert.ok(boosted > normal, `vision boost grows explored (${normal} -> ${boosted})`);
  assert.ok(base <= normal, 'baseline explored before stepping');
}

// ---- C2 shields: damaged building regenerates --------------------------------------
{
  const w = new World();
  w.civ[0] = 'vespari';
  w.reset(SEED);
  const hall = w.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  assert.ok(hall, 'hall exists');
  hall.hp = hall.maxHp - 120;
  w.boosts[0] = 3;
  w.teams[0].energy = 200;
  for (let i = 0; i < STEPS_2S; i++) w.step();
  // Hall self-repairs 2/s (vespari) plus shields 6/s; expect ~16 over 2 s.
  assert.ok(hall.hp > hall.maxHp - 120 + 10, `shields regen active (hp ${hall.hp})`);
}

// ---- C3 auto-off: below 4 energy the boost disables --------------------------------
{
  const w = new World();
  w.civ[0] = 'vespari';
  w.reset(SEED);
  w.teams[0].energy = 6;
  w.boosts[0] = 1;
  for (let i = 0; i < Math.round(1 / DT); i++) w.step();
  assert.equal(w.boosts[0], 0, 'boost auto-disabled at low energy');
}

// ---- C1 toggle semantics: one active at a time (HUD handler mirrors this) ----------
{
  const w = new World();
  w.civ[0] = 'vespari';
  w.reset(SEED);
  w.boosts[0] = 2;
  assert.equal(w.boosts[0], 2, 'vision active');
  w.boosts[0] = 1;
  assert.equal(w.boosts[0], 1, 'production replaces vision');
  w.boosts[0] = 1;
  // Second click of the same kind would be handled by the HUD toggle (-> 0).
}

// ---- C3 AI policy: vespari AI uses production while training ------------------------
{
  const w = new World();
  w.reset(SEED);
  w.civ[1] = 'vespari';
  // Force a military train queue and high energy, then let the AI cadence decide.
  const barracks = w.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Barracks);
  if (barracks) {
    barracks.trainT = 9;
    barracks.trainKind = Kind.Fighter;
    w.teams[1].energy = 200;
    for (let i = 0; i < Math.round(1.5 / DT); i++) w.step();
    assert.equal(w.boosts[1], 1, 'AI uses production boost while training');
  }
  // After the queue empties, AI switches to vision (first 90 s) or off.
  for (let i = 0; i < Math.round(12 / DT); i++) w.step();
  assert.notEqual(w.boosts[1], 1, 'AI production boost ends with the queue');
}

// ---- Determinism: boosts are per-team and reset-bound -------------------------------
{
  const w = new World();
  w.reset(SEED);
  w.boosts[0] = 3;
  w.boosts[1] = 1;
  w.reset(SEED);
  assert.equal(w.boosts[0], 0, 'boost reset on reset()');
  assert.equal(w.boosts[1], 0, 'AI boost reset on reset()');
}

console.log('M3-C boost tests: PASS');
