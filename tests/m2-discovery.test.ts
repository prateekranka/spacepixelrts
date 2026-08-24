import assert from 'node:assert/strict';
import { Kind, Ord, Tile } from '../src/engine';
import { SEEN_PLAYER, SEEN_RIVAL } from '../src/discovery';
import { OPENING_CENTER } from '../src/opening-presentation';
import { World } from '../src/sim';

const SEED = 0x5eed;

function distance(x: number, z: number, bx: number, bz: number): number {
  return Math.hypot(x - bx, z - bz);
}

function teleportScout(world: World, x: number, z: number): void {
  const scout = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Scout);
  assert.ok(scout, 'player scout exists');
  scout.x = scout.px = x;
  scout.z = scout.pz = z;
  scout.vx = scout.vz = 0;
  scout.order = Ord.Idle;
  scout.path = null;
  scout.pathI = 0;
  world.step();
}

const world = new World();
world.reset(SEED);

const centralSolar = world.ents
  .filter((entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === Tile.Solar)
  .sort(
    (a, b) =>
      distance(a.x, a.z, OPENING_CENTER.x, OPENING_CENTER.z) -
      distance(b.x, b.z, OPENING_CENTER.x, OPENING_CENTER.z),
  )[0];
assert.ok(centralSolar, 'central Solar objective resource exists');
assert.ok(
  distance(centralSolar.x, centralSolar.z, OPENING_CENTER.x, OPENING_CENTER.z) < 10,
  'central Solar objective is near the Helios center',
);
const rivalHall = world.ents.find((entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Hall);
assert.ok(rivalHall, 'rival Core exists');
const relicEntity = world.ents
  .filter((entity) => entity.alive && entity.kind === Kind.Resource && entity.cargoType === Tile.PropWreck)
  .sort(
    (a, b) =>
      distance(a.x, a.z, OPENING_CENTER.x - 10.8, OPENING_CENTER.z - 0.7) -
      distance(b.x, b.z, OPENING_CENTER.x - 10.8, OPENING_CENTER.z - 0.7),
  )[0];
assert.ok(relicEntity, 'neutral relic wreck exists');

const centralLandmark = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
const relicLandmark = world.landmarks.find((landmark) => landmark.id === 'neutral-tech-relic');
assert.ok(centralLandmark && relicLandmark, 'central landmark records exist');

assert.equal(centralSolar.seenBy & SEEN_PLAYER, 0, 'central objective starts undiscovered');
assert.equal(centralSolar.vis, false, 'central objective starts hidden');
assert.equal(rivalHall.seenBy & SEEN_PLAYER, 0, 'rival Core starts undiscovered');
assert.equal(rivalHall.vis, false, 'rival Core starts hidden');
assert.equal(relicEntity.seenBy & SEEN_PLAYER, 0, 'relic starts undiscovered');
assert.equal(centralLandmark.discoveredBy & SEEN_PLAYER, 0, 'central landmark starts undiscovered');
assert.equal(relicLandmark.discoveredBy & SEEN_PLAYER, 0, 'relic landmark starts undiscovered');

const playerHall = world.ents.find((entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall);
assert.ok(playerHall, 'player Core exists');
const playerSafeResources = world.ents.filter(
  (entity) =>
    entity.alive &&
    entity.kind === Kind.Resource &&
    distance(entity.x, entity.z, playerHall.x, playerHall.z) <= 10,
);
assert.ok(playerSafeResources.length >= 3, 'player safe resources exist');
for (const resource of playerSafeResources) {
  assert.notEqual(resource.seenBy & SEEN_PLAYER, 0, 'safe player resource starts discovered');
}
const rivalSafeResources = world.ents.filter(
  (entity) =>
    entity.alive &&
    entity.kind === Kind.Resource &&
    distance(entity.x, entity.z, rivalHall.x, rivalHall.z) <= 10,
);
assert.ok(rivalSafeResources.length >= 3, 'rival safe resources exist');
for (const resource of rivalSafeResources) {
  assert.notEqual(resource.seenBy & SEEN_RIVAL, 0, 'safe rival resource starts AI-discovered');
  assert.equal(resource.seenBy & SEEN_PLAYER, 0, 'rival safe resource is hidden from player');
}

teleportScout(world, centralSolar.x, centralSolar.z);
assert.notEqual(centralSolar.seenBy & SEEN_PLAYER, 0, 'scout discovers central resource');
assert.notEqual(centralLandmark.discoveredBy & SEEN_PLAYER, 0, 'scout discovers central landmark');
const centralResourceEvents = () =>
  world.discoveryLog.filter((event) => event.team === 0 && event.id === centralSolar.id).length;
const centralLandmarkEvents = () =>
  world.discoveryLog.filter((event) => event.team === 0 && event.id === centralLandmark.id).length;
assert.equal(centralResourceEvents(), 1, 'central resource logged once');
assert.equal(centralLandmarkEvents(), 1, 'central landmark logged once');
world.step();
assert.equal(centralResourceEvents(), 1, 'central resource is not logged twice');
assert.equal(centralLandmarkEvents(), 1, 'central landmark is not logged twice');

teleportScout(world, relicEntity.x, relicEntity.z);
assert.notEqual(relicEntity.seenBy & SEEN_PLAYER, 0, 'scout discovers relic entity');
assert.notEqual(relicLandmark.discoveredBy & SEEN_PLAYER, 0, 'scout discovers relic landmark');
assert.equal(
  world.discoveryLog.filter((event) => event.team === 0 && event.id === relicLandmark.id).length,
  1,
  'relic landmark logged once',
);

teleportScout(world, rivalHall.x, rivalHall.z);
assert.notEqual(rivalHall.seenBy & SEEN_PLAYER, 0, 'scout discovers rival Core');
assert.equal(rivalHall.vis, true, 'rival Core is visible in current LOS');
assert.equal(
  world.discoveryLog.filter((event) => event.team === 0 && event.id === rivalHall.id).length,
  1,
  'rival Core logged once',
);
const discoveredRivalScout = world.ents.find(
  (entity) => entity.alive && entity.team === 1 && entity.kind === Kind.Scout,
);
assert.ok(discoveredRivalScout);
assert.notEqual(discoveredRivalScout.seenBy & SEEN_PLAYER, 0, 'scout discovers enemy unit');
assert.equal(
  world.discoveryLog.filter((event) => event.team === 0 && event.id === discoveredRivalScout.id).length,
  1,
  'enemy unit logged once',
);

teleportScout(world, 14.7, 6.3);
assert.notEqual(centralSolar.seenBy & SEEN_PLAYER, 0, 'central resource memory persists');
assert.equal(centralSolar.vis, true, 'discovered resource remains visible through explored fog');
assert.equal(discoveredRivalScout.vis, false, 'remembered enemy unit outside current LOS is not visible');

const clear = new World();
clear.fogOfWarEnabled = false;
clear.reset(SEED);
for (const entity of clear.ents) {
  if (entity.alive) assert.equal(entity.seenBy, SEEN_PLAYER | SEEN_RIVAL, 'fog-off entity seen by both teams');
}
for (const landmark of clear.landmarks) {
  assert.equal(landmark.discoveredBy, SEEN_PLAYER | SEEN_RIVAL, 'fog-off landmark seen by both teams');
}

const landmarkCoordinates = JSON.stringify(world.landmarks.map(({ id, kind, label, x, z }) => ({ id, kind, label, x, z })));
world.reset(SEED);
assert.equal(
  JSON.stringify(world.landmarks.map(({ id, kind, label, x, z }) => ({ id, kind, label, x, z }))),
  landmarkCoordinates,
  'landmark coordinates reproduce after reset',
);
const resetCentral = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
assert.ok(resetCentral);
assert.equal(resetCentral.discoveredBy & SEEN_PLAYER, 0, 'reset clears central landmark latch');
assert.equal(
  world.discoveryLog.some((event) => event.team === 0 && event.id === 'central-lumen-field'),
  false,
  'reset log contains no old central discovery',
);

console.log('M2 discovery tests: PASS');
