import type { Civ } from './engine';
import { ALL_CIVS, CIV_NAME, CIV_PROFILE } from './content';
import { STARHOLD_PALETTE as P } from './palette';

export interface StartScreenCallbacks {
  onNewMatch: (civ: Civ) => void;
}

interface FactionCard {
  civ: Civ;
  accent: string;
}

const FACTIONS: readonly FactionCard[] = [
  {
    civ: 'vespari',
    accent: P.amber,
  },
  {
    civ: 'aurion',
    accent: P.ice,
  },
  {
    civ: 'voidmarked',
    accent: P.leaf,
  },
];

export class StartScreen {
  readonly root: HTMLElement;
  private selectedCiv: Civ;
  private readonly callbacks: StartScreenCallbacks;
  private modal: HTMLElement;
  private selection: HTMLElement;
  private keyHandler: (event: KeyboardEvent) => void;

  constructor(host: HTMLElement, initialCiv: Civ, callbacks: StartScreenCallbacks) {
    this.selectedCiv = initialCiv;
    this.callbacks = callbacks;
    this.root = document.createElement('main');
    this.root.id = 'start-screen';
    this.root.setAttribute('aria-label', 'Starhaven main menu');
    this.root.innerHTML = `
      <div class="start-shell">
        <div class="start-grid">
          <section class="start-copy">
            <p class="start-kicker">STARHAVEN / FRONTIER COMMAND</p>
            <h1>Starhaven</h1>
            <p class="start-tagline">Three doctrines. One contested frontier.</p>
            <p class="start-description">
              Scout the dark, establish a foothold, and choose the moment to turn a small force into a decisive line.
              Every faction reads the map differently.
            </p>
            <div class="start-actions">
              <button type="button" class="start-button primary" data-start-action="new">
                <strong>New Match</strong>
                <small>Deploy into the frontier</small>
              </button>
              <button type="button" class="start-button" data-start-action="continue" disabled>
                <strong>Continue</strong>
                <small>No field record yet</small>
              </button>
              <div class="utility-actions">
                <button type="button" class="utility-button" data-start-action="tutorial">Tutorial</button>
                <button type="button" class="utility-button" data-start-action="settings">Settings</button>
              </div>
            </div>
            <div class="start-proof">
              <span class="proof-dot"></span>
              <span>Touch command deck ready</span>
              <span class="proof-divider">·</span>
              <span>1v1 frontier skirmish</span>
            </div>
          </section>
          <section class="faction-panel" aria-labelledby="faction-heading">
            <div class="panel-heading">
              <div>
                <p class="panel-kicker">Choose your doctrine</p>
                <h2 id="faction-heading">Who will shape the first light?</h2>
              </div>
              <span class="panel-code">FIELD 01 / 03</span>
            </div>
            <div class="faction-grid" role="list"></div>
            <div class="selection-summary" aria-live="polite"></div>
          </section>
        </div>
        <footer class="start-footer">
          <span>STARHAVEN // A TOUCH-FIRST SPACE RTS</span>
          <span>SCOUT · CLAIM · ADAPT</span>
        </footer>
      </div>
      <div class="start-modal" hidden>
        <div class="modal-scrim" data-start-action="close-modal"></div>
        <section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
          <button type="button" class="modal-close" data-start-action="close-modal" aria-label="Close">×</button>
          <p class="panel-kicker">STARHAVEN FIELD NOTES</p>
          <h2 id="modal-title"></h2>
          <div class="modal-content"></div>
        </section>
      </div>
    `;
    host.appendChild(this.root);
    this.modal = this.root.querySelector('.start-modal')!;
    this.selection = this.root.querySelector('.selection-summary')!;
    this.keyHandler = (event) => {
      if (event.key === 'Escape' && !this.modal.hidden) this.closeModal();
    };
    window.addEventListener('keydown', this.keyHandler);
    this.root.addEventListener('click', (event) => this.handleClick(event));
    this.renderFactions();
    this.updateSelection();
    this.injectCss();
  }

  destroy(): void {
    window.removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }

  private handleClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    const action = target.closest('[data-start-action]') as HTMLElement | null;
    if (action) {
      const name = action.dataset.startAction;
      if (name === 'new') this.callbacks.onNewMatch(this.selectedCiv);
      if (name === 'tutorial') this.openModal('tutorial');
      if (name === 'settings') this.openModal('settings');
      if (name === 'close-modal') this.closeModal();
      return;
    }
    const card = target.closest('[data-civ]') as HTMLElement | null;
    if (!card) return;
    const civ = card.dataset.civ as Civ;
    if (!ALL_CIVS.includes(civ)) return;
    this.selectedCiv = civ;
    this.renderFactions();
    this.updateSelection();
  }

  private renderFactions(): void {
    const grid = this.root.querySelector('.faction-grid')!;
    grid.innerHTML = FACTIONS.map((faction) => {
      const selected = faction.civ === this.selectedCiv;
      const profile = CIV_PROFILE[faction.civ];
      return `
        <button type="button" class="faction-card ${selected ? 'selected' : ''}" data-civ="${faction.civ}" role="listitem" aria-pressed="${selected}">
          <span class="faction-sigil" style="--faction-accent:${faction.accent}">${faction.civ === 'vespari' ? '✦' : faction.civ === 'aurion' ? '◇' : '◌'}</span>
          <span class="faction-copy">
            <strong>${CIV_NAME[faction.civ]}</strong>
            <small>${profile.subtitle}</small>
            <em>${profile.doctrine}</em>
          </span>
          <span class="faction-mark" style="--faction-accent:${faction.accent}"></span>
        </button>
      `;
    }).join('');
  }

  private updateSelection(): void {
    const faction = FACTIONS.find((entry) => entry.civ === this.selectedCiv)!;
    const profile = CIV_PROFILE[faction.civ];
    this.selection.innerHTML = `
      <div class="summary-accent" style="--faction-accent:${faction.accent}"></div>
      <div>
        <p class="summary-kicker">Selected doctrine</p>
        <h3>${CIV_NAME[faction.civ]} <span>· ${profile.doctrine}</span></h3>
        <p>${profile.plan}</p>
      </div>
      <span class="summary-edge">${profile.edge}</span>
    `;
  }

  private openModal(kind: 'tutorial' | 'settings'): void {
    const title = this.modal.querySelector('#modal-title')!;
    const content = this.modal.querySelector('.modal-content')!;
    if (kind === 'tutorial') {
      title.textContent = 'The first ninety seconds';
      content.innerHTML = `
        <p class="modal-lead">Starhaven rewards a clear route, not frantic input.</p>
        <ol class="tutorial-list">
          <li><b>Scout</b><span>Use your starting scout to reveal the safe ore lane and the enemy approach.</span></li>
          <li><b>Claim</b><span>Keep workers moving. Build a habitat, then place a Yard where it protects your route.</span></li>
          <li><b>Adapt</b><span>Choose the fight your doctrine wants. Pressure, hold, or disrupt instead of mirroring the opponent.</span></li>
        </ol>
        <div class="control-grid">
          <span><b>Tap</b> select</span>
          <span><b>Drag</b> box-select</span>
          <span><b>Hold</b> attack-move</span>
          <span><b>Two fingers</b> pan</span>
          <span><b>Pinch</b> zoom</span>
          <span><b>Goal</b> break the enemy Nexus</span>
        </div>
      `;
    } else {
      title.textContent = 'Command settings';
      content.innerHTML = `
        <div class="settings-list">
          <div><b>Display</b><span>Landscape layout · safe-area aware</span></div>
          <div><b>Input</b><span>Touch command deck · keyboard fallback supported</span></div>
          <div><b>Audio</b><span>Combat and selection cues are enabled in match</span></div>
          <div><b>Save records</b><span>Continue unlocks when the first save system lands</span></div>
        </div>
        <p class="modal-note">These controls stay simple on purpose. Starhaven puts strategic choices above input speed.</p>
      `;
    }
    this.modal.hidden = false;
    (this.modal.querySelector('.modal-close') as HTMLButtonElement).focus();
  }

  private closeModal(): void {
    this.modal.hidden = true;
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
#start-screen{position:fixed;inset:0;z-index:30;overflow:auto;pointer-events:auto;color:${P.cream};font-family:"Trebuchet MS","Segoe UI",sans-serif;background:radial-gradient(circle at 78% 42%,${P.plum}88 0%,transparent 30%),radial-gradient(circle at 18% 80%,${P.rust}55 0%,transparent 34%),linear-gradient(125deg,${P.ink} 0%,${P.night} 55%,${P.deep} 100%);touch-action:auto}
#start-screen:before{content:"";position:fixed;inset:0;pointer-events:none;opacity:.16;background-image:linear-gradient(${P.cream}12 1px,transparent 1px),linear-gradient(90deg,${P.cream}12 1px,transparent 1px);background-size:54px 54px;mask-image:linear-gradient(90deg,black,transparent 88%)}
.start-shell{position:relative;box-sizing:border-box;min-height:100%;width:min(1240px,100%);margin:0 auto;padding:clamp(28px,6vh,72px) clamp(20px,5vw,72px) 18px;display:flex;flex-direction:column;justify-content:space-between}
.start-grid{display:grid;grid-template-columns:minmax(280px,.82fr) minmax(430px,1.18fr);gap:clamp(30px,6vw,92px);align-items:center;flex:1}
.start-copy{max-width:520px}
.start-kicker,.panel-kicker,.summary-kicker{margin:0;color:${P.amber};font-size:10px;letter-spacing:.22em;text-transform:uppercase}
.start-copy h1{margin:14px 0 10px;font-size:clamp(50px,5.5vw,72px);line-height:.86;letter-spacing:.025em;white-space:nowrap;text-transform:uppercase;font-weight:700;text-shadow:0 5px 0 ${P.rust}88,0 0 28px ${P.amber}22}
.start-tagline{margin:0;color:${P.ice};font-size:clamp(18px,2.2vw,26px);line-height:1.2;letter-spacing:.02em}
.start-description{max-width:470px;margin:24px 0 0;color:${P.muted};font-size:14px;line-height:1.65}
.start-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px;max-width:390px}
.start-button,.utility-button,.modal-close{font:inherit;color:${P.cream};cursor:pointer;touch-action:manipulation}
.start-button{box-sizing:border-box;display:flex;flex-direction:column;align-items:flex-start;justify-content:center;gap:4px;min-height:66px;min-width:174px;padding:12px 16px;border:1px solid ${P.amber}66;border-radius:3px;background:${P.deep}dd;text-align:left;box-shadow:inset 0 0 0 1px #0005;transition:transform .16s ease,background .16s ease,border-color .16s ease}
.start-button strong{font-size:14px;letter-spacing:.08em;text-transform:uppercase}
.start-button small{color:${P.muted};font-size:10px;letter-spacing:.08em;text-transform:uppercase}
.start-button.primary{border-color:${P.amber};background:linear-gradient(135deg,${P.rust}ee,${P.ochre}66);box-shadow:0 0 24px ${P.amber}18,inset 0 0 0 1px ${P.cream}18}
.start-button:hover:not(:disabled),.utility-button:hover{transform:translateY(-2px);border-color:${P.amber};background:${P.plum}}
.start-button:focus-visible,.utility-button:focus-visible,.faction-card:focus-visible,.modal-close:focus-visible{outline:2px solid ${P.amber};outline-offset:3px}
.start-button:disabled{cursor:not-allowed;opacity:.42}
.utility-actions{display:flex;gap:10px;align-items:stretch;width:100%}
.utility-button{min-height:44px;padding:8px 14px;border:1px solid ${P.muted}55;border-radius:3px;background:${P.ink}99;color:${P.muted};font-size:11px;letter-spacing:.14em;text-transform:uppercase;transition:transform .16s ease,border-color .16s ease,background .16s ease}
.start-proof{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:30px;color:${P.muted};font-size:10px;letter-spacing:.11em;text-transform:uppercase}
.proof-dot{width:7px;height:7px;border-radius:50%;background:${P.lime};box-shadow:0 0 12px ${P.lime}}
.proof-divider{color:${P.amber}}
.faction-panel{box-sizing:border-box;padding:24px;border:1px solid ${P.amber}55;background:linear-gradient(145deg,${P.ink}dd,${P.deep}c8);box-shadow:0 24px 60px #0005,inset 0 0 0 1px #ffffff06;backdrop-filter:blur(6px)}
.panel-heading{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding-bottom:18px;border-bottom:1px solid ${P.muted}2f}
.panel-heading h2{max-width:410px;margin:8px 0 0;font-size:clamp(20px,2.6vw,30px);line-height:1.1;font-weight:500;letter-spacing:.02em}
.panel-code{color:${P.muted};font-size:9px;letter-spacing:.14em;white-space:nowrap}
.faction-grid{display:grid;gap:8px;margin-top:16px}
.faction-card{position:relative;display:flex;align-items:center;gap:14px;box-sizing:border-box;width:100%;min-height:76px;padding:12px 16px;border:1px solid ${P.muted}38;border-radius:3px;background:${P.ink}99;color:${P.cream};text-align:left;cursor:pointer;touch-action:manipulation;transition:transform .16s ease,border-color .16s ease,background .16s ease}
.faction-card:hover{transform:translateX(4px);border-color:${P.amber}99;background:${P.deep}dd}
.faction-card.selected{border-color:var(--faction-accent,${P.amber});background:linear-gradient(90deg,var(--faction-accent,${P.amber})1d,${P.deep}dd);box-shadow:inset 4px 0 0 var(--faction-accent,${P.amber}),0 0 18px var(--faction-accent,${P.amber})16}
.faction-sigil{display:grid;place-items:center;width:38px;height:38px;flex:0 0 38px;border:1px solid var(--faction-accent,${P.amber})99;border-radius:50%;color:var(--faction-accent,${P.amber});font-size:21px;box-shadow:0 0 16px var(--faction-accent,${P.amber})25}
.faction-copy{display:flex;flex-direction:column;gap:3px;min-width:0}
.faction-copy strong{font-size:14px;letter-spacing:.09em;text-transform:uppercase}
.faction-copy small{color:${P.muted};font-size:9px;letter-spacing:.13em;text-transform:uppercase}
.faction-copy em{color:var(--faction-accent,${P.amber});font-size:11px;font-style:normal}
.faction-mark{width:44px;height:2px;margin-left:auto;background:linear-gradient(90deg,transparent,var(--faction-accent,${P.amber}));opacity:.72}
.selection-summary{display:grid;grid-template-columns:4px 1fr auto;gap:14px;align-items:center;margin-top:18px;padding:14px 16px;background:${P.ink}88}
.summary-accent{align-self:stretch;min-height:54px;background:var(--faction-accent,${P.amber});box-shadow:0 0 14px var(--faction-accent,${P.amber})88}
.summary-kicker{font-size:8px;color:${P.muted};letter-spacing:.16em}
.selection-summary h3{margin:5px 0 0;font-size:14px;letter-spacing:.06em;text-transform:uppercase}
.selection-summary h3 span{color:${P.muted};font-weight:400;text-transform:none}
.selection-summary p:not(.summary-kicker){max-width:430px;margin:6px 0 0;color:${P.muted};font-size:11px;line-height:1.45}
.summary-edge{max-width:110px;color:${P.ice};font-size:9px;line-height:1.35;letter-spacing:.1em;text-align:right;text-transform:uppercase}
.start-footer{display:flex;justify-content:space-between;gap:18px;padding-top:20px;color:${P.muted};font-size:9px;letter-spacing:.16em}
.start-modal{position:fixed;inset:0;z-index:40;display:grid;place-items:center;padding:22px}
.start-modal[hidden]{display:none}
.modal-scrim{position:absolute;inset:0;background:#05040bdd;backdrop-filter:blur(5px)}
.modal-card{position:relative;box-sizing:border-box;width:min(560px,100%);max-height:min(680px,90vh);overflow:auto;padding:30px;border:1px solid ${P.amber}88;background:linear-gradient(145deg,${P.ink},${P.deep});box-shadow:0 26px 80px #0009}
.modal-card h2{margin:8px 40px 22px 0;font-size:30px;font-weight:500;letter-spacing:.03em}
.modal-close{position:absolute;right:14px;top:10px;width:40px;height:40px;border:0;background:transparent;color:${P.muted};font-size:28px;line-height:1}
.modal-close:hover{color:${P.cream}}
.modal-lead{margin:0 0 18px;color:${P.ice};font-size:14px}
.tutorial-list{display:grid;gap:12px;margin:0;padding:0;list-style:none;counter-reset:tutorial}
.tutorial-list li{display:grid;grid-template-columns:92px 1fr;gap:12px;padding:10px 0;border-top:1px solid ${P.muted}2f;counter-increment:tutorial}
.tutorial-list li:before{content:"0" counter(tutorial);color:${P.amber};font-size:10px;letter-spacing:.15em}
.tutorial-list b{color:${P.cream};font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.tutorial-list span{grid-column:2;color:${P.muted};font-size:12px;line-height:1.45}
.control-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:22px;padding-top:16px;border-top:1px solid ${P.muted}2f;color:${P.muted};font-size:11px}
.control-grid span{padding:8px;background:${P.ink}88}
.control-grid b{color:${P.cream}}
.settings-list{display:grid;gap:10px}
.settings-list div{display:flex;justify-content:space-between;gap:18px;padding:12px 0;border-top:1px solid ${P.muted}2f}
.settings-list b{color:${P.cream};font-size:11px;letter-spacing:.1em;text-transform:uppercase}
.settings-list span{color:${P.muted};font-size:11px;text-align:right}
.modal-note{margin:22px 0 0;padding-top:16px;border-top:1px solid ${P.muted}2f;color:${P.muted};font-size:12px;line-height:1.5}
@media (max-width:900px){.start-shell{padding-top:30px}.start-grid{grid-template-columns:1fr;gap:26px;align-content:center}.start-copy{max-width:none}.start-copy h1{font-size:clamp(52px,12vw,82px)}.start-description{max-width:620px}.start-actions{margin-top:22px}.start-proof{margin-top:18px}.faction-panel{padding:18px}.start-footer{margin-top:24px}}
@media (max-width:580px){.start-shell{padding-left:16px;padding-right:16px}.start-description{font-size:13px}.panel-heading{display:block}.panel-code{display:block;margin-top:10px}.selection-summary{grid-template-columns:4px 1fr}.summary-edge{grid-column:2;text-align:left;max-width:none}.start-footer{display:block;line-height:1.8}.start-footer span{display:block}.utility-actions{width:auto}.modal-card{padding:24px 20px}.tutorial-list li{grid-template-columns:56px 1fr}.tutorial-list li:before{grid-column:1}.tutorial-list span{grid-column:2}.control-grid{grid-template-columns:1fr}.settings-list div{display:block}.settings-list span{display:block;margin-top:5px;text-align:left}}
`;
