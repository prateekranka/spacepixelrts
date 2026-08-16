/** P82 — GPU SDF sprites for units and buildings (no atlas texture). */

import { Kind, type Civ } from './engine';

export function civIndex(civ: Civ): number {
  if (civ === 'vespari') return 0;
  if (civ === 'aurion') return 1;
  return 2;
}

export function spriteSize(kind: Kind): number {
  return kind === Kind.Hall ? 64 : 32;
}

export const SDF_VERT = /* glsl */ `
attribute vec4 iMeta;
attribute vec3 iTeam;
attribute float iFlash;
varying vec2 vUv;
varying vec2 vUv;
varying vec4 vMeta;
varying vec3 vTeam;
varying float vFlash;
void main() {
  vUv = uv;
  vMeta = iMeta;
  vTeam = iTeam;
  vFlash = iFlash;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

export const SDF_FRAG = /* glsl */ `
varying vec2 vUv;
varying vec2 vUv;
varying vec4 vMeta;
varying vec3 vTeam;
varying float vFlash;

const vec3 MAG = vec3(1.0, 0.0, 1.0);
const vec3 INK = vec3(0.071, 0.055, 0.118);
const vec3 BONE = vec3(0.910, 0.863, 0.769);
const vec3 WHITE = vec3(0.957, 0.933, 0.886);
const vec3 ROCK = vec3(0.361, 0.322, 0.424);
const vec3 ROCKH = vec3(0.580, 0.533, 0.620);
const vec3 ORE = vec3(0.776, 0.604, 0.282);
const vec3 OREH = vec3(0.941, 0.839, 0.471);
const vec3 SOL = vec3(0.941, 0.769, 0.282);
const vec3 SOLH = vec3(1.0, 0.925, 0.667);
const vec3 BLOOD = vec3(0.690, 0.165, 0.188);
const vec3 HIVE = vec3(0.180, 0.478, 0.227);
const vec3 HIVEH = vec3(0.659, 0.902, 0.376);
const vec3 HIVED = vec3(0.086, 0.227, 0.125);
const vec3 CRY = vec3(0.306, 0.729, 0.839);
const vec3 CRYH = vec3(0.824, 0.957, 1.0);
const vec3 CRYD = vec3(0.110, 0.282, 0.376);
const vec3 VOIDC = vec3(0.282, 0.165, 0.549);
const vec3 VOIDH = vec3(0.729, 0.549, 1.0);
const vec3 VOIDD = vec3(0.110, 0.055, 0.188);

bool inCirc(vec2 p, vec2 c, float r) {
  return dot(p - c, p - c) <= r * r;
}

bool inDiam(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  return abs(d.x) + abs(d.y) <= r;
}

bool inHex(vec2 p, vec2 c, float r) {
  vec2 d = p - c;
  if (abs(d.y) > r) return false;
  float halfW = floor(r * 0.87 * (r - abs(d.y)) / max(r, 0.001));
  return abs(d.x) <= halfW;
}

bool inBox(vec2 p, vec2 lo, vec2 hi) {
  return p.x >= lo.x && p.x <= hi.x && p.y >= lo.y && p.y <= hi.y;
}

vec3 paint(vec3 base, vec3 col, bool hit) {
  return hit ? col : base;
}

vec3 paintMag(vec3 base, bool hit) {
  return hit ? MAG : base;
}

vec3 helionUnit(vec2 p, float frame) {
  vec3 col = vec3(0.0);
  float bob = mod(floor(frame), 2.0);
  vec2 q = p - vec2(0.0, bob);
  col = paint(col, HIVED, inHex(q, vec2(0.0, -2.0), 13.0));
  col = paint(col, HIVE, inHex(q, vec2(0.0, -3.0), 11.0));
  col = paint(col, HIVEH, inHex(q, vec2(-1.0, -6.0), 6.0));
  col = paintMag(col, inBox(q, vec2(-6.0, -14.0), vec2(2.0, -4.0)));
  col = paint(col, BONE, inBox(q, vec2(-5.0, -13.0), vec2(1.0, -11.0)));
  if (abs(q.x + 3.0) <= 0.5 && q.y >= -20.0 && q.y <= -14.0) col = INK;
  if (abs(q.x - 3.0) <= 0.5 && q.y >= -20.0 && q.y <= -14.0) col = INK;
  col = paint(col, HIVEH, inCirc(q, vec2(-3.0, -20.0), 2.0));
  col = paint(col, HIVEH, inCirc(q, vec2(3.0, -20.0), 2.0));
  col = paint(col, HIVED, inBox(q, vec2(-12.0, 1.0), vec2(-6.0, 5.0)));
  col = paint(col, HIVED, inBox(q, vec2(7.0, 1.0), vec2(13.0, 5.0)));
  col = paint(col, HIVED, inBox(q, vec2(-3.0, 7.0), vec2(5.0, 10.0)));
  return col;
}

vec3 kryosUnit(vec2 p, float frame) {
  vec3 col = vec3(0.0);
  float bob = mod(floor(frame), 2.0);
  vec2 q = p - vec2(0.0, bob);
  col = paint(col, INK, inDiam(q, vec2(0.0, 0.0), 14.0));
  col = paint(col, CRYD, inDiam(q, vec2(0.0, -1.0), 12.0));
  col = paint(col, CRY, inDiam(q, vec2(0.0, -2.0), 10.0));
  col = paint(col, CRYH, inDiam(q, vec2(0.0, -4.0), 7.0));
  col = paint(col, WHITE, inDiam(q, vec2(0.0, -5.0), 4.0));
  col = paintMag(col, inBox(q, vec2(-3.0, -3.0), vec2(4.0, 0.0)));
  col = paint(col, WHITE, inBox(q, vec2(-2.0, -2.0), vec2(3.0, 1.0)));
  if (abs(q.x) <= 0.5 && q.y >= -19.0 && q.y <= -9.0) col = CRYH;
  col = paint(col, CRYD, inBox(q, vec2(-12.0, 3.0), vec2(-5.0, 6.0)));
  col = paint(col, CRYD, inBox(q, vec2(6.0, 3.0), vec2(13.0, 6.0)));
  return col;
}

vec3 nihilineUnit(vec2 p, float frame) {
  vec3 col = vec3(0.0);
  float bob = mod(floor(frame), 2.0);
  vec2 q = p - vec2(0.0, bob);
  col = paint(col, VOIDD, inBox(q, vec2(-10.0, -3.0), vec2(8.0, 12.0)));
  col = paint(col, VOIDC, inBox(q, vec2(-8.0, -6.0), vec2(6.0, 7.0)));
  col = paint(col, VOIDD, inBox(q, vec2(5.0, -10.0), vec2(13.0, 1.0)));
  col = paint(col, VOIDH, inCirc(q, vec2(8.0, -7.0), 5.0));
  col = paint(col, VOIDD, inBox(q, vec2(-14.0, 1.0), vec2(-8.0, 12.0)));
  col = paint(col, VOIDC, inBox(q, vec2(-13.0, 3.0), vec2(-9.0, 10.0)));
  col = paint(col, VOIDD, inBox(q, vec2(1.0, 7.0), vec2(11.0, 12.0)));
  col = paintMag(col, inBox(q, vec2(-2.0, -4.0), vec2(4.0, 1.0)));
  if (inCirc(q, vec2(-15.0, -16.0), 3.0)) col = VOIDH;
  if (inCirc(q, vec2(12.0, -17.0), 3.0)) col = VOIDH;
  return col;
}

vec3 unitBody(vec2 p, float civ, float frame) {
  if (civ < 0.5) return helionUnit(p, frame);
  if (civ < 1.5) return kryosUnit(p, frame);
  return nihilineUnit(p, frame);
}

vec3 unitRole(vec2 p, float civ, float kind, float frame) {
  vec3 col = vec3(0.0);
  float bob = mod(floor(frame), 2.0);
  vec2 q = p - vec2(0.0, bob);
  if (kind < 0.5) {
    col = paint(col, ORE, inBox(q, vec2(4.0, -10.0), vec2(13.0, 0.0)));
    col = paint(col, OREH, inBox(q, vec2(5.0, -9.0), vec2(12.0, -5.0)));
    col = paint(col, WHITE, inBox(q, vec2(6.0, -8.0), vec2(9.0, 0.0)));
    col = paint(col, BONE, inBox(q, vec2(5.0, -7.0), vec2(10.0, -5.0)));
    col = paint(col, OREH, inBox(q, vec2(-14.0, 3.0), vec2(-10.0, 6.0)));
    col = paint(col, WHITE, inCirc(q, vec2(-2.0, -8.0), 2.0));
    col = paint(col, civ < 0.5 ? BONE : civ < 1.5 ? HIVED : VOIDD, inBox(q, vec2(-4.0, 8.0), vec2(6.0, 11.0)));
  } else if (kind < 1.5) {
    col = paint(col, WHITE, inBox(q, vec2(-15.0, -5.0), vec2(-7.0, -1.0)));
    col = paint(col, HIVEH, inBox(q, vec2(-16.0, -4.0), vec2(-13.0, -2.0)));
    col = paint(col, WHITE, inBox(q, vec2(8.0, -5.0), vec2(16.0, -1.0)));
    col = paint(col, HIVEH, inBox(q, vec2(14.0, -4.0), vec2(17.0, -2.0)));
    col = paint(col, HIVEH, inBox(q, vec2(-3.0, -16.0), vec2(4.0, -11.0)));
    if (q.x >= 3.0 && q.x <= 12.0 && q.y >= -14.0 && q.y <= -12.0) col = BONE;
    if (abs(q.x - 12.0) <= 0.5 && abs(q.y + 14.0) <= 0.5) col = WHITE;
  } else if (kind < 2.5) {
    if (q.x >= 3.0 && q.x <= 15.0 && q.y >= -14.0 && q.y <= -7.0) col = BONE;
    if (q.x >= 4.0 && q.x <= 16.0 && q.y >= -13.0 && q.y <= -6.0) col = WHITE;
    col = paintMag(col, inBox(q, vec2(14.0, -14.0), vec2(17.0, -11.0)));
    col = paintMag(col, inBox(q, vec2(-5.0, -7.0), vec2(0.0, -1.0)));
    if (civ < 0.5) col = paint(col, HIVED, inBox(q, vec2(-7.0, -3.0), vec2(-2.0, 4.0)));
    else if (civ < 1.5) {
      col = paint(col, CRYD, inBox(q, vec2(-7.0, -3.0), vec2(-2.0, 4.0)));
      col = paint(col, WHITE, inDiam(q, vec2(-4.0, 0.0), 4.0));
    } else col = paint(col, VOIDD, inBox(q, vec2(-7.0, -3.0), vec2(-2.0, 4.0)));
  } else if (kind < 3.5) {
    col = paint(col, ROCK, inBox(q, vec2(-14.0, 1.0), vec2(14.0, 8.0)));
    col = paint(col, ROCKH, inBox(q, vec2(-12.0, 2.0), vec2(12.0, 6.0)));
    col = paint(col, ROCK, inBox(q, vec2(1.0, -12.0), vec2(17.0, -6.0)));
    col = paint(col, ORE, inBox(q, vec2(14.0, -13.0), vec2(19.0, -9.0)));
    if (abs(q.x - 16.0) <= 0.5 && q.y >= -12.0 && q.y <= -7.0) col = INK;
    col = paint(col, ROCKH, inCirc(q, vec2(-10.0, 7.0), 4.0));
    col = paint(col, ROCKH, inCirc(q, vec2(10.0, 7.0), 4.0));
  } else if (kind < 4.5) {
    col = paint(col, HIVED, inHex(q, vec2(0.0, -3.0), 10.0));
    col = paint(col, BLOOD, inHex(q, vec2(0.0, -4.0), 8.0));
    col = paintMag(col, inBox(q, vec2(-3.0, -10.0), vec2(4.0, -4.0)));
    if (q.x <= -8.0 && q.x >= -15.0 && q.y >= -12.0 && q.y <= -6.0) col = BONE;
    if (q.x >= 8.0 && q.x <= 15.0 && q.y >= -12.0 && q.y <= -6.0) col = BONE;
    if (abs(q.x + 15.0) <= 0.5 && abs(q.y + 12.0) <= 0.5) col = SOLH;
    if (abs(q.x - 15.0) <= 0.5 && abs(q.y + 12.0) <= 0.5) col = SOLH;
    if (q.x >= 3.0 && q.x <= 16.0 && q.y >= -8.0 && q.y <= -2.0) col = SOL;
    if (abs(q.x - 16.0) <= 0.5 && abs(q.y + 8.0) <= 0.5) col = WHITE;
  } else if (kind < 5.5) {
    col = paint(col, CRYD, inDiam(q, vec2(0.0, -2.0), 13.0));
    col = paint(col, CRY, inDiam(q, vec2(0.0, -3.0), 11.0));
    col = paint(col, WHITE, inDiam(q, vec2(0.0, -4.0), 7.0));
    col = paintMag(col, inBox(q, vec2(-3.0, -4.0), vec2(4.0, 0.0)));
    if (abs(q.x) <= 0.5 && q.y >= -20.0 && q.y <= -12.0) col = CRYH;
    col = paint(col, WHITE, inBox(q, vec2(-1.0, -20.0), vec2(2.0, -18.0)));
    col = paint(col, CRYD, inBox(q, vec2(-13.0, 4.0), vec2(-8.0, 7.0)));
    col = paint(col, CRYD, inBox(q, vec2(9.0, 4.0), vec2(14.0, 7.0)));
  } else {
    col = paint(col, VOIDD, inBox(q, vec2(-10.0, -10.0), vec2(8.0, 5.0)));
    col = paint(col, VOIDC, inBox(q, vec2(-7.0, -8.0), vec2(5.0, 3.0)));
    col = paint(col, VOIDD, inBox(q, vec2(2.0, -14.0), vec2(10.0, -4.0)));
    col = paintMag(col, inBox(q, vec2(-2.0, -6.0), vec2(3.0, -1.0)));
    if (q.x <= -9.0 && q.x >= -14.0 && q.y >= 2.0 && q.y <= 8.0) col = VOIDH;
    if (q.x >= 6.0 && q.x <= 13.0 && q.y >= 2.0 && q.y <= 7.0) col = VOIDH;
    col = paint(col, VOIDH, inCirc(q, vec2(-14.0, 8.0), 2.0));
    if (q.x >= 4.0 && q.x <= 12.0 && q.y >= -16.0 && q.y <= -12.0) col = BLOOD;
  }
  if (frame >= 2.5 && frame < 3.5) {
    col = paint(col, WHITE, inCirc(q, vec2(10.0, -8.0), 3.0));
    col = paint(col, SOLH, inCirc(q, vec2(11.0, -8.0), 2.0));
  }
  return col;
}

vec3 helionHall(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, HIVED, inBox(p, vec2(-24.0, 44.0), vec2(24.0, 57.0)));
  col = paint(col, HIVED, inCirc(p, vec2(0.0, 42.0), 24.0));
  col = paint(col, HIVE, inCirc(p, vec2(0.0, 38.0), 20.0));
  col = paint(col, HIVED, inCirc(p, vec2(-14.0, 30.0), 12.0));
  col = paint(col, HIVED, inCirc(p, vec2(14.0, 30.0), 12.0));
  col = paint(col, HIVE, inCirc(p, vec2(0.0, 22.0), 14.0));
  col = paint(col, HIVEH, inCirc(p, vec2(-6.0, 18.0), 7.0));
  col = paintMag(col, inBox(p, vec2(-4.0, 12.0), vec2(5.0, 21.0)));
  if (abs(p.x + 10.0) <= 0.5 && p.y >= 4.0 && p.y <= 12.0) col = INK;
  if (abs(p.x - 10.0) <= 0.5 && p.y >= 4.0 && p.y <= 12.0) col = INK;
  col = paint(col, HIVEH, inCirc(p, vec2(-14.0, 4.0), 3.0));
  col = paint(col, HIVEH, inCirc(p, vec2(14.0, 4.0), 3.0));
  col = paint(col, HIVED, inBox(p, vec2(-18.0, 50.0), vec2(18.0, 55.0)));
  return col;
}

vec3 kryosHall(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, CRYD, inDiam(p, vec2(0.0, 40.0), 28.0));
  col = paint(col, CRY, inDiam(p, vec2(0.0, 36.0), 22.0));
  col = paint(col, CRYH, inDiam(p, vec2(0.0, 24.0), 14.0));
  col = paintMag(col, inBox(p, vec2(-4.0, 22.0), vec2(5.0, 31.0)));
  if (abs(p.x) <= 0.5 && p.y >= 0.0 && p.y <= 8.0) col = WHITE;
  col = paint(col, CRYH, inBox(p, vec2(-2.0, 0.0), vec2(3.0, 3.0)));
  if (p.x <= -14.0 && p.x >= -30.0 && p.y >= 44.0 && p.y <= 58.0) col = CRYD;
  if (p.x >= 14.0 && p.x <= 30.0 && p.y >= 44.0 && p.y <= 58.0) col = CRYD;
  col = paint(col, CRYD, inBox(p, vec2(-22.0, 52.0), vec2(22.0, 59.0)));
  return col;
}

vec3 nihilineHall(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, VOIDD, inBox(p, vec2(-26.0, 16.0), vec2(26.0, 59.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-20.0, 10.0), vec2(20.0, 59.0)));
  col = paint(col, VOIDD, inBox(p, vec2(-12.0, 6.0), vec2(12.0, 33.0)));
  col = paintMag(col, inBox(p, vec2(-4.0, 18.0), vec2(5.0, 27.0)));
  if (p.x <= -10.0 && p.x >= -30.0 && p.y >= 14.0 && p.y <= 18.0) col = VOIDH;
  if (p.x >= 10.0 && p.x <= 30.0 && p.y >= 14.0 && p.y <= 18.0) col = VOIDH;
  col = paint(col, VOIDD, inBox(p, vec2(-18.0, 48.0), vec2(-8.0, 65.0)));
  col = paint(col, VOIDD, inBox(p, vec2(8.0, 48.0), vec2(18.0, 65.0)));
  col = paint(col, VOIDH, inCirc(p, vec2(-30.0, 2.0), 4.0));
  col = paint(col, VOIDH, inCirc(p, vec2(30.0, 2.0), 4.0));
  return col;
}

vec3 helionHouse(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, HIVED, inBox(p, vec2(-12.0, 22.0), vec2(12.0, 29.0)));
  col = paint(col, HIVED, inHex(p, vec2(0.0, 18.0), 12.0));
  col = paint(col, HIVE, inHex(p, vec2(0.0, 16.0), 10.0));
  col = paint(col, HIVEH, inHex(p, vec2(-2.0, 12.0), 5.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 8.0), vec2(4.0, 15.0)));
  if (abs(p.x + 6.0) <= 0.5 && p.y >= 2.0 && p.y <= 10.0) col = INK;
  if (abs(p.x - 6.0) <= 0.5 && p.y >= 2.0 && p.y <= 10.0) col = INK;
  return col;
}

vec3 kryosHouse(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, CRYD, inBox(p, vec2(-13.0, 22.0), vec2(13.0, 29.0)));
  col = paint(col, CRYD, inDiam(p, vec2(0.0, 18.0), 13.0));
  col = paint(col, CRY, inDiam(p, vec2(0.0, 16.0), 10.0));
  col = paint(col, CRYH, inDiam(p, vec2(0.0, 12.0), 5.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 13.0), vec2(4.0, 18.0)));
  if (abs(p.x) <= 0.5 && p.y >= 1.0 && p.y <= 7.0) col = WHITE;
  return col;
}

vec3 nihilineHouse(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, VOIDD, inBox(p, vec2(-14.0, 20.0), vec2(14.0, 29.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-11.0, 8.0), vec2(11.0, 27.0)));
  col = paint(col, VOIDD, inBox(p, vec2(-8.0, 4.0), vec2(8.0, 15.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 12.0), vec2(4.0, 17.0)));
  if (p.x <= -6.0 && p.x >= -14.0 && p.y >= 10.0 && p.y <= 14.0) col = VOIDH;
  if (p.x >= 6.0 && p.x <= 14.0 && p.y >= 12.0 && p.y <= 16.0) col = VOIDH;
  return col;
}

vec3 helionBarracks(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, HIVED, inBox(p, vec2(-14.0, 20.0), vec2(14.0, 29.0)));
  col = paint(col, HIVE, inBox(p, vec2(-12.0, 8.0), vec2(12.0, 23.0)));
  col = paint(col, HIVEH, inHex(p, vec2(0.0, 14.0), 9.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 10.0), vec2(4.0, 17.0)));
  if (abs(p.x) <= 0.5 && p.y >= 1.0 && p.y <= 7.0) col = INK;
  if (p.x <= -6.0 && p.x >= -14.0 && p.y >= 22.0 && p.y <= 28.0) col = HIVED;
  if (p.x >= 6.0 && p.x <= 14.0 && p.y >= 22.0 && p.y <= 28.0) col = HIVED;
  return col;
}

vec3 kryosBarracks(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, CRYD, inBox(p, vec2(-14.0, 20.0), vec2(14.0, 29.0)));
  col = paint(col, CRY, inBox(p, vec2(-12.0, 10.0), vec2(12.0, 23.0)));
  col = paint(col, CRYH, inDiam(p, vec2(0.0, 14.0), 10.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 11.0), vec2(4.0, 17.0)));
  if (abs(p.x) <= 0.5 && p.y >= 1.0 && p.y <= 7.0) col = WHITE;
  col = paint(col, CRYH, inBox(p, vec2(-2.0, 0.0), vec2(3.0, 2.0)));
  return col;
}

vec3 nihilineBarracks(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, VOIDD, inBox(p, vec2(-15.0, 18.0), vec2(15.0, 29.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-12.0, 6.0), vec2(12.0, 25.0)));
  col = paint(col, VOIDD, inBox(p, vec2(-6.0, 4.0), vec2(6.0, 13.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 10.0), vec2(4.0, 16.0)));
  if (p.x <= -4.0 && p.x >= -12.0 && p.y >= 8.0 && p.y <= 12.0) col = VOIDH;
  if (p.x >= 4.0 && p.x <= 12.0 && p.y >= 10.0 && p.y <= 14.0) col = VOIDH;
  return col;
}

vec3 helionUnique(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, HIVED, inBox(p, vec2(-12.0, 20.0), vec2(12.0, 29.0)));
  col = paint(col, HIVED, inCirc(p, vec2(0.0, 16.0), 11.0));
  col = paint(col, SOL, inCirc(p, vec2(0.0, 14.0), 8.0));
  col = paint(col, HIVE, inCirc(p, vec2(-6.0, 10.0), 5.0));
  col = paint(col, HIVE, inCirc(p, vec2(6.0, 10.0), 5.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 10.0), vec2(4.0, 17.0)));
  if (abs(p.x) <= 0.5 && p.y >= 1.0 && p.y <= 7.0) col = SOLH;
  col = paint(col, WHITE, inCirc(p, vec2(0.0, 1.0), 2.0));
  return col;
}

vec3 kryosUnique(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, CRYD, inBox(p, vec2(-14.0, 20.0), vec2(14.0, 29.0)));
  col = paint(col, CRYD, inDiam(p, vec2(0.0, 16.0), 14.0));
  col = paint(col, CRY, inDiam(p, vec2(0.0, 14.0), 10.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 12.0), vec2(4.0, 18.0)));
  if (p.x <= 0.0 && p.x >= -12.0 && p.y >= 4.0 && p.y <= 12.0) col = CRYH;
  if (p.x >= 0.0 && p.x <= 12.0 && p.y >= 4.0 && p.y <= 12.0) col = CRYH;
  if (abs(p.x) <= 0.5 && p.y >= 16.0 && p.y <= 28.0) col = CRYH;
  if (abs(p.x) <= 0.5 && abs(p.y - 4.0) <= 0.5) col = WHITE;
  return col;
}

vec3 nihilineUnique(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, VOIDD, inBox(p, vec2(-14.0, 18.0), vec2(14.0, 29.0)));
  col = paint(col, VOIDD, inCirc(p, vec2(0.0, 14.0), 12.0));
  col = paint(col, VOIDH, inCirc(p, vec2(0.0, 14.0), 7.0));
  col = paintMag(col, inBox(p, vec2(-3.0, 11.0), vec2(4.0, 17.0)));
  if (p.x <= -4.0 && p.x >= -10.0 && p.y >= 6.0 && p.y <= 12.0) col = VOIDH;
  if (p.x >= 4.0 && p.x <= 10.0 && p.y >= 6.0 && p.y <= 12.0) col = VOIDH;
  col = paint(col, VOIDC, inCirc(p, vec2(-12.0, 6.0), 3.0));
  col = paint(col, VOIDC, inCirc(p, vec2(12.0, 6.0), 3.0));
  col = paint(col, VOIDD, inBox(p, vec2(-4.0, 22.0), vec2(4.0, 27.0)));
  return col;
}

vec3 buildingSprite(vec2 p, float civ, float kind) {
  if (kind < 10.5) {
    if (civ < 0.5) return helionHall(p);
    if (civ < 1.5) return kryosHall(p);
    return nihilineHall(p);
  }
  if (kind < 11.5) {
    if (civ < 0.5) return helionHouse(p);
    if (civ < 1.5) return kryosHouse(p);
    return nihilineHouse(p);
  }
  if (kind < 12.5) {
    if (civ < 0.5) return helionBarracks(p);
    if (civ < 1.5) return kryosBarracks(p);
    return nihilineBarracks(p);
  }
  if (civ < 0.5) return helionUnique(p);
  if (civ < 1.5) return kryosUnique(p);
  return nihilineUnique(p);
}

vec3 corpseSprite(vec2 p, float civ, float frame) {
  vec3 col = vec3(0.0);
  if (frame >= 4.5) {
    col = paint(col, INK, inCirc(p, vec2(0.0, 2.0), 8.0));
    if (civ < 0.5) col = paint(col, HIVE, inCirc(p, vec2(-4.0, -2.0), 3.0));
    else if (civ < 1.5) col = paint(col, CRY, inCirc(p, vec2(-4.0, -2.0), 3.0));
    else col = paint(col, VOIDC, inCirc(p, vec2(-4.0, -2.0), 3.0));
    col = paint(col, MAG, inCirc(p, vec2(4.0, -2.0), 2.0));
    return col;
  }
  return unitBody(p, civ, 0.0);
}

vec3 spriteCore(vec2 q, float kind, float civ, float frame) {
  vec3 col = vec3(0.0);
  if (frame >= 4.5 && kind < 9.5) col = corpseSprite(q, civ, frame);
  else if (kind >= 9.5) col = buildingSprite(q, civ, kind);
  else {
    col = unitBody(q, civ, frame);
    vec3 role = unitRole(q, civ, kind, frame);
    if (role != vec3(0.0)) col = role;
  }
  return col;
}

vec3 applyDissolve(vec3 col, vec2 ip, float frame) {
  if (col == vec3(0.0)) return col;
  float hash = mod(ip.x * 17.0 + ip.y * 31.0 + 5.0, 8.0);
  if (frame >= 5.5 && hash < 5.6) return vec3(0.0);
  if (frame >= 4.5 && frame < 5.5 && hash < 2.8) return vec3(0.0);
  return col;
}

void main() {
  float kind = vMeta.x;
  float civ = vMeta.y;
  float frame = vMeta.z;
  float spr = vMeta.w;
  vec2 pt = vec2(vUv.x * spr, (1.0 - vUv.y) * spr);
  vec2 ip = floor(pt);
  vec2 q;
  if (kind >= 9.5) q = pt - vec2(spr * 0.5, 0.0);
  else {
    float bob = mod(floor(frame), 2.0);
    q = vec2(pt.x - spr * 0.5, pt.y - spr * 0.625 - bob);
  }
  vec3 col = applyDissolve(spriteCore(q, kind, civ, frame), ip, frame);
  if (col == vec3(0.0)) discard;
  if (col.r > 0.85 && col.b > 0.85 && col.g < 0.22) col = vTeam;
  col += vec3(vFlash);
  gl_FragColor = vec4(col, 1.0);
}
`;
