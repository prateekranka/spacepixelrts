import { MAP, Ord, clamp, dist2 } from '../sim/engine';
import type { World } from '../sim/world';
import type { Renderer } from '../render/renderer';

export class Input {
  camX = 32;
  camZ = 32;
  zoom = 3;
  selected = new Set<number>();
  private dragging = false;
  private boxing = false;
  private box0 = { x: 0, y: 0 };
  private pan0 = { x: 0, y: 0, camX: 0, camZ: 0 };
  private pointers = new Map<number, { x: number; y: number }>();
  box: { x0: number; y0: number; x1: number; y1: number } | null = null;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly world: World,
    private readonly gfx: Renderer,
  ) {
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e));
    canvas.addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => this.wheel(e), { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (e.button === 1 || e.button === 2) {
      this.dragging = true;
      this.pan0 = { x: e.clientX, y: e.clientY, camX: this.camX, camZ: this.camZ };
      return;
    }
    if (this.pointers.size === 2) {
      this.dragging = true;
      this.boxing = false;
      return;
    }
    this.boxing = true;
    this.box0 = { x: e.clientX, y: e.clientY };
    this.box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
  }

  private move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      const dx = pts[0]!.x - pts[1]!.x;
      const dy = pts[0]!.y - pts[1]!.y;
      const dist = Math.hypot(dx, dy);
      if (!('_pinch' in this)) (this as unknown as { _pinch: number })._pinch = dist;
      const prev = (this as unknown as { _pinch: number })._pinch;
      const ratio = dist / (prev || dist);
      (this as unknown as { _pinch: number })._pinch = dist;
      if (ratio > 1.08) this.zoom = clamp(this.zoom + 1, 2, 4);
      else if (ratio < 0.92) this.zoom = clamp(this.zoom - 1, 2, 4);
      const mx = (pts[0]!.x + pts[1]!.x) / 2;
      const my = (pts[0]!.y + pts[1]!.y) / 2;
      this.nudgePan(mx - this.pan0.x, my - this.pan0.y);
      return;
    }
    if (this.dragging) {
      this.nudgePan(e.clientX - this.pan0.x, e.clientY - this.pan0.y);
      return;
    }
    if (this.boxing && this.box) {
      this.box.x1 = e.clientX;
      this.box.y1 = e.clientY;
    }
  }

  private up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (e.button === 2) {
      this.orderAt(e.clientX, e.clientY, Ord.AttackMove);
      this.dragging = false;
      return;
    }
    if (this.boxing && this.box) {
      const w = Math.abs(this.box.x1 - this.box.x0);
      const h = Math.abs(this.box.y1 - this.box.y0);
      if (w < 8 && h < 8) this.tap(e.clientX, e.clientY);
      else this.boxSelect();
    }
    this.boxing = false;
    this.dragging = false;
    this.box = null;
    delete (this as unknown as { _pinch?: number })._pinch;
  }

  private wheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.deltaY < 0) this.zoom = clamp(this.zoom + 1, 2, 4);
    else this.zoom = clamp(this.zoom - 1, 2, 4);
  }

  private nudgePan(dx: number, dy: number): void {
    const inv = 1 / (this.zoom * 24);
    this.camX = clamp(this.pan0.camX - dx * inv + dy * inv, 4, MAP - 4);
    this.camZ = clamp(this.pan0.camZ + dx * inv + dy * inv, 4, MAP - 4);
  }

  private tap(cx: number, cy: number): void {
    const w = this.gfx.screenToWorld(cx, cy, this.camX, this.camZ, this.zoom);
    let best = -1;
    let bestD = 1.1;
    for (const e of this.world.ents) {
      if (!e.alive || e.team !== 0 || e.kind >= 7) continue;
      const d = dist2(e.x, e.z, w.x, w.z);
      if (d < bestD) {
        bestD = d;
        best = e.id;
      }
    }
    this.selected.clear();
    if (best >= 0) this.selected.add(best);
    else this.orderAt(cx, cy, Ord.Move);
  }

  private boxSelect(): void {
    if (!this.box) return;
    const x0 = Math.min(this.box.x0, this.box.x1);
    const y0 = Math.min(this.box.y0, this.box.y1);
    const x1 = Math.max(this.box.x0, this.box.x1);
    const y1 = Math.max(this.box.y0, this.box.y1);
    this.selected.clear();
    for (const e of this.world.ents) {
      if (!e.alive || e.team !== 0 || e.kind >= 7) continue;
      const p = this.worldToCss(e.x, e.z);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) this.selected.add(e.id);
    }
  }

  private orderAt(cx: number, cy: number, ord: Ord): void {
    if (this.selected.size === 0) return;
    const w = this.gfx.screenToWorld(cx, cy, this.camX, this.camZ, this.zoom);
    let tid = -1;
    let best = 0.8;
    for (const e of this.world.ents) {
      if (!e.alive || e.team === 0) continue;
      const d = dist2(e.x, e.z, w.x, w.z);
      if (d < best) {
        best = d;
        tid = e.id;
      }
    }
    this.world.issue([...this.selected], tid >= 0 ? Ord.Attack : ord, w.x, w.z, tid);
  }

  private worldToCss(x: number, z: number): { x: number; y: number } {
    const cap = this.gfx.renderer.getPixelRatio();
    const origin = { sx: (this.camX - this.camZ) * 32, sy: (this.camX + this.camZ) * 16 };
    const p = { sx: (x - z) * 32, sy: (x + z) * 16 };
    const canvas = this.canvas;
    const r = canvas.getBoundingClientRect();
    const px = r.width / 2 + ((p.sx - origin.sx) * this.zoom) / cap;
    const py = r.height / 2 + ((p.sy - origin.sy) * this.zoom) / cap;
    return { x: r.left + px, y: r.top + py };
  }
}
