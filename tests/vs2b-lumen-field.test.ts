// VS-2B — Central Lumen Field ownership contract.

import assert from 'node:assert/strict';
import { DT, Kind, MAP, Ord } from '../src/engine';
import type { Ent } from '../src/engine';
import { SEEN_PLAYER } from '../src/discovery';
import { World } from '../src/sim';

const SEED = 0x5eed;
const CAPTURE_STEPS = Math.round(5 / DT);
const TEN_SECONDS = Math.round(10 / DT);
const CENTER_EPSILON = 1e-9;

interface HeldUnit {
  unit: Ent;
  x: number;
  z: number;
}

function centerOf(world: World): { x: number; z: number } {
  const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
  assert.ok(landmark, 'central Lumen landmark exists');
  return { x: landmark.x, z: landmark.z };
}

function prepareWorld(): World {
  const world = new World();
  world.reset(SEED);
  // Keep the fixture in play without allowing the unrelated terminal seam to fire.
  for (const hall of world.ents) {
    if (hall.alive && (hall.kind === Kind.Hall)) hall.progress = 0.5;
  }
  return world;
}

function spawnHeld(world: World, team: number, kind: Kind, x?: number, z?: number): HeldUnit {
  const center = centerOf(world);
  const unit = world.spawn(kind, world.civ[team], team, x ?? center.x, z ?? center.z);
  assert.ok(unit, `team ${team} ${kind} fixture spawns`);
  return { unit, x: x ?? center.x, z: z ?? center.z };
}

function hold(fixture: HeldUnit): void {
  const { unit, x, z } = fixture;
  unit.alive = true;
  unit.x = unit.px = x;
  unit.z = unit.pz = z;
  unit.vx = unit.vz = 0;
  unit.order = Ord.Move;
  unit.tx = x;
  unit.tz = z;
  unit.tid = -1;
  unit.path = null;
  unit.pathI = 0;
}

function stepHeld(world: World, fixtures: readonly HeldUnit[], steps: number): void {
  for (let i = 0; i < steps; i++) {
    for (const fixture of fixtures) hold(fixture);
    world.step();
  }
}

function fnv1a(values: ArrayLike<number>): number {
  let hash = 2166136261;
  for (let i = 0; i < values.length; i++) {
    hash ^= values[i];
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function objectiveSnapshot(world: World): string {
  return JSON.stringify({
    lumen: world.lumenState(),
    energy: world.teams.slice(0, 2).map((team) => team.energy),
    visible: [fnv1a(world.visible[0]), fnv1a(world.visible[1])],
    explored: [fnv1a(world.explored[0]), fnv1a(world.explored[1])],
  });
}

// Qualifying roster kinds capture; workers, scouts, Siege, and Shade never do.
for (const kind of [Kind.Fighter, Kind.Ravager, Kind.Prism]) {
  const world = prepareWorld();
  const fighter = spawnHeld(world, 0, kind);
  stepHeld(world, [fighter], CAPTURE_STEPS);
  assert.equal(world.lumenState().owner, 0, `kind ${kind} captures at the center`);
}
for (const kind of [Kind.Worker, Kind.Scout, Kind.Siege, Kind.Shade]) {
  const world = prepareWorld();
  const unit = spawnHeld(world, 0, kind);
  stepHeld(world, [unit], TEN_SECONDS);
  assert.equal(world.lumenState().owner, -1, `non-qualifying kind ${kind} never captures`);
}
{
  const world = prepareWorld();
  const dead = spawnHeld(world, 0, Kind.Fighter);
  dead.unit.hp = 0;
  stepHeld(world, [dead], TEN_SECONDS);
  assert.equal(world.lumenState().owner, -1, 'dead qualifying unit never captures');
}

// A living Fighter captures after five seconds, and empty space preserves ownership.
{
  const world = prepareWorld();
  const fighter = spawnHeld(world, 0, Kind.Fighter);
  stepHeld(world, [fighter], CAPTURE_STEPS - 1);
  assert.equal(world.lumenState().owner, -1, 'capture is not early');
  stepHeld(world, [fighter], 1);
  assert.equal(world.lumenState().owner, 0, 'Fighter captures at five seconds');
  assert.equal(world.lumenState().capturing, -1, 'capturing clears after ownership');
  assert.equal(world.lumenState().progress, 0, 'capture progress clears after ownership');
  fighter.unit.hp = 0;
  stepHeld(world, [], 1);
  assert.deepEqual(world.lumenState(), {
    owner: 0,
    capturing: -1,
    progress: 0,
    contested: false,
    pulseRemaining: [0, 0],
  }, 'empty field resets transient capture state but preserves owner');
  assert.equal(world.winner, -1, 'ownership does not set winner');
}

// Both teams present contest without progress; leaving loses the old progress.
{
  const world = prepareWorld();
  const player = spawnHeld(world, 0, Kind.Fighter);
  const rival = spawnHeld(world, 1, Kind.Fighter);
  rival.unit.maxHp = rival.unit.hp = 1e6;
  rival.x = rival.z = 0;
  rival.unit.x = rival.unit.px = 0;
  rival.unit.z = rival.unit.pz = 0;
  stepHeld(world, [player], 2 * Math.round(1 / DT));
  const partial = world.lumenState().progress;
  assert.equal(world.lumenState().capturing, 0, 'single player starts capture');
  assert.ok(partial > 0, 'partial capture exists before contest');
  const center = centerOf(world);
  rival.x = center.x;
  rival.z = center.z;
  stepHeld(world, [player, rival], 1);
  assert.deepEqual(world.lumenState(), {
    owner: -1,
    capturing: -1,
    progress: 0,
    contested: true,
    pulseRemaining: [0, 0],
  }, 'both teams contest and clear progress');
  rival.x = rival.z = 0;
  stepHeld(world, [player, rival], 1);
  assert.equal(world.lumenState().contested, false, 'leaving clears contested state');
  assert.equal(world.lumenState().capturing, 0, 'remaining side resumes capture');
  assert.ok(world.lumenState().progress <= DT + CENTER_EPSILON, 'old progress is not retained after leaving');
  assert.equal(world.winner, -1, 'contest does not set winner');
}

// Recapture requires a fresh full five seconds after a side change.
{
  const world = prepareWorld();
  const player = spawnHeld(world, 0, Kind.Fighter);
  const rival = spawnHeld(world, 1, Kind.Fighter);
  rival.unit.maxHp = rival.unit.hp = 1e6;
  rival.x = rival.z = 0;
  rival.unit.x = rival.unit.px = 0;
  rival.unit.z = rival.unit.pz = 0;
  stepHeld(world, [player], CAPTURE_STEPS);
  assert.equal(world.lumenState().owner, 0, 'player owns before recapture');
  rival.x = centerOf(world).x;
  rival.z = centerOf(world).z;
  player.unit.hp = 0;
  stepHeld(world, [rival], CAPTURE_STEPS - 1);
  assert.equal(world.lumenState().owner, 0, 'recapture is not early');
  assert.equal(world.lumenState().capturing, 1, 'rival is the current capturer');
  stepHeld(world, [rival], 2);
  assert.equal(world.lumenState().owner, 1, 'rival recaptures after a fresh five seconds');
  assert.equal(world.lumenState().capturing, -1, 'recapture clears capturing');
  assert.equal(world.lumenState().progress, 0, 'recapture clears progress');
  assert.equal(world.winner, -1, 'recapture does not set winner');
}

// Ownership pays exactly one integer Charge per owned second and never pays the rival.
{
  const world = prepareWorld();
  const player = spawnHeld(world, 0, Kind.Fighter);
  stepHeld(world, [player], CAPTURE_STEPS);
  const playerEnergy = world.teams[0].energy;
  const rivalEnergy = world.teams[1].energy;
  stepHeld(world, [player], TEN_SECONDS);
  assert.equal(world.teams[0].energy - playerEnergy, 10, 'owner gains exactly 10 Charge over 10 seconds');
  assert.equal(world.teams[1].energy - rivalEnergy, 0, 'non-owner gains no objective Charge');
}

// The first global pulse starts at 30 owned seconds, fills fog/discovery, then expires cleanly.
{
  const world = prepareWorld();
  const player = spawnHeld(world, 0, Kind.Fighter);
  const far = spawnHeld(world, 1, Kind.Fighter, MAP - 3.5, MAP - 3.5);
  const farTile = (MAP - 4) + (MAP - 4) * MAP;
  assert.equal(world.visible[0][farTile], 0, 'far tile starts outside player visibility');
  assert.equal(world.explored[0][farTile], 0, 'far tile starts unexplored');
  assert.equal(far.unit.seenBy & SEEN_PLAYER, 0, 'far enemy starts undiscovered');
  stepHeld(world, [player, far], CAPTURE_STEPS);
  let ownedSteps = 0;
  while (world.lumenState().pulseRemaining[0] <= 0 && ownedSteps < Math.round(31 / DT)) {
    stepHeld(world, [player, far], 1);
    ownedSteps++;
  }
  assert.ok(Math.abs(ownedSteps * DT - 30) <= DT, `first pulse begins at 30 owned seconds (${ownedSteps * DT}s)`);
  assert.ok(world.lumenState().pulseRemaining[0] > 0, 'player pulse is active');
  assert.ok(world.visible[0].every((value) => value === 1), 'pulse fills player current visibility globally');
  assert.ok(world.explored[0].every((value) => value === 1), 'pulse records global player exploration');
  assert.notEqual(far.unit.seenBy & SEEN_PLAYER, 0, 'pulse discovers far enemy');
  while (world.lumenState().pulseRemaining[0] > 0) stepHeld(world, [player, far], 1);
  assert.equal(world.visible[0][farTile], 0, 'current visibility returns after pulse');
  assert.equal(world.explored[0][farTile], 1, 'exploration persists after pulse');
  assert.notEqual(far.unit.seenBy & SEEN_PLAYER, 0, 'discovery persists after pulse');
  assert.equal(world.winner, -1, 'pulse does not set winner');
}

// A pulse may finish after ownership changes; read state is a defensive copy.
{
  const world = prepareWorld();
  const player = spawnHeld(world, 0, Kind.Fighter);
  const rival = spawnHeld(world, 1, Kind.Fighter);
  rival.unit.maxHp = rival.unit.hp = 1e6;
  rival.x = rival.z = 0;
  rival.unit.x = rival.unit.px = 0;
  rival.unit.z = rival.unit.pz = 0;
  stepHeld(world, [player], CAPTURE_STEPS + Math.round(26 / DT));
  player.x = player.z = 0;
  rival.x = centerOf(world).x;
  rival.z = centerOf(world).z;
  stepHeld(world, [player, rival], Math.round(4 / DT));
  assert.equal(world.lumenState().owner, 0, 'rival has not recaptured before five seconds');
  assert.ok(world.lumenState().pulseRemaining[0] > 0, 'player pulse is running before recapture');
  stepHeld(world, [rival], Math.round(1 / DT) + 1);
  assert.equal(world.lumenState().owner, 1, 'rival can change owner while old pulse remains');
  assert.ok(world.lumenState().pulseRemaining[0] > 0, 'active old pulse is allowed to finish');
  const copy = world.lumenState();
  (copy as { owner: number }).owner = 0;
  (copy.pulseRemaining as number[])[0] = 99;
  assert.equal(world.lumenState().owner, 1, 'lumenState owner is defensive');
  assert.notEqual(world.lumenState().pulseRemaining[0], 99, 'lumenState pulse tuple is defensive');
}

// Identical staged sequences are byte-deterministic across state, economy, fog, and discovery.
{
  function run(): World {
    const world = prepareWorld();
    const player = spawnHeld(world, 0, Kind.Fighter);
    const far = spawnHeld(world, 1, Kind.Fighter, MAP - 3.5, MAP - 3.5);
    stepHeld(world, [player, far], CAPTURE_STEPS);
    for (let i = 0; i < Math.round(30 / DT) + Math.round(4 / DT) + 2; i++) {
      stepHeld(world, [player, far], 1);
    }
    return world;
  }
  const a = run();
  const b = run();
  assert.equal(objectiveSnapshot(a), objectiveSnapshot(b), 'same seed and sequence is byte-deterministic');
  assert.equal(a.winner, -1, 'deterministic objective sequence never changes winner');
}

// Reset clears ownership, transient state, pulses, and all hidden accumulators.
{
  const world = prepareWorld();
  const player = spawnHeld(world, 0, Kind.Fighter);
  stepHeld(world, [player], CAPTURE_STEPS + Math.round(30 / DT) + 1);
  assert.equal(world.lumenState().owner, 0, 'reset fixture has owned field');
  world.reset(SEED);
  assert.deepEqual(world.lumenState(), {
    owner: -1,
    capturing: -1,
    progress: 0,
    contested: false,
    pulseRemaining: [0, 0],
  }, 'reset clears all Lumen state');
  assert.equal(world.winner, -1, 'reset clears winner independently of Lumen');
}

console.log('VS2B Lumen Field tests: PASS');
