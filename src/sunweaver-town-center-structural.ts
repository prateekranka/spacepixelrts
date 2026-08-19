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
const CAGE_ARCH_BASE_Y = 3.48;
const CAGE_ARCH_ORBIT_RADIUS = 1.56;
const CAGE_ARCH_APEX_Y = 6.8;
const CAGE_ARCH_CANT_DEGREES = 30;
const CAGE_ARCH_CANT_RADIANS = THREE.MathUtils.degToRad(CAGE_ARCH_CANT_DEGREES);
const CAGE_ARCH_HEIGHT = (CAGE_ARCH_APEX_Y - CAGE_ARCH_BASE_Y) / Math.cos(CAGE_ARCH_CANT_RADIANS);
const CAGE_ARCH_YAWS_DEGREES = [0, -36, 180, 36] as const;

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

  /** Revolved faceted profile used for shallow architectural rings and crystal bodies. */
  function lathe(name: string, profile: readonly [number, number][], segments = 16): THREE.Mesh {
    const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y));
    return mesh(new THREE.LatheGeometry(points, segments), name);
  }

  /** Narrow front-facing ridge with a controlled proud depth over the crystal surface. */
  function frontSpine(name: string, profile: readonly [number, number][], width: number, proud: number): THREE.Mesh {
    const rowCount = profile.length;
    const vertices = new Float32Array(rowCount * 4 * 3);
    for (let row = 0; row < rowCount; row++) {
      const [radius, y] = profile[row];
      const halfWidth = width * 0.5;
      const backZ = radius + 0.008;
      const frontZ = radius + proud;
      const offset = row * 12;
      vertices[offset] = -halfWidth;
      vertices[offset + 1] = y;
      vertices[offset + 2] = backZ;
      vertices[offset + 3] = halfWidth;
      vertices[offset + 4] = y;
      vertices[offset + 5] = backZ;
      vertices[offset + 6] = -halfWidth;
      vertices[offset + 7] = y;
      vertices[offset + 8] = frontZ;
      vertices[offset + 9] = halfWidth;
      vertices[offset + 10] = y;
      vertices[offset + 11] = frontZ;
    }
    const indices: number[] = [];
    for (let row = 0; row < rowCount - 1; row++) {
      const a = row * 4;
      const b = (row + 1) * 4;
      // Front, back, left, and right faces. Keep the front face wound toward +Z.
      indices.push(b + 2, a + 2, a + 3, b + 2, a + 3, b + 3);
      indices.push(a, b, b + 1, a, b + 1, a + 1);
      indices.push(b, a, a + 2, b, a + 2, b + 2);
      indices.push(a + 3, b + 3, b + 1, a + 3, b + 1, a + 1);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, name);
  }

  /** Keep canted cage arches inside the collar orbit without changing their feet. */
  function clampRadialExtent(item: THREE.Mesh, center: THREE.Vector3, limit: number, orientation: THREE.Quaternion): void {
    const geometry = item.geometry.clone();
    uniqueGeometries.add(geometry);
    const position = geometry.getAttribute('position');
    const world = new THREE.Vector3();
    const inverse = orientation.clone().invert();
    for (let i = 0; i < position.count; i++) {
      world.set(position.getX(i), position.getY(i), position.getZ(i)).applyQuaternion(orientation);
      const worldX = center.x + world.x;
      const worldZ = center.z + world.z;
      const radial = Math.hypot(worldX, worldZ);
      if (radial > limit) {
        const scale = limit / radial;
        world.x = worldX * scale - center.x;
        world.z = worldZ * scale - center.z;
        world.applyQuaternion(inverse);
        position.setX(i, world.x);
        position.setY(i, world.y);
        position.setZ(i, world.z);
      }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    item.geometry = geometry;
  }

  /** Low radial trapezoid/plinth with a tapered plan and a shallow sloped top. */
  function radialWedge(name: string, tangentWidth: number, radialDepth: number, height: number): THREE.Mesh {
    const innerHalf = tangentWidth * 0.40;
    const outerHalf = tangentWidth * 0.5;
    const topInnerHalf = innerHalf * 0.92;
    const topOuterHalf = outerHalf * 0.92;
    const outerTop = height * 0.84;
    const positions = new Float32Array([
      -innerHalf, 0, 0,
      innerHalf, 0, 0,
      outerHalf, 0, radialDepth,
      -outerHalf, 0, radialDepth,
      -topInnerHalf, height, 0.04,
      topInnerHalf, height, 0.04,
      topOuterHalf, outerTop, radialDepth - 0.02,
      -topOuterHalf, outerTop, radialDepth - 0.02,
    ]);
    const indices = [
      0, 3, 2, 0, 2, 1,
      4, 5, 6, 4, 6, 7,
      0, 1, 5, 0, 5, 4,
      1, 2, 6, 1, 6, 5,
      2, 3, 7, 2, 7, 6,
      3, 0, 4, 3, 4, 7,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, name);
  }

  /** Shallow two-plane roof with one radial ridge, never a square pyramid. */
  function gabledRoof(name: string, halfWidth: number, radialDepth: number, eaveY: number, ridgeY: number): THREE.Mesh {
    const front = 0.04;
    const back = front + radialDepth;
    const positions = new Float32Array([
      -halfWidth, eaveY, front,
      0, ridgeY, front,
      halfWidth, eaveY, front,
      -halfWidth, eaveY, back,
      0, ridgeY, back,
      halfWidth, eaveY, back,
    ]);
    const indices = [
      0, 3, 4, 0, 4, 1,
      1, 4, 5, 1, 5, 2,
      0, 1, 2,
      3, 5, 4,
      0, 2, 5, 0, 5, 3,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, name);
  }

  function group(name: string): THREE.Group {
    const item = new THREE.Group();
    item.name = name;
    item.userData.partId = name;
    return item;
  }

  /** One low radial plinth. The source remains local and is cloned at 90° intervals. */
  function makeWingBaseSource(): THREE.Group {
    const source = group('primary_wing_base_source');
    source.add(radialWedge('wing_base_radial_plinth', 1.48, 1.5, 0.66));
    return source;
  }

  /**
   * Integrated gallery upper: thick shoulder masses, a hollow outward arch,
   * a recessed rear shell, and one shallow gabled roof.
   */
  function makeWingUpperSource(): THREE.Group {
    const source = group('primary_wing_upper_source');
    source.add(box('wing_upper_shoulder_l', [0.30, 1.32, 0.94], [-0.58, 1.18, 0.48]));
    source.add(box('wing_upper_shoulder_r', [0.30, 1.32, 0.94], [0.58, 1.18, 0.48]));

    const shell = group('wing_recessed_rear_shell');
    shell.add(box('wing_recessed_back', [0.84, 1.08, 0.46], [0, 1.08, -0.05]));
    shell.add(box('wing_recessed_floor', [0.86, 0.12, 0.72], [0, 0.56, 0.5]));
    source.add(shell);

    const frame = archFrame('wing_hollow_pointed_arch', 1.08, 1.32, 0.22, 0.15);
    frame.position.set(0, 0.62, 0.52);
    source.add(frame);

    source.add(gabledRoof('wing_shallow_gabled_roof', 0.64, 1.32, 1.90, 2.30));
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

  /** Thick pointed arch with a deep opening for the four-prong crown cage. */
  function makeCageArchSource(): THREE.Group {
    const source = group('crystal_cage_arch_source');
    const frame = archFrame('cage_arch', 0.98, CAGE_ARCH_HEIGHT, 0.26, 0.26);
    source.add(frame);
    return source;
  }

  /** Broad faceted almond/mandorla with a proud front spine (stage 4 only). */
  function makeCentralCrystal(): THREE.Group {
    const crystal = group('central_crystal');
    const mandorlaProfile: readonly [number, number][] = [
      [0, 3.5],
      [0.36, 3.58],
      [0.52, 3.86],
      [0.55, 4.08],
      [0.53, 4.36],
      [0.46, 4.8],
      [0.38, 5.25],
      [0.3, 5.72],
      [0.22, 6.15],
      [0.13, 6.58],
      [0, 7.08],
    ];
    const body = lathe('crystal_mandorla', mandorlaProfile, 8);
    crystal.add(body);

    const spineProfile: readonly [number, number][] = [
      [0.38, 3.58],
      [0.49, 3.76],
      [0.54, 4.05],
      [0.52, 4.4],
      [0.47, 4.8],
      [0.4, 5.2],
      [0.33, 5.62],
      [0.26, 6.02],
      [0.19, 6.36],
      [0.12, 6.65],
      [0.05, 6.9],
    ];
    const spine = frontSpine('crystal_front_center_spine', spineProfile, 0.12, 0.1);
    crystal.add(spine);
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

  const wingBaseSource = makeWingBaseSource();
  const wingUpperSource = makeWingUpperSource();
  const wingGroup = group('primary_wings');
  const wingBaseGroup = group('primary_wing_bases');
  const wingUpperGroup = group('primary_wing_uppers');
  const wingOriginRadius = 1.48;
  const wingBaseBottom = 0.42;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const baseClone = wingBaseSource.clone(true); baseClone.name = `primary_wing_base_${i}`;
    baseClone.position.copy(radialPosition(wingOriginRadius, angle, wingBaseBottom));
    baseClone.rotation.y = angle;
    wingBaseGroup.add(baseClone);

    const upperClone = wingUpperSource.clone(true); upperClone.name = `primary_wing_upper_${i}`;
    upperClone.position.copy(radialPosition(wingOriginRadius, angle, wingBaseBottom));
    upperClone.rotation.y = angle;
    wingUpperGroup.add(upperClone);

    parts[`primary_wing_base_${i}`] = baseClone;
    parts[`primary_wing_upper_${i}`] = upperClone;
  }
  wingGroup.add(wingBaseGroup);
  stage2.add(wingGroup); parts.primary_wing_source = wingGroup;
  parts.primary_wing_base_source = wingBaseGroup;
  stage3.add(wingUpperGroup); parts.primary_wing_upper_source = wingUpperGroup;

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

  const crownCollar = group('crown_collar');
  const collarBody = lathe('crown_collar_body', [
    [1.55, 3.02],
    [1.76, 3.02],
    [1.96, 3.09],
    [2.02, 3.18],
    [2.02, 3.34],
    [1.96, 3.44],
    [1.55, 3.44],
    [1.55, 3.02],
  ], 16);
  const upperLip = lathe('crown_collar_upper_lip', [
    [1.55, 3.4],
    [1.88, 3.4],
    [2.0, 3.43],
    [2.02, 3.47],
    [2.02, 3.52],
    [1.55, 3.52],
    [1.55, 3.4],
  ], 16);
  const lowerLip = lathe('crown_collar_lower_lip', [
    [1.55, 3.02],
    [1.78, 3.02],
    [1.88, 3.06],
    [1.88, 3.17],
    [1.78, 3.17],
    [1.55, 3.17],
    [1.55, 3.02],
  ], 16);
  crownCollar.add(collarBody, upperLip, lowerLip);
  stage3.add(crownCollar);
  parts.crown_collar = crownCollar;
  parts.crown_collar_body = collarBody;
  parts.crown_collar_upper_lip = upperLip;
  parts.crown_collar_lower_lip = lowerLip;

  const crown3 = tapered('stage_3_crown', 0.22, 0.4, 0.6, [0, 3.6, 0], 6, Math.PI / 6);
  stage3.add(crown3); parts.stage_3_crown = crown3;

  // ---- Stage 4: broad faceted crystal, front spine, finial, and canted cage arches ----
  const central = makeCentralCrystal();
  stage4.add(central); parts.central_crystal = central;
  const centralSpine = central.getObjectByName('crystal_front_center_spine');
  if (centralSpine) parts.crystal_front_center_spine = centralSpine;

  const cageSource = makeCageArchSource();
  const cageGroup = group('crystal_cage_arches');
  for (let i = 0; i < 4; i++) {
    const clone = cageSource.clone(true); clone.name = `crystal_cage_arch_${i}`;
    const angle = i * Math.PI / 2;
    clone.position.copy(radialPosition(CAGE_ARCH_ORBIT_RADIUS, angle, CAGE_ARCH_BASE_Y));
    clone.rotation.y = THREE.MathUtils.degToRad(CAGE_ARCH_YAWS_DEGREES[i]);
    const tangent = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    clone.rotateOnWorldAxis(tangent, -CAGE_ARCH_CANT_RADIANS);
    const frame = clone.getObjectByName('cage_arch');
    if (frame instanceof THREE.Mesh) clampRadialExtent(frame, clone.position, 1.9, clone.quaternion);
    cageGroup.add(clone);
  }
  stage4.add(cageGroup); parts.crystal_cage_arch_source = cageGroup;

  const crown4 = tapered('stage_4_crown', 0, 0.17, 0.32, [0, 7.04, 0], 8, Math.PI / 8);
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
    primary_wing_base_source: 'primary_wing_base_source',
    primary_wing_upper_source: 'primary_wing_upper_source',
    secondary_buttress_source: 'secondary_buttress_source',
    side_crystal_tower_source: 'side_crystal_tower_source',
    crown_collar: 'crown_collar',
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
      crownHeight: (7.2 - 3.02) / D,
      entranceProjection: 0.13,
      sideTowerRadius: 0.09,
      primaryWingOuterReach: (wingOriginRadius + 1.5) / D,
      primaryWingTangentialWidth: 1.48 / D,
      primaryWingRadialDepth: 1.5 / D,
      primaryWingBaseHeight: 0.66 / D,
      secondaryButtressOuterReach: 0.45,
      entranceWidth: 0.22,
      centralCrownRadius: 0.55 / D,
      crownCollarOuterRadius: 2.02 / D,
      crownCollarInnerRadius: 1.55 / D,
      crownCollarHeight: 0.5 / D,
      crownCollarUpperLipHeight: 0.12 / D,
      crownCollarLowerLipHeight: 0.15 / D,
      centralCrystalBaseHalfWidth: 0.55 / D,
      centralCrystalBaseY: 3.5 / D,
      centralCrystalApexY: 7.08 / D,
      centralCrystalFacetSegments: 8,
      centralCrystalSpineWidth: 0.12 / D,
      centralCrystalSpineProud: 0.1 / D,
      cageArchOuterWidth: 0.98 / D,
      cageArchHeight: CAGE_ARCH_HEIGHT / D,
      cageArchThickness: 0.26 / D,
      cageArchOrbitRadius: CAGE_ARCH_ORBIT_RADIUS / D,
      cageArchMaxRadius: 1.9 / D,
      cageArchBaseY: CAGE_ARCH_BASE_Y / D,
      cageArchApexY: CAGE_ARCH_APEX_Y / D,
      cageArchApexRadius: Math.abs(CAGE_ARCH_ORBIT_RADIUS - CAGE_ARCH_HEIGHT * Math.sin(CAGE_ARCH_CANT_RADIANS)) / D,
      cageArchSouthCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchEastCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchNorthCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchWestCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchSouthYawDegrees: CAGE_ARCH_YAWS_DEGREES[0],
      cageArchEastYawDegrees: CAGE_ARCH_YAWS_DEGREES[1],
      cageArchWestYawDegrees: CAGE_ARCH_YAWS_DEGREES[3],
      cageArchNorthYawDegrees: CAGE_ARCH_YAWS_DEGREES[2],
    },
    moduleCounts: {
      foundation_disc: 1,
      lower_drum: 1,
      upper_drum: 1,
      entrance_bay: 1,
      broad_front_stair: 5,
      primary_wing_source: 4,
      primary_wing_base_source: 4,
      primary_wing_upper_source: 4,
      secondary_buttress_source: 4,
      side_crystal_tower_source: 4,
      central_crystal: 1,
      crystal_mandorla: 1,
      crystal_front_center_spine: 1,
      crystal_cage_arch_source: 4,
      banner_mount_source: 4,
      crown_collar: 1,
      crown_collar_body: 1,
      crown_collar_upper_lip: 1,
      crown_collar_lower_lip: 1,
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
      primary_wings: [0, 0.75, 0],
      primary_wing_bases: [0, 0.75, 0],
      primary_wing_uppers: [0, 1.83, 0],
      primary_wing_base_0: [0, 0.75, 2.23],
      primary_wing_base_1: [2.23, 0.75, 0],
      primary_wing_base_2: [0, 0.75, -2.23],
      primary_wing_base_3: [-2.23, 0.75, 0],
      primary_wing_upper_0: [0, 1.82, 2.02],
      primary_wing_upper_1: [2.02, 1.82, 0],
      primary_wing_upper_2: [0, 1.82, -2.02],
      primary_wing_upper_3: [-2.02, 1.82, 0],
      side_crystal_towers: [0, 1.6, 0],
      secondary_buttresses: [0, 1.2, 0],
      crown_collar: [0, 3.27, 0],
      crown_collar_body: [0, 3.23, 0],
      crown_collar_upper_lip: [0, 3.46, 0],
      crown_collar_lower_lip: [0, 3.11, 0],
      central_crystal: [0, 5.29, 0],
      crystal_mandorla: [0, 5.29, 0],
      crystal_front_center_spine: [0, 5.24, 0.349],
      crystal_cage_arches: [0, 5.13, 0],
      banner_mounts: [0, 3.0, 0],
      stage_2_crown: [0, 2.01, 0],
      stage_3_crown: [0, 3.6, 0],
      stage_4_crown: [0, 7.04, 0],
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
