import * as THREE from 'three';

export type StructuralStage = 1 | 2 | 3 | 4;

export interface StructuralManifest {
  assetId: string;
  canonicalCivilization: string;
  footprintDiameter: number;
  entranceAxis: 'south';
  normalizedDimensions: Record<string, number>;
  moduleCounts: Record<string, number>;
  sourceIds: Record<string, string>;
  worldSpaceModuleCenters: Record<string, [number, number, number]>;
}

export interface StructuralRuntime {
  readonly root: THREE.Group;
  readonly parts: Record<string, THREE.Object3D>;
  readonly pickables: readonly THREE.Mesh[];
  setStage(stage: StructuralStage): void;
  getStage(): StructuralStage;
  setExplode(amount: number): void;
  update(_elapsed: number, _delta: number): void;
  dispose(): void;
}

export interface StructuralTownCenter extends THREE.Group {
  userData: THREE.Group['userData'] & {
    sculptRuntime: StructuralRuntime;
    structuralManifest: StructuralManifest;
  };
}

const D = 7;
const R = D / 2;

function radialPosition(radius: number, angle: number, y: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(angle) * radius, y, Math.cos(angle) * radius);
}

/** Pointed arch outline: straight spring walls, quadratic pointed apex. */
function archShape(width: number, height: number): THREE.Shape {
  const half = width / 2;
  const spring = height * 0.48;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(half, spring);
  shape.quadraticCurveTo(half * 0.78, height * 0.78, 0, height);
  shape.quadraticCurveTo(-half * 0.78, height * 0.78, -half, spring);
  shape.closePath();
  return shape;
}

export function createSunweaverTownCenterStructural(): StructuralTownCenter {
  const clay = new THREE.MeshStandardMaterial({ color: '#B8B4AC', roughness: 0.86, metalness: 0, flatShading: true });
  const parts: Record<string, THREE.Object3D> = {};
  const pickables: THREE.Mesh[] = [];
  const uniqueGeometries = new Set<THREE.BufferGeometry>();
  const uniqueMaterials = new Set<THREE.Material>();

  function trackGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
    uniqueGeometries.add(geometry);
    return geometry;
  }

  function mesh(geometry: THREE.BufferGeometry, name: string): THREE.Mesh {
    const item = new THREE.Mesh(trackGeometry(geometry), clay);
    item.name = name;
    item.castShadow = true;
    item.receiveShadow = true;
    item.userData.partId = name;
    pickables.push(item);
    return item;
  }

  function box(name: string, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
    const item = mesh(new THREE.BoxGeometry(...size), name);
    item.position.set(...position);
    return item;
  }

  function cylinder(name: string, radius: number, height: number, position: [number, number, number], segments = 48): THREE.Mesh {
    const item = mesh(new THREE.CylinderGeometry(radius, radius, height, segments), name);
    item.position.set(...position);
    return item;
  }

  function tapered(name: string, radiusTop: number, radiusBottom: number, height: number, position: [number, number, number], segments = 8, rotY = 0): THREE.Mesh {
    const item = mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), name);
    item.position.set(...position);
    if (rotY !== 0) item.rotation.y = rotY;
    return item;
  }

  function beam(name: string, start: THREE.Vector3, end: THREE.Vector3, width: number): THREE.Mesh {
    const delta = end.clone().sub(start);
    const item = box(name, [width, width, delta.length()], [0, 0, 0]);
    item.position.copy(start).add(end).multiplyScalar(0.5);
    item.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize());
    return item;
  }

  function archFrame(name: string, width: number, height: number, depth: number, thickness: number): THREE.Mesh {
    const outer = archShape(width, height);
    const inner = archShape(width - thickness * 2, height - thickness * 1.35);
    outer.holes.push(new THREE.Path(inner.getPoints(20).reverse()));
    const geometry = new THREE.ExtrudeGeometry(outer, { depth, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.045, bevelSegments: 2, curveSegments: 10 });
    geometry.translate(0, 0, -depth / 2);
    return mesh(geometry, name);
  }

  function group(name: string): THREE.Group {
    const item = new THREE.Group();
    item.name = name;
    item.userData.partId = name;
    return item;
  }

  /**
   * Wing shell: stepped plinth, two thick side masses, a real pointed facade
   * opening/frame, and a pagoda roof. The opening stays hollow so the south
   * copy leaves the deep entrance bay visible.
   */
  function makeWingSource(): THREE.Group {
    const source = group('primary_wing_source');
    source.add(box('wing_plinth', [1.4, 0.5, 0.6], [0, 0.35, 0]));
    source.add(box('wing_side_mass_l', [0.34, 1.5, 0.55], [-0.7, 1.6, 0.1]));
    source.add(box('wing_side_mass_r', [0.34, 1.5, 0.55], [0.7, 1.6, 0.1]));
    const frame = archFrame('wing_pointed_frame', 1.3, 1.1, 0.3, 0.15);
    frame.position.set(0, 1.5, 0.15);
    source.add(frame);
    source.add(tapered('wing_roof_low', 0.7, 1.32, 0.3, [0, 2.5, 0], 4, Math.PI / 4));
    source.add(tapered('wing_roof_high', 0.18, 0.7, 0.4, [0, 2.85, 0], 4, Math.PI / 4));
    source.add(tapered('wing_finial', 0.04, 0.2, 0.25, [0, 3.18, 0], 4, Math.PI / 4));
    return source;
  }

  /** Integrated diagonal side tower: base, tapered shaft, pointed cap, brace fin into the upper drum. */
  function makeTowerSource(): THREE.Group {
    const source = group('side_crystal_tower_source');
    source.add(tapered('tower_base', 0.4, 0.55, 0.5, [0, 0.25, 0], 8));
    source.add(tapered('tower_shaft', 0.32, 0.42, 1.7, [0, 1.45, 0], 8));
    source.add(tapered('tower_cap', 0.06, 0.36, 0.85, [0, 2.72, 0], 8));
    source.add(box('tower_brace', [0.28, 0.85, 0.8], [0, 1.1, -0.55]));
    return source;
  }

  /** Small interleaved buttress on the 8-fold rhythm. */
  function makeButtressSource(): THREE.Group {
    const source = group('secondary_buttress_source');
    source.add(tapered('buttress_base', 0.3, 0.4, 0.4, [0, 0.2, 0], 6));
    source.add(tapered('buttress_shaft', 0.18, 0.3, 1.3, [0, 1.05, 0], 6));
    source.add(tapered('buttress_cap', 0.04, 0.22, 0.5, [0, 1.95, 0], 6));
    return source;
  }

  /** Substantial cage arch that frames the central faceted volume. */
  function makeCageArchSource(): THREE.Group {
    const source = group('crystal_cage_arch_source');
    const frame = archFrame('cage_arch', 1.5, 2.6, 0.26, 0.2);
    source.add(frame);
    return source;
  }

  /** Faceted double-pointed almond central volume (stage 4, the only full-height spire). */
  function makeCentralCrystal(): THREE.Group {
    const crystal = group('central_crystal');
    crystal.add(tapered('crystal_almond_lower', 0.16, 0.42, 1.05, [0, 3.85, 0], 6, Math.PI / 6));
    crystal.add(tapered('crystal_almond_upper', 0.05, 0.16, 1.0, [0, 4.89, 0], 6, Math.PI / 6));
    crystal.add(tapered('crystal_spire', 0.03, 0.08, 1.5, [0, 6.14, 0], 6, Math.PI / 6));
    return crystal;
  }

  const root = group('SunweaverTownCenter_Structural_v01') as StructuralTownCenter;
  const stage1 = group('stage-1');
  const stage2 = group('stage-2');
  const stage3 = group('stage-3');
  const stage4 = group('stage-4');
  root.add(stage1, stage2, stage3, stage4);

  // ---- Stage 1: foundation, front-axis marker, center socket ----
  const foundation = cylinder('foundation_disc', R, 0.28, [0, 0.14, 0], 64);
  stage1.add(foundation); parts.foundation_disc = foundation;
  const axis = box('entrance_axis_marker', [0.12, 0.035, 3.65], [0, 0.33, 0.2]);
  axis.userData.qaOnly = true; stage1.add(axis); parts.entrance_axis_marker = axis;
  const socket = tapered('central_socket', 1.0, 1.18, 0.28, [0, 0.38, 0], 12);
  stage1.add(socket); parts.central_socket = socket;

  // ---- Stage 2: reduced lower drum, entrance bay, broad front stair, wing lobes ----
  const lower = cylinder('lower_drum', 1.55, 1.4, [0, 1.08, 0], 48);
  stage2.add(lower); parts.lower_drum = lower;

  const entrance = group('entrance_bay');
  entrance.add(box('entrance_back_wall', [2.3, 3.0, 0.18], [0, 1.5, 1.62]));
  entrance.add(box('entrance_pylon_l', [0.5, 2.7, 1.05], [-1.2, 1.35, 2.15]));
  entrance.add(box('entrance_pylon_r', [0.5, 2.7, 1.05], [1.2, 1.35, 2.15]));
  const entranceArch = archFrame('entrance_pointed_arch', 1.6, 2.5, 0.4, 0.22);
  entranceArch.position.set(0, 0.5, 2.0);
  entrance.add(entranceArch);
  stage2.add(entrance); parts.entrance_bay = entrance;

  const stair = group('broad_front_stair');
  const treadGeometry = trackGeometry(new THREE.BoxGeometry(2.8, 0.14, 0.17));
  for (let i = 0; i < 5; i++) {
    const tread = mesh(treadGeometry, `stair_tread_${i + 1}`);
    tread.position.set(0, 0.07 + i * 0.14, 3.68 - i * 0.17);
    stair.add(tread);
  }
  stage2.add(stair); parts.broad_front_stair = stair;

  const wingSource = makeWingSource();
  const wingGroup = group('primary_wings');
  for (let i = 0; i < 4; i++) {
    const clone = wingSource.clone(true); clone.name = `primary_wing_${i}`;
    clone.position.copy(radialPosition(2.55, i * Math.PI / 2, 0));
    clone.rotation.y = i * Math.PI / 2;
    wingGroup.add(clone);
  }
  stage2.add(wingGroup); parts.primary_wing_source = wingGroup;

  const crown2 = tapered('stage_2_crown', 0.56, 0.9, 0.42, [0, 2.01, 0], 8);
  stage2.add(crown2); parts.stage_2_crown = crown2;

  // ---- Stage 3: upper drum, diagonal towers, interleaved buttresses, cage base ----
  const upper = cylinder('upper_drum', 1.3, 1.2, [0, 2.38, 0], 48);
  stage3.add(upper); parts.upper_drum = upper;

  const towerSource = makeTowerSource();
  const towerGroup = group('side_crystal_towers');
  for (let i = 0; i < 4; i++) {
    const clone = towerSource.clone(true); clone.name = `side_crystal_tower_${i}`;
    clone.position.copy(radialPosition(2.45, Math.PI / 4 + i * Math.PI / 2, 0));
    clone.rotation.y = Math.PI / 4 + i * Math.PI / 2;
    towerGroup.add(clone);
  }
  stage3.add(towerGroup); parts.side_crystal_tower_source = towerGroup;

  const buttressSource = makeButtressSource();
  const buttressGroup = group('secondary_buttresses');
  for (let i = 0; i < 4; i++) {
    const clone = buttressSource.clone(true); clone.name = `secondary_buttress_${i}`;
    clone.position.copy(radialPosition(2.85, Math.PI / 8 + i * Math.PI / 2, 0));
    clone.rotation.y = Math.PI / 8 + i * Math.PI / 2;
    buttressGroup.add(clone);
  }
  stage3.add(buttressGroup); parts.secondary_buttress_source = buttressGroup;

  const cageBase = cylinder('cage_base', 1.25, 0.32, [0, 3.15, 0], 8);
  stage3.add(cageBase); parts.cage_base = cageBase;

  const crown3 = tapered('stage_3_crown', 0.22, 0.4, 0.6, [0, 3.6, 0], 6, Math.PI / 6);
  stage3.add(crown3); parts.stage_3_crown = crown3;

  // ---- Stage 4: aligned cage arches, faceted central volume, final crown ----
  const central = makeCentralCrystal();
  stage4.add(central); parts.central_crystal = central;

  const cageSource = makeCageArchSource();
  const cageGroup = group('crystal_cage_arches');
  for (let i = 0; i < 4; i++) {
    const clone = cageSource.clone(true); clone.name = `crystal_cage_arch_${i}`;
    clone.position.copy(radialPosition(1.25, i * Math.PI / 2, 3.15));
    clone.rotation.y = i * Math.PI / 2;
    cageGroup.add(clone);
  }
  stage4.add(cageGroup); parts.crystal_cage_arch_source = cageGroup;

  const crown4 = tapered('stage_4_crown', 0.02, 0.06, 0.35, [0, 3.34, 0], 6, Math.PI / 6);
  stage4.add(crown4); parts.stage_4_crown = crown4;

  const bannerSource = group('banner_mount_source');
  bannerSource.add(beam('banner_mount', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.55, 0), 0.12));
  const bannerGroup = group('banner_mounts');
  for (let i = 0; i < 4; i++) {
    const clone = bannerSource.clone(true); clone.name = `banner_mount_${i}`;
    clone.position.copy(radialPosition(3.05, Math.PI / 4 + i * Math.PI / 2, 2.9));
    bannerGroup.add(clone);
  }
  stage4.add(bannerGroup); parts.banner_mount_source = bannerGroup;

  const sourceIds: Record<string, string> = {
    primary_wing_source: 'primary_wing_source',
    secondary_buttress_source: 'secondary_buttress_source',
    side_crystal_tower_source: 'side_crystal_tower_source',
    crystal_cage_arch_source: 'crystal_cage_arch_source',
    banner_mount_source: 'banner_mount_source',
  };
  const manifest: StructuralManifest = {
    assetId: 'SunweaverTownCenter_Structural_v01',
    canonicalCivilization: 'Sunweaver',
    footprintDiameter: D,
    entranceAxis: 'south',
    normalizedDimensions: {
      footprintDiameter: 1,
      lowerDrumHeight: 0.2,
      upperDrumHeight: 0.171,
      crownHeight: 0.34,
      entranceProjection: 0.13,
      sideTowerRadius: 0.09,
      primaryWingOuterReach: 0.497,
      secondaryButtressOuterReach: 0.45,
      entranceWidth: 0.22,
      centralCrownRadius: 0.16,
    },
    moduleCounts: {
      foundation_disc: 1,
      lower_drum: 1,
      upper_drum: 1,
      entrance_bay: 1,
      broad_front_stair: 5,
      primary_wing_source: 4,
      secondary_buttress_source: 4,
      side_crystal_tower_source: 4,
      central_crystal: 1,
      crystal_cage_arch_source: 4,
      banner_mount_source: 4,
      stage_2_crown: 1,
      stage_3_crown: 1,
      stage_4_crown: 1,
    },
    sourceIds,
    worldSpaceModuleCenters: {
      foundation_disc: [0, 0.14, 0],
      lower_drum: [0, 1.08, 0],
      upper_drum: [0, 2.38, 0],
      entrance_bay: [0, 1.35, 2.1],
      broad_front_stair: [0, 0.35, 3.2],
      primary_wings: [0, 1.3, 0],
      side_crystal_towers: [0, 1.6, 0],
      secondary_buttresses: [0, 1.2, 0],
      cage_base: [0, 3.15, 0],
      central_crystal: [0, 5.1, 0],
      crystal_cage_arches: [0, 4.45, 0],
      banner_mounts: [0, 3.0, 0],
      stage_2_crown: [0, 2.01, 0],
      stage_3_crown: [0, 3.6, 0],
      stage_4_crown: [0, 3.34, 0],
    },
  };

  let currentStage: StructuralStage = 4;
  let explode = 0;
  function setStage(stage: StructuralStage): void {
    currentStage = THREE.MathUtils.clamp(stage, 1, 4) as StructuralStage;
    stage1.visible = true;
    stage2.visible = currentStage >= 2;
    stage3.visible = currentStage >= 3;
    stage4.visible = currentStage >= 4;
    root.userData.stage = currentStage;
  }
  function setExplode(amount: number): void {
    explode = THREE.MathUtils.clamp(amount, 0, 1);
    const offsets: [THREE.Object3D, number][] = [[stage2, 0.15], [stage3, 0.3], [stage4, 0.5]];
    for (const [item, distance] of offsets) item.position.y = explode * distance;
  }
  function dispose(): void {
    for (const geometry of uniqueGeometries) geometry.dispose();
    uniqueGeometries.clear();
    for (const material of uniqueMaterials) material.dispose();
    uniqueMaterials.clear();
    clay.dispose();
  }
  uniqueMaterials.add(clay);

  const runtime: StructuralRuntime = {
    root,
    parts,
    pickables,
    setStage,
    getStage: () => currentStage,
    setExplode,
    update: () => {},
    dispose,
  };
  root.userData.sculptRuntime = runtime;
  root.userData.structuralManifest = manifest;
  root.userData.sourceIds = sourceIds;
  root.userData.explode = explode;
  setStage(4);
  return root;
}

export const STRUCTURAL_FOOTPRINT_DIAMETER = D;
