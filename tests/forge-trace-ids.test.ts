/**
 * FTR-TESTS RED — canonical IDs only in serialized output (docs/FORGE_TRACE.md §5).
 * A short real seeded match (seed 24301, standard, sunweaver vs gravemark) is
 * recorded through the collector + policy, serialized via serializeTrace, and
 * the JSON string must contain zero legacy identifiers (vespari/aurion/
 * voidmarked/Nihiline) while the canonical ids appear in every place the
 * contract fixes them.
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening } from '../src/forge-policy';
import { serializeTrace, validateTraceFile } from '../src/forge-schema';
import { World } from '../src/sim';
import { normalizeMatchConfig } from '../src/match-config';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const MAX_TICKS = 1200; // 1 simulated minute — short but real.

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

function runMatch(): {
  world: World;
  collector: ForgeTraceCollector;
  terminalTick: number;
  winner: number;
  config: MatchConfig;
} {
  const config = makeConfig();
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
  return { world, collector, terminalTick: result.terminalTick, winner: result.winner, config };
}

function assembleTrace(run: ReturnType<typeof runMatch>): Record<string, unknown> {
  const winnerFaction: string | null =
    run.winner === -1 ? null : run.winner === 0 ? 'sunweaver' : 'gravemark';
  return {
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
    checkpoints: run.collector.checkpoints,
    events: run.collector.events,
  };
}

function main(): void {
  const run = runMatch();
  assert.ok(run.collector.events.length > 10, 'short match produced a real event stream');
  assert.equal(run.terminalTick, MAX_TICKS, 'short run reached its tick cap');

  const trace = assembleTrace(run);
  assert.deepEqual(validateTraceFile(trace), { valid: true }, 'collected trace validates as a whole');

  const json = serializeTrace(trace);
  assert.equal(typeof json, 'string', 'serializeTrace yields a string');

  // Legacy identifiers must appear NOWHERE in serialized output.
  assert.doesNotMatch(json, /vespari|aurion|voidmarked|Nihiline/, 'no legacy ids in serialized trace');

  // Canonical ids appear where the contract fixes them.
  const parsed = JSON.parse(json) as Record<string, unknown>;
  const matchConfig = parsed.matchConfig as Record<string, unknown>;
  assert.equal(matchConfig.playerFaction, 'sunweaver', 'matchConfig.playerFaction is canonical');
  assert.equal(matchConfig.aiFaction, 'gravemark', 'matchConfig.aiFaction is canonical');
  assert.equal(matchConfig.map, 'helios-rift', 'matchConfig.map is the canonical map');
  assert.equal(parsed.playerFaction, 'sunweaver', 'top-level playerFaction is canonical');
  assert.equal(parsed.rivalFaction, 'gravemark', 'top-level rivalFaction is canonical');
  assert.equal((parsed.policy as Record<string, unknown>).id, 'standard-opening', 'policy id is canonical');

  const events = parsed.events as Record<string, unknown>[];
  for (const event of events) {
    assert.ok(
      event.team === null || event.team === 'sunweaver' || event.team === 'gravemark',
      `event team ${String(event.team)} is canonical`,
    );
  }
  assert.ok(events.some((e) => e.type === 'match-start'), 'trace opens with match-start');
  assert.ok(events.some((e) => e.type === 'placement-attempt'), 'trace records the opening placement');
  assert.ok(events.some((e) => e.type === 'resource-sample'), 'trace records resource samples');
  const frameRefs = events.map((e) => e.frameRef as Record<string, unknown>);
  for (const frame of frameRefs) {
    assert.equal((frame.config as Record<string, unknown>).playerFaction, 'sunweaver', 'frameRef config is canonical');
  }
}

try {
  main();
  console.log('forge-trace-ids tests: PASS');
} catch (err) {
  console.error('forge-trace-ids tests: FAIL', err);
  process.exitCode = 1;
}
