/** Shared deterministic opening layout for the camera and the simulation. */

import { MAP } from './engine';

export interface OpeningSlot {
  x: number;
  z: number;
}

export const OPENING_CENTER = { x: MAP * 0.5, z: MAP * 0.52 } as const;
export const OPENING_CAMERA = { ...OPENING_CENTER, halfH: 7.2 } as const;

/** The clear 18x10 combat corridor around the opening clash. */
export const OPENING_CORRIDOR = { halfW: 9, halfD: 5 } as const;

/** Two 6x5 camp flats sit immediately beyond the corridor. */
export const OPENING_CAMP = { halfW: 3, halfD: 2.5, offset: 7.5 } as const;

/** A visible eastern terrace, with a west-facing ramp at the corridor edge. */
export const OPENING_MESA = { dx: 8.5, dz: 0.0, radius: 3.6, peak: 3 } as const;

/** Decorative scenery outside the combat lane. */
export const OPENING_CONVOY: readonly OpeningSlot[] = [
  { x: -11.2, z: -2.8 },
  { x: -10.1, z: -0.9 },
  { x: -11.0, z: 1.5 },
];

export const OPENING_VENTS: readonly OpeningSlot[] = [
  { x: 8.1, z: -3.6 },
  { x: 9.0, z: -2.8 },
  { x: 9.6, z: -1.8 },
];

const INV_SQRT_2 = 1 / Math.sqrt(2);

export function openingCampCenter(team: number): OpeningSlot {
  return {
    x: OPENING_CENTER.x,
    z: OPENING_CENTER.z + (team === 0 ? -1 : 1) * OPENING_CAMP.offset,
  };
}

export function openingFighterSlot(team: number, row: number, col: number): OpeningSlot {
  // Rows follow camera-right and columns follow camera-depth, so silhouettes do
  // not collapse into a diagonal stack in the isometric view.
  const right = (row - 0.5) * 2.5;
  // Keep a full sprite-height between depth ranks; the billboard atlas is
  // opaque inside its silhouette, so tighter ranks hide the rear fighters.
  const depth = (team === 0 ? -1 : 1) * 3.4 + (col - 1.5) * 2.2;
  return {
    x: OPENING_CENTER.x + (right + depth) * INV_SQRT_2,
    z: OPENING_CENTER.z + (-right + depth) * INV_SQRT_2,
  };
}

export function openingUniqueSlot(team: number): OpeningSlot {
  return {
    x: OPENING_CENTER.x - 3.7,
    z: OPENING_CENTER.z + (team === 0 ? -1 : 1) * 2.9,
  };
}

export function openingWorkerSlot(team: number, index: number): OpeningSlot {
  const camp = openingCampCenter(team);
  return {
    x: camp.x - 1.1 + (index % 3) * 1.0,
    z: camp.z + (index >= 3 ? 0.7 : -0.35),
  };
}

export function inOpeningCorridor(x: number, z: number): boolean {
  const dx = Math.abs(x - OPENING_CENTER.x);
  const dz = Math.abs(z - OPENING_CENTER.z);
  return dx <= OPENING_CORRIDOR.halfW && dz <= OPENING_CORRIDOR.halfD;
}

export function inOpeningCamp(x: number, z: number): boolean {
  const dx = Math.abs(x - OPENING_CENTER.x);
  const dz = Math.abs(z - OPENING_CENTER.z);
  const campBand = Math.abs(dz - OPENING_CAMP.offset);
  return dx <= OPENING_CAMP.halfW && campBand <= OPENING_CAMP.halfD;
}
