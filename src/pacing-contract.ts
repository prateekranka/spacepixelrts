/**
 * FTR-1 pacing contract — single source of truth for deadlines, windows, bounds,
 * canonical-ID adapters, milestone ids, and event types used by Forge Trace.
 *
 * Parent-owned (docs/FORGE_TRACE.md §4). Builders import from here; nobody redeclares
 * these numbers. Sim-private constants are mirrored here ONCE and asserted against the
 * live sim behavior in tests where possible; costs always come from src/content.ts STATS.
 */

import { DT, TICK_HZ, Kind } from './engine';
import type { Civ } from './engine';
import type { Difficulty, FactionId, MapId } from './match-config';

/** Ticks per simulated minute (20 Hz * 60). */
export const TICKS_PER_MINUTE = 60 * TICK_HZ;

/** Convert simulated minutes to ticks. */
export function minutesToTicks(minutes: number): number {
  return Math.round(minutes * TICKS_PER_MINUTE);
}

// --- Player contract deadlines (docs/FIRST_PLAYABLE.md, docs/VS5_PACING_CLOSURE.md) ---

export const PATH_LOCK_BY_TICK = minutesToTicks(8); // 9600
export const MIXED_PAIR_BY_TICK = minutesToTicks(10); // 12000
export const TERMINAL_BY_TICK = minutesToTicks(18); // 21600

// --- Honest-AI windows (tests/vs2-ai-doctrine.test.ts) ---

export const AI_PATH_WINDOW_TICKS: readonly [number, number] = [minutesToTicks(4.5), minutesToTicks(7.5)];
export const AI_ATTACK_WINDOW_TICKS: readonly [number, number] = [minutesToTicks(8), minutesToTicks(12)];
export const ATTACK_FLOOR_TICK = minutesToTicks(8);

/** Per-step positive resource-gain bound proving no hidden grants (VS-2A). */
export const HONEST_STEP_GAIN_BOUND = 96;

// --- Diagnostic windows (FTR-1 defaults) ---

/** Resource-progress stall window: >= 60 simulated seconds. */
export const STARVATION_WINDOW_TICKS = minutesToTicks(1);
/** Avoidable idle production window: >= 20 simulated seconds. */
export const IDLE_PRODUCTION_WINDOW_TICKS = secondsToTicks(20);
/** Repeated-rejection burst: >= N rejected calls of one action within the window. */
export const REJECTED_CALL_BURST = 3;
export const REJECTED_CALL_WINDOW_TICKS = secondsToTicks(10);

function secondsToTicks(seconds: number): number {
  return Math.round(seconds / DT);
}

// --- Canonical ID adapters (docs/CANONICAL_VOCABULARY.md) -----------------------

export const CANONICAL_FACTIONS: readonly FactionId[] = ['sunweaver', 'gravemark'];
export const CANONICAL_MAP: MapId = 'helios-rift';

/** Canonical faction -> legacy sim civ. Private adapter; never serialized. */
const FACTION_TO_LEGACY_CIV: Record<FactionId, Civ> = {
  sunweaver: 'vespari',
  gravemark: 'aurion',
};

export function factionToLegacyCiv(faction: FactionId): Civ {
  return FACTION_TO_LEGACY_CIV[faction];
}

export function legacyCivToFaction(civ: Civ): FactionId | null {
  if (civ === 'vespari') return 'sunweaver';
  if (civ === 'aurion') return 'gravemark';
  return null;
}

/** Canonical kind names for serialized output (kind ordinals stay private to adapters). */
export const KIND_NAMES: Record<number, string> = {
  [Kind.Worker]: 'worker',
  [Kind.Scout]: 'scout',
  [Kind.Fighter]: 'fighter',
  [Kind.Ravager]: 'ravager',
  [Kind.Prism]: 'prism',
  [Kind.Hall]: 'core',
  [Kind.House]: 'habitat',
  [Kind.Barracks]: 'yard',
  [Kind.Resource]: 'resource-node',
};

export function kindName(kind: Kind): string {
  return KIND_NAMES[kind] ?? `kind-${kind}`;
}

/** Faction unique combat unit kind (vespari=Ravager, aurion=Prism). */
export function uniqueUnitFor(faction: FactionId): Kind {
  return faction === 'sunweaver' ? Kind.Ravager : Kind.Prism;
}

/** Standard doctrine path per faction (VS-2A standard doctrine). */
export const STANDARD_PATH_FOR_FACTION: Record<FactionId, string> = {
  sunweaver: 'sky-dominion',
  gravemark: 'iron-colossus',
};

export const TECH_PATH_IDS: readonly string[] = [
  'solar-ascendancy',
  'sky-dominion',
  'iron-colossus',
  'rift-engineering',
];

export const DIFFICULTIES: readonly Difficulty[] = ['cadet', 'standard', 'veteran'];

// --- Milestones ------------------------------------------------------------------

export const MILESTONE_IDS = [
  'match-start',
  'yard-placed',
  'yard-complete',
  'path-funded',
  'path-committed',
  'path-locked',
  'mixed-pair-ready',
  'lumen-discovered',
  'lumen-captured',
  'rival-core-discovered',
  'first-core-attack',
  'terminal',
  'ai-yard-placed',
  'ai-path-committed',
  'ai-force-ready',
  'ai-core-discovery',
] as const;

export type MilestoneId = (typeof MILESTONE_IDS)[number];

// --- Event taxonomy (docs/FORGE_TRACE.md §5) --------------------------------------

export const FORGE_EVENT_TYPES = [
  'match-start',
  'application-transition',
  'command-issue',
  'order-change',
  'resource-sample',
  'population-sample',
  'worker-assignment-change',
  'placement-attempt',
  'construction-start',
  'construction-complete',
  'training-attempt',
  'training-start',
  'unit-completion',
  'path-commit-attempt',
  'path-channel-start',
  'technology-path-lock',
  'entity-discovery',
  'landmark-discovery',
  'scout-loss',
  'scout-replacement-start',
  'scout-replacement-complete',
  'lumen-capture-start',
  'lumen-contested',
  'lumen-owner-change',
  'lumen-income',
  'lumen-vision-pulse',
  'combat-engagement',
  'core-damage',
  'unit-death',
  'core-destruction',
  'winner',
  'match-terminal',
  'fault-injection',
] as const;

export type ForgeEventType = (typeof FORGE_EVENT_TYPES)[number];

/** Event types that carry a worldHash checkpoint (samples + milestone-class events). */
export const CHECKPOINT_EVENT_TYPES: readonly ForgeEventType[] = [
  'resource-sample',
  'match-start',
  'construction-complete',
  'technology-path-lock',
  'unit-completion',
  'landmark-discovery',
  'lumen-owner-change',
  'core-destruction',
  'winner',
  'match-terminal',
  'fault-injection',
];

// --- Failure classification ids ----------------------------------------------------

export const FAILURE_CLASSIFICATION_IDS = [
  'deadline-miss',
  'starvation',
  'idle-production',
  'pop-cap-stall',
  'lost-scout-recovery-failure',
  'hidden-targeting',
  'early-attack',
  'impossible-positive-delta',
  'repeated-rejections',
  'no-terminal',
] as const;

export type FailureClassificationId = (typeof FAILURE_CLASSIFICATION_IDS)[number];

// --- Policies ------------------------------------------------------------------------

export const POLICY_IDS = ['standard-opening', 'lost-scout-recovery'] as const;
export type PolicyId = (typeof POLICY_IDS)[number];

/** Default camera preset recorded in frameRefs (opening base view). */
export const DEFAULT_CAMERA_PRESET = { x: 12, z: 12, halfH: 30 };
