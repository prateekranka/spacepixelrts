/** Master palette. All atlas pixels must land on these (plus magenta key + 0 alpha). */

export const PAL = {
  ink: [12, 8, 22, 255],
  void: [10, 8, 20, 255],
  dust: [28, 22, 42, 255],
  dust2: [42, 34, 56, 255],
  rock: [58, 48, 64, 255],
  rockH: [86, 72, 92, 255],
  ore: [198, 154, 72, 255],
  oreH: [240, 214, 120, 255],
  gas: [92, 168, 210, 255],
  gasH: [186, 230, 255, 255],
  sol: [240, 196, 72, 255],
  solH: [255, 236, 170, 255],
  hGold: [255, 211, 106, 255],
  hRed: [255, 90, 60, 255],
  hBone: [255, 241, 210, 255],
  hBron: [42, 22, 14, 255],
  kIce: [126, 231, 255, 255],
  kInd: [58, 91, 255, 255],
  kSil: [201, 212, 232, 255],
  kAbyss: [6, 16, 24, 255],
  nSpore: [184, 76, 255, 255],
  nVir: [28, 255, 154, 255],
  nBru: [42, 10, 40, 255],
  nPale: [240, 230, 255, 255],
  bone: [232, 220, 196, 255],
  blood: [176, 42, 48, 255],
  white: [244, 238, 226, 255],
  hpG: [108, 255, 138, 255],
  hpR: [255, 74, 74, 255],
  sel: [255, 228, 138, 255],
  fog: [5, 4, 10, 255],
} as const;

export type Rgba = readonly [number, number, number, number] | [number, number, number, number];

export const MAG: Rgba = [255, 0, 255, 255];
