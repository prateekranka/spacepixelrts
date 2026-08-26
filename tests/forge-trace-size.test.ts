/**
 * FTR-TESTS RED — bounded trace size (docs/FORGE_TRACE.md §5).
 * A FULL match (maxTicks = TERMINAL_BY_TICK, the default) must serialize to
 * under 8 MB and must NOT contain per-tick entity snapshots: the count of
 * entity-snapshot-like payload events is an order of magnitude below the tick
 * count. This is the only full-length test in the suite; runtime is bounded by
 * the 21,600-tick cap (the sim steps this in seconds).
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening } from '../src/forge-policy';
import { serializeTrace } from '../src/forge-schema';
import { World } from '../src/sim';
import { normalizeMatchConfig } from '../src/match-config';
import { TERMINAL_BY_TICK } from '../src/pacing-contract';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const SIZE_BUDGET_BYTES = 8 * 1024 * 1024; // 8 MB
const SNAPSHOT_LIKE_EVENT_TYPES = [
  'construction-start',
  'construction-complete',
  'unit-completion',
  'training-start',
  'training-attempt',
  'placement-attempt',
];

function runFullMatch(): {
  events: unknown[];
  checkpoints: unknown[];
  terminalTick: number;
  winner: number;
  config: MatchConfig;
} {
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
    maxTicks: TERMINAL_BY_TICK,
  });
  collector.finalize();
  return {
    events: collector.events,
    checkpoints: collector.checkpoints,
    terminalTick: result.terminalTick,
    winner: result.winner,
    config,
  };
}

function main(): void {
  const run = runFullMatch();

  const winnerFaction: string | null = run.winner === -1 ? null : run.winner === 0 ? 'sunweaver' : 'gravemark';
  const trace: Record<string, unknown> = {
    schemaVersion: 1,
    tool: 'forge-trace',
    createdAtNote: null,
    matchConfig: run.config,
    policy: { id: 'standard-opening', identityHash: 'a1b2c3d4' },
    tickHz: 20,
    playerFaction: 'sunweaver',
    rivalFaction: 'gravemark',
    terminalResult: {
      winner: winnerFaction,
      tick: run.terminalTick,
      reason: winnerFaction === null ? 'time-cap' : 'core-destroyed',
    },
    checkpoints: run.checkpoints,
    events: run.events,
  };

  assert.ok(run.events.length > 1000, `full run produced a rich stream (${run.events.length} events)`);
  assert.ok(run.terminalTick > 0, 'full run stepped past the opening');

  const terminalKinds = (run.events as Record<string, unknown>[])
    .filter((event) => event.type === 'match-terminal' || event.type === 'winner' || event.type === 'core-destruction')
    .length;
  assert.ok(terminalKinds >= 1, 'full run reached a terminal event (winner or time-cap)');

  // No per-tick entity snapshots: entity-snapshot-like payload events are an
  // order of magnitude below the tick count (21600).
  const snapshotLike = (run.events as Record<string, unknown>[]).filter((event) =>
    SNAPSHOT_LIKE_EVENT_TYPES.includes(event.type as string),
  ).length;
  assert.ok(
    snapshotLike < 2160,
    `entity-snapshot-like payloads (${snapshotLike}) must be << 21600 ticks`,
  );

  // Byte budget: the serialized trace stays under 8 MB.
  const serialized = serializeTrace(trace);
  assert.equal(typeof serialized, 'string', 'serializeTrace yields a string');
  assert.ok(
    serialized.length < SIZE_BUDGET_BYTES,
    `serialized trace is ${(serialized.length / 1048576).toFixed(2)} MiB — over the 8 MiB budget`,
  );
  const raw = JSON.stringify(trace);
  assert.ok(
    raw.length < SIZE_BUDGET_BYTES,
    `JSON.stringify(trace) is ${(raw.length / 1048576).toFixed(2)} MiB — over the 8 MiB budget`,
  );
}

try {
  main();
  console.log('forge-trace-size tests: PASS');
} catch (err) {
  console.error('forge-trace-size tests: FAIL', err);
  process.exitCode = 1;
}
