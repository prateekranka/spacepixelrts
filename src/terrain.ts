/** P91 — procedural GLSL terrain (quiet dust field, large-scale value weather). */

import * as THREE from 'three';
import { MAP } from './engine';
import type { World } from './sim';

const TERRAIN_VERT = /* glsl */ `
varying vec2 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const TERRAIN_FRAG = /* glsl */ `
uniform sampler2D uTiles;
uniform sampler2D uDecals;
uniform vec2 uMapSize;
uniform vec2 uOpenCenter;
varying vec2 vWorld;

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
  vec3 base = vec3(0.400, 0.345, 0.425);
  vec3 dark = vec3(0.378, 0.325, 0.400);
  vec3 deep = vec3(0.362, 0.312, 0.388);
  vec3 hi = vec3(0.428, 0.372, 0.448);
  vec3 col = mix(deep, base, elev * 0.45 + 0.55);
  col = mix(col, dark, (1.0 - elev) * 0.12);
  col = mix(col, hi, elev * 0.06);
  col += vec3(0.46, 0.42, 0.50) * rim * 0.10;
  return col;
}

vec3 rockColor(vec2 world, float rim) {
  vec2 local = fract(world);
  float mask = boulderMask(local);
  vec3 rock = vec3(0.361, 0.322, 0.424);
  vec3 rockH = vec3(0.580, 0.533, 0.620);
  vec3 ink = vec3(0.071, 0.055, 0.118);
  vec3 col = mix(vec3(0.416, 0.353, 0.439), rock, mask);
  col = mix(col, rockH, mask * 0.55 * (1.0 - local.y));
  col = mix(col, ink, (1.0 - mask) * 0.08);
  float edge = smoothstep(0.45, 0.72, mask);
  col += vec3(0.52, 0.48, 0.58) * rim * edge * 0.18;
  float shadow = smoothstep(0.82, 0.98, local.y) * (1.0 - mask);
  col = mix(col, vec3(0.188, 0.165, 0.243), shadow * 0.45);
  return col;
}

vec3 voidColor(vec2 world) {
  float n = valueNoise(world * 0.08);
  return vec3(0.165 + n * 0.04, 0.141 + n * 0.03, 0.251 + n * 0.05);
}

void main() {
  vec2 world = vWorld;
  float elev = qElev(world);
  float rim = sunRim(world);

  float t = tileType(world);
  float decal = decalRock(world);
  bool isRock = t > 1.5 && t < 2.5 || decal > 0.5;

  vec3 col;
  if (t < 0.5) {
    col = voidColor(world);
  } else if (isRock) {
    col = rockColor(world, rim);
  } else {
    col = dustColor(world, elev, rim);
    if (t > 2.5 && t < 3.5) col = mix(col, vec3(0.776, 0.604, 0.282), 0.12);
    else if (t > 3.5 && t < 4.5) col = mix(col, vec3(0.361, 0.659, 0.824), 0.10);
    else if (t > 4.5 && t < 5.5) col = mix(col, vec3(0.941, 0.769, 0.282), 0.10);
  }

  gl_FragColor = vec4(col, 1.0);
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
  const decalTex = buildDecalTexture();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTiles: { value: tileTex },
      uDecals: { value: decalTex },
      uMapSize: { value: new THREE.Vector2(MAP, MAP) },
      uOpenCenter: { value: new THREE.Vector2(MAP * 0.5, MAP * 0.52) },
    },
    vertexShader: TERRAIN_VERT,
    fragmentShader: TERRAIN_FRAG,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(MAP / 2, 0, MAP / 2);
  return mesh;
}
