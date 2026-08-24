import assert from 'node:assert/strict';
import { Kind } from '../src/engine';
import { SEEN_PLAYER } from '../src/discovery';
import { World } from '../src/sim';
import { evaluateOpeningGuidance } from '../src/opening-guidance';

const SEED = 0x5eed;

const opening = new World();
opening.reset(SEED);

function openingGuidance(selectedIds: Iterable<number>) {
  return evaluateOpeningGuidance(opening.ents, opening.landmarks, new Set(selectedIds));
}

// VS5 economy-first opening: no selection, Worker, Scout, and discovered objective all begin at Yard.
assert.equal(openingGuidance([]).id, 'build-yard');
assert.equal(openingGuidance([]).primary, 'Build a Yard');
const worker = opening.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Worker);
const scout = opening.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Scout);
const central = opening.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
assert.ok(worker && scout && central);
assert.equal(openingGuidance([worker.id]).id, 'build-yard');
assert.equal(openingGuidance([scout.id]).id, 'build-yard');
central.discoveredBy |= SEEN_PLAYER;
assert.equal(openingGuidance([scout.id]).id, 'build-yard');

// After the real Yard and mixed pair exist, the original Scout/objective guidance remains intact.
const ready = new World();
ready.reset(SEED);
const hall = ready.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
const builder = ready.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Worker);
assert.ok(hall && builder);
const spot = [
  { x: hall.x - 3.4, z: hall.z - 3.4 },
  { x: hall.x, z: hall.z - 4.4 },
  { x: hall.x + 3.4, z: hall.z - 3.4 },
].find((candidate) => ready.canPlace(candidate.x, candidate.z, 1.05));
assert.ok(spot);
assert.equal(ready.tryPlace(0, Kind.Barracks, spot.x, spot.z, builder.id), true);
const yard = ready.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Barracks);
assert.ok(yard);
yard.progress = 1;
yard.hp = yard.maxHp;
assert.ok(ready.spawn(Kind.Fighter, 'vespari', 0, yard.x, yard.z));
assert.ok(ready.spawn(Kind.Ravager, 'vespari', 0, yard.x, yard.z));

function readyGuidance(selectedIds: Iterable<number>) {
  return evaluateOpeningGuidance(ready.ents, ready.landmarks, new Set(selectedIds));
}

const readyScout = ready.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Scout);
const enemyScout = ready.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Scout);
const readyCentral = ready.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
assert.ok(readyScout && enemyScout && readyCentral);
assert.equal(readyGuidance([]).id, 'select-scout');
assert.equal(readyGuidance([readyScout.id]).id, 'explore-signal');
assert.equal(readyGuidance([readyScout.id]).primary, 'Explore the nearby signal');
assert.equal(readyGuidance([enemyScout.id]).id, 'select-scout');
readyScout.alive = false;
assert.equal(readyGuidance([readyScout.id]).id, 'select-scout');
readyScout.alive = true;
readyCentral.discoveredBy |= SEEN_PLAYER;
const withScout = readyGuidance([readyScout.id]);
assert.equal(withScout.id, 'objective-found');
assert.equal(withScout.primary, 'A shared Lumen field has been discovered');
assert.equal(withScout.secondary, 'The enemy may contest this location');
assert.deepEqual(readyGuidance([]), withScout, 'objective state ignores selection');

opening.reset(SEED);
assert.equal(openingGuidance([]).id, 'build-yard');
assert.equal(openingGuidance([]).primary, 'Build a Yard');

console.log('M2 guidance tests: PASS');
