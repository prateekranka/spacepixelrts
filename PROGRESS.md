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
  typed config callback. Start remains disabled until M1-C connects world creation.
- M1-B evidence: MatchSetup passes at 1366 × 1024 in both landscape orientations, browser errors 0,
  reset count 0, seed 24301 visible, and game-work p99 0.1 ms. Three critics PASSed usability; their
  repeated dead-panel and same-color faction gaps were repaired. A fresh critic PASSed the repair.
  Evidence: `~/.codex/evidence/starhaven-m1b-setup/20260821T174856Z.dI0Avp/`.
- Open visual debt for M2/M5: all three M0 critics found poor unit contrast at normal camera height.
  Fix silhouette/contrast before the scouting and combat gates; do not reopen M0 infrastructure.
- **Next:** M1-C connects the validated form through Loading to one deterministic match reset. No
  content or gameplay expansion before the First Playable loop closes.

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
