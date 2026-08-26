/**
 * FTR-TESTS RED — deterministic repeat equality (docs/FORGE_TRACE.md §12).
 * runStandardOpening is executed twice with the same seed (24301), same
 * difficulty (standard), same pairing (sunweaver vs gravemark) and a bounded
 * maxTicks (~3600 = 3 simulated minutes) so the test stays fast. The streams
 * carry no wall-clock fields, so nothing is normalized away: events arrays and
 * checkpoint arrays must be deep-equal.
 */
import assert from 'node:assert/strict';

import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening } from '../src/forge-policy';
import { World } from '../src/sim';
import { normalizeMatchConfig } from '../src/match-config';
import type { MatchConfig } from '../src/match-config';

const SEED = 24301;
const MAX_TICKS = 3600; // 3 simulated minutes — bounded for speed.

function runMatch(): {
  events: unknown[];
  checkpoints: unknown[];
  terminalTick: number;
  winner: number;
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
    maxTicks: MAX_TICKS,
  });
  collector.finalize();
  return {
    events: collector.events,
    checkpoints: collector.checkpoints,
    terminalTick: result.terminalTick,
    winner: result.winner,
  };
}

function main(): void {
  const first = runMatch();
  const second = runMatch();

  assert.ok(first.events.length > 100, 'run produced a meaningful event stream');
  assert.equal(first.terminalTick, MAX_TICKS, 'run reached its tick cap');
  assert.equal(second.terminalTick, first.terminalTick, 'terminal tick is deterministic');
  assert.equal(second.winner, first.winner, 'winner is deterministic');

  // No normalization: the streams must be exactly equal (no wall-clock fields exist).
  assert.deepEqual(second.events, first.events, 'same-seed event streams are exactly equal');
  assert.deepEqual(second.checkpoints, first.checkpoints, 'same-seed checkpoint streams are exactly equal');

  const hashes = first.checkpoints as { worldHash: string }[];
  assert.ok(hashes.length > 0, 'run produced checkpoints');
  for (const checkpoint of hashes) {
    assert.match(checkpoint.worldHash, /^[0-9a-f]{8}$/, 'checkpoint hashes are lowercase 8-hex');
  }
}

try {
  main();
  console.log('forge-trace-determinism tests: PASS');
} catch (err) {
  console.error('forge-trace-determinism tests: FAIL', err);
  process.exitCode = 1;
}
