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
import { STARHOLD_PALETTE as P } from './palette';
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

/** Build one close-reference Helion scout from real Three.js primitives. */
function buildProceduralScoutMesh(): THREE.Group {
  const root = new THREE.Group();
  const ink = new THREE.MeshStandardMaterial({ color: P.ink, roughness: 0.9, metalness: 0.05, flatShading: true });
  const bronze = new THREE.MeshStandardMaterial({ color: P.copper, roughness: 0.72, metalness: 0.18, flatShading: true });
  const gold = new THREE.MeshStandardMaterial({ color: P.amber, roughness: 0.65, metalness: 0.25, flatShading: true });
  const bone = new THREE.MeshStandardMaterial({ color: P.sand, roughness: 0.8, metalness: 0.08, flatShading: true });
  const boneHi = new THREE.MeshStandardMaterial({ color: P.cream, roughness: 0.72, metalness: 0.1, flatShading: true });
  const graphite = new THREE.MeshStandardMaterial({ color: P.slate, roughness: 0.88, metalness: 0.08, flatShading: true });
  const panel = new THREE.MeshStandardMaterial({ color: P.berry, roughness: 0.7, metalness: 0.12, flatShading: true });
  const amber = new THREE.MeshStandardMaterial({ color: P.ochre, emissive: P.rust, emissiveIntensity: 0.55, roughness: 0.28, metalness: 0.16 });
  const white = new THREE.MeshStandardMaterial({ color: P.pale, roughness: 0.72, metalness: 0.06, flatShading: true });

  const beam = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material): THREE.Mesh => {
    const delta = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, delta.length(), 8), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };

  // Tapered chassis. Keep it tall and rotate it independently from the sensor
  // plane so the camera reads a broad front and side plane at the same time.
  const chassis = new THREE.Group();
  chassis.rotation.y = -0.58;
  root.add(chassis);
  const bodyGeo = new THREE.BufferGeometry();
  bodyGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute([
      -0.78, 0.98, -0.56, 0.78, 0.98, -0.56, 0.78, 0.98, 0.56, -0.78, 0.98, 0.56,
      -0.52, 2.42, -0.35, 0.52, 2.42, -0.35, 0.52, 2.42, 0.35, -0.52, 2.42, 0.35,
    ], 3),
  );
  bodyGeo.setIndex([
    3, 2, 6, 3, 6, 7, // front +Z
    1, 0, 4, 1, 4, 5, // back -Z
    0, 3, 7, 0, 7, 4, // left -X
    2, 1, 5, 2, 5, 6, // right +X
    4, 5, 6, 4, 6, 7, // top
    0, 1, 2, 0, 2, 3, // bottom
  ]);
  bodyGeo.addGroup(0, 6, 4);
  bodyGeo.addGroup(6, 6, 1);
  bodyGeo.addGroup(12, 6, 0);
  bodyGeo.addGroup(18, 6, 1);
  bodyGeo.addGroup(24, 6, 2);
  bodyGeo.addGroup(30, 6, 3);
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, [bone, graphite, ink, bronze, boneHi, ink]);
  chassis.add(body);

  const topPlate = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.05, 0.46), panel);
  topPlate.position.set(-0.02, 2.45, 0.01);
  chassis.add(topPlate);
  const topPlateHighlight = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.016, 0.18), boneHi);
  topPlateHighlight.position.set(-0.12, 2.48, 0.04);
  chassis.add(topPlateHighlight);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.08, 12), bronze);
  collar.position.set(0, 2.5, 0);
  chassis.add(collar);

  // Layered front and side plates make the faceted shell readable at game
  // scale, while the offset lens preserves the board reference silhouette.
  const frontInset = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.05), graphite);
  frontInset.position.set(-0.12, 1.64, 0.59);
  frontInset.rotation.z = -0.08;
  chassis.add(frontInset);
  const frontShell = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.42, 0.055), boneHi);
  frontShell.position.set(-0.2, 1.64, 0.625);
  frontShell.rotation.z = -0.08;
  chassis.add(frontShell);
  const sidePanel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.86, 0.84), bronze);
  sidePanel.position.set(0.73, 1.7, -0.005);
  chassis.add(sidePanel);
  const sidePanelInset = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.52, 0.56), graphite);
  sidePanelInset.position.set(0.772, 1.68, -0.03);
  chassis.add(sidePanelInset);

  // Front survey lens and a smaller service port on the right cheek.
  const frontLens = new THREE.Mesh(new THREE.SphereGeometry(0.29, 14, 10), amber);
  frontLens.position.set(-0.38, 1.46, 0.61);
  chassis.add(frontLens);
  const frontRim = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.045, 6, 16), bronze);
  frontRim.rotation.x = Math.PI / 2;
  frontRim.position.set(-0.38, 1.46, 0.65);
  chassis.add(frontRim);
  const lensCore = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), boneHi);
  lensCore.position.set(-0.38, 1.46, 0.82);
  chassis.add(lensCore);
  const cheekPort = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.04, 10), boneHi);
  cheekPort.rotation.x = Math.PI / 2;
  cheekPort.position.set(0.28, 1.65, 0.63);
  chassis.add(cheekPort);

  const frontArmor = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.2, 0.05), boneHi);
  frontArmor.position.set(-0.12, 1.08, 0.59);
  frontArmor.rotation.z = 0.06;
  chassis.add(frontArmor);
  // Exposed shell edges and fasteners carry the high-contrast mechanical
  // seams that are visible around the reference hull.
  chassis.add(beam(new THREE.Vector3(-0.52, 2.42, 0.36), new THREE.Vector3(0.52, 2.42, 0.36), 0.035, gold));
  chassis.add(beam(new THREE.Vector3(-0.78, 0.99, 0.56), new THREE.Vector3(-0.52, 2.42, 0.36), 0.04, bronze));
  chassis.add(beam(new THREE.Vector3(0.78, 0.99, 0.56), new THREE.Vector3(0.52, 2.42, 0.36), 0.04, bronze));
  chassis.add(beam(new THREE.Vector3(-0.78, 0.99, 0.56), new THREE.Vector3(0.78, 0.99, 0.56), 0.035, ink));
  for (const x of [-0.62, 0.48]) {
    const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), gold);
    rivet.position.set(x, 1.15, 0.66);
    chassis.add(rivet);
  }
  for (const y of [1.35, 1.85]) {
    const sideRivet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), boneHi);
    sideRivet.position.set(0.79, y, 0.2);
    chassis.add(sideRivet);
  }

  // Three articulated legs, with round joints and plated feet.
  const legs = [
    [new THREE.Vector3(-0.52, 1.05, 0.02), new THREE.Vector3(-0.94, 0.46, 0.05), new THREE.Vector3(-1.24, 0.03, 0.22)],
    [new THREE.Vector3(0.52, 1.05, 0.02), new THREE.Vector3(0.94, 0.46, 0.05), new THREE.Vector3(1.24, 0.03, 0.22)],
    [new THREE.Vector3(0, 1.03, 0.42), new THREE.Vector3(0, 0.35, 0.8), new THREE.Vector3(0, 0.03, 1.08)],
  ];
  for (let legIndex = 0; legIndex < legs.length; legIndex++) {
    const [hip, knee, foot] = legs[legIndex];
    const upperPlate = legIndex === 2 ? boneHi : bone;
    const lowerPlate = legIndex === 2 ? bone : bronze;
    const plateRadius = legIndex === 2 ? 0.12 : 0.095;
    root.add(beam(hip, knee, 0.15, ink));
    root.add(beam(hip, knee, plateRadius, upperPlate));
    root.add(beam(knee, foot, 0.15, ink));
    root.add(beam(knee, foot, plateRadius, lowerPlate));
    const hipJoint = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), graphite);
    hipJoint.position.copy(hip);
    root.add(hipJoint);
    const joint = new THREE.Mesh(new THREE.SphereGeometry(0.145, 8, 6), graphite);
    joint.position.copy(knee);
    root.add(joint);
    const kneeRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.026, 6, 12), gold);
    kneeRing.rotation.x = Math.PI / 2;
    kneeRing.position.copy(knee);
    root.add(kneeRing);
    const jointBlock = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.24, 0.26), bronze);
    jointBlock.position.copy(knee);
    jointBlock.rotation.y = 0.22;
    root.add(jointBlock);
    const ankle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.17, 0.2), bronze);
    ankle.position.copy(foot).add(new THREE.Vector3(0, 0.09, 0));
    root.add(ankle);
    const footPad = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.13, 0.34), ink);
    footPad.position.copy(foot);
    footPad.rotation.y = 0.18;
    root.add(footPad);
    const footTop = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.24), white);
    footTop.position.copy(foot).add(new THREE.Vector3(0, 0.045, 0));
    root.add(footTop);
    const toe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.035, 0.12), gold);
    toe.position.copy(foot).add(new THREE.Vector3(0, 0.09, 0.1));
    root.add(toe);
  }

  // Mast, triangle rails, inner braces, and the layered amber sensor lens.
  root.add(beam(new THREE.Vector3(0, 2.42, 0), new THREE.Vector3(0, 2.68, 0), 0.075, ink));
  root.add(beam(new THREE.Vector3(0, 2.44, 0.01), new THREE.Vector3(0, 2.68, 0.01), 0.04, bronze));
  const tip = new THREE.Vector3(0, 3.67, 0.02);
  const left = new THREE.Vector3(-0.86, 2.68, 0.02);
  const right = new THREE.Vector3(0.86, 2.68, 0.02);
  const sensorShape = new THREE.Shape();
  sensorShape.moveTo(-0.86, 2.68);
  sensorShape.lineTo(0, 3.57);
  sensorShape.lineTo(0.86, 2.68);
  sensorShape.lineTo(-0.86, 2.68);
  const sensorFill = new THREE.Mesh(
    new THREE.ShapeGeometry(sensorShape),
    new THREE.MeshBasicMaterial({ color: P.deep, side: THREE.DoubleSide }),
  );
  sensorFill.position.z = -0.07;
  root.add(sensorFill);
  root.add(beam(tip, left, 0.085, gold));
  root.add(beam(tip, right, 0.085, gold));
  root.add(beam(left, right, 0.09, boneHi));
  root.add(beam(new THREE.Vector3(0, 3.42, 0.03), new THREE.Vector3(-0.62, 2.68, 0.03), 0.045, graphite));
  root.add(beam(new THREE.Vector3(0, 3.42, 0.03), new THREE.Vector3(0.62, 2.68, 0.03), 0.045, graphite));
  root.add(beam(new THREE.Vector3(-0.76, 2.52, 0.035), new THREE.Vector3(0.76, 2.52, 0.035), 0.04, graphite));
  for (const p of [tip, left, right]) {
    const mount = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.12), bronze);
    mount.position.copy(p);
    root.add(mount);
  }
  const sensorLens = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), amber);
  sensorLens.position.set(0, 3.08, 0.1);
  root.add(sensorLens);
  const sensorRing = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.04, 6, 16), gold);
  sensorRing.rotation.x = Math.PI / 2;
  sensorRing.position.set(0, 3.08, 0.105);
  root.add(sensorRing);

  root.scale.setScalar(0.78);
  // Turn the chassis slightly away from the sensor plane so the camera reads
  // two lit facets, like the reference's three-quarter body view.
  root.rotation.y = ISO_YAW + 0.08;
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
    }
  });
  return root;
}

type ProceduralWorkerRig = {
  legs: { root: THREE.Group; upper: THREE.Group; lower: THREE.Group; foot: THREE.Group; restFootY: number }[];
  sensorMast: THREE.Group;
  sensorHead: THREE.Group;
  spool: THREE.Group;
  spoolRotor: THREE.Group;
  spoolTether: THREE.Mesh;
  manipulator: THREE.Group;
  shoulder: THREE.Group;
  elbow: THREE.Group;
  wrist: THREE.Group;
  tools: { fork: THREE.Group; food: THREE.Group; crystal: THREE.Group; build: THREE.Group };
  actionFx: { gather: THREE.Group; attack: THREE.Group; build: THREE.Group };
  statusLights: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
};

function buildProceduralWorkerMesh(): THREE.Group {
  const root = new THREE.Group();
  root.name = 'helion-worker-b';

  const armor = new THREE.MeshPhysicalMaterial({ color: P.cream, roughness: 0.34, metalness: 0.52, clearcoat: 0.34, clearcoatRoughness: 0.22, flatShading: true });
  const armorHi = new THREE.MeshPhysicalMaterial({ color: P.sand, roughness: 0.3, metalness: 0.48, clearcoat: 0.3, clearcoatRoughness: 0.2, flatShading: true });
  const graphite = new THREE.MeshPhysicalMaterial({ color: P.slate, roughness: 0.68, metalness: 0.68, clearcoat: 0.12, clearcoatRoughness: 0.32, flatShading: true });
  const ink = new THREE.MeshStandardMaterial({ color: P.deep, roughness: 0.9, metalness: 0.15, flatShading: true });
  const copper = new THREE.MeshStandardMaterial({ color: P.copper, roughness: 0.48, metalness: 0.78, flatShading: true });
  const ochre = new THREE.MeshStandardMaterial({ color: P.ochre, roughness: 0.42, metalness: 0.72, flatShading: true });
  const jawCopper = new THREE.MeshPhysicalMaterial({ color: P.ochre, roughness: 0.32, metalness: 0.72, clearcoat: 0.24, clearcoatRoughness: 0.2, flatShading: true });
  const rearPanelGray = new THREE.MeshPhysicalMaterial({ color: P.steel, roughness: 0.58, metalness: 0.52, clearcoat: 0.12, clearcoatRoughness: 0.4, flatShading: true });
  const amber = new THREE.MeshPhysicalMaterial({
    color: P.amber,
    emissive: P.rust,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.12,
    clearcoat: 0.35,
    clearcoatRoughness: 0.2,
  });
  const darkOptic = new THREE.MeshPhysicalMaterial({
    color: P.deep,
    roughness: 0.12,
    metalness: 0.85,
    clearcoat: 0.6,
    clearcoatRoughness: 0.1,
  });
  const berry = new THREE.MeshStandardMaterial({ color: '#7A2838', roughness: 0.72, metalness: 0.05, flatShading: true });
  const decalMaroon = new THREE.MeshStandardMaterial({ color: '#6A202E', roughness: 0.55, metalness: 0.2, flatShading: true });
  const edgeMetal = new THREE.MeshPhysicalMaterial({ color: P.pale, roughness: 0.24, metalness: 0.7, clearcoat: 0.4, clearcoatRoughness: 0.18, flatShading: true });

  const beam = (a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material, radialSegments = 8): THREE.Mesh => {
    const delta = new THREE.Vector3().subVectors(b, a);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.max(0.001, delta.length()), radialSegments), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    return mesh;
  };
  const box = (w: number, h: number, d: number, material: THREE.Material): THREE.Mesh => (
    new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material)
  );
  const joint = (radius: number, material: THREE.Material): THREE.Mesh => (
    new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 8), material)
  );
  const taperedBody = (
    topWidth: number,
    topDepth: number,
    bottomWidth: number,
    bottomDepth: number,
    height: number,
    material: THREE.Material,
  ): THREE.Mesh => {
    const hwTop = topWidth * 0.5;
    const hdTop = topDepth * 0.5;
    const hwBottom = bottomWidth * 0.5;
    const hdBottom = bottomDepth * 0.5;
    const hy = height * 0.5;
    const positions = new Float32Array([
      -hwBottom, -hy, -hdBottom,
      hwBottom, -hy, -hdBottom,
      hwBottom, -hy, hdBottom,
      -hwBottom, -hy, hdBottom,
      -hwTop, hy, -hdTop,
      hwTop, hy, -hdTop,
      hwTop, hy, hdTop,
      -hwTop, hy, hdTop,
    ]);
    const indices = [
      0, 1, 2, 0, 2, 3,
      4, 6, 5, 4, 7, 6,
      0, 4, 5, 0, 5, 1,
      1, 5, 6, 1, 6, 2,
      2, 6, 7, 2, 7, 3,
      4, 0, 3, 4, 3, 7,
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.y = Math.PI / 8;
    return mesh;
  };

  const shell = new THREE.Group();
  shell.name = 'torso-shell';
  shell.position.y = 0.9;
  root.add(shell);
  const body = taperedBody(0.74, 0.5, 0.86, 0.64, 1.82, armor);
  body.position.y = 0.9;
  shell.add(body);
  const shoulderPlate = taperedBody(0.9, 0.58, 1.0, 0.68, 0.18, armorHi);
  shoulderPlate.position.set(0, 1.7, 0);
  shoulderPlate.rotation.z = -0.03;
  shell.add(shoulderPlate);
  const spine = box(0.14, 1.45, 0.055, graphite);
  spine.position.set(0, 0.96, 0.34);
  shell.add(spine);
  // The rear turnaround shows a recessed graphite service door rather than a
  // second front panel. Keep the cream frame proud of the body so it reads in
  // back and three-quarter views without changing the torso action hierarchy.
  const rearService = new THREE.Group();
  rearService.name = 'rear-service-panel';
  shell.add(rearService);
  const rearFrame = box(0.74, 1.28, 0.075, armorHi);
  rearFrame.position.set(0, 1.0, -0.355);
  rearService.add(rearFrame);
  const rearPanel = box(0.61, 1.11, 0.055, rearPanelGray);
  rearPanel.position.set(0, 1.02, -0.402);
  rearService.add(rearPanel);
  const rearInset = box(0.45, 0.64, 0.03, rearPanelGray);
  rearInset.position.set(0, 1.13, -0.442);
  rearService.add(rearInset);
  const rearCore = box(0.32, 0.38, 0.025, graphite);
  rearCore.position.set(0, 1.07, -0.465);
  rearService.add(rearCore);
  for (const x of [-0.315, 0.315]) {
    const rearRail = box(0.065, 1.16, 0.04, armor);
    rearRail.position.set(x, 1.01, -0.456);
    rearService.add(rearRail);
  }
  for (const y of [0.46, 1.56]) {
    const rearRail = box(0.67, 0.065, 0.04, armor);
    rearRail.position.set(0, y, -0.456);
    rearService.add(rearRail);
  }
  for (const x of [-0.25, 0.25]) {
    for (const y of [0.56, 1.47]) {
      const rearBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.04, 8), copper);
      rearBolt.rotation.x = Math.PI / 2;
      rearBolt.position.set(x, y, -0.478);
      rearService.add(rearBolt);
    }
  }
  for (const y of [0.94, 1.06, 1.18]) {
    const rearVent = box(0.25, 0.035, 0.025, ink);
    rearVent.position.set(0, y, -0.47);
    rearService.add(rearVent);
  }
  const rearLatch = box(0.13, 0.09, 0.035, jawCopper);
  rearLatch.position.set(0, 1.38, -0.473);
  rearService.add(rearLatch);
  const rearActuator = new THREE.Group();
  rearActuator.name = 'rear-actuator-stack';
  rearActuator.position.set(0, 0.28, -0.39);
  rearService.add(rearActuator);
  const actuatorHousing = box(0.34, 0.22, 0.13, graphite);
  rearActuator.add(actuatorHousing);
  const actuatorCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.16, 12), copper);
  actuatorCollar.rotation.x = Math.PI / 2;
  actuatorCollar.position.set(0, -0.1, -0.04);
  rearActuator.add(actuatorCollar);
  const actuatorCore = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.27, 12), ink);
  actuatorCore.rotation.x = Math.PI / 2;
  actuatorCore.position.set(0, -0.13, -0.14);
  rearActuator.add(actuatorCore);
  const actuatorFoot = box(0.24, 0.1, 0.14, armorHi);
  actuatorFoot.position.set(0, -0.24, -0.08);
  rearActuator.add(actuatorFoot);
  const frontPanel = box(0.54, 0.7, 0.06, armorHi);
  frontPanel.name = 'front-service-panel';
  frontPanel.position.set(-0.06, 0.96, 0.35);
  frontPanel.rotation.z = -0.04;
  shell.add(frontPanel);
  const neckDecal = box(0.24, 0.08, 0.035, decalMaroon);
  neckDecal.position.set(-0.06, 1.48, 0.37);
  neckDecal.rotation.z = -0.04;
  shell.add(neckDecal);
  const chestInset = box(0.42, 0.58, 0.055, ink);
  chestInset.position.set(-0.06, 1.15, 0.39);
  chestInset.rotation.z = -0.04;
  shell.add(chestInset);
  const signalBarMaterial = new THREE.MeshStandardMaterial({
    color: P.amber,
    emissive: P.rust,
    emissiveIntensity: 0.85,
    roughness: 0.2,
    metalness: 0.1,
  });
  // 3 stacked horizontal amber telemetry bars
  for (const y of [1.32, 1.20, 1.08]) {
    const signalBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.055, 0.035),
      signalBarMaterial,
    );
    signalBar.position.set(-0.06, y, 0.425);
    signalBar.rotation.z = -0.04;
    shell.add(signalBar);
  }
  // 2 circular amber lower telemetry status dots
  for (const x of [-0.14, 0.02]) {
    const dotRing = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12), copper);
    dotRing.position.set(x, 0.94, 0.42);
    shell.add(dotRing);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), signalBarMaterial);
    dot.position.set(x, 0.94, 0.435);
    shell.add(dot);
  }
  for (const x of [-0.39, 0.39]) {
    const edgeStrip = box(0.055, 1.42, 0.065, edgeMetal);
    edgeStrip.position.set(x, 0.98, 0.34);
    shell.add(edgeStrip);
    const sideCavity = box(0.045, 0.92, 0.34, graphite);
    sideCavity.position.set(x * 1.07, 1.0, -0.02);
    shell.add(sideCavity);
    const sidePlate = box(0.055, 0.68, 0.28, armorHi);
    sidePlate.position.set(x * 1.13, 1.03, 0);
    sidePlate.rotation.z = x < 0 ? -0.06 : 0.06;
    shell.add(sidePlate);
  }
  for (const x of [-0.38, 0.38]) {
    const sideRail = box(0.07, 1.3, 0.06, graphite);
    sideRail.position.set(x * 0.92, 0.98, 0.35);
    shell.add(sideRail);
    const sideRivet = joint(0.042, ochre);
    sideRivet.position.set(x * 0.92, 1.57, 0.39);
    shell.add(sideRivet);
  }
  for (const y of [0.58, 0.86, 1.14]) {
    const seam = box(0.42, 0.025, 0.018, ink);
    seam.position.set(-0.06, y, 0.39);
    shell.add(seam);
  }
  const lowerPanel = box(0.62, 0.2, 0.08, graphite);
  lowerPanel.position.set(0, 0.28, 0.35);
  shell.add(lowerPanel);
  const lowerOpticMaterial = new THREE.MeshStandardMaterial({
    color: P.amber,
    emissive: P.rust,
    emissiveIntensity: 0.9,
    roughness: 0.18,
    metalness: 0.12,
  });
  for (const x of [-0.14, 0.14]) {
    const lowerOpticRing = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 6, 12), copper);
    lowerOpticRing.position.set(x, 0.43, 0.415);
    shell.add(lowerOpticRing);
    const lowerOptic = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), lowerOpticMaterial);
    lowerOptic.position.set(x, 0.43, 0.45);
    shell.add(lowerOptic);
  }
  const statusLights: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  for (const x of [-0.22, -0.08, 0.06, 0.2]) {
    const light = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.055, 0.025),
      new THREE.MeshStandardMaterial({ color: P.amber, emissive: P.rust, emissiveIntensity: 0.55, roughness: 0.22, metalness: 0.1 }),
    );
    light.position.set(x, 0.31, 0.4);
    shell.add(light);
    statusLights.push(light);
  }
  const fasteners = new THREE.Group();
  fasteners.name = 'armor-fasteners';
  shell.add(fasteners);
  for (const x of [-0.42, 0.42]) {
    const rivet = joint(0.045, ochre);
    rivet.position.set(x, 0.4, 0.38);
    fasteners.add(rivet);
  }
  shell.scale.y = 1.05;
  const hip = new THREE.Group();
  hip.name = 'hip-hub';
  hip.position.y = 0.88;
  root.add(hip);
  const hipDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.47, 0.26, 12), graphite);
  hip.add(hipDisc);
  const waistArmor = taperedBody(0.88, 0.48, 1.04, 0.58, 0.26, armorHi);
  waistArmor.rotation.y = 0;
  waistArmor.position.y = 0.08;
  hip.add(waistArmor);
  const waistInset = box(0.64, 0.15, 0.05, graphite);
  waistInset.position.set(0, 0.06, 0.3);
  hip.add(waistInset);
  const hipRing = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.045, 6, 14), copper);
  hipRing.rotation.x = Math.PI / 2;
  hip.add(hipRing);
  for (const x of [-0.46, 0.46]) {
    const shoulderHub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.11, 10), graphite);
    shoulderHub.rotation.z = Math.PI / 2;
    shoulderHub.position.set(x, 1.46, 0.02);
    root.add(shoulderHub);
    const shoulderCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.12, 10), copper);
    shoulderCap.rotation.z = Math.PI / 2;
    shoulderCap.position.set(x + (x < 0 ? -0.01 : 0.01), 1.46, 0.09);
    root.add(shoulderCap);
  }

  const tripod = new THREE.Group();
  tripod.name = 'tripod-legs';
  root.add(tripod);
  const upperLinks = new THREE.Group();
  upperLinks.name = 'leg-upper-links';
  tripod.add(upperLinks);
  const lowerLinks = new THREE.Group();
  lowerLinks.name = 'leg-lower-links';
  tripod.add(lowerLinks);
  const jointCollars = new THREE.Group();
  jointCollars.name = 'leg-joint-collars';
  tripod.add(jointCollars);
  const footPads = new THREE.Group();
  footPads.name = 'foot-pads';
  tripod.add(footPads);
  const legSpecs = [
    { name: 'leg-front', hip: new THREE.Vector3(0, 0.84, 0.24), knee: new THREE.Vector3(0, 0.39, 0.62), foot: new THREE.Vector3(0, 0.03, 0.92) },
    { name: 'leg-left', hip: new THREE.Vector3(-0.28, 0.84, -0.02), knee: new THREE.Vector3(-0.52, 0.39, 0.22), foot: new THREE.Vector3(-0.84, 0.03, 0.4) },
    { name: 'leg-right', hip: new THREE.Vector3(0.28, 0.84, -0.02), knee: new THREE.Vector3(0.52, 0.39, 0.22), foot: new THREE.Vector3(0.84, 0.03, 0.4) },
  ];
  const legs: ProceduralWorkerRig['legs'] = [];
  for (const spec of legSpecs) {
    const legRoot = new THREE.Group();
    legRoot.name = spec.name;
    tripod.add(legRoot);
    const upper = new THREE.Group();
    upper.name = spec.name + '-upper';
    upper.position.copy(spec.hip);
    legRoot.add(upper);
    const upperDelta = new THREE.Vector3().subVectors(spec.knee, spec.hip);
    upper.add(beam(new THREE.Vector3(), upperDelta, 0.145, graphite));
    upper.add(beam(upperDelta.clone().multiplyScalar(0.12), upperDelta.clone().multiplyScalar(0.48), 0.115, armorHi));
    upper.add(beam(upperDelta.clone().multiplyScalar(0.58), upperDelta.clone().multiplyScalar(0.82), 0.105, armor));
    const upperPlate = box(0.3, Math.max(0.16, upperDelta.length() * 0.45), 0.22, armor);
    upperPlate.position.copy(upperDelta).multiplyScalar(0.42);
    upperPlate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), upperDelta.clone().normalize());
    upper.add(upperPlate);
    upper.add(joint(0.15, graphite));
    const knee = joint(0.185, graphite);
    knee.position.copy(upperDelta);
    upper.add(knee);
    const kneeAxis = new THREE.Vector3(-upperDelta.z, 0, upperDelta.x).normalize();
    const kneeCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.14, 18), ochre);
    kneeCollar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kneeAxis);
    kneeCollar.position.copy(upperDelta);
    upper.add(kneeCollar);
    const kneeCap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.155, 16), copper);
    kneeCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kneeAxis);
    kneeCap.position.copy(upperDelta);
    upper.add(kneeCap);
    const kneeBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.17, 12), graphite);
    kneeBolt.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), kneeAxis);
    kneeBolt.position.copy(upperDelta);
    upper.add(kneeBolt);

    const lower = new THREE.Group();
    lower.name = spec.name + '-lower';
    lower.position.copy(spec.knee);
    legRoot.add(lower);
    const lowerDelta = new THREE.Vector3().subVectors(spec.foot, spec.knee);
    lower.add(beam(new THREE.Vector3(), lowerDelta, 0.14, graphite));
    lower.add(beam(lowerDelta.clone().multiplyScalar(0.13), lowerDelta.clone().multiplyScalar(0.48), 0.105, armorHi));
    lower.add(beam(lowerDelta.clone().multiplyScalar(0.58), lowerDelta.clone().multiplyScalar(0.84), 0.098, armor));
    const pistonOffset = new THREE.Vector3(spec.foot.x < 0 ? -0.07 : 0.07, 0, 0.06);
    lower.add(beam(pistonOffset, lowerDelta.clone().add(pistonOffset), 0.032, copper, 8));
    lower.add(joint(0.13, graphite));
    const ankle = joint(0.13, graphite);
    ankle.position.copy(lowerDelta);
    lower.add(ankle);
    const shinPlate = box(0.28, Math.max(0.16, lowerDelta.length() * 0.48), 0.22, armor);
    shinPlate.position.copy(lowerDelta).multiplyScalar(0.42);
    shinPlate.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lowerDelta.clone().normalize());
    lower.add(shinPlate);
    const shinRidge = box(0.12, Math.max(0.14, lowerDelta.length() * 0.44), 0.25, armorHi);
    shinRidge.position.copy(lowerDelta).multiplyScalar(0.42);
    shinRidge.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), lowerDelta.clone().normalize());
    lower.add(shinRidge);
    const ankleAxis = new THREE.Vector3(-lowerDelta.z, 0, lowerDelta.x).normalize();
    const ankleCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 16), ochre);
    ankleCollar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ankleAxis);
    ankleCollar.position.copy(lowerDelta);
    lower.add(ankleCollar);
    const ankleCap = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.135, 14), copper);
    ankleCap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ankleAxis);
    ankleCap.position.copy(lowerDelta);
    lower.add(ankleCap);

    const foot = new THREE.Group();
    foot.name = spec.name + '-foot';
    foot.position.copy(spec.foot).sub(spec.knee);
    foot.rotation.y = Math.atan2(lowerDelta.x, lowerDelta.z);
    lower.add(foot);
    const pad = box(0.36, 0.14, 0.32, ink);
    pad.position.y = -0.04;
    foot.add(pad);
    const padTop = box(0.28, 0.055, 0.24, edgeMetal);
    padTop.position.y = 0.03;
    foot.add(padTop);
    // 4 rectangular rubber/grip toe pads on foot perimeter
    for (const x of [-0.11, 0.11]) {
      for (const z of [0.08, -0.08]) {
        const toePad = box(0.09, 0.06, 0.09, ochre);
        toePad.position.set(x, 0.045, z + 0.06);
        foot.add(toePad);
      }
    }
    const heel = box(0.2, 0.075, 0.11, armorHi);
    heel.position.set(0, 0.015, -0.105);
    foot.add(heel);
    legs.push({ root: legRoot, upper, lower, foot, restFootY: spec.foot.y - spec.knee.y });
  }

  const sensorMast = new THREE.Group();
  sensorMast.name = 'sensor-mast';
  root.add(sensorMast);
  sensorMast.position.set(0, 2.47, 0);
  sensorMast.add(beam(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.72, 0), 0.055, graphite));
  sensorMast.add(beam(new THREE.Vector3(0, 0.02, 0.03), new THREE.Vector3(0, 0.7, 0.03), 0.028, copper));
  const mastGimbal = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.18, 14), graphite);
  mastGimbal.position.y = 0.63;
  sensorMast.add(mastGimbal);
  const mastCollar = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.035, 6, 14), copper);
  mastCollar.rotation.x = Math.PI / 2;
  mastCollar.position.y = 0.56;
  sensorMast.add(mastCollar);
  const sensorHead = new THREE.Group();
  sensorHead.name = 'sensor-head';
  sensorHead.position.set(0, 0.74, 0);
  sensorMast.add(sensorHead);
  const sensorHousing = box(0.92, 0.28, 0.32, graphite);
  sensorHousing.position.y = 0.03;
  sensorHead.add(sensorHousing);
  sensorHousing.visible = false;
  const sensorPod = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.86, 18), armorHi);
  sensorPod.rotation.z = Math.PI / 2;
  sensorPod.position.set(0, 0.04, 0.02);
  sensorHead.add(sensorPod);
  for (const x of [-0.43, 0.43]) {
    const endCap = new THREE.Mesh(new THREE.CylinderGeometry(0.225, 0.225, 0.07, 18), graphite);
    endCap.rotation.z = Math.PI / 2;
    endCap.position.set(x, 0.04, 0.02);
    sensorHead.add(endCap);
    const endRing = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.025, 6, 16), copper);
    endRing.rotation.y = Math.PI / 2;
    endRing.position.set(x + (x < 0 ? -0.025 : 0.025), 0.04, 0.02);
    sensorHead.add(endRing);
  }
  const podBand = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.028, 6, 14), graphite);
  podBand.rotation.y = Math.PI / 2;
  podBand.position.set(0, 0.04, 0.02);
  sensorHead.add(podBand);
  const sensorTop = box(0.78, 0.07, 0.38, armorHi);
  sensorTop.position.set(0, 0.19, 0);
  sensorHead.add(sensorTop);
  // Head decal (maroon stripe on right flank)
  const headDecal = box(0.12, 0.16, 0.36, decalMaroon);
  headDecal.position.set(0.32, 0.04, 0.02);
  sensorHead.add(headDecal);

  // 2 primary outer amber lenses
  for (const x of [-0.28, 0.28]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.028, 6, 14), copper);
    ring.position.set(x, 0.03, 0.2);
    sensorHead.add(ring);
    const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.035, 12), ink);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(x, 0.03, 0.215);
    sensorHead.add(lens);
    const optic = new THREE.Mesh(new THREE.SphereGeometry(0.072, 14, 10), amber);
    optic.position.set(x, 0.03, 0.245);
    sensorHead.add(optic);
  }
  // 1 central recessed sensor aperture (dark optic with brass bezel)
  const centerRing = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.018, 6, 12), ochre);
  centerRing.position.set(0, 0.03, 0.21);
  sensorHead.add(centerRing);
  const centerOptic = new THREE.Mesh(new THREE.SphereGeometry(0.048, 12, 8), darkOptic);
  centerOptic.position.set(0, 0.03, 0.22);
  sensorHead.add(centerOptic);

  // Stepped, thicker brass antenna with collar
  const antennaBase = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.08, 10), copper);
  antennaBase.position.set(0.28, 0.23, 0);
  sensorHead.add(antennaBase);
  const antennaPin = beam(new THREE.Vector3(0.28, 0.27, 0), new THREE.Vector3(0.28, 0.54, 0), 0.025, ochre);
  antennaPin.name = 'antenna-pin';
  sensorHead.add(antennaPin);
  const antennaTip = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), copper);
  antennaTip.position.set(0.28, 0.54, 0);
  sensorHead.add(antennaTip);

  // The reel sits vertically on the worker's left flank: its circular face is
  // upright and its axle runs across X into the torso, as in the approved art.
  const spool = new THREE.Group();
  spool.name = 'side-spool';
  spool.position.set(0.76, 1.85, 0.08);
  root.add(spool);
  const spoolRotor = new THREE.Group();
  spoolRotor.name = 'side-spool-rotor';
  spool.add(spoolRotor);
  // Drum core (inner barrel the cable is wrapped around)
  const spoolCore = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.44, 24), ink);
  spoolCore.rotation.z = Math.PI / 2;
  spoolRotor.add(spoolCore);
  const spoolFlanges = new THREE.Group();
  spoolFlanges.name = 'spool-flanges';
  spoolRotor.add(spoolFlanges);
  for (const x of [-0.22, 0.22]) {
    const flange = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.045, 8, 24), ochre);
    flange.rotation.y = Math.PI / 2;
    flange.position.x = x;
    spoolFlanges.add(flange);
    const flangeDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.03, 24), graphite);
    flangeDisc.rotation.z = Math.PI / 2;
    flangeDisc.position.x = x;
    spoolFlanges.add(flangeDisc);
  }
  // Continuous 3D helical cable winding and trailing tether
  // Layer 1 (inner layer) + Layer 2 (outer visible layer with prominent helical pitch)
  const cablePoints: THREE.Vector3[] = [];
  
  // Layer 1 (inner): 6 turns winding from inside-left to right
  const l1Turns = 6.0;
  const l1Segs = 80;
  for (let i = 0; i < l1Segs; i++) {
    const t = i / l1Segs;
    const x = -0.17 + 0.34 * t;
    const ang = t * l1Turns * Math.PI * 2;
    const r = 0.285;
    cablePoints.push(new THREE.Vector3(x, Math.cos(ang) * r, Math.sin(ang) * r));
  }

  // Layer 2 (outer): 7.25 turns winding back from right to left with visible pitch & cable thickness
  const l2Turns = 7.25;
  const l2Segs = 120;
  const startAng = l1Turns * Math.PI * 2;
  for (let i = 0; i <= l2Segs; i++) {
    const t = i / l2Segs;
    const x = 0.17 - 0.34 * t;
    const ang = startAng + t * l2Turns * Math.PI * 2;
    // Radial height so outer layer completely sits on top and shows individual cable rounds
    const r = 0.355 + Math.sin(t * Math.PI * 7) * 0.006;
    cablePoints.push(new THREE.Vector3(x, Math.cos(ang) * r, Math.sin(ang) * r));
  }

  const completeCableCurve = new THREE.CatmullRomCurve3(cablePoints);
  const cableMesh = new THREE.Mesh(
    new THREE.TubeGeometry(completeCableCurve, 200, 0.044, 10, false),
    berry,
  );
  spoolRotor.add(cableMesh);

  // Dynamic trailing tether attached to static spool mount at peel-off point (-0.17, -0.355, 0)
  // Hangs like catenary cable and settles naturally toward ground behind the unit
  const tetherCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.17, -0.355, 0.02),
    new THREE.Vector3(-0.14, -0.65, -0.22),
    new THREE.Vector3(-0.06, -1.05, -0.48),
    new THREE.Vector3(-0.02, -1.45, -0.72),
    new THREE.Vector3(0.04, -1.78, -0.92),
  ]);
  const spoolTether = new THREE.Mesh(
    new THREE.TubeGeometry(tetherCurve, 32, 0.042, 8, false),
    berry,
  );
  spoolTether.name = 'side-spool-tether';
  spool.add(spoolTether);
  const spoolRim = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.025, 8, 20), copper);
  spoolRim.rotation.y = Math.PI / 2;
  spoolRim.position.x = 0.235;
  spoolRotor.add(spoolRim);
  const spoolHub = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.54, 18), graphite);
  spoolHub.rotation.z = Math.PI / 2;
  spoolRotor.add(spoolHub);
  const spoolCap = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.07, 18), amber);
  spoolCap.rotation.z = Math.PI / 2;
  spoolCap.position.x = 0.31;
  spoolRotor.add(spoolCap);
  const spoolCenter = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.055, 14), ink);
  spoolCenter.rotation.z = Math.PI / 2;
  spoolCenter.position.x = 0.35;
  spoolRotor.add(spoolCenter);
  // The reel is mounted on a stepped yoke. Its outer face sits at +X, while
  // this layered bracket reaches back into the torso and remains static when
  // the rotor turns during gather/build actions.
  const spoolMount = new THREE.Group();
  spoolMount.name = 'side-spool-mount';
  spool.add(spoolMount);
  const mountBlock = box(0.2, 0.25, 0.28, graphite);
  mountBlock.position.set(-0.32, 0, 0);
  spoolMount.add(mountBlock);
  const mountArmor = box(0.13, 0.44, 0.38, armorHi);
  mountArmor.position.set(-0.43, -0.02, -0.02);
  spoolMount.add(mountArmor);
  const mountBackplate = box(0.08, 0.56, 0.44, graphite);
  mountBackplate.position.set(-0.5, -0.04, -0.03);
  spoolMount.add(mountBackplate);
  for (const y of [-0.17, 0.17]) {
    const mountFastener = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 10), copper);
    mountFastener.rotation.z = Math.PI / 2;
    mountFastener.position.set(-0.555, y, 0.17);
    spoolMount.add(mountFastener);
  }
  const spoolAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.34, 12), amber);
  spoolAxle.rotation.z = Math.PI / 2;
  spoolAxle.position.x = -0.28;
  spool.add(spoolAxle);
  const outerFace = new THREE.Mesh(new THREE.CylinderGeometry(0.335, 0.335, 0.045, 24), graphite);
  outerFace.rotation.z = Math.PI / 2;
  outerFace.position.x = 0.335;
  spoolRotor.add(outerFace);
  const outerRim = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.028, 8, 24), copper);
  outerRim.rotation.y = Math.PI / 2;
  outerRim.position.x = 0.365;
  spoolRotor.add(outerRim);
  const faceHub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.085, 18), copper);
  faceHub.rotation.z = Math.PI / 2;
  faceHub.position.x = 0.385;
  spoolRotor.add(faceHub);
  const faceHubInset = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.095, 16), ink);
  faceHubInset.rotation.z = Math.PI / 2;
  faceHubInset.position.x = 0.415;
  spoolRotor.add(faceHubInset);
  for (let index = 0; index < 6; index++) {
    const angle = (index / 6) * Math.PI * 2;
    const faceBolt = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.04, 8), copper);
    faceBolt.rotation.z = Math.PI / 2;
    faceBolt.position.set(0.39, Math.cos(angle) * 0.245, Math.sin(angle) * 0.245);
    spoolRotor.add(faceBolt);
  }

  const manipulator = new THREE.Group();
  manipulator.name = 'manipulator';
  // The articulated clamp lives on the worker's right side, opposite the reel.
  manipulator.position.set(-0.58, 1.52, 0.46);
  root.add(manipulator);
  const shoulder = new THREE.Group();
  shoulder.name = 'shoulder';
  manipulator.add(shoulder);
  shoulder.add(joint(0.14, graphite));
  shoulder.add(beam(new THREE.Vector3(), new THREE.Vector3(-0.22, -0.34, 0.04), 0.095, graphite));
  // Cream armor cowl over the upper arm
  const armArmor = box(0.22, 0.36, 0.22, armorHi);
  armArmor.position.set(-0.11, -0.17, 0.02);
  armArmor.rotation.z = Math.atan2(-0.34, -0.22) + Math.PI / 2;
  shoulder.add(armArmor);
  const elbow = new THREE.Group();
  elbow.name = 'elbow';
  elbow.position.set(-0.22, -0.34, 0.04);
  shoulder.add(elbow);
  elbow.add(joint(0.1, graphite));
  elbow.add(beam(new THREE.Vector3(), new THREE.Vector3(-0.28, -0.24, 0.04), 0.08, copper));
  const wrist = new THREE.Group();
  wrist.name = 'wrist';
  wrist.position.set(-0.28, -0.24, 0.04);
  elbow.add(wrist);
  wrist.add(new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.025, 6, 12), ochre));
  for (const name of ['food-grab', 'crystal-clamp', 'build-welder']) {
    const socket = new THREE.Object3D();
    socket.name = name;
    socket.position.set(-0.16, -0.08, 0);
    wrist.add(socket);
  }

  const makeTool = (name: string): THREE.Group => {
    const tool = new THREE.Group();
    tool.name = name;
    tool.position.set(-0.07, -0.06, 0);
    wrist.add(tool);
    return tool;
  };
  const forkTool = makeTool('tool-clamp');
  forkTool.name = 'manipulator-fork';
  const clampBase = box(0.24, 0.24, 0.32, graphite);
  clampBase.position.set(-0.06, -0.02, 0);
  forkTool.add(clampBase);
  const clampCollar = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 14), copper);
  clampCollar.rotation.x = Math.PI / 2;
  clampCollar.position.set(-0.1, -0.02, 0);
  forkTool.add(clampCollar);

  // Solid, blunt cast-bronze/copper U-shaped fork fingers (1:1 with reference)
  for (const side of [-1, 1]) {
    const jaw = new THREE.Group();
    jaw.name = side < 0 ? 'clamp-jaw-left' : 'clamp-jaw-right';
    jaw.position.set(-0.12, side * 0.15, 0);
    jaw.rotation.z = side * 0.05;
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.22, 12), copper);
    hinge.rotation.x = Math.PI / 2;
    jaw.add(hinge);
    // Heavy bronze prong base
    const prongBase = box(0.32, 0.13, 0.18, jawCopper);
    prongBase.position.set(-0.16, side * 0.02, 0);
    jaw.add(prongBase);
    // Solid bronze curved prong tip
    const prongTip = box(0.24, 0.14, 0.18, ochre);
    prongTip.position.set(-0.40, side * 0.05, 0);
    prongTip.rotation.z = -side * 0.16;
    jaw.add(prongTip);
    // Dark rubberized grip pad on inner jaw face
    const gripPad = box(0.22, 0.045, 0.14, ink);
    gripPad.position.set(-0.28, -side * 0.055, 0);
    jaw.add(gripPad);
    forkTool.add(jaw);
  }
  const foodTool = makeTool('tool-food');
  const scoop = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.18, 4, 8), armorHi);
  scoop.rotation.z = -Math.PI / 2;
  foodTool.add(scoop);
  const crystalTool = makeTool('tool-crystal');
  crystalTool.add(beam(new THREE.Vector3(), new THREE.Vector3(-0.25, -0.02, 0), 0.045, copper));
  crystalTool.add(joint(0.09, amber));
  const crystalGrip = new THREE.Mesh(new THREE.OctahedronGeometry(0.095, 0), new THREE.MeshStandardMaterial({ color: P.berry, emissive: P.rust, emissiveIntensity: 0.35, roughness: 0.34, metalness: 0.12 }));
  crystalGrip.position.set(-0.25, -0.02, 0.025);
  crystalTool.add(crystalGrip);
  const buildTool = makeTool('tool-build');
  buildTool.add(beam(new THREE.Vector3(), new THREE.Vector3(-0.2, -0.02, 0), 0.05, copper));
  const weldTip = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), amber);
  weldTip.position.x = -0.22;
  buildTool.add(weldTip);
  const actionFxMaterial = new THREE.MeshBasicMaterial({ color: P.amber, transparent: true, opacity: 0.9 });
  const gatherFx = new THREE.Group();
  gatherFx.name = 'fx-gather-target';
  const gatherRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.028, 6, 14), actionFxMaterial);
  gatherRing.rotation.x = Math.PI / 2;
  gatherRing.position.set(-0.48, -0.1, 0);
  gatherFx.add(gatherRing);
  const gatherCore = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshBasicMaterial({ color: P.lime }));
  gatherCore.scale.setScalar(1.35);
  gatherCore.position.set(-0.48, -0.1, 0);
  gatherFx.add(gatherCore);
  const gatherNode = new THREE.Mesh(new THREE.OctahedronGeometry(0.105, 0), new THREE.MeshBasicMaterial({ color: P.lime, transparent: true, opacity: 0.9 }));
  gatherNode.position.set(-0.48, -0.1, 0.025);
  gatherFx.add(gatherNode);
  const gatherHalo = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.014, 6, 16), new THREE.MeshBasicMaterial({ color: P.lime, transparent: true, opacity: 0.45 }));
  gatherHalo.rotation.x = Math.PI / 2;
  gatherHalo.position.set(-0.48, -0.1, 0);
  gatherFx.add(gatherHalo);
  wrist.add(gatherFx);
  const attackFx = new THREE.Group();
  attackFx.name = 'fx-attack-pulse';
  const attackPulse = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: P.amber, transparent: true, opacity: 0.92 }));
  attackPulse.position.set(-0.78, -0.08, 0);
  attackFx.add(attackPulse);
  const attackRing = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.024, 6, 14), actionFxMaterial);
  attackRing.rotation.x = Math.PI / 2;
  attackRing.position.set(-0.78, -0.08, 0);
  attackFx.add(attackRing);
  const attackRay = beam(new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(-0.74, -0.07, 0), 0.032, amber, 6);
  attackRay.position.set(-0.18, 0, 0);
  attackFx.add(attackRay);
  wrist.add(attackFx);
  const buildFx = new THREE.Group();
  buildFx.name = 'fx-build-weld';
  const weldRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.026, 6, 14), new THREE.MeshBasicMaterial({ color: P.ice, transparent: true, opacity: 0.95 }));
  weldRing.rotation.x = Math.PI / 2;
  weldRing.position.set(-0.62, -0.08, 0);
  buildFx.add(weldRing);
  const weldCore = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: P.amber }));
  weldCore.scale.setScalar(1.4);
  weldCore.position.set(-0.62, -0.08, 0);
  buildFx.add(weldCore);
  const blueprint = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.42, 0.42, 0.42)),
    new THREE.LineBasicMaterial({ color: P.ice, transparent: true, opacity: 0.72 }),
  );
  blueprint.position.set(-0.62, 0.15, 0.02);
  blueprint.rotation.set(0.18, 0.3, 0.08);
  buildFx.add(blueprint);
  wrist.add(buildFx);
  foodTool.visible = false;
  crystalTool.visible = false;
  buildTool.visible = false;
  gatherFx.visible = false;
  attackFx.visible = false;
  buildFx.visible = false;

  root.scale.setScalar(0.84);
  // Present the front and reel side together in the fixed isometric camera.
  root.rotation.y = ISO_YAW - 0.38;
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });
  root.userData.workerRig = {
    legs,
    sensorMast,
    sensorHead,
    spool: spoolRotor,
    spoolRotor,
    spoolTether,
    manipulator,
    shoulder,
    elbow,
    wrist,
    tools: { fork: forkTool, food: foodTool, crystal: crystalTool, build: buildTool },
    actionFx: { gather: gatherFx, attack: attackFx, build: buildFx },
    statusLights,
  } satisfies ProceduralWorkerRig;
  root.userData.sculptRuntime = {
    sourceSpec: 'helion-worker-b-spec.json',
    parts: [
      'torso-shell',
      'hip-hub',
      'tripod-legs',
      'sensor-mast',
      'sensor-head',
      'side-spool',
      'manipulator',
      'manipulator-fork',
    ],
    sockets: ['food-grab', 'crystal-clamp', 'build-welder'],
    colliders: [
      { id: 'body-collider', shape: 'box', node: 'torso-shell' },
      { id: 'hip-collider', shape: 'cylinder', node: 'hip-hub' },
      { id: 'leg-colliders', shape: 'capsule', node: 'tripod-legs' },
    ],
    destructionGroups: ['torso-shell', 'side-spool', 'manipulator', 'tripod-legs'],
    actions: ['walk', 'harvest-food', 'harvest-crystal', 'attack', 'build'],
    inferred: ['rear armor', 'underside hip'],
  };
  return root;
}

// ── Worker animation v2 (shared logic with worker-viewer.html) ─────────
// Pose-blended rig: damp() chases mode targets so order switches never
// pop; tripod duty-cycle gait; phased wind-up→strike→recover actions.
const WORKER_GAIT = {
  strideHz: 1.15,
  strideAmp: 0.3,
  kneeAmp: 0.2,
  footLiftY: 0.13,
  bodyBobAmp: 0.03,
  bodyPitchAmp: 0.028,
  swingFrac: 0.42,
};

const WORKER_ACTIONS: Record<string, {
  period: number;
  shoulder: [number, number, number];
  elbow: [number, number, number];
  wrist: [number, number, number];
  spoolSpin: number;
}> = {
  gather: {
    period: 2.2,
    shoulder: [-0.3, -0.84, -0.36],
    elbow: [0.55, 0.98, 0.64],
    wrist: [-0.3, -0.66, -0.38],
    spoolSpin: 1.7,
  },
  build: {
    period: 1.9,
    shoulder: [-0.18, -0.72, -0.24],
    elbow: [0.85, 1.24, 0.96],
    wrist: [0.3, 0.56, 0.4],
    spoolSpin: 2.3,
  },
  attack: {
    period: 1.5,
    shoulder: [0.7, -0.26, 0.38],
    elbow: [-0.4, -0.76, -0.52],
    wrist: [-0.28, -0.7, -0.42],
    spoolSpin: 0,
  },
};

interface WorkerPose {
  legs: { hip: number; knee: number; lift: number }[];
  bodyBob: number;
  bodyPitch: number;
  bodyRoll: number;
  shoulder: number;
  elbow: number;
  wrist: number;
  headYaw: number;
  headPitch: number;
  mastLean: number;
  gaitPhase: number;
  spoolSpin: number;
}

const workerPoses = new Map<number, WorkerPose>();

function damp(current: number, target: number, smoothing: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-smoothing * dt));
}
function lerpAngle(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
function easeOutCubicW(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOutCubicW(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function getWorkerPose(id: number): WorkerPose {
  let p = workerPoses.get(id);
  if (!p) {
    p = {
      legs: [
        { hip: 0, knee: 0, lift: 0 },
        { hip: 0, knee: 0, lift: 0 },
        { hip: 0, knee: 0, lift: 0 },
      ],
      bodyBob: 0, bodyPitch: 0, bodyRoll: 0,
      shoulder: 0, elbow: 0, wrist: 0,
      headYaw: 0, headPitch: 0, mastLean: 0,
      gaitPhase: 0, spoolSpin: 0,
    };
    workerPoses.set(id, p);
  }
  return p;
}

function updateProceduralWorkerMesh(root: THREE.Group, e: Ent, dt: number): void {
  const rig = root.userData.workerRig as ProceduralWorkerRig;
  const pose = getWorkerPose(e.id);
  const moving = Math.abs(e.vx) + Math.abs(e.vz) > 0.08 || e.order === Ord.Move || e.order === Ord.AttackMove;
  const gather = e.order === Ord.Gather || e.order === Ord.Return;
  const build = e.order === Ord.Build;
  const attack = e.order === Ord.Attack || e.order === Ord.AttackMove;
  const busy = gather || build || attack;
  const orderName = gather ? 'gather' : build ? 'build' : attack ? 'attack' : 'idle';

  // ── Gait phase ──────────────────────────────────────────────────────
  pose.gaitPhase += dt * WORKER_GAIT.strideHz * (moving ? 1 : 0) * Math.PI * 2;
  const phase = pose.gaitPhase;

  // ── Legs: tripod duty-cycle gait ────────────────────────────────────
  for (let index = 0; index < 3; index++) {
    const lp = pose.legs[index];
    const legPhase = phase + (index * Math.PI * 2) / 3;
    const swingT = ((legPhase / (Math.PI * 2)) % 1 + 1) % 1;
    if (moving) {
      if (swingT < WORKER_GAIT.swingFrac) {
        const s = swingT / WORKER_GAIT.swingFrac;
        const arc = Math.sin(s * Math.PI);
        lp.hip = lerpAngle(0.5, -0.5, s) * WORKER_GAIT.strideAmp;
        lp.knee = arc * WORKER_GAIT.kneeAmp;
        lp.lift = arc * WORKER_GAIT.footLiftY;
      } else {
        const st = (swingT - WORKER_GAIT.swingFrac) / (1 - WORKER_GAIT.swingFrac);
        lp.hip = lerpAngle(-0.5, 0.5, st) * WORKER_GAIT.strideAmp;
        lp.knee = lerpAngle(WORKER_GAIT.kneeAmp * 0.18, 0, st);
        lp.lift = 0;
      }
    } else {
      lp.hip = damp(lp.hip, 0, 6, dt);
      lp.knee = damp(lp.knee, 0, 6, dt);
      lp.lift = damp(lp.lift, 0, 6, dt);
    }
  }

  // ── Body dynamics ───────────────────────────────────────────────────
  const bobTarget = moving
    ? Math.sin(phase * 2) * WORKER_GAIT.bodyBobAmp
    : Math.sin(e.anim * 1.6) * 0.012;
  pose.bodyBob = damp(pose.bodyBob, bobTarget, 10, dt);
  pose.bodyPitch = damp(pose.bodyPitch, moving ? WORKER_GAIT.bodyPitchAmp : 0, 4, dt);
  const rollTarget = moving ? Math.sin(phase) * 0.018 : Math.sin(e.anim * 0.7 + 1.3) * 0.008;
  pose.bodyRoll = damp(pose.bodyRoll, rollTarget, 6, dt);

  // ── Manipulator: phased action or idle micro-motion ─────────────────
  let shT = 0, elT = 0, wrT = 0, spinRate = 0;
  if (busy) {
    const A = WORKER_ACTIONS[orderName];
    const cyc = (e.anim % A.period) / A.period;
    if (cyc < 0.35) {
      const t = easeInOutCubicW(cyc / 0.35);
      shT = lerpAngle(0, A.shoulder[0], t);
      elT = lerpAngle(0, A.elbow[0], t);
      wrT = lerpAngle(0, A.wrist[0], t);
    } else if (cyc < 0.5) {
      const t = easeOutCubicW((cyc - 0.35) / 0.15);
      shT = lerpAngle(A.shoulder[0], A.shoulder[1], t);
      elT = lerpAngle(A.elbow[0], A.elbow[1], t);
      wrT = lerpAngle(A.wrist[0], A.wrist[1], t);
    } else {
      const t = easeInOutCubicW((cyc - 0.5) / 0.5);
      shT = lerpAngle(A.shoulder[1], A.shoulder[2], t);
      elT = lerpAngle(A.elbow[1], A.elbow[2], t);
      wrT = lerpAngle(A.wrist[1], A.wrist[2], t);
    }
    spinRate = A.spoolSpin;
  } else {
    shT = Math.sin(e.anim * 0.8) * 0.02;
    elT = 0.05 + Math.sin(e.anim * 0.6 + 1) * 0.02;
    wrT = Math.sin(e.anim * 0.5) * 0.015;
  }
  pose.shoulder = damp(pose.shoulder, shT, busy ? 14 : 8, dt);
  pose.elbow = damp(pose.elbow, elT, busy ? 14 : 8, dt);
  pose.wrist = damp(pose.wrist, wrT, busy ? 14 : 8, dt);
  rig.shoulder.rotation.z = pose.shoulder;
  rig.elbow.rotation.z = pose.elbow;
  rig.wrist.rotation.z = pose.wrist;

  // ── Spool: integrate; ease to flat when idle ────────────────────────
  if (spinRate > 0) {
    pose.spoolSpin += dt * spinRate;
  } else {
    const flat = Math.round(pose.spoolSpin / (Math.PI * 2)) * Math.PI * 2;
    pose.spoolSpin = damp(pose.spoolSpin, flat, 3, dt);
  }
  // Spin only the reel rotor around its X-axis; its mount and trailing tether stay naturally grounded.
  rig.spool.rotation.x = pose.spoolSpin;
  if (rig.spoolTether) {
    // Subtle physical sway/sag reacting to movement and harvesting vibration
    const tetherSway = moving ? Math.sin(phase * 2) * 0.04 : Math.sin(e.anim * 1.8) * 0.015;
    const tetherVibe = busy ? Math.sin(e.anim * 12) * 0.02 : 0;
    rig.spoolTether.rotation.z = tetherSway;
    rig.spoolTether.rotation.x = tetherVibe;
  }

  // ── Sensor head ─────────────────────────────────────────────────────
  const headYawT = moving
    ? Math.sin(e.anim * 0.9) * 0.1
    : busy ? Math.sin(e.anim * 0.7) * 0.22 : Math.sin(e.anim * 0.42) * 0.3;
  pose.headYaw = damp(pose.headYaw, headYawT, 5, dt);
  rig.sensorHead.rotation.y = pose.headYaw;
  const headPitchT = moving ? 0.06 : -0.04 + Math.sin(e.anim * 0.5) * 0.02;
  pose.headPitch = damp(pose.headPitch, headPitchT, 4, dt);
  rig.sensorHead.rotation.x = pose.headPitch;
  pose.mastLean = damp(pose.mastLean, moving ? 0.03 : 0, 4, dt);
  rig.sensorMast.rotation.z = pose.mastLean;

  // ── Apply legs + body ───────────────────────────────────────────────
  for (let index = 0; index < 3; index++) {
    const lp = pose.legs[index];
    const leg = rig.legs[index];
    leg.upper.rotation.z = lp.hip;
    leg.lower.rotation.z = lp.knee;
    leg.foot.position.y = leg.restFootY + lp.lift;
  }
  root.position.y = pose.bodyBob;
  root.rotation.z = pose.bodyRoll;
  root.rotation.x = pose.bodyPitch;

  // ── Tools & FX ──────────────────────────────────────────────────────
  rig.tools.fork.visible = !busy;
  rig.tools.food.visible = gather && e.cargoType === Tile.Solar;
  rig.tools.crystal.visible = gather && e.cargoType !== Tile.Solar;
  rig.tools.build.visible = build;
  rig.actionFx.gather.visible = gather;
  rig.actionFx.attack.visible = attack;
  rig.actionFx.build.visible = build;

  // FX pulse keyed to the strike moment (0.42 of the action cycle)
  if (busy) {
    const A = WORKER_ACTIONS[orderName];
    const cyc = (e.anim % A.period) / A.period;
    const pulse = Math.max(0, 1 - Math.abs(cyc - 0.42) * 5.5);
    if (gather) {
      rig.actionFx.gather.scale.setScalar(0.85 + pulse * 0.45);
      rig.actionFx.gather.rotation.z = pulse * 0.35;
    } else if (attack) {
      rig.actionFx.attack.scale.setScalar(0.8 + pulse * 0.7);
    } else {
      rig.actionFx.build.scale.setScalar(0.85 + pulse * 0.4);
      rig.actionFx.build.rotation.y = e.anim * 1.4;
    }
  }

  // ── Status lights: activity-scaled chatter ──────────────────────────
  for (let index = 0; index < rig.statusLights.length; index++) {
    const flicker = 0.45 + 0.35 * Math.sin(e.anim * 6 + index * 1.7);
    const level = busy ? flicker : 0.22 + 0.12 * Math.sin(e.anim * 2 + index);
    rig.statusLights[index].material.emissiveIntensity = level;
  }
}

export class GameRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  readonly overlay: HTMLCanvasElement;
  readonly octx: CanvasRenderingContext2D;
  atlas!: Atlas;
  spriteAtlas!: SpriteAtlas;
  private sdfMesh!: THREE.InstancedMesh;
  private proceduralScout!: THREE.Group;
  private proceduralWorkers = new Map<number, THREE.Group>();
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
  /** Fog remains available for inspection, but art review starts with a clear map. */
  readonly fogOfWarEnabled = new URLSearchParams(window.location.search).get('fog') === '1';
  /** Procedural mesh experiment; append ?mesh=0 to compare the sprite path. */
  readonly proceduralScoutEnabled = new URLSearchParams(window.location.search).get('mesh') !== '0';
  private heightData!: Uint8Array;
  private mapMesh!: THREE.Mesh;
  private lastCamQ = new THREE.Quaternion();
  private lastDrawnMs = 0;
  private stars!: THREE.Points;
  private nebula!: THREE.Points;
  private readonly drawnEntIds = new Set<number>();
  private lastDrawn = 0;
  private lastVfx = 0;
  private vfx!: VfxRenderer;
  private readonly viewBounds = { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  private readonly lookTarget = new THREE.Vector3();
  private readonly lookDir = new THREE.Vector3();
  private readonly projectScratch = new THREE.Vector3();
  private readonly projectPointScratch = { x: 0, y: 0 };
  private readonly drawOrder: { i: number; depth: number; prop: boolean }[] = [];
  private proceduralScoutDrawn = 0;
  private proceduralWorkerDrawn = 0;

  constructor(host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: false,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(host.clientWidth, host.clientHeight, false);
    this.renderer.setClearColor(P.ink, 1);
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
    this.scene.background = new THREE.Color(P.ink);
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
    const scoutTex = new THREE.CanvasTexture(spriteAtlas.scoutCanvas);
    scoutTex.magFilter = THREE.NearestFilter;
    scoutTex.minFilter = THREE.NearestFilter;
    scoutTex.generateMipmaps = false;
    scoutTex.colorSpace = THREE.SRGBColorSpace;
    scoutTex.flipY = true;
    scoutTex.needsUpdate = true;

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
        uScoutAtlas: { value: scoutTex },
        uScoutAtlasSize: {
          value: new THREE.Vector2(spriteAtlas.scoutWidth, spriteAtlas.scoutHeight),
        },
        uScoutCell: { value: spriteAtlas.scoutCell },
        uScoutCols: { value: spriteAtlas.scoutCols },
        uScoutFrames: { value: spriteAtlas.scoutFrames },
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
      side: THREE.DoubleSide,
      // All unit instances share one transparent draw. Let every silhouette
      // contribute; depth writes from one billboard otherwise hide back ranks.
      depthWrite: false,
    });
    this.sdfMesh = new THREE.InstancedMesh(sdfGeo, sdfMat, MAX_ENTS);
    this.sdfMesh.frustumCulled = false;
    this.scene.add(this.sdfMesh);

    // Lighting is scoped to the procedural experiment. Existing terrain and
    // sprite shaders do not consume scene lights, so this does not alter them.
    this.scene.add(new THREE.HemisphereLight(P.ice, P.night, 1.45));
    const scoutKey = new THREE.DirectionalLight(P.amber, 2.5);
    scoutKey.position.set(5, 9, 4);
    this.scene.add(scoutKey);
    this.proceduralScout = buildProceduralScoutMesh();
    this.proceduralScout.visible = false;
    this.scene.add(this.proceduralScout);

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
      color: P.ink,
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
    this.fogMesh.visible = this.fogOfWarEnabled;
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
    // Wall-clock frame dt for pose-blended worker animation (clamped so a
    // background-tab stall can't teleport the rig).
    const nowMs = performance.now();
    const frameDt = Math.min(0.05, (nowMs - this.lastDrawnMs) / 1000) || 0.016;
    this.lastDrawnMs = nowMs;
    const vb = this.viewBounds;
    this.drawnEntIds.clear();
    let sdfDrawn = 0;
    let propDrawn = 0;
    let shadowDrawn = 0;
    this.proceduralScoutDrawn = 0;
    this.proceduralWorkerDrawn = 0;
    this.proceduralScout.visible = false;
    for (const worker of this.proceduralWorkers.values()) worker.visible = false;
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
      const groundY = this.groundY(x, z);
      order.push({ i, depth: x + z + groundY * 0.72 + i * 0.00001, prop: e.kind === Kind.Resource });
    }
    order.sort((a, b) => a.depth - b.depth || a.i - b.i);

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
      const useProceduralScout =
        this.proceduralScoutEnabled &&
        e.kind === Kind.Scout &&
        e.civ === 'vespari' &&
        e.team === 0 &&
        e.hp > 0;
      const useProceduralWorker =
        this.proceduralScoutEnabled &&
        e.kind === Kind.Worker &&
        e.civ === 'vespari' &&
        e.team === 0 &&
        e.hp > 0;

      if (useProceduralWorker) {
        let worker = this.proceduralWorkers.get(e.id);
        if (!worker) {
          worker = buildProceduralWorkerMesh();
          this.proceduralWorkers.set(e.id, worker);
          this.scene.add(worker);
        }
        worker.position.set(x, groundY + 0.01, z);
        updateProceduralWorkerMesh(worker, e, frameDt);
        worker.visible = true;
        this.proceduralWorkerDrawn++;
      } else if (useProceduralScout) {
        this.proceduralScout.position.set(x, groundY + 0.01, z);
        this.proceduralScout.visible = true;
        this.proceduralScoutDrawn++;
      } else if (e.kind === Kind.Resource) {
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
          const corpse = e.hp <= 0 || e.corpseT > 0;
          const unitMul = e.kind === Kind.Worker ? 1.55 : corpse ? 0.82 : 0.96;
          const facingSign = e.facing >= 4 ? -1 : 1;
          scaleX = cellsW * unitMul * (e.kind === Kind.Worker ? 1 : facingSign);
          scaleY = cellsH * (e.kind === Kind.Worker ? 1.55 : corpse ? 0.88 : 1.12);
        }
        // Fighters use a shorter billboard than workers. Keep their plane
        // bottom on the same ground line as the shadow instead of floating it.
        const lift = isBuilding(e.kind)
          ? 1.15
          : e.hp <= 0 || e.corpseT > 0
            ? 0.55
            : e.kind === Kind.Worker
              ? 0.9
              : 0.58;
        this.dummy.position.set(x, groundY + lift, z);
        this.dummy.quaternion.copy(this.lastCamQ);
        this.dummy.scale.set(scaleX, scaleY, 1);
        this.dummy.updateMatrix();
        this.sdfMesh.setMatrixAt(sdfDrawn, this.dummy.matrix);
        metaArr[sdfDrawn * 4] = e.kind;
        metaArr[sdfDrawn * 4 + 1] = civIndex(e.civ);
        metaArr[sdfDrawn * 4 + 2] = this.frameFor(e);
        metaArr[sdfDrawn * 4 + 3] = spr;
        dirArr[sdfDrawn] = e.kind < Kind.Hall ? e.facing : 0;
        sdfTeamArr[sdfDrawn * 3] = rgb[0];
        sdfTeamArr[sdfDrawn * 3 + 1] = rgb[1];
        sdfTeamArr[sdfDrawn * 3 + 2] = rgb[2];
        sdfFlashArr[sdfDrawn] = flash;
        sdfDrawn++;
      }

      if (e.kind === Kind.Resource) {
        // The camera's screen-down diagonal is +X/+Z. This small, camera
        // invariant offset aligns the horizontal shadow with the billboard's
        // lower edge without lowering it into the terrain depth buffer.
        this.dummy.position.set(x + 0.1, groundY + 0.03, z + 0.1);
        this.dummy.quaternion.identity();
        this.dummy.scale.set(e.radius * 1.1, 1, e.radius * 0.85);
        this.dummy.updateMatrix();
        this.shadows.setMatrixAt(shadowDrawn, this.dummy.matrix);
      } else {
        this.dummy.position.set(x + 0.1, groundY + 0.03, z + 0.1);
        this.dummy.quaternion.identity();
        this.dummy.scale.set(e.radius * 2.2, 1, e.radius * 1.6);
        this.dummy.updateMatrix();
        this.shadows.setMatrixAt(shadowDrawn, this.dummy.matrix);
      }
      shadowDrawn++;
      this.drawnEntIds.add(e.id);
    }

    this.lastDrawn = sdfDrawn + propDrawn + this.proceduralScoutDrawn + this.proceduralWorkerDrawn;
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

  project(x: number, y: number, z: number, out = { x: 0, y: 0 }): { x: number; y: number } {
    this.projectScratch.set(x, y, z).project(this.camera);
    out.x = (this.projectScratch.x * 0.5 + 0.5) * this.overlay.width;
    out.y = (-this.projectScratch.y * 0.5 + 0.5) * this.overlay.height;
    return out;
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
      new THREE.PointsMaterial({ color: P.ice, size: 0.08, sizeAttenuation: true, transparent: true, opacity: 0.7 }),
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
    if (!this.fogOfWarEnabled) return;
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
      ctx.strokeStyle = `${P.amber}f2`;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = `${P.amber}1f`;
      ctx.fillRect(x, y, bw, bh);
      ctx.strokeRect(x, y, bw, bh);
    }

    if (world.tick < 240) {
      for (let i = 0; i < MAX_ENTS; i++) {
        const e = world.ents[i];
        if (!e.alive || !e.vis || e.kind !== Kind.Worker) continue;
        const x = e.px + (e.x - e.px) * alpha;
        const z = e.pz + (e.z - e.pz) * alpha;
        const p = this.project(x, this.groundY(x, z) + 0.05, z, this.projectPointScratch);
        ctx.fillStyle = P.amber;
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
      const p = this.project(f.x, this.groundY(f.x, f.z) + 0.05, f.z, this.projectPointScratch);
      ctx.globalAlpha = Math.max(0, f.t);
      ctx.strokeStyle = P.amber;
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
      const foot = this.project(x, gy + 0.05, z, this.projectPointScratch);

      if (sel) {
        const rx = isBuilding(e.kind) ? e.radius * 38 + 10 : e.radius * 44 + 12;
        const ry = isBuilding(e.kind) ? e.radius * 14 + 4 : e.radius * 16 + 5;
        ctx.strokeStyle = isPlayer ? P.lime : P.red;
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

      const head = this.project(x, gy + (isBuilding(e.kind) ? 2.4 : 1.65), z, this.projectPointScratch);
      const bw = isBuilding(e.kind) ? 36 : 18;
      const bh = 3;
      const ratio = Math.max(0, e.hp / e.maxHp);
      const barY = head.y - 16;
      const outline = isPlayer ? P.lime : P.red;
      const fill = isPlayer ? P.leaf : P.copper;

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
