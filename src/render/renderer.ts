import * as THREE from 'three';
import {
  iso,
  MAP,
  TEAM_TINT,
  TILE_H,
  TILE_W,
  isBuilding,
  isUnit,
  type Civ,
} from '../sim/engine';
import { Kind } from '../sim/engine';
import { buildAtlas, spriteKey, tileKey, type Atlas, type Uv } from './atlas';

export type DrawEnt = {
  x: number;
  z: number;
  kind: Kind;
  civ: Civ;
  team: number;
  hp: number;
  maxHp: number;
  anim: number;
  facing: number;
  vis: boolean;
  selected?: boolean;
};

export type DrawBolt = { x: number; z: number; kind: Kind; team: number };

export type DrawView = {
  tiles: Uint8Array;
  ents: DrawEnt[];
  bolts: DrawBolt[];
  camX: number;
  camZ: number;
  zoom: number;
};

const VS = /* glsl */ `
attribute vec4 aUv;
attribute vec3 aPos;
attribute vec2 aSize;
attribute vec3 aTint;
varying vec2 vUv;
varying vec3 vTint;
uniform vec2 uScreen;
void main() {
  vUv = mix(aUv.xy, aUv.zw, uv);
  vTint = aTint;
  vec2 p = aPos.xy + position.xy * aSize;
  vec2 ndc = vec2((p.x / uScreen.x) * 2.0 - 1.0, 1.0 - (p.y / uScreen.y) * 2.0);
  gl_Position = vec4(ndc, aPos.z, 1.0);
}
`;

const FS = /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vTint;
void main() {
  vec4 c = texture2D(uAtlas, vUv);
  if (c.a < 0.08) discard;
  if (c.r > 0.9 && c.g < 0.08 && c.b > 0.9) c.rgb = vTint;
  gl_FragColor = c;
}
`;

type Batch = {
  mesh: THREE.Mesh;
  aUv: THREE.InstancedBufferAttribute;
  aPos: THREE.InstancedBufferAttribute;
  aSize: THREE.InstancedBufferAttribute;
  aTint: THREE.InstancedBufferAttribute;
  cap: number;
};

function makeBatch(atlas: THREE.Texture, cap: number): Batch {
  const geo = new THREE.InstancedBufferGeometry();
  const plane = new THREE.PlaneGeometry(1, 1);
  geo.index = plane.index;
  geo.setAttribute('position', plane.getAttribute('position'));
  geo.setAttribute('uv', plane.getAttribute('uv'));
  const aUv = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4);
  const aPos = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  const aSize = new THREE.InstancedBufferAttribute(new Float32Array(cap * 2), 2);
  const aTint = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  aUv.setUsage(THREE.DynamicDrawUsage);
  aPos.setUsage(THREE.DynamicDrawUsage);
  aSize.setUsage(THREE.DynamicDrawUsage);
  aTint.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aUv', aUv);
  geo.setAttribute('aPos', aPos);
  geo.setAttribute('aSize', aSize);
  geo.setAttribute('aTint', aTint);
  geo.instanceCount = 0;
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas },
      uScreen: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: VS,
    fragmentShader: FS,
    transparent: true,
    depthTest: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  return { mesh, aUv, aPos, aSize, aTint, cap };
}

export class Renderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly atlas: Atlas;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.OrthographicCamera;
  private readonly tex: THREE.CanvasTexture;
  private readonly terrain: Batch;
  private readonly actors: Batch;
  private readonly stars: THREE.Points;
  private w = 1;
  private h = 1;
  private terrainDirty = true;
  drawCalls = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x0a0814, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera.position.z = 5;
    this.atlas = buildAtlas();
    this.tex = new THREE.CanvasTexture(this.atlas.canvas);
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestFilter;
    this.tex.generateMipmaps = false;
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.needsUpdate = true;
    this.terrain = makeBatch(this.tex, MAP * MAP);
    this.actors = makeBatch(this.tex, 2048);
    this.stars = this.makeStars();
    this.scene.add(this.stars);
    this.scene.add(this.terrain.mesh);
    this.scene.add(this.actors.mesh);
  }

  resize(cssW: number, cssH: number, dpr: number): void {
    const cap = Math.min(2, dpr);
    this.w = Math.max(1, Math.floor(cssW * cap));
    this.h = Math.max(1, Math.floor(cssH * cap));
    this.renderer.setPixelRatio(cap);
    this.renderer.setSize(cssW, cssH, false);
    const u0 = (this.terrain.mesh.material as THREE.ShaderMaterial).uniforms.uScreen.value as THREE.Vector2;
    const u1 = (this.actors.mesh.material as THREE.ShaderMaterial).uniforms.uScreen.value as THREE.Vector2;
    u0.set(this.w, this.h);
    u1.set(this.w, this.h);
  }

  invalidateTerrain(): void {
    this.terrainDirty = true;
  }

  draw(view: DrawView): void {
    const zoom = view.zoom;
    const origin = iso(view.camX, view.camZ);
    const ox = origin.sx * zoom;
    const oy = origin.sy * zoom;
    if (this.terrainDirty) {
      this.uploadTerrain(view.tiles, ox, oy, zoom);
      this.terrainDirty = false;
    } else {
      this.uploadTerrain(view.tiles, ox, oy, zoom);
    }
    this.uploadActors(view, ox, oy, zoom);
    this.renderer.render(this.scene, this.camera);
    this.drawCalls = 3;
  }

  screenToWorld(cssX: number, cssY: number, camX: number, camZ: number, zoom: number): { x: number; z: number } {
    const cap = this.renderer.getPixelRatio();
    const sx = (cssX * cap - this.w / 2) / zoom + iso(camX, camZ).sx;
    const sy = (cssY * cap - this.h / 2) / zoom + iso(camX, camZ).sy;
    const w = { x: sx / TILE_W + sy / TILE_H, z: sy / TILE_H - sx / TILE_W };
    return w;
  }

  private makeStars(): THREE.Points {
    const n = 500;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Math.random() * 2 - 1;
      pos[i * 3 + 1] = Math.random() * 2 - 1;
      pos[i * 3 + 2] = 0.9;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const m = new THREE.PointsMaterial({ color: 0xf4eee2, size: 1.4, sizeAttenuation: false });
    const p = new THREE.Points(g, m);
    p.frustumCulled = false;
    return p;
  }

  private uploadTerrain(tiles: Uint8Array, ox: number, oy: number, zoom: number): void {
    const b = this.terrain;
    let n = 0;
    const cx = this.w / 2;
    const cy = this.h / 2;
    for (let z = 0; z < MAP; z++) {
      for (let x = 0; x < MAP; x++) {
        const key = tileKey(tiles[x + z * MAP]!);
        const uv = this.atlas.uv[key];
        if (!uv) continue;
        const p = iso(x + 0.5, z + 0.5);
        const sx = Math.round(cx + p.sx * zoom - ox);
        const sy = Math.round(cy + p.sy * zoom - oy);
        const depth = 0.4 - (x + z) * 0.00005;
        this.write(b, n++, uv, sx, sy, uv.w * zoom, uv.h * zoom, 1, 1, 1, depth);
      }
    }
    (b.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    b.aUv.needsUpdate = true;
    b.aPos.needsUpdate = true;
    b.aSize.needsUpdate = true;
    b.aTint.needsUpdate = true;
  }

  private uploadActors(view: DrawView, ox: number, oy: number, zoom: number): void {
    const b = this.actors;
    let n = 0;
    const cx = this.w / 2;
    const cy = this.h / 2;
    const sorted = view.ents.slice().sort((a, c) => a.x + a.z - (c.x + c.z));
    for (const e of sorted) {
      if (!e.vis) continue;
      const p = iso(e.x, e.z);
      const sx = Math.round(cx + p.sx * zoom - ox);
      const sy = Math.round(cy + p.sy * zoom - oy);
      const depth = 0.2 - (e.x + e.z) * 0.00005;
      const sh = this.atlas.uv.shadow;
      if (sh && (isUnit(e.kind) || isBuilding(e.kind))) {
        this.write(b, n++, sh, sx, sy + 4 * zoom, sh.w * zoom, sh.h * zoom, 1, 1, 1, depth + 0.01);
      }
      if (e.selected) {
        const sel = this.atlas.uv.sel;
        if (sel) this.write(b, n++, sel, sx, sy + 2 * zoom, sel.w * zoom, sel.h * zoom, 1, 0.9, 0.4, depth + 0.005);
      }
      const frame = isUnit(e.kind) ? ((e.anim * 6) | 0) % 2 : 0;
      const key = spriteKey(e.kind, e.civ, frame);
      const uv = this.atlas.uv[key] ?? this.atlas.uv['helion-fighter-0'];
      if (!uv) continue;
      const tint = TEAM_TINT[e.team] ?? TEAM_TINT[0];
      const flip = e.facing < 0 ? -1 : 1;
      this.write(
        b,
        n++,
        uv,
        sx,
        sy - (isBuilding(e.kind) ? 10 * zoom : 4 * zoom),
        uv.w * zoom * flip,
        uv.h * zoom,
        tint[0],
        tint[1],
        tint[2],
        depth,
      );
      if (e.hp < e.maxHp && e.maxHp > 0 && e.kind !== Kind.Resource) {
        const hp = this.atlas.uv.hp;
        if (hp) {
          const w = Math.max(2, (e.hp / e.maxHp) * hp.w * zoom);
          this.write(b, n++, hp, sx, sy - 18 * zoom, w, hp.h * zoom, 1, 0.3, 0.3, depth - 0.001);
        }
      }
    }
    for (const bolt of view.bolts) {
      const p = iso(bolt.x, bolt.z);
      const sx = Math.round(cx + p.sx * zoom - ox);
      const sy = Math.round(cy + p.sy * zoom - oy);
      const key =
        bolt.kind === Kind.SolarLance || bolt.kind === Kind.Scout
          ? 'bolt-beam'
          : bolt.kind === Kind.GlacierTitan || bolt.kind === Kind.Siege
            ? 'bolt-ice'
            : bolt.kind === Kind.SporeRider
              ? 'bolt-spore'
              : 'bolt-rock';
      const uv = this.atlas.uv[key];
      if (!uv) continue;
      this.write(b, n++, uv, sx, sy, uv.w * zoom, uv.h * zoom, 1, 1, 1, 0.05);
    }
    (b.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount = n;
    b.aUv.needsUpdate = true;
    b.aPos.needsUpdate = true;
    b.aSize.needsUpdate = true;
    b.aTint.needsUpdate = true;
  }

  private write(
    b: Batch,
    i: number,
    uv: Uv,
    sx: number,
    sy: number,
    w: number,
    h: number,
    r: number,
    g: number,
    bl: number,
    depth: number,
  ): void {
    if (i >= b.cap) return;
    b.aUv.setXYZW(i, uv.u0, uv.v0, uv.u1, uv.v1);
    b.aPos.setXYZ(i, sx, sy, depth);
    b.aSize.setXY(i, w, h);
    b.aTint.setXYZ(i, r, g, bl);
  }
}
