/** P11 / P33 / P40 — Three.js world renderer. */

import * as THREE from 'three';
import { Atlas, CELL, buildAtlas, roleOfKind } from './atlas';
import { Kind, MAP, MAX_ENTS, Tile, type Ent } from './engine';
import { TEAM_RGB, isBuilding } from './content';
import type { World } from './sim';

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

const FRAG = /* glsl */ `
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
  private mesh!: THREE.InstancedMesh;
  private shadows!: THREE.InstancedMesh;
  private dummy = new THREE.Object3D();
  private iUv!: THREE.InstancedBufferAttribute;
  private iTeam!: THREE.InstancedBufferAttribute;
  private iFlash!: THREE.InstancedBufferAttribute;
  private fogTex!: THREE.DataTexture;
  private fogData = new Uint8Array(MAP * MAP * 4);
  private mapMesh!: THREE.Mesh;
  private lastCamQ = new THREE.Quaternion();
  private stars!: THREE.Points;
  private nebula!: THREE.Points;
  private readonly drawnEntIds = new Set<number>();

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
    this.camera.position.set(18, 22, 28);
    this.camera.lookAt(18, 0, 22);
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

    const geo = new THREE.PlaneGeometry(1, 1);
    const uv = new Float32Array(MAX_ENTS * 4);
    const team = new Float32Array(MAX_ENTS * 3);
    const flash = new Float32Array(MAX_ENTS);
    this.iUv = new THREE.InstancedBufferAttribute(uv, 4);
    this.iTeam = new THREE.InstancedBufferAttribute(team, 3);
    this.iFlash = new THREE.InstancedBufferAttribute(flash, 1);
    geo.setAttribute('iUv', this.iUv);
    geo.setAttribute('iTeam', this.iTeam);
    geo.setAttribute('iFlash', this.iFlash);

    const mat = new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: tex } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX_ENTS);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

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

    this.buildMap(world);
    this.buildStars();
    this.buildNebula();
    this.fogTex = new THREE.DataTexture(this.fogData, MAP, MAP, THREE.RGBAFormat);
    this.fogTex.magFilter = THREE.NearestFilter;
    this.fogTex.minFilter = THREE.NearestFilter;
    this.fogTex.wrapS = this.fogTex.wrapT = THREE.ClampToEdgeWrapping;
    this.fogTex.needsUpdate = true;
    const fogMat = new THREE.MeshBasicMaterial({
      map: this.fogTex,
      transparent: true,
      depthWrite: false,
    });
    const fogPlane = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), fogMat);
    fogPlane.rotation.x = -Math.PI / 2;
    fogPlane.position.set(MAP / 2, 0.04, MAP / 2);
    this.scene.add(fogPlane);
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
    const y = this.camera.position.y;
    this.camera.position.set(x + 8, y, z + 10);
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
    this.drawnEntIds.clear();
    let drawn = 0;
    const uvArr = this.iUv.array as Float32Array;
    const teamArr = this.iTeam.array as Float32Array;
    const flashArr = this.iFlash.array as Float32Array;

    for (let i = 0; i < MAX_ENTS; i++) {
      const e = world.ents[i];
      if (!e.alive || !e.vis) continue;
      if (e.kind === Kind.Shade && e.stealth > 0.7 && e.team !== 0) continue;
      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;
      const uv = this.uvFor(e);
      if (!uv) continue;

      const cellsW = uv.w / CELL;
      const cellsH = uv.h / CELL;
      let scaleX: number;
      let scaleY: number;
      if (isBuilding(e.kind)) {
        const targetH = e.kind === Kind.Hall ? 2.4 : e.kind === Kind.House ? 1.75 : 1.85;
        const mul = targetH / cellsH;
        scaleX = cellsW * mul * e.facing;
        scaleY = cellsH * mul;
      } else if (e.kind === Kind.Resource) {
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
        scaleX = cellsW * mul;
        scaleY = cellsH * mul;
      } else {
        const unitMul = e.kind === Kind.Worker ? 1.55 : 1.08;
        scaleX = cellsW * unitMul * e.facing;
        scaleY = cellsH * (e.kind === Kind.Worker ? 1.55 : 1.14);
      }
      const lift = e.kind === Kind.Resource ? 0.38 : isBuilding(e.kind) ? 1.15 : 0.9;
      this.dummy.position.set(x, lift, z);
      this.dummy.quaternion.copy(this.lastCamQ);
      this.dummy.scale.set(scaleX, scaleY, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(drawn, this.dummy.matrix);

      if (e.kind === Kind.Resource) {
        this.dummy.position.set(x, 0.03, z);
        this.dummy.quaternion.identity();
        this.dummy.scale.set(e.radius * 1.1, 1, e.radius * 0.85);
        this.dummy.updateMatrix();
        this.shadows.setMatrixAt(drawn, this.dummy.matrix);
      } else {
        this.dummy.position.set(x, 0.03, z);
        this.dummy.quaternion.identity();
        this.dummy.scale.set(e.radius * 2.2, 1, e.radius * 1.6);
        this.dummy.updateMatrix();
        this.shadows.setMatrixAt(drawn, this.dummy.matrix);
      }

      uvArr[drawn * 4] = uv.u0;
      uvArr[drawn * 4 + 1] = uv.v0;
      uvArr[drawn * 4 + 2] = uv.u1;
      uvArr[drawn * 4 + 3] = uv.v1;
      const rgb = TEAM_RGB[e.team] ?? TEAM_RGB[0];
      teamArr[drawn * 3] = rgb[0];
      teamArr[drawn * 3 + 1] = rgb[1];
      teamArr[drawn * 3 + 2] = rgb[2];
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
      flashArr[drawn] = Math.max(e.hitFlash, shootFlash);
      this.drawnEntIds.add(e.id);
      drawn++;
    }

    for (const b of world.bolts) {
      if (drawn >= MAX_ENTS) break;
      const key =
        b.kind === Kind.Prism ? 'bolt-beam' : b.kind === Kind.Siege ? 'bolt-rock' : b.kind === Kind.Shade ? 'bolt-void' : 'bolt-sting';
      const uv = this.atlas.uv[key];
      const rgb = TEAM_RGB[b.team];
      this.dummy.position.set(b.x, 0.85, b.z);
      this.dummy.quaternion.copy(this.lastCamQ);
      this.dummy.scale.set(0.95, 0.95, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(drawn, this.dummy.matrix);
      this.dummy.position.set(b.x, 0.03, b.z);
      this.dummy.quaternion.identity();
      this.dummy.scale.set(0.001, 0.001, 0.001);
      this.dummy.updateMatrix();
      this.shadows.setMatrixAt(drawn, this.dummy.matrix);
      uvArr[drawn * 4] = uv.u0;
      uvArr[drawn * 4 + 1] = uv.v0;
      uvArr[drawn * 4 + 2] = uv.u1;
      uvArr[drawn * 4 + 3] = uv.v1;
      teamArr[drawn * 3] = rgb[0];
      teamArr[drawn * 3 + 1] = rgb[1];
      teamArr[drawn * 3 + 2] = rgb[2];
      flashArr[drawn] = 0;
      drawn++;
    }

    for (const s of world.sparks) {
      if (!s.active || drawn >= MAX_ENTS) break;
      const key = s.kind === 0 ? `spark-muzzle-${s.civ}` : `spark-impact-${s.civ}`;
      const uv = this.atlas.uv[key];
      if (!uv) continue;
      const fade = s.life / s.maxLife;
      const lift = s.kind === 0 ? 0.95 : 0.82;
      const scale = (s.kind === 0 ? 0.72 : 0.88) * (0.55 + 0.45 * fade);
      this.dummy.position.set(s.x, lift, s.z);
      this.dummy.quaternion.copy(this.lastCamQ);
      this.dummy.scale.set(scale, scale, 1);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(drawn, this.dummy.matrix);
      this.dummy.position.set(s.x, 0.03, s.z);
      this.dummy.quaternion.identity();
      this.dummy.scale.set(0.001, 0.001, 0.001);
      this.dummy.updateMatrix();
      this.shadows.setMatrixAt(drawn, this.dummy.matrix);
      uvArr[drawn * 4] = uv.u0;
      uvArr[drawn * 4 + 1] = uv.v0;
      uvArr[drawn * 4 + 2] = uv.u1;
      uvArr[drawn * 4 + 3] = uv.v1;
      teamArr[drawn * 3] = 1;
      teamArr[drawn * 3 + 1] = 1;
      teamArr[drawn * 3 + 2] = 1;
      flashArr[drawn] = 0.28 + 0.42 * fade;
      drawn++;
    }

    this.mesh.count = drawn;
    this.shadows.count = drawn;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.shadows.instanceMatrix.needsUpdate = true;
    this.iUv.needsUpdate = true;
    this.iTeam.needsUpdate = true;
    this.iFlash.needsUpdate = true;

    this.updateFog(world);
    this.renderer.render(this.scene, this.camera);
    this.drawOverlay(world, alpha, selected, box);
  }

  pick(nx: number, ny: number): THREE.Vector3 {
    const v = new THREE.Vector3(nx * 2 - 1, -(ny * 2 - 1), 0.5);
    v.unproject(this.camera);
    const dir = v.sub(this.camera.position).normalize();
    const dist = -this.camera.position.y / dir.y;
    return this.camera.position.clone().addScaledVector(dir, dist);
  }

  project(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.overlay.width,
      y: (-v.y * 0.5 + 0.5) * this.overlay.height,
    };
  }

  info(): { calls: number; tris: number } {
    return { calls: this.renderer.info.render.calls, tris: this.renderer.info.render.triangles };
  }

  private uvFor(e: Ent) {
    const civ = e.civ;
    if (e.kind === Kind.Hall) return this.atlas.uv[`${civ}-hall`];
    if (e.kind === Kind.House) return this.atlas.uv[`${civ}-house`];
    if (e.kind === Kind.Barracks) return this.atlas.uv[`${civ}-barracks`];
    if (e.kind === Kind.UniqueB) return this.atlas.uv[`${civ}-unique`];
    if (e.kind === Kind.Resource) {
      if (e.cargoType === Tile.PropWreck) return this.atlas.uv['prop-wreck'];
      if (e.cargoType === Tile.PropVent) return this.atlas.uv['prop-vent'];
      if (e.cargoType === Tile.Gas) return this.atlas.uv['gem-gas'];
      if (e.cargoType === Tile.Solar) return this.atlas.uv['gem-sol'];
      return this.atlas.uv['gem-ore'];
    }
    const role = roleOfKind(e.kind);
    let f = 0;
    if (e.hp <= 0) f = 4;
    else if (e.order === 2 /* attack */) f = 3;
    else if (Math.abs(e.vx) + Math.abs(e.vz) > 0.08) f = 1 + ((e.anim * 6) | 0) % 2;
    else f = (e.anim * 2) & 1;
    return this.atlas.uv[`${civ}-${role}-${f}`];
  }

  private buildMap(world: World): void {
    const s = 32;
    const c = document.createElement('canvas');
    c.width = MAP * s;
    c.height = MAP * s;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const keys = ['tile-void', 'tile-dust', 'tile-rock', 'tile-ore', 'tile-gas', 'tile-sol'];
    const dustKeys = ['tile-dust', 'tile-dust-b', 'tile-dust-c'];
    for (let z = 0; z < MAP; z++) {
      for (let x = 0; x < MAP; x++) {
        const t = world.tiles[x + z * MAP];
        let key = keys[t] ?? 'tile-void';
        if (t === Tile.Dust) key = dustKeys[(x * 13 + z * 7) % 3] ?? 'tile-dust';
        const uv = this.atlas.uv[key];
        const sx = uv.u0 * this.atlas.canvas.width;
        const sy = (1 - uv.v1) * this.atlas.canvas.height;
        const isRes = t === Tile.Ore || t === Tile.Gas || t === Tile.Solar;
        const bleed = isRes ? 10 : 0;
        const dx = x * s - bleed;
        const dz = z * s - bleed;
        const ds = s + bleed * 2;
        ctx.drawImage(this.atlas.canvas, sx, sy, CELL, CELL, dx, dz, ds, ds);
      }
    }
    const icx = (MAP * 0.5) | 0;
    const icz = (MAP * 0.52) | 0;
    const rockUv = this.atlas.uv['tile-rock'];
    const rsx = rockUv.u0 * this.atlas.canvas.width;
    const rsy = (1 - rockUv.v1) * this.atlas.canvas.height;
    let decals = 0;
    for (let i = 0; decals < 8 && i < 48; i++) {
      const dx = ((i * 17 + 5) % 27) - 13;
      const dz = ((i * 11 + 3) % 20) - 10;
      if (Math.abs(dz) <= 4) continue;
      const tx = icx + dx;
      const tz = icz + dz;
      if (tx < 1 || tz < 1 || tx >= MAP - 2 || tz >= MAP - 2) continue;
      const px = tx * s;
      const pz = tz * s;
      ctx.drawImage(this.atlas.canvas, rsx, rsy, CELL, CELL, px, pz, s * 2, s * 2);
      decals++;
    }
    const tex = new THREE.CanvasTexture(c);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.flipY = true;
    const mat = new THREE.MeshBasicMaterial({ map: tex });
    this.mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(MAP, MAP), mat);
    this.mapMesh.rotation.x = -Math.PI / 2;
    this.mapMesh.position.set(MAP / 2, 0, MAP / 2);
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
        const p = this.project(x, 0.05, z);
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
      const p = this.project(f.x, 0.05, f.z);
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

    for (let i = 0; i < MAX_ENTS; i++) {
      const e = world.ents[i];
      if (!e.alive || !e.vis) continue;
      if (e.kind === Kind.Resource) continue;
      if (!this.drawnEntIds.has(e.id)) continue;
      const sel = selected.has(e.id);
      if (world.tick < 240) {
        if (!sel) continue;
      } else {
        const damaged = e.hp < e.maxHp * 0.92;
        if (!sel && !damaged) continue;
      }
      const x = e.px + (e.x - e.px) * alpha;
      const z = e.pz + (e.z - e.pz) * alpha;
      const p = this.project(x, isBuilding(e.kind) ? 2.4 : 1.65, z);
      const bw = isBuilding(e.kind) ? 36 : 18;
      const bh = 3;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const barY = p.y - 16;
      const isPlayer = e.team === 0;
      if (sel) {
        const ringR = isBuilding(e.kind) ? 34 : 22;
        ctx.strokeStyle = isPlayer ? '#48f048' : '#f04848';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y + 6, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(p.x - bw / 2 - 1, barY - 1, bw + 2, bh + 2);
      if (isPlayer) {
        ctx.fillStyle = ratio > 0.55 ? '#40e840' : ratio > 0.3 ? '#e8c838' : '#e83838';
      } else {
        ctx.fillStyle = ratio > 0.55 ? '#e83838' : ratio > 0.3 ? '#e87828' : '#a02020';
      }
      ctx.fillRect(p.x - bw / 2, barY, bw * ratio, bh);
      if (sel) {
        ctx.strokeStyle = '#ffe848';
        ctx.lineWidth = 1;
        ctx.strokeRect(p.x - bw / 2 - 1, barY - 1, bw + 2, bh + 2);
      }
    }
  }
}
