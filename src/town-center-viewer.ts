import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  createSunweaverTownCenter,
  type SunweaverTownCenterModel,
  type TownCenterStage,
} from './sunweaver-town-center';

const containerNode = document.getElementById('viewer');
const panelNode = document.getElementById('panel');
const partReadoutNode = document.getElementById('part-readout');
const statsReadoutNode = document.getElementById('stats-readout');
if (
  !(containerNode instanceof HTMLElement)
  || !(panelNode instanceof HTMLElement)
  || !(partReadoutNode instanceof HTMLElement)
  || !(statsReadoutNode instanceof HTMLElement)
) {
  throw new Error('Sunweaver Town Center viewer: required DOM nodes are missing');
}
const container = containerNode;
const panel = panelNode;
const partReadout = partReadoutNode;
const statsReadout = statsReadoutNode;

const params = new URLSearchParams(window.location.search);
const initialStage = THREE.MathUtils.clamp(Number(params.get('stage') ?? '4'), 1, 4) as TownCenterStage;
const uiVisible = params.get('ui') !== '0';
const turntableEnabled = params.get('turn') === '1';
const frozen = params.get('freeze') === '1';
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
panel.hidden = !uiVisible;
document.body.classList.toggle('ui-hidden', !uiVisible);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#EEE8DE');
scene.fog = new THREE.Fog('#EEE8DE', 21, 40);

const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 120);
camera.position.set(9.2, 7.1, 9.2);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
container.appendChild(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
const environmentScene = new RoomEnvironment();
const environmentTarget = pmrem.fromScene(environmentScene, 0.04);
scene.environment = environmentTarget.texture;
environmentScene.dispose();
pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.target.set(0, 2.65, 0);
controls.minDistance = 7.5;
controls.maxDistance = 28;
controls.minPolarAngle = 0.08;
controls.maxPolarAngle = Math.PI * 0.49;
controls.update();

const hemisphere = new THREE.HemisphereLight('#DFF0FF', '#706857', 0.98);
scene.add(hemisphere);

const key = new THREE.DirectionalLight('#FFF1D2', 3.0);
key.position.set(-7.2, 11.5, 7.8);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.near = 1;
key.shadow.camera.far = 35;
key.shadow.camera.left = -7;
key.shadow.camera.right = 7;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -5;
key.shadow.bias = -0.00035;
key.shadow.normalBias = 0.025;
key.shadow.radius = 4;
scene.add(key);

const fill = new THREE.DirectionalLight('#A7D6FF', 0.9);
fill.position.set(7.5, 5.5, -6.5);
scene.add(fill);

const rim = new THREE.DirectionalLight('#FFE0A2', 1.15);
rim.position.set(-2.5, 7.2, -9.0);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(19, 96),
  new THREE.MeshStandardMaterial({ color: '#DDD6CA', roughness: 0.96, metalness: 0 }),
);
floor.name = 'review-floor';
floor.rotation.x = -Math.PI * 0.5;
floor.position.y = -0.015;
floor.receiveShadow = true;
scene.add(floor);

const stageRing = new THREE.Mesh(
  new THREE.RingGeometry(4.3, 4.37, 128),
  new THREE.MeshBasicMaterial({ color: '#B88A45', transparent: true, opacity: 0.42, side: THREE.DoubleSide }),
);
stageRing.rotation.x = -Math.PI * 0.5;
stageRing.position.y = 0.003;
stageRing.visible = uiVisible;
scene.add(stageRing);

const radialLines = new THREE.Group();
for (let index = 0; index < 8; index++) {
  const angle = (index / 8) * Math.PI * 2;
  const line = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.006, 0.76),
    new THREE.MeshBasicMaterial({ color: '#B88A45', transparent: true, opacity: 0.26 }),
  );
  line.position.set(Math.sin(angle) * 4.0, 0.006, Math.cos(angle) * 4.0);
  line.rotation.y = angle;
  radialLines.add(line);
}
radialLines.visible = uiVisible;
scene.add(radialLines);

const model: SunweaverTownCenterModel = createSunweaverTownCenter({
  stage: initialStage,
  crystalColor: '#36C9FF',
  teamColor: '#36C9FF',
  reducedMotion,
});
model.rotation.y = 0.22;
scene.add(model);

const views: Record<string, { position: THREE.Vector3; target: THREE.Vector3 }> = {
  front: {
    position: new THREE.Vector3(5.98, 4.0, 9.23),
    target: new THREE.Vector3(0, 3.2, 0),
  },
  back: {
    position: new THREE.Vector3(-8.8, 6.8, -8.8),
    target: new THREE.Vector3(0, 2.55, 0),
  },
  side: {
    position: new THREE.Vector3(12.2, 6.0, 0.05),
    target: new THREE.Vector3(0, 2.55, 0),
  },
  left: {
    position: new THREE.Vector3(-12.2, 6.0, 0.05),
    target: new THREE.Vector3(0, 2.55, 0),
  },
  top: {
    position: new THREE.Vector3(0.01, 14.8, 0.01),
    target: new THREE.Vector3(0, 0.7, 0),
  },
};

function setView(name: string): void {
  const view = views[name] ?? views.front;
  camera.position.copy(view.position);
  controls.target.copy(view.target);
  camera.lookAt(view.target);
  controls.update();
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
    button.classList.toggle('active', button.dataset.view === name);
  }
}

function setStage(stage: TownCenterStage): void {
  model.userData.sculptRuntime.setStage(stage);
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-stage]')) {
    button.classList.toggle('active', Number(button.dataset.stage) === stage);
  }
}

setView(params.get('view') ?? 'front');
setStage(initialStage);
model.userData.sculptRuntime.setExplode(Number(params.get('explode') ?? '0'));

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-view]')) {
  button.addEventListener('click', () => setView(button.dataset.view ?? 'front'));
}
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-stage]')) {
  button.addEventListener('click', () => setStage(Number(button.dataset.stage) as TownCenterStage));
}

const explodeInput = document.querySelector<HTMLInputElement>('#explode');
explodeInput?.addEventListener('input', () => {
  model.userData.sculptRuntime.setExplode(Number(explodeInput.value));
});
const turntableInput = document.querySelector<HTMLInputElement>('#turntable');
if (turntableInput) turntableInput.checked = turntableEnabled;
const wireframeInput = document.querySelector<HTMLInputElement>('#wireframe');
wireframeInput?.addEventListener('change', () => {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if ('wireframe' in material) (material as THREE.MeshStandardMaterial).wireframe = wireframeInput.checked;
    }
  });
});

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObjects([...model.userData.sculptRuntime.pickables], false)[0];
  partReadout.textContent = hit ? String(hit.object.userData.partId ?? hit.object.name ?? 'unnamed part') : 'none';
});

function resize(): void {
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
resize();
window.addEventListener('resize', resize);

function countTriangles(root: THREE.Object3D): number {
  let triangles = 0;
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const geometry = object.geometry;
    const base = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    triangles += base * (object instanceof THREE.InstancedMesh ? object.count : 1);
  });
  return Math.round(triangles);
}

const triangleCount = countTriangles(model);
const clock = new THREE.Clock();
let ready = false;
let lastElapsed = 0;

function renderFrame(): void {
  requestAnimationFrame(renderFrame);
  const measuredDelta = Math.min(clock.getDelta(), 0.05);
  const elapsed = frozen ? 2.4 : clock.elapsedTime;
  const delta = frozen ? 0 : measuredDelta;
  model.userData.sculptRuntime.update(elapsed, delta);
  const shouldTurn = turntableInput?.checked ?? turntableEnabled;
  if (shouldTurn && !reducedMotion && !frozen) model.rotation.y += delta * 0.22;
  controls.update();
  renderer.render(scene, camera);

  if (!ready) {
    ready = true;
    document.body.dataset.ready = 'true';
  }
  if (elapsed - lastElapsed > 0.3 || frozen) {
    lastElapsed = elapsed;
    statsReadout.textContent = `${triangleCount.toLocaleString()} tris · ${renderer.info.render.calls} draws · stage ${String(model.userData.stage ?? initialStage)}`;
  }

  const host = window as unknown as {
    __SUNWEAVER_TOWN_CENTER__: {
      ready: boolean;
      model: SunweaverTownCenterModel;
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: OrbitControls;
      triangles: number;
      drawCalls: number;
      setView: (name: string) => void;
      setStage: (stage: TownCenterStage) => void;
    };
  };
  host.__SUNWEAVER_TOWN_CENTER__ = {
    ready,
    model,
    scene,
    camera,
    renderer,
    controls,
    triangles: triangleCount,
    drawCalls: renderer.info.render.calls,
    setView,
    setStage,
  };
}
renderFrame();

window.addEventListener('beforeunload', () => {
  environmentTarget.dispose();
  floor.geometry.dispose();
  (floor.material as THREE.Material).dispose();
  stageRing.geometry.dispose();
  (stageRing.material as THREE.Material).dispose();
  model.userData.sculptRuntime.dispose();
  renderer.dispose();
});
