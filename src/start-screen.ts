import { STARHOLD_PALETTE as P } from './palette';

export interface StartScreenCallbacks {
  onNewSkirmish: () => void;
  onBackToMenu: () => void;
}

type PanelKind = 'tutorial' | 'factions' | 'settings';

interface FactionSummary {
  name: string;
  accent: string;
  sigil: string;
  summary: string;
}

const FACTIONS: readonly FactionSummary[] = [
  {
    name: 'Sunweaver',
    accent: P.amber,
    sigil: '✦',
    summary: 'Mobility, information, energy efficiency, elite precision.',
  },
  {
    name: 'Gravemark',
    accent: P.ice,
    sigil: '◌',
    summary: 'Extraction, armor, heavy production, positional control.',
  },
];

export class StartScreen {
  readonly root: HTMLElement;
  private readonly callbacks: StartScreenCallbacks;
  private readonly menuView: HTMLElement;
  private readonly setupView: HTMLElement;
  private readonly panel: HTMLElement;
  private panelTrigger: HTMLElement | null = null;
  private keyHandler: (event: KeyboardEvent) => void;

  constructor(host: HTMLElement, callbacks: StartScreenCallbacks) {
    this.callbacks = callbacks;
    this.root = document.createElement('main');
    this.root.id = 'start-screen';
    this.root.setAttribute('aria-label', 'Starhaven main menu');
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
              <strong>Continue</strong>
              <small>No saved match</small>
            </button>
            <button type="button" class="menu-item primary" data-start-action="new-skirmish">
              <strong>New Skirmish</strong>
              <small>Deploy into the Helios Rift</small>
            </button>
            <button type="button" class="menu-item" data-start-action="tutorial">
              <strong>Tutorial</strong>
              <small>The first ninety seconds</small>
            </button>
            <button type="button" class="menu-item" data-start-action="factions">
              <strong>Factions</strong>
              <small>Sunweaver · Gravemark</small>
            </button>
            <button type="button" class="menu-item" data-start-action="settings">
              <strong>Settings</strong>
              <small>Presentation only</small>
            </button>
          </nav>
        </section>
        <footer class="start-footer">
          <span>STARHAVEN // HELIOS RIFT</span>
          <span>SCOUT · CLAIM · ADAPT</span>
        </footer>
        <section class="setup-view" hidden aria-label="Match setup">
          <div class="setup-card">
            <p class="start-kicker">NEW SKIRMISH</p>
            <h2>Match setup</h2>
            <p class="setup-copy">Map, rival, and technology path choices arrive with the next milestone. Nothing has been configured yet.</p>
            <button type="button" class="menu-item back" data-start-action="back">
              <strong>Back</strong>
              <small>Return to the main menu</small>
            </button>
          </div>
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
    this.keyHandler = (event) => {
      if (event.key === 'Escape' && !this.panel.hidden) this.closePanel();
    };
    window.addEventListener('keydown', this.keyHandler);
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.injectCss();
    this.showMainMenu();
  }

  showMainMenu(): void {
    this.closePanel();
    this.menuView.hidden = false;
    this.setupView.hidden = true;
    const primary = this.root.querySelector<HTMLButtonElement>('[data-start-action="new-skirmish"]');
    primary?.focus();
  }

  showMatchSetupPlaceholder(): void {
    this.closePanel();
    this.menuView.hidden = true;
    this.setupView.hidden = false;
    const back = this.root.querySelector<HTMLButtonElement>('[data-start-action="back"]');
    back?.focus();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const action = target.closest('[data-start-action]') as HTMLElement | null;
    if (!action) return;
    switch (action.dataset.startAction) {
      case 'new-skirmish':
        this.callbacks.onNewSkirmish();
        break;
      case 'back':
        this.callbacks.onBackToMenu();
        break;
      case 'tutorial':
      case 'factions':
      case 'settings':
        this.openPanel(action.dataset.startAction, action);
        break;
      case 'close-panel':
        this.closePanel();
        break;
    }
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
          <li><b>Scout</b><span>Send your starting scout down the safe ore lane and find the enemy approach.</span></li>
          <li><b>Claim</b><span>Keep workers moving. Expand toward contested ground while your line still holds.</span></li>
          <li><b>Adapt</b><span>Invest in the technology paths your plan needs instead of mirroring your rival.</span></li>
        </ol>
        <div class="control-grid">
          <span><b>Tap</b> select</span>
          <span><b>Drag</b> box-select</span>
          <span><b>Hold</b> attack-move</span>
          <span><b>Two fingers</b> pan</span>
          <span><b>Pinch</b> zoom</span>
          <span><b>Goal</b> break the enemy command center</span>
        </div>
      `;
    } else if (kind === 'factions') {
      title.textContent = 'Two ways to take the Rift';
      content.innerHTML = `
        <p class="panel-lead">Every skirmish in the Helios Rift is a contest between these two forces.</p>
        <div class="faction-list">
          ${FACTIONS.map(
            (faction) => `
            <div class="faction-row">
              <span class="faction-sigil" style="--faction-accent:${faction.accent}">${faction.sigil}</span>
              <div class="faction-copy">
                <strong>${faction.name}</strong>
                <p>${faction.summary}</p>
              </div>
            </div>
          `,
          ).join('')}
        </div>
        <p class="panel-note">You choose a side when you launch a New Skirmish.</p>
      `;
    } else {
      title.textContent = 'Presentation';
      content.innerHTML = `
        <div class="settings-list">
          <div><b>Display</b><span>Landscape-first layout · honors every safe area</span></div>
          <div><b>Motion</b><span>Follows the system reduced-motion setting</span></div>
          <div><b>Input</b><span>Touch-first command deck · keyboard fallback supported</span></div>
        </div>
        <p class="panel-note">No accounts, stores, or online services live here.</p>
      `;
    }
    this.panel.hidden = false;
    (this.panel.querySelector('.panel-close') as HTMLButtonElement).focus();
  }

  private closePanel(): void {
    if (this.panel.hidden) return;
    this.panel.hidden = true;
    this.panelTrigger?.focus();
    this.panelTrigger = null;
  }

  private injectCss(): void {
    if (document.getElementById('start-screen-css')) return;
    const style = document.createElement('style');
    style.id = 'start-screen-css';
    style.textContent = START_SCREEN_CSS;
    document.head.appendChild(style);
  }
}

const START_SCREEN_CSS = `
#start-screen{position:fixed;inset:0;z-index:30;overflow:auto;color:${P.cream};font-family:"Trebuchet MS","Segoe UI",sans-serif;background:radial-gradient(circle at 78% 38%,${P.plum}88 0%,transparent 32%),radial-gradient(circle at 16% 82%,${P.rust}55 0%,transparent 36%),linear-gradient(125deg,${P.ink} 0%,${P.night} 55%,${P.deep} 100%)}
#start-screen:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.14;background-image:linear-gradient(${P.cream}12 1px,transparent 1px),linear-gradient(90deg,${P.cream}12 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(90deg,black,transparent 88%)}
.start-shell{position:relative;box-sizing:border-box;min-height:100%;width:min(1240px,100%);margin:0 auto;display:flex;flex-direction:column;padding:calc(env(safe-area-inset-top) + clamp(28px,6vh,64px)) calc(env(safe-area-inset-right) + clamp(20px,5vw,72px)) calc(env(safe-area-inset-bottom) + 18px) calc(env(safe-area-inset-left) + clamp(20px,5vw,72px))}
.menu-view{display:grid;grid-template-columns:minmax(300px,.92fr) minmax(330px,.78fr);gap:clamp(30px,6vw,96px);align-items:center;flex:1}
.menu-view[hidden],.setup-view[hidden],.start-panel[hidden]{display:none}
.start-kicker{margin:0;color:${P.amber};font-size:10px;letter-spacing:.22em;text-transform:uppercase}
.start-heading h1{margin:14px 0 12px;font-size:clamp(56px,6vw,84px);line-height:.86;letter-spacing:.03em;text-transform:uppercase;font-weight:700;text-shadow:0 5px 0 ${P.rust}88,0 0 28px ${P.amber}22}
.start-promise{margin:0;color:${P.ice};font-size:clamp(17px,2vw,23px);line-height:1.25;letter-spacing:.02em}
.start-note{max-width:400px;margin:18px 0 0;color:${P.muted};font-size:13px;line-height:1.6}
.menu-list{display:flex;flex-direction:column;gap:12px;width:min(430px,100%)}
.menu-item{box-sizing:border-box;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;width:100%;min-height:52px;padding:10px 18px;border:1px solid ${P.muted}55;border-radius:3px;background:${P.ink}cc;color:${P.cream};text-align:left;font:inherit;cursor:pointer;touch-action:manipulation;transition:transform .16s ease,border-color .16s ease,background .16s ease}
.menu-item strong{font-size:14px;letter-spacing:.09em;text-transform:uppercase}
.menu-item small{color:${P.muted};font-size:9px;letter-spacing:.13em;text-transform:uppercase}
.menu-item:hover:not(:disabled){transform:translateX(4px);border-color:${P.amber};background:${P.deep}ee}
.menu-item:focus-visible{outline:2px solid ${P.amber};outline-offset:3px}
.menu-item.primary{border-color:${P.amber};background:linear-gradient(135deg,${P.rust}ee,${P.ochre}66);box-shadow:0 0 24px ${P.amber}18,inset 0 0 0 1px ${P.cream}18}
.menu-item.primary small{color:${P.cream}bb}
.menu-item:disabled{border-color:${P.muted}2e;background:${P.ink}66;color:${P.muted};cursor:not-allowed;opacity:.45}
.menu-item.back{width:auto;min-width:220px;margin-top:22px}
.start-footer{display:flex;justify-content:space-between;gap:18px;padding-top:20px;color:${P.muted};font-size:9px;letter-spacing:.16em}
.setup-view{display:grid;place-items:center;flex:1}
.setup-card{box-sizing:border-box;width:min(520px,100%);padding:30px;border:1px solid ${P.amber}55;background:linear-gradient(145deg,${P.ink}dd,${P.deep}c8);box-shadow:0 24px 60px #0005,inset 0 0 0 1px #ffffff06}
.setup-card h2{margin:10px 0 0;font-size:clamp(26px,3vw,34px);font-weight:500;letter-spacing:.02em}
.setup-copy{margin:14px 0 0;color:${P.muted};font-size:13px;line-height:1.6}
.start-panel{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:calc(env(safe-area-inset-top) + 22px) calc(env(safe-area-inset-right) + 22px) calc(env(safe-area-inset-bottom) + 22px) calc(env(safe-area-inset-left) + 22px)}
.panel-scrim{position:absolute;inset:0;background:#05040bdd;backdrop-filter:blur(5px)}
.panel-card{position:relative;box-sizing:border-box;width:min(560px,100%);max-height:min(680px,90vh);overflow:auto;padding:30px;border:1px solid ${P.amber}88;background:linear-gradient(145deg,${P.ink},${P.deep});box-shadow:0 26px 80px #0009}
.panel-card h2{margin:8px 44px 20px 0;font-size:28px;font-weight:500;letter-spacing:.03em}
.panel-close{position:absolute;right:14px;top:10px;width:44px;height:44px;border:0;background:transparent;color:${P.muted};font-size:28px;line-height:1;cursor:pointer}
.panel-close:hover{color:${P.cream}}
.panel-close:focus-visible{outline:2px solid ${P.amber};outline-offset:3px}
.panel-lead{margin:0 0 18px;color:${P.ice};font-size:14px;line-height:1.5}
.tutorial-list{display:grid;gap:12px;margin:0;padding:0;list-style:none;counter-reset:tutorial}
.tutorial-list li{display:grid;grid-template-columns:92px 1fr;gap:12px;padding:10px 0;border-top:1px solid ${P.muted}2f;counter-increment:tutorial}
.tutorial-list li:before{content:"0" counter(tutorial);color:${P.amber};font-size:10px;letter-spacing:.15em}
.tutorial-list b{color:${P.cream};font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.tutorial-list span{grid-column:2;color:${P.muted};font-size:12px;line-height:1.45}
.control-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:22px;padding-top:16px;border-top:1px solid ${P.muted}2f;color:${P.muted};font-size:11px}
.control-grid span{padding:8px;background:${P.ink}88}
.control-grid b{color:${P.cream}}
.faction-list{display:grid;gap:14px}
.faction-row{display:flex;align-items:center;gap:16px;padding:14px 0;border-top:1px solid ${P.muted}2f}
.faction-sigil{display:grid;place-items:center;width:44px;height:44px;flex:0 0 44px;border:1px solid var(--faction-accent,${P.amber})99;border-radius:50%;color:var(--faction-accent,${P.amber});font-size:22px;box-shadow:0 0 16px var(--faction-accent,${P.amber})25}
.faction-copy{min-width:0}
.faction-copy strong{font-size:15px;letter-spacing:.09em;text-transform:uppercase}
.faction-copy p{margin:6px 0 0;color:${P.muted};font-size:12px;line-height:1.5}
.panel-note{margin:20px 0 0;padding-top:16px;border-top:1px solid ${P.muted}2f;color:${P.muted};font-size:12px;line-height:1.5}
.settings-list{display:grid;gap:10px}
.settings-list div{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-top:1px solid ${P.muted}2f}
.settings-list b{color:${P.cream};font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.settings-list span{color:${P.muted};font-size:11px;text-align:right}
@media (prefers-reduced-motion:reduce){#start-screen *{transition:none!important}}
@media (max-width:900px){.menu-view{grid-template-columns:1fr;gap:28px;align-content:center}.start-note{max-width:560px}.menu-list{width:min(480px,100%)}}
@media (max-width:580px){.start-shell{padding-left:calc(env(safe-area-inset-left) + 16px);padding-right:calc(env(safe-area-inset-right) + 16px)}.start-footer{display:block;line-height:1.8}.start-footer span{display:block}.panel-card{padding:24px 20px}.tutorial-list li{grid-template-columns:56px 1fr}.tutorial-list li:before{grid-column:1}.tutorial-list span{grid-column:2}.control-grid{grid-template-columns:1fr}.settings-list div{display:block}.settings-list span{display:block;margin-top:5px;text-align:left}}
`;
