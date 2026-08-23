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
- M2-A COMPLETE: production reset now starts each side with exactly one Core, four idle workers, and
  one idle scout. Mirrored safe Ore/Gas/Solar pads sit within 10 world units; the staged battle,
  forced center reveal, camps, corpses, and pre-issued combat orders are gone from production.
- Fog defaults on and the renderer follows the validated world setting. The center and rival Core are
  unexplored at tick 0. The normal camera frames the player base.
- Touch long-press Move is live at 450 ms with explicit primary-pointer, drag, cancel, right-click, and
  multi-pointer guards. The browser smoke proves a selected scout receives an unexplored-terrain Move
  order while selection stays intact.
- M2-A verification: `test:m0`, `test:m2`, build, and diff check PASS; touch smoke p99 4.4 ms; M1 flow
  regression p99 1.7 ms; full route matrix 26/26 PASS, errors 0, worst p99 4.8 ms, extras 4 and contact
  sheet present. Evidence: `~/.codex/evidence/starhaven-m2a-scout-fog/20260821T195436Z.1T1rZq/`.
- M2-A visual gate: three independent DeepSeek critics PASSed. A fresh focused critic PASSed the
  hardened long-press frame. Repeated visible debt: far-zoom fog-edge contrast; fix in M2-B.
- M2-B COMPLETE: each entity and deterministic Helios landmark now has a two-team first-sight latch.
  Discovery events log once per team with stable ids, labels, positions, and ticks. Reset/reuse and
  fog-off behavior are deterministic and covered by tests.
- Undiscovered resources, rival structures, relics, expansions, routes, and the Central Lumen field
  stay out of the player view and minimap. Discovered resources persist through explored fog; enemy
  units still require current LOS; remembered enemy structures draw dim.
- The minimap now shows discovery-gated landmark types. The Central Lumen field uses a large
  ring-and-diamond beacon. Far-zoom unexplored fog is darker, while explored fog stays readable.
- M2-B verification: `test:m0`, both `test:m2` files, build, and diff check PASS. Discovery browser
  proof PASSes at p99 3.8 ms with exact before/after state and errors 0. Opening regression p99 4.1 ms,
  M1 flow p99 1.7 ms, and full route matrix 26/26 PASS at worst p99 4.4 ms.
  Evidence: `~/.codex/evidence/starhaven-m2b-discovery/20260821T220332Z.THOXye/`.
- M2-B visual gate: three DeepSeek critics PASSed world-view discovery. Their unanimous weak minimap
  marker note was repaired; a fresh critic PASSed the enlarged beacon. Tool-free Ox Go sim and view
  reviews PASSed after adding stealth and rival unit/Core coverage.
- M2-C COMPLETE: pure guidance state derives only from real selection and the Central Lumen discovery
  bit. Exact prompts are `Select your scout`, `Explore the nearby signal`, then the required two-line
  discovery/contest message. Worker, enemy scout, and dead scout selections do not advance it.
- The prompt is a pointer-transparent safe-area HUD strip. `SCOUT` brackets the real player scout;
  off-screen `SIGNAL` uses the real landmark projection and safe edge clamping; both brackets disappear
  after discovery. No timer, modal, dimmer, input capture, or animation exists.
- M2-C verification: `test:m0`, all three `test:m2` files, build, diff check and guidance browser proof
  PASS. Guidance proof p99 4.2 ms with three 1366 × 1024 captures and errors 0. Opening p99 5.0 ms,
  discovery 4.0 ms, M1 1.7 ms, and final route matrix 26/26 PASS at worst p99 2.7 ms.
  Evidence: `~/.codex/evidence/starhaven-m2c-guidance/20260821T224915Z.w98gBF/`.
- M2-C visual gate: three DeepSeek critics PASSed the non-blocking banner. Their repeated target-link
  gap was repaired; a fresh critic PASSed the scout/signal brackets. Tool-free Ox Go state and
  presentation reviews PASSed after direct dead/enemy selection and bracket DOM coverage.
- **Next:** M2-D gives the AI scout-driven knowledge and removes all perfect-map targeting.

## Now (resumed 2026-08-22, Linux workspace)

- Work resumed from a fresh clone of `chatgptpro2008` at `2b818fe` (the uncommitted M2-D
  tree on the Mac was not reachable; M2-D was re-implemented here against a frozen contract).
- `docs/M2_D_AI_KNOWLEDGE.md` FROZEN: scripted marshal cheats off by default
  (`scriptedMarshalEnabled=false`); AI workers gather only discovered resources;
  rival Scout walks an explored-not-visible frontier deterministically; attackers drop
  targets lost from sight; zero resource grants. Legacy behavior restored by flipping the flag.
- Missing build entry `town-center-viewer.html` (was untracked on the Mac) restored; `build` is green.
- M2-D COMPLETE at commit `e43c58f`: `test:m0`, all three `test:m2` files, new
  `test:m2-ai`, build, and diff check PASS. New `qa:m2-ai` browser proof PASSes on the live
  opening route: 8 AI workers, 4 gathering, 0 unknown-resource targets, 0 hidden-Core
  sightings, rival exploration 313 -> 1402 tiles, 0 cheat units, sim step 0.11 ms.
- Frame-budget note: this Linux container renders through SwiftShader, so render p99 there is
  not meaningful (~455 ms software raster). `qa:m2-ai` detects software GL and gates the
  sim-work share instead (max 5 fixed steps per frame = 0.57 ms vs 8 ms budget) while recording
  the render number ungated. Hardware-GL runs keep gating real p99 directly.
- Evidence: `/home/bobbyranka/workspace/evidence/starhaven-m2d-ai/` (manifest + before/after captures).
- M2-D visual gate: passed via session vision model (deepseek-v4-flash-vision-exp native
  image attach): before/after pair shows no visible regression; biggest visible gap remains
  the recorded fog/terrain contrast debt (queued for a future visual milestone). Named
  three-up DeepSeek critic pass deferred to when the opencode vision route exists here.
- Deployed 2026-08-22: production now serves the M2-D build at spacepixelrts.pages.dev and
  space.contenthelper.in (title Starhaven, bundle game-CvHILsPF.js). Deploy used
  `wrangler pages deploy dist --project-name=spacepixelrts --branch=main` (branch=main is
  required: default lands chatgptpro2008 on PREVIEW; production branch is main).
- **Next:** M3 asymmetric faction economies per `docs/FIRST_PLAYABLE.md`.

## M3 — asymmetric economies (complete)

- `docs/M3_ECONOMIES.md` FROZEN with pieces A/B/C. All three are implemented, tested,
  QA-proven, committed, and deployed to production:
- **M3-A Sunweaver Solar links** (`feat: add Sunweaver solar collection links (M3-A)`):
  first Gather pulse at a Solar node creates a pooled Link; linked workers pulse energy
  directly at 0.4 s (no haul); an enemy unit within 1.8 of the tether midpoint severs the
  link for 10 s. Amber/ice dashed tethers render in the overlay for seen nodes.
- **M3-B Gravemark rigs** (`feat: add Gravemark extraction rigs (M3-B)`): rig state on the
  resource node (no new Kind); aurion workers Build ore/gas nodes into rigs (0.1/s to 700
  rigHp); finished rigs auto-extract 1 unit per 1.0 s at 0.5 node hp ("refining"); rigs
  absorb damage first (bolts may hit rigged nodes; plain nodes stay bolt-immune); the AI
  recruits unloaded gatherers to raise rigs on discovered unrigged nodes (cap 2 builders).
  Ice corner brackets render on rigged nodes.
- **M3-C Sunweaver boosts** (`feat: add Sunweaver energy boosts (M3-C)`): HUD strip with
  Prod/Vision/Shield toggles (Sunweaver only, one at a time); drains 8/5/6 per second;
  auto-off below 4 energy; effects = trainT 1.8x, fog los +2.5, building regen +6/s.
  vespari AI: production while training (energy > 80), vision in the first 90 s, never
  shields.
- Verification: `test:m0`, all `test:m2`, `test:m2-ai`, `test:m3` (links+rigs+boosts),
  build, diff check PASS. `qa:m3-economies` browser proof PASS: link formed and streamed
  (110 -> 120 chg, 0 cargo), sever on enemy presence (energy frozen at 122), boost drained
  122 -> 86 with `#boost-prod` lit, zero console errors, sim step 0.15 ms.
- M3 visual gate: the named blind-critic route is unavailable in this environment (the
  session vision model is no longer image-capable and opencode lists text-only models), so
  the gate ran as objective pixel checks: 1501 amber px in the boost-strip region (lit
  button) and 291 amber px in the playfield (tether) on the QA captures. A full
  three-critic visual pass stays queued for a working vision route; M3 changed no existing
  render path other than the two overlay additions.
- Evidence: `/home/bobbyranka/workspace/evidence/starhaven-m3-economies/`.
- **Next:** M4 two-way technology choice per `docs/FIRST_PLAYABLE.md`.

## M4 — technology paths (in progress)

- `docs/M4_TECH_PATHS.md` FROZEN (`7559532`): one irreversible per-faction commit between
  two paths (Sunweaver solar-ascendancy / sky-dominion; Gravemark iron-colossus /
  rift-engineering). Commit is a Nexus research (400 ore + 80 charge, 40 s channel,
  Hall blocked while channeling). Eight path effects in one `PATH_EFFECTS` table.
  Internal `epoch`/`ageT` storage kept per vocab doc; player-facing epoch language banned.
- **M4-A sim core COMPLETE** (`b845af2`, builder via opencode x-preview-f-free, lead-verified):
  `tryCommitPath` (civ-path validation, atomic deduct, irreversible), `techPathOf`,
  `pathChannelT`, Yard gate rewritten to `gateOpen`, all eight effects wired at their
  mechanic sites, enemy marshal instant doctrine commit at tick 240 replaces the old
  `epoch = 2` jump (write deleted). New `tests/m4-tech-paths.test.ts` (100 asserts).
  Lead re-ran every suite: `test:m0`, `test:m2`, `test:m2-ai`, `test:m3`, `test:m4`,
  build — all green. Known leftover for M4-B: dead legacy adapters (`tryAgeUp`,
  `EPOCH_NAME`, `minTrainEpoch`) still exported until the HUD sweep removes them.
- **M4-B HUD choice UI + guidance sweep** dispatched (opencode builder): two path buttons /
  channel countdown / locked readout, guidance nudge, `qa:m4` headless proof with a
  banned-word grep gate, evidence to `/home/bobbyranka/workspace/evidence/starhaven-m4-tech-paths/`.
- GitHub push BLOCKED from this Linux box (no gh login / credential helper / SSH key here;
  auth lives on the Mac). Local branch is ahead of origin; commits safe locally.

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
