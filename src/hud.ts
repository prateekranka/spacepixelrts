/** P30 / P31 / P35 — AoE2-style command chrome for landscape iPad. */

import { Kind, MAP, Ord } from './engine';
import type { Civ } from './engine';
import {
  ALL_CIVS,
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
  EPOCH_NAME,
  minTrainEpoch,
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
  private matchEndEl: HTMLElement;
  private matchTitleEl: HTMLElement;
  private matchSubEl: HTMLElement;
  private idlewEl: HTMLButtonElement;
  private civPickEl: HTMLElement;
  private cmdsSig = '';
  private civSig = '';

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="topbar">
        <div id="brand">
          <span class="sigil">◆</span>
          <div>
            <strong id="civname">Helion Compact</strong>
            <em>Starhold</em>
          </div>
        </div>
        <div id="res">
          <span data-k="ore"><i></i><b id="ore">0</b><small>Ore</small></span>
          <span data-k="gas"><i></i><b id="gas">0</b><small>Vol</small></span>
          <span data-k="nrg"><i></i><b id="nrg">0</b><small>Chg</small></span>
          <span data-k="pop"><i></i><b id="pop">0/0</b><small>Pop</small></span>
        </div>
        <div id="meta">
          <button type="button" id="idlew">Idle worker</button>
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
      <div id="civpick" aria-label="Choose civilization"></div>
      <p id="hint">Landscape command deck · two-finger pan · pinch zoom · box-select to rally the swarm</p>
      <div id="match-end" hidden>
        <div class="match-panel">
          <h1 id="match-title">VICTORY</h1>
          <p id="match-sub">Enemy Nexus shattered</p>
        </div>
      </div>
    `;
    host.appendChild(this.root);
    this.minimap = this.root.querySelector('#minimap')!;
    this.mctx = this.minimap.getContext('2d')!;
    this.statsEl = this.root.querySelector('#selstats')!;
    this.cardEl = this.root.querySelector('#seltitle')!;
    this.cmdsEl = this.root.querySelector('#cmds')!;
    this.fpsEl = this.root.querySelector('#fps')!;
    this.hintEl = this.root.querySelector('#hint')!;
    this.matchEndEl = this.root.querySelector('#match-end')!;
    this.matchTitleEl = this.root.querySelector('#match-title')!;
    this.matchSubEl = this.root.querySelector('#match-sub')!;
    this.idlewEl = this.root.querySelector('#idlew')!;
    this.civPickEl = this.root.querySelector('#civpick')!;
    this.injectCss();
    this.renderCivPick(null);
  }

  bind(
    world: World,
    input: Input,
    view: GameRenderer,
    onCivSwitch: (civ: Civ) => void,
  ): void {
    this.civPickEl.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('button[data-civ]') as HTMLButtonElement | null;
      if (!btn || btn.disabled) return;
      const civ = btn.dataset.civ as Civ;
      if (civ === world.civ[0]) return;
      onCivSwitch(civ);
    });
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
    this.fpsEl.textContent = `${fps} FPS`;
    this.fpsEl.className = fps < 55 ? 'low' : '';
    const idlePulse = world.ents.some(
      (e) => e.alive && e.team === 0 && e.kind === Kind.Worker && e.hp > 0 && e.order === Ord.Idle,
    );
    this.idlewEl.classList.toggle('pulse', idlePulse);
    this.drawCivPick(world);
    this.drawMini(world, input);
    this.drawCard(world, input);
    this.drawMatchEnd(world);
  }

  private drawCivPick(world: World): void {
    const player = world.civ[0];
    const sig = `${player}|${world.civ[1]}`;
    if (sig !== this.civSig) {
      this.civSig = sig;
      this.renderCivPick(player);
    }
  }

  private renderCivPick(active: Civ | null): void {
    this.civPickEl.innerHTML = ALL_CIVS
      .map((civ) => {
        const on = civ === active;
        const cls = ['civ-tile', civ, on ? 'on' : ''].filter(Boolean).join(' ');
        return `<button type="button" data-civ="${civ}" class="${cls}" aria-pressed="${on}"><strong>${CIV_NAME[civ]}</strong><small>${civShort(civ)}</small></button>`;
      })
      .join('');
  }

  private drawMatchEnd(world: World): void {
    if (world.winner === -1) {
      this.matchEndEl.hidden = true;
      return;
    }
    this.matchEndEl.hidden = false;
    const win = world.winner === 0;
    this.matchEndEl.className = win ? 'win' : 'lose';
    this.matchTitleEl.textContent = win ? 'VICTORY' : 'DEFEAT';
    this.matchSubEl.textContent = win ? 'Enemy Nexus shattered' : 'Your Nexus is ash';
  }

  private handle(cmd: string, world: World, input: Input): void {
    if (cmd === 'idleworker') input.commandAt('idleworker');
    if (cmd === 'stop') input.commandAt('stop');
    if (cmd === 'move') {
      /* next terrain click is a move — already default */
    }
    if (cmd === 'attack') {
      /* user uses hold/right-click; flash hint */
      this.hintEl.textContent = 'Hold or right-click the field to attack-move.';
    }
    if (cmd === 'ageup') world.tryAgeUp(0);
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
    const civ = world.civ[0];
    if (ids.length === 0) {
      this.cardEl.textContent = 'Nothing selected';
      this.statsEl.textContent = `${CIV_NAME[civ]} — tap a unit, drag a box, hold or right-click to order.`;
      portrait.className = 'civ-plate';
      portrait.style.background = civPlateBg(civ);
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
    portrait.className = 'unit-plate';
    portrait.style.background = civPlateBg(e.civ);
    this.renderCmds(world, input, e.kind);
  }

  private renderCmds(world: World, input: Input, kind: Kind | null): void {
    const civ = world.civ[0];
    const eco = world.teams[0];
    const aging = eco.ageT > 0;
    const trainBtn = (kind: Kind, label: string, sub?: string, extraDisabled = false) => {
      const st = STATS[kind];
      const overCap = eco.pop + st.pop > eco.cap;
      const locked = minTrainEpoch(kind) > eco.epoch;
      return {
        cmd: `train-${kind}`,
        label,
        sub: locked ? EPOCH_NAME[minTrainEpoch(kind)]! : overCap ? 'pop cap' : (sub ?? `${st.ore} ore`),
        disabled: overCap || locked || extraDisabled,
      };
    };
    const btns: { cmd: string; label: string; sub?: string; disabled?: boolean }[] = [];
    if (kind === null) {
      btns.push({ cmd: 'idleworker', label: 'Idle worker', sub: 'find drone' });
      btns.push({ cmd: 'move', label: 'Move', sub: 'tap field', disabled: true });
      btns.push({ cmd: 'attack', label: 'Attack', sub: 'hold field', disabled: true });
      btns.push({ cmd: 'stop', label: 'Stop', sub: 'halt order', disabled: true });
    } else if (kind === Kind.Hall) {
      const canAge =
        eco.epoch === 0 && !aging && eco.ore >= 400 && eco.energy >= 80;
      btns.push({
        cmd: 'ageup',
        label: 'Spark → Orbit',
        sub: aging ? `${Math.ceil(eco.ageT)}s` : '400 ore · 80 chg',
        disabled: eco.epoch >= 1 || aging || !canAge,
      });
      btns.push(trainBtn(Kind.Worker, workerName(civ), undefined, aging));
      btns.push(trainBtn(Kind.Scout, 'Scout', undefined, aging));
      btns.push({ cmd: `build-${Kind.House}`, label: houseName(civ), sub: `${STATS[Kind.House].ore} ore` });
      btns.push({ cmd: `build-${Kind.Barracks}`, label: barracksName(civ), sub: `${STATS[Kind.Barracks].ore} ore` });
      btns.push({ cmd: `build-${Kind.UniqueB}`, label: uniqueName(civ), sub: `${STATS[Kind.UniqueB].ore} ore` });
    } else if (kind === Kind.Barracks) {
      btns.push(trainBtn(Kind.Fighter, fighterName(civ)));
      btns.push(trainBtn(Kind.Siege, 'Breaker'));
      btns.push(trainBtn(uniqueUnit(civ), labelOf(uniqueUnit(civ), civ)));
    } else if (kind === Kind.Worker) {
      btns.push({ cmd: `build-${Kind.House}`, label: houseName(civ), sub: `${STATS[Kind.House].ore} ore` });
      btns.push({ cmd: `build-${Kind.Barracks}`, label: barracksName(civ), sub: `${STATS[Kind.Barracks].ore} ore` });
      btns.push({ cmd: `build-${Kind.Hall}`, label: hallName(civ), sub: `${STATS[Kind.Hall].ore} ore` });
      btns.push({ cmd: `build-${Kind.UniqueB}`, label: uniqueName(civ), sub: `${STATS[Kind.UniqueB].ore} ore` });
      btns.push({ cmd: 'stop', label: 'Stop', sub: 'halt order' });
    } else if (kind !== null) {
      btns.push({ cmd: 'move', label: 'Move', sub: 'tap field' });
      btns.push({ cmd: 'attack', label: 'Attack', sub: 'hold field' });
      btns.push({ cmd: 'stop', label: 'Stop', sub: 'halt order' });
    }
    btns.push(
      { cmd: 'group-0', label: 'I', sub: 'group' },
      { cmd: 'group-1', label: 'II', sub: 'group' },
      { cmd: 'group-2', label: 'III', sub: 'group' },
    );
    const sig =
      `${kind ?? 'none'}|${input.place}|` +
      btns.map((b) => `${b.cmd}:${b.label}:${b.sub ?? ''}:${b.disabled ? 1 : 0}`).join('|');
    if (sig === this.cmdsSig) return;
    this.cmdsSig = sig;
    this.cmdsEl.innerHTML = btns
      .map((b) => {
        const placeOn = b.cmd.startsWith('build-') && input.place === Number(b.cmd.slice(6));
        const cls = ['verb', placeOn ? 'on' : ''].filter(Boolean).join(' ');
        const dis = b.disabled ? ' disabled' : '';
        return `<button type="button" data-cmd="${b.cmd}" class="${cls}"${dis}><strong>${b.label}</strong><small>${b.sub ?? ''}</small></button>`;
      })
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
        ctx.fillStyle =
          t === 2 ? '#3a3244' : t === 3 ? '#e0b84a' : t === 4 ? '#5aa8d0' : t === 5 ? '#ffd36a' : '#161022';
        if (!world.visible[0][i]) ctx.fillStyle = '#0c0a16';
        ctx.fillRect(x * sx, z * sz, sx * 2 + 0.5, sz * 2 + 0.5);
      }
    }
    for (const e of world.ents) {
      if (!e.alive || !e.vis) continue;
      ctx.fillStyle = e.team === 0 ? '#5eff5e' : e.team === 1 ? '#ff3a3a' : '#e0b84a';
      const s = isBuilding(e.kind) ? 3.6 : 2.4;
      ctx.fillRect(e.x * sx - s / 2, e.z * sz - s / 2, s, s);
    }
    const cam = input.pan;
    const rw = (input.halfH * 2 * (viewAspect())) / MAP * w;
    const rh = (input.halfH * 2) / MAP * h;
    const cx = cam.x * sx - rw / 2;
    const cy = cam.z * sz - rh / 2;
    ctx.strokeStyle = '#f0d460';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx, cy, rw, rh);
    ctx.strokeStyle = '#fff8d088';
    ctx.lineWidth = 1;
    ctx.strokeRect(cx + 1, cy + 1, Math.max(0, rw - 2), Math.max(0, rh - 2));
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

function civPlateBg(civ: Civ): string {
  if (civ === 'aurion') return 'linear-gradient(145deg,#163844 0%,#061018 100%)';
  if (civ === 'voidmarked') return 'linear-gradient(145deg,#2a0a28 0%,#1c3a22 100%)';
  return 'linear-gradient(145deg,#3a2818 0%,#1a0e08 100%)';
}

function civShort(civ: Civ): string {
  if (civ === 'aurion') return 'Ice cathedral';
  if (civ === 'voidmarked') return 'Void mycelium';
  return 'Solar geometry';
}

const HUD_CSS = `
#hud{position:fixed;inset:0;pointer-events:none;color:#f4efe4;font-family:"Trebuchet MS","Segoe UI",sans-serif;z-index:5}
#game,#overlay{position:absolute;inset:0;width:100%;height:100%;display:block}
#overlay{pointer-events:none;z-index:2}
#topbar,#bottom,#civpick,#civpick button{pointer-events:auto}
#topbar{position:absolute;left:0;right:0;top:0;box-sizing:border-box;height:calc(56px + env(safe-area-inset-top,0px));min-height:56px;padding-top:env(safe-area-inset-top,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);display:flex;align-items:stretch;background:linear-gradient(#1a1428ee,#120e1cf2);border-bottom:2px solid #c9a227;box-shadow:0 8px 24px #0008}
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
#res b{font-variant-numeric:tabular-nums;font-size:24px;font-weight:700;line-height:1}
#res [data-k=ore] b{color:#e8c060;text-shadow:0 0 10px #c4a54855}
#res [data-k=gas] b{color:#7ee7ff;text-shadow:0 0 10px #5aa8d055}
#res [data-k=nrg] b{color:#ffd36a;text-shadow:0 0 10px #e0b84a55}
#res [data-k=pop] b{color:#8ee88a;text-shadow:0 0 10px #7ec87a55}
#res small{opacity:.55;font-size:10px;letter-spacing:.12em;text-transform:uppercase}
#meta{display:flex;align-items:center;gap:12px;padding:0 14px}
#meta b{font-variant-numeric:tabular-nums;font-size:13px;opacity:.7}
#meta b.low{color:#e84d4d;opacity:1}
#idlew,#cmds button{background:#241a36;color:#f4efe4;border:1px solid #c9a22788;border-radius:2px;min-height:44px;min-width:44px;padding:6px 10px;font:inherit;cursor:pointer}
#idlew:hover,#cmds button:not(:disabled):hover{background:#35264c}
#idlew.pulse{animation:idlew-pulse 1.05s ease-in-out infinite;border-color:#f0d460;box-shadow:0 0 14px #c9a227aa,inset 0 0 10px #ffd36a33}
@keyframes idlew-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:1;box-shadow:0 0 22px #f0d460cc,inset 0 0 14px #ffd36a55}}
#bottom{position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;height:calc(168px + env(safe-area-inset-bottom,0px));min-height:168px;display:grid;grid-template-columns:168px 1fr 1.2fr;gap:10px;padding:8px calc(10px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));background:linear-gradient(#120e1cf2,#1a1428f4);border-top:2px solid #c9a227}
#minimap{width:148px;height:148px;image-rendering:pixelated;border:2px solid #c9a227;background:#07060f;align-self:center;margin-left:6px}
#card{display:flex;gap:12px;align-items:center;padding:8px 6px}
#portrait{width:72px;height:72px;border:2px solid #c9a227;background:#1a0e08;flex:none;box-shadow:inset 0 0 12px #0008;position:relative;overflow:hidden}
#portrait.civ-plate::before{content:"";position:absolute;inset:14%;border:2px solid #c9a227;transform:rotate(45deg);box-shadow:0 0 14px #f0d46066,inset 0 0 8px #ffd36a44}
#portrait.civ-plate::after{content:"◆";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:#f0d460;text-shadow:0 0 12px #ffd36a88}
#portrait.unit-plate::before{content:"";position:absolute;inset:0;border:1px solid #c9a22744}
#seltitle{margin:0 0 6px;font-size:16px;letter-spacing:.04em}
#selstats{margin:0;font-size:12px;opacity:.75;line-height:1.35;max-width:42ch}
#cmds{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;align-content:center;padding:6px}
#cmds button.verb{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;text-align:left;min-height:44px;min-width:44px;padding:8px 10px}
#cmds button.verb.on{border-color:#f0d460;background:linear-gradient(#3a2e18,#241a36);box-shadow:inset 0 0 0 2px #f0d460,0 0 10px #c9a22744}
#cmds button.verb:disabled{opacity:.38;cursor:not-allowed;filter:saturate(.55);border-color:#c9a22744}
#cmds button.verb strong{font-size:13px;letter-spacing:.02em}
#cmds small{opacity:.55;font-size:10px;letter-spacing:.04em}
#civpick{position:absolute;left:calc(10px + env(safe-area-inset-left,0px));top:calc(68px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:6px;pointer-events:auto;z-index:6}
#civpick .civ-tile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:132px;min-height:48px;padding:8px 12px;border:2px solid #c9a22766;border-radius:2px;background:#120e1cf0;color:#f4efe4;font:inherit;cursor:pointer;text-align:left;box-shadow:0 4px 16px #0006}
#civpick .civ-tile strong{font-size:12px;letter-spacing:.06em;text-transform:uppercase;line-height:1.2}
#civpick .civ-tile small{opacity:.6;font-size:9px;letter-spacing:.1em;text-transform:uppercase}
#civpick .civ-tile.vespari{background:linear-gradient(135deg,#3a2818 0%,#1a0e08 100%)}
#civpick .civ-tile.aurion{background:linear-gradient(135deg,#163844 0%,#061018 100%)}
#civpick .civ-tile.voidmarked{background:linear-gradient(135deg,#2a0a28 0%,#1c3a22 100%)}
#civpick .civ-tile.on{border-color:#f0d460;box-shadow:0 0 0 1px #000,0 0 18px #c9a22766,inset 0 0 0 2px #f0d46055}
#civpick .civ-tile:not(.on):hover{border-color:#c9a227;filter:brightness(1.08)}
#hint{position:absolute;left:50%;top:64px;transform:translateX(-50%);margin:0;font-size:11px;letter-spacing:.12em;text-transform:uppercase;opacity:.45;pointer-events:none;white-space:nowrap}
#match-end{position:absolute;left:50%;top:42%;transform:translate(-50%,-50%);pointer-events:none;z-index:8}
#match-end .match-panel{padding:18px 28px 16px;border:3px solid #c9a227;background:linear-gradient(#1a1428f2,#120e1cf0);box-shadow:0 0 0 2px #000,0 12px 40px #000a,inset 0 0 24px #0006;text-align:center;min-width:280px}
#match-end.win .match-panel{border-color:#7ec87a;box-shadow:0 0 0 2px #000,0 0 32px #7ec87a44,0 12px 40px #000a,inset 0 0 24px #0006}
#match-end.lose .match-panel{border-color:#e84d4d;box-shadow:0 0 0 2px #000,0 0 32px #e84d4d44,0 12px 40px #000a,inset 0 0 24px #0006}
#match-title{margin:0 0 8px;font-size:28px;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 2px 0 #000,0 0 16px #c9a22766}
#match-end.win #match-title{color:#8ee88a;text-shadow:0 2px 0 #000,0 0 20px #7ec87a88}
#match-end.lose #match-title{color:#ff6a6a;text-shadow:0 2px 0 #000,0 0 20px #e84d4d88}
#match-sub{margin:0;font-size:13px;letter-spacing:.08em;opacity:.82;text-transform:uppercase}
@media (orientation:portrait){
  #rotate-gate{display:flex !important}
  #hud,canvas{visibility:hidden}
}
`;
