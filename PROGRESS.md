# Starhaven — live status

**Play:** https://spacepixelrts.pages.dev
**Bar:** StarCraft II (space RTS, base building, asymmetric factions) — blind, on the running game.
**Active goal:** **First Playable Skirmish** — one 12–18 minute iPad-first 4:3 loop: main menu ->
setup -> loading -> Helios Rift -> fog scouting -> faction economy -> ONE irreversible choice
between TWO technology paths per faction -> four-unit compact army -> shared-center conflict ->
destroy the enemy Core or lose -> results. Contract: `docs/FIRST_PLAYABLE.md`.

## Roles (active)

| Role | Who |
| --- | --- |
| Orchestrator — directs / reviews / scope-controls | Sol Max |
| Repository implementer — one bounded task at a time | Ox Alpha Max |
| Image-only critic — 3 independent critiques at important gates, visible categories only | DeepSeek V4 Flash Vision Max |

## Now

- Canonical vocabulary FROZEN: `docs/CANONICAL_VOCABULARY.md` (Starhaven `starhaven`; Sunweaver
  `sunweaver`; Gravemark `gravemark`; Helios Rift `helios-rift`; Core `core`; tech paths
  solar-ascendancy / sky-dominion / iron-colossus / rift-engineering; legacy vespari/aurion kept
  as private adapters until a dedicated migration; Nihiline/voidmarked hidden and deferred).
- Active branch `chatgptpro2008` tracking origin/chatgptpro2008.
- M0 COMPLETE: explicit `Boot -> MainMenu -> MatchSetup -> Loading -> Playing -> TacticalPause /
  Victory / Defeat -> Results` state machine; no writable menu/gameplay booleans remain.
- Deterministic `?qa=` registry covers 9 primary and 4 supplemental routes with fixed seed, camera,
  config, orientation, and frozen fixture tick. Later-match routes are honest scaffolds until their
  gameplay milestones supply distinct world fixtures.
- `npm run test:m0` and `npm run build` pass.
- Full iPad 4:3 evidence matrix: 26/26 route-orientation captures pass, browser errors 0, worst
  game-work p99 5.9 ms, UI-free / selected / close / far captures present, and contact sheet present.
  Manifest: `~/.codex/evidence/starhaven-m0-harness/20260821T154246Z.VS76FM/manifest.json`.
- M0 blind visual gate: three independent DeepSeek Vision critics PASSed the pack as a stable
  review baseline. A fresh focused critic also PASSed the selected-scout state.
- M1-A COMPLETE: canonical five-item Starhaven main menu, in-place Tutorial/Factions/Settings
  panels, disabled Continue reason, and legal MatchSetup entry. Browser title and portrait gate use
  Starhaven. Commit `bd3dfeb`.
- M1-B COMPLETE: full two-faction skirmish form for player/AI civilization, difficulty, Helios Rift,
  fog, speed, tactical pause, and seed mode/value. Mirror choices auto-swap the other side through one
  typed config callback. Commit `980785e`.
- M1-B evidence: MatchSetup passes at 1366 × 1024 in both landscape orientations, browser errors 0,
  reset count 0, seed 24301 visible, and game-work p99 0.1 ms. Three critics PASSed usability; their
  repeated dead-panel and same-color faction gaps were repaired. A fresh critic PASSed the repair.
  Evidence: `~/.codex/evidence/starhaven-m1b-setup/20260821T174856Z.dI0Avp/`.
- M1-C COMPLETE: the validated form now drives `MatchSetup -> Loading -> Playing`; deterministic seed
  424242 survives exactly, random seed resolves once, Loading paints without an arbitrary delay, and
  one successful match creates one reset. Hidden `qa-hold-loading=1` lets Playwright capture that same
  submitted match before a legal probe `LOAD_READY` resumes Playing.
- Player-facing HUD continuity is canonical: Sunweaver and Gravemark only, shown as a read-only
  `You` versus `Rival` strip. Legacy civilization IDs stay private. The deferred third faction is not
  present in the 1v1 HUD.
- M1-C interaction smoke PASSes with exact Gravemark/Sunweaver/Veteran/fog-off/1.25×/On-demand/seed
  424242 config, ordered `[Boot, MainMenu, MatchSetup, Loading, Playing]` history, reset count 0 -> 1,
  p99 3.4 ms, three composited captures, and browser errors 0.
- Full post-M1 regression: 26/26 iPad route-orientation captures PASS, worst p99 5.3 ms, extras 4,
  contact sheet present. Evidence: `~/.codex/evidence/starhaven-m1c-flow/20260821T181056Z.xBlgaB/`.
- M1-C initial visual gate correctly FAILed visible match-identity drift. After the same-match Loading
  capture and canonical HUD repair, three fresh DeepSeek critics PASSed. Final tool-free Ox review:
  PASS.
- Open visual debt for M2/M5: all three M0 critics found poor unit contrast at normal camera height.
  Fix silhouette/contrast before the scouting and combat gates; do not reopen M0 infrastructure.
- Known state limit for M8: `Results -> REMATCH` returns to setup, but a second world on the same page
  still needs teardown/re-init support.
- **Next:** M2 completes the player-driven opening and scout/fog discovery loop. No content expansion
  beyond that bounded milestone.

## Historical

Pre-First-Playable town-center art campaign (Sunweaver Town Center structural rebuild,
PTC-CLAY/PTC-MAT rounds, palette + lighting gates, toolchain switches) is archived here for its
commit references only:

- Clay geometry baseline accepted after rounds 12–13 (`5e57a47`, `741246b`, `3e1d9dc`,
  `a186e39`, `ed166c0`); materials/palette pass (`0452b04`, `87cea81`); structural viewer deployed
  and made interactive (`70b542d`). Objective gates held: p99 ~3–5 ms, console errors 0.
- Wave A visual foundation (iso projection P94, emissive team color P95, terrain elevation P96)
  previously PASSed; plan text preserved in `docs/ISO_REWRITE_PLAN.md` — historical, superseded by
  First Playable where they conflict.
- Iteration specs live under `docs/TOWN_CENTER_ITERATION_*.md` / `docs/PTC_*.md`.
