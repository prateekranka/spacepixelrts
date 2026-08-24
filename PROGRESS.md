# Starhaven — live status

**Play:** https://spacepixelrts.pages.dev
**Bar:** StarCraft II (space RTS, base building, asymmetric factions) — blind, on the running game.
**Active goal:** **Playable Vertical Slice** — close one honest 12–18 minute iPad-first 4:3
skirmish before deep controls or general polish: menu -> scout -> gather -> choose technology path ->
train mixed army -> center conflict -> destroy/lose Core -> Results. Active sprint:
`docs/VERTICAL_SLICE_SPRINT.md`; parent contract: `docs/FIRST_PLAYABLE.md`.

## AAA front-end art (2026-08-24) — DONE

Branch `hermes/starhaven-aaa-front-end` (from `codex/starhaven-menu-rebuild`). PR **#11** open
(base `codex/starhaven-menu-rebuild`). Contract frozen:
`docs/AAA_FRONT_END_ART_SPEC.md` + `docs/AAA_FRONT_END_INTEGRATION_SPEC.md`.

- Replaces the two procedural placeholder scene packs (flat geometry) with four
  MASTERWORK-authored illustrated packs: sunweaver menu/loading + gravemark
  menu/loading, each a real layered stack (sky / celestial body / far terrain /
  settlement or quarry-city / foreground / atmosphere / lights mask / ship sheets
  / animation strips) aligned to one 1920x1080 coordinate system (`public/
  front-end/civilizations/<civ>/<mode>/`), manifest-driven at 960x540 logical.
- Art pipeline (lead-owned): 2 menu key-art candidates per civilization generated,
  blind-reviewed, refined once, loading compositions matched, then per-layer
  generated art with shared anchor geometry, chroma/black keying (luminance-aware
  dither kill), body placement (sun 0.28/0.26 r=0.21H; moon 0.26/0.22 r=0.17H),
  1920x1080 exact export. Masters + pipeline + provenance: `assets/front-end/`.
- Sunweaver: luminous sun capital, lattice towers, suspended bridge, plaza
  terraces, sailcraft traffic, warm white/amber/gold/cyan/indigo, calm right side.
- Gravemark: fractured moon + cratered asteroid ring, terraced quarry-city,
  gravity cranes, conveyors, smelter warning lights, Grav-Skimmers, heavy
  carrier, obsidian/steel/mineral-green/ice-blue, dense crystal foregrounds.
- No flattened image: ships/strips/masks are separate animated assets; packs are
  distinct compositions, no hue-rotate (test forbids it).
- Implementation (Luna builder, lead-verified): `src/front-end-scene.ts` rewritten
  as authored layered compositor — public API + dataset contract preserved;
  tests/front-end-scene.test.ts unchanged. New `tests/aaa-front-end-scene.test.ts`
  (pack validation) + `scripts/qa-aaa-front-end.mjs` (2 civs x 2 modes, 1920x1080).
- VERIFICATION (lead re-ran all gates): test:m0 PASS, test:aaa PASS, build PASS,
  qa:aaa PASS (4 captures, canvases painted, 0 console errors), and the blind
  critic (deepseek-v4-flash-vision-exp, gates a-g per image) reports **PASS on all
  four** — loading screens intentionally simpler (UI overlay band).
- Evidence: `/home/bobbyranka/workspace/evidence/starhaven-aaa/`.
- KNOWN NITS (non-blocking): loading packs less lavish than menu masters (by
  design); sunweaver far-right tower silhouette is plain; ships read slightly
  toy-like at runtime scale.
- NOT DEPLOYED to Cloudflare: PR still unmerged; production keeps the previously
  approved front end (b406cb6 / e2e9a16c) until #10+#11 merge.

## Pixel front-end shell (2026-08-25) — IN PROGRESS

- Isolated worktree: `/home/bobbyranka/workspace/spacepixelrts-pixel-ui-shell`; branch `hermes/starhaven-pixel-ui-shell` from `origin/hermes/starhaven-aaa-front-end` at `9020475`.
- Branch reconciliation complete: authored branch is 10 commits ahead of `origin/chatgptpro2008`; integration is 0 commits ahead. No newer gameplay or functional-menu commit needed to be merged.
- Authored asset proof: Sunweaver 22 files and Gravemark 21 files; distinct manifest hashes and compositions; no hue-rotation substitute. Protected `src/sim.ts` and `src/engine.ts` hashes recorded.
- Baseline gates pass: `test:m0`, `test:aaa`, build, and `qa:aaa`; four 1920 × 1080 captures, 0 console errors. Evidence: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/baseline/`.
- Frozen DOM visual contract: `docs/PIXEL_FRONT_END_SYSTEM.md`. Single biggest gap: smooth web-dashboard UI over accepted pixel-art scenes. Implementation will replace the shell without changing gameplay or authored scene packs.

### FPE-1 — local pixel UI foundation (2026-08-25) — COMPLETE

- Bundled Pixelify Sans Bold, Silkscreen Regular/Bold, and Kode Mono Regular/Medium as local WOFF2 files, each under the SIL Open Font License 1.1; retained the upstream `OFL.txt` text and pinned source/hash provenance in `public/front-end-ui/PROVENANCE.md`.
- Added six authored integer-grid SVG assets for Records, Match History, Tech Codex, Dispatches, Sunweaver, and Gravemark. Utility controls remain real labeled buttons, and existing faction/profile/panel callbacks are unchanged.
- Verification: `npm run test:pixel-front-end`, `npm run test:m0`, `npm run test:aaa`, `npm run build`, and `git diff --check` all PASS. Protected `src/sim.ts`, `src/engine.ts`, and civilization assets remain byte-identical to `645b0ec`.
- Historical FPE-1 limitation: the loading rules and injected start-screen CSS still contained the pre-FPE-1 smooth shell treatment at that checkpoint; the later FPE-2 entry below records the Main Menu ownership handoff.

### FPE-2 — Main Menu pixel shell (2026-08-25) — COMPLETE

- Removed runtime `START_SCREEN_CSS`/`injectCss()` ownership from `src/start-screen.ts` and moved the start-screen presentation into the external `public/front-end-shell.css`. The Main Menu now uses the frozen 448 px deck, 448 × 64 profile, 448 × 64 menu controls at 1366 × 1024, 56 px responsive controls at the short target heights, local Pixelify Sans / Silkscreen / Kode Mono roles, opaque neutral frames, faction accent strips, hard shadows, stepped whole-pixel motion, DOM tooltips, and restrained Sunweaver/Gravemark motifs.
- Preserved the authored full-bleed scene compositor, menu/setup/panel callbacks, preferred-faction persistence, loading lifecycle, and Dispatches badge profile path. `#start-screen[data-civ]` follows the current preferred faction, and the Main Menu contains one visible primary New Skirmish action plus four real SVG-mask utility buttons with `aria-describedby` tooltip nodes.
- Verification: `npm run test:pixel-front-end`, `npm run test:m0`, `npm run test:aaa`, `npm run build`, `npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-main-menu`, `npm run qa:front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-rebuild-regression`, and `git diff --check` all PASS. The pixel QA manifest records both factions at 1920 × 1080, 1366 × 768, 1366 × 1024, and 1180 × 820, focused/tooltip captures, control interactions, Dispatches clear-and-reload persistence, whole-pixel 1366 × 1024 edges, and zero console/page errors.
- Evidence: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-main-menu/manifest.json`; regression evidence: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-rebuild-regression/manifest.json`.
- Round 1 blind review: FAIL — the visible Main Menu tagline read as a smooth anti-aliased face beside the pixel labels. Targeted R2 repair changes only the visible promise, note, profile-record copy, and menu subtitle roles to local Silkscreen with integer sizes and readable spacing; geometry, scenes, setup, panels, and loading are unchanged.
- R2 evidence: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-main-menu-r2/manifest.json`.
- R2 smallest-viewport blind review: FAIL — at 1180 × 820 the bottom-left `STARHAVEN // HELIOS RIFT` footer read as clipped against the viewport edge because the max-width:1200 shell used 20px bottom padding. R3 raises that footer/dock-only padding to 28px, adds the permitted 1px hard dark footer text shadow for the golden scene, and raises the separate short-height desktop footer/dock inset from 20px to the 24px QA minimum; no other geometry or protected surface changes.
- R3 evidence: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-2-main-menu-r3/manifest.json`; the all-target footer inset is 24px or greater for both factions, with 28px at 1180 × 820.
- Limitation: setup and panel styling remain explicitly marked FPE-3 legacy surfaces, and loading remains an explicitly marked FPE-4 legacy surface. Screenshot review was limited to missing or clipped controls as required; no independent aesthetic/critic grade is claimed here.

### FPE-3 — Pixel panels and Match Setup (2026-08-25) — COMPLETE

- Replaced the FPE-3 setup/panel legacy block with one production pixel section. Match Setup now uses an opaque neutral command interface with a framed header, faction match-up and rules sections, 4 px-grid spacing, 2 px/1 px frame layers, 6 px hard shadows, 8 px chamfers, local Pixelify Sans / Silkscreen / Kode Mono roles, stepped selected segments with hard markers, and visible deterministic-seed focus/invalid states.
- Rebuilt Tutorial, Factions, Settings, Records, Match History, Tech Codex, and Dispatches with the same 880 px maximum panel frame, 24 px safe inset, opaque body, hard inner highlight, 6 px shadow, CSS pixel close X, 140 ms `steps(4, end)` reveal, square scrollbar, Reduced Motion suppression, and neutral integer-grid rows. Existing callbacks, content, profile writes, Dispatches unread persistence, faction scene updates, focus trap, Escape/touch close, and exact opener restoration remain intact.
- Verification: `npm run test:pixel-front-end`, `npm run test:m0`, `npm run test:aaa`, `npm run build`, `npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-3-panels-setup`, `npm run qa:front-end -- --url http://127.0.0.1:4173 --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-3-rebuild-regression`, and `git diff --check` all PASS. Pixel QA records 28 passing assertions, 27 screenshots, both player factions at 1920 × 1080, 1366 × 768, 1366 × 1024, and 1180 × 820, all seven panel captures at 1366 × 1024, a 1180 × 820 panel, Reduced Motion, touch, focus wrapping/restoration, deterministic seed validation, mirror swap, preferred-faction/scene update, Dispatches persistence, local fonts, target sizes, overflow, and zero browser/page errors. `manifest.json` is the durable capture list.
- Evidence: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-3-panels-setup/manifest.json`; built-preview regression: `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/fpe-3-rebuild-regression/manifest.json`.
- Screenshot review was limited to missing, overlapping, or clipped controls as required. Representative setup and every panel-family capture showed the required controls and panel contents inside their viewport; no independent aesthetic/critic grade is claimed here.
- Limitation: loading remains the sole explicitly scoped FPE-4 legacy surface and was intentionally not segmented in this phase.

## Front-end rebuild (2026-08-24)

- Replaced the four filtered copies of one flattened menu painting with two faction-owned 960 × 540
  procedural scene packs: `sunweaver-capital` and `gravemark-quarry`.
- Rebuilt the command deck as real DOM controls over the scene canvas. The menu has one New Skirmish
  action and real Records, Match History, Tech Codex, and Dispatches utility buttons.
- Added a defensive local player profile. It stores the preferred faction, match totals, fastest
  victory, up to 20 recent matches, achievement identifiers, and the last Dispatches version seen.
- Match completion records one result after a real Victory or Defeat transition. QA routes do not
  write player profile data.
- Added stepped 12 fps scene motion, integer logical movement, Reduced Motion support, live faction
  cross-selection, responsive iPad layouts, panel focus restoration, and a persistent unread badge.
- Focused proof: `test:m0`, production build, and `qa:front-end` pass. The rendered browser gate checks
  22 contracts across 1920 × 1080, 1366 × 768, 1366 × 1024, and 1180 × 820.
- Evidence: `/Volumes/codex/evidence/starhaven-menu-rebuild/20260824T141252Z.IU8xBR/front-end-qa/`.

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
- Deploy: production deploy is now **COMPLETE** for the approved animated pixel-art front end.
  `npx wrangler pages deploy dist --project-name=spacepixelrts --branch=main` uploaded 15 changed
  assets and returned deployment `e2e9a16c`. Cache-busted live readback confirms `/` and
  `/desktop.html` return 200, both reference `assets/main-BTAMIc4r.js`, the bundle returns
  `200 application/javascript`, and approved CSS/art files return 200. Browser smoke confirms
  title Starhaven, two New Skirmish controls, MatchSetup entry, console/page errors 0.
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
  `/home/bobbyranka/workspace/evidence/starhaven-vs2a-observer/`.
- **VS-2B Central Lumen ownership COMPLETE** (`0acf224` + marker repair `0813d75`): exact
  combat roster captures the discovered 4.5-radius field in 5s; contested/empty reset progress;
  owner receives +1 Charge/s and a 4s global vision pulse every 30 owned seconds; no winner change.
  Compact panel and 6px bar live under matchup tiles; minimap marker tints by owner. R1 sim/HUD/QA
  passed but fresh Sol FAILed the missing spatial link. R2 browser RED proved 0/32 overlay perimeter
  samples in all seven states and absent +/-10 minimap ring colors; GREEN adds a projected 32-point
  world ring, LUMEN beacon/plate, partial capture arc, contested/owner colors, pulse ring, and larger
  minimap marker with zero WebGL calls. Lead replay: 32/32 all states, player/rival exact +10 Charge,
  pulse 30s/4s, sim share <0.8ms, winner -1, console 0, all VS2/M0–M5/build gates PASS. Fresh Sol
  R2 blind gate: **PASS**. Named non-blocking debt: thin capture progress. Evidence:
  `/home/bobbyranka/workspace/evidence/starhaven-vs2b-r2-lead/`.
- **VS-3 terminal/results/same-page replay COMPLETE** (`9324cd5` + truth repair `4c272e7`):
  real Core death freezes World/AppFlow; touch/keyboard CONTINUE reaches a deterministic two-column
  Results panel; Play Again resets the same World/View/Input/Hud with one listener/canvas set and
  changed seed/factions; second match Defeat exits cleanly to one Main Menu. Stats defensively track
  every positive income source, post-reset units trained, real combat deaths once, and actual capped
  Core damage. R1 passed flow but lead RED found combat `unitsLost=0` and green Defeat Results. R2
  RED captured 0!=1 plus missing outcome class; GREEN proves melee/bolt loss=1, repeat death=0,
  Victory lime/leaf, Defeat coral/red, exact nonzero 01:00 durations. Lead replay: resetCount=2,
  winner/stats/input reset, changed terrain, terminal ticks frozen, one object/canvas set, console 0,
  sim share <0.9ms; all VS1/VS2/M0–M5/build gates PASS. Fresh Sol Max-fast terminal/results gate:
  **PASS**, no material gap. Evidence: `/home/bobbyranka/workspace/evidence/starhaven-vs3-r2-lead/`.
  The complete functional vertical slice now exists.
- **VS-4 / VS-4A four-unit combat asset pack COMPLETE** (`1b4c658`, `4b29e68`, `892d96c`,
  `d8cc5ed`): one shared 1024×256 64px atlas supplies 8 facings ×2 live poses for Lumen Guard,
  Solar Strider, Rift Guard, and Burden Walker; corpse/dissolve stays legacy. R3 locked exact world
  scales, two-layer amber/ice material rims, average cell luma 95.7–156.7 (>=3:1), 100% rim layers,
  draw calls 5/5, runtime MAG0, and sim share ~1.4ms. Three normal-scale losses isolated Rift Guard's
  cabinet composition; architecture rebuild replaced only row2 with a 12×12 head, 22×17 torso,
  separated legs, 18×30 shield, and connected 39.8–40.8px diagonal polearm. 48/48 other-row hashes
  remain byte-frozen; 16/16 row2 anatomy cells pass; all regressions/build pass. Fresh Sol identical
  unlabeled 1366×1024 gate: **PASS** — factions immediate, both guards armed, walkers distinct.
  Evidence: `/home/bobbyranka/workspace/evidence/starhaven-vs4a-lead/` and
  `/home/bobbyranka/workspace/evidence/starhaven-vs4a-rift/`.
- **VS-5 first-match pacing closure FROZEN / ACTIVE** (`docs/VS5_PACING_CLOSURE.md`): one
  no-restart production match failed at18:00 with real income, completed Yard, exact path UI, but
  390/400 Ore and no path/army/Lumen/battle/terminal. Root arithmetic: start220 - Yard150 + safe Ore
  node280 =350, structurally 50 short; full compact spend770 needs550 gathered. Opening Ore reserve
  becomes700, costs/gather unchanged. Guidance is reordered Build Yard→fund path with two Ore
  Workers→choose/channel→faction-aware mixed army before Signal. Separate repro killed the only AI
  Scout and produced no winner at18; normal 40-seed sample resolved by15:08. AI will legally retrain a
  lost Scout at its Hall, no grant/spawn/hidden target. Strict tracer REDs, path<=8, mixed pair<=10,
  scout-death winner<=18, visible 1366×1024 QA required. VS-5 implementation `5d336e4`
  independently passes focused unit/browser proof, all protected regressions, and build: Yard tick154,
  path funded2610, lock3411, mixed pair3880, replacement Scout exact 40/0/15 +6s, real terminal13413
  (11:11), no grants/spawns/winner writes/errors, sim share1.46ms. Fresh Sol five-frame gate then
  **FAILed one visual defect**: Sky Dominion card bottom clips because two 88px full-width choices
  cannot fit a 112px deck.
- **VS-5A fully visible technology choice COMPLETE** (`44d33e8`): strict RED measured Solar
  `bottom=940`, Sky `bottom=1034` against viewport1024 and 94px row offset. GREEN focuses the
  uncommitted Nexus deck into two equal one-row cards: Solar `730–1037 × 924–1012`, Sky
  `1043–1350 × 924–1012`; channel card `730–1350 × 924–1012`; all 88px, fully visible, exact costs
  unchanged. Independent VS5/progression/touch/AI/build gates pass. Fresh Sol repaired five-frame
  chain: **PASS**. Residual: Solar Strider cost wraps tightly but remains readable. Evidence:
  `/home/bobbyranka/workspace/evidence/starhaven-vs5a-lead/`. VS-5 now awaits only one no-restart
  production whole-match gate. R2 final match **FAILed**: visible income/Yard/path cards passed, but
  only one Worker reached marked orange Ore while other income depleted blue Volatiles (`40→240`);
  final Ore222, no path/army/terminal. Luna also exceeded hard stop; browser was killed at20:11.
- **VS-5B counted Ore-worker assignment FROZEN / ACTIVE**
  (`docs/VS5B_ORE_WORKER_FEEDBACK.md`): guidance now must prove ordinary Ore assignment0/2→1/2→2/2
  before funding. Exact touch instruction names Find Idle Worker, GATHER, and marked Ore; target label
  carries the live count. No automated order or economy tuning. Implementation `a3bcbae`
  independently passes unit/browser/protected gates:0/2→1/2→2/2, path funded2745, lock3546, mixed
  pair4019, replacement Scout exact, terminal11741 (9:47), sim share1.35ms. Fresh six-frame Sol FAIL
  was incomplete evidence; complete eight-frame re-gate then found the true remaining gap: post-army
  guidance does not tell the player to command the army to Lumen or the rival Nexus.
- **VS-5C post-army objective/victory guidance COMPLETE** (`b969141`, copy sharpened
  `67e375f`): after the mixed pair, guidance walks secure-lumen → push-lumen (owner0) →
  destroy-core (rival Nexus discovered), with LUMEN/PUSH/RIVAL NEXUS world markers. Terminal
  overlay now freezes the banner and target so stale coaching never contradicts the outcome.
  Unit REDs, browser REDs, and all protected gates pass; natural discovery tick4179, player capture
  owner0 tick4578 with pair alive, real terminal tick10589 (8:49), sim share1.26ms, zero errors.
  Production deployed (`787bb197`) and live-verified. DeepSeek blind critic (new route) final
  six-frame gate: **PASS** — every frame's next action judged clear; residual nit is honest retrain
  coaching when the pair dies at Lumen (correct behavior). Evidence: `starhaven-vs5c-r3/`.
- **Production live at accepted VS-4A assets but VS-5 pacing FAIL** (`1e22b5e`,
  `assets/main-CQGftbuI.js`): deployed to existing Pages `main`. Live readback confirmed combat atlas
  1024×256, four mappings, exact scales, draw calls5, runtime MAG0, console0, composited lineup at
  `/home/bobbyranka/workspace/evidence/starhaven-vs4a-production/`. One subsequent normal production
  match exposed the active VS-5 pacing blocker; production is not yet the accepted final slice.
  `desktop.html` remains the laptop preview route.
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
