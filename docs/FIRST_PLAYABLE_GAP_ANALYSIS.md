# Starhaven — First Playable Gap Analysis

Status: **ACTIVE** — grounded against the working tree on 2026-08-21. Companion to
`docs/FIRST_PLAYABLE.md` (the contract) and `docs/CANONICAL_VOCABULARY.md` (vocabulary).

## Branch and build facts

- Branch: `chatgptpro2008` at `9fc3067` ("feat: differentiate faction opening economies"),
  tracking `origin/chatgptpro2008`; tracked tree clean (untracked town-center tools/assets
  intentionally untouched).
- Relevant recent commits:
  - `a9acec2` chore: add shared game presentation modules
  - `21e7c08` docs: define Starhaven player direction
  - `336659a` feat: add Starhaven start screen
  - `f8c94f5` feat: add tactical pause control
  - `9fc3067` feat: differentiate faction opening economies
- Build: `npm run build` = `tsc --noEmit && vite build` — passing at HEAD.
- Existing npm scripts: `dev`, `build`, `preview`, `deploy`, `critic`, `screenshot`. No test
  runner, no QA route runner, no M0 harness yet.

## Milestone gap analysis

### M0 — Deterministic states + QA harness (missing entirely)

- There is no application state machine. `src/main.ts` boots straight into a constructed world
  with the start screen overlaid; none of `Boot`, `MainMenu`, `MatchSetup`, `Loading`, `Playing`,
  `TacticalPause`, `Victory`, `Defeat`, `Results` exist as explicit states, so "only Playing
  advances the sim" is not yet enforceable.
- Main booleans are scattered URL params: fog defaults OFF (`src/main.ts` sets
  `world.fogOfWarEnabled` only when the query string contains `fog=1`) and civ selection comes
  from boot params (`parseBootCiv`) with hardcoded defaults `world.civ[0]='vespari'`,
  `world.civ[1]='aurion'`.
- No `window.__STARHAVEN_QA__` probe; no fixed-seed scenario identifiers; QA today means manual
  URL params plus ad-hoc screenshot scripts (`scripts/screenshot.mjs`, `scripts/measure.mjs`).
- No focused state test and no `test:m0`/`qa:m0` entry points.

### M1 — Menu and setup

- A start screen exists (`src/start-screen.ts`, commit `336659a`): Starhaven title, mission copy,
  New Match / Tutorial / Settings actions, Continue rendered but disabled. Good bones for M1.
- Gaps: it is a single screen, not a menu -> setup -> loading flow. There is no MatchSetup screen
  (player/AI faction, difficulty Cadet/Standard/Veteran, map, fog on/off, speed 0.75x/1x/1.25x,
  tactical pause enabled/on-demand, seed mode + value fields), no Loading step, no results return
  path. The menu currently presents THREE factions (`FACTIONS` cards over legacy `vespari` /
  `aurion` / `voidmarked`); First Playable must surface exactly two playable factions (Sunweaver
  vs Gravemark) with the third hidden.
- Reset semantics between repeated starts are unverified ("reset exactly once" not enforced).

### M2 — Opening

- The sim already spawns bases, workers, and resource nodes deterministically, and an
  `opening-presentation.ts` module exists in tree. Gap: the opening is not wired to any named
  state or QA route; there is no player-driven opening composition (exactly one Core, four
  workers, one scout, safe resources, unexplored surroundings) tied to the M0 flow, no discovery +
  contextual-prompt layer, and nothing asserts opening determinism at a fixed seed.

### M3 — Asymmetric economies

- Commit `9fc3067` began differentiating faction opening economies. Gaps: asymmetry still keyed
  on legacy IDs (`vespari`/`aurion`) rather than canonical sunweaver/gravemark adapters; there is
  no evidence set proving players can feel the difference within two minutes; economy pacing
  across the full match is untuned.

### M4 — Technology paths

- Current progression is linear age code, not a two-way choice: `src/sim.ts` carries
  `epoch` / `ageT` fields, a `tryAgeUp(team)` path, and `minTrainEpoch(kind)` training gates —
  a single-track ladder that contradicts the contract's "one irreversible choice between TWO
  paths per faction."
- No technology-path selection UI, no per-faction path definitions
  (`solar-ascendancy` / `sky-dominion` / `iron-colossus` / `rift-engineering`), no irreversibility
  enforcement, and age/epoch language risks leaking into player-facing text.

### M5 — Four-unit rosters

- The sim supports more unit kinds than the compact target (including unique buildings per civ);
  no exact four-unit roster per faction is pinned, balanced, or documented, and roster naming has
  not been added to the vocabulary table.

### M6 — Touch strategy layer

- `f8c94f5` added a tactical pause control — but it is PAUSE-ONLY: the sim freezes and resumes;
  there are no radial command menus, no queued touch commands issued during pause, no touch worker
  command flows, and no formation controls. Input/minimap/box-select foundations exist and carry.

### M7 — Faction AI

- An opponent exists and plays. Gap: imperfect knowledge is missing — the AI does not respect fog
  of war (it reacts as if omniscient), does not run doctrine-shaped openings per faction, and does
  not make its own technology-path choice or contest the shared center deliberately.

### M8 — Shared-center conflict and Core victory

- A winner exists in the sim (`winner = 0|1` decided by Hall survival) and reaches the HUD/save
  snapshot, but there are NO Victory, Defeat, or Results screens — a finished match just keeps
  running behind the HUD. The shared-center objective on the current map is implicit, not a
  designed contested zone, and Helios Rift itself does not exist as a named map.

## Preserve list (do not regress)

1. Deterministic simulation core (fixed-step, seed-driven) in `src/sim.ts`.
2. Three.js iso presentation, elevation terrain, sprite/atlas pipeline (`src/render.ts`,
   `src/terrain.ts`, `src/sprites.ts`, `src/atlas.ts`, `src/height.ts`).
3. Touch input, box selection, camera pan/zoom, minimap (`src/input.ts`, `src/hud.ts`).
4. Economy, combat, pathfinding, fog-of-war mechanics, and winner determination as they stand.
5. Approved art assets (Sunweaver town-center reference pack, sprite sheets, palettes).
6. Performance budget: p99 frame time < 8 ms at 60 fps.

## Minimal atomic sequence

Each numbered item is one bounded task -> one commit (or small series under one milestone label),
in order:

1. `chore: add deterministic game states and visual QA scenarios`
2. `feat: add player-facing main menu`
3. `feat: add skirmish setup and civilization selection`
4. `feat: connect menu flow to deterministic match creation`
5. M2 opening commits
6. M3 economy commits
7. M4 technology commits
8. M5 roster/balance commits
9. M6 touch strategy commits
10. M7 AI commits
11. M8 conflict/results commits

No content or polish work interleaves before the loop closes at step 11.

## M0 frozen implementation contract

Scope guard: M0 adds NO gameplay redesign. `sim.ts` / `engine.ts` / `render.ts` are consumed
read-only; only flow/state/QA files change.

- **Owned existing files:** `src/main.ts`, `src/start-screen.ts`, `package.json`.
- **New files:** `src/app-flow.ts` (the nine-state machine + legal transitions),
  `src/match-config.ts` (typed match configuration),
  `src/qa-scenarios.ts` (deterministic scenario/route registry),
  one focused state test (`tests/app-flow.test.ts`),
  `scripts/evidence-path.sh` (prints the absolute durable evidence directory),
  `scripts/qa-m0.mjs` (Playwright route runner requiring an absolute durable `--out`).
- **Exact transitions:** the transition table in `docs/FIRST_PLAYABLE.md` §M0, verbatim —
  including `MainMenu <-> MatchSetup`, `Loading -> MatchSetup` on error, `Victory | Defeat ->
  Results` by explicit Continue, and `Results -> MatchSetup | MainMenu`. Illegal transitions
  reject and report consistently (console error + no state change) in every build.
- **Canonical default config:** player Sunweaver vs Gravemark (AI faction defaults to the rival;
  the two cannot match), map `helios-rift`, difficulty Standard (of Cadet/Standard/Veteran),
  fog ON (of on/off), speed 1x (of 0.75x/1x/1.25x), tactical pause Enabled (of
  enabled/on-demand), seed mode deterministic with QA seed fixed at `0x5eed`. Legacy
  `vespari`/`aurion` adapters live inside `match-config.ts` only.
- **QA probe:** `window.__STARHAVEN_QA__` exposes `{ state(), dispatch(event), config(),
  scenarios() }` — readback and legal events only; direct state assignment is impossible through
  the probe.
- **Evidence:** all captures at 1366×1024 written OUTSIDE the repository tree to an absolute,
  durable `--out` directory as returned by `scripts/evidence-path.sh`. There is NO TMPDIR
  fallback: a run without a valid absolute durable `--out` fails before capturing.
- **Acceptance (all green):**
  - `npm run test:m0` — focused state-machine test passes.
  - `npm run build` — typecheck + bundle pass.
  - `npm run qa:m0 -- --route <name> --out "$(scripts/evidence-path.sh)"` for each core route
    (`start-menu`, `match-setup`, `opening`, `scouting`, `tech-choice`, `midgame-sunweaver`,
    `midgame-gravemark`, `battle`, `victory`) — scaffold-level assertions pass and evidence lands
    at the returned absolute durable path outside the repo.
- **Exact commit target:** `chore: add deterministic game states and visual QA scenarios`.

## M1 frozen implementation contract

- Main menu items exactly: **Continue** (visible but disabled until a save system exists),
  **New Skirmish** (primary), **Tutorial**, **Factions**, **Settings**. The Factions screen shows
  Sunweaver and Gravemark only; no third playable faction anywhere.
- Setup fields exactly: Your Faction (Sunweaver | Gravemark), AI Faction (Sunweaver | Gravemark,
  defaulting to the rival; player and AI cannot match), AI Difficulty (Cadet / Standard /
  Veteran), Map (Helios Rift), Fog of War (On / Off), Match Speed (0.75x / 1x / 1.25x), Tactical
  Pause (Enabled / On-Demand), Seed Mode (Deterministic / Random) plus the seed value field
  (prefilled `0x5eed` under QA).
- Loading: displays at least one real render of the match scene being built; **no artificial
  delay**; the world is reset **exactly once** per started skirmish.
- No gameplay redesign; M1 changes only flow/UI files plus minimal `main.ts` wiring.

## Issue ledger

| ID | Priority | Summary | Milestone |
| --- | --- | --- | --- |
| FP-GAP-001 | P0 | Introduce nine-state app flow machine + exact legal-transition table (incl. Loading error path, explicit Continue to Results, Results branching) | M0 |
| FP-GAP-002 | P0 | Add `match-config.ts` with canonical default config + legacy adapters | M0 |
| FP-GAP-003 | P0 | Add `qa-scenarios.ts`, `window.__STARHAVEN_QA__`, `qa:m0` runner + `evidence-path.sh` (absolute durable `--out`) | M0 |
| FP-GAP-004 | P0 | Focused state test + `test:m0` script | M0 |
| FP-GAP-005 | P0 | Fog ON by default via config (URL param becomes override only) | M0/M1 |
| FP-GAP-001-M1 | P0 | Rebuild main menu with exact items Continue / New Skirmish / Tutorial / Factions / Settings; two factions only | M1 |
| FP-GAP-002-M1 | P0 | Skirmish setup screen: player AND AI faction, difficulty triad, fog, speed, pause mode, seed mode/value | M1 |
| FP-GAP-003-M1 | P1 | Loading step: ≥1 real render, no artificial delay, reset exactly once | M1 |
| FP-GAP-004-M1 | P1 | Menu -> deterministic match creation wiring | M1 |
| FP-GAP-101 | P1 | Player-driven deterministic opening (one Core, four workers, one scout, safe resources, unexplored surroundings) + discoveries/contextual prompts + `opening` route assertions | M2 |
| FP-GAP-102 | P1 | Canonicalize economy asymmetry behind sunweaver/gravemark adapters | M3 |
| FP-GAP-201 | P0 | Replace epoch/ageT ladder with irreversible two-way technology-path choice | M4 |
| FP-GAP-202 | P1 | Technology-path selection UI + irreversibility enforcement | M4 |
| FP-GAP-301 | P1 | Implement frozen four-unit rosters (Sunweaver: Worker / Wind Strider / Lumen Guard / Solar Strider; Gravemark: Worker / Grav-Skimmer / Rift Guard / Burden Walker); balance pass | M5 |
| FP-GAP-401 | P1 | Radial menus, queued pause commands, touch worker commands, formations | M6 |
| FP-GAP-501 | P1 | Fog-respecting AI knowledge + doctrine openings | M7 |
| FP-GAP-502 | P2 | AI technology-path choice + shared-center contest behavior | M7 |
| FP-GAP-601 | P0 | Victory / Defeat / Results screens; explicit Continue into Results; Results exits to MatchSetup or MainMenu | M8 |
| FP-GAP-602 | P1 | Helios Rift shared-center objective design + `battle`/`victory` routes | M8 |
