/** P11 / P33 / P40 — Three.js world renderer. */

import * as THREE from 'three';
import { Atlas, CELL, buildAtlas } from './atlas';
import { Kind, MAP, MAX_ENTS, Ord, Tile, DISSOLVE_DUR, type Ent } from './engine';
import { TEAM_RGB, isBuilding } from './content';
import type { World } from './sim';
import { VfxRenderer } from './vfx';
import { buildTerrainMesh, buildFogMesh, buildHeightTexture } from './terrain';
import { sampleHeightBilinear } from './height';
import { SDF_FRAG, SDF_VERT, civIndex, spriteSize, buildSprites } from './sprite-sdf';
import {
  WORKER_ACTION_ATTACK,
  WORKER_ACTION_BUILD,
  WORKER_ACTION_CRYSTAL,
  WORKER_ACTION_FOOD,
  type SpriteAtlas,
} from './sprites';

export const ISO_YAW = Math.PI / 4;
export const ISO_PITCH = Math.atan(0.5);
export const ISO_DIST = 40;

const VERT = /* glsl */ `
attribute vec4 iUv;
attribute vec3 iTeam;
attribute float iFlash;
varying vec2 vUv;
varying vec3 vTeam;
varying float vFlash;
void main() {
  vUv = mix(iUv.xy, iUv.zw, uv);
  vTeam = iTeam;
  vFlash = iFlash;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const PROP_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vTeam;
varying float vFlash;
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  if (c.a < 0.12) discard;
  if (c.r > 0.85 && c.b > 0.85 && c.g < 0.22) c.rgb = vTeam;
  c.rgb += vec3(vFlash);
  gl_FragColor = c;
}
`;

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly overlay: HTMLCanvasElement;
  readonly octx: CanvasRenderingContext2D;
  atlas!: Atlas;
  spriteAtlas!: SpriteAtlas;
  private sdfMesh!: THREE.InstancedMesh;
  private propMesh!: THREE.InstancedMesh;
  private shadows!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private iMeta!: THREE.InstancedBufferAttribute;
  private iDir!: THREE.InstancedBufferAttribute;
  private iSdfTeam!: THREE.InstancedBufferAttribute;
  private iSdfFlash!: THREE.InstancedBufferAttribute;
  private iUv!: THREE.InstancedBufferAttribute;
  private iPropTeam!: THREE.InstancedBufferAttribute;
  private iPropFlash!: THREE.InstancedBufferAttribute;
  private fogTex!: THREE.DataTexture;
  private fogData = new Uint8Array(MAP * MAP * 4);
  private fogMesh!: THREE.Mesh;
  private heightData!: Uint8Array;
  private mapMesh!: THREE.Mesh;
  private lastCamQ = new THREE.Quaternion();
  private stars!: THREE.Points;
  private nebula!: THREE.Points;
  private readonly drawnEntIds = new Set<number>();
  private lastDrawn = 0;
  private lastVfx = 0;
  private vfx!: VfxRenderer;
  private readonly viewBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  private readonly lookTarget = new THREE.Vector3();
  private readonly lookDir = new THREE.Vector3();
  private readonly drawOrder: { i: number; depth: number; prop: boolean }[] = [];

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(host.clientWidth, host.clientHeight, false);
    this.renderer.setClearColor(0x07060f, 1);
    this.renderer.domElement.id = 'game';
    host.appendChild(this.renderer.domElement);

    this.overlay = document.createElement('canvas');
    this.overlay.id = 'overlay';
    this.overlay.style.pointerEvents = 'none';
    host.appendChild(this.overlay);
    this.octx = this.overlay.getContext('2d')!;

    const aspect = host.clientWidth / Math.max(1, host.clientHeight);
    const h = 16;
    const w = h * aspect;
    this.camera = new THREE.OrthographicCamera(-w, w, h, -h, 0.1, 200);
    const ix = 18;
    const iz = 22;
    const cx = ix + ISO_DIST * Math.sin(ISO_YAW) * Math.cos(ISO_PITCH);
    const cy = ISO_DIST * Math.sin(ISO_PITCH);
    const cz = iz + ISO_DIST * Math.cos(ISO_YAW) * Math.cos(ISO_PITCH);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(ix, 0, iz);
    this.scene.background = new THREE.Color(0x07060f);
  }

  init(world: World): void {
    this.atlas = buildAtlas();
    const tex = new THREE.CanvasTexture(this.atlas.canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    tex.needsUpdate = true;

    const sdfGeo = new THREE.PlaneGeometry(1, 1);
    const meta = new Float32Array(MAX_ENTS * 4);
    const dir = new Float32Array(MAX_ENTS);
    const sdfTeam = new Float32Array(MAX_ENTS * 3);
    const sdfFlash = new Float32Array(MAX_ENTS);
    this.iMeta = new THREE.InstancedBufferAttribute(meta, 4);
    this.iDir = new THREE.InstancedBufferAttribute(dir, 1);
    this.iSdfTeam = new THREE.InstancedBufferAttribute(sdfTeam, 3);
    this.iSdfFlash = new THREE.InstancedBufferAttribute(sdfFlash, 1);
    sdfGeo.setAttribute('iMeta', this.iMeta);
    sdfGeo.setAttribute('iDir', this.iDir);
    sdfGeo.setAttribute('iTeam', this.iSdfTeam);
    sdfGeo.setAttribute('iFlash', this.iSdfFlash);

    const spriteAtlas = buildSprites();
    this.spriteAtlas = spriteAtlas;
    const spriteTex = new THREE.CanvasTexture(spriteAtlas.canvas);
    spriteTex.magFilter = THREE.NearestFilter;
    spriteTex.minFilter = THREE.NearestFilter;
    spriteTex.generateMipmaps = false;
    spriteTex.colorSpace = THREE.SRGBColorSpace;
    spriteTex.flipY = true;
    spriteTex.needsUpdate = true;

    const sdfMat = new THREE.ShaderMaterial({
      vertexShader: SDF_VERT,
      fragmentShader: SDF_FRAG,
      uniforms: {
        uSpriteAtlas: { value: spriteTex },
        uAtlasSize: {
          value: new THREE.Vector2(spriteAtlas.width, spriteAtlas.height),
        },
        uAtlasCols: { value: spriteAtlas.cols },
        uCell: { value: spriteAtlas.cell },
        uHallCell: { value: spriteAtlas.hallCell },
        uUnitRows: { value: spriteAtlas.unitRows },
        uBuildingRow: { value: spriteAtlas.buildingRow },
        uWorker8Y: { value: spriteAtlas.worker8Y },
        uWorker8H: { value: spriteAtlas.worker8H },
        uWorker8ActionY: { value: spriteAtlas.worker8ActionY },
        uWorker8ActionH: { value: spriteAtlas.worker8ActionH },
        uWorker8ActionBase: { value: spriteAtlas.worker8ActionBase },
        uWorker8ActionRows: { value: spriteAtlas.worker8ActionRows },
      },
      transparent: true,
      depthWrite: false,
    });
    this.sdfMesh = new THREE.InstancedMesh(sdfGeo, sdfMat, MAX_ENTS);
    this.sdfMesh.frustumCulled = false;
    this.scene.add(this.sdfMesh);

    const propGeo = new THREE.PlaneGeometry(1, 1);
    const uv = new Float32Array(MAX_ENTS * 4);
    const propTeam = new Float32Array(MAX_ENTS * 3);
    const propFlash = new Float32Array(MAX_ENTS);
    this.iUv = new THREE.InstancedBufferAttribute(uv, 4);
    this.iPropTeam = new THREE.InstancedBufferAttribute(propTeam, 3);
    this.iPropFlash = new THREE.InstancedBufferAttribute(propFlash, 1);
    propGeo.setAttribute('iUv', this.iUv);
    propGeo.setAttribute('iTeam', this.iPropTeam);
    propGeo.setAttribute('iFlash', this.iPropFlash);

    const propMat = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: tex } },
      vertexShader: VERT,
      fragmentShader: PROP_FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.propMesh = new THREE.InstancedMesh(propGeo, propMat, MAX_ENTS);
    this.propMesh.frustumCulled = false;
    this.scene.add(this.propMesh);

    const sgeo = new THREE.CircleGeometry(0.5, 12);
    sgeo.rotateX(-Math.PI / 2);
    const smat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    this.shadows = new THREE.InstancedMesh(sgeo, smat, MAX_ENTS);
    this.shadows.frustumCulled = false;
    this.scene.add(this.shadows);

    this.vfx = new VfxRenderer();
    this.vfx.init(this.scene);

    this.buildMap(world);
    this.buildStars();
    this.buildNebula();
    this.fogTex = new THREE.DataTexture(this.fogData, MAP, MAP, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.NearestFilter;
    this.fogTex.minFilter = THREE.NearestFilter;
    this.fogTex.wrapS = this.fogTex.wrapT = THREE.ClampToEdgeWrapping;
    this.fogTex.needsUpdate = true;
    this.fogMesh = buildFogMesh(buildHeightTexture(world));
    const fogMat = this.fogMesh.material as THREE.ShaderMaterial;
    fogMat.uniforms.uFog.value = this.fogTex;
    this.scene.add(this.fogMesh);
  }

  resize(w: number, h: number): void {
    this.renderer.setSize(w, h, false);
    this.overlay.width = w;
    this.overlay.height = h;
    const aspect = w / Math.max(1, h);
    const halfH = (this.camera.top - this.camera.bottom) / 2;
    const halfW = halfH * aspect;
    this.camera.left = -halfW;
    this.camera.right = halfW;
    this.camera.updateProjectionMatrix();
  }

  setZoom(halfH: number): void {
    const aspect = (this.camera.right - this.camera.left) / (this.camera.top - this.camera.bottom);
    this.camera.top = halfH;
    this.camera.bottom = -halfH;
    this.camera.left = -halfH * aspect;
    this.camera.right = halfH * aspect;
    this.camera.updateProjectionMatrix();
  }

  lookAt(x: number, z: number): void {
    const cx = x + ISO_DIST * Math.sin(ISO_YAW) * Math.cos(ISO_PITCH);
    const cy = ISO_DIST * Math.sin(ISO_PITCH);
    const cz = z + ISO_DIST * Math.cos(ISO_YAW) * Math.cos(ISO_PITCH);
    this.camera.position.set(cx, cy, cz);
    this.camera.lookAt(x, 0, z);
  }

  target(): THREE.Vector3 {
    const t = new THREE.Vector3();
    this.camera.getWorldDirection(t);
    const pos = this.camera.position;
    const dist = pos.y / Math.max(0.001, -t.y);
    return pos.clone().addScaledVector(t, dist);
  }

  draw(world: World, alpha: number, selected: Set<number>, box: { x0: number; y0: number; x1: number; y1: number } | null): void {
    this.camera.getWorldQuaternion(this.lastCamQ);
    this.updateViewBounds(1);
    const vb = this.viewBounds;
    this.drawnEntIds.clear();
    let sdfDrawn = 0;
    let propDrawn = 0;
    let shadowDrawn = 0;
    const metaArr = this.iMeta.array as Float32Array;
    const dirArr = this.iDir.array as Float32Array;
    const sdfTeamArr = this.iSdfTeam.array as Float32Array;
    const sdfFlashArr = this.iSdfFlash.array as Float32Array;
    const uvArr = this.iUv.array as Float32Array;
    const propTeamArr = this.iPropTeam.array as Float32Array;
    const propFlashArr = this.iPropFlash.array as Float32Array;

    const order = this.drawOrder;
    order.length = 0;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = world.ents[i];
      if (!e.alive || !e.vis) continue;
      if (e.kind === Kind.Shade && e.stealth > 0.7 && e.team !== 0) continue;
      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;
      if (x < vb.minX || x > vb.maxX || z < vb.minZ || z > vb.maxZ) continue;
      order.push({ i, depth: x + z, prop: e.kind === Kind.Resource });
    }
    order.sort((a, b) => a.depth - b.depth);

    for (const item of order) {
      const i = item.i;
      const e = world.ents[i];
      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;

      const groundY = this.groundY(x, z);
      const rgb = TEAM_RGB[e.team] ?? TEAM_RGB[0];
      const clash =
        world.tick < 240 &&
        (e.kind === Kind.Fighter || e.kind === Kind.Ravager || e.kind === Kind.Prism) &&
        (() => {
          const dx = e.x - MAP * 0.5;
          const dz = e.z - MAP * 0.52;
          return dx * dx + dz * dz < 110;
        })();
      const shootFlash =
        e.cooldown > 0.26 && e.kind !== Kind.Resource ? (clash ? 0.42 : 0.55) : 0;
      const flash = Math.max(e.hitFlash, shootFlash);

      if (e.kind === Kind.Resource) {
        const uv = this.propUvFor(e);
        if (!uv) continue;
        const cellsW = uv.w / CELL;
        const cellsH = uv.h / CELL;
        const isProp = e.cargoType === Tile.PropWreck || e.cargoType === Tile.PropVent;
        const openCx = MAP * 0.5;
        const openCz = MAP * 0.52;
        const midGem =
          !isProp && Math.abs(e.x - openCx) < 0.6 && Math.abs(e.z - openCz) < 0.6;
        const midBoulder =
          isProp &&
          Math.abs(e.x - openCx) < 0.6 &&
          Math.abs(Math.abs(e.z - openCz) - 2.85) < 0.35;
        const targetH = midGem ? 1.55 : isProp ? (midBoulder ? 1.25 : 1.2) : 1.45;
        const mul = targetH / cellsH;
        const scaleX = cellsW * mul;
        const scaleY = cellsH * mul;
        this.dummy.position.set(x, groundY + 0.38, z);
        this.dummy.quaternion.copy(this.lastCamQ);
        this.dummy.scale.set(scaleX, scaleY, 1);
        this.dummy.updateMatrix();
        this.propMesh.setMatrixAt(propDrawn, this.dummy.matrix);
        uvArr[propDrawn * 4] = uv.u0;
        uvArr[propDrawn * 4 + 1] = uv.v0;
        uvArr[propDrawn * 4 + 2] = uv.u1;
        uvArr[propDrawn * 4 + 3] = uv.v1;
        propTeamArr[propDrawn * 3] = rgb[0];
        propTeamArr[propDrawn * 3 + 1] = rgb[1];
        propTeamArr[propDrawn * 3 + 2] = rgb[2];
        propFlashArr[propDrawn] = flash;
        propDrawn++;
      } else {
        const spr = spriteSize(e.kind);
        const cellsW = e.kind === Kind.Hall ? 2 : 1;
        const cellsH = e.kind === Kind.Hall ? 2 : 1;
        let scaleX: number;
        let scaleY: number;
        if (isBuilding(e.kind)) {
          const targetH = e.kind === Kind.Hall ? 2.4 : e.kind === Kind.House ? 1.75 : 1.85;
          const mul = targetH / cellsH;
          scaleX = cellsW * mul * e.facing;
          scaleY = cellsH * mul;
        } else if (e.kind === Kind.Worker && e.hp > 0) {
          scaleX = cellsW * 1.55;
          scaleY = cellsH * 2.32;
        } else {
          const unitMul = e.kind === Kind.Worker ? 1.55 : 1.08;
          scaleX = cellsW * unitMul * (e.kind === Kind.Worker ? 1 : e.facing);
          scaleY = cellsH * (e.kind === Kind.Worker ? 1.55 : 1.14);
        }
        const lift = isBuilding(e.kind) ? 1.15 : 0.9;
        this.dummy.position.set(x, groundY + lift, z);
        this.dummy.quaternion.copy(this.lastCamQ);
        this.dummy.scale.set(scaleX, scaleY, 1);
        this.dummy.updateMatrix();
        this.sdfMesh.setMatrixAt(sdfDrawn, this.dummy.matrix);
        metaArr[sdfDrawn * 4] = e.kind;
        metaArr[sdfDrawn * 4 + 1] = civIndex(e.civ);
        metaArr[sdfDrawn * 4 + 2] = this.frameFor(e);
        metaArr[sdfDrawn * 4 + 3] = spr;
        dirArr[sdfDrawn] = e.kind === Kind.Worker ? e.facing : 0;
        sdfTeamArr[sdfDrawn * 3] = rgb[0];
        sdfTeamArr[sdfDrawn * 3 + 1] = rgb[1];
        sdfTeamArr[sdfDrawn * 3 + 2] = rgb[2];
        sdfFlashArr[sdfDrawn] = flash;
        sdfDrawn++;
      }

      if (e.kind === Kind.Resource) {
        this.dummy.position.set(x, groundY + 0.03, z);
        this.dummy.quaternion.identity();
        this.dummy.scale.set(e.radius * 1.1, 1, e.radius * 0.85);
        this.dummy.updateMatrix();
        this.shadows.setMatrixAt(shadowDrawn, this.dummy.matrix);
      } else {
        this.dummy.position.set(x, groundY + 0.03, z);
        this.dummy.quaternion.identity();
        this.dummy.scale.set(e.radius * 2.2, 1, e.radius * 1.6);
        this.dummy.updateMatrix();
        this.shadows.setMatrixAt(shadowDrawn, this.dummy.matrix);
      }
      shadowDrawn++;
      this.drawnEntIds.add(e.id);
    }

    this.lastDrawn = sdfDrawn + propDrawn;
    this.lastVfx = this.vfx.draw(world, this.lastCamQ, vb);
    this.sdfMesh.count = sdfDrawn;
    this.propMesh.count = propDrawn;
    this.shadows.count = shadowDrawn;
    this.sdfMesh.instanceMatrix.needsUpdate = true;
    this.propMesh.instanceMatrix.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.iMeta.needsUpdate = true;
    this.iDir.needsUpdate = true;
    this.iSdfTeam.needsUpdate = true;
    this.iSdfFlash.needsUpdate = true;
    this.iUv.needsUpdate = true;
    this.iPropTeam.needsUpdate = true;
    this.iPropFlash.needsUpdate = true;

    this.updateFog(world);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(world, alpha, selected, box);
  }

  pick(nx: number, ny: number): THREE.Vector3 {
    const v = new THREE.Vector3(nx * 2 - 1, -(ny * 2 - 1), 0.5);
    v.unproject(this.camera);
    const origin = this.camera.position;
    const dir = v.sub(this.camera.position).normalize();
    let t = 0;
    let lastY = origin.y;
    for (let i = 0; i < 96; i++) {
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      const y = origin.y + dir.y * t;
      if (x < -1 || z < -1 || x > MAP + 1 || z > MAP + 1) break;
      const gy = this.groundY(x, z);
      if (y <= gy + 0.08 && dir.y < 0) return new THREE.Vector3(x, gy, z);
      if (y < lastY && y <= gy + 0.2) return new THREE.Vector3(x, gy, z);
      lastY = y;
      t += 0.45;
    }
    const dist = -origin.y / dir.y;
    return origin.clone().addScaledVector(dir, dist);
  }

  groundY(x: number, z: number): number {
    return sampleHeightBilinear(this.heightData, x, z);
  }

  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.overlay.width,
      y: (-v.y * 0.5 + 0.5) * this.overlay.height,
    };
  }

  info(): { calls: number; tris: number; drawn: number; vfx: number } {
    return {
      calls: this.renderer.info.render.calls,
      tris: this.renderer.info.render.triangles,
      drawn: this.lastDrawn,
      vfx: this.lastVfx,
    };
  }

  /** World-space xz AABB for the visible ground patch (+margin tiles). */
  private updateViewBounds(margin: number): void {
    const b = this.viewBounds;
    const halfW = (this.camera.right - this.camera.left) * 0.5;
    const halfH = (this.camera.top - this.camera.bottom) * 0.5;
    // Angled ortho frustum: span along world x/z is ~ sum of camera half-extents.
    const ex = halfW + halfH;
    const ez = halfW + halfH;
    this.camera.getWorldDirection(this.lookDir);
    const dist = -this.camera.position.y / this.lookDir.y;
    this.lookTarget.copy(this.camera.position).addScaledVector(this.lookDir, dist);
    const cx = this.lookTarget.x;
    const cz = this.lookTarget.z;
    b.minX = cx - ex - margin;
    b.maxX = cx + ex + margin;
    b.minZ = cz - ez - margin;
    b.maxZ = cz + ez + margin;
  }

  private frameFor(e: Ent): number {
    if (e.hp <= 0) {
      if (e.dissolveT > 0) return e.dissolveT > DISSOLVE_DUR * 0.5 ? 5 : 6;
      return 4;
    }
    if (e.kind === Kind.Worker) {
      if (e.civ === 'vespari') {
        if (e.order === Ord.Build) return WORKER_ACTION_BUILD;
        if (e.order === Ord.Attack) return WORKER_ACTION_ATTACK;
        if (e.order === Ord.Gather || e.order === Ord.Return) {
          return e.cargoType === Tile.Solar ? WORKER_ACTION_FOOD : WORKER_ACTION_CRYSTAL;
        }
      }
      if (Math.abs(e.vx) + Math.abs(e.vz) > 0.08) return 1 + ((e.anim * 6) | 0) % 2;
      return 0;
    }
    if (e.order === 2 /* attack */) return 3;
    if (Math.abs(e.vx) + Math.abs(e.vz) > 0.08) return 1 + ((e.anim * 6) | 0) % 2;
    return (e.anim * 2) & 1;
  }

  private propUvFor(e: Ent) {
    if (e.cargoType === Tile.PropWreck) return this.atlas.uv['prop-wreck'];
    if (e.cargoType === Tile.PropVent) return this.atlas.uv['prop-vent'];
    if (e.cargoType === Tile.Gas) return this.atlas.uv['gem-gas'];
    if (e.cargoType === Tile.Solar) return this.atlas.uv['gem-sol'];
    return this.atlas.uv['gem-ore'];
  }

  private buildMap(world: World): void {
    this.heightData = world.height;
    this.mapMesh = buildTerrainMesh(world);
    this.scene.add(this.mapMesh);
  }

  private buildStars(): void {
    const cx = MAP * 0.5;
    const cz = MAP * 0.52;
    const n = 280;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const bias = i < 180 ? 1 : 0;
      pos[i * 3] = bias ? cx + (Math.random() - 0.5) * 26 : Math.random() * MAP;
      pos[i * 3 + 1] = 8 + Math.random() * 18;
      pos[i * 3 + 2] = bias ? cz + (Math.random() - 0.5) * 18 : Math.random() * MAP;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(
      g,
      new THREE.PointsMaterial({ color: 0xe8e0ff, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.7 }),
    );
    this.scene.add(this.stars);
  }

  private buildNebula(): void {
    const cx = MAP * 0.5;
    const cz = MAP * 0.52;
    const n = 55;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = cx + (Math.random() - 0.5) * 24;
      pos[i * 3 + 1] = 0.25 + Math.random() * 1.4;
      pos[i * 3 + 2] = cz + (Math.random() - 0.5) * 16;
      col[i * 3] = 0.35 + Math.random() * 0.35;
      col[i * 3 + 1] = 0.18 + Math.random() * 0.22;
      col[i * 3 + 2] = 0.45 + Math.random() * 0.4;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.nebula = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.55,
        sizeAttenuation: true,
        transparent: true,
        opacity: 0.28,
        vertexColors: true,
        depthWrite: false,
      }),
    );
    this.scene.add(this.nebula);
  }

  private updateFog(world: World): void {
    const vis = world.visible[0];
    const exp = world.explored[0];
    const d = this.fogData;
    for (let i = 0; i < MAP * MAP; i++) {
      const o = i * 4;
      if (vis[i]) {
        d[o] = 0;
        d[o + 1] = 0;
        d[o + 2] = 0;
        d[o + 3] = 0;
      } else if (exp[i]) {
        d[o] = 14;
        d[o + 1] = 12;
        d[o + 2] = 28;
        d[o + 3] = 58;
      } else {
        d[o] = 8;
        d[o + 1] = 6;
        d[o + 2] = 18;
        d[o + 3] = 175;
      }
    }
    this.fogTex.needsUpdate = true;
  }

  private drawOverlay(
    world: World,
    alpha: number,
    selected: Set<number>,
    box: { x0: number; y0: number; x1: number; y1: number } | null,
  ): void {
    const ctx = this.octx;
    const w = this.overlay.width;
    const h = this.overlay.height;
    ctx.clearRect(0, 0, w, h);

    if (box) {
      const x = Math.min(box.x0, box.x1);
      const y = Math.min(box.y0, box.y1);
      const bw = Math.abs(box.x1 - box.x0);
      const bh = Math.abs(box.y1 - box.y0);
      ctx.strokeStyle = 'rgba(240, 210, 96, 0.95)';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(240, 210, 96, 0.12)';
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeRect(x, y, bw, bh);
    }

    if (world.tick < 240) {
      for (let i = 0; i < MAX_ENTS; i++) {
        const e = world.ents[i];
        if (!e.alive || !e.vis || e.kind !== Kind.Worker) continue;
        const x = e.px + (e.x - e.px) * alpha;
        const z = e.pz + (e.z - e.pz) * alpha;
        const p = this.project(x, this.groundY(x, z) + 0.05, z);
        ctx.fillStyle = '#ffe848';
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 2);
        ctx.lineTo(p.x + 2, p.y);
        ctx.lineTo(p.x, p.y + 2);
        ctx.lineTo(p.x - 2, p.y);
        ctx.closePath();
        ctx.fill();
      }
    }

    for (const f of world.flags) {
      const p = this.project(f.x, this.groundY(f.x, f.z) + 0.05, f.z);
      ctx.globalAlpha = Math.max(0, f.t);
      ctx.strokeStyle = '#ffe848';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12 + (1 - f.t) * 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(p.x - 9, p.y);
      ctx.lineTo(p.x + 9, p.y);
      ctx.moveTo(p.x, p.y - 9);
      ctx.lineTo(p.x, p.y + 9);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    const opening = world.tick < 240;
    for (let i = 0; i < MAX_ENTS; i++) {
      const e = world.ents[i];
      if (!e.alive || !e.vis) continue;
      if (e.kind === Kind.Resource) continue;
      if (!this.drawnEntIds.has(e.id)) continue;
      const sel = selected.has(e.id);
      const isPlayer = e.team === 0;
      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;
      const gy = this.groundY(x, z);
      const foot = this.project(x, gy + 0.05, z);

      if (sel) {
        const rx = isBuilding(e.kind) ? e.radius * 38 + 10 : e.radius * 44 + 12;
        const ry = isBuilding(e.kind) ? e.radius * 14 + 4 : e.radius * 16 + 5;
        ctx.strokeStyle = isPlayer ? '#48f048' : '#f04848';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(foot.x, foot.y, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (e.hp <= 0) continue;
      const damaged = e.hp < e.maxHp;
      const inCombat = e.combatT > 0;
      const showHp = opening ? sel : sel || damaged || inCombat;
      if (!showHp) continue;

      const head = this.project(x, gy + (isBuilding(e.kind) ? 2.4 : 1.65), z);
      const bw = isBuilding(e.kind) ? 36 : 18;
      const bh = 3;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const barY = head.y - 16;
      const outline = isPlayer ? '#48f048' : '#f04848';
      const fill = isPlayer ? '#40e840' : '#e83838';

      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(head.x - bw / 2 - 1, barY - 1, bw + 2, bh + 2);
      ctx.fillStyle = fill;
      ctx.fillRect(head.x - bw / 2, barY, bw * ratio, bh);
      ctx.strokeStyle = outline;
      ctx.lineWidth = 1;
      ctx.strokeRect(head.x - bw / 2 - 1, barY - 1, bw + 2, bh + 2);
    }
  }
}
