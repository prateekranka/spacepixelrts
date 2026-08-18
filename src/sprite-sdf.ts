/** P90-v3 — startup-rasterized sprite atlas + instanced texture shader. */

import { Kind, type Civ } from './engine';
import { buildSpriteAtlas, type SpriteAtlas } from './sprites';

export function civIndex(civ: Civ): number {
  if (civ === 'vespari') return 0;
  if (civ === 'aurion') return 1;
  return 2;
}

export function spriteSize(kind: Kind): number {
  return kind === Kind.Hall ? 64 : 32;
}

export const UNIT_FRAMES = 7;
export const UNIT_KINDS = 7;
export const CIVS = 3;
export const UNIT_SLOTS = UNIT_KINDS * CIVS * UNIT_FRAMES;

export function buildSprites(): SpriteAtlas {
  return buildSpriteAtlas();
}

export const SDF_VERT = /* glsl */ `
attribute vec4 iMeta;
attribute vec3 iTeam;
attribute float iFlash;
attribute float iDir;
varying vec2 vUv;
varying vec4 vMeta;
varying vec3 vTeam;
varying float vFlash;
varying float vDir;
void main() {
  vUv = uv;
  vMeta = iMeta;
  vTeam = iTeam;
  vFlash = iFlash;
  vDir = iDir;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const SDF_FRAG = /* glsl */ `
uniform sampler2D uSpriteAtlas;
uniform vec2 uAtlasSize;
uniform float uAtlasCols;
uniform float uCell;
uniform float uHallCell;
uniform float uUnitRows;
uniform float uBuildingRow;
uniform float uWorker8Y;
uniform float uWorker8H;
uniform float uWorker8ActionY;
uniform float uWorker8ActionH;
uniform float uWorker8ActionBase;
uniform float uWorker8ActionRows;

varying vec2 vUv;
varying vec4 vMeta;
varying vec3 vTeam;
varying float vFlash;
varying float vDir;

void main() {
  float kind = vMeta.x;
  float civ = vMeta.y;
  float frame = vMeta.z;
  float spr = vMeta.w;

  float col = civ;
  float row;
  float cellSz;
  float rowStride;
  float pixH;
  float worker8 = 0.0;
  float worker8Action = 0.0;

  if (kind < 0.5 && frame < 3.5) {
    worker8 = 1.0;
    col = floor(vDir + 0.5) + (frame > 0.5 ? 8.0 : 0.0);
    cellSz = uCell;
    rowStride = uWorker8H;
    pixH = uWorker8H;
  } else if (
    kind < 0.5 &&
    frame >= uWorker8ActionBase &&
    frame < uWorker8ActionBase + uWorker8ActionRows
  ) {
    worker8 = 1.0;
    worker8Action = 1.0;
    col = floor(vDir + 0.5);
    cellSz = uCell;
    rowStride = uWorker8ActionH;
    pixH = uWorker8ActionH;
  } else if (kind >= 9.5) {
    row = uBuildingRow + (kind - 10.0);
    cellSz = (kind < 10.5) ? uHallCell : uCell;
    rowStride = uHallCell;
    pixH = cellSz;
  } else {
    float idx = kind * 21.0 + civ * 7.0 + floor(frame);
    col = mod(idx, uAtlasCols);
    row = floor(idx / uAtlasCols);
    cellSz = uCell;
    rowStride = uCell;
    pixH = spr;
  }

  float bob = 0.0;
  if (kind < 9.5 && worker8 < 0.5) bob = mod(floor(frame), 2.0);

  float padX = (cellSz - spr) * 0.5;
  float rowY;
  if (worker8 > 0.5) {
    rowY =
      worker8Action > 0.5
        ? uWorker8ActionY + (frame - uWorker8ActionBase) * uWorker8ActionH
        : uWorker8Y + civ * uWorker8H;
    padX = 0.0;
  } else if (kind >= 9.5) {
    rowY = uUnitRows * uCell + (kind - 10.0) * uHallCell;
  } else {
    rowY = row * rowStride;
  }
  float spriteTop = rowY + (cellSz - pixH) - bob;
  if (worker8 > 0.5) spriteTop = rowY;
  float canvasX;
  if (kind >= 9.5 && kind < 10.5) {
    canvasX = col * uHallCell + vUv.x * spr;
  } else if (worker8 > 0.5) {
    canvasX = col * uCell + vUv.x * uCell;
  } else {
    canvasX = col * uCell + padX + vUv.x * spr;
  }
  float canvasY = spriteTop + (1.0 - vUv.y) * (pixH - 1.0);

  vec2 atlasUV = vec2((canvasX + 0.5) / uAtlasSize.x, 1.0 - (canvasY + 0.5) / uAtlasSize.y);

  vec4 tex = texture2D(uSpriteAtlas, atlasUV);
  vec3 colRgb = tex.rgb;
  if (tex.a < 0.08) discard;

  vec2 ip = floor(vec2(vUv.x * spr, (1.0 - vUv.y) * spr));
  float hash = mod(ip.x * 17.0 + ip.y * 31.0 + 5.0, 8.0);
  if (frame >= 5.5 && frame < 6.5 && hash < 5.6) discard;
  if (frame >= 4.5 && frame < 5.5 && hash < 2.8) discard;

  if (colRgb.r > 0.85 && colRgb.b > 0.85 && colRgb.g < 0.22) colRgb = vTeam;
  colRgb += vec3(vFlash);
  gl_FragColor = vec4(colRgb, 1.0);
}
`;
