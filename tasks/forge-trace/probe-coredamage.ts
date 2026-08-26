/** Parent probe 4 — does the collector ever emit core-damage? */
import { Kind, Ord } from '../../src/engine';
import { factionToLegacyCiv } from '../../src/pacing-contract';
import { normalizeMatchConfig } from '../../src/match-config';
import { ForgeTraceCollector } from '../../src/forge-collector';
import { World } from '../../src/sim';

const world = new World();
world.civ[0] = factionToLegacyCiv('sunweaver');
world.civ[1] = factionToLegacyCiv('gravemark');
world.fogOfWarEnabled = false;
world.aiDifficulty = 'standard';
world.reset(24301);

const config = normalizeMatchConfig({ seedMode: 'deterministic', seed: 24301 });
const collector = new ForgeTraceCollector(world, {
  config,
  policyId: 'probe',
});
collector.attach();
collector.observe();

// Step to tick 300, then smash the rival Core with a legal-ish direct strike:
// we are NOT testing legality here, only whether hp drops produce core-damage events.
for (let i = 0; i < 300; i++) {
  world.step();
  collector.observe();
}
const rivalCore = world.ents.find((e) => e.alive && e.team === 1 && e.kind === Kind.Hall);
console.log('rival core hp before:', rivalCore?.hp);
if (rivalCore) {
  // Simulate two ticks of damage by spawning bolts is complex; instead directly
  // reduce hp the way damageRigAware would, then observe (probe-only).
  const before = rivalCore.hp;
  rivalCore.hp = before - 12;
  collector.observe();
  console.log('after -12 hp, core-damage events:',
    collector.events.filter((e) => e.type === 'core-damage').length);
  const cd = collector.events.filter((e) => e.type === 'core-damage')[0];
  if (cd) console.log('payload:', JSON.stringify(cd.payload));
}
