import * as THREE from 'three';
import {
  createSunweaverTownCenterStructural,
  type StructuralStage,
  type StructuralTownCenter,
} from './sunweaver-town-center-structural';

const host = document.getElementById('viewer');
if (!(host instanceof HTMLElement)) throw new Error('Structural viewer: #viewer is missing');
const viewerHost = host;
const params = new URLSearchParams(location.search);
const ui = params.get('ui') !== '0';
const freeze = params.get('freeze') === '1';
const stage = THREE.MathUtils.clamp(Number(params.get('stage') ?? '4'), 1, 4) as StructuralStage;
const viewName = params.get('view') ?? 'front-3q';
const pass = params.get('pass') ?? 'beauty';
document.body.classList.toggle('ui-hidden', !ui);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#858585');
const camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 80);
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;
renderer.toneMappingExposure = 1;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
viewerHost.appendChild(renderer.domElement);

const hemi = new THREE.HemisphereLight('#E4E4E4', '#555555', 1.6);
const key = new THREE.DirectionalLight('#FFFFFF', 2.2);
// Front-biased key: the unified central jewel-column's facade must catch light so it
// reads as the brightest element (reference energy-crystal), not a shadowed void.
key.position.set(-4, 9, 14);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
key.shadow.camera.left = -7; key.shadow.camera.right = 7; key.shadow.camera.top = 9; key.shadow.camera.bottom = -5;
const fill = new THREE.DirectionalLight('#C9C9C9', 0.55);
fill.position.set(7, 5, -6);
scene.add(hemi, key, fill);

const ground = new THREE.Mesh(new THREE.CircleGeometry(15, 64), new THREE.MeshStandardMaterial({ color: '#858585', roughness: 1, metalness: 0 }));
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.01;
ground.receiveShadow = true;
scene.add(ground);

const model: StructuralTownCenter = createSunweaverTownCenterStructural();
scene.add(model);
const runtime = model.userData.sculptRuntime;
runtime.setStage(stage);

/**
 * Fixed views. Every view carries its own orthographic half-height so the
 * apparent scale differs per view: gameplay close < normal < far, and the
 * ortho/3Q views frame the full crown (y ≈ 7.3) and footprint with margin.
 */
const viewDefinitions: Record<string, { position: THREE.Vector3; target: THREE.Vector3; half: number }> = {
  'front-ortho': { position: new THREE.Vector3(0, 3.6, 12), target: new THREE.Vector3(0, 3.6, 0), half: 4.4 },
  'right-ortho': { position: new THREE.Vector3(12, 3.6, 0), target: new THREE.Vector3(0, 3.6, 0), half: 4.4 },
  'back-ortho': { position: new THREE.Vector3(0, 3.6, -12), target: new THREE.Vector3(0, 3.6, 0), half: 4.4 },
  'left-ortho': { position: new THREE.Vector3(-12, 3.6, 0), target: new THREE.Vector3(0, 3.6, 0), half: 4.4 },
  'top-ortho': { position: new THREE.Vector3(0, 15, 0.001), target: new THREE.Vector3(0, 0, 0), half: 4.2 },
  'front-3q': { position: new THREE.Vector3(9, 7.6, 11), target: new THREE.Vector3(0, 3.3, 0), half: 4.9 },
  'rear-3q': { position: new THREE.Vector3(-9, 7.6, -11), target: new THREE.Vector3(0, 3.3, 0), half: 4.9 },
  'gameplay-close': { position: new THREE.Vector3(7.8, 6.4, 9.0), target: new THREE.Vector3(0, 3.1, 0), half: 2.7 },
  'gameplay-normal': { position: new THREE.Vector3(11.5, 8.3, 13.0), target: new THREE.Vector3(0, 3.2, 0), half: 3.9 },
  'gameplay-far': { position: new THREE.Vector3(16.5, 11.4, 18.5), target: new THREE.Vector3(0, 3.2, 0), half: 5.6 },
};

function setView(name: string): void {
  const selected = viewDefinitions[name] ?? viewDefinitions['front-3q'];
  camera.position.copy(selected.position);
  camera.lookAt(selected.target);
  camera.updateMatrixWorld(true);
  camera.userData.half = selected.half;
}

const originalMaterials = new Map<THREE.Mesh, THREE.Material | THREE.Material[]>();
const qaMaterials: THREE.Material[] = [];
function applyPass(name: string): void {
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    if (!originalMaterials.has(object)) originalMaterials.set(object, object.material);
    let material: THREE.Material;
    if (name === 'silhouette') material = new THREE.MeshBasicMaterial({ color: '#111111' });
    else if (name === 'wireframe') material = new THREE.MeshBasicMaterial({ color: '#222222', wireframe: true });
    else if (name === 'normal') material = new THREE.MeshNormalMaterial({ flatShading: true });
    else if (name === 'depth') material = new THREE.MeshDepthMaterial();
    else if (name === 'material-id') {
      const hash = String(object.userData.partId ?? object.name).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);
      material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((hash % 360) / 360, 0.56, 0.48) });
    } else if (name === 'palette') {
      material = (object.userData.paletteMaterial as THREE.Material | undefined) ?? (object.material as THREE.Material);
    } else material = object.material as THREE.Material;
    if (name === 'beauty') {
      object.material = originalMaterials.get(object) as THREE.Material;
    } else if (name === 'palette') {
      // Bind the accepted palette set onto the SAME geometry; never the clay.
      object.material = (object.userData.paletteMaterial as THREE.Material | undefined) ?? (originalMaterials.get(object) as THREE.Material);
    } else {
      object.material = material;
      qaMaterials.push(material);
    }
  });
  if (name === 'silhouette') scene.background = new THREE.Color('#FFFFFF');
  else scene.background = new THREE.Color('#858585');
  const beautyLike = name === 'beauty' || name === 'palette';
  ground.visible = beautyLike;
  hemi.visible = beautyLike; key.visible = beautyLike; fill.visible = beautyLike;
}

function resize(): void {
  const width = Math.max(viewerHost.clientWidth, 1);
  const height = Math.max(viewerHost.clientHeight, 1);
  const aspect = width / height;
  const half = Number(camera.userData.half ?? 4.9);
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}
setView(viewName);
applyPass(pass);
resize();
window.addEventListener('resize', resize);

const runtimeHost = {
  ready: false,
  model,
  scene,
  camera,
  renderer,
  runtime,
  setView,
  setStage: (value: StructuralStage) => runtime.setStage(value),
  setPass: applyPass,
};
(window as unknown as { __SUNWEAVER_STRUCTURAL__: typeof runtimeHost }).__SUNWEAVER_STRUCTURAL__ = runtimeHost;
const stats = document.getElementById('stats');
const clock = new THREE.Clock();
let ready = false;
function frame(): void {
  requestAnimationFrame(frame);
  const delta = freeze ? 0 : Math.min(clock.getDelta(), 0.05);
  runtime.update(clock.elapsedTime, delta);
  renderer.render(scene, camera);
  if (!ready) {
    ready = true;
    runtimeHost.ready = true;
    document.body.dataset.ready = 'true';
  }
  if (stats) stats.textContent = `${pass} · stage ${runtime.getStage()} · ${renderer.info.render.calls} draws`;
}
frame();

window.addEventListener('beforeunload', () => {
  runtime.dispose();
  ground.geometry.dispose();
  (ground.material as THREE.Material).dispose();
  for (const item of qaMaterials) item.dispose();
  renderer.dispose();
});
