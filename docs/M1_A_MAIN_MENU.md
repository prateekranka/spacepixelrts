# M1-A — Player-facing main menu

Status: **ACTIVE IMPLEMENTATION CONTRACT**

Read first: `DIRECTIVE.md`, `docs/CANONICAL_VOCABULARY.md`, `docs/FIRST_PLAYABLE.md`,
`docs/FIRST_PLAYABLE_GAP_ANALYSIS.md`, and `PROGRESS.md`.

## Goal

Replace the legacy doctrine picker with a focused 4:3 iPad-first Starhaven main menu. This commit
changes only the front door. It does not build skirmish controls or gameplay.

## Player-facing vocabulary

Only these names may appear:

- Game: **Starhaven**
- Factions: **Sunweaver**, **Gravemark**
- Map: **Helios Rift**
- Progression term: **technology paths**

Do not show Helion Compact, Kryos Conclave, Nihiline, Vespari, Aurion, Voidmarked, Sunwoven,
Sunfold, ages, or epochs.

## Main menu

Show these five items in this order:

1. **Continue** — disabled until save support exists; show the plain reason `No saved match`.
2. **New Skirmish** — primary action.
3. **Tutorial** — opens an in-place information panel; it does not start a new state machine.
4. **Factions** — opens an in-place panel with only the two canonical summaries.
5. **Settings** — opens an in-place panel for presentational settings only; no account, store, or
   online controls.

Canonical faction copy:

- **Sunweaver:** Mobility, information, energy efficiency, elite precision.
- **Gravemark:** Extraction, armor, heavy production, positional control.

## Layout and touch rules

- Primary frame: 1366 × 1024, 4:3 landscape.
- Honor all four `env(safe-area-inset-*)` values.
- Each action target is at least 52 px high, with at least 12 px between targets.
- Keep one clear hierarchy: STARHAVEN title, short promise, five menu items.
- New Skirmish is the only bright primary action.
- Disabled Continue must not look enabled.
- Factions are not cards on the main menu. They live behind Factions.
- Use the current dark-space visual language, but remove legacy doctrine clutter.
- Keyboard focus must be visible. Escape closes a panel before any state change.
- No tiny top-right controls or hidden hover-only actions.

## State integration

- `Boot -> MainMenu` remains legal and automatic.
- New Skirmish dispatches only `OPEN_SETUP`, producing `MatchSetup`.
- For this commit, MatchSetup may show a deliberate placeholder panel with a Back action. It must
  not start a match or call `World.reset`.
- Back dispatches `BACK`, returning to MainMenu.
- `?qa=start-menu` must show the main menu with probe state `MainMenu`.
- `?qa=match-setup` must show the setup placeholder with probe state `MatchSetup`.
- Gameplay QA routes must continue to initialize through legal events.

## Owned files

- `src/start-screen.ts`
- `src/main.ts`
- `index.html`
- `docs/M1_A_MAIN_MENU.md`
- `PROGRESS.md`

Do not edit simulation, engine, renderer, input, HUD, content, M0 state/config/scenario modules,
assets, package files, or evidence scripts.

## Acceptance

- `npm run test:m0`
- `npm run build`
- `git diff --check`
- `npm run qa:m0 -- --route=start-menu --viewport=1366x1024 --orientations=landscape-left,landscape-right --seed=0x5eed --out=<durable M1-A evidence path>`
- Both captures are non-empty, have zero browser errors, report `MainMenu`, and remain below 8 ms
  game-work p99.
- Search the changed player-facing markup and prove that no deprecated public name appears.

## Commit

`feat: add player-facing main menu`
