/**
 * FTR-TESTS RED — fault injection (docs/FORGE_TRACE.md §2, §8).
 * world.kill() is permitted ONLY inside the lost-scout-recovery scenario and
 * MUST emit exactly one fault-injection event whose entityIds include the
 * killed scout id. Standard traces contain zero fault injection.
 *
 * Flow per §8: configure civ/fog/difficulty, reset(seed), attach a collector
 * with faultInjectionAllowed: true, prepareLostScoutRecovery (kills the
 * original rival Scout before stepping), then run the standard opening.
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening, prepareLostScoutRecovery } from '../src/forge-policy';
import { World } from '../src/sim';
import { Kind } from '../src/engine';
import { normalizeMatchConfig } from '../src/match-config';
import { factionToLegacyCiv } from '../src/pacing-contract';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const MAX_TICKS = 3600; // 3 simulated minutes — bounded and fast.

function makeConfig(): MatchConfig {
  return normalizeMatchConfig({
    playerFaction: 'sunweaver',
    aiFaction: 'gravemark',
    map: 'helios-rift',
    difficulty: 'standard',
    fogOfWar: true,
    speed: 1,
    tacticalPause: 'enabled',
    seedMode: 'deterministic',
    seed: SEED,
  });
}

function standardRun(): { events: Record<string, unknown>[] } {
  const world = new World();
  const collector = new ForgeTraceCollector(world, { config: makeConfig(), policyId: 'standard-opening' });
  collector.attach();
  runStandardOpening(world, {
    seed: SEED,
    difficulty: 'standard',
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    collector,
    maxTicks: MAX_TICKS,
  });
  collector.finalize();
  return { events: collector.events as Record<string, unknown>[] };
}

function recoveryRun(): {
  events: Record<string, unknown>[];
  killedEntityId: number;
  faultEventSeq: number;
} {
  const world = new World();
  world.civ[0] = factionToLegacyCiv('sunweaver');
  world.civ[1] = factionToLegacyCiv('gravemark');
  world.fogOfWarEnabled = true;
  world.aiDifficulty = 'standard';
  world.reset(SEED);
  const collector = new ForgeTraceCollector(world, {
    config: makeConfig(),
    policyId: 'lost-scout-recovery',
    faultInjectionAllowed: true,
  });
  collector.attach();
  const prepared = prepareLostScoutRecovery(collector, world);
  runStandardOpening(world, {
    seed: SEED,
    difficulty: 'standard',
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    collector,
    maxTicks: MAX_TICKS,
  });
  collector.finalize();
  return {
    events: collector.events as Record<string, unknown>[],
    killedEntityId: prepared.killedEntityId,
    faultEventSeq: prepared.faultEventSeq,
  };
}

function main(): void {
  // Standard opening: zero fault injection.
  const standard = standardRun();
  const standardFaults = standard.events.filter((event) => event.type === 'fault-injection');
  assert.equal(standardFaults.length, 0, 'standard opening contains zero fault-injection events');

  // Lost-scout recovery: exactly one fault-injection event for the killed scout.
  const recovery = recoveryRun();

  const faults = recovery.events.filter((event) => event.type === 'fault-injection');
  assert.equal(faults.length, 1, 'lost-scout-recovery run contains exactly one fault-injection event');
  const fault = faults[0];
  assert.ok(
    (fault.entityIds as number[]).includes(recovery.killedEntityId),
    `fault-injection event entityIds include the killed scout id ${recovery.killedEntityId}`,
  );
  assert.equal(fault.seq, recovery.faultEventSeq, 'prepareLostScoutRecovery reported the fault event seq');

  // The killed entity is the rival Scout that existed at reset.
  const scout = (() => {
    // Re-derive: after the run the ent record still carries kind/team.
    const world = new World();
    world.civ[0] = factionToLegacyCiv('sunweaver');
    world.civ[1] = factionToLegacyCiv('gravemark');
    world.reset(SEED);
    const fresh = world.ents[recovery.killedEntityId];
    return fresh;
  })();
  assert.ok(scout, 'killed entity id exists in a same-seed fresh world');
  assert.equal(scout.kind, Kind.Scout, 'killed entity is a Scout');
  assert.equal(scout.team, 1, 'killed Scout belongs to the rival team');
}

try {
  main();
  console.log('forge-trace-faults tests: PASS');
} catch (err) {
  console.error('forge-trace-faults tests: FAIL', err);
  process.exitCode = 1;
}
