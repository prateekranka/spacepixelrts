/**
 * FTR-TESTS RED — legal-policy operations (docs/FORGE_TRACE.md §7, §8, §12).
 * During a recorded policy run the collector only records attempt/command
 * events at ticks where the world state actually changed legally:
 *  - every placement-attempt with ok=true is followed by a live Barracks
 *    entity whose id appears in the event's entityIds;
 *  - every path-commit-attempt with ok=true is followed by a
 *    technology-path-lock for the same team;
 *  - every training-attempt with ok=true is followed by a training-start for
 *    the same team and kind;
 *  - command-issue events name a team and at least one entity.
 * And there is no resource grant: maxPositiveStepGain(teamIndex) <= 96
 * (HONEST_STEP_GAIN_BOUND) for both teams over the run.
 * maxTicks = 4800: long enough for path lock (~3400) + first trainings to
 * start, short enough to stay fast, and before any AI attack window.
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening } from '../src/forge-policy';
import { World } from '../src/sim';
import { Kind } from '../src/engine';
import { normalizeMatchConfig } from '../src/match-config';
import { HONEST_STEP_GAIN_BOUND } from '../src/pacing-contract';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const MAX_TICKS = 4800; // 4 simulated minutes — bounded and fast.

function runMatch(): { world: World; collector: ForgeTraceCollector; events: Record<string, unknown>[] } {
  const config: MatchConfig = normalizeMatchConfig({
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
  const world = new World();
  const collector = new ForgeTraceCollector(world, { config, policyId: 'standard-opening' });
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
  return { world, collector, events: collector.events as Record<string, unknown>[] };
}

function main(): void {
  const { world, collector, events } = runMatch();

  // Every successful placement is backed by a live building of the placed kind.
  const okPlacements = events.filter((event) => event.type === 'placement-attempt' && event.payload.ok === true);
  assert.ok(okPlacements.length >= 1, 'run recorded at least one successful placement');
  for (const event of okPlacements) {
    const buildingIds = event.entityIds as number[];
    const liveYard = buildingIds.some(
      (id) => world.ents[id] && world.ents[id].alive && world.ents[id].kind === Kind.Barracks,
    );
    assert.equal(
      liveYard,
      true,
      `placement-attempt seq ${event.seq} (tick ${event.tick}, ok=true) has a live Barracks entity`,
    );
  }

  // Every successful path commit is followed by a technology-path-lock for the team.
  const okCommits = events.filter((event) => event.type === 'path-commit-attempt' && event.payload.ok === true);
  assert.ok(okCommits.length >= 1, 'run recorded at least one successful path commit');
  for (const event of okCommits) {
    const lockedLater = events.some(
      (other) =>
        other.type === 'technology-path-lock' &&
        other.team === event.team &&
        (other.tick as number) >= (event.tick as number),
    );
    assert.equal(lockedLater, true, `path-commit-attempt seq ${event.seq} (ok=true) is followed by its path lock`);
  }

  // Every successful training attempt is followed by a training-start for team + kind.
  const okTrains = events.filter((event) => event.type === 'training-attempt' && event.payload.ok === true);
  assert.ok(okTrains.length >= 1, 'run recorded at least one successful training attempt');
  for (const event of okTrains) {
    const startedLater = events.some(
      (other) =>
        other.type === 'training-start' &&
        other.team === event.team &&
        other.payload.kind === event.payload.kind &&
        (other.tick as number) >= (event.tick as number),
    );
    assert.equal(
      startedLater,
      true,
      `training-attempt seq ${event.seq} (ok=true, kind=${String(event.payload.kind)}) is followed by training-start`,
    );
  }

  // Command issues name a team and at least one entity.
  const commands = events.filter((event) => event.type === 'command-issue');
  assert.ok(commands.length >= 1, 'run recorded command-issue events');
  for (const event of commands) {
    assert.ok(event.team === 'sunweaver' || event.team === 'gravemark', `command-issue seq ${event.seq} has a team`);
    assert.ok((event.entityIds as number[]).length > 0, `command-issue seq ${event.seq} names entities`);
  }

  // No hidden resource grants for either team.
  for (const teamIndex of [0, 1] as const) {
    const gain = collector.maxPositiveStepGain(teamIndex);
    assert.ok(
      gain <= HONEST_STEP_GAIN_BOUND,
      `team ${teamIndex} maxPositiveStepGain ${gain} exceeds HONEST_STEP_GAIN_BOUND ${HONEST_STEP_GAIN_BOUND}`,
    );
  }
}

try {
  main();
  console.log('forge-trace-policy tests: PASS');
} catch (err) {
  console.error('forge-trace-policy tests: FAIL', err);
  process.exitCode = 1;
}
