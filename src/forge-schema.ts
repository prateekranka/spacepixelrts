/**
 * FTR-CORE — Forge Trace schema, validation, and deterministic serialization
 * (docs/FORGE_TRACE.md §5, frozen).
 *
 * The trace file format is version 1 and every field is required. The validator
 * enforces enum membership, seq strict-increase/gaplessness, tick monotonicity,
 * seconds == tick/20, canonical ids everywhere (legacy sim ids — vespari /
 * aurion / voidmarked — are rejected), checkpoint hex hashes, per-event payload
 * key whitelists (unknown extra keys are forbidden), and frameRef completeness.
 * Malformed/partial input NEVER throws: the result is always
 * `{ valid: false; errors: string[] }` with human-readable reasons.
 *
 * serializeTrace produces byte-deterministic JSON by recursively sorting object
 * keys; deserializeTrace is a guarded parse+validate.
 */

import {
  CHECKPOINT_EVENT_TYPES,
  FORGE_EVENT_TYPES,
} from './pacing-contract';
import type { ForgeEventType, PolicyId } from './pacing-contract';
import {
  DIFFICULTY_IDS,
  FACTION_IDS,
  MAP_IDS,
  MATCH_SPEEDS,
  SEED_MODES,
  TACTICAL_PAUSE_MODES,
} from './match-config';
import type { FactionId, MatchConfig } from './match-config';

/** Frame reference — complete match configuration for a Review-Deck jump (docs/FORGE_TRACE.md §5). */
export interface FrameRef {
  policyId: string;
  config: MatchConfig;
  seed: number;
  tick: number;
  perspective: 'player' | 'rival' | 'observer';
  camera: { x: number; z: number; halfH: number };
  selectedEntityIds: number[];
}

/** Deterministic world-identity checkpoint (hash per docs/FORGE_TRACE.md §6). */
export interface CheckpointEntry {
  seq: number;
  tick: number;
  worldHash: string;
}

export interface ForgeTraceEvent {
  /** Deterministic: `evt-${seq}`. */
  eventId: string;
  /** 0-based, strictly increasing, gapless. */
  seq: number;
  /** Sim tick (nondecreasing). */
  tick: number;
  /** tick / 20. */
  seconds: number;
  type: ForgeEventType;
  /** Canonical faction; null = global/shared. */
  team: FactionId | null;
  /** Related ent ids ([] allowed). */
  entityIds: number[];
  /** Typed per event family; numbers/strings/booleans only. */
  payload: Record<string, unknown>;
  /** Present on samples + milestone-class events (CHECKPOINT_EVENT_TYPES). */
  worldHash: string | null;
  frameRef: FrameRef;
  severity: 'info' | 'warning' | 'failure';
}

export interface ForgeTraceFile {
  schemaVersion: 1;
  tool: 'forge-trace';
  /** NEVER a wall-clock timestamp (manifest only). */
  createdAtNote: null;
  /** Canonical fields from src/match-config.ts. */
  matchConfig: MatchConfig;
  policy: { id: PolicyId; identityHash: string };
  tickHz: 20;
  playerFaction: FactionId;
  rivalFaction: FactionId;
  terminalResult: {
    winner: FactionId | null;
    tick: number;
    reason: 'core-destroyed' | 'time-cap';
  } | null;
  checkpoints: CheckpointEntry[];
  events: ForgeTraceEvent[];
}

export type TraceValidationResult = { valid: true } | { valid: false; errors: string[] };
export type DeserializeTraceResult =
  | { valid: true; trace: ForgeTraceFile }
  | { valid: false; errors: string[] };

const HEX8 = /^[0-9a-f]{8}$/;
const LEGACY_ID = /vespari|aurion|voidmarked/i;
const WALL_CLOCK_KEY = /startedAt|timestamp|wall.?clock|clock|date/i;
const PERSPECTIVES = ['player', 'rival', 'observer'] as const;
const SEVERITIES = ['info', 'warning', 'failure'] as const;
const TERMINAL_REASONS = ['core-destroyed', 'time-cap'] as const;

/**
 * Allowed payload keys per event family. Unknown extra keys are forbidden
 * (keeps size bounded and the schema honest). A payload may carry any SUBSET.
 */
const PAYLOAD_KEYS: Record<ForgeEventType, readonly string[]> = {
  'match-start': ['playerFaction', 'aiFaction'],
  'application-transition': [],
  'command-issue': ['order', 'x', 'z', 'tid'],
  'order-change': ['order', 'tx', 'tz', 'tid'],
  'resource-sample': ['ore', 'gas', 'energy'],
  'population-sample': ['pop', 'cap'],
  'worker-assignment-change': ['nodeId'],
  'placement-attempt': ['ok', 'kind', 'x', 'z', 'builderId', 'ore', 'gas', 'energy', 'rejectReason'],
  'construction-start': ['kind', 'x', 'z'],
  'construction-complete': ['kind', 'x', 'z'],
  'training-attempt': ['ok', 'kind', 'buildingId', 'ore', 'gas', 'energy', 'rejectReason'],
  'training-start': ['kind', 'buildingId', 'trainT'],
  'unit-completion': ['kind', 'x', 'z'],
  'path-commit-attempt': ['ok', 'path', 'ore', 'gas', 'energy', 'rejectReason'],
  'path-channel-start': ['path'],
  'technology-path-lock': ['path'],
  'entity-discovery': ['what', 'x', 'z'],
  'landmark-discovery': ['what', 'x', 'z'],
  'scout-loss': [],
  'scout-replacement-start': [],
  'scout-replacement-complete': [],
  'lumen-capture-start': [],
  'lumen-contested': [],
  'lumen-owner-change': [],
  'lumen-income': ['amount'],
  'lumen-vision-pulse': [],
  'combat-engagement': ['attackerId', 'victimId', 'damage', 'targetKind', 'targetTeam'],
  'core-damage': ['damage', 'hpBefore', 'hpAfter', 'byTeam'],
  'unit-death': ['kind'],
  'core-destruction': [],
  winner: [],
  'match-terminal': ['reason'],
  'fault-injection': [],
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isCanonicalFaction(value: unknown): value is FactionId {
  return value === 'sunweaver' || value === 'gravemark';
}

function pushFactionError(errors: string[], label: string, value: unknown, allowNull: boolean): void {
  if (allowNull && value === null) return;
  if (!isCanonicalFaction(value)) {
    errors.push(
      `${label} must be ${allowNull ? 'null or ' : ''}a canonical faction (${FACTION_IDS.join(
        ' or ',
      )}), got ${JSON.stringify(value)}`,
    );
  }
}

function scanLegacyId(errors: string[], label: string, value: unknown): void {
  if (typeof value === 'string' && LEGACY_ID.test(value)) {
    errors.push(`${label} carries legacy sim id "${value}" — canonical ids only`);
  }
}

function validateMatchConfigField(config: unknown, errors: string[], prefix: string): void {
  if (!isRecord(config)) {
    errors.push(`${prefix}matchConfig must be an object`);
    return;
  }
  pushFactionError(errors, `${prefix}matchConfig.playerFaction`, config.playerFaction, false);
  pushFactionError(errors, `${prefix}matchConfig.aiFaction`, config.aiFaction, false);
  if (!MAP_IDS.includes(config.map as never)) {
    errors.push(`${prefix}matchConfig.map must be one of ${MAP_IDS.join(', ')}, got ${JSON.stringify(config.map)}`);
  }
  if (!DIFFICULTY_IDS.includes(config.difficulty as never)) {
    errors.push(
      `${prefix}matchConfig.difficulty must be one of ${DIFFICULTY_IDS.join(', ')}, got ${JSON.stringify(config.difficulty)}`,
    );
  }
  if (typeof config.fogOfWar !== 'boolean') {
    errors.push(`${prefix}matchConfig.fogOfWar must be a boolean`);
  }
  if (!MATCH_SPEEDS.includes(config.speed as never)) {
    errors.push(`${prefix}matchConfig.speed must be one of ${MATCH_SPEEDS.join(', ')}, got ${JSON.stringify(config.speed)}`);
  }
  if (!TACTICAL_PAUSE_MODES.includes(config.tacticalPause as never)) {
    errors.push(
      `${prefix}matchConfig.tacticalPause must be one of ${TACTICAL_PAUSE_MODES.join(', ')}, got ${JSON.stringify(config.tacticalPause)}`,
    );
  }
  if (!SEED_MODES.includes(config.seedMode as never)) {
    errors.push(`${prefix}matchConfig.seedMode must be one of ${SEED_MODES.join(', ')}, got ${JSON.stringify(config.seedMode)}`);
  }
  if (typeof config.seed !== 'number' || !Number.isFinite(config.seed)) {
    errors.push(`${prefix}matchConfig.seed must be a finite number`);
  }
  for (const key of Object.keys(config)) {
    scanLegacyId(errors, `${prefix}matchConfig.${key}`, config[key]);
  }
}

function validateFrameRef(frame: unknown, errors: string[], prefix: string): void {
  if (!isRecord(frame)) {
    errors.push(`${prefix}frameRef is required (complete frame reference per docs/FORGE_TRACE.md §5)`);
    return;
  }
  if (typeof frame.policyId !== 'string' || frame.policyId.length === 0) {
    errors.push(`${prefix}frameRef.policyId must be a non-empty string`);
  }
  validateMatchConfigField(frame.config, errors, `${prefix}frameRef.`);
  if (typeof frame.seed !== 'number' || !Number.isFinite(frame.seed)) {
    errors.push(`${prefix}frameRef.seed must be a finite number`);
  }
  if (typeof frame.tick !== 'number' || !Number.isFinite(frame.tick)) {
    errors.push(`${prefix}frameRef.tick must be a finite number`);
  }
  if (!PERSPECTIVES.includes(frame.perspective as never)) {
    errors.push(`${prefix}frameRef.perspective must be one of ${PERSPECTIVES.join(', ')}`);
  }
  const camera = frame.camera;
  if (!isRecord(camera)) {
    errors.push(`${prefix}frameRef.camera must be an object with finite x, z, halfH`);
  } else {
    for (const key of ['x', 'z', 'halfH'] as const) {
      const value = camera[key];
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`${prefix}frameRef.camera.${key} must be a finite number`);
      }
    }
  }
  if (!Array.isArray(frame.selectedEntityIds) || !frame.selectedEntityIds.every((id) => Number.isInteger(id))) {
    errors.push(`${prefix}frameRef.selectedEntityIds must be an array of integers`);
  }
  scanLegacyId(errors, `${prefix}frameRef.policyId`, frame.policyId);
}

function validateCheckpoints(checkpoints: unknown, errors: string[]): void {
  if (!Array.isArray(checkpoints)) {
    errors.push('checkpoints must be an array');
    return;
  }
  let prevTick = -Infinity;
  checkpoints.forEach((raw, index) => {
    if (!isRecord(raw)) {
      errors.push(`checkpoint[${index}] must be an object`);
      return;
    }
    if (raw.seq !== index) {
      errors.push(`checkpoint[${index}] seq must be strictly increasing and gapless from 0 (expected ${index}, got ${JSON.stringify(raw.seq)})`);
    }
    const tick = raw.tick;
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
      errors.push(`checkpoint[${index}] tick must be a nonnegative integer`);
    } else if (tick < prevTick) {
      errors.push(`checkpoint[${index}] tick must be nondecreasing (previous ${prevTick}, got ${tick})`);
    } else {
      prevTick = tick;
    }
    if (typeof raw.worldHash !== 'string' || !HEX8.test(raw.worldHash)) {
      errors.push(`checkpoint[${index}] worldHash must be an 8-char lowercase hex string, got ${JSON.stringify(raw.worldHash)}`);
    }
  });
}

function validatePayload(
  payload: unknown,
  type: unknown,
  errors: string[],
  prefix: string,
): void {
  if (!isRecord(payload)) {
    errors.push(`${prefix}payload must be an object`);
    return;
  }
  const allowed = typeof type === 'string' ? PAYLOAD_KEYS[type as ForgeEventType] : undefined;
  for (const key of Object.keys(payload)) {
    const value = payload[key];
    if (WALL_CLOCK_KEY.test(key)) {
      errors.push(`${prefix}wall-clock field "${key}" is forbidden in the deterministic stream`);
    } else if (allowed === undefined || !allowed.includes(key)) {
      errors.push(`${prefix}unknown payload key "${key}" on ${String(type)}`);
    }
    if (typeof value !== 'number' && typeof value !== 'string' && typeof value !== 'boolean') {
      errors.push(`${prefix}payload value for "${key}" must be a number, string, or boolean`);
    } else if (typeof value === 'number' && !Number.isFinite(value)) {
      errors.push(`${prefix}payload value for "${key}" must be finite`);
    }
    scanLegacyId(errors, `${prefix}payload.${key}`, value);
  }
}

function validateEvents(events: unknown, errors: string[]): void {
  if (!Array.isArray(events)) {
    errors.push('events must be an array');
    return;
  }
  let prevTick = -Infinity;
  events.forEach((raw, index) => {
    const prefix = `event[${index}]`;
    if (!isRecord(raw)) {
      errors.push(`${prefix} must be an object`);
      return;
    }
    const seq = raw.seq;
    if (typeof seq !== 'number' || !Number.isInteger(seq) || seq !== index) {
      errors.push(`${prefix} seq must be strictly increasing and gapless from 0 (expected ${index}, got ${JSON.stringify(seq)})`);
    }
    if (raw.eventId !== `evt-${index}`) {
      errors.push(`${prefix} eventId must be "evt-${index}", got ${JSON.stringify(raw.eventId)}`);
    }
    const tick = raw.tick;
    if (typeof tick !== 'number' || !Number.isInteger(tick) || tick < 0) {
      errors.push(`${prefix} tick must be a nonnegative integer, got ${JSON.stringify(tick)}`);
    } else if (tick < prevTick) {
      errors.push(`${prefix} tick must be nondecreasing (previous ${prevTick}, got ${tick})`);
    }
    if (typeof tick === 'number' && tick >= prevTick) prevTick = tick;
    const seconds = raw.seconds;
    if (
      typeof seconds !== 'number' ||
      !Number.isFinite(seconds) ||
      Math.abs(seconds - (typeof tick === 'number' ? tick : 0) / 20) >= 1e-9
    ) {
      errors.push(`${prefix} seconds must equal tick/20 exactly, got ${JSON.stringify(seconds)}`);
    }
    const type = raw.type;
    if (typeof type !== 'string' || !(FORGE_EVENT_TYPES as readonly string[]).includes(type)) {
      errors.push(`${prefix} type must be a known forge event type, got ${JSON.stringify(type)}`);
    }
    pushFactionError(errors, `${prefix} team`, raw.team, true);
    if (!Array.isArray(raw.entityIds) || !raw.entityIds.every((id) => Number.isInteger(id))) {
      errors.push(`${prefix} entityIds must be an array of integers`);
    }
    validatePayload(raw.payload, type, errors, prefix);
    const worldHash = raw.worldHash;
    if (typeof type === 'string' && (CHECKPOINT_EVENT_TYPES as readonly string[]).includes(type)) {
      if (typeof worldHash !== 'string' || !HEX8.test(worldHash)) {
        errors.push(`${prefix} worldHash must be an 8-char lowercase hex string on ${type}, got ${JSON.stringify(worldHash)}`);
      }
    } else if (worldHash !== null) {
      errors.push(`${prefix} worldHash must be null on non-checkpoint event ${String(type)}, got ${JSON.stringify(worldHash)}`);
    }
    validateFrameRef(raw.frameRef, errors, prefix);
    const severity = raw.severity;
    if (typeof severity !== 'string' || !(SEVERITIES as readonly string[]).includes(severity)) {
      errors.push(`${prefix} severity must be one of ${SEVERITIES.join(', ')}, got ${JSON.stringify(severity)}`);
    }
    scanLegacyId(errors, `${prefix} team`, raw.team);
  });
}

function validateTerminalResult(terminal: unknown, errors: string[]): void {
  if (terminal === null) return;
  if (!isRecord(terminal)) {
    errors.push('terminalResult must be an object or null');
    return;
  }
  pushFactionError(errors, 'terminalResult.winner', terminal.winner, true);
  if (typeof terminal.tick !== 'number' || !Number.isFinite(terminal.tick)) {
    errors.push('terminalResult.tick must be a finite number');
  }
  const reason = terminal.reason;
  if (typeof reason !== 'string' || !(TERMINAL_REASONS as readonly string[]).includes(reason)) {
    errors.push(`terminalResult.reason must be one of ${TERMINAL_REASONS.join(', ')}, got ${JSON.stringify(reason)}`);
  }
  scanLegacyId(errors, 'terminalResult.winner', terminal.winner);
}

function validatePolicy(policy: unknown, errors: string[]): void {
  if (!isRecord(policy)) {
    errors.push('policy must be an object');
    return;
  }
  if (typeof policy.id !== 'string' || policy.id.length === 0) {
    errors.push('policy.id must be a non-empty string');
  }
  if (typeof policy.identityHash !== 'string' || !HEX8.test(policy.identityHash)) {
    errors.push('policy.identityHash must be an 8-char lowercase hex string');
  }
  scanLegacyId(errors, 'policy.id', policy.id);
}

function validateTrace(value: Record<string, unknown>, errors: string[]): void {
  if (value.schemaVersion !== 1) {
    errors.push(`schemaVersion must be 1, got ${JSON.stringify(value.schemaVersion)}`);
  }
  if (value.tool !== 'forge-trace') {
    errors.push(`tool must be "forge-trace", got ${JSON.stringify(value.tool)}`);
  }
  if (value.createdAtNote !== null) {
    errors.push('createdAtNote must be null (no wall-clock fields in the deterministic stream)');
  }
  validateMatchConfigField(value.matchConfig, errors, '');
  validatePolicy(value.policy, errors);
  pushFactionError(errors, 'playerFaction', value.playerFaction, false);
  pushFactionError(errors, 'rivalFaction', value.rivalFaction, false);
  if (value.tickHz !== 20) {
    errors.push(`tickHz must be 20, got ${JSON.stringify(value.tickHz)}`);
  }
  validateTerminalResult(value.terminalResult, errors);
  validateCheckpoints(value.checkpoints, errors);
  validateEvents(value.events, errors);
  scanLegacyId(errors, 'playerFaction', value.playerFaction);
  scanLegacyId(errors, 'rivalFaction', value.rivalFaction);
}

/**
 * Validate a trace file (docs/FORGE_TRACE.md §5). Never throws on partial or
 * garbage input — malformed input always yields `{ valid: false, errors }`.
 */
export function validateTraceFile(value: unknown): TraceValidationResult {
  const errors: string[] = [];
  try {
    if (!isRecord(value)) {
      errors.push('trace must be an object');
    } else {
      validateTrace(value, errors);
    }
  } catch (err) {
    errors.push(`trace validation crashed: ${err instanceof Error ? err.message : String(err)}`);
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

/** Recursively sort object keys so byte output is deterministic. */
function stableSort(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableSort);
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) out[key] = stableSort(record[key]);
    return out;
  }
  return value;
}

/** Serialize a trace to a deterministic JSON string (recursively sorted keys). */
export function serializeTrace(trace: ForgeTraceFile): string {
  return JSON.stringify(stableSort(trace));
}

/** Parse + validate a serialized trace. Guarded: invalid JSON never throws. */
export function deserializeTrace(text: string): DeserializeTraceResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    return { valid: false, errors: [`trace JSON parse failed: ${err instanceof Error ? err.message : String(err)}`] };
  }
  const result = validateTraceFile(parsed);
  if (!result.valid) return result;
  return { valid: true, trace: parsed as ForgeTraceFile };
}
