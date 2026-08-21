import { STARHOLD_PALETTE as P } from './palette';
import {
  cloneMatchConfig,
  validateMatchConfig,
  type Difficulty,
  type FactionId,
  type MatchConfig,
  type MatchSpeed,
  type SeedMode,
  type TacticalPauseMode,
} from './match-config';

export interface StartScreenCallbacks {
  onNewSkirmish: () => void;
  onBackToMenu: () => void;
  onConfigChange: (config: MatchConfig) => void;
  onStartMatch: (config: MatchConfig) => void;
}

type PanelKind = 'tutorial' | 'factions' | 'settings';
type ConfigField =
  | 'playerFaction'
  | 'aiFaction'
  | 'difficulty'
  | 'fogOfWar'
  | 'speed'
  | 'tacticalPause'
  | 'seedMode';

interface FactionSummary {
  id: FactionId;
  name: string;
  accent: string;
  sigil: string;
  summary: string;
}

const FACTIONS: Readonly<Record<FactionId, FactionSummary>> = {
  sunweaver: {
    id: 'sunweaver',
    name: 'Sunweaver',
    accent: P.amber,
    sigil: '✦',
    summary: 'Mobility, information, energy efficiency, elite precision.',
  },
  gravemark: {
    id: 'gravemark',
    name: 'Gravemark',
    accent: P.ice,
    sigil: '◌',
    summary: 'Extraction, armor, heavy production, positional control.',
  },
};

const otherFaction = (faction: FactionId): FactionId =>
  faction === 'sunweaver' ? 'gravemark' : 'sunweaver';

function seedEntryErrorFor(raw: string): string | null {
  if (raw.trim() === '') return 'Deterministic seed is required.';
  const value = Number(raw);
  if (!Number.isInteger(value)) return 'Seed must be an unsigned 32-bit integer.';
  if (value < 0) return 'Seed cannot be negative; use 0 through 4294967295.';
  if (value > 0xffffffff) return 'Seed cannot exceed 4294967295.';
  return null;
}

export class StartScreen {
  readonly root: HTMLElement;
  private readonly callbacks: StartScreenCallbacks;
  private readonly menuView: HTMLElement;
  private readonly setupView: HTMLElement;
  private readonly panel: HTMLElement;
  private readonly live: HTMLElement;
  private config: MatchConfig;
  private startEnabled = false;
  private seedEntryError: string | null = null;
  private panelTrigger: HTMLElement | null = null;
  private readonly keyHandler: (event: KeyboardEvent) => void;

  constructor(host: HTMLElement, callbacks: StartScreenCallbacks) {
    this.callbacks = callbacks;
    this.config = {
      playerFaction: 'sunweaver',
      aiFaction: 'gravemark',
      map: 'helios-rift',
      difficulty: 'standard',
      fogOfWar: true,
      speed: 1,
      tacticalPause: 'enabled',
      seedMode: 'random',
      seed: 0x5eed,
    };
    this.root = document.createElement('main');
    this.root.id = 'start-screen';
    this.root.setAttribute('aria-label', 'Starhaven front end');
    this.root.innerHTML = `
      <div class="start-shell">
        <section class="menu-view">
          <header class="start-heading">
            <p class="start-kicker">FRONTIER COMMAND DECK</p>
            <h1>Starhaven</h1>
            <p class="start-promise">Take the Helios Rift before your rival does.</p>
            <p class="start-note">A touch-first skirmish for one decisive front.</p>
          </header>
          <nav class="menu-list" aria-label="Main menu">
            <button type="button" class="menu-item" data-start-action="continue" disabled>
              <strong>Continue</strong><small>No saved match</small>
            </button>
            <button type="button" class="menu-item primary" data-start-action="new-skirmish">
              <strong>New Skirmish</strong><small>Deploy into the Helios Rift</small>
            </button>
            <button type="button" class="menu-item" data-start-action="tutorial">
              <strong>Tutorial</strong><small>The first ninety seconds</small>
            </button>
            <button type="button" class="menu-item" data-start-action="factions">
              <strong>Factions</strong><small>Sunweaver · Gravemark</small>
            </button>
            <button type="button" class="menu-item" data-start-action="settings">
              <strong>Settings</strong><small>Presentation only</small>
            </button>
          </nav>
          <footer class="start-footer">
            <span>STARHAVEN // HELIOS RIFT</span><span>SCOUT · CLAIM · ADAPT</span>
          </footer>
        </section>

        <section class="setup-view" hidden aria-label="New Skirmish setup">
          <header class="setup-heading">
            <div>
              <p class="start-kicker">NEW SKIRMISH // HELIOS RIFT</p>
              <h2>Choose the shape of the fight</h2>
            </div>
            <span class="setup-code">1V1 · FIRST PLAYABLE</span>
          </header>

          <div class="setup-grid">
            <section class="setup-card matchup-card" aria-labelledby="matchup-title">
              <div class="card-heading">
                <p class="start-kicker">FACTION MATCH-UP</p>
                <h3 id="matchup-title">Two distinct economies</h3>
              </div>

              <fieldset class="setup-field faction-field">
                <legend>Player civilization</legend>
                <div class="segment faction-segment" role="group" aria-label="Player civilization">
                  <button type="button" data-config-field="playerFaction" data-config-value="sunweaver">Sunweaver</button>
                  <button type="button" data-config-field="playerFaction" data-config-value="gravemark">Gravemark</button>
                </div>
                <div class="faction-summary player-summary"></div>
              </fieldset>

              <div class="versus-line"><span></span><b>VS</b><span></span></div>

              <fieldset class="setup-field faction-field">
                <legend>AI civilization</legend>
                <div class="segment faction-segment" role="group" aria-label="AI civilization">
                  <button type="button" data-config-field="aiFaction" data-config-value="sunweaver">Sunweaver</button>
                  <button type="button" data-config-field="aiFaction" data-config-value="gravemark">Gravemark</button>
                </div>
                <div class="faction-summary ai-summary compact"></div>
              </fieldset>
            </section>

            <section class="setup-card rules-card" aria-labelledby="rules-title">
              <div class="card-heading">
                <p class="start-kicker">MATCH RULES</p>
                <h3 id="rules-title">One shared battlefield</h3>
              </div>

              <div class="map-choice">
                <span><b>Helios Rift</b><small>Shared center · contested Lumen field</small></span>
                <em>SELECTED MAP</em>
              </div>

              ${this.segmentRow('AI difficulty', 'difficulty', [
                ['cadet', 'Cadet'], ['standard', 'Standard'], ['veteran', 'Veteran'],
              ])}
              ${this.segmentRow('Fog of War', 'fogOfWar', [['true', 'On'], ['false', 'Off']])}
              ${this.segmentRow('Match speed', 'speed', [['0.75', '0.75×'], ['1', '1×'], ['1.25', '1.25×']])}
              ${this.segmentRow('Tactical pause', 'tacticalPause', [
                ['enabled', 'Enabled'], ['on-demand', 'On-demand'],
              ])}
              ${this.segmentRow('Seed mode', 'seedMode', [['random', 'Random'], ['deterministic', 'Deterministic']])}

              <label class="seed-row" data-seed-row>
                <span><b>Deterministic seed</b><small>Unsigned 32-bit value</small></span>
                <input type="number" min="0" max="4294967295" step="1" inputmode="numeric" data-seed-input aria-label="Deterministic seed" />
              </label>
            </section>
          </div>

          <footer class="setup-actions">
            <button type="button" class="secondary-action" data-start-action="back">Back</button>
            <p class="setup-status" aria-live="polite"></p>
            <button type="button" class="primary-action" data-start-action="start-match" disabled>
              <strong>Start Match</strong><small>Match connection pending</small>
            </button>
          </footer>
          <p class="setup-live sr-only" aria-live="polite"></p>
        </section>

        <div class="start-panel" hidden>
          <div class="panel-scrim" data-start-action="close-panel"></div>
          <section class="panel-card" role="dialog" aria-modal="true" aria-labelledby="panel-title">
            <button type="button" class="panel-close" data-start-action="close-panel" aria-label="Close">×</button>
            <p class="start-kicker">STARHAVEN FIELD NOTES</p>
            <h2 id="panel-title"></h2>
            <div class="panel-content"></div>
          </section>
        </div>
      </div>
    `;
    host.appendChild(this.root);
    this.menuView = this.root.querySelector('.menu-view')!;
    this.setupView = this.root.querySelector('.setup-view')!;
    this.panel = this.root.querySelector('.start-panel')!;
    this.live = this.root.querySelector('.setup-live')!;
    this.keyHandler = (event) => {
      if (event.key === 'Escape' && !this.panel.hidden) this.closePanel();
    };
    window.addEventListener('keydown', this.keyHandler);
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.root.addEventListener('input', (event) => this.handleInput(event));
    this.injectCss();
    this.showMainMenu();
  }

  showMainMenu(): void {
    this.closePanel();
    this.menuView.hidden = false;
    this.setupView.hidden = true;
    this.root.querySelector<HTMLButtonElement>('[data-start-action="new-skirmish"]')?.focus();
  }

  showMatchSetup(config: MatchConfig, startEnabled = false): void {
    this.closePanel();
    this.config = cloneMatchConfig(config);
    this.startEnabled = startEnabled;
    this.seedEntryError = null;
    this.menuView.hidden = true;
    this.setupView.hidden = false;
    this.live.textContent = '';
    this.renderSetup();
    this.root.querySelector<HTMLButtonElement>('[data-config-field="playerFaction"]')?.focus();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }

  private segmentRow(
    label: string,
    field: ConfigField,
    values: ReadonlyArray<readonly [string, string]>,
  ): string {
    return `
      <div class="rule-row">
        <span class="rule-label">${label}</span>
        <div class="segment" role="group" aria-label="${label}">
          ${values.map(([value, copy]) => `<button type="button" data-config-field="${field}" data-config-value="${value}">${copy}</button>`).join('')}
        </div>
      </div>`;
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const action = target.closest<HTMLElement>('[data-start-action]');
    if (action) {
      switch (action.dataset.startAction) {
        case 'new-skirmish': this.callbacks.onNewSkirmish(); break;
        case 'back': this.callbacks.onBackToMenu(); break;
        case 'start-match':
          if (this.seedEntryError === null && this.startEnabled && validateMatchConfig(this.config).valid) {
            this.callbacks.onStartMatch(cloneMatchConfig(this.config));
          }
          break;
        case 'tutorial':
        case 'factions':
        case 'settings':
          this.openPanel(action.dataset.startAction, action);
          break;
        case 'close-panel': this.closePanel(); break;
      }
      return;
    }

    const control = target.closest<HTMLButtonElement>('[data-config-field]');
    if (!control) return;
    this.updateField(control.dataset.configField as ConfigField, control.dataset.configValue ?? '');
  }

  private handleInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.matches('[data-seed-input]')) return;
    const seedError = seedEntryErrorFor(input.value);
    if (seedError !== null) {
      this.markSeedEntryInvalid(seedError);
      return;
    }
    this.seedEntryError = null;
    this.commitConfig({ ...this.config, seed: Number(input.value) });
  }

  private markSeedEntryInvalid(message: string): void {
    this.seedEntryError = message;
    this.renderValidation([message]);
    this.root.querySelector<HTMLButtonElement>('[data-start-action="start-match"]')!.disabled = true;
  }

  private updateField(field: ConfigField, rawValue: string): void {
    let next = cloneMatchConfig(this.config);
    let announcement = '';
    if (field === 'playerFaction' || field === 'aiFaction') {
      const faction = rawValue as FactionId;
      next = { ...next, [field]: faction };
      if (next.playerFaction === next.aiFaction) {
        const other = otherFaction(faction);
        if (field === 'playerFaction') {
          next = { ...next, aiFaction: other };
          announcement = `AI civilization changed to ${FACTIONS[other].name} to prevent a mirror match.`;
        } else {
          next = { ...next, playerFaction: other };
          announcement = `Player civilization changed to ${FACTIONS[other].name} to prevent a mirror match.`;
        }
      }
    } else if (field === 'difficulty') {
      next = { ...next, difficulty: rawValue as Difficulty };
    } else if (field === 'fogOfWar') {
      next = { ...next, fogOfWar: rawValue === 'true' };
    } else if (field === 'speed') {
      next = { ...next, speed: Number(rawValue) as MatchSpeed };
    } else if (field === 'tacticalPause') {
      next = { ...next, tacticalPause: rawValue as TacticalPauseMode };
    } else if (field === 'seedMode') {
      next = { ...next, seedMode: rawValue as SeedMode };
    }
    this.commitConfig(next, announcement);
  }

  private commitConfig(next: MatchConfig, announcement = ''): void {
    const result = validateMatchConfig(next);
    if (!result.valid) {
      this.renderValidation(result.errors);
      return;
    }
    this.config = cloneMatchConfig(next);
    this.callbacks.onConfigChange(cloneMatchConfig(this.config));
    this.live.textContent = announcement;
    this.renderSetup();
  }

  private renderSetup(): void {
    const values: Readonly<Record<ConfigField, string>> = {
      playerFaction: this.config.playerFaction,
      aiFaction: this.config.aiFaction,
      difficulty: this.config.difficulty,
      fogOfWar: String(this.config.fogOfWar),
      speed: String(this.config.speed),
      tacticalPause: this.config.tacticalPause,
      seedMode: this.config.seedMode,
    };
    for (const button of this.root.querySelectorAll<HTMLButtonElement>('[data-config-field]')) {
      const field = button.dataset.configField as ConfigField;
      const selected = button.dataset.configValue === values[field];
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    }

    this.renderFactionSummary('.player-summary', this.config.playerFaction, 'Your force');
    this.renderFactionSummary('.ai-summary', this.config.aiFaction, 'AI rival');

    const seedRow = this.root.querySelector<HTMLElement>('[data-seed-row]')!;
    seedRow.hidden = this.config.seedMode !== 'deterministic';
    const seedInput = this.root.querySelector<HTMLInputElement>('[data-seed-input]')!;
    seedInput.value = String(this.config.seed >>> 0);

    const validation = validateMatchConfig(this.config);
    this.renderValidation(this.seedEntryError !== null ? [this.seedEntryError] : validation.errors);
    const start = this.root.querySelector<HTMLButtonElement>('[data-start-action="start-match"]')!;
    start.disabled = !this.startEnabled || !validation.valid || this.seedEntryError !== null;
    const note = start.querySelector('small')!;
    note.textContent = this.startEnabled ? 'Enter the Helios Rift' : 'Match connection pending';
  }

  private renderFactionSummary(selector: string, factionId: FactionId, kicker: string): void {
    const faction = FACTIONS[factionId];
    const target = this.root.querySelector<HTMLElement>(selector)!;
    target.dataset.faction = factionId;
    target.innerHTML = `
      <span class="faction-sigil" style="--faction-accent:${faction.accent}">${faction.sigil}</span>
      <span><small>${kicker}</small><strong>${faction.name}</strong><p>${faction.summary}</p></span>`;
  }

  private renderValidation(errors: readonly string[]): void {
    const status = this.root.querySelector<HTMLElement>('.setup-status')!;
    status.textContent = errors.length > 0 ? errors.join(' ') : `${FACTIONS[this.config.playerFaction].name} versus ${FACTIONS[this.config.aiFaction].name}`;
    status.classList.toggle('error', errors.length > 0);
  }

  private openPanel(kind: PanelKind, trigger: HTMLElement): void {
    this.panelTrigger = trigger;
    const title = this.panel.querySelector('#panel-title')!;
    const content = this.panel.querySelector('.panel-content')!;
    if (kind === 'tutorial') {
      title.textContent = 'The first ninety seconds';
      content.innerHTML = `
        <p class="panel-lead">Starhaven rewards a clear route across the Helios Rift, not frantic input.</p>
        <ol class="tutorial-list">
          <li><b>Scout</b><span>Find resources, routes, and the rival before committing workers.</span></li>
          <li><b>Claim</b><span>Build an economy that fits your civilization.</span></li>
          <li><b>Adapt</b><span>Choose a technology path and force a fight over shared ground.</span></li>
        </ol>`;
    } else if (kind === 'factions') {
      title.textContent = 'Two ways to take the Rift';
      content.innerHTML = `<div class="faction-list">${Object.values(FACTIONS).map((faction) => `
        <div class="faction-row"><span class="faction-sigil" style="--faction-accent:${faction.accent}">${faction.sigil}</span>
        <div class="faction-copy"><strong>${faction.name}</strong><p>${faction.summary}</p></div></div>`).join('')}</div>`;
    } else {
      title.textContent = 'Presentation';
      content.innerHTML = `<div class="settings-list">
        <div><b>Display</b><span>Landscape-first · safe-area aware</span></div>
        <div><b>Motion</b><span>Follows reduced-motion settings</span></div>
        <div><b>Input</b><span>Touch-first · keyboard fallback</span></div>
      </div><p class="panel-note">No accounts, stores, or online services live here.</p>`;
    }
    this.panel.hidden = false;
    this.panel.querySelector<HTMLButtonElement>('.panel-close')?.focus();
  }

  private closePanel(): void {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    this.panelTrigger?.focus();
    this.panelTrigger = null;
  }

  private injectCss(): void {
    document.getElementById('start-screen-css')?.remove();
    const style = document.createElement('style');
    style.id = 'start-screen-css';
    style.textContent = START_SCREEN_CSS;
    document.head.appendChild(style);
  }
}

const START_SCREEN_CSS = `
#start-screen{position:fixed;inset:0;z-index:30;overflow:auto;color:${P.cream};font-family:"Trebuchet MS","Segoe UI",sans-serif;background:radial-gradient(circle at 78% 38%,${P.plum}88 0%,transparent 32%),radial-gradient(circle at 16% 82%,${P.rust}55 0%,transparent 36%),linear-gradient(125deg,${P.ink} 0%,${P.night} 55%,${P.deep} 100%)}
#start-screen:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.14;background-image:linear-gradient(${P.cream}12 1px,transparent 1px),linear-gradient(90deg,${P.cream}12 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(90deg,black,transparent 88%)}
.start-shell{position:relative;box-sizing:border-box;min-height:100%;width:min(1240px,100%);margin:0 auto;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + clamp(24px,4vh,48px)) calc(env(safe-area-inset-right) + clamp(20px,4vw,64px)) calc(env(safe-area-inset-bottom) + 18px) calc(env(safe-area-inset-left) + clamp(20px,4vw,64px))}
.menu-view{display:grid;grid-template-columns:minmax(300px,.92fr) minmax(330px,.78fr);gap:clamp(30px,6vw,96px);align-items:center;flex:1}
.menu-view[hidden],.setup-view[hidden],.start-panel[hidden],[hidden]{display:none!important}
.start-kicker{margin:0;color:${P.amber};font-size:10px;letter-spacing:.22em;text-transform:uppercase}
.start-heading h1{margin:14px 0 12px;font-size:clamp(56px,6vw,84px);line-height:.86;letter-spacing:.03em;text-transform:uppercase;text-shadow:0 5px 0 ${P.rust}88,0 0 28px ${P.amber}22}
.start-promise{margin:0;color:${P.ice};font-size:clamp(17px,2vw,23px)}.start-note{color:${P.muted};font-size:13px}
.menu-list{display:flex;flex-direction:column;gap:12px;width:min(430px,100%)}
.menu-item,.secondary-action,.primary-action,.segment button{box-sizing:border-box;min-height:52px;border:1px solid ${P.muted}55;border-radius:3px;background:${P.ink}cc;color:${P.cream};font:inherit;cursor:pointer;touch-action:manipulation}
.menu-item{display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;width:100%;padding:10px 18px;text-align:left}.menu-item strong{font-size:14px;letter-spacing:.09em;text-transform:uppercase}.menu-item small{color:${P.muted};font-size:9px;letter-spacing:.13em;text-transform:uppercase}
.menu-item.primary,.primary-action:not(:disabled){border-color:${P.amber};background:linear-gradient(135deg,${P.rust}ee,${P.ochre}66);box-shadow:0 0 24px ${P.amber}18}.menu-item:disabled,.primary-action:disabled{opacity:.42;cursor:not-allowed}
button:focus-visible,input:focus-visible{outline:2px solid ${P.amber};outline-offset:3px}
.start-footer{grid-column:1/-1;display:flex;justify-content:space-between;color:${P.muted};font-size:9px;letter-spacing:.16em}
.setup-view{display:grid;grid-template-rows:auto 1fr auto auto;gap:16px;flex:1;min-height:0}.setup-heading{display:flex;justify-content:space-between;gap:20px;align-items:end}.setup-heading h2{margin:7px 0 0;font-size:clamp(26px,3vw,38px);font-weight:500}.setup-code{color:${P.muted};font-size:9px;letter-spacing:.16em}
.setup-grid{display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:18px;min-height:0}.setup-card{box-sizing:border-box;display:flex;flex-direction:column;padding:20px;border:1px solid ${P.amber}44;background:${P.ink}cc;box-shadow:0 18px 44px #0005}.card-heading{padding-bottom:12px;border-bottom:1px solid ${P.muted}2f}.card-heading h3{margin:5px 0 0;font-size:18px;font-weight:500}
.setup-field{margin:14px 0 0;padding:0;border:0}.matchup-card .setup-field{display:flex;flex:1;flex-direction:column;justify-content:center}.setup-field legend,.rule-label{color:${P.muted};font-size:10px;letter-spacing:.12em;text-transform:uppercase}.segment{display:flex;gap:6px}.segment button{min-width:44px;min-height:44px;flex:1;padding:8px 10px;color:${P.muted};font-size:11px}.segment button.selected{border-color:${P.amber};background:${P.plum};color:${P.cream};box-shadow:inset 0 -3px 0 ${P.amber}}
.faction-segment button[data-config-value="sunweaver"].selected{border-color:${P.amber};background:${P.rust};box-shadow:inset 0 -3px 0 ${P.amber},0 0 14px ${P.amber}22}.faction-segment button[data-config-value="gravemark"].selected{border-color:${P.ice};background:${P.fog};box-shadow:inset 0 -3px 0 ${P.ice},0 0 14px ${P.ice}22}
.faction-segment{margin-top:8px}.faction-summary{display:grid;grid-template-columns:44px 1fr;gap:12px;align-items:center;margin-top:10px;padding:10px;background:${P.deep}99;border-left:3px solid ${P.amber}}.faction-summary[data-faction="gravemark"]{border-left-color:${P.ice};background:${P.fog}66}.faction-summary.compact{padding:8px}.faction-summary small{display:block;color:${P.muted};font-size:8px;letter-spacing:.13em;text-transform:uppercase}.faction-summary strong{display:block;margin-top:2px;font-size:14px}.faction-summary p{margin:4px 0 0;color:${P.muted};font-size:10px;line-height:1.35}.faction-sigil{display:grid;place-items:center;width:42px;height:42px;border:1px solid var(--faction-accent);border-radius:50%;color:var(--faction-accent);font-size:21px}.versus-line{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center;margin:12px 0;color:${P.amber};font-size:10px}.versus-line span{height:1px;background:${P.muted}33}
.map-choice{display:flex;justify-content:space-between;gap:14px;align-items:center;min-height:52px;margin-top:12px;padding:8px 12px;border:1px solid ${P.amber}66;background:${P.deep}aa}.map-choice span{display:flex;flex-direction:column}.map-choice b{font-size:13px}.map-choice small{margin-top:3px;color:${P.muted};font-size:9px}.map-choice em{color:${P.amber};font-size:8px;font-style:normal;letter-spacing:.14em}
.rules-card .rule-row,.rules-card .seed-row{flex:1}.rule-row,.seed-row{display:grid;grid-template-columns:120px 1fr;gap:12px;align-items:center;min-height:52px;border-bottom:1px solid ${P.muted}22}.seed-row span{display:flex;flex-direction:column;color:${P.muted};font-size:10px}.seed-row small{font-size:8px}.seed-row input{box-sizing:border-box;width:100%;min-height:44px;padding:8px 10px;border:1px solid ${P.muted}55;background:${P.deep};color:${P.cream};font:inherit}
.setup-actions{display:grid;grid-template-columns:140px 1fr 230px;gap:14px;align-items:center}.secondary-action,.primary-action{padding:10px 16px}.primary-action{display:flex;flex-direction:column;align-items:flex-start}.primary-action strong{font-size:13px}.primary-action small{color:${P.muted};font-size:9px}.setup-status{margin:0;color:${P.muted};font-size:10px;text-align:center}.setup-status.error{color:${P.coral}}
.start-panel{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:calc(env(safe-area-inset-top) + 22px) calc(env(safe-area-inset-right) + 22px) calc(env(safe-area-inset-bottom) + 22px) calc(env(safe-area-inset-left) + 22px)}.panel-scrim{position:absolute;inset:0;background:#05040bdd;backdrop-filter:blur(5px)}.panel-card{position:relative;box-sizing:border-box;width:min(560px,100%);max-height:90vh;overflow:auto;padding:30px;border:1px solid ${P.amber}88;background:linear-gradient(145deg,${P.ink},${P.deep})}.panel-card h2{margin:8px 44px 20px 0;font-size:28px}.panel-close{position:absolute;right:14px;top:10px;width:44px;height:44px;border:0;background:transparent;color:${P.muted};font-size:28px}.panel-lead,.panel-note,.faction-copy p{color:${P.muted};font-size:12px;line-height:1.5}.tutorial-list{display:grid;gap:12px;padding:0;list-style:none}.tutorial-list li{display:grid;grid-template-columns:80px 1fr;gap:12px}.faction-list,.settings-list{display:grid;gap:10px}.faction-row{display:flex;gap:14px;align-items:center;padding:12px 0;border-top:1px solid ${P.muted}2f}.settings-list div{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-top:1px solid ${P.muted}2f}.settings-list span{color:${P.muted};font-size:11px}
.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media (prefers-reduced-motion:reduce){#start-screen *{transition:none!important}}
@media (max-width:900px){.menu-view,.setup-grid{grid-template-columns:1fr}.setup-view{overflow:auto}.setup-actions{grid-template-columns:1fr}.setup-status{text-align:left}}
`;
