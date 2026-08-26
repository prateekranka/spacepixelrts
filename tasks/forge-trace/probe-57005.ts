/** Parent probe 2 — what is entity 346 at tick ~5460 on seed 57005? */
import { factionToLegacyCiv } from '../../src/pacing-contract';
import { World } from '../../src/sim';

const world = new World();
world.civ[0] = factionToLegacyCiv('sunweaver');
world.civ[1] = factionToLegacyCiv('gravemark');
world.fogOfWarEnabled = true;
world.aiDifficulty = 'standard';
world.reset(57005);

while (world.tick < 5470 && world.winner === -1) {
  world.step();
}
const e346 = world.ents[346];
console.log('tick', world.tick, 'winner', world.winner);
console.log(
  'ent346: kind=', e346.kind, 'team=', e346.team, 'alive=', e346.alive,
  'hp=', e346.hp, 'progress=', e346.progress, 'trainT=', e346.trainT,
  'trainKind=', e346.trainKind,
);
const halls = world.ents.filter((e) => e.alive && e.kind === 10).map((e) => ({ id: e.id, team: e.team, hp: e.hp, progress: e.progress }));
console.log('halls:', JSON.stringify(halls));
