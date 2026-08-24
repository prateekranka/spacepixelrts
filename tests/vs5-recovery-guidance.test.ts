import assert from 'node:assert/strict';
import { Kind } from '../src/engine';
import { evaluateOpeningGuidance } from '../src/opening-guidance';
import { World } from '../src/sim';

const world = new World();
world.reset(0x5eed);

const hall = world.ents.find(
  (entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Hall,
);
assert.ok(hall, 'player Nexus exists');
const yard = world.spawn(Kind.Barracks, hall.civ, 0, hall.x + 3.5, hall.z);
assert.ok(yard, 'completed player Yard fixture spawns');
yard.progress = 1;
yard.hp = yard.maxHp;

const guidance = () => evaluateOpeningGuidance(
  world.ents,
  world.landmarks,
  new Set<number>(),
  {
    ore: 500,
    energy: 120,
    techPath: 'sky-dominion',
    channelT: 0,
  },
);

assert.deepEqual(guidance(), {
  id: 'train-army',
  primary: 'Train Lumen Guard + Solar Strider',
  secondary: 'Select your Yard · train each unit · Habitat only if pop is full',
}, 'first-time army coaching remains unchanged');

const fighter = world.spawn(Kind.Fighter, hall.civ, 0, yard.x, yard.z);
const strider = world.spawn(Kind.Ravager, hall.civ, 0, yard.x + 0.7, yard.z);
assert.ok(fighter && strider, 'mixed strike-team fixture spawns');

world.kill(fighter);
assert.deepEqual(guidance(), {
  id: 'train-army',
  primary: 'Rebuild Lumen Guard',
  secondary: 'Combat unit lost · select your Yard and retrain the missing role',
}, 'one lost combat role receives explicit recovery coaching');

world.kill(strider);
assert.deepEqual(guidance(), {
  id: 'train-army',
  primary: 'Rebuild Lumen Guard + Solar Strider',
  secondary: 'Strike team lost · select your Yard and retrain both roles',
}, 'a wiped strike team receives explicit rebuild coaching');

console.log('VS5 recovery guidance tests: PASS');
