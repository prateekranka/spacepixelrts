#!/usr/bin/env node
/**
 * FTR-SWEEP worker — the real engine behind the Forge Trace CLIs
 * (docs/FORGE_TRACE.md §10).
 *
 * Subcommands:
 *   single <seed> <difficulty> <player> <rival> --out=<dir> [--policy=...] [--fail-on-game-gate]
 *   sweep  --seeds=<csv> --difficulties=<csv> --out=<dir> [--pairings=<csv>] [--fail-on-game-gate]
 *
 * The two thin wrappers (scripts/forge-trace-run.mjs, forge-trace-sweep.mjs)
 * spawn this worker through tsx with the parsed args as a single JSON argv.
 *
 * Exit codes: 0 valid trace with no game-contract failures; 1 valid trace with
 * failures when --fail-on-game-gate; 3 invalid trace / schema violation; 2 tool
 * crash (any thrown harness error).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNG } from 'pngjs';
import { World } from '../src/sim';
import { normalizeMatchConfig } from '../src/match-config';
import type { Difficulty, FactionId, MatchConfig } from '../src/match-config';
import {
  factionToLegacyCiv,
  DEFAULT_CAMERA_PRESET,
  TERMINAL_BY_TICK,
  TICK_HZ,
  DIFFICULTIES,
  CANONICAL_FACTIONS,
  POLICY_IDS,
} from '../src/pacing-contract';
import type { PolicyId } from '../src/pacing-contract';
import { ForgeTraceCollector } from '../src/forge-collector';
import { runStandardOpening, prepareLostScoutRecovery } from '../src/forge-policy';
import { validateTraceFile, serializeTrace } from '../src/forge-schema';
import type { ForgeTraceFile } from '../src/forge-schema';
import { detectMilestones, classifyFailures, firstDivergence } from '../src/forge-diagnostics';
import type { MilestoneReport, FailureClassification } from '../src/forge-diagnostics';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TIMELINE_TEMPLATE = path.join(REPO_ROOT, 'scripts', 'forge-timeline.html');
const VIEWPORT = { width: 1366, height: 1024 };
const DEFAULT_PAIRINGS = ['sunweaver-vs-gravemark', 'gravemark-vs-sunweaver'] as const;

// --- arg plumbing ----------------------------------------------------------------

interface SingleArgs {
  seed: number;
  difficulty: Difficulty;
  player: FactionId;
  rival: FactionId;
  out: string;
  policy: PolicyId;
  failOnGameGate: boolean;
}

interface SweepArgs {
  seeds: number[];
  difficulties: Difficulty[];
  pairings: string[];
  out: string;
  failOnGameGate: boolean;
}

function parseWorkerArgs(argv: string[]): { command: 'single' | 'sweep'; args: Record<string, unknown> } {
  const raw = argv[2];
  if (raw !== undefined && raw.startsWith('{')) {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return { command: parsed.command === 'sweep' ? 'sweep' : 'single', args: parsed };
  }
  // Direct positional form: `worker.mts single <seed> <difficulty> <player> <rival> [--key=value...]`
  const rest = argv.slice(2);
  const command: 'single' | 'sweep' = rest[0] === 'sweep' ? 'sweep' : 'single';
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  for (const token of rest.slice(1)) {
    if (token.startsWith('--')) {
      const equals = token.indexOf('=');
      if (equals >= 0) flags[token.slice(2, equals)] = token.slice(equals + 1);
      else flags[token.slice(2)] = true;
    } else {
      positionals.push(token);
    }
  }
  const args: Record<string, unknown> = { ...flags };
  if (command === 'single') {
    if (positionals[0] !== undefined) args.seed = Number(positionals[0]);
    if (positionals[1] !== undefined) args.difficulty = positionals[1];
    if (positionals[2] !== undefined) args.player = positionals[2];
    if (positionals[3] !== undefined) args.rival = positionals[3];
  }
  return { command, args };
}

function flagValue(value: unknown): boolean {
  return value === true || value === 'true';
}

function coerceSingleArgs(args: Record<string, unknown>): SingleArgs {
  const seed = Number(args.seed);
  if (!Number.isFinite(seed)) throw new Error(`invalid --seed=${String(args.seed)} (expected a finite number)`);
  const difficulty = String(args.difficulty ?? '');
  if (!DIFFICULTIES.includes(difficulty as Difficulty)) {
    throw new Error(`invalid --difficulty=${difficulty} (expected ${DIFFICULTIES.join('|')})`);
  }
  const player = String(args.player ?? '');
  const rival = String(args.rival ?? '');
  if (!CANONICAL_FACTIONS.includes(player as FactionId)) {
    throw new Error(`invalid --player=${player} (expected ${CANONICAL_FACTIONS.join('|')})`);
  }
  if (!CANONICAL_FACTIONS.includes(rival as FactionId)) {
    throw new Error(`invalid --rival=${rival} (expected ${CANONICAL_FACTIONS.join('|')})`);
  }
  if (player === rival) throw new Error('--player and --rival must be different factions');
  if (args.out == null || String(args.out).trim() === '') throw new Error('--out is required');
  const policy = String(args.policy ?? 'standard-opening');
  if (!POLICY_IDS.includes(policy as PolicyId)) {
    throw new Error(`invalid --policy=${policy} (expected ${POLICY_IDS.join('|')})`);
  }
  return {
    seed,
    difficulty: difficulty as Difficulty,
    player: player as FactionId,
    rival: rival as FactionId,
    out: String(args.out),
    policy: policy as PolicyId,
    failOnGameGate: flagValue(args.failOnGameGate),
  };
}

function coerceSweepArgs(args: Record<string, unknown>): SweepArgs {
  const seeds = String(args.seeds ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '')
    .map((s) => Number(s));
  if (seeds.length === 0 || seeds.some((s) => !Number.isFinite(s))) {
    throw new Error(`invalid --seeds=${String(args.seeds)} (expected a CSV of finite numbers)`);
  }
  const difficulties = String(args.difficulties ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
  if (difficulties.length === 0) throw new Error('--difficulties is required');
  for (const d of difficulties) {
    if (!DIFFICULTIES.includes(d as Difficulty)) throw new Error(`invalid --difficulties entry "${d}"`);
  }
  const pairings =
    args.pairings !== undefined && String(args.pairings).trim() !== ''
      ? String(args.pairings)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s !== '')
      : [...DEFAULT_PAIRINGS];
  if (args.out == null || String(args.out).trim() === '') throw new Error('--out is required');
  return {
    seeds,
    difficulties: difficulties as Difficulty[],
    pairings,
    out: String(args.out),
    failOnGameGate: flagValue(args.failOnGameGate),
  };
}

/** Evidence roots must live outside the repository (resolveOut rule, qa-vs5 pattern). */
function resolveOut(raw: string): string {
  if (!path.isAbsolute(raw)) {
    throw new Error('--out must be an absolute path outside the repository');
  }
  const out = path.resolve(raw);
  const relative = path.relative(REPO_ROOT, out);
  if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
    throw new Error(`--out must be outside the repository (${REPO_ROOT})`);
  }
  return out;
}

/** FNV-1a 32-bit identity hash over the policy source marker (Math.imul recipe). */
function policyIdentityHash(policy: PolicyId): string {
  const source = `forge-policy:${policy}:v1`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

// --- single-run core --------------------------------------------------------------

interface SingleCellArgs {
  seed: number;
  difficulty: Difficulty;
  player: FactionId;
  rival: FactionId;
  policy: PolicyId;
}

interface SingleCellResult {
  trace: ForgeTraceFile;
  terminalTick: number;
  winner: FactionId | null;
  maxPositiveGain: [number, number];
}

/**
 * One deterministic match, end to end, in-process. Fresh World + collector per
 * call, so the same args can be run twice for determinism double-runs.
 */
function runSingleCell(args: SingleCellArgs): SingleCellResult {
  const config: MatchConfig = normalizeMatchConfig({
    playerFaction: args.player,
    aiFaction: args.rival,
    map: 'helios-rift',
    difficulty: args.difficulty,
    fogOfWar: true,
    speed: 1,
    tacticalPause: 'enabled',
    seedMode: 'deterministic',
    seed: args.seed,
  });
  const world = new World();
  world.civ[0] = factionToLegacyCiv(args.player);
  world.civ[1] = factionToLegacyCiv(args.rival);
  world.fogOfWarEnabled = true;
  world.aiDifficulty = args.difficulty;
  world.reset(args.seed);
  // Collector is constructed and attached AFTER reset (reset invalidates it).
  const collector = new ForgeTraceCollector(world, {
    config,
    policyId: args.policy,
    camera: DEFAULT_CAMERA_PRESET,
    faultInjectionAllowed: args.policy === 'lost-scout-recovery',
  });
  collector.attach();
  if (args.policy === 'lost-scout-recovery') {
    const injected = prepareLostScoutRecovery(collector, world);
    if (injected.killedEntityId < 0) {
      throw new Error('lost-scout-recovery: no rival scout was killed');
    }
  }
  const result = runStandardOpening(world, {
    seed: args.seed,
    difficulty: args.difficulty,
    playerFaction: args.player,
    rivalFaction: args.rival,
    collector,
    maxTicks: TERMINAL_BY_TICK,
  });
  collector.finalize();

  const winner: FactionId | null = result.winner === 0 ? args.player : result.winner === 1 ? args.rival : null;
  const terminalResult: ForgeTraceFile['terminalResult'] =
    winner === null
      ? { winner: null, tick: result.terminalTick, reason: 'time-cap' }
      : { winner, tick: result.terminalTick, reason: 'core-destroyed' };

  const trace: ForgeTraceFile = {
    schemaVersion: 1,
    tool: 'forge-trace',
    createdAtNote: null,
    matchConfig: config,
    policy: { id: args.policy, identityHash: policyIdentityHash(args.policy) },
    tickHz: 20,
    playerFaction: args.player,
    rivalFaction: args.rival,
    terminalResult,
    checkpoints: collector.checkpoints,
    events: collector.events,
  };
  return {
    trace,
    terminalTick: result.terminalTick,
    winner,
    maxPositiveGain: [collector.maxPositiveStepGain(0), collector.maxPositiveStepGain(1)],
  };
}

function analyzeCell(cell: SingleCellResult): {
  milestones: MilestoneReport;
  classifications: FailureClassification[];
} {
  const milestones = detectMilestones(cell.trace.events);
  const classifications = classifyFailures(cell.trace, milestones, { maxPositiveGain: cell.maxPositiveGain });
  return { milestones, classifications };
}

// --- timeline artifacts (FTR-UI template + best-effort PNG) ----------------------

/** Copy the sibling FTR-UI template, substituting the embedded data placeholder. */
function renderTimelineHtml(trace: ForgeTraceFile, toolErrors: string[]): string | null {
  if (!fs.existsSync(TIMELINE_TEMPLATE)) {
    toolErrors.push('timeline.html: sibling template scripts/forge-timeline.html not found (FTR-UI not landed)');
    return null;
  }
  const template = fs.readFileSync(TIMELINE_TEMPLATE, 'utf8');
  const token = '__FORGE_TRACE_DATA__';
  if (!template.includes(token)) {
    toolErrors.push('timeline.html: template is missing the __FORGE_TRACE_DATA__ placeholder');
    return null;
  }
  const embedded = JSON.stringify(trace).replace(/</g, '\\u003c');
  // The landed FTR-UI template assigns the placeholder as
  // `window.__FORGE_TRACE_DATA__=/*__FORGE_TRACE_DATA__*/null;` — replace the
  // whole assignment so the JSON becomes the value expression. Fall back to a
  // bare `__FORGE_TRACE_DATA__ = null` assignment, then to the standalone token.
  const assignmentPattern = /__FORGE_TRACE_DATA__\s*=\s*(?:\/\*\s*__FORGE_TRACE_DATA__\s*\*\/\s*)?null/;
  if (assignmentPattern.test(template)) {
    return template.replace(assignmentPattern, `__FORGE_TRACE_DATA__=${embedded}`);
  }
  const standalone = /(^|[^A-Za-z0-9_])__FORGE_TRACE_DATA__([^A-Za-z0-9_]|$)/;
  if (standalone.test(template)) {
    return template.replace(standalone, `$1${embedded}$2`);
  }
  toolErrors.push('timeline.html: __FORGE_TRACE_DATA__ placeholder is not in a substitutable position');
  return null;
}

/** Screenshot the timeline with playwright chromium; nonblank check via pngjs. */
async function renderTimelinePng(htmlFile: string, outDir: string, toolErrors: string[]): Promise<boolean> {
  const pngFile = path.join(outDir, 'timeline.png');
  let browser: Awaited<ReturnType<typeof import('playwright').chromium.launch>> | null = null;
  try {
    const { chromium } = await import('playwright');
    browser = await chromium
      .launch({ channel: 'chrome', headless: true })
      .catch(() => chromium.launch({ headless: true, executablePath: '/usr/bin/chromium' }));
    const page = await browser.newPage({ viewport: VIEWPORT });
    await page.goto(`file://${htmlFile}`, { waitUntil: 'load' });
    await new Promise((resolve) => setTimeout(resolve, 800));
    await page.screenshot({ path: pngFile, type: 'png' });
    await browser.close();
    browser = null;
    const png = PNG.sync.read(fs.readFileSync(pngFile));
    let maxLuma = 0;
    let lit = 0;
    let samples = 0;
    for (let index = 0; index < png.data.length; index += 28) {
      const luma = 0.2126 * png.data[index] + 0.7152 * png.data[index + 1] + 0.0722 * png.data[index + 2];
      maxLuma = Math.max(maxLuma, luma);
      if (luma > 10) lit++;
      samples++;
    }
    const litRatio = samples > 0 ? lit / samples : 0;
    if (!(maxLuma > 6 && litRatio >= 0.002)) {
      toolErrors.push(`timeline.png: blank or empty (maxLuma=${maxLuma.toFixed(2)}, litRatio=${litRatio.toFixed(4)})`);
      return false;
    }
    return true;
  } catch (error) {
    toolErrors.push(`timeline.png: render failed: ${error instanceof Error ? error.message : String(error)}`);
    return false;
  } finally {
    if (browser !== null) {
      try {
        await browser.close();
      } catch {
        // already gone
      }
    }
  }
}

// --- single command ---------------------------------------------------------------

async function cmdSingle(args: SingleArgs): Promise<number> {
  const out = resolveOut(args.out);
  const startedAt = new Date().toISOString();
  const toolErrors: string[] = [];
  const policy = args.policy;

  const cell = runSingleCell({ seed: args.seed, difficulty: args.difficulty, player: args.player, rival: args.rival, policy });
  const { milestones, classifications } = analyzeCell(cell);

  const validation = validateTraceFile(cell.trace);
  if (!validation.valid) {
    console.error(`forge-trace: invalid trace (${validation.errors.length} schema errors)`);
    for (const error of validation.errors) console.error(`  - ${error}`);
    return 3;
  }

  fs.mkdirSync(out, { recursive: true });
  const traceJson = serializeTrace(cell.trace);
  const artifactFiles: { name: string; bytes: number }[] = [];
  const writeArtifact = (name: string, content: string): void => {
    const file = path.join(out, name);
    fs.writeFileSync(file, content);
    artifactFiles.push({ name, bytes: fs.statSync(file).size });
  };

  writeArtifact('trace.json', traceJson);
  writeArtifact('events.ndjson', `${cell.trace.events.map((e) => JSON.stringify(e)).join('\n')}\n`);

  let timelineHtml: string | null = null;
  try {
    timelineHtml = renderTimelineHtml(cell.trace, toolErrors);
  } catch (error) {
    toolErrors.push(`timeline.html: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (timelineHtml !== null) {
    writeArtifact('timeline.html', timelineHtml);
    const pngWritten = await renderTimelinePng(path.join(out, 'timeline.html'), out, toolErrors);
    if (pngWritten) {
      artifactFiles.push({ name: 'timeline.png', bytes: fs.statSync(path.join(out, 'timeline.png')).size });
    }
  }

  const summary = {
    milestones,
    classifications,
    ok: classifications.length === 0,
    gameGateFailures: classifications.length,
    toolErrors,
  };
  writeArtifact('summary.json', `${JSON.stringify(summary, null, 2)}\n`);

  const manifest = {
    tool: 'forge-trace',
    startedAt,
    finishedAt: new Date().toISOString(),
    nodeVersion: process.version,
    args: {
      seed: args.seed,
      difficulty: args.difficulty,
      player: args.player,
      rival: args.rival,
      out,
      policy,
      failOnGameGate: args.failOnGameGate,
    },
    artifactFiles,
    traceStats: {
      eventCount: cell.trace.events.length,
      checkpointCount: cell.trace.checkpoints.length,
      sizeBytes: Buffer.byteLength(traceJson, 'utf8'),
    },
    consoleClean: true,
  };
  writeArtifact('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);

  const winnerLabel = cell.winner ?? 'none';
  console.log(
    `forge-trace: seed=${args.seed} difficulty=${args.difficulty} pairing=${args.player}-vs-${args.rival} ` +
      `policy=${policy} tick=${cell.terminalTick} winner=${winnerLabel} events=${cell.trace.events.length} ` +
      `checkpoints=${cell.trace.checkpoints.length} failures=${classifications.length} -> ${out}`,
  );
  for (const c of classifications) console.log(`  [${c.severity}] ${c.id} @${c.firstTick}: ${c.evidence}`);
  for (const error of toolErrors) console.error(`  [tool] ${error}`);

  return args.failOnGameGate && classifications.length > 0 ? 1 : 0;
}

// --- sweep command ----------------------------------------------------------------

interface SweepCell {
  seed: number;
  difficulty: Difficulty;
  pairing: string;
  player: FactionId;
  rival: FactionId;
  terminalTick: number;
  winner: FactionId | null;
  eventCount: number;
  failures: number;
  ok: boolean;
  milestones: MilestoneReport;
  classifications: FailureClassification[];
  trace: ForgeTraceFile;
}

function cmdSweep(args: SweepArgs): number {
  const out = resolveOut(args.out);
  fs.mkdirSync(out, { recursive: true });
  const cells: SweepCell[] = [];
  let anyFailure = false;

  for (const pairing of args.pairings) {
    const parts = pairing.split('-vs-');
    const player = parts[0] as FactionId;
    const rival = parts[1] as FactionId;
    if (!CANONICAL_FACTIONS.includes(player) || !CANONICAL_FACTIONS.includes(rival) || player === rival) {
      throw new Error(`invalid pairing "${pairing}" (expected <faction>-vs-<faction>)`);
    }
    for (const difficulty of args.difficulties) {
      for (const seed of args.seeds) {
        const label = `seed=${seed} difficulty=${difficulty} pairing=${pairing}`;
        try {
          const cell = runSingleCell({ seed, difficulty, player, rival, policy: 'standard-opening' });
          const { milestones, classifications } = analyzeCell(cell);
          const validation = validateTraceFile(cell.trace);
          if (!validation.valid) {
            console.error(`[sweep] ${label}: INVALID TRACE (${validation.errors.length} schema errors)`);
            for (const error of validation.errors) console.error(`  - ${error}`);
            return 3;
          }
          const winner = cell.winner ?? 'none';
          console.log(
            `[sweep] ${label} tick=${cell.terminalTick} winner=${winner} events=${cell.trace.events.length} failures=${classifications.length}`,
          );
          cells.push({
            seed,
            difficulty,
            pairing,
            player,
            rival,
            terminalTick: cell.terminalTick,
            winner: cell.winner,
            eventCount: cell.trace.events.length,
            failures: classifications.length,
            ok: classifications.length === 0,
            milestones,
            classifications,
            trace: cell.trace,
          });
          if (classifications.length > 0) anyFailure = true;
        } catch (error) {
          console.error(`[sweep] ${label}: TOOL ERROR: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
          return 2;
        }
      }
    }
  }

  // Cross-run first divergence per (pairing, difficulty) group: the first
  // passing cell is the reference; every failing cell is compared against it.
  const divergences: {
    pairing: string;
    difficulty: Difficulty;
    passingSeed: number | null;
    divergences: { seed: number; divergence: ReturnType<typeof firstDivergence> }[];
  }[] = [];
  for (const pairing of args.pairings) {
    for (const difficulty of args.difficulties) {
      const group = cells.filter((c) => c.pairing === pairing && c.difficulty === difficulty);
      const passing = group.find((c) => c.failures === 0) ?? null;
      const entries: { seed: number; divergence: ReturnType<typeof firstDivergence> }[] = [];
      if (passing !== null) {
        for (const failing of group) {
          if (failing.failures === 0) continue;
          entries.push({ seed: failing.seed, divergence: firstDivergence(passing.trace, failing.trace) });
        }
      }
      divergences.push({ pairing, difficulty, passingSeed: passing?.seed ?? null, divergences: entries });
    }
  }

  const cellRecord = (c: SweepCell) => ({
    seed: c.seed,
    difficulty: c.difficulty,
    pairing: c.pairing,
    terminalTick: c.terminalTick,
    winner: c.winner,
    eventCount: c.eventCount,
    failures: c.failures,
    ok: c.ok,
    milestones: c.milestones,
    classifications: c.classifications.map((x) => ({
      id: x.id,
      firstTick: x.firstTick,
      severity: x.severity,
      evidence: x.evidence,
    })),
  });

  const sweepJson = {
    tool: 'forge-trace',
    sweep: { seeds: args.seeds, difficulties: args.difficulties, pairings: args.pairings, failOnGameGate: args.failOnGameGate, out },
    cells: cells.map(cellRecord),
    divergences,
  };
  fs.writeFileSync(path.join(out, 'sweep.json'), `${JSON.stringify(sweepJson, null, 2)}\n`);

  const csvLines = ['seed,difficulty,pairing,terminalTick,winner,eventCount,failures,ok'];
  for (const c of cells) {
    csvLines.push(`${c.seed},${c.difficulty},${c.pairing},${c.terminalTick},${c.winner ?? 'none'},${c.eventCount},${c.failures},${c.ok}`);
  }
  fs.writeFileSync(path.join(out, 'sweep.csv'), `${csvLines.join('\n')}\n`);

  const failuresJson = {
    tool: 'forge-trace',
    failures: cells.filter((c) => c.failures > 0).map(cellRecord),
  };
  fs.writeFileSync(path.join(out, 'failures.json'), `${JSON.stringify(failuresJson, null, 2)}\n`);

  fs.writeFileSync(path.join(out, 'divergences.json'), `${JSON.stringify(divergences, null, 2)}\n`);

  const rows = cells
    .map((c) => {
      const cls = c.ok ? 'ok' : 'fail';
      const badge = c.ok ? 'ok' : 'FAIL';
      return (
        `<tr class="${cls}"><td>${c.seed}</td><td>${c.difficulty}</td><td>${c.pairing}</td>` +
        `<td>${c.terminalTick}</td><td>${c.winner ?? 'none'}</td><td>${c.eventCount}</td>` +
        `<td>${c.failures}</td><td class="${cls}-badge">${badge}</td></tr>`
      );
    })
    .join('\n');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Forge Trace Sweep Summary</title>
<style>
  body { background:#0d1117; color:#c9d1d9; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 2rem; }
  h1 { color:#e6edf3; font-size: 1.15rem; letter-spacing: 0.02em; }
  p.meta { color:#8b949e; font-size: 0.8rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #30363d; padding: 0.45rem 0.7rem; text-align: left; font-size: 0.85rem; }
  th { background:#161b22; color:#8b949e; font-weight: 600; }
  tr.ok td { background:#10241a; }
  tr.fail td { background:#2d1517; }
  .ok-badge { color:#3fb950; font-weight: 700; }
  .fail-badge { color:#f85149; font-weight: 700; }
</style></head>
<body>
<h1>Forge Trace Sweep Summary</h1>
<p class="meta">seeds [${args.seeds.join(', ')}] &times; difficulties [${args.difficulties.join(', ')}] &times; pairings [${args.pairings.join(', ')}] &mdash; ${cells.length} cells</p>
<table>
<thead><tr><th>seed</th><th>difficulty</th><th>pairing</th><th>terminalTick</th><th>winner</th><th>eventCount</th><th>failures</th><th>ok</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body></html>
`;
  fs.writeFileSync(path.join(out, 'sweep-summary.html'), html);

  console.log(`[sweep] wrote ${cells.length} cells to ${out} (${cells.filter((c) => c.ok).length} ok, ${cells.filter((c) => !c.ok).length} failing)`);
  return args.failOnGameGate && anyFailure ? 1 : 0;
}

// --- entry ------------------------------------------------------------------------

async function main(argv: string[]): Promise<number> {
  const parsed = parseWorkerArgs(argv);
  if (parsed.command === 'sweep') return cmdSweep(coerceSweepArgs(parsed.args));
  return cmdSingle(coerceSingleArgs(parsed.args));
}

main(process.argv).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error(`forge-trace: tool error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    process.exitCode = 2;
  },
);
