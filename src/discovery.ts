/** M2-B — deterministic Helios Rift discovery records (docs/M2_B_DISCOVERY.md). */

import { OPENING_CENTER } from './opening-presentation';

/** Discovery latch bits — bit 1 is player team 0, bit 2 is AI team 1. */
export const SEEN_PLAYER = 1;
export const SEEN_RIVAL = 2;

export const LANDMARK_KINDS = [
  'central-objective',
  'relic',
  'expansion',
  'safe-route',
  'danger-route',
] as const;

export type LandmarkKind = (typeof LANDMARK_KINDS)[number];

export interface Landmark {
  readonly id: string;
  readonly kind: LandmarkKind;
  readonly label: string;
  readonly x: number;
  readonly z: number;
  /** Set once when a team currently sees the landmark tile; never cleared. */
  discoveredBy: number;
}

export interface EntityDiscoveryEvent {
  team: number;
  tick: number;
  /** Discovered Ent.id. */
  id: number;
  kind: 'entity' | 'resource' | 'enemy-structure';
  label: string;
  x: number;
  z: number;
}

export interface LandmarkDiscoveryEvent {
  team: number;
  tick: number;
  /** Stable landmark id. */
  id: string;
  kind: LandmarkKind;
  label: string;
  x: number;
  z: number;
}

export type DiscoveryEvent = EntityDiscoveryEvent | LandmarkDiscoveryEvent;

/** Fixed offsets from OPENING_CENTER; the map layout anchors these art features. */
const RELIC_OFFSET = { x: -10.8, z: -0.7 };
const EXPANSION_NEAR_OFFSET = { x: -14, z: -14 };
const EXPANSION_FAR_OFFSET = { x: 14, z: 14 };
const SAFE_ROUTE_OFFSET = { x: 9, z: -9 };
const DANGER_ROUTE_OFFSET = { x: -3, z: 3 };

/** Fresh landmark records with cleared latch bits; coordinates are identical every call. */
export function makeHeliosLandmarks(): Landmark[] {
  const cx = OPENING_CENTER.x;
  const cz = OPENING_CENTER.z;
  const def = (
    id: string,
    kind: LandmarkKind,
    label: string,
    dx: number,
    dz: number,
  ): Landmark => ({ id, kind, label, x: cx + dx, z: cz + dz, discoveredBy: 0 });
  return [
    def('central-lumen-field', 'central-objective', 'Central Lumen Field', 0, 0),
    def('neutral-tech-relic', 'relic', 'Neutral Tech Relic', RELIC_OFFSET.x, RELIC_OFFSET.z),
    def(
      'expansion-player',
      'expansion',
      'Player Expansion Pad',
      EXPANSION_NEAR_OFFSET.x,
      EXPANSION_NEAR_OFFSET.z,
    ),
    def(
      'expansion-rival',
      'expansion',
      'Rival Expansion Pad',
      EXPANSION_FAR_OFFSET.x,
      EXPANSION_FAR_OFFSET.z,
    ),
    def('safe-route', 'safe-route', 'Rim Passage', SAFE_ROUTE_OFFSET.x, SAFE_ROUTE_OFFSET.z),
    def(
      'danger-route',
      'danger-route',
      'Contested Span',
      DANGER_ROUTE_OFFSET.x,
      DANGER_ROUTE_OFFSET.z,
    ),
  ];
}

export function isDiscoveredFor(record: Pick<Landmark, 'discoveredBy'>, team: number): boolean {
  const bit = team === 0 ? SEEN_PLAYER : SEEN_RIVAL;
  return (record.discoveredBy & bit) !== 0;
}
