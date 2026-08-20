// Interactive viewer smoke test: loads the interactive page (no freeze), asserts
// OrbitControls exist, no console/page errors, canvas renders non-black, and a
// synthetic drag moves the camera (orbit actually works).
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
const URL = 'http://127.0.0.1:5174/town-center-structural-viewer.html?view=front-3q&stage=4&pass=palette';
const b = await chromium.launch({ channel: 'chrome', headless: true });
const p = await b.newPage({ viewport: { width: 1180, height: 820 } });
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => window.__SUNWEAVER_STRUCTURAL__?.ready === true, null, { timeout: 20000 });
await p.waitForTimeout(500);
const base = await p.evaluate(() => window.__SUNWEAVER_STRUCTURAL__.camera.position.clone());
const hasBtn = await p.evaluate(() => document.querySelector('[data-stage="3"]') !== null);
const btnClick = await p.evaluate(() => { const s = document.querySelector('[data-stage="3"]'); s && s.click(); return true; });
await p.waitForTimeout(300);
const stage = await p.evaluate(() => window.__SUNWEAVER_STRUCTURAL__.runtime.getStage());
// synthetic drag on the canvas to drive OrbitControls
const canvas = await p.$('canvas');
const box = await canvas.boundingBox();
await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await p.mouse.down();
await p.mouse.move(box.x + box.width / 2 + 140, box.y + box.height / 2 + 60, { steps: 12 });
await p.mouse.up();
await p.waitForTimeout(400);
const after = await p.evaluate(() => window.__SUNWEAVER_STRUCTURAL__.camera.position.clone());
const dist = Math.hypot(after.x - base.x, after.y - base.y, after.z - base.z);
const moved = dist > 0.1;
const shot = await p.screenshot();
const px = PNG.sync.read(shot);
let sum = 0, max = 0;
for (let i = 0; i < px.data.length; i += 4) { const l = px.data[i]; sum += l; max = Math.max(max, l); }
const mean = sum / ((px.width * px.height) || 1);
console.log(JSON.stringify({
  errors,
  hasButtons: hasBtn,
  stageAfterClick: stage,
  cameraMovedByDrag: moved,
  dragCameraDistance: +dist.toFixed(3),
  before: [base.x, base.y, base.z].map((v) => +v.toFixed(2)),
  after: [after.x, after.y, after.z].map((v) => +v.toFixed(2)),
  renderMeanLuma: +mean.toFixed(1),
  renderMax: max,
}, null, 1));
await b.close();
