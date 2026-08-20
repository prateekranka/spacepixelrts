/** P91/P96 — procedural GLSL terrain (quiet dust + terraced height displacement). */

import * as THREE from 'three';
import { MAP } from './engine';
import { HEIGHT_SCALE } from './height';
import { OPENING_CENTER, OPENING_CORRIDOR, OPENING_MESA } from './opening-presentation';
import type { World } from './sim';
import { STARHOLD_PALETTE as P } from './palette';

function glslColor(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 0xff) / 255;
  const g = ((n >> 8) & 0xff) / 255;
  const b = (n & 0xff) / 255;
  return `vec3(${r.toFixed(3)}, ${g.toFixed(3)}, ${b.toFixed(3)})`;
}

const TC = Object.freeze({
  ink: glslColor(P.ink),
  night: glslColor(P.night),
  deep: glslColor(P.deep),
  shadow: glslColor(P.shadow),
  fog: glslColor(P.fog),
  slate: glslColor(P.slate),
  steel: glslColor(P.steel),
  sky: glslColor(P.sky),
  pale: glslColor(P.pale),
  sand: glslColor(P.sand),
  sienna: glslColor(P.sienna),
  copper: glslColor(P.copper),
  ochre: glslColor(P.ochre),
  amber: glslColor(P.amber),
});

const TERRAIN_VERT = /* glsl */ `
uniform sampler2D uHeight;
uniform float uHeightScale;
uniform vec2 uMapHalf;
varying vec2 vWorld;
varying float vElev;
varying float vSlope;

float sampleH(vec2 w) {
  vec2 uv = clamp(w, vec2(0.0), uMapHalf * 2.0 - vec2(1.0)) / (uMapHalf * 2.0);
  return texture2D(uHeight, uv).r * 3.0;
}

void main() {
  vec4 baseWp = modelMatrix * vec4(position, 1.0);
  vec2 worldXZ = baseWp.xz;
  float hC = sampleH(worldXZ);
  float hX = sampleH(worldXZ + vec2(1.0, 0.0)) - sampleH(worldXZ - vec2(1.0, 0.0));
  float hZ = sampleH(worldXZ + vec2(0.0, 1.0)) - sampleH(worldXZ - vec2(0.0, 1.0));
  vElev = hC / 3.0;
  vSlope = clamp(length(vec2(hX, hZ)) * 0.68, 0.0, 1.0);

  vec3 pos = vec3(position.x, position.y, hC * uHeightScale);
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vWorld = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const TERRAIN_FRAG = /* glsl */ `
uniform sampler2D uTiles;
uniform sampler2D uDecals;
uniform vec2 uMapSize;
uniform vec2 uOpeningCenter;
uniform vec2 uOpeningCorridor;
uniform vec2 uOpeningMesa;
varying vec2 vWorld;
varying float vElev;
varying float vSlope;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float tileType(vec2 world) {
  vec2 tc = clamp(floor(world), vec2(0.0), uMapSize - vec2(1.0));
  vec2 uv = (tc + 0.5) / uMapSize;
  return floor(texture2D(uTiles, uv).r * 255.0 + 0.01);
}

float decalRock(vec2 world) {
  vec2 tc = clamp(floor(world), vec2(0.0), uMapSize - vec2(1.0));
  vec2 uv = (tc + 0.5) / uMapSize;
  return texture2D(uDecals, uv).r;
}

float qElev(vec2 w) {
  float broad = valueNoise(w * 0.04 + vec2(3.7, 1.2));
  float detail = valueNoise(w * 0.07 + vec2(17.3, 8.1));
  return broad * 0.62 + detail * 0.38;
}

float sunRim(vec2 w) {
  float e0 = qElev(w);
  float eLit = qElev(w + vec2(-1.2, -0.9));
  return clamp((eLit - e0) * 1.8, 0.0, 1.0);
}

float boulderMask(vec2 local) {
  vec2 p = local * 32.0 - vec2(16.0, 16.0);
  float d = length(p * vec2(0.92, 1.08));
  float core = 1.0 - smoothstep(9.5, 11.5, d);
  float shade = 1.0 - smoothstep(5.5, 8.5, length(p - vec2(-2.0, 2.0)));
  return clamp(core + shade * 0.35, 0.0, 1.0);
}

vec3 dustColor(vec2 world, float elev, float rim) {
  vec3 base = ${TC.slate};
  vec3 dark = ${TC.fog};
  vec3 deep = ${TC.night};
  vec3 hi = ${TC.steel};
  float terrace = smoothstep(0.12, 0.78, elev);
  vec3 col = mix(deep, base, terrace);
  col = mix(col, dark, (1.0 - terrace) * 0.22);
  col = mix(col, hi, smoothstep(0.45, 0.92, elev) * 0.24);
  col = mix(col, ${TC.sand}, smoothstep(0.76, 0.98, elev) * 0.24);
  col += ${TC.pale} * rim * 0.14;

  // A quiet, camera-readable dust lane anchors the opening clash. The inset
  // edge gives the two camps a clear route without painting a hard rectangle.
  vec2 lane = abs(world - uOpeningCenter) / uOpeningCorridor;
  float laneEdge = smoothstep(0.72, 0.98, max(lane.x, lane.y));
  float laneInside = 1.0 - smoothstep(0.92, 1.02, max(lane.x, lane.y));
  col = mix(col, col + vec3(0.042, 0.030, 0.052), laneInside * 0.62);
  col = mix(col, ${TC.shadow}, laneEdge * 0.42);

  // The opening mesa has an east-facing approach. A short, warm dust strip
  // makes the ramp route legible at the default zoom before a player pans.
  float mesaDx = world.x - uOpeningCenter.x;
  float rampSpan = smoothstep(6.0, 7.2, mesaDx) * (1.0 - smoothstep(14.0, 15.2, mesaDx));
  float rampWidth = 1.0 - smoothstep(0.0, 1.25, abs(world.y - (uOpeningCenter.y + uOpeningMesa.y)));
  col = mix(col, ${TC.sienna}, rampSpan * rampWidth * 0.52);
  return col;
}

vec3 rockColor(vec2 world, float rim, float cliff) {
  vec2 local = fract(world);
  float mask = boulderMask(local);
  vec3 rock = ${TC.slate};
  vec3 rockH = ${TC.steel};
  vec3 ink = ${TC.ink};
  vec3 col = mix(${TC.fog}, rock, mask);
  col = mix(col, rockH, mask * 0.55 * (1.0 - local.y));
  col = mix(col, ink, (1.0 - mask) * 0.08);
  float edge = smoothstep(0.45, 0.72, mask);
  col += ${TC.pale} * rim * edge * 0.18;
  float shadow = smoothstep(0.82, 0.98, local.y) * (1.0 - mask);
  col = mix(col, ${TC.shadow}, shadow * 0.45);
  col = mix(col, ${TC.night}, cliff * 0.55);
  return col;
}

vec3 voidColor(vec2 world) {
  float n = valueNoise(world * 0.08);
  return ${TC.night} + vec3(n * 0.04, n * 0.03, n * 0.05);
}

void main() {
  vec2 world = vWorld;
  float elev = mix(qElev(world), vElev, 0.92);
  float rim = sunRim(world);
  float cliff = smoothstep(0.08, 0.34, vSlope);

  float t = tileType(world);
  float decal = decalRock(world);
  // Cliff rims use the rock atlas. Keep the high plateau interior as dust so
  // the camera reads a continuous top surface above the darker side wall.
  bool isRock = decal > 0.5 || (t > 1.5 && t < 2.5 && (cliff > 0.18 || vElev < 0.20));

  vec3 col;
  if (t < 0.5) {
    col = voidColor(world);
  } else if (isRock) {
    col = rockColor(world, rim, cliff);
  } else {
    col = dustColor(world, elev, rim);
    col = mix(col, ${TC.deep}, cliff * 0.72);
    col += ${TC.steel} * 0.16 * smoothstep(0.42, 0.82, elev);
    if (t > 2.5 && t < 3.5) col = mix(col, ${TC.ochre}, 0.16);
    else if (t > 3.5 && t < 4.5) col = mix(col, ${TC.sky}, 0.14);
    else if (t > 4.5 && t < 5.5) col = mix(col, ${TC.amber}, 0.14);
  }

  gl_FragColor = vec4(col, 1.0);
}
`;

const FOG_VERT = /* glsl */ `
uniform sampler2D uHeight;
uniform float uHeightScale;
uniform float uYOffset;
uniform vec2 uMapHalf;
varying vec2 vUv;

float sampleH(vec2 w) {
  vec2 uv = clamp(w, vec2(0.0), uMapHalf * 2.0 - vec2(1.0)) / (uMapHalf * 2.0);
  return texture2D(uHeight, uv).r * 3.0;
}

void main() {
  vec4 baseWp = modelMatrix * vec4(position, 1.0);
  float h = sampleH(baseWp.xz) * uHeightScale + uYOffset;
  vec3 pos = vec3(position.x, position.y, h);
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vUv = uv;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const FOG_FRAG = /* glsl */ `
uniform sampler2D uFog;
varying vec2 vUv;
void main() {
  gl_FragColor = texture2D(uFog, vUv);
}
`;

function buildTileTexture(world: World): THREE.DataTexture {
  const data = new Uint8Array(MAP * MAP);
  for (let i = 0; i < MAP * MAP; i++) data[i] = world.tiles[i];
  const tex = new THREE.DataTexture(data, MAP, MAP, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function buildHeightTexture(world: World): THREE.DataTexture {
  const data = new Uint8Array(MAP * MAP);
  for (let i = 0; i < MAP * MAP; i++) data[i] = Math.round((world.height[i] / 3) * 255);
  const tex = new THREE.DataTexture(data, MAP, MAP, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

/** Scatter rock decals on opening dust (matches legacy canvas stamp). */
function buildDecalTexture(): THREE.DataTexture {
  const data = new Uint8Array(MAP * MAP);
  const icx = (MAP * 0.5) | 0;
  const icz = (MAP * 0.52) | 0;
  let decals = 0;
  for (let i = 0; decals < 8 && i < 48; i++) {
    const dx = ((i * 17 + 5) % 27) - 13;
    const dz = ((i * 11 + 3) % 20) - 10;
    if (Math.abs(dz) <= 4) continue;
    const tx = icx + dx;
    const tz = icz + dz;
    if (tx < 1 || tz < 1 || tx >= MAP - 2 || tz >= MAP - 2) continue;
    for (let zz = 0; zz < 2; zz++) {
      for (let xx = 0; xx < 2; xx++) {
        data[tx + xx + (tz + zz) * MAP] = 255;
      }
    }
    decals++;
  }
  const tex = new THREE.DataTexture(data, MAP, MAP, THREE.RedFormat, THREE.UnsignedByteType);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}

export function buildTerrainMesh(world: World): THREE.Mesh {
  const tileTex = buildTileTexture(world);
  const heightTex = buildHeightTexture(world);
  const decalTex = buildDecalTexture();
  const half = new THREE.Vector2(MAP / 2, MAP / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTiles: { value: tileTex },
      uDecals: { value: decalTex },
      uHeight: { value: heightTex },
      uHeightScale: { value: HEIGHT_SCALE },
      uMapHalf: { value: half },
      uMapSize: { value: new THREE.Vector2(MAP, MAP) },
      uOpeningCenter: { value: new THREE.Vector2(OPENING_CENTER.x, OPENING_CENTER.z) },
      uOpeningCorridor: {
        value: new THREE.Vector2(OPENING_CORRIDOR.halfW, OPENING_CORRIDOR.halfD),
      },
      uOpeningMesa: { value: new THREE.Vector2(OPENING_MESA.dx, OPENING_MESA.dz) },
    },
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP, MAP, MAP), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(MAP / 2, 0, MAP / 2);
  return mesh;
}

export function buildFogMesh(heightTex: THREE.DataTexture): THREE.Mesh {
  const half = new THREE.Vector2(MAP / 2, MAP / 2);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uHeight: { value: heightTex },
      uHeightScale: { value: HEIGHT_SCALE },
      uYOffset: { value: 0.06 },
      uMapHalf: { value: half },
      uFog: { value: null as unknown as THREE.Texture },
    },
    vertexShader: FOG_VERT,
    fragmentShader: FOG_FRAG,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP, MAP, MAP), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(MAP / 2, 0, MAP / 2);
  return mesh;
}

export { HEIGHT_SCALE };
