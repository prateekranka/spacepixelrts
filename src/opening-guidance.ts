/** M2-C — contextual opening guidance evaluator (docs/M2_C_GUIDANCE.md). */

import { Kind } from './engine';
import type { Ent } from './engine';
import { SEEN_PLAYER } from './discovery';
import type { Landmark } from './discovery';

export type OpeningGuidanceId = 'select-scout' | 'explore-signal' | 'objective-found';

export interface OpeningGuidance {
  /** Stable state id — presentation updates DOM text only when this changes. */
  readonly id: OpeningGuidanceId;
  readonly primary: string;
  readonly secondary?: string;
}

const SELECT_SCOUT: OpeningGuidance = { id: 'select-scout', primary: 'Select your scout' };
const EXPLORE_SIGNAL: OpeningGuidance = { id: 'explore-signal', primary: 'Explore the nearby signal' };
const OBJECTIVE_FOUND: OpeningGuidance = {
  id: 'objective-found',
  primary: 'A shared Lumen field has been discovered',
  secondary: 'The enemy may contest this location',
};

/**
 * Pure evaluator over real game state: same ents/landmarks/selection always
 * return the same guidance. Discovered objective outranks selection.
 */
export function evaluateOpeningGuidance(
  ents: readonly Ent[],
  landmarks: readonly Landmark[],
  selected: ReadonlySet<number>,
): OpeningGuidance {
  const objective = landmarks.find((landmark) => landmark.id === 'central-lumen-field');
  if (objective && (objective.discoveredBy & SEEN_PLAYER) !== 0) return OBJECTIVE_FOUND;
  const scoutSelected = ents.some(
    (ent) => ent.alive && ent.team === 0 && ent.kind === Kind.Scout && selected.has(ent.id),
  );
  return scoutSelected ? EXPLORE_SIGNAL : SELECT_SCOUT;
}
