/**
 * FTR-SWEEP — pacing diagnostics for Forge Trace (docs/FORGE_TRACE.md §9).
 *
 * Pure functions over the frozen trace/event shapes: milestone detection with
 * pacing-contract deadlines, game-contract failure classification, and
 * cross-run first-divergence analysis. No World access, no RNG, no wall-clock.
 *
 * Payload tolerances: event payloads carry canonical kind names ('yard',
 * 'core', 'fighter', 'ravager', 'prism', ...) per docs/FORGE_TRACE.md §5;
 * where a sibling collector serializes a numeric kind ordinal instead, the
 * canonical adapter (src/pacing-contract.ts KIND_NAMES) resolves it. The
 * combat-engagement payload convention is { attackerId, victimId, damage,
 * targetKind, targetTeam, coreDiscoveredAtIssue } with targetTeam as a
 * 'player'|'rival' perspective label (canonical faction ids also accepted).
 */

import { Kind, TICK_HZ } from './engine';
import { STATS } from './content';
import type { FactionId } from './match-config';
import {
  PATH_LOCK_BY_TICK,
  MIXED_PAIR_BY_TICK,
  TERMINAL_BY_TICK,
  AI_PATH_WINDOW_TICKS,
  AI_ATTACK_WINDOW_TICKS,
  ATTACK_FLOOR_TICK,
  HONEST_STEP_GAIN_BOUND,
  STARVATION_WINDOW_TICKS,
  IDLE_PRODUCTION_WINDOW_TICKS,
  REJECTED_CALL_BURST,
  REJECTED_CALL_WINDOW_TICKS,
  MILESTONE_IDS,
  KIND_NAMES,
  kindName,
  uniqueUnitFor,
} from './pacing-contract';
import type { MilestoneId, FailureClassificationId } from './pacing-contract';
import type { ForgeTraceFile, ForgeTraceEvent } from './forge-schema';

export interface MilestoneReport {
  reached: { id: MilestoneId; tick: number }[];
  missed: { id: MilestoneId; deadlineTick: number }[];
}

export interface FailureClassification {
  id: FailureClassificationId;
  firstTick: number;
  evidence: string;
  severity: 'warning' | 'failure';
}

/** Optional per-run observations the collector measured but did not serialize. */
export interface FailureObservations {
  maxPositiveGain?: [number, number];
}

export interface DivergenceReport {
  earliestDivergingTick: number;
  priorCommonMilestone: MilestoneId | null;
  expectedNextMilestone: MilestoneId | null;
  actualEvent: string;
  resourcesAtDivergence: { ore: number; gas: number; energy: number; pop: number } | null;
  worldHashPassing: string | null;
  worldHashFailed: string | null;
  likelyCategory: FailureClassificationId | 'undetermined';
  note: 'diagnostic evidence - correlation not causation';
}

// --- Payload access (tolerant to sibling collector key choices) --------------

const KIND_ALIASES: Record<string, string> = {
  worker: 'worker',
  scout: 'scout',
  fighter: 'fighter',
  ravager: 'ravager',
  prism: 'prism',
  siege: 'siege',
  shade: 'shade',
  core: 'core',
  hall: 'core',
  habitat: 'habitat',
  house: 'habitat',
  yard: 'yard',
  barracks: 'yard',
  'resource-node': 'resource-node',
};

/** Canonical kind name from a payload (string name or numeric ordinal), or null. */
function payloadKind(payload: Record<string, unknown>): string | null {
  for (const key of ['kind', 'kindName', 'unitKind', 'buildingKind', 'structureKind']) {
    const value = payload[key];
    if (typeof value === 'string') {
      const alias = KIND_ALIASES[value.trim().toLowerCase()];
      if (alias !== undefined) return alias;
    } else if (typeof value === 'number') {
      const name = KIND_NAMES[value];
      if (name !== undefined) return name;
    }
  }
  return null;
}

function payloadString(payload: Record<string, unknown>, key: string): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function payloadNumber(payload: Record<string, unknown>, key: string): number | null {
  const value = payload[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function payloadBool(payload: Record<string, unknown>, key: string): boolean | null {
  const value = payload[key];
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function payloadOk(payload: Record<string, unknown>): boolean {
  return payloadBool(payload, 'ok') === true;
}

/** targetTeam payload values use 'player'|'rival' perspective labels; canonical ids also accepted. */
function isPlayerSide(value: unknown, player: FactionId): boolean {
  return value === 'player' || value === player;
}

function isRivalSide(value: unknown, rival: FactionId): boolean {
  return value === 'rival' || value === rival;
}

/** Faction resolution: frameRef.config is schema-required on every event (docs/FORGE_TRACE.md §5). */
function factionOf(events: ForgeTraceEvent[], key: 'playerFaction' | 'aiFaction'): FactionId | null {
  for (const event of events) {
    const config = event.frameRef?.config;
    if (config !== undefined && config !== null) {
      const value = config[key];
      if (value === 'sunweaver' || value === 'gravemark') return value;
    }
  }
  return null;
}

function playerFactionOf(events: ForgeTraceEvent[]): FactionId {
  const fromConfig = factionOf(events, 'playerFaction');
  if (fromConfig !== null) return fromConfig;
  for (const event of events) {
    if (event.type === 'match-start') {
      const value = (event.payload ?? {})['playerFaction'];
      if (value === 'sunweaver' || value === 'gravemark') return value;
    }
  }
  return 'sunweaver'; // documented fallback; unreachable for schema-valid traces
}

function rivalFactionOf(events: ForgeTraceEvent[], player: FactionId): FactionId {
  const fromConfig = factionOf(events, 'aiFaction');
  if (fromConfig !== null) return fromConfig;
  for (const event of events) {
    if (event.type === 'match-start') {
      const value = (event.payload ?? {})['aiFaction'];
      if (value === 'sunweaver' || value === 'gravemark') return value;
    }
  }
  return player === 'sunweaver' ? 'gravemark' : 'sunweaver';
}

// --- Milestone detection -------------------------------------------------------

/** One-sided deadlines: fired late (or never fired by the deadline) => missed. */
const DEADLINE_SPECS: readonly { id: MilestoneId; deadline: number }[] = [
  { id: 'path-locked', deadline: PATH_LOCK_BY_TICK },
  { id: 'mixed-pair-ready', deadline: MIXED_PAIR_BY_TICK },
  { id: 'terminal', deadline: TERMINAL_BY_TICK },
  { id: 'ai-force-ready', deadline: AI_ATTACK_WINDOW_TICKS[0] },
];

export function detectMilestones(events: ForgeTraceEvent[]): MilestoneReport {
  const reached: { id: MilestoneId; tick: number }[] = [];
  if (events.length === 0) return { reached, missed: [] };

  const player = playerFactionOf(events);
  const rival = rivalFactionOf(events, player);
  const fired = new Set<MilestoneId>();
  const fire = (id: MilestoneId, tick: number): void => {
    if (fired.has(id)) return;
    fired.add(id);
    reached.push({ id, tick });
  };

  // Alive-count tracking for fighter/unique milestones (completions minus deaths).
  const alive = { player: { fighter: 0, unique: 0 }, rival: { fighter: 0, unique: 0 } };
  const trackUnit = (team: FactionId | null, kind: string | null, delta: 1 | -1): void => {
    if (kind === null) return;
    const bucket = team === player ? alive.player : team === rival ? alive.rival : null;
    if (bucket === null) return;
    if (kind === 'fighter') bucket.fighter = Math.max(0, bucket.fighter + delta);
    else if (kind === 'ravager' || kind === 'prism') bucket.unique = Math.max(0, bucket.unique + delta);
  };

  for (const event of events) {
    const team = event.team;
    const payload = event.payload ?? {};
    switch (event.type) {
      case 'match-start':
        fire('match-start', event.tick);
        break;
      case 'placement-attempt':
        if (payloadOk(payload) && payloadKind(payload) === 'yard') {
          if (team === player) fire('yard-placed', event.tick);
          else if (team === rival) fire('ai-yard-placed', event.tick);
        }
        break;
      case 'construction-complete':
        if (team === player && payloadKind(payload) === 'yard') fire('yard-complete', event.tick);
        break;
      case 'path-commit-attempt':
        if (payloadOk(payload)) {
          if (team === player) fire('path-committed', event.tick);
          else if (team === rival) fire('ai-path-committed', event.tick);
        }
        break;
      case 'technology-path-lock':
        if (team === player) fire('path-locked', event.tick);
        break;
      case 'unit-completion': {
        const kind = payloadKind(payload);
        trackUnit(team, kind, 1);
        if (team === player && alive.player.fighter >= 1 && alive.player.unique >= 1) {
          fire('mixed-pair-ready', event.tick);
        }
        if (team === rival && alive.rival.fighter >= 2 && alive.rival.unique >= 2) {
          fire('ai-force-ready', event.tick);
        }
        break;
      }
      case 'unit-death':
        trackUnit(team, payloadKind(payload), -1);
        break;
      case 'landmark-discovery': {
        const landmark =
          payloadString(payload, 'what') ?? payloadString(payload, 'landmarkId') ?? payloadString(payload, 'landmark');
        if (landmark === 'central-lumen-field' && (team === player || team === null)) {
          fire('lumen-discovered', event.tick);
        }
        break;
      }
      case 'lumen-owner-change':
        if (team === player) fire('lumen-captured', event.tick);
        break;
      case 'entity-discovery': {
        const what = payloadString(payload, 'what') ?? payloadString(payload, 'kind');
        if (what === 'core' || what === 'hall') {
          if (team === player) fire('rival-core-discovered', event.tick);
          else if (team === rival) fire('ai-core-discovery', event.tick);
        }
        break;
      }
      case 'combat-engagement': {
        const targetKind = payloadString(payload, 'targetKind');
        const targetTeam = payloadString(payload, 'targetTeam');
        if (targetKind === 'core' && isRivalSide(targetTeam, rival)) {
          fire('first-core-attack', event.tick);
        }
        break;
      }
      case 'match-terminal':
        fire('terminal', event.tick);
        break;
      default:
        break;
    }
  }

  const missed: { id: MilestoneId; deadlineTick: number }[] = [];
  const reachedTick = new Map<MilestoneId, number>(reached.map((m) => [m.id, m.tick]));
  // A milestone is "missed" only when it FIRED outside its deadline/window —
  // never-fired milestones are not presumed late on partial synthetic traces.
  for (const spec of DEADLINE_SPECS) {
    const tick = reachedTick.get(spec.id);
    if (tick !== undefined && tick > spec.deadline) {
      missed.push({ id: spec.id, deadlineTick: spec.deadline });
    }
  }
  const aiPathTick = reachedTick.get('ai-path-committed');
  if (aiPathTick !== undefined && (aiPathTick < AI_PATH_WINDOW_TICKS[0] || aiPathTick > AI_PATH_WINDOW_TICKS[1])) {
    missed.push({ id: 'ai-path-committed', deadlineTick: AI_PATH_WINDOW_TICKS[1] });
  }

  return { reached, missed };
}

// --- Failure classification ------------------------------------------------------

const UNIT_SPECS: Record<string, { ore: number; gas: number; energy: number; pop: number }> = {
  fighter: {
    ore: STATS[Kind.Fighter].ore,
    gas: STATS[Kind.Fighter].gas,
    energy: STATS[Kind.Fighter].energy,
    pop: STATS[Kind.Fighter].pop,
  },
  ravager: {
    ore: STATS[Kind.Ravager].ore,
    gas: STATS[Kind.Ravager].gas,
    energy: STATS[Kind.Ravager].energy,
    pop: STATS[Kind.Ravager].pop,
  },
  prism: {
    ore: STATS[Kind.Prism].ore,
    gas: STATS[Kind.Prism].gas,
    energy: STATS[Kind.Prism].energy,
    pop: STATS[Kind.Prism].pop,
  },
};

export function classifyFailures(
  trace: ForgeTraceFile,
  milestones: MilestoneReport,
  observations?: FailureObservations,
): FailureClassification[] {
  const failures: FailureClassification[] = [];
  const events = trace.events;
  const player = trace.playerFaction;
  const rival = trace.rivalFaction;
  const endTick = trace.terminalResult?.tick ?? events[events.length - 1]?.tick ?? 0;
  const reachedTick = new Map<MilestoneId, number>(milestones.reached.map((m) => [m.id, m.tick]));

  // 1. deadline-miss — any pacing deadline from the contract was not met.
  if (milestones.missed.length > 0) {
    failures.push({
      id: 'deadline-miss',
      firstTick: Math.min(...milestones.missed.map((m) => m.deadlineTick)),
      evidence: `missed pacing deadlines: ${milestones.missed
        .map((m) => `${m.id} (by tick ${m.deadlineTick})`)
        .join(', ')}`,
      severity: 'failure',
    });
  }

  // 2. starvation — >= STARVATION_WINDOW_TICKS with no positive resource delta
  //    while a cost-funded opening milestone is still pending.
  const starvationRun = (team: FactionId, pendingUntil: number): FailureClassification | null => {
    const samples = events.filter((e) => e.type === 'resource-sample' && e.team === team);
    let runStart: number | null = null;
    let prev: { ore: number; gas: number; energy: number; tick: number } | null = null;
    for (const sample of samples) {
      if (sample.tick > pendingUntil) break;
      const ore = payloadNumber(sample.payload, 'ore');
      const gas = payloadNumber(sample.payload, 'gas');
      const energy = payloadNumber(sample.payload, 'energy');
      if (ore === null || gas === null || energy === null) {
        prev = null;
        runStart = null;
        continue;
      }
      if (prev === null) {
        prev = { ore, gas, energy, tick: sample.tick };
        runStart = sample.tick;
        continue;
      }
      if (sample.tick - prev.tick > 40) {
        // cadence gap (missing samples) — treat as a fresh window
        prev = { ore, gas, energy, tick: sample.tick };
        runStart = sample.tick;
        continue;
      }
      const positive = ore > prev.ore || gas > prev.gas || energy > prev.energy;
      if (positive) {
        runStart = sample.tick;
      } else if (sample.tick - (runStart ?? sample.tick) >= STARVATION_WINDOW_TICKS) {
        return {
          id: 'starvation',
          firstTick: runStart ?? sample.tick,
          evidence: `${team} had no resource income for ${sample.tick - (runStart ?? sample.tick)} ticks (${
            runStart ?? sample.tick
          }..${sample.tick}) while a cost-funded milestone was pending`,
          severity: 'warning',
        };
      }
      prev = { ore, gas, energy, tick: sample.tick };
    }
    return null;
  };
  for (const team of [player, rival]) {
    const pendingUntil = reachedTick.get(team === player ? 'mixed-pair-ready' : 'ai-force-ready') ?? endTick;
    const hit = starvationRun(team, pendingUntil);
    if (hit !== null) failures.push(hit);
  }

  // 3. idle-production — >= IDLE_PRODUCTION_WINDOW_TICKS with the required next
  //    unit affordable, pop capacity available, and the producer idle.
  const busyWindows = (team: FactionId): { start: number; end: number }[] => {
    const windows: { start: number; end: number }[] = [];
    for (const e of events) {
      if (e.type !== 'training-start' || e.team !== team) continue;
      const trainT = payloadNumber(e.payload, 'trainT');
      windows.push({ start: e.tick, end: trainT === null ? e.tick + 1 : e.tick + trainT * TICK_HZ });
    }
    return windows;
  };
  // A nonexistent producer cannot be "idle": the phase may only open once the
  // team's production building (Yard) has finished construction.
  const producerReadyTick = (team: FactionId): number | null => {
    let ready: number | null = null;
    for (const e of events) {
      if (e.type !== 'construction-complete' || e.team !== team) continue;
      if (payloadKind(e.payload) !== 'yard') continue;
      ready = ready === null ? e.tick : Math.min(ready, e.tick);
    }
    return ready;
  };
  const completionTicks = (team: FactionId, unit: string): number[] =>
    events
      .filter((e) => e.type === 'unit-completion' && e.team === team && payloadKind(e.payload) === unit)
      .map((e) => e.tick);
  const idleProductionRun = (
    team: FactionId,
    unit: string,
    phaseStart: number,
    phaseEnd: number,
    busy: { start: number; end: number }[],
  ): FailureClassification | null => {
    const spec = UNIT_SPECS[unit];
    if (spec === undefined) return null;
    const samples = events.filter((e) => e.type === 'resource-sample' && e.team === team);
    const popSamples = events.filter((e) => e.type === 'population-sample' && e.team === team);
    const popAt = (tick: number): { pop: number; cap: number } | null => {
      let best: { pop: number; cap: number } | null = null;
      for (const s of popSamples) {
        if (s.tick > tick) break;
        const pop = payloadNumber(s.payload, 'pop');
        const cap = payloadNumber(s.payload, 'cap');
        if (pop !== null && cap !== null) best = { pop, cap };
      }
      return best;
    };
    const busyAt = (tick: number): boolean => busy.some((w) => tick >= w.start && tick <= w.end);
    let runStart: number | null = null;
    for (const sample of samples) {
      if (sample.tick < phaseStart) continue;
      if (sample.tick >= phaseEnd) break;
      const ore = payloadNumber(sample.payload, 'ore');
      const gas = payloadNumber(sample.payload, 'gas');
      const energy = payloadNumber(sample.payload, 'energy');
      const popState = popAt(sample.tick);
      if (ore === null || gas === null || energy === null || popState === null) {
        runStart = null;
        continue;
      }
      const affordable = ore >= spec.ore && gas >= spec.gas;
      const capacity = popState.pop + spec.pop <= popState.cap;
      const idle = !busyAt(sample.tick);
      if (affordable && capacity && idle) {
        if (runStart === null) runStart = sample.tick;
        else if (sample.tick - runStart >= IDLE_PRODUCTION_WINDOW_TICKS) {
          return {
            id: 'idle-production',
            firstTick: runStart,
            evidence: `${team} produced no ${unit} for ${sample.tick - runStart} ticks (${runStart}..${
              sample.tick
            }) while it was affordable, pop capacity existed, and the producer was idle`,
            severity: 'warning',
          };
        }
      } else {
        runStart = null;
      }
    }
    return null;
  };
  for (const team of [player, rival]) {
    const unique = kindName(uniqueUnitFor(team));
    const phases =
      team === player
        ? [
            { unit: 'fighter', count: 1 },
            { unit: unique, count: 1 },
          ]
        : [
            { unit: 'fighter', count: 2 },
            { unit: unique, count: 2 },
          ];
    const busy = busyWindows(team);
    // The idle-production phase may not start before the team's Yard exists.
    const producerReady = producerReadyTick(team);
    if (producerReady === null) continue; // no producer ever built: other gates cover this
    let phaseStart = producerReady;
    for (const phase of phases) {
      const completions = completionTicks(team, phase.unit);
      const phaseEnd = completions.length >= phase.count ? completions[phase.count - 1] : endTick;
      const hit = idleProductionRun(team, phase.unit, phaseStart, phaseEnd, busy);
      if (hit !== null) {
        failures.push(hit);
        break; // one idle-production classification per team
      }
      phaseStart = phaseEnd;
    }
  }

  // 4. pop-cap-stall — population pinned at cap for >= STARVATION_WINDOW_TICKS
  //    while the mixed-pair milestone is still pending.
  {
    const pendingUntil = reachedTick.get('mixed-pair-ready') ?? endTick;
    const samples = events.filter((e) => e.type === 'population-sample' && e.team === player);
    let runStart: number | null = null;
    for (const s of samples) {
      if (s.tick > pendingUntil) break;
      const pop = payloadNumber(s.payload, 'pop');
      const cap = payloadNumber(s.payload, 'cap');
      if (pop === null || cap === null || pop !== cap || pop <= 0) {
        runStart = null;
        continue;
      }
      if (runStart === null) {
        runStart = s.tick;
      } else if (s.tick - runStart >= STARVATION_WINDOW_TICKS) {
        failures.push({
          id: 'pop-cap-stall',
          firstTick: runStart,
          evidence: `player population pinned at cap (${pop}/${cap}) for ${s.tick - runStart} ticks (${runStart}..${
            s.tick
          }) while the mixed-pair milestone was pending`,
          severity: 'warning',
        });
        break;
      }
    }
  }

  // 5. lost-scout-recovery-failure — fault injected, but the replacement never
  //    completed, or a replacement start followed core discovery (VS5 closure).
  {
    const faultTicks = events.filter((e) => e.type === 'fault-injection').map((e) => e.tick);
    if (faultTicks.length > 0) {
      const completed = events.some((e) => e.type === 'scout-replacement-complete');
      const discoveryTick = reachedTick.get('ai-core-discovery') ?? reachedTick.get('rival-core-discovered');
      const lateStart =
        discoveryTick !== undefined &&
        events.some((e) => e.type === 'scout-replacement-start' && e.tick > discoveryTick);
      if (!completed || lateStart) {
        const reasons: string[] = [];
        if (!completed) reasons.push('no scout-replacement-complete');
        if (lateStart) reasons.push(`scout-replacement-start after core discovery at tick ${discoveryTick}`);
        failures.push({
          id: 'lost-scout-recovery-failure',
          firstTick: faultTicks[0],
          evidence: `fault-injection at tick ${faultTicks[0]}; ${reasons.join('; ')}`,
          severity: 'failure',
        });
      }
    }
  }

  // 6. hidden-targeting — the rival engages a victim it never discovered, or
  //    targets the player core with coreDiscoveredAtIssue === false.
  // Per-team discovery map: entity id -> first discovery tick (built once and
  // shared with the early-attack detector below).
  const discoveryTick = new Map<FactionId, Map<number, number>>();
  {
    const noteDiscovery = (team: FactionId | null, ids: readonly number[], tick: number): void => {
      if (team === null) return;
      let table = discoveryTick.get(team);
      if (table === undefined) {
        table = new Map<number, number>();
        discoveryTick.set(team, table);
      }
      for (const id of ids) {
        if (!table.has(id)) table.set(id, tick);
      }
    };
    for (const e of events) {
      if (e.type !== 'entity-discovery') continue;
      const payload = e.payload ?? {};
      const ids = [...e.entityIds];
      const single = payloadNumber(payload, 'entityId');
      if (single !== null) ids.push(single);
      noteDiscovery(e.team, ids, e.tick);
    }
    const discoveredBy = (team: FactionId, id: number, tick: number): boolean => {
      const first = discoveryTick.get(team)?.get(id);
      return first !== undefined && first <= tick;
    };

    for (const e of events) {
      if (e.type !== 'combat-engagement' && e.type !== 'order-change' && e.type !== 'command-issue') continue;
      const payload = e.payload ?? {};
      const targetKind = payloadString(payload, 'targetKind') ?? payloadString(payload, 'targetType');
      const targetTeam = payloadString(payload, 'targetTeam');
      const coreDiscovered =
        payloadBool(payload, 'coreDiscoveredAtIssue') ?? payloadBool(payload, 'coreDiscovered');
      if (coreDiscovered === false) {
        // Payload-flag rule: explicit undiscovered-core flag on a player-side target.
        const targetsPlayerCore = (targetKind === 'core' || targetKind === null) && isPlayerSide(targetTeam, player);
        const ordersPlayerCore = e.type !== 'combat-engagement' && targetKind === 'core' && e.team === rival;
        if (targetsPlayerCore || ordersPlayerCore) {
          failures.push({
            id: 'hidden-targeting',
            firstTick: e.tick,
            evidence: `${e.type} at tick ${e.tick} (team=${String(e.team)}) targeted the player core before it was discovered (coreDiscoveredAtIssue=false)`,
            severity: 'failure',
          });
          break;
        }
      }
      // Victim rule: a rival combat engagement on an entity the rival never
      // saw AND that is not the player core. Core targeting before discovery
      // is handled by the explicit payload-flag branch above; LOS combat on
      // visible units is legal (the sim's own acquire() enforces sight).
      if (e.type === 'combat-engagement' && e.team === rival) {
        const victim = payloadNumber(payload, 'victimId') ?? (typeof e.entityIds[1] === 'number' ? e.entityIds[1] : null);
        const targetKind = payloadString(payload, 'targetKind') ?? payloadString(payload, 'targetType');
        const targetsPlayerCore = targetKind === 'core' && isPlayerSide(payloadString(payload, 'targetTeam'), player);
        if (
          victim !== null &&
          !targetsPlayerCore &&
          !discoveredBy(rival, victim, e.tick)
        ) {
          failures.push({
            id: 'hidden-targeting',
            firstTick: e.tick,
            evidence: `combat-engagement at tick ${e.tick} (team=${String(e.team)}) hit entity ${victim} that the rival never discovered`,
            severity: 'failure',
          });
          break;
        }
      }
    }
  }

  // 7. early-attack — the RIVAL attacks the player core before the honest-AI
  //    attack floor (ATTACK_FLOOR_TICK). The floor is an AI-doctrine rule; it
  //    never constrains the human-driven player side.
  {
    const rivalCoreAttackTick = events.find(
      (e) =>
        e.type === 'combat-engagement' &&
        e.team === rival &&
        (payloadString(e.payload, 'targetKind') === 'core') &&
        isPlayerSide(payloadString(e.payload, 'targetTeam'), player),
    )?.tick;
    // Prefer the explicit rival-side evidence from payloads.
    const attackTick = rivalCoreAttackTick;
    if (attackTick !== undefined && attackTick < ATTACK_FLOOR_TICK) {
      failures.push({
        id: 'early-attack',
        firstTick: attackTick,
        evidence: `first core attack at tick ${attackTick} precedes the attack floor ${ATTACK_FLOOR_TICK}`,
        severity: 'failure',
      });
    } else {
      for (const e of events) {
        if (e.type !== 'combat-engagement' || e.team !== rival || e.tick >= ATTACK_FLOOR_TICK) continue;
        const payload = e.payload ?? {};
        const victim = payloadNumber(payload, 'victimId') ?? (typeof e.entityIds[1] === 'number' ? e.entityIds[1] : null);
        const targetKind = payloadString(payload, 'targetKind');
        const targetTeam = payloadString(payload, 'targetTeam');
        const discoveredAsCore =
          victim !== null &&
          discoveryTick.get(rival)?.get(victim) !== undefined &&
          (discoveryTick.get(rival)?.get(victim) ?? Infinity) <= e.tick &&
          events.some(
            (d) =>
              d.type === 'entity-discovery' &&
              d.team === rival &&
              d.tick <= e.tick &&
              (d.entityIds.includes(victim) || (d.payload ?? {})['entityId'] === victim) &&
              ((d.payload ?? {})['what'] === 'core' || (d.payload ?? {})['what'] === 'hall'),
          );
        const flaggedCore = targetKind === 'core' && isPlayerSide(targetTeam, player);
        if (discoveredAsCore || flaggedCore) {
          failures.push({
            id: 'early-attack',
            firstTick: e.tick,
            evidence: `rival combat engagement at tick ${e.tick} hit the player core before the attack floor ${ATTACK_FLOOR_TICK}`,
            severity: 'failure',
          });
          break;
        }
      }
    }
  }

  // 8. impossible-positive-delta — a positive eco gain above the honest bound
  //    in one step. Per-second sample deltas are visible in the trace; per-step
  //    peaks come via observations from the collector (which does not serialize
  //    them). Fires once per team.
  {
    const teams = [player, rival] as const;
    const firedTeams = new Set<FactionId>();
    for (const team of teams) {
      let prev: { ore: number; gas: number; energy: number } | null = null;
      for (const e of events) {
        if (e.type !== 'resource-sample' || e.team !== team) continue;
        const ore = payloadNumber(e.payload, 'ore');
        const gas = payloadNumber(e.payload, 'gas');
        const energy = payloadNumber(e.payload, 'energy');
        if (ore === null || gas === null || energy === null) {
          prev = null;
          continue;
        }
        if (prev !== null) {
          const gain =
            Math.max(0, ore - prev.ore) + Math.max(0, gas - prev.gas) + Math.max(0, energy - prev.energy);
          if (gain > HONEST_STEP_GAIN_BOUND && !firedTeams.has(team)) {
            firedTeams.add(team);
            failures.push({
              id: 'impossible-positive-delta',
              firstTick: e.tick,
              evidence: `${team} eco gain ${gain} in one sample exceeds the honest bound ${HONEST_STEP_GAIN_BOUND}`,
              severity: 'failure',
            });
          }
        }
        prev = { ore, gas, energy };
      }
    }
    const gains = observations?.maxPositiveGain;
    if (gains !== undefined) {
      for (let i = 0; i < 2; i++) {
        const gain = gains[i];
        if (typeof gain === 'number' && gain > HONEST_STEP_GAIN_BOUND && !firedTeams.has(teams[i])) {
          firedTeams.add(teams[i]);
          failures.push({
            id: 'impossible-positive-delta',
            firstTick: 0,
            evidence: `${teams[i]} peak single-step positive eco gain ${gain} exceeds the honest bound ${HONEST_STEP_GAIN_BOUND} (step tick not recorded by the collector)`,
            severity: 'failure',
          });
        }
      }
    }
  }

  // 9. repeated-rejections — >= REJECTED_CALL_BURST consecutive rejected
  //    attempts of the same action kind within REJECTED_CALL_WINDOW_TICKS.
  {
    interface BurstState {
      count: number;
      firstTick: number;
      lastTick: number;
    }
    const groups = new Map<string, BurstState>();
    const keyOf = (e: ForgeTraceEvent): string | null => {
      const payload = e.payload ?? {};
      if (e.type === 'placement-attempt') return `place:${String(e.team)}:${payloadKind(payload) ?? ''}`;
      if (e.type === 'training-attempt')
        return `train:${String(e.team)}:${payloadKind(payload) ?? ''}:${String(
          payload.buildingId ?? payload.producerId ?? '',
        )}`;
      if (e.type === 'path-commit-attempt') return `commit:${String(e.team)}:${String(payload.path ?? payload.pathId ?? '')}`;
      return null;
    };
    for (const e of events) {
      const key = keyOf(e);
      if (key === null) continue;
      if (payloadOk(e.payload ?? {})) {
        groups.delete(key);
        continue;
      }
      const state = groups.get(key) ?? { count: 0, firstTick: e.tick, lastTick: e.tick };
      state.count += 1;
      if (state.count === 1) state.firstTick = e.tick;
      state.lastTick = e.tick;
      if (state.count >= REJECTED_CALL_BURST && state.lastTick - state.firstTick <= REJECTED_CALL_WINDOW_TICKS) {
        failures.push({
          id: 'repeated-rejections',
          firstTick: state.firstTick,
          evidence: `${state.count} consecutive rejected ${key} calls within ${state.lastTick - state.firstTick} ticks (${
            state.firstTick
          }..${state.lastTick})`,
          severity: 'warning',
        });
        groups.delete(key);
        continue;
      }
      groups.set(key, state);
    }
  }

  // 10. no-terminal — the trace never records a terminal event (or claims a
  //     time-cap without emitting one).
  {
    const terminal = trace.terminalResult;
    const hasTerminalEvent = events.some((e) => e.type === 'match-terminal');
    if (terminal === null || (terminal.reason === 'time-cap' && !hasTerminalEvent)) {
      failures.push({
        id: 'no-terminal',
        firstTick: terminal?.tick ?? endTick,
        evidence:
          terminal === null
            ? 'no terminalResult recorded'
            : 'terminalResult reports time-cap but no match-terminal event was recorded',
        severity: 'failure',
      });
    }
  }

  return failures;
}

// --- First divergence -----------------------------------------------------------

function checkpointAt(checkpoints: { seq: number; tick: number; worldHash: string }[], tick: number): string | null {
  let hash: string | null = null;
  for (const cp of checkpoints) {
    if (cp.tick > tick) break;
    hash = cp.worldHash;
  }
  return hash;
}

export function firstDivergence(passing: ForgeTraceFile, failed: ForgeTraceFile): DivergenceReport | null {
  const passReached = detectMilestones(passing.events).reached;
  const failReached = detectMilestones(failed.events).reached;

  let milestoneDivergenceTick = Infinity;
  const commonMilestones = Math.min(passReached.length, failReached.length);
  let index = 0;
  for (; index < commonMilestones; index++) {
    const p = passReached[index];
    const f = failReached[index];
    if (p.id !== f.id || p.tick !== f.tick) {
      milestoneDivergenceTick = Math.min(p.tick, f.tick);
      break;
    }
  }
  if (index === commonMilestones && passReached.length !== failReached.length) {
    const longer = passReached.length > failReached.length ? passReached : failReached;
    milestoneDivergenceTick = longer[commonMilestones].tick;
  }

  let hashDivergenceTick = Infinity;
  const commonCheckpoints = Math.min(passing.checkpoints.length, failed.checkpoints.length);
  let cpIndex = 0;
  for (; cpIndex < commonCheckpoints; cpIndex++) {
    const a = passing.checkpoints[cpIndex];
    const b = failed.checkpoints[cpIndex];
    if (a.tick !== b.tick || a.worldHash !== b.worldHash) {
      hashDivergenceTick = Math.min(a.tick, b.tick);
      break;
    }
  }
  if (cpIndex === commonCheckpoints && passing.checkpoints.length !== failed.checkpoints.length) {
    const longer =
      passing.checkpoints.length > failed.checkpoints.length ? passing.checkpoints : failed.checkpoints;
    hashDivergenceTick = longer[commonCheckpoints].tick;
  }

  if (!Number.isFinite(milestoneDivergenceTick) && !Number.isFinite(hashDivergenceTick)) return null;

  const earliestDivergingTick = Math.min(milestoneDivergenceTick, hashDivergenceTick);

  let priorCommonMilestone: MilestoneId | null = null;
  let priorCommonIndex = -1;
  for (let i = 0; i < passReached.length; i++) {
    const m = passReached[i];
    if (m.tick > earliestDivergingTick) break;
    const counterpart = failReached.find((fm) => fm.id === m.id && fm.tick === m.tick);
    if (counterpart === undefined) break;
    // The FTR-TESTS divergence gate asserts the prior milestone as a plain id
    // string (assert/strict), so the report carries the id, not an object.
    priorCommonMilestone = m.id;
    priorCommonIndex = i;
  }

  // The next milestone is the one the passing trace reached after the common
  // prefix (detected sequence order, which skips undetected contract ids).
  const expectedNextMilestone: MilestoneId | null =
    priorCommonIndex >= 0 && priorCommonIndex + 1 < passReached.length
      ? passReached[priorCommonIndex + 1].id
      : priorCommonIndex >= 0
        ? null
        : passReached.length > 0
          ? passReached[0].id
          : MILESTONE_IDS[0];

  const firstEvent = failed.events.find((e) => e.tick >= earliestDivergingTick);
  let actualEvent: string;
  if (firstEvent !== undefined) {
    const payload = firstEvent.payload ?? {};
    const ok = payloadBool(payload, 'ok');
    const kind = payloadKind(payload);
    const bits = [`${firstEvent.type}`, `tick=${firstEvent.tick}`, `team=${String(firstEvent.team)}`];
    if (ok !== null) bits.push(`ok=${ok}`);
    if (kind !== null) bits.push(`kind=${kind}`);
    actualEvent = bits.join(' ');
  } else {
    actualEvent = `checkpoint worldHash mismatch at tick ${earliestDivergingTick}`;
  }

  let ore: number | null = null;
  let gas: number | null = null;
  let energy: number | null = null;
  for (const e of failed.events) {
    if (e.type !== 'resource-sample' || e.team !== failed.playerFaction || e.tick > earliestDivergingTick) continue;
    const o = payloadNumber(e.payload, 'ore');
    const g = payloadNumber(e.payload, 'gas');
    const en = payloadNumber(e.payload, 'energy');
    if (o !== null && g !== null && en !== null) {
      ore = o;
      gas = g;
      energy = en;
    }
  }
  let pop: number | null = null;
  for (const e of failed.events) {
    if (e.type !== 'population-sample' || e.team !== failed.playerFaction || e.tick > earliestDivergingTick) continue;
    const p = payloadNumber(e.payload, 'pop');
    if (p !== null) pop = p;
  }
  const resourcesAtDivergence =
    ore === null || gas === null || energy === null || pop === null
      ? null
      : { ore, gas, energy, pop };

  const classification = classifyFailures(failed, detectMilestones(failed.events));

  return {
    earliestDivergingTick,
    priorCommonMilestone,
    expectedNextMilestone,
    actualEvent,
    resourcesAtDivergence,
    worldHashPassing: checkpointAt(passing.checkpoints, earliestDivergingTick),
    worldHashFailed: checkpointAt(failed.checkpoints, earliestDivergingTick),
    likelyCategory: classification.length > 0 ? classification[0].id : 'undetermined',
    note: 'diagnostic evidence - correlation not causation',
  };
}
