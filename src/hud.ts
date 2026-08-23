/** P30 / P31 / P35 — AoE2-style command chrome for landscape iPad. */

import { DT, Kind, MAP, Ord, Tile } from './engine';
import type { Civ, Ent } from './engine';
import {
  CIV_NAME,
  CIV_PROFILE,
  STATS,
  TECH_PATHS,
  gateOpen,
  hallName,
  houseName,
  barracksName,
  uniqueName,
  workerName,
  fighterName,
  uniqueUnit,
  labelOf,
  isBuilding,
  pathsForCiv,
} from './content';
import type { TechPathId } from './content';
import type { Difficulty } from './match-config';
import type { AppEvent, AppState } from './app-flow';
import type { MatchStats, World } from './sim';
import type { Input } from './input';
import type { GameRenderer } from './render';
import { SEEN_PLAYER } from './discovery';
import type { LandmarkKind } from './discovery';
import { evaluateOpeningGuidance } from './opening-guidance';
import { STARHOLD_PALETTE as P } from './palette';

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
  private matchContinueEl: HTMLButtonElement;
  private resultsEl: HTMLElement;
  private idlewEl: HTMLButtonElement;
  private pauseEl: HTMLButtonElement;
  private boostsEl: HTMLDivElement;
  private civPickEl: HTMLElement;
  private lumenPanelEl!: HTMLElement;
  private lumenLabelEl!: HTMLElement;
  private lumenBarEl!: HTMLElement;
  private lumenPulseEl!: HTMLElement;
  private guidanceEl: HTMLElement;
  private guidanceTargetEl: HTMLElement;
  private cmdsSig = '';
  private civSig = '';
  private lumenSig = '';
  private guidanceSig = '';
  private world: World | null = null;
  private appState: AppState = 'Boot';
  private difficulty: Difficulty = 'standard';
  private visibleRequested = true;
  private continueDispatched = false;
  private terminalStats: MatchStats | null = null;
  private terminalTick = 0;
  private terminalOutcome: 'VICTORY' | 'DEFEAT' | null = null;
  private terminalCivs: [Civ, Civ] = ['vespari', 'aurion'];
  private terminalPaths: [TechPathId | null, TechPathId | null] = [null, null];
  private terminalDifficulty: Difficulty = 'standard';
  private onAppEvent: ((event: AppEvent) => void) | undefined;

  constructor(host: HTMLElement) {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.innerHTML = `
      <div id="topbar">
        <div id="brand">
          <span class="sigil">◆</span>
          <div>
            <strong id="civname">Helion Compact</strong>
            <em id="doctrine">Solar geometry</em>
          </div>
        </div>
        <div id="res">
          <span data-k="ore"><i></i><b id="ore">0</b><small>ORE</small></span>
          <span data-k="gas"><i></i><b id="gas">0</b><small>VOLATILES</small></span>
          <span data-k="nrg"><i></i><b id="nrg">0</b><small>CHARGE</small></span>
          <span class="resource-divider" aria-hidden="true"></span>
          <span data-k="pop"><i></i><b id="pop">0/0</b><small>POPULATION</small></span>
        </div>
        <div id="meta">
          <button type="button" id="scout-focus">FIND WIND STRIDER</button>
          <button type="button" id="idlew">FIND IDLE WORKER</button>
          <div id="boosts" aria-label="Energy boosts" hidden>
            <strong class="boost-title">CHARGE ABILITIES · ONE ACTIVE</strong>
            <button type="button" id="boost-prod" data-boost="1" title="Drains 8 Charge/s"><strong>▶ Fast Training</strong><small>Drains 8 Charge/s</small></button>
            <button type="button" id="boost-vision" data-boost="2" title="Drains 5 Charge/s"><strong>▶ Far Sight</strong><small>Drains 5 Charge/s</small></button>
            <button type="button" id="boost-shield" data-boost="3" title="Drains 6 Charge/s"><strong>▶ Building Repair</strong><small>Drains 6 Charge/s</small></button>
          </div>
          <button type="button" id="pause-toggle" aria-label="Pause simulation" title="Pause simulation">Ⅱ</button>
          <div id="zoom" aria-label="Zoom controls">
            <span>Zoom</span>
            <button type="button" id="zoom-out" aria-label="Zoom out" title="Zoom out">−</button>
            <button type="button" id="zoom-in" aria-label="Zoom in" title="Zoom in">+</button>
          </div>
          <b id="fps">60</b>
        </div>
      </div>
      <div id="bottom">
        <canvas id="minimap" width="220" height="220"></canvas>
        <div id="card">
          <div id="portrait"></div>
          <div id="selinfo">
            <h2 id="seltitle">Nothing selected</h2>
            <div id="selstats">Tap a unit. Drag a box. Hold or right-click to order.</div>
          </div>
        </div>
        <div id="cmds"></div>
      </div>
      <div id="civpick" aria-label="Current 1v1 matchup"></div>
      <p id="hint">Landscape command deck · two-finger pan · pinch zoom · box-select to rally the swarm</p>
      <aside id="guidance" aria-live="polite"><strong></strong><span></span></aside>
      <div id="guidance-target" aria-hidden="true" hidden><span></span></div>
      <div id="match-end" hidden>
        <div class="match-panel">
          <h1 id="match-title">VICTORY</h1>
          <p id="match-sub">Enemy Nexus shattered</p>
          <button type="button" id="match-continue">CONTINUE</button>
        </div>
      </div>
      <div id="results" hidden aria-live="polite"></div>
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
    this.matchContinueEl = this.root.querySelector('#match-continue')!;
    this.resultsEl = this.root.querySelector('#results')!;
    this.idlewEl = this.root.querySelector('#idlew')!;
    this.pauseEl = this.root.querySelector('#pause-toggle')!;
    this.boostsEl = this.root.querySelector('#boosts')!;
    this.civPickEl = this.root.querySelector('#civpick')!;
    this.guidanceEl = this.root.querySelector('#guidance')!;
    this.guidanceTargetEl = this.root.querySelector('#guidance-target')!;
    this.matchContinueEl.addEventListener('click', () => {
      if (this.continueDispatched || (this.appState !== 'Victory' && this.appState !== 'Defeat')) return;
      this.continueDispatched = true;
      this.matchContinueEl.disabled = true;
      this.onAppEvent?.('CONTINUE');
    });
    this.resultsEl.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest('button[data-results-action]') as HTMLButtonElement | null;
      if (!button || this.appState !== 'Results') return;
      const action = button.dataset.resultsAction as AppEvent | undefined;
      if (action === 'REMATCH' || action === 'MAIN_MENU') this.onAppEvent?.(action);
    });
    this.injectCss();
    this.renderCivPick(null, null);
  }

  bind(
    world: World,
    input: Input,
    view: GameRenderer,
    onPauseToggle: () => void,
    onAppEvent?: (event: AppEvent) => void,
  ): void {
    this.world = world;
    this.onAppEvent = onAppEvent;
    this.root.querySelector('#idlew')!.addEventListener('click', () => input.commandAt('idleworker'));
    this.root.querySelector('#scout-focus')!.addEventListener('click', () => input.focusScout());
    this.pauseEl.addEventListener('click', () => onPauseToggle());
    // M3-C — Sunweaver boost toggles: one active at a time, click again to turn off.
    this.boostsEl.addEventListener('click', (e) => {
      if (this.appState !== 'Playing' && this.appState !== 'TacticalPause') return;
      const btn = (e.target as HTMLElement).closest('button[data-boost]') as HTMLButtonElement | null;
      if (!btn) return;
      const kind = Number(btn.dataset.boost!);
      world.boosts[0] = world.boosts[0] === kind ? 0 : kind;
    });
    this.root.querySelector('#zoom-out')!.addEventListener('click', () => input.zoomOut());
    this.root.querySelector('#zoom-in')!.addEventListener('click', () => input.zoomIn());
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

  setVisible(visible: boolean): void {
    this.visibleRequested = visible;
    this.applyRootVisibility();
  }

  setAppState(state: AppState, difficulty: Difficulty = this.difficulty): void {
    const wasTerminal = this.appState === 'Victory' || this.appState === 'Defeat';
    this.appState = state;
    this.difficulty = difficulty;
    const isTerminal = state === 'Victory' || state === 'Defeat';
    if (isTerminal && !wasTerminal) {
      this.captureTerminal(state);
      this.continueDispatched = false;
      this.matchContinueEl.disabled = false;
    }
    this.root.classList.toggle('results-mode', state === 'Results');
    this.matchEndEl.hidden = !isTerminal;
    this.resultsEl.hidden = state !== 'Results';
    if (state === 'Results') this.renderResults();
    this.applyRootVisibility();
  }

  resetForMatch(): void {
    this.selectedResetSignatures();
    this.matchEndEl.hidden = true;
    this.resultsEl.hidden = true;
    this.root.classList.remove('results-mode');
    this.appState = 'Loading';
    this.continueDispatched = false;
    this.matchContinueEl.disabled = false;
    this.terminalStats = null;
    this.terminalTick = 0;
    this.terminalOutcome = null;
    this.terminalPaths = [null, null];
    this.applyRootVisibility();
  }

  setPaused(paused: boolean): void {
    this.pauseEl.textContent = paused ? '▶' : 'Ⅱ';
    this.pauseEl.title = paused ? 'Resume simulation' : 'Pause simulation';
    this.pauseEl.setAttribute('aria-label', paused ? 'Resume simulation' : 'Pause simulation');
    this.pauseEl.classList.toggle('paused', paused);
  }

  draw(world: World, input: Input, fps: number): void {
    if (this.appState === 'Results') return;
    const eco = world.teams[0];
    if (input.commandMode === 'move') this.hintEl.textContent = 'MOVE ARMED · Tap ground';
    else if (input.commandMode === 'attack') this.hintEl.textContent = 'ATTACK ARMED · Tap target or ground';
    else if (input.commandMode === 'gather') this.hintEl.textContent = 'GATHER ARMED · Tap a resource node';
    else if (this.hintEl.textContent.includes(' ARMED ·')) {
      this.hintEl.textContent = 'Landscape command deck · two-finger pan · pinch zoom · box-select to rally the swarm';
    }
    (this.root.querySelector('#ore') as HTMLElement).textContent = String(eco.ore | 0);
    (this.root.querySelector('#gas') as HTMLElement).textContent = String(eco.gas | 0);
    (this.root.querySelector('#nrg') as HTMLElement).textContent = String(eco.energy | 0);
    (this.root.querySelector('#pop') as HTMLElement).textContent = `${eco.pop}/${eco.cap}`;
    (this.root.querySelector('#civname') as HTMLElement).textContent = CIV_NAME[world.civ[0]];
    (this.root.querySelector('#doctrine') as HTMLElement).textContent = CIV_PROFILE[world.civ[0]].doctrine;
    const scoutFocus = this.root.querySelector('#scout-focus') as HTMLButtonElement;
    const scoutName = labelOf(Kind.Scout, world.civ[0]);
    scoutFocus.textContent = `FIND ${scoutName.toUpperCase()}`;
    scoutFocus.title = scoutName;
    // M3-C — boost strip only for Sunweaver; active button lit.
    this.boostsEl.hidden = world.civ[0] !== 'vespari';
    if (!this.boostsEl.hidden) {
      const active = world.boosts[0];
      const boostNames: Record<number, string> = {
        1: 'Fast Training',
        2: 'Far Sight',
        3: 'Building Repair',
      };
      for (const btn of this.boostsEl.querySelectorAll('button[data-boost]')) {
        const button = btn as HTMLButtonElement;
        const boost = Number(button.dataset.boost);
        const isActive = boost === active;
        button.classList.toggle('active', isActive);
        button.querySelector('strong')!.textContent = `${isActive ? '■ End' : '▶'} ${boostNames[boost]}`;
      }
    }
    this.fpsEl.textContent = `${fps} FPS`;
    this.fpsEl.className = fps < 55 ? 'low' : '';
    const idlePulse = world.ents.some(
      (e) => e.alive && e.team === 0 && e.kind === Kind.Worker && e.hp > 0 && e.order === Ord.Idle,
    );
    this.idlewEl.classList.toggle('pulse', idlePulse);
    this.drawCivPick(world);
    this.drawLumen(world);
    this.drawMini(world, input);
    this.drawCard(world, input);
    this.drawGuidance(world, input);
    this.drawMatchEnd();
  }

  private drawCivPick(world: World): void {
    const player = world.civ[0];
    const sig = `${player}|${world.civ[1]}`;
    if (sig !== this.civSig) {
      this.civSig = sig;
      this.renderCivPick(player, world.civ[1]);
    }
  }

  private renderCivPick(player: Civ | null, rival: Civ | null): void {
    if (!player || !rival) {
      this.civPickEl.innerHTML = `
        <span class="picker-label">1v1 matchup</span>
        <div id="lumen-objective" class="lumen-panel" hidden>
          <strong class="lumen-label"></strong>
          <div class="lumen-bar" aria-hidden="true" hidden><i></i></div>
          <small class="lumen-pulse" hidden></small>
        </div>`;
      this.bindLumenPanel();
      return;
    }
    this.civPickEl.innerHTML = `
      <span class="picker-label">1v1 matchup</span>
      <span class="civ-tile ${player} on"><strong>${CIV_NAME[player]}</strong><small>You</small></span>
      <span class="civ-tile ${rival} rival"><strong>${CIV_NAME[rival]}</strong><small>Rival</small></span>
      <div id="lumen-objective" class="lumen-panel" hidden>
        <strong class="lumen-label"></strong>
        <div class="lumen-bar" aria-hidden="true" hidden><i></i></div>
        <small class="lumen-pulse" hidden></small>
      </div>`;
    this.bindLumenPanel();
  }

  private bindLumenPanel(): void {
    this.lumenPanelEl = this.civPickEl.querySelector('#lumen-objective')!;
    this.lumenLabelEl = this.lumenPanelEl.querySelector('.lumen-label')!;
    this.lumenBarEl = this.lumenPanelEl.querySelector('.lumen-bar')!;
    this.lumenPulseEl = this.lumenPanelEl.querySelector('.lumen-pulse')!;
    this.lumenSig = '';
  }

  private drawLumen(world: World): void {
    const landmark = world.landmarks.find((entry) => entry.id === 'central-lumen-field');
    const seen = landmark !== undefined && (landmark.discoveredBy & SEEN_PLAYER) !== 0;
    if (!seen) {
      this.lumenPanelEl.hidden = true;
      this.lumenSig = '';
      return;
    }
    const state = world.lumenState();
    const faction = (team: number): string => team === 0 ? 'SUNWEAVER' : 'GRAVEMARK';
    let label = 'LUMEN · NEUTRAL';
    if (state.contested) label = 'LUMEN · CONTESTED';
    else if (state.capturing >= 0) label = `LUMEN · CAPTURING — ${faction(state.capturing)}`;
    else if (state.owner === 0) label = 'LUMEN · SUNWEAVER CONTROL';
    else if (state.owner === 1) label = 'LUMEN · GRAVEMARK CONTROL';
    const pulseSeconds = state.pulseRemaining[0] > 0 ? Math.ceil(state.pulseRemaining[0]) : 0;
    const signature = `${label}|${state.capturing}|${pulseSeconds}`;
    this.lumenPanelEl.hidden = false;
    if (signature !== this.lumenSig) {
      this.lumenSig = signature;
      this.lumenLabelEl.textContent = label;
      this.lumenPulseEl.textContent = pulseSeconds > 0 ? `VISION PULSE · ${pulseSeconds}s` : '';
      this.lumenPulseEl.hidden = pulseSeconds <= 0;
    }
    const capturing = state.capturing >= 0 && !state.contested;
    this.lumenBarEl.hidden = !capturing;
    if (capturing) {
      const pct = Math.max(0, Math.min(100, (state.progress / 5) * 100));
      (this.lumenBarEl.firstElementChild as HTMLElement).style.width = `${pct}%`;
    }
  }

  private drawGuidance(world: World, input: Input): void {
    const g = evaluateOpeningGuidance(world.ents, world.landmarks, input.selected, {
      ore: world.teams[0].ore,
      techPath: world.techPathOf(0),
      channelT: world.pathChannelT(0),
    });
    if (g.id !== this.guidanceSig) {
      this.guidanceSig = g.id;
      const strong = this.guidanceEl.querySelector<HTMLElement>('strong')!;
      const span = this.guidanceEl.querySelector<HTMLElement>('span')!;
      strong.textContent = g.primary;
      span.textContent = g.secondary ?? '';
      this.guidanceEl.dataset.state = g.id;
    }

    let target: { x: number; y: number; z: number; label: string } | null = null;
    if (g.id === 'select-scout') {
      const scout = world.ents.find(
        (entity) => entity.alive && entity.team === 0 && entity.kind === Kind.Scout,
      );
      if (scout) target = { x: scout.x, y: 0.8, z: scout.z, label: labelOf(Kind.Scout, world.civ[0]).toUpperCase() };
    } else if (g.id === 'explore-signal') {
      const signal = world.landmarks.find((landmark) => landmark.id === 'central-lumen-field');
      if (signal) target = { x: signal.x, y: 0.6, z: signal.z, label: 'SIGNAL' };
    }
    if (!target) {
      this.guidanceTargetEl.hidden = true;
      return;
    }

    const view = input.view;
    const projected = view.project(target.x, target.y, target.z);
    const rect = view.overlay.getBoundingClientRect();
    const rawX = rect.left + projected.x * (rect.width / Math.max(1, view.overlay.width));
    const rawY = rect.top + projected.y * (rect.height / Math.max(1, view.overlay.height));
    const x = Math.max(32, Math.min(window.innerWidth - 32, rawX));
    const y = Math.max(92, Math.min(window.innerHeight - 190, rawY));
    const offscreen = Math.abs(x - rawX) > 0.5 || Math.abs(y - rawY) > 0.5;
    this.guidanceTargetEl.hidden = false;
    this.guidanceTargetEl.style.left = `${x}px`;
    this.guidanceTargetEl.style.top = `${y}px`;
    this.guidanceTargetEl.dataset.offscreen = String(offscreen);
    this.guidanceTargetEl.querySelector<HTMLElement>('span')!.textContent = target.label;
  }

  private applyRootVisibility(): void {
    const matchState =
      this.appState === 'Playing' ||
      this.appState === 'TacticalPause' ||
      this.appState === 'Victory' ||
      this.appState === 'Defeat' ||
      this.appState === 'Results';
    this.root.hidden = !this.visibleRequested || !matchState;
  }

  private selectedResetSignatures(): void {
    this.cmdsSig = '';
    this.civSig = '';
    this.lumenSig = '';
    this.guidanceSig = '';
    this.guidanceTargetEl.hidden = true;
    this.resultsEl.innerHTML = '';
  }

  private captureTerminal(state: 'Victory' | 'Defeat'): void {
    if (!this.world) return;
    this.terminalStats = this.world.matchStats();
    this.terminalTick = this.world.tick;
    this.terminalOutcome = state === 'Victory' ? 'VICTORY' : 'DEFEAT';
    this.terminalCivs = [this.world.civ[0], this.world.civ[1]];
    this.terminalPaths = [this.world.techPathOf(0), this.world.techPathOf(1)];
    this.terminalDifficulty = this.difficulty;
  }

  private renderResults(): void {
    const stats = this.terminalStats ?? this.world?.matchStats() ?? {
      tick: this.terminalTick,
      teams: [
        { resources: { ore: 0, gas: 0, energy: 0 }, unitsTrained: 0, unitsLost: 0, coreDamage: 0 },
        { resources: { ore: 0, gas: 0, energy: 0 }, unitsTrained: 0, unitsLost: 0, coreDamage: 0 },
      ] as const,
    };
    const outcome = this.terminalOutcome ?? (this.appState === 'Victory' ? 'VICTORY' : 'DEFEAT');
    const pathName = (path: TechPathId | null): string =>
      path === null ? 'No path chosen' : TECH_PATHS.find((entry) => entry.id === path)?.name ?? path;
    const difficulty = this.terminalDifficulty.charAt(0).toUpperCase() + this.terminalDifficulty.slice(1);
    const resources = (team: (typeof stats.teams)[number]): string =>
      `${team.resources.ore | 0} / ${team.resources.gas | 0} / ${team.resources.energy | 0}`;
    const duration = formatDuration(stats.tick * DT);
    const player = stats.teams[0];
    const rival = stats.teams[1];
    const playerName = CIV_NAME[this.terminalCivs[0]];
    const rivalName = CIV_NAME[this.terminalCivs[1]];
    this.resultsEl.innerHTML = `
      <section id="results-panel" aria-label="Match results">
        <p class="results-kicker">MATCH COMPLETE // HELIOS RIFT</p>
        <h1 id="results-outcome">${outcome}</h1>
        <p id="results-duration">${duration}</p>
        <p id="results-matchup">${playerName} vs ${rivalName} · ${difficulty}</p>
        <div class="results-columns" aria-hidden="true">
          <span></span><strong>${playerName}</strong><strong>${rivalName}</strong>
        </div>
        <div class="results-table" role="table" aria-label="Match comparison">
          <div class="results-row" data-results-row="resources"><span>RESOURCES GATHERED<small>Ore / Volatiles / Charge</small></span><b>${resources(player)}</b><b>${resources(rival)}</b></div>
          <div class="results-row" data-results-row="trained"><span>UNITS TRAINED</span><b>${player.unitsTrained}</b><b>${rival.unitsTrained}</b></div>
          <div class="results-row" data-results-row="lost"><span>UNITS LOST</span><b>${player.unitsLost}</b><b>${rival.unitsLost}</b></div>
          <div class="results-row" data-results-row="damage"><span>CORE DAMAGE</span><b>${formatStat(player.coreDamage)}</b><b>${formatStat(rival.coreDamage)}</b></div>
          <div class="results-row" data-results-row="path"><span>TECHNOLOGY PATH</span><b>${pathName(this.terminalPaths[0])}</b><b>${pathName(this.terminalPaths[1])}</b></div>
        </div>
        <div class="results-actions">
          <button type="button" data-results-action="REMATCH">PLAY AGAIN</button>
          <button type="button" data-results-action="MAIN_MENU">MAIN MENU</button>
        </div>
      </section>`;
  }

  private drawMatchEnd(): void {
    if (this.appState !== 'Victory' && this.appState !== 'Defeat') {
      this.matchEndEl.hidden = true;
      return;
    }
    this.matchEndEl.hidden = false;
    const win = this.appState === 'Victory';
    this.matchEndEl.className = win ? 'win' : 'lose';
    this.matchTitleEl.textContent = win ? 'VICTORY' : 'DEFEAT';
    this.matchSubEl.textContent = win ? 'Enemy Nexus shattered' : 'Your Nexus is ash';
    this.matchContinueEl.disabled = this.continueDispatched;
  }

  private handle(cmd: string, world: World, input: Input): void {
    if (this.appState !== 'Playing' && this.appState !== 'TacticalPause' && cmd !== 'tech-focus') return;
    if (cmd === 'idleworker') input.commandAt('idleworker');
    if (cmd === 'stop') input.commandAt('stop');
    if (cmd === 'move') {
      input.commandAt('move');
      if (input.commandMode === 'move') this.hintEl.textContent = 'MOVE ARMED · Tap ground';
    }
    if (cmd === 'attack') {
      input.commandAt('attack');
      if (input.commandMode === 'attack') this.hintEl.textContent = 'ATTACK ARMED · Tap target or ground';
    }
    if (cmd === 'gather') {
      input.commandAt('gather');
      if (input.commandMode === 'gather') this.hintEl.textContent = 'GATHER ARMED · Tap a resource node';
    }
    if (cmd === 'tech-focus') {
      this.hintEl.textContent = input.focusHall() ? 'Choose one permanent path' : 'Build a Nexus first';
    }
    if (cmd.startsWith('path-')) world.tryCommitPath(0, cmd.slice(5) as TechPathId);
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
      input.commandMode = null;
      input.place = Number(cmd.slice(6)) as Kind;
      this.hintEl.textContent = 'Tap the field to plant the structure.';
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
    if (ids.length > 1) {
      const counts = new Map<string, number>();
      for (const id of ids) {
        const selected = world.ents[id];
        const label = labelOf(selected.kind, selected.civ);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      this.statsEl.innerHTML = `<div class="selection-counts">${[...counts]
        .map(([label, count]) => `<span><b>${count}×</b><small>${label}</small></span>`)
        .join('')}</div>`;
    } else {
      const st = STATS[e.kind];
      this.statsEl.innerHTML = `
        <dl class="stat-grid">
          <div><small>HP</small><b>${e.hp | 0}/${e.maxHp | 0}</b></div>
          <div><small>ATTACK</small><b>${st.atk}</b></div>
          <div><small>RANGE</small><b>${st.range}</b></div>
          <div><small>SPEED</small><b>${st.spd}</b></div>
          <div><small>SIGHT</small><b>${st.los}</b></div>
          <div><small>ORDER</small><b>${orderLabel(e.order)}</b></div>
        </dl>`;
    }
    portrait.className = 'unit-plate';
    portrait.style.background = civPlateBg(e.civ);
    this.renderCmds(world, input, e);
  }

  private renderCmds(world: World, input: Input, ent: Ent | null): void {
    const kind = ent?.kind ?? null;
    const civ = world.civ[0];
    const eco = world.teams[0];
    const channel = world.pathChannelT(0);
    const channeling = channel > 0;
    const costLabel = (cost: Pick<(typeof STATS)[number], 'ore' | 'gas' | 'energy'>): string => {
      const parts: string[] = [];
      if (cost.ore > 0) parts.push(`${cost.ore} Ore`);
      if (cost.gas > 0) parts.push(`${cost.gas} Volatiles`);
      if (cost.energy > 0) parts.push(`${cost.energy} Charge`);
      return parts.join(' · ');
    };
    const pathCost = costLabel({ ore: 400, gas: 0, energy: 80 });
    type CmdButton = {
      cmd: string;
      label: string;
      sub?: string;
      detail?: string;
      detailClass?: string;
      barPct?: number;
      disabled?: boolean;
      classes?: string[];
    };
    const trainBtn = (kind: Kind, label: string, sub?: string, extraDisabled = false) => {
      const st = STATS[kind];
      const overCap = eco.pop + st.pop > eco.cap;
      const locked = !gateOpen(eco, kind);
      return {
        cmd: `train-${kind}`,
        label,
        sub: locked ? 'Choose path first' : overCap ? 'pop cap' : (sub ?? costLabel(st)),
        disabled: overCap || locked || extraDisabled,
      };
    };
    const btns: CmdButton[] = [];
    if (ent === null) {
      if (world.techPathOf(0) === null) {
        btns.push({ cmd: 'tech-focus', label: 'TECHNOLOGY PATH', sub: 'Open Nexus research' });
      }
      btns.push({ cmd: 'idleworker', label: 'FIND IDLE WORKER', sub: 'find drone' });
      btns.push({ cmd: 'move', label: 'MOVE', sub: 'Tap ground to move', disabled: true });
      btns.push({ cmd: 'attack', label: 'ATTACK', sub: 'Tap target to attack', disabled: true });
      btns.push({ cmd: 'stop', label: 'STOP', sub: 'Cancel orders', disabled: true });
    } else if (kind === Kind.Hall) {
      // M4-B — the one irreversible technology-path choice lives on the Nexus deck.
      const committed = world.techPathOf(0);
      if (committed) {
        const info = TECH_PATHS.find((p) => p.id === committed)!;
        btns.push({
          cmd: 'path-locked',
          label: info.name,
          sub: '◆ Path set for this skirmish',
          detail: 'Combat units unlocked',
          detailClass: 'countdown',
          disabled: true,
          classes: ['choice', 'locked'],
        });
      } else {
        const afford = eco.ore >= 400 && eco.energy >= 80;
        const pending = world.pendingPathOf(0);
        for (const id of pathsForCiv(civ)) {
          if (channeling && pending !== null && id !== pending) continue;
          const info = TECH_PATHS.find((p) => p.id === id)!;
          const choiceClasses = ['choice'];
          if (channeling) choiceClasses.push('channel');
          else if (!afford) choiceClasses.push('unaffordable');
          const pct = channeling ? Math.round((1 - channel / 40) * 100) : undefined;
          btns.push({
            cmd: `path-${id}`,
            label: info.name,
            sub: info.blurb,
            detail: channeling ? `Committing · ${Math.ceil(channel)}s` : pathCost,
            detailClass: channeling ? 'countdown' : 'cost',
            barPct: pct,
            disabled: !afford || channeling || ent.trainT > 0,
            classes: choiceClasses,
          });
        }
      }
      btns.push(trainBtn(Kind.Worker, workerName(civ), undefined, channeling));
      btns.push(trainBtn(Kind.Scout, labelOf(Kind.Scout, civ), undefined, channeling));
      btns.push({ cmd: `build-${Kind.House}`, label: houseName(civ), sub: costLabel(STATS[Kind.House]) });
      btns.push({ cmd: `build-${Kind.Barracks}`, label: barracksName(civ), sub: costLabel(STATS[Kind.Barracks]) });
      btns.push({ cmd: `build-${Kind.UniqueB}`, label: uniqueName(civ), sub: costLabel(STATS[Kind.UniqueB]) });
    } else if (kind === Kind.Barracks) {
      if (world.techPathOf(0) === null) {
        btns.push({ cmd: 'tech-focus', label: 'CHOOSE PATH', sub: 'Open Nexus research' });
      }
      btns.push(trainBtn(Kind.Fighter, fighterName(civ)));
      btns.push(trainBtn(uniqueUnit(civ), labelOf(uniqueUnit(civ), civ)));
    } else if (kind === Kind.Worker) {
      btns.push({ cmd: `build-${Kind.House}`, label: houseName(civ), sub: costLabel(STATS[Kind.House]) });
      btns.push({ cmd: `build-${Kind.Barracks}`, label: barracksName(civ), sub: costLabel(STATS[Kind.Barracks]) });
      btns.push({ cmd: `build-${Kind.Hall}`, label: hallName(civ), sub: costLabel(STATS[Kind.Hall]) });
      btns.push({ cmd: `build-${Kind.UniqueB}`, label: uniqueName(civ), sub: costLabel(STATS[Kind.UniqueB]) });
      btns.push({ cmd: 'gather', label: 'GATHER', sub: 'Tap a resource node' });
      btns.push({ cmd: 'stop', label: 'STOP', sub: 'Cancel orders' });
    } else if (kind !== null) {
      btns.push({ cmd: 'move', label: 'MOVE', sub: 'Tap ground to move' });
      btns.push({ cmd: 'attack', label: 'ATTACK', sub: 'Tap target to attack' });
      btns.push({ cmd: 'stop', label: 'STOP', sub: 'Cancel orders' });
    }
    const sig =
      `${kind ?? 'none'}|${input.place}|${input.commandMode}|` +
      btns
        .map(
          (b) =>
            `${b.cmd}:${b.label}:${b.sub ?? ''}:${b.detail ?? ''}:${b.barPct ?? ''}:${b.disabled ? 1 : 0}:${b.classes?.join('.') ?? ''}`,
        )
        .join('|');
    if (sig === this.cmdsSig) return;
    this.cmdsSig = sig;
    this.cmdsEl.innerHTML = btns
      .map((b) => {
        const placeOn = b.cmd.startsWith('build-') && input.place === Number(b.cmd.slice(6));
        const commandOn = b.cmd === input.commandMode;
        const cls = (b.classes ?? ['verb', placeOn || commandOn ? 'on' : ''].filter(Boolean)).join(' ');
        const dis = b.disabled ? ' disabled' : '';
        const sub = b.sub === undefined ? '' : `<small class="sub">${b.sub}</small>`;
        const detail =
          b.detail === undefined
            ? ''
            : `<small class="detail${b.detailClass ? ` ${b.detailClass}` : ''}">${b.detail}</small>`;
        const bar =
          b.barPct === undefined
            ? ''
            : `<span class="bar-track"><i class="bar" style="width:${b.barPct}%"></i></span>`;
        return `<button type="button" data-cmd="${b.cmd}" class="${cls}"${dis}><strong>${b.label}</strong>${bar}${sub}${detail}</button>`;
      })
      .join('');
  }

  private drawMini(world: World, input: Input): void {
    const ctx = this.mctx;
    const w = this.minimap.width;
    const h = this.minimap.height;
    ctx.fillStyle = P.ink;
    ctx.fillRect(0, 0, w, h);
    const sx = w / MAP;
    const sz = h / MAP;
    for (let z = 0; z < MAP; z += 2) {
      for (let x = 0; x < MAP; x += 2) {
        const i = x + z * MAP;
        if (!world.explored[0][i]) continue;
        const t = world.tiles[i];
        const level = Math.min(3, world.height[i] | 0);
        const terrainBand = [P.deep, P.slate, P.steel, P.sand][level];
        ctx.fillStyle =
          t === Tile.Rock
            ? P.shadow
            : t === Tile.Ore
              ? P.ochre
              : t === Tile.Gas
                ? P.sky
                : t === Tile.Solar
                  ? P.amber
                  : terrainBand;
        if (!world.visible[0][i]) ctx.fillStyle = level > 0 ? P.shadow : P.ink;
        ctx.fillRect(x * sx, z * sz, sx * 2 + 0.5, sz * 2 + 0.5);
      }
    }
    for (const e of world.ents) {
      if (!e.alive) continue;
      const discovered = (e.seenBy & SEEN_PLAYER) !== 0;
      const px = e.x * sx;
      const pz = e.z * sz;
      if (e.kind === Kind.Resource) {
        if (!discovered) continue;
        ctx.fillStyle =
          e.cargoType === Tile.Ore
            ? P.amber
            : e.cargoType === Tile.Gas
              ? P.ice
              : e.cargoType === Tile.Solar
                ? P.cream
                : P.muted;
        ctx.beginPath();
        ctx.arc(px, pz, 3.4, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      const building = isBuilding(e.kind);
      if (e.team !== 0 && !e.vis && !(building && discovered)) continue;
      const remembered = e.team !== 0 && !e.vis;
      if (remembered) ctx.globalAlpha = 0.42;
      ctx.fillStyle = e.team === 0 ? P.lime : e.team === 1 ? P.red : P.amber;
      const s = building ? 3.6 : 2.4;
      ctx.fillRect(px - s / 2, pz - s / 2, s, s);
      if (remembered) ctx.globalAlpha = 1;
    }
    for (const landmark of world.landmarks) {
      if ((landmark.discoveredBy & SEEN_PLAYER) === 0) continue;
      const lumenOwner = landmark.id === 'central-lumen-field' ? world.lumenState().owner : -1;
      drawLandmarkMarker(ctx, landmark.x * sx, landmark.z * sz, landmark.kind, lumenOwner);
    }
    const cam = input.pan;
    const rw = (input.halfH * 2 * (viewAspect())) / MAP * w;
    const rh = (input.halfH * 2) / MAP * h;
    const cx = cam.x * sx - rw / 2;
    const cy = cam.z * sz - rh / 2;
    ctx.strokeStyle = P.amber;
    ctx.lineWidth = 3;
    ctx.strokeRect(cx, cy, rw, rh);
    ctx.strokeStyle = `${P.cream}88`;
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

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds + 1e-9));
  const minutes = Math.floor(whole / 60);
  const remainder = whole % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function formatStat(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function viewAspect(): number {
  return window.innerWidth / Math.max(1, window.innerHeight);
}

function drawLandmarkMarker(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: LandmarkKind,
  owner: -1 | 0 | 1 = -1,
): void {
  ctx.lineWidth = 1;
  switch (kind) {
    case 'central-objective': {
      const outer = 10.5;
      const inner = 6;
      const ring = owner === 1 ? P.ice : P.amber;
      const diamond = owner === 0 ? P.lime : owner === 1 ? P.sky : P.cream;
      ctx.save();
      ctx.fillStyle = `${P.ink}cc`;
      ctx.strokeStyle = ring;
      ctx.lineWidth = 3;
      ctx.shadowColor = ring;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(x, y, outer, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = diamond;
      ctx.strokeStyle = P.ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, y - inner);
      ctx.lineTo(x + inner, y);
      ctx.lineTo(x, y + inner);
      ctx.lineTo(x - inner, y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'relic': {
      ctx.strokeStyle = P.ice;
      ctx.beginPath();
      ctx.arc(x, y, 2.8, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'expansion': {
      const h = 2.9;
      ctx.strokeStyle = P.sand;
      ctx.strokeRect(x - h, y - h, h * 2, h * 2);
      break;
    }
    case 'safe-route': {
      const r = 3.1;
      ctx.fillStyle = P.lime;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y + r * 0.7);
      ctx.lineTo(x - r, y + r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case 'danger-route': {
      const r = 3.1;
      ctx.fillStyle = P.red;
      ctx.beginPath();
      ctx.moveTo(x, y + r);
      ctx.lineTo(x + r, y - r * 0.7);
      ctx.lineTo(x - r, y - r * 0.7);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

function civPlateBg(civ: Civ): string {
  if (civ === 'aurion') return `linear-gradient(145deg,${P.sky} 0%,${P.ink} 100%)`;
  if (civ === 'voidmarked') return `linear-gradient(145deg,${P.plum} 0%,${P.moss} 100%)`;
  return `linear-gradient(145deg,${P.sienna} 0%,${P.rust} 100%)`;
}

function orderLabel(order: Ord): string {
  if (order === Ord.Move) return 'Moving';
  if (order === Ord.Attack) return 'Attacking';
  if (order === Ord.Gather) return 'Gathering';
  if (order === Ord.Return) return 'Returning';
  if (order === Ord.Build) return 'Building';
  if (order === Ord.AttackMove) return 'Attack-moving';
  return 'Idle';
}

const HUD_CSS = `
#hud{position:fixed;inset:0;pointer-events:none;color:${P.cream};font-family:"Trebuchet MS","Segoe UI",sans-serif;z-index:5}
#game,#overlay{position:absolute;inset:0;width:100%;height:100%;display:block}
#overlay{pointer-events:none;z-index:2}
#topbar,#bottom{pointer-events:auto}
#topbar{position:absolute;left:0;right:0;top:0;box-sizing:border-box;height:calc(56px + env(safe-area-inset-top,0px));min-height:56px;padding-top:env(safe-area-inset-top,0px);padding-left:env(safe-area-inset-left,0px);padding-right:env(safe-area-inset-right,0px);display:flex;align-items:stretch;background:linear-gradient(${P.night}ee,${P.ink}f2);border-bottom:2px solid ${P.amber};box-shadow:0 8px 24px #0008}
#brand{display:flex;gap:10px;align-items:center;padding:0 14px;min-width:210px}
#brand .sigil{color:${P.amber};font-size:22px}
#brand strong{display:block;color:${P.cream};font-size:18px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
#brand em{display:block;font-style:normal;font-size:12px;font-weight:500;opacity:.85;letter-spacing:.18em;text-transform:uppercase}
#res{display:flex;flex:1;justify-content:center;gap:22px;align-items:center}
#res>span:not(.resource-divider){display:flex;align-items:center;gap:8px;min-width:90px}
#res .resource-divider{display:block;width:2px;min-width:2px;height:30px;margin:0 2px;background:${P.amber};opacity:.85;box-shadow:0 0 8px ${P.amber}66}
#res i{width:12px;height:12px;display:block;box-shadow:0 0 0 1px #0008}
#res [data-k=ore] i{background:${P.sand}}
#res [data-k=gas] i{background:${P.sky}}
#res [data-k=nrg] i{background:${P.ochre}}
#res [data-k=pop] i{background:${P.lime}}
#res b{font-variant-numeric:tabular-nums;font-size:24px;font-weight:700;line-height:1}
#res [data-k=ore] b{color:${P.amber};text-shadow:0 0 10px ${P.sand}55}
#res [data-k=gas] b{color:${P.ice};text-shadow:0 0 10px ${P.sky}55}
#res [data-k=nrg] b{color:${P.cream};text-shadow:0 0 10px ${P.ochre}55}
#res [data-k=pop] b{color:${P.lime};text-shadow:0 0 10px ${P.leaf}55}
#res small{opacity:.85;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase}
#meta{display:flex;align-items:center;gap:12px;padding:0 14px}
#meta b{font-variant-numeric:tabular-nums;font-size:12px;font-weight:500;opacity:.85}
#meta b.low{color:${P.coral};opacity:1}
#boosts{position:absolute;top:calc(100% + 6px);right:14px;z-index:6;box-sizing:border-box;width:420px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;align-items:stretch}
#boosts .boost-title{grid-column:1 / -1;color:${P.cream};font-size:12px;font-weight:500;line-height:14px;letter-spacing:.08em;opacity:.85;white-space:nowrap}
#boosts button{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;background:rgba(28,28,38,.92);border:1px solid #3a3a4c;color:${P.cream};min-height:44px;min-width:0;padding:4px 8px;border-radius:4px;cursor:pointer;letter-spacing:.03em;text-align:left}
#boosts button strong{font-size:18px;font-weight:700;line-height:20px}
#boosts button small{font-size:14px;font-weight:600;line-height:16px;opacity:.9}
#boosts button:hover{border-color:#7fa7b8}
#boosts button.active{background:${P.amber};border-color:${P.amber};color:#171326;font-weight:700}
#scout-focus,#idlew,#pause-toggle,#zoom button,#cmds button{background:${P.deep};color:${P.cream};border:1px solid ${P.amber}88;border-radius:2px;min-height:44px;min-width:44px;padding:6px 10px;font:inherit;cursor:pointer}
#scout-focus:hover,#idlew:hover,#pause-toggle:hover,#zoom button:hover,#cmds button:not(:disabled):hover{background:${P.plum}}
#pause-toggle{font-size:17px;line-height:1;padding:4px 8px}
#pause-toggle.paused{border-color:${P.coral};color:${P.coral};box-shadow:0 0 14px ${P.coral}55,inset 0 0 8px ${P.coral}22}
#zoom{display:flex;align-items:center;gap:4px}
#zoom span{font-size:12px;font-weight:500;letter-spacing:.1em;text-transform:uppercase;opacity:.85}
#zoom button{font-size:20px;line-height:1;padding:4px 10px}
#idlew.pulse{animation:idlew-pulse 1.05s ease-in-out infinite;border-color:${P.amber};box-shadow:0 0 14px ${P.amber}aa,inset 0 0 10px ${P.amber}33}
@keyframes idlew-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.06);opacity:1;box-shadow:0 0 22px ${P.amber}cc,inset 0 0 14px ${P.amber}55}}
#bottom{position:absolute;left:0;right:0;bottom:0;box-sizing:border-box;height:calc(112px + env(safe-area-inset-bottom,0px));min-height:112px;display:grid;grid-template-columns:168px 1fr 1.2fr;grid-template-rows:minmax(0,1fr);gap:10px;padding:8px calc(10px + env(safe-area-inset-right,0px)) calc(10px + env(safe-area-inset-bottom,0px)) calc(10px + env(safe-area-inset-left,0px));background:linear-gradient(${P.ink}f2,${P.night}f4);border-top:2px solid ${P.amber};overflow:visible}
#bottom>*{min-height:0}
#minimap{width:156px;height:156px;image-rendering:pixelated;border:2px solid ${P.amber};background:${P.ink};align-self:end;margin-left:6px}
#card{display:flex;gap:12px;align-items:center;min-height:0;padding:8px 6px}
#portrait{width:56px;height:56px;border:2px solid ${P.amber};background:${P.rust};flex:none;box-shadow:inset 0 0 12px #0008;position:relative;overflow:hidden}
#portrait.civ-plate::before{content:"";position:absolute;inset:14%;border:2px solid ${P.amber};transform:rotate(45deg);box-shadow:0 0 14px ${P.amber}66,inset 0 0 8px ${P.amber}44}
#portrait.civ-plate::after{content:"◆";position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:22px;color:${P.amber};text-shadow:0 0 12px ${P.amber}88}
#portrait.unit-plate::before{content:"";position:absolute;inset:0;border:1px solid ${P.amber}44}
#seltitle{margin:0 0 6px;color:${P.cream};font-size:18px;font-weight:700;letter-spacing:.04em}
#selstats{margin:0;font-size:12px;font-weight:500;opacity:.85;line-height:1.35;max-width:42ch}
#selstats .stat-grid{display:grid;grid-template-columns:repeat(3,minmax(56px,1fr));gap:6px 10px;margin:0}
#selstats .stat-grid>div{display:flex;flex-direction:column;gap:2px;min-width:0}
#selstats .stat-grid small{font-size:12px;font-weight:500;letter-spacing:.08em;opacity:.85}
#selstats .stat-grid b{font-size:18px;font-weight:700;line-height:1;color:${P.cream};white-space:nowrap}
#selstats .selection-counts{display:flex;flex-wrap:wrap;gap:6px 12px}
#selstats .selection-counts span{display:flex;align-items:baseline;gap:5px}
#selstats .selection-counts b{font-size:18px;font-weight:700;color:${P.cream}}
#selstats .selection-counts small{font-size:14px;font-weight:600;opacity:.9}
#cmds{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:6px;align-content:center;min-height:0;padding:6px}
#cmds button.verb{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:2px;text-align:left;min-height:44px;min-width:44px;padding:8px 10px}
#cmds button.verb.on{border-color:${P.amber};background:linear-gradient(${P.sienna},${P.deep});box-shadow:inset 0 0 0 2px ${P.amber},0 0 10px ${P.amber}44}
#cmds button.verb:disabled{opacity:.38;cursor:not-allowed;filter:saturate(.55);border-color:${P.amber}44}
#cmds button.verb strong{color:${P.cream};font-size:18px;font-weight:700;letter-spacing:.02em;line-height:20px}
#cmds small{display:block;letter-spacing:.04em}
#cmds small.sub{font-size:14px;font-weight:600;line-height:16px;opacity:.9}
#cmds small.detail{font-size:12px;font-weight:500;line-height:14px;opacity:.85}
#cmds button.choice{grid-column:1 / -1;box-sizing:border-box;display:flex;flex-direction:column;align-items:stretch;justify-content:flex-start;gap:4px;width:100%;height:auto;min-height:88px;min-width:44px;padding:8px 10px;background:${P.deep};border:1px solid ${P.amber};border-radius:2px;color:${P.cream};text-align:left}
#cmds button.choice>strong,#cmds button.choice>small,#cmds button.choice>.bar-track{flex:0 0 auto}
#cmds button.choice strong{color:${P.cream};font-size:18px;font-weight:700;line-height:20px;letter-spacing:.03em}
#cmds button.choice small.sub{font-size:14px;font-weight:600;line-height:16px;opacity:.9}
#cmds button.choice small.detail{font-size:12px;font-weight:500;line-height:14px;opacity:.85}
#cmds button.choice.unaffordable{opacity:.68;filter:saturate(.55)}
#cmds button.choice.unaffordable .cost{color:${P.coral}}
#cmds button.choice.channel{border-color:${P.amber}}
.countdown{margin:0;color:${P.amber};font-size:12px;font-weight:500;line-height:14px;opacity:.85;text-transform:uppercase}
#cmds button.choice.locked{background:${P.amber};border:1px solid ${P.amber};color:#171326}
#cmds button.choice.locked strong{color:#171326}
#cmds button.choice.locked small{color:#171326;opacity:.85}
#cmds button.choice:disabled{cursor:not-allowed}
.bar-track{position:relative;display:block;width:100%;height:10px;min-height:10px;margin:0;background:#ffffff22;border-radius:2px;overflow:hidden}
.bar{position:absolute;left:0;top:0;height:10px;min-height:10px;background:${P.amber};border-radius:2px}
#civpick{position:absolute;left:calc(10px + env(safe-area-inset-left,0px));top:calc(68px + env(safe-area-inset-top,0px));display:flex;flex-direction:column;gap:6px;pointer-events:none;z-index:6}
#civpick .picker-label{padding:0 4px;color:${P.amber};font-size:12px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;opacity:.85}
#civpick .civ-tile{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:132px;min-height:48px;padding:8px 12px;border:2px solid ${P.amber}66;border-radius:2px;background:${P.ink}f0;color:${P.cream};font:inherit;cursor:default;text-align:left;box-shadow:0 4px 16px #0006}
#civpick .civ-tile strong{font-size:18px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;line-height:1.2}
#civpick .civ-tile small{opacity:.9;font-size:14px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
#civpick .civ-tile.vespari{background:linear-gradient(135deg,${P.sienna} 0%,${P.rust} 100%)}
#civpick .civ-tile.aurion{background:linear-gradient(135deg,${P.sky} 0%,${P.ink} 100%)}
#civpick .civ-tile.voidmarked{background:linear-gradient(135deg,${P.plum} 0%,${P.moss} 100%)}
#civpick .civ-tile.on{border-color:${P.amber};box-shadow:0 0 0 1px #000,0 0 18px ${P.amber}66,inset 0 0 0 2px ${P.amber}55}
#civpick .civ-tile.rival{border-color:${P.ice}99}
#civpick .lumen-panel{box-sizing:border-box;width:156px;max-width:156px;padding:7px 8px;border:1px solid ${P.amber}99;border-radius:2px;background:${P.ink}f2;color:${P.cream};pointer-events:none;box-shadow:0 4px 16px #0008}
#civpick .lumen-panel[hidden]{display:none}
#civpick .lumen-panel strong{display:block;min-width:0;color:${P.amber};font-size:12px;font-weight:700;line-height:14px;letter-spacing:.04em;overflow-wrap:anywhere;text-transform:uppercase}
#civpick .lumen-bar{display:block;width:100%;height:6px;min-height:6px;margin-top:5px;background:#ffffff22;border-radius:1px;overflow:hidden}
#civpick .lumen-bar[hidden]{display:none}
#civpick .lumen-bar i{display:block;width:0;height:6px;background:${P.amber};border-radius:1px}
#civpick .lumen-pulse{display:block;margin-top:5px;color:${P.ice};font-size:12px;font-weight:600;line-height:14px;letter-spacing:.04em}
#civpick .lumen-pulse[hidden]{display:none}
#hint{position:absolute;left:50%;top:64px;transform:translateX(-50%);margin:0;font-size:12px;font-weight:500;letter-spacing:.12em;text-transform:uppercase;opacity:.45;pointer-events:none;white-space:nowrap}
#guidance{position:fixed;left:50%;top:calc(68px + env(safe-area-inset-top,0px));transform:translateX(-50%);box-sizing:border-box;width:min(460px,calc(100vw - 380px));margin:0;padding:8px 16px 9px;border:2px solid ${P.amber};background:linear-gradient(${P.night}f0,${P.ink}ec);box-shadow:0 0 0 2px #000,0 6px 18px #0008,inset 0 0 14px #0007;text-align:center;pointer-events:none;z-index:6;font-size:12px;line-height:1.35}
#guidance strong{display:block;color:${P.amber};font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-shadow:0 2px 0 #000,0 0 10px ${P.sand}55}
#guidance span{display:block;margin-top:3px;color:${P.cream};font-size:12px;font-weight:500;letter-spacing:.03em;opacity:.85}
#guidance span:empty{display:none}
#guidance-target{position:fixed;width:46px;height:46px;box-sizing:border-box;transform:translate(-50%,-50%);border:2px solid ${P.amber};border-radius:50%;box-shadow:0 0 0 2px #000b,0 0 14px ${P.amber}88,inset 0 0 0 3px #0008;pointer-events:none;z-index:7}
#guidance-target[hidden]{display:none}
#guidance-target[data-offscreen="true"]{border-radius:4px;background:${P.ink}b8}
#guidance-target span{position:absolute;left:50%;top:calc(100% + 5px);transform:translateX(-50%);padding:2px 5px;border:1px solid ${P.amber};background:${P.ink}e8;color:${P.cream};font-size:12px;font-weight:700;letter-spacing:.12em;line-height:1.1;white-space:nowrap;text-shadow:0 1px 0 #000}
#hud.results-mode #topbar,#hud.results-mode #bottom,#hud.results-mode #civpick,#hud.results-mode #hint,#hud.results-mode #guidance,#hud.results-mode #guidance-target{display:none}
#match-end{position:absolute;inset:0;display:grid;place-items:center;pointer-events:none;z-index:8;background:rgba(1,4,10,.72)}
#match-end[hidden],#results[hidden]{display:none}
#match-end .match-panel{box-sizing:border-box;width:min(430px,calc(100vw - 48px));padding:26px 30px 28px;border:3px solid ${P.amber};background:linear-gradient(${P.night}f2,${P.ink}f0);box-shadow:0 0 0 2px #000,0 12px 40px #000a,inset 0 0 24px #0006;text-align:center;pointer-events:auto}
#match-end.win .match-panel{border-color:${P.leaf};box-shadow:0 0 32px ${P.leaf}44,0 12px 40px #000a,inset 0 0 24px #0006}
#match-end.lose .match-panel{border-color:${P.red};box-shadow:0 0 32px ${P.red}44,0 12px 40px #000a,inset 0 0 24px #0006}
#match-title{margin:0 0 8px;font-size:28px;letter-spacing:.18em;text-transform:uppercase;text-shadow:0 2px 0 #000,0 0 16px ${P.amber}66}
#match-end.win #match-title{color:${P.lime};text-shadow:0 2px 0 #000,0 0 20px ${P.leaf}88}
#match-end.lose #match-title{color:${P.coral};text-shadow:0 2px 0 #000,0 0 20px ${P.red}88}
#match-sub{margin:0;font-size:13px;letter-spacing:.08em;opacity:.82;text-transform:uppercase}
#match-continue,.results-actions button{margin-top:24px;min-width:180px;min-height:44px;padding:8px 18px;border:1px solid ${P.amber};border-radius:2px;background:${P.deep};color:${P.cream};font:inherit;font-size:16px;font-weight:700;letter-spacing:.12em;cursor:pointer}
#match-continue:hover,.results-actions button:hover{background:${P.plum}}
#match-continue:disabled{opacity:.55;cursor:default}
#results{position:absolute;inset:0;display:grid;place-items:center;pointer-events:auto;z-index:8;padding:28px;box-sizing:border-box;background:radial-gradient(circle at 50% 38%,#17283b 0%,${P.ink} 64%)}
#results-panel{box-sizing:border-box;width:min(760px,100%);max-height:calc(100vh - 56px);overflow:auto;padding:30px 36px 28px;border:2px solid ${P.amber};background:linear-gradient(${P.night}f4,${P.ink}f2);box-shadow:0 0 0 2px #000,0 18px 60px #000b,inset 0 0 28px #0007;text-align:center}
.results-kicker{margin:0;color:${P.amber};font-size:12px;font-weight:700;letter-spacing:.18em;text-transform:uppercase}
#results-outcome{margin:12px 0 0;color:${P.lime};font-size:36px;letter-spacing:.18em;text-transform:uppercase}
#results-outcome:where(:not(:empty)){text-shadow:0 2px 0 #000,0 0 20px ${P.leaf}66}
#results-duration{margin:7px 0 0;color:${P.cream};font-size:25px;font-weight:700;letter-spacing:.08em;font-variant-numeric:tabular-nums}
#results-matchup{margin:8px 0 26px;color:${P.ice};font-size:13px;font-weight:600;letter-spacing:.1em;text-transform:uppercase}
.results-columns,.results-row{display:grid;grid-template-columns:minmax(180px,1.35fr) minmax(120px,1fr) minmax(120px,1fr);gap:14px;align-items:center}
.results-columns{padding:0 14px 7px;border-bottom:1px solid ${P.amber}88;color:${P.amber};font-size:13px;letter-spacing:.1em;text-transform:uppercase}
.results-row{min-height:48px;padding:8px 14px;border-bottom:1px solid #ffffff1c;text-align:left}
.results-row>span{color:${P.cream};font-size:12px;font-weight:700;letter-spacing:.08em}
.results-row>span small{display:block;margin-top:3px;color:${P.muted};font-size:10px;font-weight:500;letter-spacing:.04em;text-transform:none}
.results-row>b{color:${P.ice};font-size:15px;font-weight:700;line-height:1.25;text-align:center;overflow-wrap:anywhere}
.results-actions{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:24px}
.results-actions button{margin-top:0}
@media (max-width:640px){#results{padding:12px}.results-columns,.results-row{grid-template-columns:minmax(130px,1.2fr) minmax(80px,1fr) minmax(80px,1fr);gap:8px}.results-row{padding:8px 6px}.results-row>b{font-size:13px}#results-panel{padding:22px 12px}}
@media (orientation:portrait){
  #rotate-gate{display:flex !important}
  #hud,canvas{visibility:hidden}
}
`;
