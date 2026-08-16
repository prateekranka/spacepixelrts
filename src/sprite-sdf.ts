/** P90 — GPU SDF sprites: distinct role silhouettes + building profiles (no atlas). */

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

bool inTri(vec2 p, vec2 a, vec2 b, vec2 c) {
  float s = (a.x - c.x) * (b.y - c.y) - (b.x - c.x) * (a.y - c.y);
  float s1 = (a.x - p.x) * (b.y - p.y) - (b.x - p.x) * (a.y - p.y);
  float s2 = (b.x - p.x) * (c.y - p.y) - (c.x - p.x) * (b.y - p.y);
  float s3 = (c.x - p.x) * (a.y - p.y) - (a.x - p.x) * (c.y - p.y);
  bool pos = s >= 0.0 && s1 >= 0.0 && s2 >= 0.0 && s3 >= 0.0;
  bool neg = s <= 0.0 && s1 <= 0.0 && s2 <= 0.0 && s3 <= 0.0;
  return pos || neg;
}

bool onLine(vec2 p, vec2 a, vec2 b, float thick) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float denom = dot(ba, ba);
  if (denom < 0.001) return dot(pa, pa) <= thick * thick;
  float h = clamp(dot(pa, ba) / denom, 0.0, 1.0);
  return dot(pa - ba * h, pa - ba * h) <= thick * thick;
}

vec3 paint(vec3 base, vec3 col, bool hit) {
  return hit ? col : base;
}

vec3 paintMag(vec3 base, bool hit) {
  return hit ? MAG : base;
}

vec3 civDark(float civ) {
  if (civ < 0.5) return HIVED;
  if (civ < 1.5) return CRYD;
  return VOIDD;
}

vec3 civMid(float civ) {
  if (civ < 0.5) return HIVE;
  if (civ < 1.5) return CRY;
  return VOIDC;
}

vec3 civHi(float civ) {
  if (civ < 0.5) return HIVEH;
  if (civ < 1.5) return CRYH;
  return VOIDH;
}

// ── Worker: hunched hauler with big ore crate + hard-hat beacon ──────────────
vec3 drawWorker(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);
  vec3 dk = civDark(civ);
  vec3 md = civMid(civ);
  vec3 hi = civHi(civ);

  // Legs (short, planted)
  col = paint(col, dk, inBox(q, vec2(-7.0, 6.0), vec2(-3.0, 13.0)));
  col = paint(col, dk, inBox(q, vec2(-1.0, 7.0), vec2(3.0, 12.0)));
  // Hunched torso
  if (civ < 0.5) col = paint(col, md, inCirc(q, vec2(-4.0, 1.0), 7.0));
  else if (civ < 1.5) col = paint(col, md, inDiam(q, vec2(-4.0, 1.0), 7.0));
  else col = paint(col, md, inBox(q, vec2(-9.0, -3.0), vec2(1.0, 8.0)));
  col = paint(col, hi, inBox(q, vec2(-7.0, -2.0), vec2(-1.0, 4.0)));
  col = paintMag(col, inBox(q, vec2(-6.0, -1.0), vec2(-2.0, 3.0)));
  // Head + hard-hat beacon
  col = paint(col, dk, inCirc(q, vec2(-5.0, -7.0), 4.0));
  col = paint(col, SOLH, inCirc(q, vec2(-5.0, -10.0), 2.0));
  col = paint(col, WHITE, inCirc(q, vec2(-5.0, -10.0), 1.0));
  // BIG ore crate (dominant right-side read — taller than body)
  col = paint(col, ORE, inBox(q, vec2(1.0, -14.0), vec2(16.0, 4.0)));
  col = paint(col, OREH, inBox(q, vec2(2.0, -13.0), vec2(15.0, -5.0)));
  col = paint(col, WHITE, inBox(q, vec2(5.0, -11.0), vec2(9.0, -3.0)));
  col = paint(col, BONE, inBox(q, vec2(3.0, -7.0), vec2(11.0, -4.0)));
  col = paint(col, INK, inBox(q, vec2(1.0, -14.0), vec2(16.0, -13.0)));
  col = paint(col, INK, inBox(q, vec2(16.0, -14.0), vec2(17.0, 4.0)));
  // Mining drill arm (left)
  col = paint(col, BONE, onLine(q, vec2(-8.0, 0.0), vec2(-13.0, -6.0), 1.2));
  col = paint(col, ROCKH, onLine(q, vec2(-13.0, -6.0), vec2(-15.0, -9.0), 1.0));
  // Ink outline
  col = paint(col, INK, onLine(q, vec2(2.0, 3.0), vec2(15.0, 3.0), 0.6));
  col = paint(col, INK, onLine(q, vec2(15.0, 3.0), vec2(15.0, -11.0), 0.6));
  col = paint(col, INK, onLine(q, vec2(15.0, -11.0), vec2(2.0, -11.0), 0.6));
  return col;
}

// ── Scout: lean speed hull, sensor dish, exhaust glow ──────────────────────
vec3 drawScout(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);
  vec3 dk = civDark(civ);
  vec3 md = civMid(civ);
  vec3 hi = civHi(civ);

  // Low wedge hull (horizontal silhouette)
  if (civ < 0.5) {
    col = paint(col, dk, inTri(q, vec2(-14.0, 4.0), vec2(14.0, 0.0), vec2(-10.0, 8.0)));
    col = paint(col, md, inTri(q, vec2(-12.0, 3.0), vec2(12.0, 1.0), vec2(-8.0, 6.0)));
  } else if (civ < 1.5) {
    col = paint(col, dk, inBox(q, vec2(-14.0, 2.0), vec2(14.0, 7.0)));
    col = paint(col, md, inTri(q, vec2(14.0, 1.0), vec2(16.0, 4.0), vec2(14.0, 7.0)));
    col = paint(col, CRYH, inDiam(q, vec2(0.0, 4.0), 5.0));
  } else {
    col = paint(col, dk, inBox(q, vec2(-13.0, 3.0), vec2(13.0, 8.0)));
    col = paint(col, VOIDD, inBox(q, vec2(8.0, 1.0), vec2(15.0, 6.0)));
    col = paint(col, md, inBox(q, vec2(-11.0, 4.0), vec2(10.0, 7.0)));
  }
  // Pointed nose (facing right)
  col = paint(col, hi, inTri(q, vec2(10.0, 2.0), vec2(16.0, 4.0), vec2(10.0, 6.0)));
  col = paint(col, WHITE, inCirc(q, vec2(14.0, 4.0), 1.0));
  // Sensor dish (left-front, big read)
  col = paint(col, WHITE, inCirc(q, vec2(-12.0, -2.0), 5.0));
  col = paint(col, hi, inCirc(q, vec2(-12.0, -2.0), 3.0));
  col = paint(col, INK, inCirc(q, vec2(-12.0, -2.0), 5.5) && !inCirc(q, vec2(-12.0, -2.0), 4.5));
  // Engine exhaust (rear-left glow)
  col = paint(col, SOLH, inBox(q, vec2(-16.0, 3.0), vec2(-12.0, 7.0)));
  col = paint(col, SOL, inBox(q, vec2(-15.0, 4.0), vec2(-13.0, 6.0)));
  // Wing fin
  col = paint(col, dk, onLine(q, vec2(-6.0, -4.0), vec2(4.0, -7.0), 1.2));
  col = paint(col, INK, onLine(q, vec2(-14.0, 8.0), vec2(14.0, 7.0), 0.5));
  return col;
}

// ── Fighter: braced gunner, rifle/spear pointing right ─────────────────────
vec3 drawFighter(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);
  vec3 dk = civDark(civ);
  vec3 md = civMid(civ);
  vec3 hi = civHi(civ);

  // Legs (braced stance)
  col = paint(col, dk, inBox(q, vec2(-5.0, 7.0), vec2(-1.0, 14.0)));
  col = paint(col, dk, inBox(q, vec2(1.0, 6.0), vec2(5.0, 13.0)));
  // Torso
  if (civ < 0.5) col = paint(col, md, inHex(q, vec2(-1.0, -1.0), 8.0));
  else if (civ < 1.5) col = paint(col, md, inDiam(q, vec2(-1.0, -1.0), 8.0));
  else col = paint(col, md, inBox(q, vec2(-6.0, -5.0), vec2(4.0, 5.0)));
  col = paintMag(col, inBox(q, vec2(-4.0, -3.0), vec2(2.0, 2.0)));
  col = paint(col, hi, inBox(q, vec2(-3.0, -2.0), vec2(1.0, 1.0)));
  // Shoulder armor (wide read)
  col = paint(col, dk, inBox(q, vec2(-8.0, -6.0), vec2(-4.0, -1.0)));
  col = paint(col, dk, inBox(q, vec2(2.0, -7.0), vec2(6.0, -2.0)));
  col = paint(col, hi, inCirc(q, vec2(-6.0, -3.0), 2.0));
  col = paint(col, hi, inCirc(q, vec2(4.0, -4.0), 2.0));
  // Head / helmet
  col = paint(col, dk, inCirc(q, vec2(-1.0, -10.0), 4.0));
  col = paint(col, BONE, inBox(q, vec2(-3.0, -11.0), vec2(1.0, -9.0)));
  // Rifle barrel (dominant forward weapon)
  col = paint(col, BONE, onLine(q, vec2(4.0, -2.0), vec2(17.0, -4.0), 1.5));
  col = paint(col, ROCK, onLine(q, vec2(4.0, -2.0), vec2(14.0, -3.5), 1.0));
  col = paint(col, INK, onLine(q, vec2(17.0, -4.0), vec2(17.0, -4.0), 1.0));
  col = paint(col, ROCKH, inBox(q, vec2(2.0, -4.0), vec2(6.0, 0.0)));
  // Stock
  col = paint(col, BONE, onLine(q, vec2(0.0, -1.0), vec2(-4.0, 2.0), 1.2));
  col = paint(col, INK, onLine(q, vec2(-5.0, 14.0), vec2(5.0, 13.0), 0.5));
  return col;
}

// ── Siege: treaded tank with elevated cannon ─────────────────────────────────
vec3 drawSiege(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);
  vec3 dk = civDark(civ);
  vec3 md = civMid(civ);
  vec3 hi = civHi(civ);

  // Treads (very wide bottom — tank read)
  col = paint(col, ROCK, inBox(q, vec2(-14.0, 6.0), vec2(14.0, 12.0)));
  col = paint(col, ROCKH, inBox(q, vec2(-12.0, 7.0), vec2(12.0, 10.0)));
  col = paint(col, INK, inCirc(q, vec2(-10.0, 9.0), 3.0));
  col = paint(col, INK, inCirc(q, vec2(10.0, 9.0), 3.0));
  col = paint(col, ROCKH, inCirc(q, vec2(-10.0, 9.0), 2.0));
  col = paint(col, ROCKH, inCirc(q, vec2(10.0, 9.0), 2.0));
  // Hull
  if (civ < 0.5) col = paint(col, md, inHex(q, vec2(0.0, 0.0), 10.0));
  else if (civ < 1.5) col = paint(col, md, inBox(q, vec2(-10.0, -4.0), vec2(10.0, 5.0)));
  else col = paint(col, md, inBox(q, vec2(-11.0, -5.0), vec2(9.0, 4.0)));
  col = paintMag(col, inBox(q, vec2(-4.0, -2.0), vec2(4.0, 2.0)));
  // Turret
  col = paint(col, dk, inBox(q, vec2(-6.0, -8.0), vec2(6.0, -3.0)));
  col = paint(col, hi, inBox(q, vec2(-4.0, -7.0), vec2(4.0, -4.0)));
  // Big cannon (elevated, pointing right-up)
  col = paint(col, ROCK, onLine(q, vec2(4.0, -6.0), vec2(18.0, -12.0), 2.0));
  col = paint(col, ROCKH, onLine(q, vec2(4.0, -6.0), vec2(16.0, -11.0), 1.2));
  col = paint(col, INK, onLine(q, vec2(18.0, -12.0), vec2(18.0, -12.0), 1.5));
  col = paint(col, ORE, inBox(q, vec2(15.0, -13.0), vec2(19.0, -10.0)));
  // Civ accents
  if (civ < 0.5) col = paint(col, hi, inCirc(q, vec2(0.0, -1.0), 3.0));
  else if (civ < 1.5) col = paint(col, CRYH, inDiam(q, vec2(0.0, -1.0), 3.0));
  else col = paint(col, VOIDH, inBox(q, vec2(-2.0, -1.0), vec2(2.0, 2.0)));
  return col;
}

// ── Ravager (vespari): frenzied beast, scythe claws lunging forward ──────────
vec3 drawRavager(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);
  float lunge = mod(floor(frame), 2.0) * 1.5;

  // Low beast body
  col = paint(col, HIVED, inHex(q, vec2(-2.0, 2.0), 9.0));
  col = paint(col, BLOOD, inHex(q, vec2(-2.0, 1.0), 7.0));
  col = paint(col, HIVE, inHex(q, vec2(-2.0, 0.0), 5.0));
  col = paintMag(col, inBox(q, vec2(-3.0, -2.0), vec2(3.0, 2.0)));
  // Head / maw
  col = paint(col, HIVED, inCirc(q, vec2(2.0, -5.0), 5.0));
  col = paint(col, BLOOD, inBox(q, vec2(0.0, -6.0), vec2(6.0, -4.0)));
  col = paint(col, WHITE, inCirc(q, vec2(4.0, -5.0), 1.0));
  // Scythe claw arms (lunging forward)
  col = paint(col, BONE, onLine(q, vec2(-4.0, -2.0), vec2(-14.0 - lunge, -10.0), 1.5));
  col = paint(col, BONE, onLine(q, vec2(2.0, -1.0), vec2(14.0 + lunge, -8.0), 1.5));
  col = paint(col, SOLH, onLine(q, vec2(-14.0 - lunge, -10.0), vec2(-16.0 - lunge, -14.0), 1.8));
  col = paint(col, SOLH, onLine(q, vec2(14.0 + lunge, -8.0), vec2(16.0 + lunge, -12.0), 1.8));
  // Hind legs
  col = paint(col, HIVED, inBox(q, vec2(-8.0, 6.0), vec2(-4.0, 12.0)));
  col = paint(col, HIVED, inBox(q, vec2(2.0, 7.0), vec2(6.0, 11.0)));
  col = paint(col, INK, onLine(q, vec2(-8.0, 12.0), vec2(6.0, 11.0), 0.5));
  return col;
}

// ── Prism (aurion): floating crystal, focus lens, beam weapon ──────────────
vec3 drawPrism(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);
  float hover = mod(floor(frame), 2.0) * -1.0;
  vec2 h = vec2(0.0, hover);

  // Floating crystal body (diamond — no legs)
  col = paint(col, CRYD, inDiam(q + h, vec2(0.0, -2.0), 12.0));
  col = paint(col, CRY, inDiam(q + h, vec2(0.0, -3.0), 10.0));
  col = paint(col, CRYH, inDiam(q + h, vec2(0.0, -4.0), 6.0));
  col = paint(col, WHITE, inDiam(q + h, vec2(0.0, -5.0), 3.0));
  col = paintMag(col, inBox(q + h, vec2(-3.0, -4.0), vec2(3.0, 0.0)));
  // Focus lens (front)
  col = paint(col, WHITE, inCirc(q + h, vec2(0.0, -8.0), 3.0));
  col = paint(col, CRYH, inCirc(q + h, vec2(0.0, -8.0), 2.0));
  // Beam weapon (pointing right)
  col = paint(col, CRYH, onLine(q + h, vec2(4.0, -4.0), vec2(17.0, -6.0), 1.2));
  col = paint(col, WHITE, onLine(q + h, vec2(8.0, -4.5), vec2(16.0, -6.0), 0.6));
  // Hover stabilizers
  col = paint(col, CRYD, inBox(q + h, vec2(-11.0, 4.0), vec2(-7.0, 6.0)));
  col = paint(col, CRYD, inBox(q + h, vec2(7.0, 4.0), vec2(11.0, 6.0)));
  col = paint(col, INK, onLine(q + h, vec2(-12.0, 6.0), vec2(12.0, 6.0), 0.5));
  return col;
}

// ── Shade (voidmarked): cloaked infiltrator, tatters + glowing eye ──────────
vec3 drawShade(vec2 q, float civ, float frame) {
  vec3 col = vec3(0.0);

  // Tattered cloak (asymmetric, thin vertical)
  col = paint(col, VOIDD, inBox(q, vec2(-5.0, -12.0), vec2(3.0, 12.0)));
  col = paint(col, VOIDC, inBox(q, vec2(-4.0, -10.0), vec2(2.0, 10.0)));
  // Tatter fringes (asymmetric void read)
  col = paint(col, VOIDD, inTri(q, vec2(-5.0, 10.0), vec2(-9.0, 14.0), vec2(-3.0, 12.0)));
  col = paint(col, VOIDD, inTri(q, vec2(3.0, 8.0), vec2(8.0, 13.0), vec2(4.0, 11.0)));
  col = paint(col, VOIDD, inTri(q, vec2(-2.0, -12.0), vec2(-7.0, -16.0), vec2(0.0, -13.0)));
  col = paint(col, VOIDH, inTri(q, vec2(2.0, -11.0), vec2(7.0, -15.0), vec2(3.0, -13.0)));
  // Hood
  col = paint(col, VOIDD, inCirc(q, vec2(-1.0, -10.0), 5.0));
  col = paint(col, VOIDC, inCirc(q, vec2(-1.0, -10.0), 3.0));
  // ONE glowing eye (signature read)
  col = paint(col, VOIDH, inCirc(q, vec2(0.0, -10.0), 2.0));
  col = paint(col, WHITE, inCirc(q, vec2(1.0, -10.0), 1.0));
  col = paintMag(col, inBox(q, vec2(-2.0, -4.0), vec2(1.0, 0.0)));
  // Dagger (subtle, forward)
  col = paint(col, BONE, onLine(q, vec2(2.0, 0.0), vec2(12.0, -3.0), 0.8));
  col = paint(col, INK, onLine(q, vec2(12.0, -3.0), vec2(14.0, -4.0), 0.6));
  return col;
}

vec3 unitBody(vec2 p, float civ, float frame) {
  // Corpses only — living units drawn entirely in unitRole.
  vec3 col = vec3(0.0);
  float bob = mod(floor(frame), 2.0);
  vec2 q = p - vec2(0.0, bob);
  col = paint(col, INK, inBox(q, vec2(-10.0, 4.0), vec2(10.0, 8.0)));
  col = paint(col, civDark(civ), inBox(q, vec2(-8.0, 2.0), vec2(8.0, 6.0)));
  col = paint(col, civMid(civ), inCirc(q, vec2(-4.0, 0.0), 4.0));
  col = paint(col, MAG, inCirc(q, vec2(4.0, 1.0), 2.0));
  return col;
}

vec3 unitRole(vec2 p, float civ, float kind, float frame) {
  float bob = mod(floor(frame), 2.0);
  vec2 q = p - vec2(0.0, bob);
  vec3 col = vec3(0.0);

  if (kind < 0.5) col = drawWorker(q, civ, frame);
  else if (kind < 1.5) col = drawScout(q, civ, frame);
  else if (kind < 2.5) col = drawFighter(q, civ, frame);
  else if (kind < 3.5) col = drawSiege(q, civ, frame);
  else if (kind < 4.5) col = drawRavager(q, civ, frame);
  else if (kind < 5.5) col = drawPrism(q, civ, frame);
  else col = drawShade(q, civ, frame);

  if (frame >= 2.5 && frame < 3.5) {
    col = paint(col, WHITE, inCirc(q, vec2(14.0, -6.0), 3.0));
    col = paint(col, SOLH, inCirc(q, vec2(15.0, -6.0), 2.0));
  }
  return col;
}

// ── Buildings: hall (64px, y = up from bottom anchor) ────────────────────────

vec3 helionHall(vec2 p) {
  vec3 col = vec3(0.0);
  // Stone foundation + walls
  col = paint(col, HIVED, inBox(p, vec2(-20.0, 0.0), vec2(20.0, 22.0)));
  col = paint(col, HIVE, inBox(p, vec2(-17.0, 4.0), vec2(17.0, 20.0)));
  // Domed roof (sits on walls — not a flat face)
  col = paint(col, HIVED, inCirc(p, vec2(0.0, 34.0), 20.0));
  col = paint(col, HIVE, inCirc(p, vec2(0.0, 32.0), 16.0));
  col = paint(col, HIVEH, inCirc(p, vec2(-7.0, 36.0), 6.0));
  // Side hive pods
  col = paint(col, HIVED, inCirc(p, vec2(-20.0, 16.0), 8.0));
  col = paint(col, HIVED, inCirc(p, vec2(20.0, 16.0), 8.0));
  // Central spire mast
  col = paint(col, HIVE, inBox(p, vec2(-3.0, 38.0), vec2(3.0, 52.0)));
  col = paint(col, HIVEH, inCirc(p, vec2(0.0, 54.0), 5.0));
  col = paint(col, SOLH, inCirc(p, vec2(0.0, 58.0), 2.0));
  // Arched door (small team-color panel)
  col = paint(col, INK, inBox(p, vec2(-6.0, 4.0), vec2(6.0, 16.0)));
  col = paint(col, BONE, inBox(p, vec2(-4.0, 6.0), vec2(4.0, 14.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 7.0), vec2(3.0, 12.0)));
  col = paint(col, HIVEH, inCirc(p, vec2(0.0, 14.0), 4.0));
  // Pillars + windows
  if (abs(p.x + 11.0) <= 1.0 && p.y >= 8.0 && p.y <= 20.0) col = INK;
  if (abs(p.x - 11.0) <= 1.0 && p.y >= 8.0 && p.y <= 20.0) col = INK;
  col = paint(col, SOLH, inBox(p, vec2(-16.0, 12.0), vec2(-13.0, 16.0)));
  col = paint(col, SOLH, inBox(p, vec2(13.0, 12.0), vec2(16.0, 16.0)));
  return col;
}

vec3 kryosHall(vec2 p) {
  vec3 col = vec3(0.0);
  // Angular platform + walls
  col = paint(col, CRYD, inBox(p, vec2(-22.0, 0.0), vec2(22.0, 8.0)));
  col = paint(col, CRYD, inBox(p, vec2(-18.0, 8.0), vec2(18.0, 24.0)));
  col = paint(col, CRY, inBox(p, vec2(-15.0, 10.0), vec2(15.0, 22.0)));
  // Faceted roof tiers
  col = paint(col, CRYD, inTri(p, vec2(0.0, 40.0), vec2(-20.0, 24.0), vec2(20.0, 24.0)));
  col = paint(col, CRY, inTri(p, vec2(0.0, 34.0), vec2(-14.0, 25.0), vec2(14.0, 25.0)));
  col = paint(col, CRYH, inTri(p, vec2(0.0, 28.0), vec2(-8.0, 26.0), vec2(8.0, 26.0)));
  // Crystal spire
  col = paint(col, CRYD, inTri(p, vec2(0.0, 58.0), vec2(-5.0, 34.0), vec2(5.0, 34.0)));
  col = paint(col, WHITE, inTri(p, vec2(0.0, 50.0), vec2(-2.0, 36.0), vec2(2.0, 36.0)));
  // Buttresses
  col = paint(col, CRYD, inBox(p, vec2(-24.0, 10.0), vec2(-18.0, 26.0)));
  col = paint(col, CRYD, inBox(p, vec2(18.0, 10.0), vec2(24.0, 26.0)));
  // Door
  col = paint(col, INK, inBox(p, vec2(-5.0, 4.0), vec2(5.0, 18.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 6.0), vec2(3.0, 14.0)));
  col = paint(col, CRYH, inBox(p, vec2(-1.0, 9.0), vec2(1.0, 12.0)));
  col = paint(col, SOLH, inBox(p, vec2(-14.0, 14.0), vec2(-11.0, 18.0)));
  col = paint(col, SOLH, inBox(p, vec2(11.0, 14.0), vec2(14.0, 18.0)));
  return col;
}

vec3 nihilineHall(vec2 p) {
  vec3 col = vec3(0.0);
  // Tattered tower base
  col = paint(col, VOIDD, inBox(p, vec2(-20.0, 0.0), vec2(20.0, 10.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-16.0, 8.0), vec2(16.0, 36.0)));
  col = paint(col, VOIDD, inBox(p, vec2(-10.0, 4.0), vec2(10.0, 30.0)));
  // Asymmetric spire fragments
  col = paint(col, VOIDD, inTri(p, vec2(-4.0, 50.0), vec2(-14.0, 28.0), vec2(2.0, 30.0)));
  col = paint(col, VOIDC, inTri(p, vec2(6.0, 54.0), vec2(12.0, 26.0), vec2(0.0, 32.0)));
  col = paint(col, VOIDH, inCirc(p, vec2(2.0, 48.0), 4.0));
  // Tendril wings
  col = paint(col, VOIDD, inBox(p, vec2(-28.0, 16.0), vec2(-18.0, 22.0)));
  col = paint(col, VOIDD, inBox(p, vec2(18.0, 14.0), vec2(30.0, 24.0)));
  col = paint(col, VOIDH, inCirc(p, vec2(-30.0, 20.0), 3.0));
  col = paint(col, VOIDH, inCirc(p, vec2(30.0, 18.0), 3.0));
  // Door (void portal)
  col = paint(col, INK, inBox(p, vec2(-6.0, 4.0), vec2(6.0, 18.0)));
  col = paintMag(col, inBox(p, vec2(-4.0, 6.0), vec2(4.0, 16.0)));
  col = paint(col, VOIDH, inCirc(p, vec2(0.0, 12.0), 3.0));
  return col;
}

vec3 helionHouse(vec2 p) {
  vec3 col = vec3(0.0);
  // Rectangular walls
  col = paint(col, HIVED, inBox(p, vec2(-10.0, 0.0), vec2(10.0, 13.0)));
  col = paint(col, HIVE, inBox(p, vec2(-8.0, 2.0), vec2(8.0, 11.0)));
  // Domed roof (clearly above walls)
  col = paint(col, HIVED, inCirc(p, vec2(0.0, 20.0), 11.0));
  col = paint(col, HIVE, inCirc(p, vec2(0.0, 19.0), 9.0));
  col = paint(col, HIVEH, inCirc(p, vec2(-2.0, 22.0), 3.0));
  col = paint(col, INK, inBox(p, vec2(-10.0, 13.0), vec2(10.0, 14.0)));
  // Door (narrow team panel)
  col = paint(col, INK, inBox(p, vec2(-3.0, 2.0), vec2(3.0, 9.0)));
  col = paint(col, BONE, inBox(p, vec2(-2.0, 3.0), vec2(2.0, 8.0)));
  col = paintMag(col, inBox(p, vec2(-2.0, 4.0), vec2(2.0, 7.0)));
  col = paint(col, HIVEH, inCirc(p, vec2(0.0, 8.0), 3.0));
  // Lit window
  col = paint(col, SOLH, inBox(p, vec2(5.0, 6.0), vec2(8.0, 10.0)));
  col = paint(col, INK, inBox(p, vec2(5.0, 6.0), vec2(8.0, 6.5)));
  if (abs(p.x + 7.0) <= 0.5 && p.y >= 3.0 && p.y <= 11.0) col = INK;
  if (abs(p.x - 7.0) <= 0.5 && p.y >= 3.0 && p.y <= 11.0) col = INK;
  return col;
}

vec3 kryosHouse(vec2 p) {
  vec3 col = vec3(0.0);
  col = paint(col, CRYD, inBox(p, vec2(-10.0, 0.0), vec2(10.0, 12.0)));
  col = paint(col, CRY, inBox(p, vec2(-8.0, 2.0), vec2(8.0, 10.0)));
  // Sharp pitched crystal roof
  col = paint(col, CRYD, inTri(p, vec2(0.0, 26.0), vec2(-11.0, 12.0), vec2(11.0, 12.0)));
  col = paint(col, CRY, inTri(p, vec2(0.0, 22.0), vec2(-8.0, 13.0), vec2(8.0, 13.0)));
  col = paint(col, CRYH, inTri(p, vec2(0.0, 18.0), vec2(-4.0, 13.0), vec2(4.0, 13.0)));
  col = paint(col, INK, inBox(p, vec2(-10.0, 12.0), vec2(10.0, 13.0)));
  col = paint(col, INK, inBox(p, vec2(-3.0, 2.0), vec2(3.0, 9.0)));
  col = paintMag(col, inBox(p, vec2(-2.0, 4.0), vec2(2.0, 8.0)));
  col = paint(col, WHITE, inDiam(p, vec2(6.0, 6.0), 2.5));
  col = paint(col, CRYH, inDiam(p, vec2(6.0, 6.0), 1.5));
  return col;
}

vec3 nihilineHouse(vec2 p) {
  vec3 col = vec3(0.0);
  // Crooked walls
  col = paint(col, VOIDD, inBox(p, vec2(-12.0, 0.0), vec2(10.0, 14.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-10.0, 2.0), vec2(8.0, 12.0)));
  // Asymmetric tattered roof
  col = paint(col, VOIDD, inTri(p, vec2(-2.0, 24.0), vec2(-14.0, 13.0), vec2(6.0, 14.0)));
  col = paint(col, VOIDC, inTri(p, vec2(4.0, 22.0), vec2(12.0, 14.0), vec2(2.0, 14.0)));
  // Door
  col = paint(col, INK, inBox(p, vec2(-4.0, 2.0), vec2(4.0, 10.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 3.0), vec2(3.0, 9.0)));
  // Glowing window slit
  col = paint(col, VOIDH, inBox(p, vec2(4.0, 7.0), vec2(8.0, 10.0)));
  if (p.x <= -8.0 && p.x >= -12.0 && p.y >= 6.0 && p.y <= 10.0) col = VOIDH;
  return col;
}

vec3 helionBarracks(vec2 p) {
  vec3 col = vec3(0.0);
  // Fort walls + flat roof deck
  col = paint(col, HIVED, inBox(p, vec2(-14.0, 0.0), vec2(14.0, 16.0)));
  col = paint(col, HIVE, inBox(p, vec2(-12.0, 2.0), vec2(12.0, 14.0)));
  // Crenellations (military silhouette)
  col = paint(col, HIVED, inBox(p, vec2(-14.0, 16.0), vec2(-10.0, 20.0)));
  col = paint(col, HIVED, inBox(p, vec2(-4.0, 16.0), vec2(0.0, 20.0)));
  col = paint(col, HIVED, inBox(p, vec2(6.0, 16.0), vec2(10.0, 20.0)));
  col = paint(col, HIVED, inBox(p, vec2(12.0, 16.0), vec2(14.0, 20.0)));
  // Arched gate
  col = paint(col, INK, inBox(p, vec2(-5.0, 2.0), vec2(5.0, 13.0)));
  col = paint(col, BONE, inBox(p, vec2(-4.0, 3.0), vec2(4.0, 12.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 4.0), vec2(3.0, 10.0)));
  col = paint(col, HIVEH, inCirc(p, vec2(0.0, 12.0), 5.0));
  // Weapon racks (spears flanking gate)
  col = paint(col, BONE, onLine(p, vec2(-10.0, 5.0), vec2(-10.0, 17.0), 0.9));
  col = paint(col, BONE, onLine(p, vec2(10.0, 5.0), vec2(10.0, 17.0), 0.9));
  col = paint(col, ROCKH, inBox(p, vec2(-11.0, 15.0), vec2(-9.0, 17.0)));
  col = paint(col, ROCKH, inBox(p, vec2(9.0, 15.0), vec2(11.0, 17.0)));
  // Banner pole
  col = paint(col, BONE, onLine(p, vec2(0.0, 20.0), vec2(0.0, 27.0), 0.7));
  col = paint(col, HIVEH, inBox(p, vec2(1.0, 22.0), vec2(6.0, 26.0)));
  return col;
}

vec3 kryosBarracks(vec2 p) {
  vec3 col = vec3(0.0);
  // Angular fortress
  col = paint(col, CRYD, inBox(p, vec2(-14.0, 0.0), vec2(14.0, 16.0)));
  col = paint(col, CRY, inBox(p, vec2(-12.0, 2.0), vec2(12.0, 14.0)));
  // Angular battlements
  col = paint(col, CRYD, inTri(p, vec2(-12.0, 22.0), vec2(-14.0, 16.0), vec2(-8.0, 16.0)));
  col = paint(col, CRYD, inTri(p, vec2(0.0, 24.0), vec2(-3.0, 16.0), vec2(3.0, 16.0)));
  col = paint(col, CRYD, inTri(p, vec2(12.0, 22.0), vec2(8.0, 16.0), vec2(14.0, 16.0)));
  // Gate
  col = paint(col, INK, inBox(p, vec2(-5.0, 2.0), vec2(5.0, 13.0)));
  col = paintMag(col, inBox(p, vec2(-4.0, 3.0), vec2(4.0, 12.0)));
  // Crossed blades on face
  col = paint(col, BONE, onLine(p, vec2(-9.0, 5.0), vec2(-3.0, 15.0), 0.8));
  col = paint(col, BONE, onLine(p, vec2(9.0, 5.0), vec2(3.0, 15.0), 0.8));
  col = paint(col, CRYH, inBox(p, vec2(-1.0, 20.0), vec2(3.0, 25.0)));
  if (abs(p.x) <= 0.5 && p.y >= 16.0 && p.y <= 22.0) col = WHITE;
  return col;
}

vec3 nihilineBarracks(vec2 p) {
  vec3 col = vec3(0.0);
  // Dark fort
  col = paint(col, VOIDD, inBox(p, vec2(-15.0, 0.0), vec2(15.0, 16.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-12.0, 2.0), vec2(12.0, 14.0)));
  // Jagged top
  col = paint(col, VOIDD, inTri(p, vec2(-10.0, 22.0), vec2(-14.0, 16.0), vec2(-6.0, 16.0)));
  col = paint(col, VOIDD, inTri(p, vec2(8.0, 24.0), vec2(4.0, 16.0), vec2(14.0, 16.0)));
  // Gate
  col = paint(col, INK, inBox(p, vec2(-5.0, 2.0), vec2(5.0, 12.0)));
  col = paintMag(col, inBox(p, vec2(-4.0, 3.0), vec2(4.0, 11.0)));
  // Shadow weapon silhouettes
  col = paint(col, VOIDH, onLine(p, vec2(-10.0, 5.0), vec2(-10.0, 15.0), 0.7));
  col = paint(col, VOIDH, onLine(p, vec2(10.0, 5.0), vec2(10.0, 15.0), 0.7));
  if (p.x <= -6.0 && p.x >= -12.0 && p.y >= 8.0 && p.y <= 12.0) col = VOIDH;
  if (p.x >= 6.0 && p.x <= 12.0 && p.y >= 10.0 && p.y <= 14.0) col = VOIDH;
  return col;
}

// Unique: Spore Nursery / Refraction Spire / Umbra Relay
vec3 helionUnique(vec2 p) {
  vec3 col = vec3(0.0);
  // Spore Nursery — bulbous organic pods
  col = paint(col, HIVED, inBox(p, vec2(-12.0, 0.0), vec2(12.0, 8.0)));
  col = paint(col, HIVED, inCirc(p, vec2(-7.0, 16.0), 9.0));
  col = paint(col, HIVED, inCirc(p, vec2(7.0, 14.0), 8.0));
  col = paint(col, HIVE, inCirc(p, vec2(0.0, 20.0), 10.0));
  col = paint(col, SOL, inCirc(p, vec2(-7.0, 16.0), 5.0));
  col = paint(col, SOL, inCirc(p, vec2(7.0, 14.0), 4.0));
  col = paint(col, SOLH, inCirc(p, vec2(0.0, 22.0), 4.0));
  // Spore tendrils
  col = paint(col, HIVEH, onLine(p, vec2(0.0, 28.0), vec2(0.0, 34.0), 1.0));
  col = paint(col, SOLH, inCirc(p, vec2(0.0, 34.0), 2.0));
  // Door
  col = paint(col, INK, inBox(p, vec2(-4.0, 2.0), vec2(4.0, 9.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 3.0), vec2(3.0, 8.0)));
  if (abs(p.x) <= 0.5 && p.y >= 10.0 && p.y <= 18.0) col = SOLH;
  return col;
}

vec3 kryosUnique(vec2 p) {
  vec3 col = vec3(0.0);
  // Refraction Spire — tall prismatic tower
  col = paint(col, CRYD, inBox(p, vec2(-10.0, 0.0), vec2(10.0, 6.0)));
  col = paint(col, CRYD, inTri(p, vec2(0.0, 38.0), vec2(-8.0, 8.0), vec2(8.0, 8.0)));
  col = paint(col, CRY, inTri(p, vec2(0.0, 32.0), vec2(-5.0, 10.0), vec2(5.0, 10.0)));
  col = paint(col, CRYH, inTri(p, vec2(0.0, 26.0), vec2(-3.0, 12.0), vec2(3.0, 12.0)));
  col = paint(col, WHITE, inTri(p, vec2(0.0, 20.0), vec2(-2.0, 14.0), vec2(2.0, 14.0)));
  // Refracting fins
  col = paint(col, CRYD, inTri(p, vec2(-14.0, 16.0), vec2(-8.0, 10.0), vec2(-8.0, 20.0)));
  col = paint(col, CRYD, inTri(p, vec2(14.0, 16.0), vec2(8.0, 10.0), vec2(8.0, 20.0)));
  col = paint(col, CRYH, inBox(p, vec2(-2.0, 34.0), vec2(2.0, 38.0)));
  // Door
  col = paint(col, INK, inBox(p, vec2(-4.0, 2.0), vec2(4.0, 9.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 3.0), vec2(3.0, 8.0)));
  if (abs(p.x) <= 0.5 && p.y >= 8.0 && p.y <= 30.0) col = CRYH;
  return col;
}

vec3 nihilineUnique(vec2 p) {
  vec3 col = vec3(0.0);
  // Umbra Relay — void antenna with orb
  col = paint(col, VOIDD, inBox(p, vec2(-10.0, 0.0), vec2(10.0, 8.0)));
  col = paint(col, VOIDD, inBox(p, vec2(-3.0, 8.0), vec2(3.0, 24.0)));
  col = paint(col, VOIDC, inBox(p, vec2(-2.0, 10.0), vec2(2.0, 22.0)));
  // Orb crown
  col = paint(col, VOIDD, inCirc(p, vec2(0.0, 28.0), 10.0));
  col = paint(col, VOIDH, inCirc(p, vec2(0.0, 28.0), 6.0));
  col = paint(col, WHITE, inCirc(p, vec2(2.0, 30.0), 2.0));
  // Tendril receivers
  col = paint(col, VOIDD, onLine(p, vec2(-3.0, 20.0), vec2(-14.0, 26.0), 1.0));
  col = paint(col, VOIDD, onLine(p, vec2(3.0, 18.0), vec2(14.0, 24.0), 1.0));
  col = paint(col, VOIDH, inCirc(p, vec2(-14.0, 26.0), 2.0));
  col = paint(col, VOIDH, inCirc(p, vec2(14.0, 24.0), 2.0));
  // Door
  col = paint(col, INK, inBox(p, vec2(-4.0, 2.0), vec2(4.0, 7.0)));
  col = paintMag(col, inBox(p, vec2(-3.0, 3.0), vec2(3.0, 6.0)));
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
  else col = unitRole(q, civ, kind, frame);
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
