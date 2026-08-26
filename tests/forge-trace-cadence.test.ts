/**
 * FTR-TESTS RED — sample cadence (docs/FORGE_TRACE.md §5, §12).
 * The sim runs at 20 Hz; exactly one resource-sample and one population-sample
 * per team are emitted once per simulated second (every 20 ticks). In a run
 * segment of >= 2400 ticks: per-team sample count is floor(ticksSpanned / 20)
 * within +/-1, and consecutive sample tick deltas are all exactly 20.
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening } from '../src/forge-policy';
import { World } from '../src/sim';
import { normalizeMatchConfig } from '../src/match-config';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const MAX_TICKS = 3600; // 3 simulated minutes — bounded and fast.
const MIN_SEGMENT_TICKS = 2400;
const SAMPLE_PERIOD = 20;

function runMatch(): { events: unknown[]; terminalTick: number } {
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
  const result = runStandardOpening(world, {
    seed: SEED,
    difficulty: 'standard',
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    collector,
    maxTicks: MAX_TICKS,
  });
  collector.finalize();
  return { events: collector.events, terminalTick: result.terminalTick };
}

function checkTeamCadence(events: unknown[], type: string, team: string): void {
  const samples = events
    .map((raw) => raw as Record<string, unknown>)
    .filter((event) => event.type === type && event.team === team)
    .map((event) => event.tick as number);
  assert.ok(samples.length >= 2, `${team} ${type} has at least two samples`);

  const span = samples[samples.length - 1] - samples[0];
  assert.ok(span >= MIN_SEGMENT_TICKS, `${team} ${type} segment spans >= ${MIN_SEGMENT_TICKS} ticks (got ${span})`);

  for (let i = 1; i < samples.length; i++) {
    assert.equal(
      samples[i] - samples[i - 1],
      SAMPLE_PERIOD,
      `${team} ${type} consecutive sample delta at index ${i} is exactly ${SAMPLE_PERIOD}`,
    );
  }

  const expected = Math.floor(span / SAMPLE_PERIOD);
  assert.ok(
    Math.abs(samples.length - expected) <= 1,
    `${team} ${type} count ${samples.length} is floor(span/20)=${expected} within +/-1`,
  );
}

function main(): void {
  const { events, terminalTick } = runMatch();
  assert.ok(terminalTick >= MIN_SEGMENT_TICKS, `run segment covers >= ${MIN_SEGMENT_TICKS} ticks (got ${terminalTick})`);

  for (const team of ['sunweaver', 'gravemark']) {
    checkTeamCadence(events, 'resource-sample', team);
    checkTeamCadence(events, 'population-sample', team);
  }

  // Exactly one resource-sample AND one population-sample per team per second.
  for (const team of ['sunweaver', 'gravemark']) {
    const resourceCount = events.filter(
      (raw) => (raw as Record<string, unknown>).type === 'resource-sample' && (raw as Record<string, unknown>).team === team,
    ).length;
    const populationCount = events.filter(
      (raw) => (raw as Record<string, unknown>).type === 'population-sample' && (raw as Record<string, unknown>).team === team,
    ).length;
    assert.equal(populationCount, resourceCount, `${team} population samples pair 1:1 with resource samples`);
  }
}

try {
  main();
  console.log('forge-trace-cadence tests: PASS');
} catch (err) {
  console.error('forge-trace-cadence tests: FAIL', err);
  process.exitCode = 1;
}
