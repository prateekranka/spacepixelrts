import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const PORT = 5173;
const URL = process.env.CRITIC_URL ?? `http://127.0.0.1:${PORT}/`;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

type Probe = {
  fps: number;
  frameMs: number;
  tick: number;
  ents: number;
  drawCalls: number | null;
  version: string;
};

function startDev(): Promise<{ stop: () => void }> {
  if (process.env.CRITIC_URL) return Promise.resolve({ stop: () => undefined });
  return new Promise((resolve, reject) => {
    const child = spawn('npm', ['run', 'dev'], {
      cwd: new URL('../', import.meta.url),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let buf = '';
    const onData = (d: Buffer) => {
      buf += d.toString();
      if (/Local:|5173/.test(buf)) {
        child.stdout?.off('data', onData);
        resolve({
          stop: () => {
            child.kill('SIGTERM');
          },
        });
      }
    };
    child.stdout?.on('data', onData);
    child.stderr?.on('data', onData);
    child.on('error', reject);
    setTimeout(() => reject(new Error('vite did not start')), 20000);
  });
}

function paletteStats(png: PNG): {
  colors: number;
  top: { rgb: string; n: number }[];
  meanLuma: number;
  lumaStd: number;
} {
  const counts = new Map<number, number>();
  let lumaSum = 0;
  let lumaSq = 0;
  const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const r = png.data[i]!;
    const g = png.data[i + 1]!;
    const b = png.data[i + 2]!;
    const rq = r >> 3;
    const gq = g >> 3;
    const bq = b >> 3;
    const key = (rq << 10) | (gq << 5) | bq;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumaSum += y;
    lumaSq += y * y;
  }
  const meanLuma = lumaSum / n;
  const lumaStd = Math.sqrt(Math.max(0, lumaSq / n - meanLuma * meanLuma));
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, c]) => {
      const r = ((k >> 10) & 31) * 8;
      const g = ((k >> 5) & 31) * 8;
      const b = (k & 31) * 8;
      return { rgb: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`, n: c };
    });
  return { colors: counts.size, top, meanLuma, lumaStd };
}

async function main(): Promise<void> {
  await mkdir(new URL('./out/', import.meta.url), { recursive: true });
  const dev = await startDev();
  const logs: string[] = [];
  const errors: string[] = [];
  const browser = await chromium.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--use-gl=angle', '--ignore-gpu-blocklist'],
  });
  try {
    const page = await browser.newPage({
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
    });
    page.on('console', (m) => {
      const t = `[${m.type()}] ${m.text()}`;
      logs.push(t);
      if (m.type() === 'error') errors.push(t);
    });
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(
      () => {
        const p = (window as unknown as { __STARHOLD__?: Probe }).__STARHOLD__;
        return p && p.tick > 8 && p.ents > 4;
      },
      { timeout: 20000 },
    );
    await page.waitForTimeout(400);
    const shot = await page.screenshot({ type: 'png', fullPage: false });
    const png = PNG.sync.read(shot);
    const pal = paletteStats(png);
    const probe = (await page.evaluate(() => (window as unknown as { __STARHOLD__: Probe }).__STARHOLD__)) as Probe;
    const canvasOk = await page.evaluate(() => {
      const c = document.getElementById('view') as HTMLCanvasElement | null;
      return !!c && c.width > 100 && c.height > 100;
    });
    const report = {
      ok: errors.length === 0 && probe.fps >= 50 && pal.colors >= 8 && pal.colors <= 220 && canvasOk,
      url: URL,
      probe,
      canvasOk,
      consoleErrors: errors,
      consoleLogTail: logs.slice(-20),
      screenshot: 'critic/out/frame.png',
      palette: pal,
      viewport: { w: 1180, h: 820, dpr: 2 },
      judgedAt: new Date().toISOString(),
      notes: [
        'WebGL drawing buffer is black if read directly — this screenshot is Playwright composited.',
        'colors = unique 5-bit-per-channel quantized hues. AoE2-like pixel art should land ~20–80, not 2000.',
        'Visual wow vs AoE2:DE still needs eyes (modlens or human). Metrics do not fake that.',
      ],
    };
    await writeFile(new URL('./out/frame.png', import.meta.url), shot);
    await writeFile(new URL('./out/latest.json', import.meta.url), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await browser.close();
    dev.stop();
  }
}

await main();
