/** Parent forensic probe — who fought whom at ticks 234 and 2578 on seed 24301. */
import { Kind } from '../../src/engine';
import { World } from '../../src/sim';
import { SEEN_RIVAL } from '../../src/discovery';
import { factionToLegacyCiv } from '../../src/pacing-contract';

const world = new World();
world.civ[0] = factionToLegacyCiv('sunweaver');
world.civ[1] = factionToLegacyCiv('gravemark');
world.fogOfWarEnabled = true;
world.aiDifficulty = 'standard';
world.reset(24301);

const interesting = new Set([337, 338, 345, 346, 357]);
function dump(label: string): void {
  console.log(`--- ${label} @ tick ${world.tick}`);
  for (const id of interesting) {
    const e = world.ents[id];
    if (!e || (!e.alive && e.hp <= 0)) { console.log(`  ${id}: gone`); continue; }
    console.log(
      `  ${id}: kind=${e.kind} team=${e.team} hp=${e.hp.toFixed(1)} alive=${e.alive} order=${e.order} tid=${e.tid} seenBy=${e.seenBy}`,
    );
  }
}

dump('reset');
let saw234 = false;
let saw2578 = false;
for (let i = 0; i < 2700 && world.winner === -1; i++) {
  world.step();
  if (!saw234 && world.tick >= 235) {
    saw234 = true;
    dump('after-tick-235');
  }
  const hall = world.ents.find((e) => e.alive && e.team === 0 && e.kind === Kind.Hall);
  const coreSeen = hall ? (hall.seenBy & SEEN_RIVAL) !== 0 : false;
  if (!saw2578 && world.tick >= 2579) {
    saw2578 = true;
    dump('after-tick-2579');
    console.log(`  playerHallSeenByRival=${coreSeen}`);
    const field = world.ents.filter(
      (e) => e.alive && e.team === 1 && (e.kind === Kind.Fighter || e.kind === Kind.Ravager || e.kind === Kind.Prism),
    );
    console.log(`  rivalFieldSize=${field.length}`);
    for (const u of field) {
      console.log(`   unit ${u.id} kind=${u.kind} order=${u.order} tid=${u.tid} pos=${u.x.toFixed(1)},${u.z.toFixed(1)}`);
    }
    break;
  }
}
