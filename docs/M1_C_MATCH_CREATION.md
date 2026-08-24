# M1-C — Connect setup to deterministic match creation

Status: **ACTIVE IMPLEMENTATION CONTRACT**

Read first: `DIRECTIVE.md`, `docs/CANONICAL_VOCABULARY.md`, `docs/FIRST_PLAYABLE.md`,
`docs/M1_A_MAIN_MENU.md`, `docs/M1_B_SKIRMISH_SETUP.md`, and `PROGRESS.md`.

## Goal

Connect the validated M1-B form to the explicit app state machine and one `World.reset`. Preserve a
visible Loading state for real readiness work. Do not change simulation rules.

## Flow

1. MainMenu New Skirmish dispatches `OPEN_SETUP`.
2. MatchSetup Start Match validates the canonical `MatchConfig`.
3. Invalid config stays in MatchSetup and keeps reset count 0.
4. Valid config dispatches `START_MATCH -> Loading`.
5. Loading shows selected player faction, Helios Rift, difficulty, and seed mode/value.
6. Create, reset, and bind the world once. Loading remains visible across at least two
   `requestAnimationFrame` boundaries so it can paint. Do not use an arbitrary timeout.
7. Dispatch `LOAD_READY -> Playing` only after renderer, input, HUD, and probes are ready.
8. Playing probe config matches the submitted form and reset count is 1.

## Visual continuity gate

- Setup, Loading, and Playing evidence must come from the same submitted match.
- A hidden `qa-hold-loading=1` route may hold the legal Loading state after readiness so Playwright
  can capture the submitted faction, difficulty, and seed. The runner must resume through the public
  probe's legal `LOAD_READY` dispatch. Production flow gets no delay or hold.
- Internal legacy civilization IDs stay private adapters. Player-facing HUD copy uses only
  **Sunweaver** and **Gravemark**.
- The in-match faction strip is a read-only `You` versus `Rival` summary. It must not expose the
  deferred third faction or a dead faction-switch control.

## Settings application

- Factions map through canonical-to-legacy private adapters.
- `fogOfWar` controls `World.fogOfWarEnabled`.
- `speed` controls the simulation accumulator multiplier.
- Deterministic mode uses the entered uint32 seed exactly.
- Random mode generates one uint32 seed once at match creation, stores that resolved seed in active
  config, and exposes it in the probe.
- Tactical-pause mode remains in active config. M6 supplies its expanded command semantics; current
  pause must still work.

## Probe

Add read-only `transitionHistory` to `window.__STARHAVEN_QA__`. It proves
`MainMenu -> MatchSetup -> Loading -> Playing` without racing the short Loading paint. No state
setter.

## Interaction smoke

Add `scripts/qa-m1.mjs` and package command `qa:m1`. Use an absolute durable `--out`, a private Vite
port, reliable cleanup, 1366 × 1024 Chrome, and accessible labels. It must:

- load MainMenu: state MainMenu, reset count 0;
- click New Skirmish: state MatchSetup, reset count 0;
- choose Gravemark player, Sunweaver AI, Veteran, fog off, 1.25×, On-demand, Deterministic seed
  424242;
- click Start Match and wait for Playing;
- prove transition history includes Loading;
- verify exact config and reset count 1;
- capture setup, deterministic Loading QA route, and Playing screenshots;
- fail on browser errors or black captures;
- write `manifest.json`.

## Owned files

- `src/start-screen.ts`
- `src/main.ts`
- `src/hud.ts` (match-up labels only)
- `src/content.ts` (canonical public name adapter only)
- `scripts/qa-m1.mjs`
- `package.json`
- `docs/M1_C_MATCH_CREATION.md`
- `PROGRESS.md`

Do not edit `sim.ts`, `engine.ts`, `render.ts`, `input.ts`, `hud.ts`, `content.ts`, assets, or M0
state/config/scenario modules.

## Acceptance

- `npm run test:m0`
- `npm run build`
- `npm run qa:m1 -- --out=<durable M1-C evidence path>`
- Full `qa:m0` matrix still passes.
- `git diff --check`
- Reset count 0 before Start and 1 after Playing.
- Exact submitted config in probe.
- Browser errors 0.

## Commit

`feat: connect menu flow to deterministic match creation`
