import assert from 'node:assert/strict';
import { Kind } from '../src/engine';
import { SEEN_PLAYER } from '../src/discovery';
import { World } from '../src/sim';
import { evaluateOpeningGuidance } from '../src/opening-guidance';

const SEED = 0x5eed;

const world = new World();
world.reset(SEED);

function guidance(selectedIds: Iterable<number>) {
  return evaluateOpeningGuidance(world.ents, world.landmarks, new Set(selectedIds));
}

// None — nothing selected asks for the scout first.
{
  const g = guidance([]);
  assert.equal(g.id, 'select-scout');
  assert.equal(g.primary, 'Select your scout');
  assert.equal(g.secondary, undefined);
}

// Worker — selecting a worker does not advance.
{
  const worker = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Worker);
  assert.ok(worker);
  const g = guidance([worker.id]);
  assert.equal(g.id, 'select-scout');
  assert.equal(g.primary, 'Select your scout');
}

// Scout — selecting the player scout gives explore-signal.
{
  const scout = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Scout);
  assert.ok(scout);
  const g = guidance([scout.id]);
  assert.equal(g.id, 'explore-signal');
  assert.equal(g.primary, 'Explore the nearby signal');
  assert.equal(g.secondary, undefined);
}

// Wrong or dead scout — only an alive team-0 scout advances the prompt.
{
  const enemyScout = world.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Scout);
  const playerScout = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Scout);
  assert.ok(enemyScout && playerScout);
  assert.equal(guidance([enemyScout.id]).id, 'select-scout');
  playerScout.alive = false;
  assert.equal(guidance([playerScout.id]).id, 'select-scout');
  playerScout.alive = true;
}

// Objective bit — the Central Lumen player latch outranks any selection.
{
  const central = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
  assert.ok(central);
  const scout = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Scout);
  assert.ok(scout);
  central.discoveredBy |= SEEN_PLAYER;
  const withScout = guidance([scout.id]);
  assert.equal(withScout.id, 'objective-found');
  assert.equal(withScout.primary, 'A shared Lumen field has been discovered');
  assert.equal(withScout.secondary, 'The enemy may contest this location');
  assert.deepEqual(guidance([]), withScout, 'objective state ignores selection');
}

// Reset — replaying reset restores the first state.
world.reset(SEED);
const resetCentral = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
assert.ok(resetCentral);
assert.equal(resetCentral.discoveredBy & SEEN_PLAYER, 0);
const g = guidance([]);
assert.equal(g.id, 'select-scout');
assert.equal(g.primary, 'Select your scout');

console.log('M2 guidance tests: PASS');
