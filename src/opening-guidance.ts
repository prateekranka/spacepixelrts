/** M2-C — contextual opening guidance evaluator (docs/M2_C_GUIDANCE.md). */

import { Kind, Ord, Tile } from './engine';
import type { Civ, Ent } from './engine';
import { SEEN_PLAYER } from './discovery';
import type { Landmark } from './discovery';
import { fighterName, labelOf, uniqueUnit } from './content';
import type { TechPathId } from './content';

export type OpeningGuidanceId =
  | 'build-yard'
  | 'complete-yard'
  | 'assign-ore'
  | 'fund-path'
  | 'choose-path'
  | 'path-channel'
  | 'train-army'
  | 'select-scout'
  | 'explore-signal'
  | 'objective-found';

export interface OpeningGuidance {
  /** Stable state id — presentation updates DOM text only when this changes. */
  readonly id: OpeningGuidanceId;
  readonly primary: string;
  readonly secondary?: string;
}

/** M4-B — team economy slice needed for the technology-path nudge (docs/M4_TECH_PATHS.md). */
export interface GuidanceEcoState {
  readonly ore: number;
  readonly energy: number;
  readonly techPath: TechPathId | null;
  readonly channelT: number;
}

/** Count only live player Workers whose current order is genuinely tied to Ore. */
export function countAssignedOreWorkers(ents: readonly Ent[]): number {
  return ents.filter((ent) => {
    if (!ent.alive || ent.hp <= 0 || ent.team !== 0 || ent.kind !== Kind.Worker) return false;
    if (ent.order !== Ord.Gather && ent.order !== Ord.Return) return false;
    const target = ent.tid >= 0 ? ents[ent.tid] : undefined;
    return (
      (target?.alive && target.kind === Kind.Resource && target.cargoType === Tile.Ore) ||
      (ent.order === Ord.Return && ent.cargoType === Tile.Ore)
    );
  }).length;
}

const BUILD_YARD: OpeningGuidance = {
  id: 'build-yard',
  primary: 'Build a Yard',
  secondary: 'Select a Worker · 150 Ore + 20 Charge',
};
const COMPLETE_YARD: OpeningGuidance = {
  id: 'complete-yard',
  primary: 'Complete your Yard',
  secondary: 'Keep the assigned Worker on construction',
};
const CHOOSE_PATH: OpeningGuidance = {
  id: 'choose-path',
  primary: 'Choose a technology path',
  secondary: 'Select your Nexus and commit one of two doctrines',
};
const SELECT_SCOUT: OpeningGuidance = { id: 'select-scout', primary: 'Select your recon unit' };
const EXPLORE_SIGNAL: OpeningGuidance = { id: 'explore-signal', primary: 'Explore the nearby signal' };
const OBJECTIVE_FOUND: OpeningGuidance = {
  id: 'objective-found',
  primary: 'A shared Lumen field has been discovered',
  secondary: 'The enemy may contest this location',
};

function playerCiv(ents: readonly Ent[]): Civ {
  const hall = ents.find((ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind === Kind.Hall);
  if (hall) return hall.civ;
  const unit = ents.find((ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind < Kind.Hall);
  return unit?.civ ?? 'vespari';
}

function trainingGuidance(ents: readonly Ent[]): OpeningGuidance {
  const civ = playerCiv(ents);
  const fighterAlive = ents.some(
    (ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind === Kind.Fighter,
  );
  const unique = uniqueUnit(civ);
  const uniqueAlive = ents.some(
    (ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind === unique,
  );
  const missing: string[] = [];
  if (!fighterAlive) missing.push(fighterName(civ));
  if (!uniqueAlive) missing.push(labelOf(unique, civ));
  return {
    id: 'train-army',
    primary: `Train ${missing.join(' + ')}`,
    secondary: 'Select your Yard · Habitat only if population is full',
  };
}

/**
 * Pure evaluator over real game state: same ents/landmarks/selection always
 * return the same guidance. Economy/progression outranks the discovered
 * objective and Scout selection until a mixed Fighter/unique pair is alive.
 */
export function evaluateOpeningGuidance(
  ents: readonly Ent[],
  landmarks: readonly Landmark[],
  selected: ReadonlySet<number>,
  eco?: GuidanceEcoState,
): OpeningGuidance {
  const yard = ents.find(
    (ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind === Kind.Barracks,
  );
  if (!yard) return BUILD_YARD;
  if (yard.progress < 1) return COMPLETE_YARD;

  if (eco) {
    const oreWorkers = countAssignedOreWorkers(ents);
    if (eco.channelT > 0) {
      return {
        id: 'path-channel',
        primary: `Technology locks in ${Math.ceil(eco.channelT)}s`,
        secondary: 'Keep gathering Ore and Volatiles',
      };
    }
    if (eco.techPath === null && oreWorkers < 2) {
      return {
        id: 'assign-ore',
        primary: 'Assign 2 Workers to Ore',
        secondary: `Ore Workers ${oreWorkers}/2 · Find Idle Worker → GATHER → marked Ore`,
      };
    }
    if (eco.techPath === null && (eco.ore < 400 || eco.energy < 80)) {
      return {
        id: 'fund-path',
        primary: 'Fund technology',
        secondary: `Ore ${Math.floor(eco.ore)}/400 · Charge ${Math.floor(eco.energy)}/80 · Ore Workers ${oreWorkers}/2`,
      };
    }
    if (eco.techPath === null) return CHOOSE_PATH;
    if (
      !ents.some((ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind === Kind.Fighter) ||
      !ents.some((ent) => ent.alive && ent.hp > 0 && ent.team === 0 && ent.kind === uniqueUnit(playerCiv(ents)))
    ) {
      return trainingGuidance(ents);
    }
  }
  const objective = landmarks.find((landmark) => landmark.id === 'central-lumen-field');
  if (objective && (objective.discoveredBy & SEEN_PLAYER) !== 0) return OBJECTIVE_FOUND;
  const scoutSelected = ents.some(
    (ent) => ent.alive && ent.team === 0 && ent.kind === Kind.Scout && selected.has(ent.id),
  );
  return scoutSelected ? EXPLORE_SIGNAL : SELECT_SCOUT;
}
