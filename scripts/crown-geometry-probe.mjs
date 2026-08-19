// Objective geometry probe: verify the remounted crown cage crosses the scaled mandorla.
// Loads the structural viewer (front-ortho, stage 4), computes world-space AABBs of the
// cage ribs vs the mandorla/spine, and reports x-overlap bands per y-slice.
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { mkdirSync } from 'node:fs';

const URL = 'http://127.0.0.1:5174/town-center-structural-viewer.html?ui=0&view=front-ortho&stage=4&pass=beauty&freeze=1';
const LUMINANCE_CAPTURE = 'critic/out/town-center-structural-v01/beauty-front-ortho-mandorla-gate.png';
const VAULT_LUMINANCE_CAPTURE = 'critic/out/town-center-structural-v01/beauty-front-ortho-vault-luminance-gate.png';

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1180, height: 820 } });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__SUNWEAVER_STRUCTURAL__?.ready === true);
mkdirSync('critic/out/town-center-structural-v01', { recursive: true });

// The structural viewer's fixed front-ortho camera is centred at world Y3.6
// with an orthographic half-height of 4.4. Sample the middle of the filled
// vault (Y5.6-6.9) in a narrow center column, then compare it with the gray
// canvas outside the building in the same screen band.
const vaultBand = { minY: 5.6, maxY: 6.9 };
const vaultImageBuffer = await page.screenshot({ path: VAULT_LUMINANCE_CAPTURE });
const vaultPng = PNG.sync.read(vaultImageBuffer);
const vaultScreenY = (worldY) => vaultPng.height / 2 - (worldY - 3.6) * vaultPng.height / (2 * 4.4);
const vaultTopPx = Math.max(0, Math.floor(vaultScreenY(vaultBand.maxY)));
const vaultBottomPx = Math.min(vaultPng.height - 1, Math.ceil(vaultScreenY(vaultBand.minY)));
const vaultCenterX = vaultPng.width / 2;
const vaultPxPerWorldX = vaultPng.width / (2 * 4.4 * (vaultPng.width / vaultPng.height));
const vaultHalfColumnWorldWidth = 0.3;
const vaultHalfColumnPx = Math.max(2, Math.round(vaultHalfColumnWorldWidth * vaultPxPerWorldX));
const vaultLuma = (offset) => 0.299 * vaultPng.data[offset] + 0.587 * vaultPng.data[offset + 1] + 0.114 * vaultPng.data[offset + 2];
const meanLumaRect = (left, right, top, bottom) => {
  let sum = 0;
  let count = 0;
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      sum += vaultLuma((y * vaultPng.width + x) * 4);
      count++;
    }
  }
  return { mean: sum / count, count };
};
const vaultCenterMean = meanLumaRect(
  Math.max(0, Math.round(vaultCenterX - vaultHalfColumnPx)),
  Math.min(vaultPng.width - 1, Math.round(vaultCenterX + vaultHalfColumnPx)),
  vaultTopPx,
  vaultBottomPx,
);
// The left canvas strip is outside the 7-unit footprint for the fixed front view.
const vaultBackgroundMean = meanLumaRect(24, Math.round(vaultPng.width * 0.12), vaultTopPx, vaultBottomPx);
const vaultLuminance = {
  image: VAULT_LUMINANCE_CAPTURE,
  worldBand: vaultBand,
  screenBand: { top: vaultTopPx, bottom: vaultBottomPx },
  centerColumnHalfWorldWidth: vaultHalfColumnWorldWidth,
  centerMean: Math.round(vaultCenterMean.mean * 100) / 100,
  backgroundMean: Math.round(vaultBackgroundMean.mean * 100) / 100,
  delta: Math.round((vaultCenterMean.mean - vaultBackgroundMean.mean) * 100) / 100,
  samples: { center: vaultCenterMean.count, background: vaultBackgroundMean.count },
  pass: vaultCenterMean.mean >= 100 && vaultCenterMean.mean - vaultBackgroundMean.mean >= 8,
  method: 'fixed front-ortho center-column band versus left canvas background strip',
};

const report = await page.evaluate(() => {
  const scene = window.__SUNWEAVER_STRUCTURAL__.model;
  const boxes = {}; // name -> world AABB {min:[x,y,z], max:[x,y,z]}
  const surfaces = {}; // cage talon key -> world-space indexed triangles
  const meshes = [];
  scene.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  // World AABB without a THREE global: transform geometry vertices through matrixWorld.
  const transformPoint = (m, x, y, z) => {
    const e = m.elements;
    const w = e[3] * x + e[7] * y + e[11] * z + e[15];
    const iw = w ? 1 / w : 1;
    return [
      (e[0] * x + e[4] * y + e[8] * z + e[12]) * iw,
      (e[1] * x + e[5] * y + e[9] * z + e[13]) * iw,
      (e[2] * x + e[6] * y + e[10] * z + e[14]) * iw,
    ];
  };
  for (const m of meshes) {
    // Deformed cage geometry can retain a cloned stale bounding box; recompute it
    // before reporting the world AABB used by the human-readable overlap summary.
    if (m.geometry) m.geometry.computeBoundingBox();
    if (!m.geometry || !m.geometry.boundingBox) continue;
    m.updateWorldMatrix(true, false);
    const position = m.geometry.getAttribute('position');
    const corners = position
      ? Array.from({ length: position.count }, (_, i) => transformPoint(
        m.matrixWorld,
        position.getX(i),
        position.getY(i),
        position.getZ(i),
      ))
      : [
        [m.geometry.boundingBox.min.x, m.geometry.boundingBox.min.y, m.geometry.boundingBox.min.z],
        [m.geometry.boundingBox.max.x, m.geometry.boundingBox.min.y, m.geometry.boundingBox.min.z],
        [m.geometry.boundingBox.min.x, m.geometry.boundingBox.max.y, m.geometry.boundingBox.min.z],
        [m.geometry.boundingBox.max.x, m.geometry.boundingBox.max.y, m.geometry.boundingBox.min.z],
        [m.geometry.boundingBox.min.x, m.geometry.boundingBox.min.y, m.geometry.boundingBox.max.z],
        [m.geometry.boundingBox.max.x, m.geometry.boundingBox.min.y, m.geometry.boundingBox.max.z],
        [m.geometry.boundingBox.min.x, m.geometry.boundingBox.max.y, m.geometry.boundingBox.max.z],
        [m.geometry.boundingBox.max.x, m.geometry.boundingBox.max.y, m.geometry.boundingBox.max.z],
      ].map((c) => transformPoint(m.matrixWorld, ...c));
    const mn = [Infinity, Infinity, Infinity];
    const mx = [-Infinity, -Infinity, -Infinity];
    for (const c of corners) {
      for (let i = 0; i < 3; i++) { mn[i] = Math.min(mn[i], c[i]); mx[i] = Math.max(mx[i], c[i]); }
    }
    // Path-based key so the four shared-name clones stay distinct
    let p = m.parent ? m.parent.name : '';
    let key = (m.name || 'anon') + '@' + p;
    boxes[key] = {
      min: mn.map((v) => Math.round(v * 100) / 100),
      max: mx.map((v) => Math.round(v * 100) / 100),
    };
    if (m.name === 'cage_arch') {
      const worldPositions = [];
      for (let i = 0; i < position.count; i++) worldPositions.push(transformPoint(m.matrixWorld, position.getX(i), position.getY(i), position.getZ(i)));
      const index = m.geometry.index;
      const indices = index ? Array.from(index.array) : Array.from({ length: position.count }, (_, i) => i);
      const e = m.matrixWorld.elements;
      const normalLength = Math.hypot(e[8], e[9], e[10]) || 1;
      const normal = [e[8] / normalLength, e[9] / normalLength, e[10] / normalLength];
      surfaces[key] = { worldPositions, indices, normal };
    }
  }

  // The crown mandorla is scaled in PTC-CLAY-07. Use its measured world AABB
  // instead of the pre-scale hard-coded range, and ignore the new vault jewel.
  const crystalMandorlaKey = Object.keys(boxes).find((key) => key.startsWith('crystal_mandorla@'));
  const mandorlaBox = crystalMandorlaKey ? boxes[crystalMandorlaKey] : null;
  const mandorlaX = mandorlaBox ? [mandorlaBox.min[0], mandorlaBox.max[0]] : [-0.55, 0.55];
  const intersectingXAtY = (a, b, y) => {
    const dy = b[1] - a[1];
    if (Math.abs(dy) < 1e-8) return Math.abs(a[1] - y) < 1e-5 ? [a[0], b[0]] : [];
    const t = (y - a[1]) / dy;
    return t >= -1e-8 && t <= 1 + 1e-8 ? [a[0] + (b[0] - a[0]) * t] : [];
  };
  const objectiveTalons = Object.entries(surfaces).map(([key, surface]) => {
    const ys = surface.worldPositions.map((p) => p[1]);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const radial = (p) => Math.hypot(p[0], p[2]);
    const maxRadius = Math.max(...surface.worldPositions.map(radial));
    const apexBand = surface.worldPositions.filter((p) => p[1] >= maxY - 0.025);
    const apexBandMaxRadius = Math.max(...apexBand.map(radial));
    const sliceCount = 128;
    let overlapSlices = 0;
    for (let slice = 0; slice < sliceCount; slice++) {
      const y = minY + (slice + 0.5) * (maxY - minY) / sliceCount;
      const xs = [];
      for (let i = 0; i < surface.indices.length; i += 3) {
        const a = surface.worldPositions[surface.indices[i]];
        const b = surface.worldPositions[surface.indices[i + 1]];
        const c = surface.worldPositions[surface.indices[i + 2]];
        xs.push(...intersectingXAtY(a, b, y), ...intersectingXAtY(b, c, y), ...intersectingXAtY(c, a, y));
      }
      if (xs.length && Math.min(...xs) <= mandorlaX[1] && Math.max(...xs) >= mandorlaX[0]) overlapSlices++;
    }
    const overlapFraction = overlapSlices / sliceCount;
    const faceAngleDegrees = Math.acos(Math.min(1, Math.abs(surface.normal[2]))) * 180 / Math.PI;
    return {
      key,
      ownHeight: Math.round((maxY - minY) * 10000) / 10000,
      maxRadius: Math.round(maxRadius * 10000) / 10000,
      apexBandMaxRadius: Math.round(apexBandMaxRadius * 10000) / 10000,
      overlapSlices,
      sliceCount,
      overlapFraction: Math.round(overlapFraction * 10000) / 10000,
      faceAngleDegrees: Math.round(faceAngleDegrees * 10000) / 10000,
      normal: surface.normal.map((v) => Math.round(v * 10000) / 10000),
    };
  });

  // Front-ortho silhouette check for the unified jewel body. The camera maps
  // screen X directly to world X, so intersect each body triangle with a
  // horizontal world-Y plane and report the largest absolute X value.
  const sampleHalfWidthAtY = (meshName, y) => {
    const mesh = meshes.find((item) => item.name === meshName);
    if (!mesh?.geometry) return null;
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position');
    if (!position) return null;
    const worldPositions = Array.from({ length: position.count }, (_, i) => transformPoint(
      mesh.matrixWorld,
      position.getX(i),
      position.getY(i),
      position.getZ(i),
    ));
    const index = mesh.geometry.index;
    const indices = index ? Array.from(index.array) : Array.from({ length: position.count }, (_, i) => i);
    const xs = [];
    const addEdge = (ia, ib) => {
      const a = worldPositions[ia];
      const b = worldPositions[ib];
      const da = a[1] - y;
      const db = b[1] - y;
      if (Math.abs(da) <= 1e-6 && Math.abs(db) <= 1e-6) {
        xs.push(a[0], b[0]);
      } else if (da * db <= 0 && Math.abs(a[1] - b[1]) > 1e-8) {
        const t = (y - a[1]) / (b[1] - a[1]);
        if (t >= -1e-8 && t <= 1 + 1e-8) xs.push(a[0] + (b[0] - a[0]) * t);
      }
    };
    for (let i = 0; i < indices.length; i += 3) {
      addEdge(indices[i], indices[i + 1]);
      addEdge(indices[i + 1], indices[i + 2]);
      addEdge(indices[i + 2], indices[i]);
    }
    return xs.length ? Math.max(...xs.map((value) => Math.abs(value))) : null;
  };
  const noShelfYs = [6.5, 7.0, 7.6, 8.2, 8.8];
  const noShelfSamples = noShelfYs.map((y) => ({
    y,
    halfWidth: sampleHalfWidthAtY('crystal_mandorla', y),
  }));
  const noShelfPass = noShelfSamples.every((sample, i) => sample.halfWidth !== null
    && (i === 0
      || (noShelfSamples[i - 1].halfWidth !== null
        && sample.halfWidth <= noShelfSamples[i - 1].halfWidth + 0.02)));
  const noShelf = {
    mesh: 'crystal_mandorla',
    tolerancePerStep: 0.02,
    samples: noShelfSamples.map((sample) => ({
      y: sample.y,
      halfWidth: sample.halfWidth === null ? null : Math.round(sample.halfWidth * 10000) / 10000,
    })),
    pass: noShelfPass,
    method: 'front-ortho world-X triangle intersections on the unified jewel body',
  };
  return { boxes, meshNames: meshes.map((m) => m.name), objectiveTalons, noShelf };
});

// The fixed front-ortho QA camera is centred on the lower building and clips the
// remounted crown. Capture a mandorla-focused front beauty frame for the objective
// gate without changing the runtime viewer camera or the committed shot set.
const mandorlaKey = Object.keys(report.boxes).find((key) => key.startsWith('crystal_mandorla@'));
const mandorlaBox = mandorlaKey ? report.boxes[mandorlaKey] : null;
let luminance = { image: LUMINANCE_CAPTURE, pass: false, samples: [], reason: 'mandorla AABB unavailable' };
if (mandorlaBox) {
  const centerY = (mandorlaBox.min[1] + mandorlaBox.max[1]) / 2;
  const halfHeight = Math.max((mandorlaBox.max[1] - mandorlaBox.min[1]) / 2 + 0.45, 2.35);
  await page.evaluate(({ centerY: y, halfHeight: half }) => {
    const host = window.__SUNWEAVER_STRUCTURAL__;
    host.camera.position.set(0, y, 12);
    host.camera.lookAt(0, y, 0);
    const aspect = window.innerWidth / window.innerHeight;
    host.camera.left = -half * aspect;
    host.camera.right = half * aspect;
    host.camera.top = half;
    host.camera.bottom = -half;
    host.camera.updateProjectionMatrix();
    // Isolate the mandorla/spine so crossing cage shadows cannot mask the center
    // column that this gate is intended to measure.
    const cage = host.model.getObjectByName('crystal_cage_arches');
    if (cage) cage.visible = false;
  }, { centerY, halfHeight });
  mkdirSync('critic/out/town-center-structural-v01', { recursive: true });
  const imageBuffer = await page.screenshot({ path: LUMINANCE_CAPTURE });
  const png = PNG.sync.read(imageBuffer);
  const imageCenterX = png.width / 2;
  const imageCenterY = png.height / 2;
  const pxPerWorldX = png.width / (2 * halfHeight * (png.width / png.height));
  const pxPerWorldY = png.height / (2 * halfHeight);
  const halfWidth = (mandorlaBox.max[0] - mandorlaBox.min[0]) / 2;
  const sideOffsetPx = halfWidth * 0.5 * pxPerWorldX;
  const lumaAt = (x, y) => {
    let sum = 0;
    let count = 0;
    const radius = 3;
    for (let yy = Math.max(0, Math.round(y) - radius); yy <= Math.min(png.height - 1, Math.round(y) + radius); yy++) {
      for (let xx = Math.max(0, Math.round(x) - radius); xx <= Math.min(png.width - 1, Math.round(x) + radius); xx++) {
        const offset = (yy * png.width + xx) * 4;
        sum += 0.299 * png.data[offset] + 0.587 * png.data[offset + 1] + 0.114 * png.data[offset + 2];
        count++;
      }
    }
    return sum / count;
  };
  const samples = [0.25, 0.55].map((fraction) => {
    const worldY = mandorlaBox.min[1] + fraction * (mandorlaBox.max[1] - mandorlaBox.min[1]);
    const screenY = imageCenterY - (worldY - centerY) * pxPerWorldY;
    const center = lumaAt(imageCenterX, screenY);
    const left = lumaAt(imageCenterX - sideOffsetPx, screenY);
    const right = lumaAt(imageCenterX + sideOffsetPx, screenY);
    const side = (left + right) / 2;
    return {
      heightFraction: fraction,
      worldY: Math.round(worldY * 1000) / 1000,
      screenY: Math.round(screenY * 10) / 10,
      center: Math.round(center * 100) / 100,
      left: Math.round(left * 100) / 100,
      right: Math.round(right * 100) / 100,
      side: Math.round(side * 100) / 100,
      delta: Math.round((center - side) * 100) / 100,
      pass: center >= side - 2,
    };
  });
  luminance = {
    image: LUMINANCE_CAPTURE,
    samples,
    pass: samples.every((sample) => sample.pass),
    method: 'center column vs side columns at half mandorla width on a crown-framed front beauty capture',
  };
}

// Front ortho: screen-x == world-x (camera looks down -Z). Judge overlap in world x.
const B = report.boxes;
const names = Object.keys(B);
const pick = (pat) => names.filter((n) => n.includes(pat));
const mandorla = pick('mandorla');
const spine = pick('spine');
const arches = pick('cage_arch').filter((n) => !n.includes('flare'));
const flares = pick('flare');
console.log('mandorla meshes:', mandorla);
console.log('spine meshes:', spine);
console.log('cage rib meshes:', arches);
console.log('flares:', flares);

const show = (ns) => {
  for (const n of ns) {
    const b = B[n];
    if (!b) continue;
    const cx = (b.min[0] + b.max[0]) / 2;
    const cy = (b.min[1] + b.max[1]) / 2;
    const w = b.max[0] - b.min[0];
    console.log(
      `  ${n}  x[${b.min[0]},${b.max[0]}] (cx ${Math.round(cx * 100) / 100}, w ${Math.round(w * 100) / 100})  y[${b.min[1]},${b.max[1]}]  z[${b.min[2]},${b.max[2]}]`
    );
  }
};
console.log('\n-- mandorla --');
show(mandorla);
console.log('\n-- spine --');
show(spine);
console.log('\n-- cage ribs --');
show(arches);
console.log('\n-- flares --');
show(flares);

console.log('\n-- PTC-CLAY-07 crown objective checks --');
for (const talon of report.objectiveTalons) {
  console.log(`  ${talon.key}: x-overlap fraction ${talon.overlapFraction} (${talon.overlapSlices}/${talon.sliceCount} slices, height ${talon.ownHeight})  face angle ${talon.faceAngleDegrees}°  max radius ${talon.maxRadius}  apex-band radius ${talon.apexBandMaxRadius}  normal [${talon.normal.join(', ')}]`);
}
const overlapPassCount = report.objectiveTalons.filter((talon) => talon.overlapFraction >= 0.6).length;
const facePassCount = report.objectiveTalons.filter((talon) => talon.faceAngleDegrees >= 25).length;
const minFaceAngle = Math.min(...report.objectiveTalons.map((talon) => talon.faceAngleDegrees));
const maxTalonRadius = Math.max(...report.objectiveTalons.map((talon) => talon.maxRadius));
const maxApexBandRadius = Math.max(...report.objectiveTalons.map((talon) => talon.apexBandMaxRadius));
console.log(`  a: ${overlapPassCount}/4 talons overlap mandorla x-range for >=60% of own height`);
console.log(`  b: ${facePassCount}/4 talon faces are >=25° from world +Z (camera plane); minimum ${minFaceAngle}°`);
console.log(`  geometry limits: ${report.objectiveTalons.length} talons, max radius ${maxTalonRadius}, apex-band max radius ${maxApexBandRadius}`);
const objectivePass = report.objectiveTalons.length === 4 && overlapPassCount >= 2 && facePassCount === 4 && maxTalonRadius <= 1.9 && maxApexBandRadius <= 0.4;
console.log(`  objective checks: ${objectivePass ? 'PASS' : 'FAIL'}`);
if (!objectivePass) process.exitCode = 1;

console.log('\n-- unified column no-shelf check --');
for (const sample of report.noShelf.samples) {
  console.log(`  Y${sample.y.toFixed(1)}: half-width ${sample.halfWidth ?? 'unavailable'}`);
}
console.log(`  tolerance per step: +${report.noShelf.tolerancePerStep}`);
console.log(`  no-shelf gate: ${report.noShelf.pass ? 'PASS' : 'FAIL'} (${report.noShelf.method})`);
if (!report.noShelf.pass) process.exitCode = 1;

console.log('\n-- mandorla luminance gate --');
for (const sample of luminance.samples ?? []) {
  console.log(`  ${Math.round(sample.heightFraction * 100)}% height Y${sample.worldY}: center ${sample.center}, side ${sample.side} (left ${sample.left}, right ${sample.right}), delta ${sample.delta} -> ${sample.pass ? 'PASS' : 'FAIL'}`);
}
console.log(`  luminance gate: ${luminance.pass ? 'PASS' : 'FAIL'} (${luminance.image})`);
if (!luminance.pass) process.exitCode = 1;

console.log('\n-- vault luminance gate --');
console.log(`  world band Y${vaultLuminance.worldBand.minY}-${vaultLuminance.worldBand.maxY}  center mean ${vaultLuminance.centerMean}  background mean ${vaultLuminance.backgroundMean}  delta +${vaultLuminance.delta}`);
console.log(`  vault luminance gate: ${vaultLuminance.pass ? 'PASS' : 'FAIL'} (${vaultLuminance.image})`);
if (!vaultLuminance.pass) process.exitCode = 1;

// Screen-space crossing check: at what y bands does any rib's x-range overlap the mandorla's x-range?
if (mandorla.length && arches.length) {
  const m = B[mandorla[0]];
  const myMin = m.min[1], myMax = m.max[1];
  console.log('\n-- overlap bands (rib crosses mandorla x-range) --');
  for (const n of arches) {
    const r = B[n];
    const xOverlapMin = Math.max(r.min[0], m.min[0]);
    const xOverlapMax = Math.min(r.max[0], m.max[0]);
    const xOverlap = Math.max(0, xOverlapMax - xOverlapMin);
    const yOverlap = Math.max(0, Math.min(r.max[1], myMax) - Math.max(r.min[1], myMin));
    console.log(
      `  ${n}: x-overlap ${Math.round(xOverlap * 100) / 100} (of rib width ${Math.round((r.max[0] - r.min[0]) * 100) / 100}), y-overlap ${Math.round(yOverlap * 100) / 100}`
    );
  }
}

await browser.close();
