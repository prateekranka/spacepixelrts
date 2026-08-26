/** Parent probe 3 — why does tryTrain(Hall, Worker) fail at tick 5460 on seed 57005? */
import { Kind, Ord } from '../../src/engine';
import { factionToLegacyCiv } from '../../src/pacing-contract';
import { World } from '../../src/sim';

const world = new World();
world.civ[0] = factionToLegacyCiv('sunweaver');
world.civ[1] = factionToLegacyCiv('gravemark');
world.fogOfWarEnabled = true;
world.aiDifficulty = 'standard';
world.reset(57005);

let lastState = '';
while (world.tick < 5470 && world.winner === -1) {
  world.step();
  if (world.tick >= 5440 && world.tick <= 5465) {
    const hall = world.ents[346];
    const workers = world.ents.filter((e) => e.alive && e.team === 1 && e.kind === Kind.Worker);
    const eco = world.teams[1];
    const state = `t=${world.tick} hallTrainT=${hall.trainT.toFixed(2)} ageT=${eco.ageT.toFixed(2)} pop=${eco.pop} cap=${eco.cap} workers=${workers.length}`;
    if (state !== lastState) {
      console.log(state);
      lastState = state;
    }
  }
}
// Now reproduce the exact call the AI makes:
const hall = world.ents[346];
console.log('direct tryTrain(hall, Worker) ->', world.tryTrain(hall, Kind.Worker));
