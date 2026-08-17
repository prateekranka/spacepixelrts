/** P12 / P32 — camera + pointer. Landscape iPad first. */

import { Kind, MAP, Ord, dist2 } from './engine';
import { isBuilding, isUnit } from './content';
import type { World } from './sim';
import type { GameRenderer } from './render';
import type { Sfx } from './audio';

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Screen-space pick radius (CSS px) — matches ARCHITECTURE.md hit test. */
const PICK_PX = 28;

export class Input {
  selected = new Set<number>();
  groups: number[][] = [[], [], [], []];
  place: Kind | null = null;
  box: Box | null = null;
  halfH = 14;
  readonly pan = { x: 18, z: 22 };
  private dragging = false;
  private panning = false;
  private pointers = new Map<number, { x: number; y: number }>();
  private lastTap = 0;
  private lastTapId = -1;
  private pinch0 = 0;
  private moved = false;
  private downX = 0;
  private downY = 0;

  constructor(
    readonly host: HTMLElement,
    readonly world: World,
    readonly view: GameRenderer,
    readonly sfx: Sfx,
  ) {
    this.pan.x = MAP * 0.5;
    this.pan.z = MAP * 0.48;
    host.addEventListener('pointerdown', (e) => this.onDown(e));
    host.addEventListener('pointermove', (e) => this.onMove(e));
    host.addEventListener('pointerup', (e) => this.onUp(e));
    host.addEventListener('pointercancel', (e) => this.onUp(e));
    host.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoom(e.deltaY > 0 ? 1.08 : 0.92);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => this.onKey(e));
    host.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  tick(dt: number): void {
    const keys = Input.keys;
    const sp = this.halfH * 1.6 * dt;
    if (keys.has('KeyW') || keys.has('ArrowUp')) this.pan.z -= sp;
    if (keys.has('KeyS') || keys.has('ArrowDown')) this.pan.z += sp;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) this.pan.x -= sp;
    if (keys.has('KeyD') || keys.has('ArrowRight')) this.pan.x += sp;
    this.edgePan(dt);
    this.pan.x = Math.min(MAP - 4, Math.max(4, this.pan.x));
    this.pan.z = Math.min(MAP - 4, Math.max(4, this.pan.z));
    this.view.lookAt(this.pan.x, this.pan.z);
    this.view.setZoom(this.halfH);
  }

  commandAt(kind: 'move' | 'stop' | 'attack' | 'gather' | 'idleworker'): void {
    if (kind === 'stop') {
      for (const id of this.selected) {
        const e = this.world.ents[id];
        if (e.alive) {
          e.order = Ord.Idle;
          e.path = null;
        }
      }
      return;
    }
    if (kind === 'idleworker') {
      this.selected.clear();
      for (const e of this.world.ents) {
        if (e.alive && e.team === 0 && e.kind === Kind.Worker && e.order === Ord.Idle) {
          this.selected.add(e.id);
          this.pan.x = e.x;
          this.pan.z = e.z;
          this.sfx.select();
          return;
        }
      }
    }
  }

  private onDown(e: PointerEvent): void {
    const el = e.target as HTMLElement;
    if (el.closest('#topbar, #bottom, #civpick')) return;
    this.sfx.resume();
    this.host.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.moved = false;
    this.downX = e.clientX;
    this.downY = e.clientY;
    if (this.pointers.size === 2) {
      const pts = [...this.pointers.values()];
      this.pinch0 = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      this.panning = true;
      this.box = null;
      return;
    }
    if (e.button === 1 || e.altKey) {
      this.panning = true;
      return;
    }
    if (e.button === 2 || e.shiftKey) {
      this.orderAt(e.clientX, e.clientY, e.shiftKey);
      return;
    }
    this.dragging = true;
    this.box = { x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY };
  }

  private onMove(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
    const prev = this.pointers.get(e.pointerId)!;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (Math.abs(e.clientX - this.downX) + Math.abs(e.clientY - this.downY) > 8) this.moved = true;

    if (this.pointers.size === 2 && this.panning) {
      const pts = [...this.pointers.values()];
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      if (this.pinch0 > 1) this.zoom(this.pinch0 / Math.max(8, dist));
      this.pinch0 = dist;
      this.panByScreenDelta(dx, dy);
      return;
    }
    if (this.panning) {
      this.panByScreenDelta(dx, dy);
      return;
    }
    if (this.dragging && this.box) {
      this.box.x1 = e.clientX;
      this.box.y1 = e.clientY;
    }
  }

  private onUp(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.panning = false;
    if (e.button === 2) {
      this.dragging = false;
      this.box = null;
      return;
    }
    if (this.dragging && this.box && this.moved) {
      this.selectBox(this.box);
      this.sfx.select();
    } else if (this.dragging && !this.moved) {
      if (this.place !== null) this.tryPlace(e.clientX, e.clientY);
      else this.selectTap(e.clientX, e.clientY);
    }
    this.dragging = false;
    this.box = null;
    if (this.pointers.size === 0) this.panning = false;
  }

  private selectTap(cx: number, cy: number): void {
    const w = this.pickWorld(cx, cy);
    const now = performance.now();
    const hit = this.closest(w.x, w.z, 1.35, 0);
    if (hit && now - this.lastTap < 320 && this.lastTapId === hit.kind) {
      this.selected.clear();
      for (const e of this.world.ents) {
        if (e.alive && e.team === 0 && e.kind === hit.kind && e.vis) this.selected.add(e.id);
      }
      this.sfx.select();
      this.lastTap = 0;
      return;
    }
    this.selected.clear();
    if (hit) {
      this.selected.add(hit.id);
      this.lastTapId = hit.kind;
      this.lastTap = now;
      this.sfx.select();
    }
  }

  private selectBox(box: Box): void {
    this.selected.clear();
    const x0 = Math.min(box.x0, box.x1);
    const y0 = Math.min(box.y0, box.y1);
    const x1 = Math.max(box.x0, box.x1);
    const y1 = Math.max(box.y0, box.y1);
    if (x1 - x0 < 6 && y1 - y0 < 6) return;
    for (const e of this.world.ents) {
      if (!e.alive || e.team !== 0 || !e.vis || !isUnit(e.kind)) continue;
      const p = this.view.project(e.x, 0.6, e.z);
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) this.selected.add(e.id);
    }
  }

  private orderAt(cx: number, cy: number, attackMove: boolean): void {
    if (this.selected.size === 0) return;
    const w = this.pickWorld(cx, cy);
    const enemy = this.closestEnemyScreen(cx, cy);
    const node = enemy ? null : this.closestResource(cx, cy, w.x, w.z);
    const ids = [...this.selected];
    if (enemy) {
      this.world.issue(ids, Ord.Attack, enemy.x, enemy.z, enemy.id);
      this.sfx.attack();
    } else if (node && node.kind === Kind.Resource) {
      this.world.issue(ids, Ord.Gather, node.x, node.z, node.id);
      this.sfx.move();
    } else {
      this.world.issue(ids, attackMove ? Ord.AttackMove : Ord.Move, w.x, w.z, -1);
      this.sfx.move();
    }
  }

  private tryPlace(cx: number, cy: number): void {
    const kind = this.place;
    if (kind === null) return;
    const w = this.pickWorld(cx, cy);
    let builder = -1;
    for (const id of this.selected) {
      if (this.world.ents[id].kind === Kind.Worker) {
        builder = id;
        break;
      }
    }
    if (builder < 0) {
      for (const e of this.world.ents) {
        if (e.alive && e.team === 0 && e.kind === Kind.Worker) {
          builder = e.id;
          break;
        }
      }
    }
    if (builder < 0) return;
    if (this.world.tryPlace(0, kind, w.x, w.z, builder)) {
      this.sfx.build();
      this.place = null;
    }
  }

  /** Enemy attack pick: pointer must be on the sprite, not a world disk near the clash belt. */
  private closestEnemyScreen(cx: number, cy: number) {
    const r = this.host.getBoundingClientRect();
    const px = cx - r.left;
    const py = cy - r.top;
    let best = null as (typeof this.world.ents)[0] | null;
    let bestD = PICK_PX * PICK_PX;
    for (const e of this.world.ents) {
      if (!e.alive || !e.vis || e.team === 0) continue;
      const footY = isBuilding(e.kind) ? 1.65 : 0.6;
      const p = this.view.project(e.x, footY, e.z);
      const dx = p.x - px;
      const dy = p.y - py;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  /** Resource gather: modest world radius, but only when the pointer is on the node sprite. */
  private closestResource(cx: number, cy: number, wx: number, wz: number) {
    const node = this.closest(wx, wz, 1.5, 3);
    if (!node || node.kind !== Kind.Resource) return null;
    const r = this.host.getBoundingClientRect();
    const px = cx - r.left;
    const py = cy - r.top;
    const p = this.view.project(node.x, 0.05, node.z);
    const dx = p.x - px;
    const dy = p.y - py;
    if (dx * dx + dy * dy > PICK_PX * PICK_PX) return null;
    return node;
  }

  private closest(x: number, z: number, r: number, teamFilter: number) {
    let best = null as (typeof this.world.ents)[0] | null;
    let bestD = r * r;
    for (const e of this.world.ents) {
      if (!e.alive || !e.vis) continue;
      if (teamFilter === 0 && e.team !== 0) continue;
      if (teamFilter === 1 && e.team === 0) continue;
      if (teamFilter === 3 && e.kind !== Kind.Resource) continue;
      if (isBuilding(e.kind) && teamFilter === 0) {
        /* allow */
      }
      const pickR = isBuilding(e.kind) ? Math.max(r, 2.2) : r;
      const d = dist2(x, z, e.x, e.z);
      const rr = (pickR + e.radius) * (pickR + e.radius);
      if (d < rr && d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private pickWorld(cx: number, cy: number) {
    const r = this.host.getBoundingClientRect();
    return this.view.pick((cx - r.left) / r.width, (cy - r.top) / r.height);
  }

  /** Screen drag → ground-plane delta (iso-correct under 45° yaw). */
  private panByScreenDelta(dx: number, dy: number): void {
    const r = this.host.getBoundingClientRect();
    const p0 = this.view.pick(0.5, 0.5);
    const p1 = this.view.pick(0.5 + dx / r.width, 0.5 + dy / r.height);
    this.pan.x -= p1.x - p0.x;
    this.pan.z -= p1.z - p0.z;
  }

  private zoom(f: number): void {
    this.halfH = Math.min(28, Math.max(4, this.halfH * f));
  }

  private edgePan(dt: number): void {
    const r = this.host.getBoundingClientRect();
    const last = [...this.pointers.values()][0];
    if (!last || this.dragging || this.panning) return;
    const m = 18;
    const sp = this.halfH * 1.4 * dt;
    if (last.x - r.left < m) this.pan.x -= sp;
    if (r.right - last.x < m) this.pan.x += sp;
    if (last.y - r.top < m) this.pan.z -= sp;
    if (r.bottom - last.y < m) this.pan.z += sp;
  }

  private onKey(e: KeyboardEvent): void {
    if (e.code === 'Space') {
      e.preventDefault();
      this.commandAt('stop');
    }
    if (e.code === 'KeyH') this.commandAt('idleworker');
    const g = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3 }[e.code];
    if (g !== undefined) {
      if (e.metaKey || e.ctrlKey) this.groups[g] = [...this.selected];
      else {
        this.selected = new Set(this.groups[g]);
        const first = this.world.ents[this.groups[g][0]];
        if (first?.alive) {
          this.pan.x = first.x;
          this.pan.z = first.z;
        }
      }
    }
    if (e.code === 'KeyA' && this.selected.size) {
      /* next click attack-move via shift already */
    }
  }

  static keys = new Set<string>();
}

window.addEventListener('keydown', (e) => Input.keys.add(e.code));
window.addEventListener('keyup', (e) => Input.keys.delete(e.code));
