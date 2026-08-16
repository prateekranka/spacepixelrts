/** P30 / P31 / P35 — AoE2-style command chrome for landscape iPad. */

import { Kind, MAP } from './engine';
import {
  CIV_NAME,
  STATS,
  hallName,
  houseName,
  barracksName,
  uniqueName,
  workerName,
  fighterName,
  uniqueUnit,
  labelOf,
  isBuilding,
} from './content';
import type { World } from './sim';
import type { Input } from './input';
import type { GameRenderer } from './render';

export class Hud {
  readonly root: HTMLElement;
  private minimap: HTMLCanvasElement;
  private mctx: CanvasRenderingContext2D;
  private statsEl: HTMLElement;
  private cardEl: HTMLElement;
  private cmdsEl: HTMLElement;
  private fpsEl: HTMLElement;
  private hintEl: HTMLElement;

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="topbar">
        <div id="brand">
          <span class="sigil">◆</span>
          <div>
            <strong id="civname">Vespari Hive</strong>
            <em>Spacepixel</em>
          </div>
        </div>
        <div id="res">
          <span data-k="ore"><i></i><b id="ore">0</b><small>Ore</small></span>
          <span data-k="gas"><i></i><b id="gas">0</b><small>Gas</small></span>
          <span data-k="nrg"><i></i><b id="nrg">0</b><small>Energy</small></span>
          <span data-k="pop"><i></i><b id="pop">0/0</b><small>Brood</small></span>
        </div>
        <div id="meta">
          <button type="button" id="idlew">Idle drone</button>
          <b id="fps">60</b>
        </div>
      </div>
      <div id="bottom">
        <canvas id="minimap" width="220" height="220"></canvas>
        <div id="card">
          <div id="portrait"></div>
          <div id="selinfo">
            <h2 id="seltitle">Nothing selected</h2>
            <p id="selstats">Tap a unit. Drag a box. Hold or right-click to order.</p>
          </div>
        </div>
        <div id="cmds"></div>
      </div>
      <p id="hint">Landscape command deck · two-finger pan · pinch zoom · box-select to rally the swarm</p>
    `;
    host.appendChild(this.root);
    this.minimap = this.root.querySelector('#minimap')!;
    this.mctx = this.minimap.getContext('2d')!;
    this.statsEl = this.root.querySelector('#selstats')!;
    this.cardEl = this.root.querySelector('#seltitle')!;
    this.cmdsEl = this.root.querySelector('#cmds')!;
    this.fpsEl = this.root.querySelector('#fps')!;
    this.hintEl = this.root.querySelector('#hint')!;
    this.injectCss();
  }

  bind(world: World, input: Input, view: GameRenderer): void {
    this.root.querySelector('#idlew')!.addEventListener('click', () => input.commandAt('idleworker'));
    this.minimap.addEventListener('pointerdown', (e) => {
      const r = this.minimap.getBoundingClientRect();
      const x = ((e.clientX - r.left) / r.width) * MAP;
      const z = ((e.clientY - r.top) / r.height) * MAP;
      input.pan.x = x;
      input.pan.z = z;
    });
    this.cmdsEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-cmd]') as HTMLButtonElement | null;
      if (!btn) return;
      const cmd = btn.dataset.cmd!;
      this.handle(cmd, world, input);
    });
    void view;
  }

  draw(world: World, input: Input, fps: number): void {
    const eco = world.teams[0];
    (this.root.querySelector('#ore') as HTMLElement).textContent = String(eco.ore | 0);
    (this.root.querySelector('#gas') as HTMLElement).textContent = String(eco.gas | 0);
    (this.root.querySelector('#nrg') as HTMLElement).textContent = String(eco.energy | 0);
    (this.root.querySelector('#pop') as HTMLElement).textContent = `${eco.pop}/${eco.cap}`;
    (this.root.querySelector('#civname') as HTMLElement).textContent = CIV_NAME[world.civ[0]];
    this.fpsEl.textContent = String(fps);
    this.fpsEl.className = fps < 55 ? 'low' : '';
    this.drawMini(world, input);
    this.drawCard(world, input);
  }

  private handle(cmd: string, world: World, input: Input): void {
    if (cmd === 'stop') input.commandAt('stop');
    if (cmd === 'move') {
      /* next terrain click is a move — already default */
    }
    if (cmd === 'attack') {
      /* user uses hold/right-click; flash hint */
      this.hintEl.textContent = 'Hold or right-click the field to attack-move.';
    }
    if (cmd.startsWith('train-')) {
      const kind = Number(cmd.slice(6)) as Kind;
      for (const id of input.selected) {
        const e = world.ents[id];
        if (e.alive && isBuilding(e.kind) && e.progress >= 1) {
          world.tryTrain(e, kind);
          break;
        }
      }
    }
    if (cmd.startsWith('build-')) {
      input.place = Number(cmd.slice(6)) as Kind;
      this.hintEl.textContent = 'Tap the field to plant the structure.';
    }
    if (cmd.startsWith('group-')) {
      const g = Number(cmd.slice(6));
      input.selected = new Set(input.groups[g]);
    }
  }

  private drawCard(world: World, input: Input): void {
    const ids = [...input.selected].filter((id) => world.ents[id].alive);
    const portrait = this.root.querySelector('#portrait') as HTMLElement;
    if (ids.length === 0) {
      this.cardEl.textContent = 'Nothing selected';
      this.statsEl.textContent = 'Tap a unit. Drag a box. Hold or right-click to order.';
      portrait.style.background = '#140f22';
      this.renderCmds(world, input, null);
      return;
    }
    const e = world.ents[ids[0]];
    const name = ids.length > 1 ? `${ids.length} selected` : labelOf(e.kind, e.civ);
    this.cardEl.textContent = name;
    const st = STATS[e.kind];
    this.statsEl.textContent =
      ids.length > 1
        ? ids.map((id) => labelOf(world.ents[id].kind, world.ents[id].civ)).slice(0, 6).join(' · ')
        : `HP ${e.hp | 0}/${e.maxHp}  ·  Atk ${st.atk}  ·  Range ${st.range}  ·  Sight ${st.los}`;
    portrait.style.background = e.civ === 'vespari' ? '#1c3a22' : e.civ === 'aurion' ? '#163844' : '#241436';
    this.renderCmds(world, input, e.kind);
  }

  private renderCmds(world: World, input: Input, kind: Kind | null): void {
    const civ = world.civ[0];
    const btns: { cmd: string; label: string; sub?: string }[] = [];
    if (kind === Kind.Hall) {
      btns.push({ cmd: `train-${Kind.Worker}`, label: workerName(civ), sub: `${STATS[Kind.Worker].ore} ore` });
      btns.push({ cmd: `train-${Kind.Scout}`, label: 'Scout', sub: `${STATS[Kind.Scout].ore} ore` });
      btns.push({ cmd: `build-${Kind.House}`, label: houseName(civ), sub: `${STATS[Kind.House].ore} ore` });
      btns.push({ cmd: `build-${Kind.Barracks}`, label: barracksName(civ), sub: `${STATS[Kind.Barracks].ore} ore` });
      btns.push({ cmd: `build-${Kind.UniqueB}`, label: uniqueName(civ), sub: `${STATS[Kind.UniqueB].ore} ore` });
    } else if (kind === Kind.Barracks) {
      btns.push({ cmd: `train-${Kind.Fighter}`, label: fighterName(civ), sub: `${STATS[Kind.Fighter].ore} ore` });
      btns.push({ cmd: `train-${Kind.Siege}`, label: 'Breaker', sub: `${STATS[Kind.Siege].ore} ore` });
      btns.push({ cmd: `train-${uniqueUnit(civ)}`, label: labelOf(uniqueUnit(civ), civ), sub: 'unique' });
    } else if (kind === Kind.Worker) {
      btns.push({ cmd: `build-${Kind.House}`, label: houseName(civ), sub: 'build' });
      btns.push({ cmd: `build-${Kind.Barracks}`, label: barracksName(civ), sub: 'build' });
      btns.push({ cmd: `build-${Kind.Hall}`, label: hallName(civ), sub: 'build' });
      btns.push({ cmd: `build-${Kind.UniqueB}`, label: uniqueName(civ), sub: 'build' });
      btns.push({ cmd: 'stop', label: 'Stop' });
    } else if (kind !== null) {
      btns.push({ cmd: 'move', label: 'Move' });
      btns.push({ cmd: 'attack', label: 'Attack' });
      btns.push({ cmd: 'stop', label: 'Stop' });
    }
    btns.push({ cmd: 'group-0', label: 'I' }, { cmd: 'group-1', label: 'II' }, { cmd: 'group-2', label: 'III' });
    this.cmdsEl.innerHTML = btns
      .map(
        (b) =>
          `<button type="button" data-cmd="${b.cmd}" class="${input.place === Number(b.cmd.slice(6)) ? 'on' : ''}"><strong>${b.label}</strong>${b.sub ? `<small>${b.sub}</small>` : ''}</button>`,
      )
      .join('');
  }

  private drawMini(world: World, input: Input): void {
    const ctx = this.mctx;
    const w = this.minimap.width;
    const h = this.minimap.height;
    ctx.fillStyle = '#07060f';
    ctx.fillRect(0, 0, w, h);
    const sx = w / MAP;
    const sz = h / MAP;
    for (let z = 0; z < MAP; z += 2) {
      for (let x = 0; x < MAP; x += 2) {
        const i = x + z * MAP;
        if (!world.explored[0][i]) continue;
        const t = world.tiles[i];
        ctx.fillStyle = t === 2 ? '#3a3244' : t === 3 ? '#c4a548' : t === 4 ? '#5aa8d0' : t === 5 ? '#e0b84a' : '#161022';
        if (!world.visible[0][i]) ctx.fillStyle = '#0c0a16';
        ctx.fillRect(x * sx, z * sz, sx * 2 + 0.5, sz * 2 + 0.5);
      }
    }
    for (const e of world.ents) {
      if (!e.alive || !e.vis) continue;
      ctx.fillStyle = e.team === 0 ? '#5ad45a' : e.team === 1 ? '#e84d4d' : '#c4a548';
      const s = isBuilding(e.kind) ? 3.4 : 2.2;
      ctx.fillRect(e.x * sx - s / 2, e.z * sz - s / 2, s, s);
    }
    const cam = input.pan;
    const rw = (input.halfH * 2 * (viewAspect())) / MAP * w;
    const rh = (input.halfH * 2) / MAP * h;
    ctx.strokeStyle = '#f0d460';
    ctx.lineWidth = 1;
    ctx.strokeRect(cam.x * sx - rw / 2, cam.z * sz - rh / 2, rw, rh);
  }

  private injectCss(): void {
    if (document.getElementById('hud-css')) return;
    const s = document.createElement('style');
    s.id = 'hud-css';
    s.textContent = HUD_CSS;
    document.head.appendChild(s);
  }
}

function viewAspect(): number {
  return window.innerWidth / Math.max(1, window.innerHeight);
}

const HUD_CSS = `
#hud{position:fixed;inset:0;pointer-events:none;color:#f4efe4;font-family:"Trebuchet MS","Segoe UI",sans-serif;z-index:5}
#topbar,#bottom,button{pointer-events:auto}
#topbar{position:absolute;left:0;right:0;top:0;height:56px;display:flex;align-items:stretch;background:linear-gradient(#1a1428ee,#120e1cf2);border-bottom:2px solid #c9a227;box-shadow:0 8px 24px #0008}
#brand{display:flex;gap:10px;align-items:center;padding:0 14px;min-width:210px}
#brand .sigil{color:#c9a227;font-size:22px}
#brand strong{display:block;font-size:14px;letter-spacing:.08em;text-transform:uppercase}
#brand em{display:block;font-style:normal;font-size:10px;opacity:.55;letter-spacing:.18em;text-transform:uppercase}
#res{display:flex;flex:1;justify-content:center;gap:22px;align-items:center}
#res span{display:flex;align-items:center;gap:8px;min-width:90px}
#res i{width:12px;height:12px;display:block;box-shadow:0 0 0 1px #0008}
#res [data-k=ore] i{background:#c4a548}
#res [data-k=gas] i{background:#5aa8d0}
#res [data-k=nrg] i{background:#e0b84a}
#res [data-k=pop] i{background:#7ec87a}
#res b{font-variant-numeric:tabular-nums;font-size:18px}
#res small{opacity:.55;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
#meta{display:flex;align-items:center;gap:12px;padding:0 14px}
#meta b{font-variant-numeric:tabular-nums;font-size:13px;opacity:.7}
#meta b.low{color:#e84d4d;opacity:1}
#idlew,#cmds button{background:#241a36;color:#f4efe4;border:1px solid #c9a22788;border-radius:2px;min-height:40px;padding:6px 10px;font:inherit;cursor:pointer}
#idlew:hover,#cmds button:hover{background:#35264c}
#bottom{position:absolute;left:0;right:0;bottom:0;height:168px;display:grid;grid-template-columns:168px 1fr 1.2fr;gap:10px;padding:8px 10px 10px;background:linear-gradient(#120e1cf2,#1a1428f4);border-top:2px solid #c9a227}
#minimap{width:148px;height:148px;image-rendering:pixelated;border:2px solid #c9a227;background:#07060f;align-self:center;margin-left:6px}
#card{display:flex;gap:12px;align-items:center;padding:8px 6px}
#portrait{width:72px;height:72px;border:2px solid #c9a227;background:#140f22;flex:none;box-shadow:inset 0 0 12px #0008}
#seltitle{margin:0 0 6px;font-size:16px;letter-spacing:.04em}
#selstats{margin:0;font-size:12px;opacity:.75;line-height:1.35;max-width:42ch}
#cmds{display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:6px;align-content:center;padding:6px}
#cmds button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left}
#cmds button.on{outline:2px solid #f0d460}
#cmds small{opacity:.55;font-size:10px}
#hint{position:absolute;left:50%;top:64px;transform:translateX(-50%);margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.45;pointer-events:none;white-space:nowrap}
@media (orientation:portrait){
  #rotate-gate{display:flex !important}
  #hud,canvas{visibility:hidden}
}
`;
