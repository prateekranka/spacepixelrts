import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

export type TownCenterStage = 1 | 2 | 3 | 4;

export interface SunweaverTownCenterOptions {
  stage?: TownCenterStage;
  crystalColor?: THREE.ColorRepresentation;
  teamColor?: THREE.ColorRepresentation;
  reducedMotion?: boolean;
}

export interface SunweaverTownCenterRuntime {
  readonly parts: readonly THREE.Object3D[];
  readonly pickables: readonly THREE.Mesh[];
  setStage(stage: TownCenterStage): void;
  setExplode(amount: number): void;
  setTeamColor(color: THREE.ColorRepresentation): void;
  update(elapsedSeconds: number, deltaSeconds: number): void;
  dispose(): void;
}

export interface SunweaverTownCenterModel extends THREE.Group {
  userData: THREE.Group['userData'] & {
    sculptRuntime: SunweaverTownCenterRuntime;
  };
}

type MaterialSet = {
  stone: THREE.MeshStandardMaterial;
  stoneLight: THREE.MeshStandardMaterial;
  stoneShadow: THREE.MeshStandardMaterial;
  foundation: THREE.MeshStandardMaterial;
  foundationDark: THREE.MeshStandardMaterial;
  gold: THREE.MeshPhysicalMaterial;
  goldDark: THREE.MeshStandardMaterial;
  blueRoof: THREE.MeshPhysicalMaterial;
  banner: THREE.MeshStandardMaterial;
  crystal: THREE.MeshPhysicalMaterial;
  crystalCore: THREE.MeshStandardMaterial;
  mandorla: THREE.MeshBasicMaterial;
  energy: THREE.MeshStandardMaterial;
  cavity: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  foliageLight: THREE.MeshStandardMaterial;
};

type AnimatedState = {
  crystalShell: THREE.Mesh;
  crystalCore: THREE.Mesh;
  energyMaterial: THREE.MeshStandardMaterial;
  coreMaterial: THREE.MeshStandardMaterial;
  banners: THREE.Mesh[];
  solarRings: THREE.Group;
};

const UP = new THREE.Vector3(0, 1, 0);
const MODEL_CENTER = new THREE.Vector3(0, 2.75, 0);
const GOLD = '#C99132';
const CREAM = '#F0E8D6';
const CYAN = '#36C9FF';
const BLUE = '#1E3A6D';

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

function makeNoiseTexture(
  base: THREE.ColorRepresentation,
  amplitude: number,
  seed: number,
  grayscale = false,
): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Sunweaver Town Center: canvas 2D context is unavailable');
  const image = context.createImageData(size, size);
  const color = new THREE.Color(base);
  const random = seededRandom(seed);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const broad = Math.sin(x * 0.13) * Math.cos(y * 0.11) * 0.42;
      const grain = (random() - 0.5) * 1.15;
      const value = THREE.MathUtils.clamp(broad + grain, -1, 1) * amplitude;
      const index = (x + y * size) * 4;
      if (grayscale) {
        const channel = Math.round(255 * THREE.MathUtils.clamp(color.r + value, 0, 1));
        image.data[index] = channel;
        image.data[index + 1] = channel;
        image.data[index + 2] = channel;
      } else {
        image.data[index] = Math.round(255 * THREE.MathUtils.clamp(color.r + value, 0, 1));
        image.data[index + 1] = Math.round(255 * THREE.MathUtils.clamp(color.g + value, 0, 1));
        image.data[index + 2] = Math.round(255 * THREE.MathUtils.clamp(color.b + value, 0, 1));
      }
      image.data[index + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 8;
  if (!grayscale) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeBannerTexture(teamColor: THREE.ColorRepresentation): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 640;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Sunweaver Town Center: canvas 2D context is unavailable');

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#28548E');
  gradient.addColorStop(0.48, BLUE);
  gradient.addColorStop(1, '#10264E');
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = GOLD;
  context.lineWidth = 18;
  context.strokeRect(15, 15, canvas.width - 30, canvas.height - 30);
  context.strokeStyle = '#8B632C';
  context.lineWidth = 4;
  context.strokeRect(31, 31, canvas.width - 62, canvas.height - 62);

  const centerX = canvas.width * 0.5;
  const centerY = canvas.height * 0.47;
  const outer = 112;
  const inner = 42;
  context.beginPath();
  for (let point = 0; point < 16; point++) {
    const radius = point % 2 === 0 ? outer : inner;
    const angle = -Math.PI * 0.5 + (point * Math.PI) / 8;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    if (point === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.closePath();
  context.fillStyle = GOLD;
  context.fill();
  context.strokeStyle = '#FFF0B3';
  context.lineWidth = 5;
  context.stroke();

  const core = new THREE.Color(teamColor);
  context.beginPath();
  context.arc(centerX, centerY, 38, 0, Math.PI * 2);
  context.fillStyle = `#${core.getHexString()}`;
  context.fill();
  context.strokeStyle = '#D8F5FF';
  context.lineWidth = 8;
  context.stroke();

  context.fillStyle = 'rgba(255,255,255,0.10)';
  context.beginPath();
  context.moveTo(38, 40);
  context.lineTo(142, 40);
  context.lineTo(52, 600);
  context.lineTo(26, 600);
  context.closePath();
  context.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function makeMaterials(
  crystalColor: THREE.ColorRepresentation,
  teamColor: THREE.ColorRepresentation,
): MaterialSet {
  const stoneAlbedo = makeNoiseTexture(CREAM, 0.035, 0x51a7);
  const stoneRoughness = makeNoiseTexture('#A9A9A9', 0.13, 0x5ea1, true);
  const foundationAlbedo = makeNoiseTexture('#7A8591', 0.06, 0xa771);
  const foundationRoughness = makeNoiseTexture('#D0D0D0', 0.08, 0x0f17, true);
  const bannerTexture = makeBannerTexture(teamColor);

  return {
    stone: new THREE.MeshStandardMaterial({
      color: '#C8BBA3',
      map: stoneAlbedo,
      roughness: 0.57,
      roughnessMap: stoneRoughness,
      metalness: 0,
    }),
    stoneLight: new THREE.MeshStandardMaterial({
      color: '#E6D8BD',
      map: stoneAlbedo,
      roughness: 0.52,
      roughnessMap: stoneRoughness,
      metalness: 0,
    }),
    stoneShadow: new THREE.MeshStandardMaterial({
      color: '#8E806B',
      map: stoneAlbedo,
      roughness: 0.66,
      roughnessMap: stoneRoughness,
      metalness: 0,
    }),
    foundation: new THREE.MeshStandardMaterial({
      color: '#7A8591',
      map: foundationAlbedo,
      roughness: 0.84,
      roughnessMap: foundationRoughness,
      metalness: 0,
    }),
    foundationDark: new THREE.MeshStandardMaterial({ color: '#4D555A', roughness: 0.9, metalness: 0 }),
    gold: new THREE.MeshPhysicalMaterial({
      color: GOLD,
      metalness: 1,
      roughness: 0.22,
      clearcoat: 0.3,
      clearcoatRoughness: 0.16,
      envMapIntensity: 1.25,
    }),
    goldDark: new THREE.MeshStandardMaterial({ color: '#70491C', metalness: 0.88, roughness: 0.38 }),
    blueRoof: new THREE.MeshPhysicalMaterial({
      color: BLUE,
      metalness: 0.42,
      roughness: 0.34,
      clearcoat: 0.22,
      clearcoatRoughness: 0.24,
      envMapIntensity: 0.85,
    }),
    banner: new THREE.MeshStandardMaterial({
      color: '#FFFFFF',
      map: bannerTexture,
      roughness: 0.78,
      metalness: 0,
      side: THREE.DoubleSide,
    }),
    crystal: new THREE.MeshPhysicalMaterial({
      color: crystalColor,
      emissive: '#0B6FB8',
      emissiveIntensity: 0.65,
      metalness: 0,
      roughness: 0.09,
      transmission: 0.64,
      thickness: 0.72,
      ior: 1.55,
      transparent: true,
      opacity: 0.82,
      envMapIntensity: 1.55,
      side: THREE.DoubleSide,
      flatShading: true,
    }),
    crystalCore: new THREE.MeshStandardMaterial({
      color: crystalColor,
      emissive: crystalColor,
      emissiveIntensity: 2.8,
      roughness: 0.18,
      metalness: 0,
    }),
    mandorla: new THREE.MeshBasicMaterial({
      color: '#19BFEA',
      toneMapped: false,
      side: THREE.DoubleSide,
    }),
    energy: new THREE.MeshStandardMaterial({
      color: crystalColor,
      emissive: crystalColor,
      emissiveIntensity: 2.2,
      roughness: 0.2,
      metalness: 0,
    }),
    cavity: new THREE.MeshStandardMaterial({ color: '#101824', roughness: 0.94, metalness: 0 }),
    foliage: new THREE.MeshStandardMaterial({ color: '#294A35', roughness: 0.95, metalness: 0, flatShading: true }),
    foliageLight: new THREE.MeshStandardMaterial({ color: '#58733A', roughness: 0.92, metalness: 0, flatShading: true }),
  };
}

function latheGeometry(points: readonly [number, number][], segments = 64): THREE.LatheGeometry {
  return new THREE.LatheGeometry(points.map(([radius, y]) => new THREE.Vector2(radius, y)), segments);
}

function beam(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
  radialSegments = 10,
): THREE.Mesh {
  const delta = new THREE.Vector3().subVectors(end, start);
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, Math.max(delta.length(), 0.001), radialSegments, 1),
    material,
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, delta.normalize());
  return mesh;
}

function tube(
  points: readonly THREE.Vector3[],
  radius: number,
  material: THREE.Material,
  tubularSegments = 32,
): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3([...points], false, 'catmullrom', 0.55);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, tubularSegments, radius, 8, false), material);
}

function annularWedgeGeometry(
  innerRadius: number,
  outerRadius: number,
  startAngle: number,
  endAngle: number,
  innerY: number,
  outerY: number,
  thickness: number,
  segments = 10,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let layer = 0; layer < 2; layer++) {
    const yOffset = layer === 0 ? -thickness * 0.5 : thickness * 0.5;
    for (let step = 0; step <= segments; step++) {
      const angle = THREE.MathUtils.lerp(startAngle, endAngle, step / segments);
      for (const [radius, y] of [[innerRadius, innerY], [outerRadius, outerY]] as const) {
        positions.push(Math.sin(angle) * radius, y + yOffset, Math.cos(angle) * radius);
      }
    }
  }
  const row = (segments + 1) * 2;
  for (let step = 0; step < segments; step++) {
    const bottom = step * 2;
    const top = row + bottom;
    indices.push(bottom, bottom + 2, bottom + 1, bottom + 2, bottom + 3, bottom + 1);
    indices.push(top, top + 1, top + 2, top + 2, top + 1, top + 3);
    indices.push(bottom, top, bottom + 2, bottom + 2, top, top + 2);
    indices.push(bottom + 1, bottom + 3, top + 1, bottom + 3, top + 3, top + 1);
  }
  for (const step of [0, segments]) {
    const bottom = step * 2;
    const top = row + bottom;
    if (step === 0) indices.push(bottom, bottom + 1, top, top, bottom + 1, top + 1);
    else indices.push(bottom, top, bottom + 1, top, top + 1, bottom + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function pointedArchShape(width: number, height: number): THREE.Shape {
  const half = width * 0.5;
  const spring = height * 0.46;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, spring);
  shape.quadraticCurveTo(half * 0.82, height * 0.78, 0, height);
  shape.quadraticCurveTo(-half * 0.82, height * 0.78, -half, spring);
  shape.closePath();
  return shape;
}

function pointedArchFrame(width: number, height: number, depth: number, thickness: number): THREE.Mesh {
  const outer = pointedArchShape(width, height);
  const innerWidth = Math.max(0.08, width - thickness * 2);
  const innerHeight = Math.max(0.12, height - thickness * 1.75);
  const inner = pointedArchShape(innerWidth, innerHeight);
  const hole = new THREE.Path(inner.getPoints(12));
  outer.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelSize: Math.min(0.045, thickness * 0.18),
    bevelThickness: 0.035,
    bevelSegments: 2,
    curveSegments: 8,
  });
  geometry.translate(0, 0, -depth * 0.5);
  return new THREE.Mesh(geometry);
}

function pointedArchFill(width: number, height: number): THREE.ShapeGeometry {
  return new THREE.ShapeGeometry(pointedArchShape(width, height), 12);
}

function almondShape(width: number, height: number): THREE.Shape {
  const halfWidth = width * 0.5;
  const halfHeight = height * 0.5;
  const shape = new THREE.Shape();
  shape.moveTo(0, halfHeight);
  shape.quadraticCurveTo(halfWidth * 0.82, halfHeight * 0.72, halfWidth, 0);
  shape.quadraticCurveTo(halfWidth * 0.82, -halfHeight * 0.72, 0, -halfHeight);
  shape.quadraticCurveTo(-halfWidth * 0.82, -halfHeight * 0.72, -halfWidth, 0);
  shape.quadraticCurveTo(-halfWidth * 0.82, halfHeight * 0.72, 0, halfHeight);
  shape.closePath();
  return shape;
}

function almondExtrudedGeometry(
  width: number,
  height: number,
  depth: number,
  bevelSize: number,
): THREE.ExtrudeGeometry {
  const geometry = new THREE.ExtrudeGeometry(almondShape(width, height), {
    depth,
    bevelEnabled: true,
    bevelSize,
    bevelThickness: Math.min(bevelSize * 0.8, depth * 0.32),
    bevelSegments: 3,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth * 0.5);
  return geometry;
}

function almondFrameGeometry(
  width: number,
  height: number,
  depth: number,
  thickness: number,
): THREE.ExtrudeGeometry {
  const outer = almondShape(width, height);
  const inner = almondShape(Math.max(0.08, width - thickness * 2), Math.max(0.12, height - thickness * 2));
  outer.holes.push(new THREE.Path(inner.getPoints(32)));
  const geometry = new THREE.ExtrudeGeometry(outer, {
    depth,
    bevelEnabled: true,
    bevelSize: Math.min(0.055, thickness * 0.24),
    bevelThickness: Math.min(0.045, depth * 0.3),
    bevelSegments: 3,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -depth * 0.5);
  return geometry;
}

function crystalGeometry(radius: number, height: number, segments = 8): THREE.BufferGeometry {
  const positions: number[] = [];
  const rings = [
    { y: -height * 0.5, radius: radius * 0.14, offset: 0 },
    { y: -height * 0.26, radius: radius * 0.92, offset: Math.PI / segments },
    { y: height * 0.18, radius, offset: 0 },
    { y: height * 0.42, radius: radius * 0.58, offset: Math.PI / segments },
  ];
  positions.push(0, -height * 0.56, 0);
  for (const ring of rings) {
    for (let index = 0; index < segments; index++) {
      const angle = ring.offset + (index * Math.PI * 2) / segments;
      positions.push(Math.sin(angle) * ring.radius, ring.y, Math.cos(angle) * ring.radius * 0.82);
    }
  }
  const topIndex = positions.length / 3;
  positions.push(0, height * 0.58, 0);
  const indices: number[] = [];
  const ringIndex = (ring: number, item: number) => 1 + ring * segments + ((item + segments) % segments);
  for (let item = 0; item < segments; item++) {
    indices.push(0, ringIndex(0, item + 1), ringIndex(0, item));
    for (let ring = 0; ring < rings.length - 1; ring++) {
      const a = ringIndex(ring, item);
      const b = ringIndex(ring, item + 1);
      const c = ringIndex(ring + 1, item);
      const d = ringIndex(ring + 1, item + 1);
      indices.push(a, b, c, b, d, c);
    }
    indices.push(ringIndex(rings.length - 1, item), ringIndex(rings.length - 1, item + 1), topIndex);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function bannerGeometry(width: number, height: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, 10, 18);
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const vertical = y / height + 0.5;
    const wave = Math.sin(vertical * Math.PI * 2.2 + x * 2.5) * 0.055 * vertical;
    position.setZ(index, wave);
    position.setX(index, x * (1 - vertical * 0.08));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

function createPaverRing(
  radius: number,
  count: number,
  width: number,
  depth: number,
  y: number,
  material: THREE.Material,
  seed: number,
): THREE.InstancedMesh {
  const geometry = new RoundedBoxGeometry(width, 0.08, depth, 2, 0.025);
  const mesh = new THREE.InstancedMesh(geometry, material, count);
  const random = seededRandom(seed);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  for (let index = 0; index < count; index++) {
    const angle = (index / count) * Math.PI * 2;
    const jitter = (random() - 0.5) * 0.08;
    position.set(Math.sin(angle) * (radius + jitter), y + (random() - 0.5) * 0.012, Math.cos(angle) * (radius + jitter));
    quaternion.setFromAxisAngle(UP, angle);
    scale.set(0.9 + random() * 0.16, 1, 0.9 + random() * 0.18);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function createFoundation(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'foundation-plaza';
  const plaza = new THREE.Mesh(
    latheGeometry([
      [3.02, 0.00], [3.37, 0.03], [3.52, 0.12], [3.49, 0.25], [3.33, 0.34],
      [2.84, 0.39], [1.62, 0.42], [0.0, 0.42],
    ]),
    materials.foundation,
  );
  group.add(plaza);

  for (const [radius, tubeRadius, y] of [[3.45, 0.06, 0.22], [2.95, 0.035, 0.43], [2.25, 0.025, 0.44]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeRadius, 8, 96), materials.foundationDark);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = y;
    group.add(ring);
  }
  group.add(createPaverRing(3.22, 32, 0.54, 0.48, 0.38, materials.foundation, 0x3312));
  group.add(createPaverRing(2.62, 24, 0.52, 0.44, 0.425, materials.foundation, 0x2218));

  const seamGeometry = new RoundedBoxGeometry(0.028, 0.018, 0.84, 1, 0.006);
  const seamMesh = new THREE.InstancedMesh(seamGeometry, materials.foundationDark, 24);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  for (let index = 0; index < 24; index++) {
    const angle = (index / 24) * Math.PI * 2;
    position.set(Math.sin(angle) * 2.93, 0.465, Math.cos(angle) * 2.93);
    quaternion.setFromAxisAngle(UP, angle);
    matrix.compose(position, quaternion, new THREE.Vector3(1, 1, 1));
    seamMesh.setMatrixAt(index, matrix);
  }
  seamMesh.instanceMatrix.needsUpdate = true;
  group.add(seamMesh);
  return group;
}

function createBodyDrums(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'body-drums';

  const lower = new THREE.Mesh(
    latheGeometry([
      [0.0, 0.42], [2.62, 0.42], [2.78, 0.52], [2.83, 0.72], [2.76, 0.89],
      [2.72, 1.24], [2.61, 1.48], [2.48, 1.58], [0.0, 1.58],
    ]),
    materials.stone,
  );
  lower.name = 'lower-drum';
  lower.userData.minimumStage = 1;
  group.add(lower);

  const lowerShadow = new THREE.Mesh(new THREE.TorusGeometry(2.67, 0.13, 12, 96), materials.stoneShadow);
  lowerShadow.name = 'stone-seams';
  lowerShadow.rotation.x = Math.PI * 0.5;
  lowerShadow.position.y = 0.72;
  lowerShadow.userData.minimumStage = 1;
  group.add(lowerShadow);

  const mid = new THREE.Mesh(
    latheGeometry([
      [0.0, 1.47], [2.42, 1.47], [2.55, 1.62], [2.5, 1.83], [2.36, 2.05],
      [2.35, 2.36], [2.18, 2.56], [1.98, 2.67], [0.0, 2.67],
    ]),
    materials.stoneLight,
  );
  mid.name = 'stage-2-mid-drum';
  mid.userData.minimumStage = 2;
  group.add(mid);

  const cradle = new THREE.Mesh(
    latheGeometry([
      [0.0, 2.48], [1.78, 2.48], [1.88, 2.64], [1.78, 2.82], [1.6, 3.02],
      [1.47, 3.31], [1.24, 3.45], [0.0, 3.45],
    ]),
    materials.stone,
  );
  cradle.name = 'upper-cradle';
  cradle.userData.minimumStage = 3;
  group.add(cradle);

  for (const [radius, y, tubeRadius, material] of [
    [2.78, 0.58, 0.065, materials.goldDark],
    [2.67, 1.43, 0.055, materials.gold],
    [2.43, 1.68, 0.055, materials.gold],
    [2.18, 2.54, 0.06, materials.gold],
    [1.7, 2.78, 0.05, materials.gold],
    [1.42, 3.32, 0.055, materials.gold],
  ] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, tubeRadius, 8, 96), material);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = y;
    ring.userData.minimumStage = y < 1.6 ? 1 : y < 2.7 ? 2 : 3;
    group.add(ring);
  }

  return group;
}

function createConstructionCore(materials: MaterialSet, stage: 1 | 2 | 3): THREE.Group {
  const group = new THREE.Group();
  group.name = stage === 1 ? 'upgrade-stages' : `stage-${stage}-temporary-core`;
  group.userData.exactStage = stage;
  const baseY = stage === 1 ? 1.48 : stage === 2 ? 2.5 : 3.24;
  const radius = stage === 1 ? 0.78 : stage === 2 ? 0.93 : 1.05;
  const socketHeight = stage === 1 ? 0.44 : 0.3;

  const socket = new THREE.Mesh(latheGeometry([
    [0.0, baseY], [radius, baseY], [radius * 1.08, baseY + 0.1],
    [radius * 0.86, baseY + socketHeight], [0.0, baseY + socketHeight],
  ], 36), stage === 1 ? materials.foundation : materials.stoneLight);
  group.add(socket);
  const socketRing = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 7, 48), materials.gold);
  socketRing.rotation.x = Math.PI * 0.5;
  socketRing.position.y = baseY + 0.1;
  group.add(socketRing);

  if (stage >= 2) {
    // Stage 3 is the closed construction cage. The pointed crystal belongs to
    // the final Stage 4 spire and must not appear inside this temporary cage.
    const crystalHeight = 0.52;
    const crystalRadius = 0.18;
    if (stage === 2) {
      const crystal = new THREE.Mesh(crystalGeometry(crystalRadius, crystalHeight, 7), materials.energy);
      crystal.position.y = baseY + socketHeight + crystalHeight * 0.48;
      group.add(crystal);
    }

    const scaffoldTop = stage === 2
      ? baseY + socketHeight + crystalHeight + 0.18
      : baseY + 1.12;
    const poleTop = stage === 2 ? scaffoldTop : scaffoldTop + 0.12;
    for (let index = 0; index < 4; index++) {
      const angle = (index / 4) * Math.PI * 2 + Math.PI * 0.25;
      const start = new THREE.Vector3(Math.sin(angle) * radius * 1.15, baseY + 0.04, Math.cos(angle) * radius * 1.15);
      const end = new THREE.Vector3(Math.sin(angle) * radius * 0.55, poleTop, Math.cos(angle) * radius * 0.55);
      group.add(beam(start, end, stage === 2 ? 0.042 : 0.05, materials.gold, 7));
    }

    if (stage === 3) {
      const crownRing = new THREE.Mesh(
        new THREE.TorusGeometry(radius * 0.56, 0.055, 8, 32),
        materials.gold,
      );
      crownRing.rotation.x = Math.PI * 0.5;
      crownRing.position.y = poleTop;
      group.add(crownRing);
      for (let index = 0; index < 4; index++) {
        const angle = (index / 4) * Math.PI * 2 + Math.PI * 0.25;
        const nextAngle = ((index + 1) / 4) * Math.PI * 2 + Math.PI * 0.25;
        group.add(beam(
          new THREE.Vector3(Math.sin(angle) * radius * 0.55, poleTop, Math.cos(angle) * radius * 0.55),
          new THREE.Vector3(Math.sin(nextAngle) * radius * 0.55, poleTop, Math.cos(nextAngle) * radius * 0.55),
          0.042,
          materials.gold,
          7,
        ));
      }
    }
  }
  return group;
}

function createStair(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'front-stair';
  const steps = 10;
  const stairCaps = new THREE.Group();
  stairCaps.name = 'gold-stair-caps';
  group.add(stairCaps);
  for (let index = 0; index < steps; index++) {
    const t = index / (steps - 1);
    const width = THREE.MathUtils.lerp(2.88, 1.52, t);
    const z = THREE.MathUtils.lerp(3.48, 2.53, t);
    const y = 0.43 + t * 0.83;
    const step = new THREE.Mesh(new RoundedBoxGeometry(width, 0.14, 0.28, 2, 0.025), materials.stoneLight);
    step.position.set(0, y, z);
    group.add(step);
    const nosing = new THREE.Mesh(new RoundedBoxGeometry(width + 0.05, 0.045, 0.08, 2, 0.016), materials.goldDark);
    nosing.position.set(0, y + 0.08, z + 0.115);
    stairCaps.add(nosing);
  }

  for (const side of [-1, 1]) {
    for (let index = 0; index < steps; index += 2) {
      const t = index / (steps - 1);
      const width = THREE.MathUtils.lerp(2.88, 1.52, t);
      const y = 0.43 + t * 0.83;
      const z = THREE.MathUtils.lerp(3.48, 2.53, t);
      const nosing = new THREE.Mesh(new RoundedBoxGeometry(width + 0.04, 0.028, 0.06, 2, 0.012), materials.goldDark);
      nosing.position.set(side * (width * 0.5 + 0.04), y + 0.07, z + 0.11);
      stairCaps.add(nosing);
    }
  }
  return group;
}

function createEntrance(materials: MaterialSet, rear = false): THREE.Group {
  const group = new THREE.Group();
  group.name = rear ? 'rear-portal' : 'front-entrance';
  const width = rear ? 0.96 : 1.06;
  const height = rear ? 1.28 : 1.02;
  const z = rear ? -2.69 : 2.69;
  group.position.set(0, rear ? 0.54 : 0.04, z);
  group.rotation.y = rear ? Math.PI : 0;

  const cavity = new THREE.Mesh(pointedArchFill(width * 0.72, height * 0.82), materials.cavity);
  cavity.position.z = 0.105;
  group.add(cavity);

  const stoneFrame = pointedArchFrame(width, height, 0.28, rear ? 0.16 : 0.22);
  stoneFrame.material = materials.stoneLight;
  group.add(stoneFrame);

  const goldFrame = pointedArchFrame(width * 0.78, height * 0.82, 0.315, rear ? 0.07 : 0.085);
  goldFrame.material = materials.gold;
  goldFrame.position.z = 0.025;
  group.add(goldFrame);

  // The front doorway is deliberately plain and low. Its removed jewel and
  // rim previously hung into the mandorla. The rear portal remains unchanged.
  return group;
}

function createFacadeRhythm(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'radial-crown';
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const bay = new THREE.Group();
    bay.name = `pointed-facade-bay-${index + 1}`;

    const cavity = new THREE.Mesh(pointedArchFill(0.48, 0.78), materials.cavity);
    cavity.position.z = 0.075;
    bay.add(cavity);
    const stoneFrame = pointedArchFrame(0.76, 1.12, 0.17, 0.13);
    stoneFrame.material = materials.stoneLight;
    bay.add(stoneFrame);
    const goldFrame = pointedArchFrame(0.58, 0.92, 0.195, 0.055);
    goldFrame.material = materials.gold;
    goldFrame.position.z = 0.025;
    bay.add(goldFrame);

    const radius = 2.79;
    bay.position.set(Math.sin(angle) * radius, 0.58, Math.cos(angle) * radius);
    bay.rotation.y = angle;
    group.add(bay);

    const upperAngle = angle + Math.PI * 0.125;
    const upperBay = new THREE.Group();
    upperBay.name = `upper-almond-bay-${index + 1}`;
    const upperCavity = new THREE.Mesh(pointedArchFill(0.32, 0.52), materials.cavity);
    upperCavity.position.z = 0.06;
    upperBay.add(upperCavity);
    const upperGold = pointedArchFrame(0.46, 0.68, 0.14, 0.05);
    upperGold.material = materials.gold;
    upperGold.position.z = 0.02;
    upperBay.add(upperGold);
    const upperRadius = 2.45;
    upperBay.position.set(Math.sin(upperAngle) * upperRadius, 1.52, Math.cos(upperAngle) * upperRadius);
    upperBay.rotation.y = upperAngle;
    group.add(upperBay);
  }
  return group;
}

function createFrontHeartFacade(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'front-approach';
  // Keep the complete hero assembly attached to the radial shell. The heart is
  // centered in the recess, close to the arch plane, without changing the annex.
  group.position.set(0, 1.28, 2.94);

  const archWidth = 1.96;
  const archHeight = 2.34;
  const darkRecess = new THREE.Mesh(pointedArchFill(archWidth * 0.68, archHeight * 0.82), materials.cavity);
  darkRecess.position.z = -0.62;
  group.add(darkRecess);
  const innerCavity = new THREE.Mesh(pointedArchFill(archWidth * 0.54, archHeight * 0.68), materials.foundationDark);
  innerCavity.position.set(0, 0.02, -0.48);
  group.add(innerCavity);
  const deepStoneFrame = pointedArchFrame(archWidth, archHeight, 0.32, 0.28);
  deepStoneFrame.material = materials.stoneShadow;
  deepStoneFrame.position.z = -0.28;
  group.add(deepStoneFrame);
  const stoneFrame = pointedArchFrame(archWidth, archHeight, 0.48, 0.28);
  stoneFrame.material = materials.stoneLight;
  stoneFrame.position.z = 0.01;
  group.add(stoneFrame);

  const almond = new THREE.Group();
  almond.name = 'front-almond-jewel';
  const almondCenterY = 1.04;
  const almondFrame = new THREE.Mesh(almondFrameGeometry(1.50, 2.02, 0.18, 0.16), materials.gold);
  almondFrame.position.set(0, almondCenterY, 0.18);
  almond.add(almondFrame);
  const backplate = new THREE.Mesh(almondExtrudedGeometry(1.30, 1.82, 0.07, 0.025), materials.mandorla);
  backplate.name = 'front-almond-backplate';
  backplate.position.set(0, almondCenterY, -0.06);
  almond.add(backplate);
  const shell = new THREE.Mesh(almondExtrudedGeometry(1.34, 1.86, 0.16, 0.045), materials.crystal);
  shell.position.set(0, almondCenterY, 0.02);
  almond.add(shell);
  const core = new THREE.Mesh(almondExtrudedGeometry(1.10, 1.58, 0.10, 0.035), materials.mandorla);
  core.position.set(0, almondCenterY, 0.12);
  almond.add(core);
  group.add(almond);

  // Heavy curved pauldron lips hold the arch open on both sides.
  const lipPoints = (side: number): THREE.Vector3[] => [
    new THREE.Vector3(side * 0.94, 0.08, 0.20),
    new THREE.Vector3(side * 1.14, 0.62, 0.26),
    new THREE.Vector3(side * 0.96, 1.38, 0.30),
    new THREE.Vector3(side * 0.58, 2.12, 0.28),
  ];
  group.add(tube(lipPoints(-1), 0.22, materials.gold, 36));
  group.add(tube(lipPoints(1), 0.22, materials.gold, 36));

  // Woven ribs stay in the narrow side zones. The almond remains a clean,
  // uninterrupted cyan silhouette.
  const ribZ = 0.43;
  for (const side of [-1, 1]) {
    const inner = side * 0.86;
    const outer = side * 1.02;
    group.add(tube([
      new THREE.Vector3(inner, 0.18, ribZ),
      new THREE.Vector3(inner + side * 0.05, 0.78, ribZ + 0.01),
      new THREE.Vector3(inner - side * 0.02, 1.38, ribZ + 0.015),
      new THREE.Vector3(inner + side * 0.04, 1.92, ribZ),
    ], 0.06, materials.goldDark, 28));
    group.add(tube([
      new THREE.Vector3(outer, 0.22, ribZ + 0.02),
      new THREE.Vector3(outer - side * 0.04, 0.82, ribZ + 0.035),
      new THREE.Vector3(outer + side * 0.02, 1.42, ribZ + 0.04),
      new THREE.Vector3(outer - side * 0.05, 1.88, ribZ + 0.02),
    ], 0.06, materials.gold, 28));
    for (const [index, y] of [0.50, 0.90, 1.30, 1.70].entries()) {
      const laceMaterial = index % 2 === 0 ? materials.gold : materials.goldDark;
      const lower = y - 0.15;
      const upper = y + 0.15;
      group.add(beam(
        new THREE.Vector3(inner, lower, ribZ + 0.035),
        new THREE.Vector3(outer, upper, ribZ + 0.055),
        0.048,
        laceMaterial,
        7,
      ));
    }
  }
  return group;
}

function createButtress(materials: MaterialSet, angle: number, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `buttress-${index + 1}`;
  const shape = new THREE.Shape();
  shape.moveTo(-0.36, 0);
  shape.lineTo(0.36, 0);
  shape.lineTo(0.29, 0.68);
  shape.quadraticCurveTo(0.26, 1.02, 0.12, 1.22);
  shape.quadraticCurveTo(0.04, 1.34, 0, 1.38);
  shape.quadraticCurveTo(-0.04, 1.34, -0.12, 1.22);
  shape.quadraticCurveTo(-0.26, 1.02, -0.29, 0.68);
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: 0.48,
    bevelEnabled: true,
    bevelSize: 0.03,
    bevelThickness: 0.03,
    bevelSegments: 2,
    curveSegments: 12,
  });
  geometry.translate(0, 0, -0.24);
  const fin = new THREE.Mesh(geometry, index % 2 === 0 ? materials.stoneLight : materials.stone);
  group.add(fin);

  const inset = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.58, 0.035, 3, 0.06), materials.cavity);
  inset.position.set(0, 0.68, 0.285);
  group.add(inset);
  group.add(beam(new THREE.Vector3(-0.28, 0.06, 0.28), new THREE.Vector3(-0.08, 1.12, 0.28), 0.035, materials.gold));
  group.add(beam(new THREE.Vector3(0.28, 0.06, 0.28), new THREE.Vector3(0.08, 1.12, 0.28), 0.035, materials.gold));

  const radius = 2.62;
  group.position.set(Math.sin(angle) * radius, 0.48, Math.cos(angle) * radius);
  group.rotation.y = angle;
  return group;
}

function createTurret(materials: MaterialSet, angle: number, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `secondary-turret-${index + 1}`;
  const body = new THREE.Mesh(
    latheGeometry([
      [0.0, 0], [0.5, 0], [0.58, 0.16], [0.55, 0.64], [0.46, 1.02],
      [0.4, 1.42], [0.3, 1.72], [0.0, 1.72],
    ], 36),
    materials.stoneLight,
  );
  group.add(body);
  for (const [radius, y] of [[0.56, 0.18], [0.45, 1.02], [0.31, 1.63]] as const) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.045, 7, 36), materials.gold);
    ring.rotation.x = Math.PI * 0.5;
    ring.position.y = y;
    group.add(ring);
  }
  const needle = new THREE.Mesh(crystalGeometry(0.2, 0.92, 6), materials.crystal);
  needle.position.y = 2.03;
  group.add(needle);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.115, 0.42, 6), materials.gold);
  finial.name = 'turret-finials';
  finial.position.y = 2.7;
  group.add(finial);
  const inset = new THREE.Mesh(crystalGeometry(0.11, 0.32, 6), materials.energy);
  inset.position.set(0, 0.91, 0.54);
  group.add(inset);

  const radius = 2.73;
  group.position.set(Math.sin(angle) * radius, 0.4, Math.cos(angle) * radius);
  group.rotation.y = angle;
  return group;
}

function createGallery(materials: MaterialSet, angle: number, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = ['spoke-south', 'spoke-east', 'spoke-north', 'spoke-west'][index] ?? `spoke-${index + 1}`;
  const shell = new THREE.Mesh(new RoundedBoxGeometry(1.18, 1.18, 1.58, 4, 0.2), materials.stone);
  const shellRadius = 1.88;
  shell.position.set(Math.sin(angle) * shellRadius, 2.0, Math.cos(angle) * shellRadius);
  shell.rotation.y = angle;
  group.add(shell);

  const facade = new THREE.Group();
  const cavity = new THREE.Mesh(pointedArchFill(0.54, 0.86), materials.cavity);
  cavity.position.z = 0.075;
  facade.add(cavity);
  const arch = pointedArchFrame(0.78, 1.16, 0.17, 0.13);
  arch.material = materials.stoneLight;
  facade.add(arch);
  const archGold = pointedArchFrame(0.58, 0.92, 0.195, 0.055);
  archGold.material = materials.gold;
  archGold.position.z = 0.025;
  facade.add(archGold);
  const jewel = new THREE.Mesh(crystalGeometry(0.09, 0.3, 6), materials.energy);
  jewel.position.set(0, 1.26, 0.13);
  facade.add(jewel);
  const facadeRadius = 2.7;
  facade.position.set(Math.sin(angle) * facadeRadius, 1.45, Math.cos(angle) * facadeRadius);
  facade.rotation.y = angle;
  group.add(facade);

  const roof = new THREE.Mesh(
    annularWedgeGeometry(1.42, 2.48, angle - 0.29, angle + 0.29, 2.92, 2.4, 0.18, 10),
    materials.stoneLight,
  );
  group.add(roof);
  const roofOuter = new THREE.Mesh(
    annularWedgeGeometry(2.38, 2.54, angle - 0.31, angle + 0.31, 2.44, 2.35, 0.1, 8),
    materials.gold,
  );
  group.add(roofOuter);
  return group;
}

function createPauldronPlates(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'mid-crown';
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const plate = new THREE.Mesh(
      annularWedgeGeometry(2.08, 2.66, angle - 0.18, angle + 0.18, 2.76, 2.26, 0.27, 9),
      index % 2 === 0 ? materials.stoneLight : materials.stone,
    );
    group.add(plate);
    const cap = new THREE.Mesh(
      annularWedgeGeometry(2.56, 2.75, angle - 0.19, angle + 0.19, 2.42, 2.24, 0.12, 9),
      materials.gold,
    );
    group.add(cap);
  }
  return group;
}

function createWishboneRibs(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'gold-trim-system';
  const ribs = new THREE.Group();
  ribs.name = 'wishbone-rib-relief';
  group.add(ribs);
  for (let module = 0; module < 4; module++) {
    const baseAngle = (module / 4) * Math.PI * 2;
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      const angle0 = baseAngle + side * 0.2;
      const angle1 = baseAngle + side * 0.11;
      points.push(new THREE.Vector3(Math.sin(angle0) * 2.55, 1.23, Math.cos(angle0) * 2.55));
      points.push(new THREE.Vector3(Math.sin(angle0) * 2.37, 1.94, Math.cos(angle0) * 2.37));
      points.push(new THREE.Vector3(Math.sin(angle1) * 1.92, 2.72, Math.cos(angle1) * 1.92));
      points.push(new THREE.Vector3(Math.sin(baseAngle + side * 0.05) * 1.42, 3.22, Math.cos(baseAngle + side * 0.05) * 1.42));
      ribs.add(tube(points, 0.075, materials.gold, 40));
    }
    const bridgeStart = new THREE.Vector3(Math.sin(baseAngle - 0.13) * 1.58, 3.08, Math.cos(baseAngle - 0.13) * 1.58);
    const bridgeEnd = new THREE.Vector3(Math.sin(baseAngle + 0.13) * 1.58, 3.08, Math.cos(baseAngle + 0.13) * 1.58);
    group.add(beam(bridgeStart, bridgeEnd, 0.045, materials.gold));
  }
  return group;
}

function createConduits(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'energy-conduits';
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const points = [
      new THREE.Vector3(Math.sin(angle) * 2.79, 0.67, Math.cos(angle) * 2.79),
      new THREE.Vector3(Math.sin(angle) * 2.72, 1.34, Math.cos(angle) * 2.72),
      new THREE.Vector3(Math.sin(angle) * 2.42, 1.86, Math.cos(angle) * 2.42),
      new THREE.Vector3(Math.sin(angle) * 2.22, 2.43, Math.cos(angle) * 2.22),
    ];
    group.add(tube(points, 0.065, materials.cavity, 28));
    group.add(tube(points.map((point) => point.clone().multiply(new THREE.Vector3(1.001, 1, 1.001))), 0.027, materials.energy, 28));
    const node = new THREE.Mesh(new THREE.SphereGeometry(0.105, 10, 8), materials.energy);
    node.position.copy(points[2]);
    group.add(node);
  }
  return group;
}

function createBanner(materials: MaterialSet, angle: number, index: number): THREE.Group {
  const group = new THREE.Group();
  group.name = `sunburst-banner-${index + 1}`;
  const radius = 3.14;
  group.position.set(Math.sin(angle) * radius, 1.35, Math.cos(angle) * radius);
  group.rotation.y = angle;

  const pole = beam(new THREE.Vector3(-0.46, 0.1, 0), new THREE.Vector3(-0.46, 1.48, 0), 0.035, materials.gold);
  group.add(pole);
  group.add(beam(new THREE.Vector3(-0.53, 1.39, 0), new THREE.Vector3(0.5, 1.39, 0), 0.035, materials.gold));
  const banner = new THREE.Mesh(bannerGeometry(0.67, 1.02), materials.banner);
  banner.position.set(-0.02, 0.86, 0.025);
  banner.userData.bannerIndex = index;
  group.add(banner);
  const emblem = new THREE.Group();
  emblem.name = 'banner-emblems';
  const emblemRing = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 6, 16), materials.gold);
  emblemRing.rotation.x = Math.PI * 0.5;
  emblemRing.position.set(-0.02, 0.88, 0.052);
  emblem.add(emblemRing);
  group.add(emblem);
  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.32, 6), materials.gold);
  finial.position.set(-0.46, 1.69, 0);
  group.add(finial);
  return group;
}

function createCrystalSpire(materials: MaterialSet): { group: THREE.Group; shell: THREE.Mesh; core: THREE.Mesh; rings: THREE.Group } {
  const group = new THREE.Group();
  group.name = 'central-spire';

  const plinth = new THREE.Mesh(
    latheGeometry([[0.0, 3.2], [1.18, 3.2], [1.28, 3.36], [1.02, 3.62], [0.76, 3.76], [0.0, 3.76]], 48),
    materials.stoneLight,
  );
  group.add(plinth);
  const plinthRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.065, 8, 64), materials.gold);
  plinthRing.rotation.x = Math.PI * 0.5;
  plinthRing.position.y = 3.34;
  group.add(plinthRing);

  const towerHousing = new THREE.Group();
  towerHousing.name = 'four-arched-crystal-housing';
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2;
    const housingBay = new THREE.Group();
    const darkInset = new THREE.Mesh(pointedArchFill(0.35, 0.72), materials.cavity);
    darkInset.position.z = 0.055;
    housingBay.add(darkInset);
    const housingFrame = pointedArchFrame(0.55, 0.95, 0.13, 0.09);
    housingFrame.material = materials.stoneLight;
    housingBay.add(housingFrame);
    const housingGold = pointedArchFrame(0.4, 0.78, 0.155, 0.04);
    housingGold.material = materials.gold;
    housingGold.position.z = 0.025;
    housingBay.add(housingGold);
    const radius = 1.02;
    housingBay.position.set(Math.sin(angle) * radius, 3.36, Math.cos(angle) * radius);
    housingBay.rotation.y = angle;
    towerHousing.add(housingBay);
  }
  group.add(towerHousing);

  const shell = new THREE.Mesh(crystalGeometry(0.54, 2.22, 8), materials.crystal);
  shell.name = 'central-crystal';
  shell.position.y = 4.78;
  shell.scale.set(0.84, 0.9, 0.84);
  group.add(shell);
  const core = new THREE.Mesh(crystalGeometry(0.25, 1.48, 8), materials.crystalCore);
  core.name = 'central-crystal-core';
  core.position.y = 4.74;
  core.scale.set(0.84, 0.9, 0.84);
  group.add(core);

  const cage = new THREE.Group();
  cage.name = 'crystal-cage';
  // Turn the square cage half a bay so two front prongs flank, rather than
  // overlap, the cyan shell. The larger radius makes all four prongs read in
  // front, top, and rear views.
  cage.rotation.y = Math.PI * 0.25;
  for (let index = 0; index < 4; index++) {
    const angle = (index / 4) * Math.PI * 2;
    const points = [
      new THREE.Vector3(Math.sin(angle) * 1.00, 3.42, Math.cos(angle) * 1.00),
      new THREE.Vector3(Math.sin(angle) * 1.08, 4.18, Math.cos(angle) * 1.08),
      new THREE.Vector3(Math.sin(angle) * 0.82, 5.25, Math.cos(angle) * 0.82),
      new THREE.Vector3(Math.sin(angle) * 0.30, 5.83, Math.cos(angle) * 0.30),
    ];
    cage.add(tube(points, 0.125, materials.gold, 44));
    cage.add(tube(points.map((point) => point.clone().multiply(new THREE.Vector3(0.985, 1, 0.985))), 0.042, materials.goldDark, 44));
    const prongTip = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.46, 6), materials.gold);
    prongTip.position.copy(points[points.length - 1]).add(new THREE.Vector3(0, 0.18, 0));
    cage.add(prongTip);
  }
  group.add(cage);

  const rings = new THREE.Group();
  rings.name = 'solar-energy-rings';
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(0.91, 0.025, 6, 72), materials.energy);
  ringA.rotation.x = Math.PI * 0.5;
  rings.add(ringA);
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(0.72, 0.022, 6, 72), materials.gold);
  ringB.rotation.set(Math.PI * 0.5, 0.42, 0.0);
  rings.add(ringB);
  rings.position.y = 3.86;
  rings.scale.setScalar(0.82);
  group.add(rings);

  return { group, shell, core, rings };
}

function createFoliage(materials: MaterialSet): THREE.Group {
  const group = new THREE.Group();
  group.name = 'foliage-pockets';
  const random = seededRandom(0x7f01);
  const blockedFront = 0.42;
  for (let cluster = 0; cluster < 8; cluster++) {
    let angle = (cluster / 8) * Math.PI * 2 + 0.16;
    if (Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) < blockedFront) angle += blockedFront * 1.5;
    const radius = 3.16 + (random() - 0.5) * 0.18;
    const base = new THREE.Vector3(Math.sin(angle) * radius, 0.43, Math.cos(angle) * radius);
    for (let leaf = 0; leaf < 3; leaf++) {
      const crown = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.12 + random() * 0.085, 0),
        leaf % 2 === 0 ? materials.foliage : materials.foliageLight,
      );
      crown.position.copy(base).add(new THREE.Vector3((random() - 0.5) * 0.26, 0.1 + leaf * 0.16, (random() - 0.5) * 0.26));
      crown.scale.y = 1.2 + random() * 0.5;
      group.add(crown);
    }
  }
  return group;
}

function disposeObject(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    geometries.add(object.geometry);
    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  for (const geometry of geometries) geometry.dispose();
  for (const texture of textures) texture.dispose();
  for (const material of materials) material.dispose();
}

export function createSunweaverTownCenter(
  options: SunweaverTownCenterOptions = {},
): SunweaverTownCenterModel {
  const root = new THREE.Group() as SunweaverTownCenterModel;
  root.name = 'sunweaver-town-center';
  const stageGroups = [1, 2, 3, 4].map((stage) => {
    const group = new THREE.Group();
    group.name = `construction-stage-${stage}`;
    root.add(group);
    return group;
  });
  const materials = makeMaterials(options.crystalColor ?? CYAN, options.teamColor ?? CYAN);
  const parts: THREE.Object3D[] = [];
  const explodeParts: THREE.Group[] = [];
  const pickables: THREE.Mesh[] = [];

  const registerPart = (stage: TownCenterStage, part: THREE.Group): void => {
    part.userData.stage = stage;
    stageGroups[stage - 1].add(part);
    parts.push(part);
    explodeParts.push(part);
    part.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (!object.geometry.boundingSphere) object.geometry.computeBoundingSphere();
      const radius = object.geometry.boundingSphere?.radius ?? 0;
      const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
      const shadowMaterial = meshMaterials.some((material) => (
        material === materials.stone
        || material === materials.stoneLight
        || material === materials.stoneShadow
        || material === materials.foundation
        || material === materials.blueRoof
      ));
      object.castShadow = shadowMaterial && radius > 1.25;
      object.receiveShadow = true;
      object.userData.partId = part.name;
      pickables.push(object);
    });
  };

  registerPart(1, createFoundation(materials));
  registerPart(1, createBodyDrums(materials));
  registerPart(1, createConstructionCore(materials, 1));
  registerPart(2, createConstructionCore(materials, 2));
  registerPart(3, createConstructionCore(materials, 3));

  const stair = createStair(materials);
  registerPart(1, stair);
  registerPart(2, createEntrance(materials));
  registerPart(2, createEntrance(materials, true));
  registerPart(2, createFacadeRhythm(materials));

  const buttressRing = new THREE.Group();
  buttressRing.name = 'buttress-ring';
  for (let index = 0; index < 8; index++) buttressRing.add(createButtress(materials, (index / 8) * Math.PI * 2, index));
  registerPart(2, buttressRing);

  const galleryRing = new THREE.Group();
  galleryRing.name = 'roof-wedges';
  for (let index = 0; index < 4; index++) galleryRing.add(createGallery(materials, (index / 4) * Math.PI * 2, index));
  registerPart(2, galleryRing);
  registerPart(2, createPauldronPlates(materials));
  registerPart(2, createWishboneRibs(materials));

  const turretRing = new THREE.Group();
  turretRing.name = 'secondary-turrets';
  for (let index = 0; index < 4; index++) {
    const turret = createTurret(materials, (index / 4) * Math.PI * 2, index);
    turret.scale.y = 1.22;
    turretRing.add(turret);
  }
  turretRing.rotation.y = -Math.PI * 0.125;
  registerPart(3, turretRing);
  registerPart(3, createConduits(materials));
  const frontHeart = createFrontHeartFacade(materials);
  frontHeart.scale.setScalar(0.9);
  registerPart(3, frontHeart);

  const banners: THREE.Mesh[] = [];
  const bannerRing = new THREE.Group();
  bannerRing.name = 'banner-system';
  for (let index = 0; index < 4; index++) {
    const banner = createBanner(materials, Math.PI * 0.25 + (index / 4) * Math.PI * 2, index);
    banner.scale.setScalar(0.92);
    banner.traverse((object) => {
      if (object instanceof THREE.Mesh && typeof object.userData.bannerIndex === 'number') banners.push(object);
    });
    bannerRing.add(banner);
  }
  registerPart(3, bannerRing);
  registerPart(3, createFoliage(materials));

  const crystalSpire = createCrystalSpire(materials);
  registerPart(4, crystalSpire.group);

  const crownJewels = new THREE.Group();
  crownJewels.name = 'crystal-core';
  for (let index = 0; index < 8; index++) {
    const angle = (index / 8) * Math.PI * 2;
    const jewel = new THREE.Mesh(crystalGeometry(0.105, 0.34, 6), index % 2 === 0 ? materials.energy : materials.crystal);
    jewel.position.set(Math.sin(angle) * 1.68, 3.02, Math.cos(angle) * 1.68);
    jewel.rotation.y = angle;
    crownJewels.add(jewel);
  }
  registerPart(4, crownJewels);

  for (const name of [
    'lower-drum', 'upper-cradle',
    'spoke-north', 'spoke-east', 'spoke-south', 'spoke-west',
    'crystal-cage', 'central-crystal', 'wishbone-rib-relief',
    'front-almond-jewel', 'banner-emblems', 'turret-finials',
    'gold-stair-caps', 'stone-seams',
  ]) {
    const semanticPart = root.getObjectByName(name);
    if (!semanticPart || parts.includes(semanticPart)) continue;
    parts.push(semanticPart);
    semanticPart.traverse((object) => {
      if (object instanceof THREE.Mesh) object.userData.partId = name;
    });
  }

  root.updateMatrixWorld(true);
  for (const part of explodeParts) {
    part.userData.homePosition = part.position.clone();
    const center = new THREE.Box3().setFromObject(part).getCenter(new THREE.Vector3());
    part.userData.explodeDelta = center.sub(MODEL_CENTER);
  }

  const animated: AnimatedState = {
    crystalShell: crystalSpire.shell,
    crystalCore: crystalSpire.core,
    energyMaterial: materials.energy,
    coreMaterial: materials.crystalCore,
    banners,
    solarRings: crystalSpire.rings,
  };
  let currentStage: TownCenterStage = options.stage ?? 4;
  let explodeAmount = 0;
  let teamColor = new THREE.Color(options.teamColor ?? CYAN);

  const runtime: SunweaverTownCenterRuntime = {
    parts,
    pickables,
    setStage(stage): void {
      currentStage = THREE.MathUtils.clamp(Math.round(stage), 1, 4) as TownCenterStage;
      stageGroups.forEach((group, index) => {
        group.visible = index < currentStage;
      });
      root.traverse((object) => {
        const minimumStage = object.userData.minimumStage;
        if (typeof minimumStage === 'number') object.visible = currentStage >= minimumStage;
        const exactStage = object.userData.exactStage;
        if (typeof exactStage === 'number') object.visible = currentStage === exactStage;
      });
    },
    setExplode(amount): void {
      explodeAmount = THREE.MathUtils.clamp(amount, 0, 1);
      for (const part of explodeParts) {
        const home = part.userData.homePosition as THREE.Vector3;
        const delta = part.userData.explodeDelta as THREE.Vector3;
        part.position.copy(home).addScaledVector(delta, explodeAmount * 0.36);
      }
    },
    setTeamColor(color): void {
      teamColor = new THREE.Color(color);
      animated.energyMaterial.color.copy(teamColor);
      animated.energyMaterial.emissive.copy(teamColor);
      animated.coreMaterial.color.copy(teamColor);
      animated.coreMaterial.emissive.copy(teamColor);
      const nextTexture = makeBannerTexture(teamColor);
      const previous = materials.banner.map;
      materials.banner.map = nextTexture;
      materials.banner.needsUpdate = true;
      previous?.dispose();
    },
    update(elapsedSeconds, deltaSeconds): void {
      const motion = options.reducedMotion ? 0 : 1;
      const pulse = 0.5 + 0.5 * Math.sin(elapsedSeconds * 2.15);
      animated.energyMaterial.emissiveIntensity = 1.85 + pulse * 1.05;
      animated.coreMaterial.emissiveIntensity = 2.45 + pulse * 1.25;
      animated.crystalCore.scale.setScalar(0.94 + pulse * 0.065 * motion);
      animated.crystalShell.rotation.y += deltaSeconds * 0.065 * motion;
      animated.solarRings.rotation.y += deltaSeconds * 0.18 * motion;
      animated.solarRings.rotation.z = Math.sin(elapsedSeconds * 0.22) * 0.08 * motion;
      for (let index = 0; index < animated.banners.length; index++) {
        animated.banners[index].rotation.z = Math.sin(elapsedSeconds * 1.25 + index * 1.7) * 0.025 * motion;
      }
      root.userData.stage = currentStage;
      root.userData.explodeAmount = explodeAmount;
      root.userData.teamColor = `#${teamColor.getHexString()}`;
    },
    dispose(): void {
      disposeObject(root);
    },
  };
  root.userData.sculptRuntime = runtime;
  runtime.setStage(currentStage);
  runtime.setExplode(0);
  return root;
}
