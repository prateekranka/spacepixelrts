/** P80 — GPU-instanced additive particles for sparks and bolts. */

import * as THREE from 'three';
import { Kind, MAX_SPARKS, type Civ } from './engine';
import type { World } from './sim';

const MAX_VFX = 2048;
const SPARK_SUB = 8;
const BOLT_BEADS = 4;

const VFX_VERT = /* glsl */ `
attribute float iAge;
attribute float iKind;
attribute float iCiv;
attribute float iSeed;
varying float vAge;
varying float vKind;
varying float vCiv;
varying float vSeed;
varying vec2 vLocalUv;
void main() {
  vAge = iAge;
  vKind = iKind;
  vCiv = iCiv;
  vSeed = iSeed;
  vLocalUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const VFX_FRAG = /* glsl */ `
varying float vAge;
varying float vKind;
varying float vCiv;
varying float vSeed;
varying vec2 vLocalUv;

float hash1(float n) {
  return fract(sin(n) * 43758.5453);
}

void main() {
  vec2 p = vLocalUv - 0.5;
  float ang = vSeed * 6.2831853;
  float c = cos(ang);
  float s = sin(ang);
  p = vec2(c * p.x - s * p.y, s * p.x + c * p.y);

  if (vKind > 1.5) {
    p.x *= 3.2;
    p.y *= 0.38;
  } else if (vKind < 0.5) {
    p.x *= 1.15;
    p.y *= 0.95;
  } else {
    p.x *= 1.6 + hash1(vSeed + 3.0) * 0.8;
    p.y *= 0.55 + hash1(vSeed + 7.0) * 0.35;
  }

  float r = length(p);
  float core = smoothstep(0.48, 0.0, r);
  float porous = step(0.12, hash1(vSeed * 17.0 + r * 31.0));
  float alpha = core * porous * vAge;
  if (alpha < 0.015) discard;

  vec3 helion = vec3(1.0, 0.72, 0.18);
  vec3 kryos = vec3(0.28, 0.88, 1.0);
  vec3 nihiline = mix(vec3(0.62, 0.28, 0.82), vec3(0.42, 0.88, 0.38), hash1(vSeed + 11.0));

  vec3 col = helion;
  if (vCiv > 1.5) col = nihiline;
  else if (vCiv > 0.5) col = kryos;

  if (vKind < 0.5) col = mix(col, vec3(1.0), 0.35);
  else if (vKind > 1.5) col = mix(col, vec3(1.0), 0.18);
  else col = mix(col, vec3(1.0), 0.12);

  float bright = vKind > 1.5 ? 1.65 : (vKind < 0.5 ? 1.85 : 1.45);
  gl_FragColor = vec4(col * alpha * bright, alpha);
}
`;

const CIV_IDX: Record<Civ, number> = { vespari: 0, aurion: 1, voidmarked: 2 };

function hash2(seed: number, ch: number): number {
  const n = Math.sin(seed * 12.9898 + ch * 78.233) * 43758.5453;
  return n - Math.floor(n);
}

export class VfxRenderer {
  private mesh!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private iAge!: THREE.InstancedBufferAttribute;
  private iKind!: THREE.InstancedBufferAttribute;
  private iCiv!: THREE.InstancedBufferAttribute;
  private iSeed!: THREE.InstancedBufferAttribute;
  private lastCount = 0;

  init(scene: THREE.Scene): void {
    const geo = new THREE.PlaneGeometry(1, 1);
    const age = new Float32Array(MAX_VFX);
    const kind = new Float32Array(MAX_VFX);
    const civ = new Float32Array(MAX_VFX);
    const seed = new Float32Array(MAX_VFX);
    this.iAge = new THREE.InstancedBufferAttribute(age, 1);
    this.iKind = new THREE.InstancedBufferAttribute(kind, 1);
    this.iCiv = new THREE.InstancedBufferAttribute(civ, 1);
    this.iSeed = new THREE.InstancedBufferAttribute(seed, 1);
    geo.setAttribute('iAge', this.iAge);
    geo.setAttribute('iKind', this.iKind);
    geo.setAttribute('iCiv', this.iCiv);
    geo.setAttribute('iSeed', this.iSeed);

    const mat = new THREE.ShaderMaterial({
      vertexShader: VFX_VERT,
      fragmentShader: VFX_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_VFX);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  draw(
    world: World,
    camQ: THREE.Quaternion,
    vb: { minX: number; maxX: number; minZ: number; maxZ: number },
  ): number {
    const ageArr = this.iAge.array as Float32Array;
    const kindArr = this.iKind.array as Float32Array;
    const civArr = this.iCiv.array as Float32Array;
    const seedArr = this.iSeed.array as Float32Array;
    let pi = 0;

    for (let si = 0; si < MAX_SPARKS && pi + SPARK_SUB <= MAX_VFX; si++) {
      const s = world.sparks[si];
      if (!s.active) continue;
      if (s.x < vb.minX || s.x > vb.maxX || s.z < vb.minZ || s.z > vb.maxZ) continue;
      const age = s.life / s.maxLife;
      const lift = s.kind === 0 ? 0.95 : 0.82;
      const spread = s.kind === 0 ? 0.18 : 0.52;
      const baseScale = s.kind === 0 ? 0.32 : 0.4;
      const civIdx = CIV_IDX[s.civ];

      for (let j = 0; j < SPARK_SUB; j++) {
        const sd = si * SPARK_SUB + j;
        const hx = hash2(sd, 0) - 0.5;
        const hz = hash2(sd, 1) - 0.5;
        const expand = 1.0 - age * 0.35;
        const ox = hx * spread * expand;
        const oz = hz * spread * expand;
        const oy = hash2(sd, 2) * 0.08 * expand;
        const sc = baseScale * (0.55 + hash2(sd, 3) * 0.65) * (0.45 + 0.55 * age);

        this.dummy.position.set(s.x + ox, lift + oy, s.z + oz);
        this.dummy.quaternion.copy(camQ);
        this.dummy.scale.set(sc, sc * (0.7 + hash2(sd, 4) * 0.5), 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(pi, this.dummy.matrix);

        ageArr[pi] = age;
        kindArr[pi] = s.kind;
        civArr[pi] = civIdx;
        seedArr[pi] = sd;
        pi++;
      }
    }

    for (let bi = 0; bi < world.bolts.length && pi + BOLT_BEADS <= MAX_VFX; bi++) {
      const b = world.bolts[bi];
      if (b.x < vb.minX || b.x > vb.maxX || b.z < vb.minZ || b.z > vb.maxZ) continue;
      const spd = Math.hypot(b.vx, b.vz) || 1;
      const dx = b.vx / spd;
      const dz = b.vz / spd;
      const trail = b.kind === Kind.Prism ? 0.55 : b.kind === Kind.Siege ? 0.38 : 0.45;
      const civIdx = CIV_IDX[b.civ];
      const headScale = b.kind === Kind.Siege ? 0.42 : b.kind === Kind.Prism ? 0.34 : 0.3;

      for (let j = 0; j < BOLT_BEADS; j++) {
        const t = j / (BOLT_BEADS - 1);
        const bx = b.x - dx * trail * t;
        const bz = b.z - dz * trail * t;
        const beadAge = 1.0 - t * 0.55;
        const sc = headScale * (0.65 + 0.35 * beadAge);

        this.dummy.position.set(bx, 0.88, bz);
        this.dummy.quaternion.copy(camQ);
        const stretch = 1.0 + (1.0 - t) * 0.4;
        this.dummy.scale.set(sc * stretch, sc * 0.55, 1);
        this.dummy.updateMatrix();
        this.mesh.setMatrixAt(pi, this.dummy.matrix);

        ageArr[pi] = beadAge;
        kindArr[pi] = 2;
        civArr[pi] = civIdx;
        seedArr[pi] = bi * BOLT_BEADS + j + 1000;
        pi++;
      }
    }

    this.lastCount = pi;
    this.mesh.count = pi;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.iAge.needsUpdate = true;
    this.iKind.needsUpdate = true;
    this.iCiv.needsUpdate = true;
    this.iSeed.needsUpdate = true;
    return pi;
  }

  count(): number {
    return this.lastCount;
  }
}
