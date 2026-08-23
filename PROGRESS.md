# Starhaven — live status

**Play:** https://spacepixelrts.pages.dev
**Bar:** StarCraft II (space RTS, base building, asymmetric factions) — blind, on the running game.
**Active goal:** **Playable Vertical Slice** — close one honest 12–18 minute iPad-first 4:3
skirmish before deep controls or general polish: menu -> scout -> gather -> choose technology path ->
train mixed army -> center conflict -> destroy/lose Core -> Results. Active sprint:
`docs/VERTICAL_SLICE_SPRINT.md`; parent contract: `docs/FIRST_PLAYABLE.md`.

## Roles (active)

| Role | Who |
| --- | --- |
| Orchestrator — directs / reviews / scope-controls | Bottymcbotface (lead) |
| Blind gate / pixel forensics / design synthesis | `gpt-5.6-sol` effort max fast via `tasks/codex-linux-run.sh sol <brief> <log> [-i <shot>]` (ChatGPT sub) |
| Implementer + bounded specific tasks + focused 5–10 min playtests | `gpt-5.6-luna` effort max fast via `tasks/codex-linux-run.sh luna <brief> <log>` (ChatGPT sub); opencode fallback |

## Now

- Canonical vocabulary FROZEN: `docs/CANONICAL_VOCABULARY.md` (Starhaven `starhaven`; Sunweaver
  `sunweaver`; Gravemark `gravemark`; Helios Rift `helios-rift`; Core `core`; tech paths
  solar-ascendancy / sky-dominion / iron-colossus / rift-engineering; legacy vespari/aurion kept
  as private adapters until a dedicated migration; Nihiline/voidmarked hidden and deferred).
- Active branch `chatgptpro2008` tracking origin/chatgptpro2008.
- **Vertical Slice Sprint STARTED from clean GitHub HEAD** (`f3595be`): stopped M6-B partial
  work preserved in stash `stopped-M6B-partial-before-vertical-slice-restart`, then tree reset to
  `origin/chatgptpro2008`. Baseline build + m0/m2/m2-ai/m3/m4/m5 gates pass.
- Code audit found three loop-closure blockers: player cannot reach Nexus technology from Yard;
  honest AI gathers/scouts but never builds Yard/commits path/fields army; Victory/Defeat has no
  Continue/Results UI. Locked closure order is VS-1 handoff, VS-2 AI+center, VS-3 results, then
  VS-4 slice-critical combat assets. Specs: `docs/VERTICAL_SLICE_SPRINT.md` and
  `docs/VS1_COMBAT_ASSETS.md`.
- Managed image generation for the two faction asset boards failed before charging with a Nous/FAL
  charge-intent fetch timeout (three attempts). Asset path switched to the existing deterministic
  startup-rasterized pixel pipeline; this does not block gameplay closure.
- Luna Max-fast VS0 audit completed at the exact 8-real-minute cap: real Worker income and Yard
  construction succeeded; no visible Yard→technology/production handoff appeared, so no combat
  unit or terminal path was reached; console errors 0. Biggest blocker = VS-1. Evidence/report:
  `/home/bobbyranka/workspace/evidence/starhaven-vs0-audit/`. Long exploratory playtests are
  retired; future seam checks stay at 5–10 minutes and final pacing uses fast QA.
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
- **M4-B HUD choice UI + guidance sweep** COMPLETE (`baeab86`, deployed attempt below):
  five-round critic loop — r1 FAIL (text overflow in 96px grid), r2 FAIL (states
  indistinct), r3 FAIL (progress hairline + hover-like glow + vague blurbs),
  r4 forensic round located the true root cause: `.choice` tiles inherited ~52px verb
  height against a 62px content stack, centered, so ink crossed both borders. r5 applied
  Sol's measured spec verbatim (88px min-height flex tile, gap 4px, bar margin 0,
  countdown line-height 15px). Fresh Sol gate: **PASS** ("choice, timed commitment, and
  locked confirmation are unmistakably distinct"). Lead pixel-verified no clipping
  (15px/32px border clearance) and correct bar paint (10px, 7% fill).
  `qa:m4` green: banned-word sweep, bar advance, double-commit rejection, locked readout.
  Evidence: `/home/bobbyranka/workspace/evidence/starhaven-m4-tech-paths/`.
- Deploy: production deploy BLOCKED from this box — wrangler has no OAuth config here and
  non-interactive mode needs CLOUDFLARE_API_TOKEN. Build is committed and pushed; deploy
  needs bobby's token or a Mac-side `npm run deploy`.
  (Update 2026-08-23: FIXED — bobby supplied a Cloudflare token; token in
  `~/.cloudflare-token` (0600). `npx wrangler pages deploy dist --project-name=spacepixelrts
  --branch=main` deploys to production. M4-B/M5 build live at spacepixelrts.pages.dev,
  bundle game-CKgLgIm0.js.)
- **Sol max usage directive:** bobby directed heavy Sol use (70% weekly left before reset);
  Sol now also runs design-support memos (M5 roster mapping memo dispatched in parallel).
- **M5-A roster freeze + labels COMPLETE** (`87844a8`, Luna builder, lead-verified):
  docs/M5_ARMY.md applied — stat deltas for Scout/Fighter/Ravager/Prism, ×1.8
  vs-buildings modifier moved Siege→Prism, rift-engineering train boost scoped to Prism,
  Siege/Shade refused at `tryTrain` and never spawned by AI, faction labels everywhere
  (Wind Strider / Grav-Skimmer / Lumen Guard / Rift Guard / Solar Strider / Burden Walker).
  All suites green (`test:m0/m2*/m3/m4/m5`, build). New `test:m5` suite (28 asserts).
- qa:m2-opening now RUNS on this box for the first time (was Mac-only: needed Google
  Chrome + hardware GL): chromium fallback, try/catch around setPointerCapture
  (synthetic pointers throw NotFoundError), software-GL frame gate = sim-share per the
  qa-m2-ai precedent. Full opening long-press proof PASSes: selection survives, Move
  order lands within 0 world units of target, sim share 2.71 ms < 8 ms budget.
  Evidence: `/home/bobbyranka/workspace/evidence/starhaven-m5-army/`.
- **M5-C/D HUD prescription + scene brightness COMPLETE** (`e95d63c`): Sol's topbar
  prescription applied verbatim (resource captions ORE/VOLATILES/CHARGE/POPULATION,
  charge-ability cluster with ▶/■ toggle labels, group buttons removed from v1,
  MOVE-then-tap copy, FIND IDLE WORKER / FIND SCOUT, selection stat grid, 12px text floor).
  Scene lighting raised for instant-read: hemisphere 2.1, key 3.2, central amber fill;
  fog veil lifted. Objective gate added: center-region `sceneLuma > 28` in qa-m2-opening
  (was 12.2 pre-fix, now 28.3). Sol round on M5-C FAILed on darkness; M5-D fixed that
  named gap. Fresh Sol re-gate still FAILed: topbar/ability/objective hierarchy collides.
  Visual-only iteration is paused while the critics test the actual game loop.
- **Blind gameplay gate — 2/3 COMPLETE (Sol Max fast, sealed production UI):**
  1. touch-only 1024×768: 51:05, FAIL — no trustworthy touch contract; armed MOVE tap
     deselects, resources become Attacking/no income, pause off-screen, technology dead-end;
  2. first-time 1366×1024: 52:25, FAIL — same economy→army break; no Harvest feedback,
     Yard/tech unreachable, combat/AI unreadable; zero console errors;
  3. expert RTS systems: 93:39 across Standard+Cadet, FAIL — same zero-income→unaffordable
     path→disabled army lock; also found hidden Yard Charge cost, silent objective placement,
     detached structure hit regions, onboarding ambush, and unreadable combat.
  All three independently named the missing closed economy→technology→army loop as the
  single biggest gameplay gap. Evidence/reports:
  `/home/bobbyranka/workspace/evidence/starhaven-blind-{gameplay,touch,systems}-sol/`.
- **M6-A touch order truth + first income COMPLETE** (`docs/M6_A_TOUCH_ORDER_TRUTH.md`):
  strict TDD RED saved in `tasks/M6A-red.log` (MOVE button left mode null), then GREEN
  in input.ts/hud.ts only; sim.ts untouched. Context resolver excludes Resources from enemy
  picks, resource target is 44 CSS px, armed MOVE/ATTACK/GATHER next-tap modes preserve
  selection, long-press/right-click share context routing, mixed combat units never Gather.
  Lead gates: `qa:touch-contract`, all m0–m5 suites, build PASS; zero console errors.
  Fresh blind touch-only re-gate PASS: MOVE armed→tap→Moving, GATHER armed→resource→Gathering,
  Volatiles visibly rose 40→48 in honest real time. Evidence/report:
  `/home/bobbyranka/workspace/evidence/starhaven-m6a-blind-touch/`.
  Remaining named gap: FIND IDLE WORKER is clipped at 1024×768 (responsive-HUD debt).
- **M6-B / VS-1 progression handoff + honest costs COMPLETE:** strict RED proved missing
  `tech-focus`, bare `needs path`, and hidden Yard Charge cost. GREEN adds no-selection
  `TECHNOLOGY PATH`, Yard `CHOOSE PATH`, Nexus focus/centering, full Ore/Volatiles/Charge labels,
  and explicit `Choose path first` recovery copy; sim/content/render untouched. Lead reran
  progression QA, touch QA, all m0–m5 suites, and build: PASS, console errors 0. QA negative
  no-Nexus case moved last so it no longer contaminates visual evidence with Defeat.
  Fresh Sol Max-fast blind gate on five 1366×1024 composited states: **PASS**. Named non-blocking
  debt: lower deck crowding near viewport edge. Evidence:
  `/home/bobbyranka/workspace/evidence/starhaven-vs1-target/`. VS-1 is deployed.
- **VS-2A honest AI doctrine COMPLETE** (`125744c` + pacing repair `a755aeb`): AI uses
  ordinary Worker construction for one Yard plus one required Habitat, commits the faction path
  through the normal 400/80 + 40s channel, trains an exact 2 Fighter + 2 unique first force through
  normal costs/times, scouts true unexplored frontier, holds center with AttackMove, and targets the
  player Core only after discovery and the 8:00 floor. Difficulty changes decision cadence only.
  R1 at 2:46 correctly FAILed lead pacing; R2 final fixed-seed Standard milestones: path 4:30,
  lock 5:10, 2+2 ready 6:14, Core attack 8:00. No grants (max positive step gain 9), hidden/pre-floor
  Core targets 0, retired units 0, scripted marshal false, console errors 0; SwiftShader sim share
  0.65ms <8ms. Lead reran VS2A QA/test, progression/touch QA, all m0–m5 gates, build: PASS.
  Observer screenshots exposed the same real sim state without changing production fog. Fresh Sol
  Max-fast blind gate: **PASS**. Named gap: final four combat silhouettes, already locked as VS-4.
  Evidence: `/home/bobbyranka/workspace/evidence/starhaven-vs2a-r2-lead/` and
  `/home/bobbyranka/workspace/evidence/starhaven-vs2a-observer/`. Next: VS-2B Central Lumen
  ownership/income/pulse.
- **Production live at VS-1** (`e36d48e`, `assets/main-CPZobgDv.js`): deployed to the
  existing `spacepixelrts` Pages project on production branch `main`. Live browser readback at
  1366×1024 confirms Yard `150 Ore · 20 Charge`, no-selection `TECHNOLOGY PATH`, both path
  choices at `400 Ore · 80 Charge`, state Playing, and zero console errors. `desktop.html` remains
  the non-orientation-gated laptop preview route.
- GitHub push BLOCKED from this Linux box (no gh login / credential helper / SSH key here;
  auth lives on the Mac). Local branch is ahead of origin; commits safe locally.
  (Update 2026-08-23: FIXED — bobby supplied a PAT; pushes work via ~/.git-credentials.)

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
