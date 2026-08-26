/**
 * Forge Art Lab v1 — shared objective threshold table (docs/FORGE_ART_LAB.md §10).
 *
 * One table keyed by asset class. `proven` entries are VS-4-derived (frozen digests
 * + published metric ranges); `advisory` entries are UNPROVEN values from the A2/A3
 * tables (swim <= 4px, occupancy bands, building coverage, ground contact) — advisory
 * failures render as WARN, never hard-fail, until calibrated.
 */
import { ASSET_BY_ID } from './registry';

export type ThresholdsKey = 'combat-unit' | 'worker' | 'scout' | 'building';

export interface ThresholdEntry {
  /** true = VS-4-derived (alpha 0.12-0.55, connected>=0.96, poseDelta 4-45%, N-vs-E>18,
   *  guard/walker IoU<0.78, MAG 0.005-0.05 source / 0 runtime, bounds, luma>=90,
   *  bright>=0.30, rim shares>=0.85). */
  proven: boolean;
  /** true = UNPROVEN advisory values; failures warn, never hard-fail. */
  advisory: boolean;
  /** Alpha coverage band (share of cell pixels with alpha > 0). */
  alphaMin: number;
  alphaMax: number;
  /** Primary connected-component share (8-neighbor), >= value. */
  connectedMin: number;
  /** Pose-to-pose silhouette delta band, percent. */
  poseDeltaMin: number;
  poseDeltaMax: number;
  /** N-facing vs E-facing luminance delta, percent points (> value). */
  nVsEDeltaMin: number;
  /** Max silhouette IoU vs the sibling role silhouette (< value). */
  silhouetteOverlapMax: number;
  /** Team-color (MAG) share band in source art. */
  magShareMin: number;
  magShareMax: number;
  /** Team-color share at runtime (shader-replaced), floor. */
  magShareRuntimeMax: number;
  /** Average luminance floor (quiet terrain is ~30). */
  lumaFloor: number;
  /** Bright-material share floor. */
  brightShareMin: number;
  /** Exterior rim layer share floors. */
  rimOuterShareMin: number;
  rimInnerShareMin: number;
  /** Guard anatomy bounds (>= 24x44, spear geometry implied). */
  guardBoundsMinW: number;
  guardBoundsMinH: number;
  /** Walker anatomy bounds (>= 44x28). */
  walkerBoundsMinW: number;
  walkerBoundsMinH: number;
  /** Advisory: facing centroid/width swim <= px. */
  swimMax: number;
  /** Advisory: screen-height share band at normal camera. */
  occupancyMin: number;
  occupancyMax: number;
  /** Advisory: opaque px in the ground-contact row band >= value. */
  groundContactMin: number;
  /** Advisory: source coverage >= 30% (Hall/core) / >= 35% (32px buildings). */
  buildingCoverageHallMin: number;
  buildingCoverageSmallMin: number;
}

export const THRESHOLDS: Readonly<Record<ThresholdsKey, ThresholdEntry>> = {
  'combat-unit': {
    proven: true,
    advisory: false,
    alphaMin: 0.12,
    alphaMax: 0.55,
    connectedMin: 0.96,
    poseDeltaMin: 4,
    poseDeltaMax: 45,
    nVsEDeltaMin: 18,
    silhouetteOverlapMax: 0.78,
    magShareMin: 0.005,
    magShareMax: 0.05,
    magShareRuntimeMax: 0,
    lumaFloor: 90,
    brightShareMin: 0.3,
    rimOuterShareMin: 0.85,
    rimInnerShareMin: 0.85,
    guardBoundsMinW: 24,
    guardBoundsMinH: 44,
    walkerBoundsMinW: 44,
    walkerBoundsMinH: 28,
    swimMax: 4,
    occupancyMin: 0.03,
    occupancyMax: 0.15,
    groundContactMin: 8,
    buildingCoverageHallMin: 0.3,
    buildingCoverageSmallMin: 0.35,
  },
  worker: {
    proven: false,
    advisory: true,
    alphaMin: 0,
    alphaMax: 1,
    connectedMin: 0,
    poseDeltaMin: 0,
    poseDeltaMax: 100,
    nVsEDeltaMin: 0,
    silhouetteOverlapMax: 1,
    magShareMin: 0,
    magShareMax: 0,
    magShareRuntimeMax: 0,
    lumaFloor: 0,
    brightShareMin: 0,
    rimOuterShareMin: 0,
    rimInnerShareMin: 0,
    guardBoundsMinW: 0,
    guardBoundsMinH: 0,
    walkerBoundsMinW: 0,
    walkerBoundsMinH: 0,
    swimMax: 4,
    occupancyMin: 0.03,
    occupancyMax: 0.15,
    groundContactMin: 8,
    buildingCoverageHallMin: 0,
    buildingCoverageSmallMin: 0,
  },
  scout: {
    proven: false,
    advisory: true,
    alphaMin: 0,
    alphaMax: 1,
    connectedMin: 0,
    poseDeltaMin: 0,
    poseDeltaMax: 100,
    nVsEDeltaMin: 0,
    silhouetteOverlapMax: 1,
    magShareMin: 0,
    magShareMax: 0,
    magShareRuntimeMax: 0,
    lumaFloor: 0,
    brightShareMin: 0,
    rimOuterShareMin: 0,
    rimInnerShareMin: 0,
    guardBoundsMinW: 0,
    guardBoundsMinH: 0,
    walkerBoundsMinW: 0,
    walkerBoundsMinH: 0,
    swimMax: 4,
    occupancyMin: 0.03,
    occupancyMax: 0.15,
    groundContactMin: 8,
    buildingCoverageHallMin: 0,
    buildingCoverageSmallMin: 0,
  },
  building: {
    proven: false,
    advisory: true,
    alphaMin: 0,
    alphaMax: 1,
    connectedMin: 0,
    poseDeltaMin: 0,
    poseDeltaMax: 100,
    nVsEDeltaMin: 0,
    silhouetteOverlapMax: 1,
    magShareMin: 0,
    magShareMax: 0,
    magShareRuntimeMax: 0,
    lumaFloor: 0,
    brightShareMin: 0,
    rimOuterShareMin: 0,
    rimInnerShareMin: 0,
    guardBoundsMinW: 0,
    guardBoundsMinH: 0,
    walkerBoundsMinW: 0,
    walkerBoundsMinH: 0,
    swimMax: 4,
    occupancyMin: 0.03,
    occupancyMax: 0.15,
    groundContactMin: 8,
    buildingCoverageHallMin: 0.3,
    buildingCoverageSmallMin: 0.35,
  },
};

/** Threshold entry for a public asset (combat units -> combat-unit, etc.). */
export function thresholdsFor(assetId: string): ThresholdEntry {
  const def = ASSET_BY_ID[assetId];
  if (!def) throw new Error(`thresholdsFor: unknown assetId "${assetId}"`);
  return THRESHOLDS[def.thresholdsKey];
}
