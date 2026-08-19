import * as THREE from 'three';

export type StructuralStage = 1 | 2 | 3 | 4;

export interface StructuralManifest {
  assetId: string;
  canonicalCivilization: string;
  footprintDiameter: number;
  entranceAxis: 'south';
  cageArchProfile: 'solid-rib';
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
const PLINTH_TIER_1_BOTTOM_Y = 0.4;
const PLINTH_TIER_1_TOP_Y = 1.8;
const PLINTH_TIER_1_BOTTOM_RADIUS = 3.5;
const PLINTH_TIER_1_TOP_RADIUS = 3.3;
const PLINTH_TIER_2_BOTTOM_Y = 1.8;
const PLINTH_TIER_2_TOP_Y = 3.3;
const PLINTH_TIER_2_BOTTOM_RADIUS = 3.35;
const PLINTH_TIER_2_TOP_RADIUS = 2.9;
const LOWER_DRUM_RADIUS = 1.95;
const LOWER_DRUM_HEIGHT = 2.7;
const LOWER_DRUM_CENTER_Y = 4.65;
const UPPER_DRUM_RADIUS = 1.62;
const UPPER_DRUM_HEIGHT = 1.6;
const UPPER_DRUM_CENTER_Y = 6.8;
const SIDE_TOWER_MOUNT_Y = 5.65;
const SIDE_TOWER_VERTICAL_SCALE = 0.81;
const SIDE_TOWER_SOURCE_TOP_Y = 2.72 + 0.85 / 2;
const SECONDARY_BUTTRESS_VERTICAL_SCALE = 0.62;
const PRIMARY_WING_BASE_ORBIT_RADIUS = 2.23;
const PRIMARY_WING_UPPER_ORBIT_RADIUS = 2.02;
const PRIMARY_WING_OUTER_REACH = 3.48;
const PRIMARY_WING_BASE_RADIAL_DEPTH = 1.17;
const PRIMARY_WING_BASE_SOURCE_RADIAL_DEPTH = 1.5;
const PRIMARY_WING_BASE_RADIAL_SCALE = PRIMARY_WING_BASE_RADIAL_DEPTH / PRIMARY_WING_BASE_SOURCE_RADIAL_DEPTH;
const PRIMARY_WING_BASE_CENTER_Y = 3.9;
const PRIMARY_WING_UPPER_CENTER_Y = 5.2;
const STAIR_TOP_Y = 3.3;
const STAIR_TREAD_COUNT = 20;
const STAIR_TREAD_WIDTH = 2.8;
const STAIR_TREAD_HEIGHT = STAIR_TOP_Y / STAIR_TREAD_COUNT;
const STAIR_TREAD_DEPTH = 0.17;
const STAIR_FRONT_Z = 3.1;
const STAIR_LAST_Z = 2.0;
const ENERGY_VAULT_OUTER_WIDTH = 3.0;
const ENERGY_VAULT_OUTER_HEIGHT = 3.0;
const ENERGY_VAULT_OUTER_BOTTOM_Y = 4.4;
const ENERGY_VAULT_FRAME_DEPTH = 0.4;
const ENERGY_VAULT_FRAME_THICKNESS = 0.4;
const ENERGY_VAULT_OPENING_WIDTH = 1.8;
const ENERGY_VAULT_OPENING_HEIGHT = 2.6;
const ENERGY_VAULT_CENTER_Z = 2.25;
const ENERGY_VAULT_JEWEL_CENTER_Z = 2.46;
const ENERGY_VAULT_JEWEL_BASE_Y = 4.45;
const ENERGY_VAULT_JEWEL_HEIGHT = 2.55;
const ENERGY_VAULT_JEWEL_WIDTH = 1.8;
const ENERGY_VAULT_JEWEL_FRONT_BULGE = 0.22;
const ENERGY_VAULT_JEWEL_REAR_DEPTH = 0.24;
const ENERGY_VAULT_SEAM_BASE_Y = 6.7;
const ENERGY_VAULT_SEAM_HEIGHT = 0.34;
const ENERGY_VAULT_SEAM_WIDTH = 0.26;
const ENERGY_VAULT_ENTRANCE_WIDTH = 1.0;
const ENERGY_VAULT_ENTRANCE_HEIGHT = 0.65;
const ENERGY_VAULT_ENTRANCE_BOTTOM_Y = 4.58;
const ENERGY_VAULT_ENTRANCE_FRAME_DEPTH = 0.28;
const ENERGY_VAULT_ENTRANCE_RECESS_DEPTH = 0.14;
const ENERGY_VAULT_ENTRANCE_RECESS_CENTER_Z = 2.6;
const CROWN_COLLAR_SPRINGLINE_Y = 7.6;
const CROWN_COLLAR_Y_OFFSET = 4.4;
const CROWN_SOURCE_BASE_Y = 3.5;
const CROWN_SCALE = 1.35;
// The approved crown is widened by 1.35 while its vertical span is fitted to
// the requested ~11.7 apex and the hard 12.2 upper bound.
const CROWN_VERTICAL_SCALE = 1.15;
const CROWN_MOUNT_Y = CROWN_COLLAR_SPRINGLINE_Y;
const CROWN_TARGET_APEX_Y = CROWN_MOUNT_Y + (7.08 - CROWN_SOURCE_BASE_Y) * CROWN_VERTICAL_SCALE;
// Source-space widths become 0.972 base / 1.1475 peak after the accepted 1.35 radial scale.
const CENTRAL_CRYSTAL_BASE_HALF_WIDTH = 0.72;
const CENTRAL_CRYSTAL_MAX_HALF_WIDTH = 0.85;
const CENTRAL_CRYSTAL_FACET_SEGMENTS = 8;
// Source-space dimensions become ~0.46 wide and ~0.21 proud after the accepted
// 1.35 radial crown scale. The broad rib must remain visible through the flat clay.
const CENTRAL_CRYSTAL_SPINE_WIDTH = 0.34;
const CENTRAL_CRYSTAL_SPINE_PROUD = 0.155;
const CENTRAL_CRYSTAL_FRONT_BULGE = 0.14;
const CAGE_ARCH_BASE_Y = 3.48;
// The inward orbit keeps the ribs over the broad vault; the separate body radius
// remains equal to the crystal peak and the feet still reach the collar rim.
const CAGE_ARCH_ORBIT_RADIUS = 0.95;
const CAGE_ARCH_ORBIT_RADII = [0.92, 0.98, 0.98, 0.92] as const;
const CAGE_ARCH_APEX_Y = 6.8;
const CAGE_ARCH_WIDTH = 0.98;
const CAGE_ARCH_DEPTH = 0.26;
const CAGE_ARCH_ROTATION_DEGREES = 45;
const CAGE_ARCH_ROTATION_RADIANS = THREE.MathUtils.degToRad(CAGE_ARCH_ROTATION_DEGREES);
const CAGE_ARCH_FOOT_FLARE_WIDTH = 0.72;
// Extend the accepted foot wedge after the inward orbit so its outer edge still
// lands on the ~2.05 collar radius.
const CAGE_ARCH_FOOT_FLARE_DEPTH = 0.70;
const CAGE_ARCH_FOOT_FLARE_HEIGHT = 0.18;
const CAGE_ARCH_CANT_DEGREES = 42;
const CAGE_ARCH_CANT_RADIANS = THREE.MathUtils.degToRad(CAGE_ARCH_CANT_DEGREES);
const CAGE_ARCH_HEIGHT = (CAGE_ARCH_APEX_Y - CAGE_ARCH_BASE_Y) / Math.cos(CAGE_ARCH_CANT_RADIANS);
// Local +Z points toward the center on each diagonal axis before the inward cant.
const CAGE_ARCH_YAWS_DEGREES = [225, 315, 45, 135] as const;
const CAGE_ARCH_BEND_START = 0.6;
const CAGE_ARCH_BODY_RADIUS = 0.85;
const CAGE_ARCH_APEX_RADIUS = 0.16;
// Offsets pull each diagonal tip toward the front boss, so the two front talons overlap.
const CAGE_ARCH_APEX_TANGENTIAL_OFFSETS = [-0.18, 0.12, -0.12, 0.18] as const;
// The front pair cross through the crystal body, then return behind the tip convergence.
const CAGE_ARCH_BODY_TANGENTIAL_OFFSETS = [-0.75, 0, 0, 0.75] as const;
// Different front depths make the crossing read as an over/under interlock.
const CAGE_ARCH_FRONT_DEPTH_OFFSETS = [0.6, 0, 0, 0.3] as const;
// Stagger the front crossings vertically: the right talon passes first, then the left.
const CAGE_ARCH_BODY_CROSS_STARTS = [0.28, 0, 0, 0.48] as const;
const CAGE_ARCH_BODY_CROSS_PEAKS = [0.45, 0, 0, 0.68] as const;
const CAGE_ARCH_BODY_CROSS_ENDS = [0.64, 0, 0, 0.88] as const;

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

function solidTalonShape(width: number, height: number): THREE.Shape {
  const half = width / 2;
  const spring = height * 0.48;
  const shoulderHalf = width * 0.26;
  const shape = new THREE.Shape();
  shape.moveTo(-half, 0);
  shape.lineTo(half, 0);
  shape.lineTo(shoulderHalf, spring);
  shape.quadraticCurveTo(shoulderHalf * 0.78, height * 0.78, 0, height);
  shape.quadraticCurveTo(-shoulderHalf * 0.78, height * 0.78, -shoulderHalf, spring);
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

  function solidArchPanel(name: string, width: number, height: number, depth: number): THREE.Mesh {
    const profile = solidTalonShape(width, height);
    const geometry = new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: true, bevelSize: 0.055, bevelThickness: 0.045, bevelSegments: 2, curveSegments: 10 });
    geometry.translate(0, 0, -depth / 2);
    return mesh(geometry, name);
  }

  /** Revolved faceted profile used for shallow architectural rings and crystal bodies. */
  function lathe(name: string, profile: readonly [number, number][], segments = 16): THREE.Mesh {
    const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y));
    return mesh(new THREE.LatheGeometry(points, segments), name);
  }

  /**
   * Closed almond prism with a shallow, strictly convex front envelope.
   * The front is divided into eight planar strips so the center stays broad and lit;
   * the rear plane and side/cap faces keep the shell watertight from every view.
   */
  function convexMandorla(name: string, profile: readonly [number, number][], segments: number, frontBulge: number, rearDepth: number): THREE.Mesh {
    const rowCount = profile.length;
    const columns = segments + 1;
    const maxHalfWidth = Math.max(...profile.map(([radius]) => radius));
    const frontIndex = (row: number, column: number) => (row * columns + column) * 2;
    const rearIndex = (row: number, column: number) => (row * columns + column) * 2 + 1;
    const vertices = new Float32Array(rowCount * columns * 2 * 3);
    for (let row = 0; row < rowCount; row++) {
      const [halfWidth, y] = profile[row];
      const widthRatio = maxHalfWidth > 0 ? halfWidth / maxHalfWidth : 0;
      const rowBulge = frontBulge * (0.16 + 0.84 * widthRatio);
      const rearZ = -rearDepth * (0.78 + 0.22 * widthRatio);
      for (let column = 0; column < columns; column++) {
        const u = column / segments * 2 - 1;
        const x = halfWidth * u;
        // A parabola gives positive curvature toward +Z at every non-degenerate row.
        const frontZ = rowBulge * (1 - u * u);
        const frontOffset = frontIndex(row, column) * 3;
        vertices[frontOffset] = x;
        vertices[frontOffset + 1] = y;
        vertices[frontOffset + 2] = frontZ;
        const rearOffset = rearIndex(row, column) * 3;
        vertices[rearOffset] = x;
        vertices[rearOffset + 1] = y;
        vertices[rearOffset + 2] = rearZ;
      }
    }
    const indices: number[] = [];
    for (let row = 0; row < rowCount - 1; row++) {
      for (let column = 0; column < segments; column++) {
        const a = frontIndex(row, column);
        const b = frontIndex(row, column + 1);
        const c = frontIndex(row + 1, column);
        const d = frontIndex(row + 1, column + 1);
        // Front winding points toward +Z, the viewer-facing side.
        indices.push(a, b, c, b, d, c);
        const ar = rearIndex(row, column);
        const br = rearIndex(row, column + 1);
        const cr = rearIndex(row + 1, column);
        const dr = rearIndex(row + 1, column + 1);
        indices.push(ar, cr, br, br, cr, dr);
      }
      const leftFront = frontIndex(row, 0);
      const leftFrontNext = frontIndex(row + 1, 0);
      const leftRear = rearIndex(row, 0);
      const leftRearNext = rearIndex(row + 1, 0);
      indices.push(leftFront, leftFrontNext, leftRear, leftFrontNext, leftRearNext, leftRear);
      const rightFront = frontIndex(row, segments);
      const rightFrontNext = frontIndex(row + 1, segments);
      const rightRear = rearIndex(row, segments);
      const rightRearNext = rearIndex(row + 1, segments);
      indices.push(rightFront, rightRear, rightFrontNext, rightRear, rightRearNext, rightFrontNext);
    }
    for (let column = 0; column < segments; column++) {
      const bottomFront = frontIndex(0, column);
      const bottomFrontNext = frontIndex(0, column + 1);
      const bottomRear = rearIndex(0, column);
      const bottomRearNext = rearIndex(0, column + 1);
      indices.push(bottomFront, bottomRear, bottomFrontNext, bottomRear, bottomRearNext, bottomFrontNext);
      const topFront = frontIndex(rowCount - 1, column);
      const topFrontNext = frontIndex(rowCount - 1, column + 1);
      const topRear = rearIndex(rowCount - 1, column);
      const topRearNext = rearIndex(rowCount - 1, column + 1);
      indices.push(topFront, topFrontNext, topRear, topFrontNext, topRearNext, topRear);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return mesh(geometry, name);
  }

  /** Narrow front-facing ridge with a controlled proud depth over the crystal surface. */
  function frontSpine(name: string, profile: readonly [number, number][], width: number, proud: number, widthProfile?: readonly number[]): THREE.Mesh {
    const rowCount = profile.length;
    const vertices = new Float32Array(rowCount * 4 * 3);
    for (let row = 0; row < rowCount; row++) {
      const [radius, y] = profile[row];
      const halfWidth = (widthProfile?.[row] ?? width) * 0.5;
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
    // Close both ends of the rib so its raised plane is a solid, finite volume.
    indices.push(0, 1, 2, 1, 3, 2);
    const top = (rowCount - 1) * 4;
    indices.push(top, top + 2, top + 1, top + 1, top + 2, top + 3);
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

  /** Clamp a deformed crown mesh after its parent scale has been applied. */
  function clampWorldRadialExtent(item: THREE.Mesh, limit: number, apexLimit?: number): void {
    item.updateWorldMatrix(true, false);
    const geometry = item.geometry.clone();
    uniqueGeometries.add(geometry);
    const position = geometry.getAttribute('position');
    const worldMatrix = item.matrixWorld.clone();
    const inverse = worldMatrix.clone().invert();
    const world = new THREE.Vector3();
    const local = new THREE.Vector3();
    let maxY = -Infinity;
    if (apexLimit !== undefined) {
      for (let i = 0; i < position.count; i++) {
        world.set(position.getX(i), position.getY(i), position.getZ(i)).applyMatrix4(worldMatrix);
        maxY = Math.max(maxY, world.y);
      }
    }
    for (let i = 0; i < position.count; i++) {
      local.set(position.getX(i), position.getY(i), position.getZ(i));
      world.copy(local).applyMatrix4(worldMatrix);
      const radial = Math.hypot(world.x, world.z);
      const radialLimit = apexLimit !== undefined && world.y >= maxY - 0.025 ? apexLimit : limit;
      if (radial > radialLimit) {
        const scale = radialLimit / radial;
        world.x *= scale;
        world.z *= scale;
        local.copy(world).applyMatrix4(inverse);
        position.setX(i, local.x);
        position.setY(i, local.y);
        position.setZ(i, local.z);
      }
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    item.geometry = geometry;
  }

  /** Re-center the upper talon after the strong mid-body cant while keeping its feet fixed. */
  function bendCageTalonToApex(item: THREE.Mesh, angle: number, orbitRadius: number, bodyTangentialOffset: number, tangentialOffset: number, frontDepthOffset: number, crossStart: number, crossPeak: number, crossEnd: number, orientation: THREE.Quaternion): void {
    const geometry = item.geometry.clone();
    uniqueGeometries.add(geometry);
    const position = geometry.getAttribute('position');
    const inverse = orientation.clone().invert();
    const radial = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle));
    const tangent = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    const world = new THREE.Vector3();
    for (let i = 0; i < position.count; i++) {
      const localY = position.getY(i);
      const t = THREE.MathUtils.clamp(localY / CAGE_ARCH_HEIGHT, 0, 1);
      const bodyT = THREE.MathUtils.clamp(t / CAGE_ARCH_BEND_START, 0, 1);
      const bodySmooth = bodyT * bodyT * (3 - 2 * bodyT);
      const tipT = THREE.MathUtils.clamp((t - CAGE_ARCH_BEND_START) / (1 - CAGE_ARCH_BEND_START), 0, 1);
      const tipSmooth = tipT * tipT * (3 - 2 * tipT);
      const targetRadius = t <= CAGE_ARCH_BEND_START
        ? THREE.MathUtils.lerp(orbitRadius, CAGE_ARCH_BODY_RADIUS, bodySmooth)
        : THREE.MathUtils.lerp(CAGE_ARCH_BODY_RADIUS, CAGE_ARCH_APEX_RADIUS, tipSmooth);
      const currentCenterRadius = orbitRadius - localY * Math.sin(CAGE_ARCH_CANT_RADIANS);
      world.set(position.getX(i), position.getY(i), position.getZ(i)).applyQuaternion(orientation);
      const radialCorrection = targetRadius - currentCenterRadius;
      world.x += radial.x * radialCorrection;
      world.z += radial.z * radialCorrection;
      const crossIn = crossPeak > crossStart
        ? THREE.MathUtils.smoothstep(t, crossStart, crossPeak)
        : 0;
      const crossOut = crossEnd > crossPeak
        ? 1 - THREE.MathUtils.smoothstep(t, crossPeak, crossEnd)
        : 0;
      const bodyInterlock = crossIn * crossOut;
      world.x += tangent.x * bodyTangentialOffset * bodyInterlock;
      world.z += tangent.z * bodyTangentialOffset * bodyInterlock;
      world.x += tangent.x * tangentialOffset * tipSmooth;
      world.z += tangent.z * tangentialOffset * tipSmooth;
      world.z += frontDepthOffset * bodyInterlock;
      world.applyQuaternion(inverse);
      position.setX(i, world.x);
      position.setY(i, world.y);
      position.setZ(i, world.z);
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
    source.add(radialWedge(
      'wing_base_radial_plinth',
      1.48,
      PRIMARY_WING_BASE_SOURCE_RADIAL_DEPTH,
      0.66,
    ));
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

  /** Filled pointed talon rib for the four-prong crown cage. */
  function makeCageArchSource(): THREE.Group {
    const source = group('crystal_cage_arch_source');
    const rib = solidArchPanel('cage_arch', CAGE_ARCH_WIDTH, CAGE_ARCH_HEIGHT, CAGE_ARCH_DEPTH);
    source.add(rib);
    return source;
  }

  /** Broad convex faceted almond/mandorla with a continuous proud front spine (stage 4 only). */
  function makeCentralCrystal(): THREE.Group {
    const crystal = group('central_crystal');
    // The base is already broad at the collar; the max width sits around 40% of
    // the source height, then tapers monotonically to the pointed apex.
    const mandorlaProfile: readonly [number, number][] = [
      [CENTRAL_CRYSTAL_BASE_HALF_WIDTH, 3.5],
      [0.74, 3.62],
      [0.78, 3.92],
      [0.83, 4.38],
      [CENTRAL_CRYSTAL_MAX_HALF_WIDTH, 4.68],
      [CENTRAL_CRYSTAL_MAX_HALF_WIDTH, 4.94],
      [0.82, 5.26],
      [0.73, 5.62],
      [0.63, 5.98],
      [0.52, 6.30],
      [0.40, 6.56],
      [0.27, 6.78],
      [0.13, 6.98],
      [0.001, 7.08],
    ];
    const body = convexMandorla(
      'crystal_mandorla',
      mandorlaProfile,
      CENTRAL_CRYSTAL_FACET_SEGMENTS,
      CENTRAL_CRYSTAL_FRONT_BULGE,
      0.20,
    );
    crystal.add(body);

    const spineProfile: readonly [number, number][] = [
      [0.15, 3.5],
      [0.15, 3.62],
      [0.15, 3.92],
      [0.15, 4.38],
      [0.15, 4.68],
      [0.15, 4.94],
      [0.14, 5.26],
      [0.13, 5.62],
      [0.11, 5.98],
      [0.09, 6.30],
      [0.07, 6.56],
      [0.05, 6.78],
      [0.03, 6.98],
      [0.001, 7.08],
    ];
    const spineWidthProfile: readonly number[] = [
      0.29, 0.30, 0.32, 0.34, 0.34, 0.34, 0.32,
      0.29, 0.25, 0.20, 0.15, 0.10, 0.05, 0.005,
    ];
    const spine = frontSpine(
      'crystal_front_center_spine',
      spineProfile,
      CENTRAL_CRYSTAL_SPINE_WIDTH,
      CENTRAL_CRYSTAL_SPINE_PROUD,
      spineWidthProfile,
    );
    crystal.add(spine);
    return crystal;
  }

  /** Solid convex faceted almond that fills the front energy-vault frame. */
  function makeVaultMandorla(): THREE.Group {
    const jewel = group('energy_vault_mandorla');
    const profile: readonly [number, number][] = [
      [0, ENERGY_VAULT_JEWEL_BASE_Y],
      [0.38, ENERGY_VAULT_JEWEL_BASE_Y + 0.08],
      [ENERGY_VAULT_JEWEL_WIDTH * 0.39, ENERGY_VAULT_JEWEL_BASE_Y + 0.32],
      [ENERGY_VAULT_JEWEL_WIDTH * 0.5, ENERGY_VAULT_JEWEL_BASE_Y + 0.68],
      [ENERGY_VAULT_JEWEL_WIDTH * 0.5, ENERGY_VAULT_JEWEL_BASE_Y + 1.08],
      [ENERGY_VAULT_JEWEL_WIDTH * 0.44, ENERGY_VAULT_JEWEL_BASE_Y + 1.48],
      [ENERGY_VAULT_JEWEL_WIDTH * 0.33, ENERGY_VAULT_JEWEL_BASE_Y + 1.9],
      [0.24, ENERGY_VAULT_JEWEL_BASE_Y + 2.25],
      [0, ENERGY_VAULT_JEWEL_BASE_Y + ENERGY_VAULT_JEWEL_HEIGHT],
    ];
    const body = convexMandorla(
      'energy_vault_solid_jewel',
      profile,
      8,
      ENERGY_VAULT_JEWEL_FRONT_BULGE,
      ENERGY_VAULT_JEWEL_REAR_DEPTH,
    );
    jewel.add(body);
    jewel.position.z = ENERGY_VAULT_JEWEL_CENTER_Z;
    return jewel;
  }

  /** Small seam jewel above the energy-vault mandorla. */
  function makeVaultSeamJewel(): THREE.Group {
    const jewel = group('energy_vault_seam_jewel');
    const profile: readonly [number, number][] = [
      [0, ENERGY_VAULT_SEAM_BASE_Y],
      [ENERGY_VAULT_SEAM_WIDTH * 0.5, ENERGY_VAULT_SEAM_BASE_Y + 0.12],
      [ENERGY_VAULT_SEAM_WIDTH * 0.42, ENERGY_VAULT_SEAM_BASE_Y + 0.22],
      [0, ENERGY_VAULT_SEAM_BASE_Y + ENERGY_VAULT_SEAM_HEIGHT],
    ];
    jewel.add(lathe('energy_vault_seam_jewel_mesh', profile, 8));
    jewel.position.z = ENERGY_VAULT_JEWEL_CENTER_Z + 0.12;
    return jewel;
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

  // ---- Stage 2: stepped plinth, lower drum, entrance bay, stair, wing lobes ----
  const plinthTier1 = tapered(
    'plinth_tier_1',
    PLINTH_TIER_1_TOP_RADIUS,
    PLINTH_TIER_1_BOTTOM_RADIUS,
    PLINTH_TIER_1_TOP_Y - PLINTH_TIER_1_BOTTOM_Y,
    [0, (PLINTH_TIER_1_BOTTOM_Y + PLINTH_TIER_1_TOP_Y) * 0.5, 0],
    64,
  );
  stage2.add(plinthTier1); parts.plinth_tier_1 = plinthTier1;
  const plinthTier2 = tapered(
    'plinth_tier_2',
    PLINTH_TIER_2_TOP_RADIUS,
    PLINTH_TIER_2_BOTTOM_RADIUS,
    PLINTH_TIER_2_TOP_Y - PLINTH_TIER_2_BOTTOM_Y,
    [0, (PLINTH_TIER_2_BOTTOM_Y + PLINTH_TIER_2_TOP_Y) * 0.5, 0],
    64,
  );
  stage2.add(plinthTier2); parts.plinth_tier_2 = plinthTier2;

  const lower = cylinder('lower_drum', LOWER_DRUM_RADIUS, LOWER_DRUM_HEIGHT, [0, LOWER_DRUM_CENTER_Y, 0], 48);
  stage2.add(lower); parts.lower_drum = lower;

  const entrance = group('entrance_bay');
  entrance.add(box('entrance_back_wall', [2.3, 3.0, 0.18], [0, 1.5, 1.62]));
  entrance.add(box('entrance_pylon_l', [0.5, 2.7, 1.05], [-1.2, 1.35, 2.15]));
  entrance.add(box('entrance_pylon_r', [0.5, 2.7, 1.05], [1.2, 1.35, 2.15]));
  const entranceArch = archFrame('entrance_pointed_arch', 1.6, 2.5, 0.4, 0.22);
  entranceArch.position.set(0, 0.5, 2.0);
  entrance.position.y = PLINTH_TIER_2_TOP_Y;
  entrance.add(entranceArch);
  stage2.add(entrance); parts.entrance_bay = entrance;

  const stair = group('broad_front_stair');
  const treadGeometry = trackGeometry(new THREE.BoxGeometry(STAIR_TREAD_WIDTH, STAIR_TREAD_HEIGHT, STAIR_TREAD_DEPTH));
  const zStep = (STAIR_FRONT_Z - STAIR_LAST_Z) / (STAIR_TREAD_COUNT - 1);
  for (let i = 0; i < STAIR_TREAD_COUNT; i++) {
    const tread = mesh(treadGeometry, `stair_tread_${i + 1}`);
    tread.position.set(0, STAIR_TREAD_HEIGHT * 0.5 + i * STAIR_TREAD_HEIGHT, STAIR_FRONT_Z - i * zStep);
    stair.add(tread);
  }
  stage2.add(stair); parts.broad_front_stair = stair;

  const wingBaseSource = makeWingBaseSource();
  const wingUpperSource = makeWingUpperSource();
  const wingGroup = group('primary_wings');
  const wingBaseGroup = group('primary_wing_bases');
  const wingUpperGroup = group('primary_wing_uppers');
  const wingBaseMountY = PRIMARY_WING_BASE_CENTER_Y - 0.33;
  const wingUpperMountY = PRIMARY_WING_UPPER_CENTER_Y - 1.41;
  for (let i = 0; i < 4; i++) {
    const angle = i * Math.PI / 2;
    const baseClone = wingBaseSource.clone(true); baseClone.name = `primary_wing_base_${i}`;
    baseClone.position.copy(radialPosition(PRIMARY_WING_BASE_ORBIT_RADIUS, angle, wingBaseMountY));
    baseClone.scale.z = PRIMARY_WING_BASE_RADIAL_SCALE;
    baseClone.rotation.y = angle;
    wingBaseGroup.add(baseClone);

    const upperClone = wingUpperSource.clone(true); upperClone.name = `primary_wing_upper_${i}`;
    upperClone.position.copy(radialPosition(PRIMARY_WING_UPPER_ORBIT_RADIUS, angle, wingUpperMountY));
    upperClone.rotation.y = angle;
    wingUpperGroup.add(upperClone);

    parts[`primary_wing_base_${i}`] = baseClone;
    parts[`primary_wing_upper_${i}`] = upperClone;
  }
  wingGroup.add(wingBaseGroup);
  stage2.add(wingGroup); parts.primary_wing_source = wingGroup;
  parts.primary_wing_base_source = wingBaseGroup;
  stage2.add(wingUpperGroup); parts.primary_wing_upper_source = wingUpperGroup;

  // ---- Stage 3: upper drum, diagonal towers, buttresses, and vault frame ----
  const upper = cylinder('upper_drum', UPPER_DRUM_RADIUS, UPPER_DRUM_HEIGHT, [0, UPPER_DRUM_CENTER_Y, 0], 48);
  stage3.add(upper); parts.upper_drum = upper;

  const towerSource = makeTowerSource();
  const towerGroup = group('side_crystal_towers');
  for (let i = 0; i < 4; i++) {
    const clone = towerSource.clone(true); clone.name = `side_crystal_tower_${i}`;
    clone.position.copy(radialPosition(2.45, Math.PI / 4 + i * Math.PI / 2, SIDE_TOWER_MOUNT_Y));
    clone.scale.y = SIDE_TOWER_VERTICAL_SCALE;
    clone.rotation.y = Math.PI / 4 + i * Math.PI / 2;
    towerGroup.add(clone);
  }
  stage3.add(towerGroup); parts.side_crystal_tower_source = towerGroup;

  const buttressSource = makeButtressSource();
  const buttressGroup = group('secondary_buttresses');
  for (let i = 0; i < 4; i++) {
    const clone = buttressSource.clone(true); clone.name = `secondary_buttress_${i}`;
    clone.position.copy(radialPosition(2.85, Math.PI / 8 + i * Math.PI / 2, 6.0));
    clone.scale.y = SECONDARY_BUTTRESS_VERTICAL_SCALE;
    clone.rotation.y = Math.PI / 8 + i * Math.PI / 2;
    buttressGroup.add(clone);
  }
  stage3.add(buttressGroup); parts.secondary_buttress_source = buttressGroup;

  const vaultFrame = group('energy_vault_frame');
  const vaultOuterFrame = archFrame(
    'energy_vault_outer_punched_frame',
    ENERGY_VAULT_OUTER_WIDTH,
    ENERGY_VAULT_OUTER_HEIGHT,
    ENERGY_VAULT_FRAME_DEPTH,
    ENERGY_VAULT_FRAME_THICKNESS,
  );
  vaultOuterFrame.position.set(0, ENERGY_VAULT_OUTER_BOTTOM_Y, ENERGY_VAULT_CENTER_Z);
  vaultFrame.add(vaultOuterFrame);
  const vaultEntranceFrame = archFrame(
    'energy_vault_small_entrance_frame',
    ENERGY_VAULT_ENTRANCE_WIDTH,
    ENERGY_VAULT_ENTRANCE_HEIGHT,
    ENERGY_VAULT_ENTRANCE_FRAME_DEPTH,
    0.2,
  );
  vaultEntranceFrame.position.set(0, ENERGY_VAULT_ENTRANCE_BOTTOM_Y, ENERGY_VAULT_JEWEL_CENTER_Z + 0.24);
  vaultFrame.add(vaultEntranceFrame);
  const vaultEntranceRecess = solidArchPanel(
    'energy_vault_small_entrance_recess',
    ENERGY_VAULT_ENTRANCE_WIDTH - 0.4,
    ENERGY_VAULT_ENTRANCE_HEIGHT - 0.2,
    ENERGY_VAULT_ENTRANCE_RECESS_DEPTH,
  );
  vaultEntranceRecess.position.set(0, ENERGY_VAULT_ENTRANCE_BOTTOM_Y, ENERGY_VAULT_ENTRANCE_RECESS_CENTER_Z);
  vaultFrame.add(vaultEntranceRecess);
  stage3.add(vaultFrame);
  parts.energy_vault_frame = vaultFrame;
  parts.energy_vault_outer_punched_frame = vaultOuterFrame;
  parts.energy_vault_small_entrance_frame = vaultEntranceFrame;
  parts.energy_vault_small_entrance_recess = vaultEntranceRecess;

  const crownCollar = group('crown_collar');
  const collarBody = lathe('crown_collar_body', [
    [1.55, 3.02 + CROWN_COLLAR_Y_OFFSET],
    [1.76, 3.02 + CROWN_COLLAR_Y_OFFSET],
    [1.96, 3.09 + CROWN_COLLAR_Y_OFFSET],
    [2.02, 3.18 + CROWN_COLLAR_Y_OFFSET],
    [2.02, 3.34 + CROWN_COLLAR_Y_OFFSET],
    [1.96, 3.44 + CROWN_COLLAR_Y_OFFSET],
    [1.55, 3.44 + CROWN_COLLAR_Y_OFFSET],
    [1.55, 3.02 + CROWN_COLLAR_Y_OFFSET],
  ], 16);
  const upperLip = lathe('crown_collar_upper_lip', [
    [1.55, 3.4 + CROWN_COLLAR_Y_OFFSET],
    [1.88, 3.4 + CROWN_COLLAR_Y_OFFSET],
    [2.0, 3.43 + CROWN_COLLAR_Y_OFFSET],
    [2.02, 3.47 + CROWN_COLLAR_Y_OFFSET],
    [2.02, 3.52 + CROWN_COLLAR_Y_OFFSET],
    [1.55, 3.52 + CROWN_COLLAR_Y_OFFSET],
    [1.55, 3.4 + CROWN_COLLAR_Y_OFFSET],
  ], 16);
  const lowerLip = lathe('crown_collar_lower_lip', [
    [1.55, 3.02 + CROWN_COLLAR_Y_OFFSET],
    [1.78, 3.02 + CROWN_COLLAR_Y_OFFSET],
    [1.88, 3.06 + CROWN_COLLAR_Y_OFFSET],
    [1.88, 3.17 + CROWN_COLLAR_Y_OFFSET],
    [1.78, 3.17 + CROWN_COLLAR_Y_OFFSET],
    [1.55, 3.17 + CROWN_COLLAR_Y_OFFSET],
    [1.55, 3.02 + CROWN_COLLAR_Y_OFFSET],
  ], 16);
  crownCollar.add(collarBody, upperLip, lowerLip);
  stage4.add(crownCollar);
  parts.crown_collar = crownCollar;
  parts.crown_collar_body = collarBody;
  parts.crown_collar_upper_lip = upperLip;
  parts.crown_collar_lower_lip = lowerLip;

  const crown3 = tapered('crown_lower_socket', 0.22, 0.4, 0.6, [0, 3.6, 0], 6, Math.PI / 6);
  parts.crown_lower_socket = crown3;

  // ---- Stage 4: scaled crown, vault jewels, finial, and canted cage arches ----
  const crownAssembly = group('accepted_crown_assembly');
  const central = makeCentralCrystal();
  crownAssembly.add(central); parts.central_crystal = central;
  const centralSpine = central.getObjectByName('crystal_front_center_spine');
  if (centralSpine) parts.crystal_front_center_spine = centralSpine;

  const cageSource = makeCageArchSource();
  const cageGroup = group('crystal_cage_arches');
  for (let i = 0; i < 4; i++) {
    const clone = cageSource.clone(true); clone.name = `crystal_cage_arch_${i}`;
    const angle = CAGE_ARCH_ROTATION_RADIANS + i * Math.PI / 2;
    const orbitRadius = CAGE_ARCH_ORBIT_RADII[i];
    clone.position.copy(radialPosition(orbitRadius, angle, CAGE_ARCH_BASE_Y));
    clone.rotation.y = THREE.MathUtils.degToRad(CAGE_ARCH_YAWS_DEGREES[i]);
    const tangent = new THREE.Vector3(Math.cos(angle), 0, -Math.sin(angle));
    clone.rotateOnWorldAxis(tangent, -CAGE_ARCH_CANT_RADIANS);
    const frame = clone.getObjectByName('cage_arch');
    if (frame instanceof THREE.Mesh) {
      bendCageTalonToApex(frame, angle, orbitRadius, CAGE_ARCH_BODY_TANGENTIAL_OFFSETS[i], CAGE_ARCH_APEX_TANGENTIAL_OFFSETS[i], CAGE_ARCH_FRONT_DEPTH_OFFSETS[i], CAGE_ARCH_BODY_CROSS_STARTS[i], CAGE_ARCH_BODY_CROSS_PEAKS[i], CAGE_ARCH_BODY_CROSS_ENDS[i], clone.quaternion);
      clampRadialExtent(frame, clone.position, 1.9, clone.quaternion);
    }
    const footFlare = radialWedge(`cage_arch_foot_flare_${i}`, CAGE_ARCH_FOOT_FLARE_WIDTH, CAGE_ARCH_FOOT_FLARE_DEPTH, CAGE_ARCH_FOOT_FLARE_HEIGHT);
    const radialOrientation = new THREE.Object3D();
    radialOrientation.rotation.y = angle;
    radialOrientation.rotateOnWorldAxis(tangent, -CAGE_ARCH_CANT_RADIANS);
    footFlare.quaternion.copy(clone.quaternion.clone().invert().multiply(radialOrientation.quaternion));
    clone.add(footFlare);
    cageGroup.add(clone);
  }
  crownAssembly.add(cageGroup); parts.crystal_cage_arch_source = cageGroup;

  const crown4 = tapered('stage_4_crown', 0, 0.17, 0.32, [0, 7.04, 0], 8, Math.PI / 8);
  crownAssembly.add(crown3, crown4);
  parts.stage_4_crown = crown4;
  parts.crown_lower_socket = crown3;
  crownAssembly.scale.set(CROWN_SCALE, CROWN_VERTICAL_SCALE, CROWN_SCALE);
  crownAssembly.position.y = CROWN_MOUNT_Y - CROWN_VERTICAL_SCALE * CROWN_SOURCE_BASE_Y;
  stage4.add(crownAssembly);
  crownAssembly.updateWorldMatrix(true, true);
  for (const clone of cageGroup.children) {
    const frame = clone.getObjectByName('cage_arch');
    if (frame instanceof THREE.Mesh) clampWorldRadialExtent(frame, 1.9, 0.4);
  }
  parts.crown_assembly = crownAssembly;

  const vaultJewels = group('energy_vault_jewels');
  const vaultMandorla = makeVaultMandorla();
  const vaultSeamJewel = makeVaultSeamJewel();
  vaultJewels.add(vaultMandorla, vaultSeamJewel);
  stage4.add(vaultJewels);
  parts.energy_vault_jewels = vaultJewels;
  parts.energy_vault_mandorla = vaultMandorla;
  parts.energy_vault_seam_jewel = vaultSeamJewel;

  const bannerSource = group('banner_mount_source');
  bannerSource.add(beam('banner_mount', new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.55, 0), 0.12));
  const bannerGroup = group('banner_mounts');
  for (let i = 0; i < 4; i++) {
    const clone = bannerSource.clone(true); clone.name = `banner_mount_${i}`;
    clone.position.copy(radialPosition(3.05, Math.PI / 4 + i * Math.PI / 2, PLINTH_TIER_2_TOP_Y));
    bannerGroup.add(clone);
  }
  stage4.add(bannerGroup); parts.banner_mount_source = bannerGroup;

  const sourceIds: Record<string, string> = {
    primary_wing_source: 'primary_wing_source',
    primary_wing_base_source: 'primary_wing_base_source',
    primary_wing_upper_source: 'primary_wing_upper_source',
    secondary_buttress_source: 'secondary_buttress_source',
    side_crystal_tower_source: 'side_crystal_tower_source',
    energy_vault_frame: 'energy_vault_frame',
    energy_vault_jewels: 'energy_vault_jewels',
    crown_collar: 'crown_collar',
    crown_assembly: 'accepted_crown_assembly',
    crystal_mandorla: 'convex-faceted-shell',
    crystal_front_center_spine: 'broad-continuous-rib-plane',
    crystal_cage_arch_source: 'crystal_cage_arch_source',
    banner_mount_source: 'banner_mount_source',
  };
  const manifest: StructuralManifest = {
    assetId: 'SunweaverTownCenter_Structural_v01',
    canonicalCivilization: 'Sunweaver',
    footprintDiameter: D,
    entranceAxis: 'south',
    cageArchProfile: 'solid-rib',
    normalizedDimensions: {
      footprintDiameter: 1,
      plinthTier1BottomY: PLINTH_TIER_1_BOTTOM_Y / D,
      plinthTier1TopY: PLINTH_TIER_1_TOP_Y / D,
      plinthTier1BottomRadius: PLINTH_TIER_1_BOTTOM_RADIUS / D,
      plinthTier1TopRadius: PLINTH_TIER_1_TOP_RADIUS / D,
      plinthTier2BottomY: PLINTH_TIER_2_BOTTOM_Y / D,
      plinthTier2TopY: PLINTH_TIER_2_TOP_Y / D,
      plinthTier2BottomRadius: PLINTH_TIER_2_BOTTOM_RADIUS / D,
      plinthTier2TopRadius: PLINTH_TIER_2_TOP_RADIUS / D,
      lowerDrumRadius: LOWER_DRUM_RADIUS / D,
      lowerDrumHeight: LOWER_DRUM_HEIGHT / D,
      upperDrumRadius: UPPER_DRUM_RADIUS / D,
      upperDrumHeight: UPPER_DRUM_HEIGHT / D,
      crownHeight: (CROWN_TARGET_APEX_Y - (3.02 + CROWN_COLLAR_Y_OFFSET)) / D,
      entranceProjection: 0.25 / D,
      sideTowerRadius: 0.55 / D,
      sideTowerOuterReach: (2.45 + 0.55) / D,
      sideTowerMountY: SIDE_TOWER_MOUNT_Y / D,
      sideTowerTopY: (SIDE_TOWER_MOUNT_Y + SIDE_TOWER_SOURCE_TOP_Y * SIDE_TOWER_VERTICAL_SCALE) / D,
      sideTowerVerticalScale: SIDE_TOWER_VERTICAL_SCALE,
      secondaryButtressOuterReach: (2.85 + 0.4) / D,
      secondaryButtressVerticalScale: SECONDARY_BUTTRESS_VERTICAL_SCALE,
      primaryWingBaseOrbitRadius: PRIMARY_WING_BASE_ORBIT_RADIUS / D,
      primaryWingUpperOrbitRadius: PRIMARY_WING_UPPER_ORBIT_RADIUS / D,
      primaryWingOuterReach: PRIMARY_WING_OUTER_REACH / D,
      primaryWingTangentialWidth: 1.48 / D,
      primaryWingRadialDepth: PRIMARY_WING_BASE_RADIAL_DEPTH / D,
      primaryWingBaseHeight: 0.66 / D,
      entranceWidth: 1.6 / D,
      entranceBayBaseY: PLINTH_TIER_2_TOP_Y / D,
      stairTreadCount: STAIR_TREAD_COUNT,
      stairTopY: STAIR_TOP_Y / D,
      energyVaultOuterWidth: ENERGY_VAULT_OUTER_WIDTH / D,
      energyVaultOuterHeight: ENERGY_VAULT_OUTER_HEIGHT / D,
      energyVaultOuterBottomY: ENERGY_VAULT_OUTER_BOTTOM_Y / D,
      energyVaultFrameThickness: ENERGY_VAULT_FRAME_THICKNESS / D,
      energyVaultFrameDepth: ENERGY_VAULT_FRAME_DEPTH / D,
      energyVaultOpeningWidth: ENERGY_VAULT_OPENING_WIDTH / D,
      energyVaultOpeningHeight: ENERGY_VAULT_OPENING_HEIGHT / D,
      energyVaultSolidJewelWidth: ENERGY_VAULT_JEWEL_WIDTH / D,
      energyVaultSolidJewelHeight: ENERGY_VAULT_JEWEL_HEIGHT / D,
      energyVaultSolidJewelFrontBulge: ENERGY_VAULT_JEWEL_FRONT_BULGE / D,
      energyVaultSolidJewelRearDepth: ENERGY_VAULT_JEWEL_REAR_DEPTH / D,
      energyVaultSolidJewelBaseY: ENERGY_VAULT_JEWEL_BASE_Y / D,
      energyVaultSolidJewelTopY: (ENERGY_VAULT_JEWEL_BASE_Y + ENERGY_VAULT_JEWEL_HEIGHT) / D,
      energyVaultMandorlaWidth: ENERGY_VAULT_JEWEL_WIDTH / D,
      energyVaultMandorlaHeight: ENERGY_VAULT_JEWEL_HEIGHT / D,
      energyVaultSeamWidth: ENERGY_VAULT_SEAM_WIDTH / D,
      energyVaultSeamHeight: ENERGY_VAULT_SEAM_HEIGHT / D,
      energyVaultEntranceWidth: ENERGY_VAULT_ENTRANCE_WIDTH / D,
      energyVaultEntranceHeight: ENERGY_VAULT_ENTRANCE_HEIGHT / D,
      energyVaultEntranceBottomY: ENERGY_VAULT_ENTRANCE_BOTTOM_Y / D,
      energyVaultEntranceRecessDepth: ENERGY_VAULT_ENTRANCE_RECESS_DEPTH / D,
      centralCrownRadius: CENTRAL_CRYSTAL_BASE_HALF_WIDTH * CROWN_SCALE / D,
      crownCollarOuterRadius: 2.02 / D,
      crownCollarInnerRadius: 1.55 / D,
      crownCollarHeight: 0.5 / D,
      crownCollarUpperLipHeight: 0.12 / D,
      crownCollarLowerLipHeight: 0.15 / D,
      crownCollarSpringlineY: CROWN_COLLAR_SPRINGLINE_Y / D,
      crownRadialScale: CROWN_SCALE,
      crownVerticalScale: CROWN_VERTICAL_SCALE,
      centralCrystalBaseHalfWidth: CENTRAL_CRYSTAL_BASE_HALF_WIDTH * CROWN_SCALE / D,
      centralCrystalMaxHalfWidth: CENTRAL_CRYSTAL_MAX_HALF_WIDTH * CROWN_SCALE / D,
      centralCrystalFrontBulge: CENTRAL_CRYSTAL_FRONT_BULGE * CROWN_SCALE / D,
      centralCrystalBaseY: CROWN_MOUNT_Y / D,
      centralCrystalApexY: CROWN_TARGET_APEX_Y / D,
      centralCrystalFacetSegments: CENTRAL_CRYSTAL_FACET_SEGMENTS,
      centralCrystalSpineWidth: CENTRAL_CRYSTAL_SPINE_WIDTH * CROWN_SCALE / D,
      centralCrystalSpineProud: CENTRAL_CRYSTAL_SPINE_PROUD * CROWN_SCALE / D,
      cageArchOuterWidth: CAGE_ARCH_WIDTH * CROWN_SCALE / D,
      cageArchHeight: CAGE_ARCH_HEIGHT * CROWN_VERTICAL_SCALE / D,
      cageArchDepth: CAGE_ARCH_DEPTH * CROWN_SCALE / D,
      cageArchOrbitRadius: CAGE_ARCH_ORBIT_RADIUS * CROWN_SCALE / D,
      cageArchBaseOrbitRadius: CAGE_ARCH_ORBIT_RADIUS * CROWN_SCALE / D,
      cageArchBaseOrbitMinRadius: Math.min(...CAGE_ARCH_ORBIT_RADII) * CROWN_SCALE / D,
      cageArchBaseOrbitMaxRadius: Math.max(...CAGE_ARCH_ORBIT_RADII) * CROWN_SCALE / D,
      cageArchRotationDegrees: CAGE_ARCH_ROTATION_DEGREES,
      cageArchFootFlareWidth: CAGE_ARCH_FOOT_FLARE_WIDTH * CROWN_SCALE / D,
      cageArchFootFlareDepth: CAGE_ARCH_FOOT_FLARE_DEPTH * CROWN_SCALE / D,
      cageArchFootFlareHeight: CAGE_ARCH_FOOT_FLARE_HEIGHT * CROWN_VERTICAL_SCALE / D,
      cageArchMaxRadius: 1.9 / D,
      cageArchBaseY: (CROWN_MOUNT_Y + (CAGE_ARCH_BASE_Y - CROWN_SOURCE_BASE_Y) * CROWN_VERTICAL_SCALE) / D,
      cageArchApexY: (CROWN_MOUNT_Y + (CAGE_ARCH_APEX_Y - CROWN_SOURCE_BASE_Y) * CROWN_VERTICAL_SCALE) / D,
      cageArchApexRadius: CAGE_ARCH_APEX_RADIUS * CROWN_SCALE / D,
      cageArchBodyRadius: CAGE_ARCH_BODY_RADIUS * CROWN_SCALE / D,
      cageArchApexTangentialOffsetMax: Math.max(...CAGE_ARCH_APEX_TANGENTIAL_OFFSETS.map((value) => Math.abs(value))) * CROWN_SCALE / D,
      cageArchBodyTangentialOffsetMax: Math.max(...CAGE_ARCH_BODY_TANGENTIAL_OFFSETS.map((value) => Math.abs(value))) * CROWN_SCALE / D,
      cageArchFrontDepthOffsetMax: Math.max(...CAGE_ARCH_FRONT_DEPTH_OFFSETS) * CROWN_SCALE / D,
      cageArchBodyCrossStartMin: Math.min(...CAGE_ARCH_BODY_CROSS_STARTS.filter((value) => value > 0)),
      cageArchBodyCrossEndMax: Math.max(...CAGE_ARCH_BODY_CROSS_ENDS),
      cageArchApexBendStart: CAGE_ARCH_BEND_START,
      cageArchCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchSouthCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchEastCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchNorthCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchWestCantDegrees: CAGE_ARCH_CANT_DEGREES,
      cageArchDiagonal0YawDegrees: CAGE_ARCH_YAWS_DEGREES[0],
      cageArchDiagonal1YawDegrees: CAGE_ARCH_YAWS_DEGREES[1],
      cageArchDiagonal2YawDegrees: CAGE_ARCH_YAWS_DEGREES[2],
      cageArchDiagonal3YawDegrees: CAGE_ARCH_YAWS_DEGREES[3],
    },
    moduleCounts: {
      foundation_disc: 1,
      plinth_tier_1: 1,
      plinth_tier_2: 1,
      lower_drum: 1,
      upper_drum: 1,
      entrance_bay: 1,
      broad_front_stair: STAIR_TREAD_COUNT,
      primary_wing_source: 4,
      primary_wing_base_source: 4,
      primary_wing_upper_source: 4,
      secondary_buttress_source: 4,
      side_crystal_tower_source: 4,
      energy_vault_frame: 1,
      energy_vault_outer_punched_frame: 1,
      energy_vault_small_entrance_frame: 1,
      energy_vault_small_entrance_recess: 1,
      energy_vault_jewels: 1,
      energy_vault_mandorla: 1,
      energy_vault_seam_jewel: 1,
      central_crystal: 1,
      crystal_mandorla: 1,
      crystal_front_center_spine: 1,
      crystal_cage_arch_source: 4,
      banner_mount_source: 4,
      crown_assembly: 1,
      crown_collar: 1,
      crown_collar_body: 1,
      crown_collar_upper_lip: 1,
      crown_collar_lower_lip: 1,
      crown_lower_socket: 1,
      stage_4_crown: 1,
    },
    sourceIds,
    worldSpaceModuleCenters: {
      foundation_disc: [0, 0.14, 0],
      plinth_tier_1: [0, 1.1, 0],
      plinth_tier_2: [0, 2.55, 0],
      lower_drum: [0, LOWER_DRUM_CENTER_Y, 0],
      upper_drum: [0, UPPER_DRUM_CENTER_Y, 0],
      entrance_bay: [0, 4.8, 2.1],
      broad_front_stair: [0, STAIR_TOP_Y * 0.5, (STAIR_FRONT_Z + STAIR_LAST_Z) * 0.5],
      primary_wings: [0, PRIMARY_WING_BASE_CENTER_Y, 0],
      primary_wing_bases: [0, PRIMARY_WING_BASE_CENTER_Y, 0],
      primary_wing_uppers: [0, PRIMARY_WING_UPPER_CENTER_Y, 0],
      primary_wing_base_0: [0, PRIMARY_WING_BASE_CENTER_Y, PRIMARY_WING_BASE_ORBIT_RADIUS],
      primary_wing_base_1: [PRIMARY_WING_BASE_ORBIT_RADIUS, PRIMARY_WING_BASE_CENTER_Y, 0],
      primary_wing_base_2: [0, PRIMARY_WING_BASE_CENTER_Y, -PRIMARY_WING_BASE_ORBIT_RADIUS],
      primary_wing_base_3: [-PRIMARY_WING_BASE_ORBIT_RADIUS, PRIMARY_WING_BASE_CENTER_Y, 0],
      primary_wing_upper_0: [0, PRIMARY_WING_UPPER_CENTER_Y, PRIMARY_WING_UPPER_ORBIT_RADIUS],
      primary_wing_upper_1: [PRIMARY_WING_UPPER_ORBIT_RADIUS, PRIMARY_WING_UPPER_CENTER_Y, 0],
      primary_wing_upper_2: [0, PRIMARY_WING_UPPER_CENTER_Y, -PRIMARY_WING_UPPER_ORBIT_RADIUS],
      primary_wing_upper_3: [-PRIMARY_WING_UPPER_ORBIT_RADIUS, PRIMARY_WING_UPPER_CENTER_Y, 0],
      side_crystal_towers: [0, SIDE_TOWER_MOUNT_Y + SIDE_TOWER_SOURCE_TOP_Y * SIDE_TOWER_VERTICAL_SCALE * 0.5, 0],
      secondary_buttresses: [0, 6.6, 0],
      energy_vault_frame: [0, 5.9, ENERGY_VAULT_CENTER_Z],
      energy_vault_jewels: [0, ENERGY_VAULT_JEWEL_BASE_Y + ENERGY_VAULT_JEWEL_HEIGHT * 0.5, ENERGY_VAULT_JEWEL_CENTER_Z],
      crown_assembly: [0, CROWN_TARGET_APEX_Y * 0.5 + CROWN_MOUNT_Y * 0.5, 0],
      crown_collar: [0, 7.67, 0],
      crown_collar_body: [0, 7.63, 0],
      crown_collar_upper_lip: [0, 7.86, 0],
      crown_collar_lower_lip: [0, 7.51, 0],
      central_crystal: [0, 9.66, 0],
      crystal_mandorla: [0, 9.66, 0],
      crystal_front_center_spine: [0, 9.66, (CENTRAL_CRYSTAL_FRONT_BULGE + CENTRAL_CRYSTAL_SPINE_PROUD * 0.5) * CROWN_SCALE],
      crystal_cage_arches: [0, 9.47, 0],
      banner_mounts: [0, 3.575, 0],
      crown_lower_socket: [0, 7.715, 0],
      stage_4_crown: [0, 11.67, 0],
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
