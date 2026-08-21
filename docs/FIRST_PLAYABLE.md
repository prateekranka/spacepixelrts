# FIRST PLAYABLE — Starhaven Skirmish (active product contract)

Status: **ACTIVE**. This document is the contract for the next deliverable. Nothing ships past
this scope until this loop is complete. `docs/CANONICAL_VOCABULARY.md` is frozen and governs all
labels/IDs used here. The older visual-only isometric plan (`docs/ISO_REWRITE_PLAN.md`) remains
historical; where it conflicts with this contract, this contract wins.

## The loop (exact, one skirmish, 12–18 minutes)

Main menu -> setup -> loading -> one Helios Rift map -> fog scouting -> faction economy ->
one irreversible technology-path choice between two options -> four-unit compact army ->
shared-center conflict -> destroy enemy Core or lose -> results.

Time envelope for a full run on a Standard AI opponent:

| Phase | Window |
| --- | --- |
| Main menu + setup + loading | minute 0 – 2 |
| Opening: Core up, workers gathering, first scout out | minutes 0 – 4 |
| Fog scouting reveals enemy position / shared center | minutes 2 – 6 |
| Faction economy ramps to sustained production | minutes 3 – 10 |
| Irreversible technology-path choice committed | by minute ~8 |
| Four-unit army assembled, moves toward shared center | minutes 6 – 14 |
| Conflict at the shared center, push to enemy Core | minutes 8 – 17 |
| Victory / Defeat resolution + results screen | by minute 18 hard cap |

A match that cannot resolve inside 18 minutes is a defect of pacing, not a feature.

## Target device

- iPad landscape, 4:3. Primary logical canvas **1366x1024** (backing store 2732x2048 accepted).
- Both `LandscapeLeft` and `LandscapeRight` orientations must render correctly.
- Safe areas respected on every screen state (notch/home-indicator margins).
- All evidence captures are taken at 1366x1024.

## M0 — application states

Exactly these states exist:

`Boot, MainMenu, MatchSetup, Loading, Playing, TacticalPause, Victory, Defeat, Results`

Rules:

1. Only `Playing` advances the simulation. `TacticalPause` holds the sim frozen while commands
   remain available. Every other state renders static or transitional UI.
2. State changes happen only through legal transitions driven by player/QA events. QA never
   assigns state directly; it dispatches legal events through `window.__STARHAVEN_QA__`.

Exact transition table (the only legal transitions):

- `Boot -> MainMenu`
- `MainMenu <-> MatchSetup`
- `MatchSetup -> Loading`
- `Loading -> Playing`, or `Loading -> MatchSetup` on error
- `Playing <-> TacticalPause`
- `Playing -> Victory | Defeat`
- `Victory | Defeat -> Results` by explicit Continue
- `Results -> MatchSetup | MainMenu`

3. Illegal transitions are rejected and reported consistently (console error + no state change)
   in every build.

## Deterministic QA routes

Fixed seed `0x5eed`, fixed camera presets per route. Routes may be scaffolds before their
mechanic lands, but each must identify its scenario deterministically (route id, seed, config,
asserted states).

Primary routes (required):

1. `start-menu`
2. `match-setup`
3. `opening`
4. `scouting`
5. `tech-choice`
6. `midgame-sunweaver`
7. `midgame-gravemark`
8. `battle`
9. `victory`

Supplemental routes (state coverage only, added alongside the primary set):

10. `loading`
11. `tactical-pause`
12. `defeat`
13. `results`

## Evidence per checkpoint

Every milestone checkpoint produces, at minimum:

- 4:3 normal-UI capture at 1366x1024;
- UI-free gameplay capture;
- close tactical view (zoomed-in combat/worker scale);
- far strategic view (whole-map readability);
- contact sheet when any animation changes in the checkpoint;
- FPS p99 frame time (budget: < 8ms);
- draw call count;
- active entity count;
- memory where measurable.

Evidence lives OUTSIDE the repository working tree: every run writes to an absolute, durable
`--out` directory path as returned by `scripts/evidence-path.sh` (no TMPDIR fallback).

## Milestones

### M1 — Front door (menu/setup exactly as specified)

Main menu -> setup -> loading. Main menu items exactly: **Continue** (visible but disabled until
a save system exists), **New Skirmish** (primary), **Tutorial**, **Factions**, **Settings**.
Setup visibly chooses:

- your faction (Sunweaver | Gravemark) AND the AI faction — the AI faction defaults to the rival
  faction, and player and AI factions cannot match;
- AI difficulty: Cadet / Standard / Veteran;
- map: Helios Rift;
- fog of war: on / off;
- match speed: 0.75x / 1x / 1.25x;
- tactical pause: enabled / on-demand;
- seed mode: deterministic / random, plus the seed value.

Loading shows at least one real rendered match frame, adds no artificial delay, and resets the
world exactly once per started skirmish.

### M2 — Opening

The skirmish opens player-driven with an exact starting composition: exactly one Core, four
workers gathering safe nearby resources, one scout idle at base, and unexplored surroundings.
The player selects the scout personally and explores; nothing plays itself. Exploring yields
discoveries (terrain features, resource caches, traces of the enemy) each surfaced with a short
contextual prompt at the moment it matters — never blocking modal tutorials. The layout is
deterministic at fixed seed; the exploration is the player's own action.

### M3 — Asymmetric economies

Sunweaver and Gravemark economies differ measurably: different opening resource rhythms and
spend profiles, same deterministic sim core.

### M4 — Two-way technology choice

Each faction makes exactly ONE irreversible choice between TWO technology paths:

- Sunweaver: Solar Ascendancy (`solar-ascendancy`) or Sky Dominion (`sky-dominion`);
- Gravemark: Iron Colossus (`iron-colossus`) or Rift Engineering (`rift-engineering`).

No linear ladder, no ages/epochs anywhere in player-facing text. Committing a path locks it for
the rest of the skirmish.

### M5 — Four-unit compact army

Rosters are frozen exactly:

- **Sunweaver:** Worker, Wind Strider, Lumen Guard, Solar Strider.
- **Gravemark:** Worker, Grav-Skimmer, Rift Guard, Burden Walker.

Exactly four unit types per faction; roles distinct and readable (one anchor role per unit).

### M6 — Touch strategy controls

Tactical pause freezes the sim; radial command menu; touch-first worker assignment; formation
gestures. Everything usable one-thumbed on iPad; keyboard never required.

### M7 — Faction AI

The AI opponent plays its faction doctrine with imperfect knowledge (it respects fog of war and
does not cheat vision), sustains an economy, and pressures the shared center and your Core.

### M8 — Shared-center conflict and Core victory

One contested center area both players fight over. Destroying the enemy Core ends the match:
Victory if you destroyed it, Defeat if yours falls. Victory/Defeat advance to Results only by
explicit Continue; Results reports outcome, duration, and key stats, then exits to MatchSetup or
the main menu.

## Deferred (exact list — out of scope until the loop is complete)

1. Third playable faction: Nihiline / legacy `voidmarked` stays hidden and deferred, not deleted.
2. Dedicated data migration off legacy IDs (`vespari`, `aurion`, Hall/Nexus internals).
3. Additional maps beyond Helios Rift.
4. Rosters beyond the exact four per faction (future 12–15-unit expansions).
5. Full Core evolution system.
6. Full building rosters beyond First Playable structures.
7. Save/resume system (Continue remains disabled).
8. Tutorial depth beyond a stub.
9. Settings depth beyond essentials.
10. Multiplayer / network play.
11. Campaign mode and narrative cinematics.
12. Monetization and App Store release work.
13. Achievements, store, and daily rewards.
14. Cinematic pass and an extensive VFX editor.
15. Localization beyond English.
16. Audio polish beyond existing baseline.
17. Town-center 3D viewer integration into the live match.

## First Playable Complete checklist (all twelve required)

1. Player-facing main menu reachable from boot.
2. Setup screen visibly selects player AND AI faction plus difficulty/map/fog/speed/pause/seed.
3. Loading step renders at least one real match frame before play.
4. One Helios Rift map hosts every skirmish deterministically.
5. Fog scouting works and is required to find the enemy and the shared center.
6. Both faction economies gather, spend, and sustain production asymmetrically.
7. Each faction commits ONE irreversible choice between TWO technology paths.
8. Exactly four units per faction form the compact army.
9. A shared contested center drives conflict mid-match.
10. Destroying the enemy Core wins the match.
11. Losing your own Core ends the match in Defeat.
12. Results screen reports the outcome and returns cleanly to the main menu.

## Operating contract

- **Sol Max (orchestrator):** directs work, reviews evidence, controls scope. Hands out exactly
  one bounded task at a time; nothing else may be started.
- **Ox Alpha Max (implementer):** executes the single bounded task end-to-end, runs acceptance,
  commits with the exact prescribed message, pushes, reports facts only.
- **DeepSeek V4 Flash Vision Max (critic):** image-only. For important gates it provides THREE
  independent critiques against the actual captures. Its visible scoring categories are exactly:
  hierarchy/readability, faction distinction, touch-target clarity, silhouette, visual-state
  clarity, environmental cohesion, UI density, and normal 4:3 iPad gameplay — judged on what is
  visible in images, alongside visual fidelity vs references and correctness of copy legible on
  screen.
- DeepSeek must NOT judge: code quality or architecture, performance numbers (FPS/p99/draw
  calls/memory), determinism, simulation or balance math, non-visible behavior (AI decisions,
  pathfinding correctness, save integrity), test pass/fail status, or process/git compliance.
  Those verdicts come from automated checks and Sol's review.

## Guardrails

- Progression language is "technology paths"; never "ages"/"epochs" in player-facing text.
- There is NO linear technology path: one irreversible choice between two paths per faction.
- No third playable faction appears anywhere in the First Playable experience.
- Deprecated public terms (see vocabulary doc) appear nowhere in rendered strings.
