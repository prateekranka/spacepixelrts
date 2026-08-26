# A4 — Sweep & Pacing Diagnostics Audit (spec)

Read-only audit. Sources of truth verified against: `docs/VS5_PACING_CLOSURE.md`,
`docs/FIRST_PLAYABLE.md`, `tests/vs5-pacing.test.ts`, `tests/vs2-ai-doctrine.test.ts`,
`scripts/qa-vs5-pacing.mjs`, `src/engine.ts`, `src/content.ts`, `src/sim.ts`,
`src/discovery.ts`, `src/match-config.ts`. Sim is deterministic at 20 Hz: `TICK_HZ=20`,
`DT=1/20` (engine.ts). All tick constants below = `Math.round(seconds*60/DT)` = `seconds*20`.

## 1. Milestone list and source-of-truth constants

Exported today (import directly):
`DT, TICK_HZ, MAP, MAX_ENTS` (src/engine.ts); `OPENING_ORE_RESERVE=700` (src/sim.ts:96);
`STATS`, `CIV_PROFILE` (startOre vespari 220 / aurion 250), `TECH_PATHS`, `pathsForCiv`,
`POP_HOUSE=5`, `POP_HALL=10`, `GATHER_MAX=8` (src/content.ts); `SEEN_PLAYER=1`,
`SEEN_RIVAL=2` (src/discovery.ts); `DIFFICULTY_IDS`, `FACTION_IDS` (src/match-config.ts).

Module-private today (do NOT re-declare in tests/scripts): `PATH_COMMIT_ORE=400`,
`PATH_COMMIT_CHARGE=80`, `PATH_COMMIT_CHANNEL=40` (sim.ts:93-95); `AI_CADENCE_SECONDS`
{cadet 2.6, standard 1.4, veteran 0.8} (sim.ts:105); `AI_PATH_EARLIEST_TICK=5400`,
`AI_ATTACK_EARLIEST_TICK=9600` (sim.ts:111-113); `HONEST_STEP_GAIN_BOUND=96` (test-local).

**One new constants module: `src/pacing-contract.ts`** — single source of truth for every
deadline/window/bound not already exported. Contents (all exported): `MIN = 60*TICK_HZ`;
`PATH_LOCK_BY=8*MIN=9600`; `PAIR_BY=10*MIN=12000`; `TERMINAL_BY=18*MIN=21600`;
`AI_PATH_WINDOW=[4.5*MIN=5400, 7.5*MIN=9000]`; `AI_ATTACK_WINDOW=[8*MIN=9600, 12*MIN=14400]`;
`ATTACK_FLOOR=9600`; `HONEST_STEP_GAIN_BOUND=96`; `COMPACT_OPENING_ORE=770`;
`REPLACEMENT_SCOUT={ore:40, gas:0, energy:15, train:6}` (mirror of `STATS[Kind.Scout]`,
asserted equal); `FALLBACK_PATH` per civ (vespari→`sky-dominion`, aurion→`iron-colossus`);
`CENTER={x:MAP*0.5=36, z:MAP*0.52=37.44}`; `YARD_RING=8`; `GAIN_WINDOW_STEPS=1200` (60 s);
`IDLE_WINDOW_STEPS=400` (20 s); `REJECT_BURST=3` rejections / `REJECT_WINDOW_STEPS=200` (10 s);
milestone ids as ordered enum (below). sim.ts may later re-export these; until then
pacing-contract.ts is the audit/tests/sweep import point. All costs come from `STATS`.

Contract milestones (order matters; each = id, trigger predicate, deadline):

| # | id | trigger (predicate) | deadline |
|---|---|---|---|
| P1 | match-start | `world.reset(seed)`, tick 0; node reserves Ore 700 / Gas 200 / Solar 160 both teams | t=0 |
| P2 | player-yard-placed | team0 `tryPlace(Barracks)` ok, delta 150/0/20 | — |
| P3 | yard-complete | team0 Barracks `progress>=1` | — |
| P4 | eco-assigned | 2 Workers Gather Ore + 1 Gather Solar (guidance `assign-ore`→`fund-path`) | — |
| P5 | path-funded | team0 `ore>=400 && energy>=80` | — |
| P6 | path-committed | team0 `tryCommitPath` ok, delta 400/0/80, channel 40 s | — |
| P7 | path-locked | `techPathOf(0)===path` | ≤ 9600 (8:00) |
| P8 | mixed-pair | team0 Fighter + unique alive (vespari Ravager / aurion Prism) | ≤ 12000 (10:00) |
| P9 | lumen-discovered | central-lumen-field `discoveredBy & SEEN_PLAYER` | — |
| P10 | lumen-secured | `lumenState().owner===0` | — |
| P11 | rival-core-discovered | rival Hall `seenBy & SEEN_PLAYER` | — |
| P12 | core-destroyed / player-defeat | `winner!==-1` | ≤ 21600 (18:00) |
| P13 | results | QA dispatch `MATCH_WON/MATCH_LOST` → Victory/Defeat | — |
| A1 | ai-yard-placed | team1 `tryPlace(Barracks)` ok, dist to AI core < 8 | — |
| A2 | ai-yard-complete | team1 Barracks `progress>=1` | — |
| A3 | ai-path-commit | team1 `tryCommitPath` ok, delta 400/0/80, path = `FALLBACK_PATH[civ[1]]` | [5400, 9000] |
| A4 | ai-path-locked | `techPathOf(1)===path` | — |
| A5 | force-ready | team1 ≥2 Fighter + ≥2 unique alive | ≤ 9600 |
| A6 | center-hold | ≥4 combat units AttackMove `tid=-1` at CENTER | < 9600 |
| A7 | core-discovery | player Hall `seenBy & SEEN_RIVAL` | — |
| A8 | first-core-target | combat unit `tid===playerHall.id` | [9600, 14400] |
| A9 | first-attack | unit Attack/AttackMove on player Hall; `firstAttackForce>=4`; after A7 | ≤ 14400 |
| A10 | scout-replacement | (kill scenario) successful `tryTrain(Hall,Scout)` delta 40/0/15 `trainT=6`; before A7; zero such calls after A7 | before A7 |
| A11 | ai-terminal | `winner!==-1` | ≤ 21600 |

## 2. Diagnostic classifications (per-run detectors)

Measured on the instrumented run (trace of every tryPlace/tryCommitPath/tryTrain call with
tick/team/kind/ok/delta/trainT; per-step team eco snapshots; discovery events). Detection:

1. **source-contract deadline miss** — any P/A milestone above fires with tick > its deadline
   (or outside its window); report milestone id, actual tick, deadline, deficit.
2. **resource starvation** — a resource-funded milestone (P5/P6/P8, A3, A10) is pending while no
   income deposit (ore/gas/energy increase of any amount into the funding team) occurs for
   ≥ 1200 consecutive ticks (60 simulated seconds). Report window start/end, team, milestone.
3. **avoidable idle production** — ≥ 400 consecutive ticks (20 s) where the required next unit
   (per contract order) is affordable (`ore/energy >= STATS[kind].ore/energy`), pop capacity
   exists (`pop+pop<=cap`), the producing building (`trainT<=0`) is idle, and the unit is not
   trained. Applies to autonomous team 1; for team 0 it flags the harness policy itself.
4. **population-cap stall** — required unit rejected (or never attempted) because
   `pop+unit.pop>cap` while no House exists or is under construction for ≥ 1200 ticks, or
   `pop===cap` with army incomplete and no House placement call in that window.
5. **lost-scout recovery failure** — rival Scout died (kill/combat) and by 21600: player Core
   undiscovered (`SEEN_RIVAL` never set), or no successful `tryTrain(Hall,Scout)` (delta
   40/0/15, `trainT=6`), or ≥1 such call after discovery (violates VS5 closure §C). Player-side
   variant: player Scout dead and no player Scout exists while Lumen undiscovered.
6. **hidden-information targeting** — any team1 Fighter/Ravager/Prism with `tid===playerHall.id`
   while `(playerHall.seenBy & SEEN_RIVAL)===0`. Per-tick check, exact vs2/vs5 rule; record
   first offending tick + unit id.
7. **attacks before legal floor** — any team1 combat unit in Attack/AttackMove targeting the
   player Hall at `tick < 9600`; or `firstAttackTick < firstCoreDiscoveryTick` (attack before
   discovery). Record tick(s).
8. **impossible positive deltas** — per `world.step()`, `max(0,Δore)+max(0,Δgas)+max(0,Δenergy)`
   for the tracked team exceeds **96** in any single step. Report the step tick and the value.
9. **repeated rejected calls** — ≥ 3 consecutive rejections of the same action
   (`(buildingKind,kind)` for train, `(team,path)` for commit, `(team,kind)` for place) within
   200 ticks (10 s) with no intervening success. Indicates AI policy fighting the economy.
10. **no-terminal-by-18:00** — `winner===-1` at tick 21600 (the original VS5 stall signature).

A run may fire multiple classifications; each fired classification gets
`{id, firstTick, evidence: {tick range, entities, eco at ticks}, severity}`.

## 3. Failure taxonomy and exit codes

- **Tool execution error** (exit **2**): vite boot timeout (120 s), port allocation failure,
  browser launch failure, navigation/probe timeout (30 s), missing `__STARHOLD_WORLD__`,
  console/page errors, screenshot black/empty or wrong size, perf budget miss
  (`simShareMs >= 8 ms` on software GL). Harness fault — always fatal.
- **Invalid trace / schema violation** (exit **3**): manifest missing required keys, trace
  events out of chronological order or non-monotonic tick, event before reset tick, unknown
  milestone/kind ids, capture file missing, JSON parse failure. Data fault — always fatal.
- **Valid trace with game-contract failures** (exit **0** by default, **1** with
  `--fail-on-game-gate`): trace is valid and the sim ran to completion, but ≥1 of the 10
  classifications fired (manifest `ok=false`, `gates.failed>0`).

`--fail-on-game-gate` semantics: without it, game-gate failures are fully reported but the
process exits 0 (diagnostic/sweep mode — all 18 runs must execute regardless of individual
gates). With it, any game-gate failure makes the process exit 1 after the run completes.
Tool/trace errors (2/3) are never suppressed by the flag; the sweep harness aborts on them.

## 4. Reporting shape

Per-run `manifest.json` (superset of the qa-vs5-pacing.mjs shape): `{tool:
"qa-sweep-pacing", startedAt, finishedAt, args:{seed, difficulty, pairing, playerCiv,
aiCiv, viewport:1366x1024, fogOfWar:true, frozenRaf:true, directWorldFastStepOnly:true},
milestones:[{id, tick, ok, deadline?}], gates:[{id, pass, firstTick?, evidence?}],
classifications:[...], trace:{placeCalls, commitCalls, trainCalls, discoveryEvents},
sampled:[{tick, ore, gas, energy, pop, cap, alive:{...}, winner, lumenOwner,
coreSeen}], hashes:[{tick, worldHash}], captures:{...}, consoleErrors:[], errors:[],
ok}`. Exit-code contract per §3. Captures at milestone ticks when browser mode is on
(Playwright, 1366x1024, same harness as qa-vs5); sim-only mode (headless `tsx` World loop,
no browser) is the default sweep mode and emits no captures. Output dir absolute and outside
the repo (resolveOut rule), default `/home/bobbyranka/workspace/evidence/starhaven-sweep-pacing`.

## 5. Sweep matrix (18 runs)

`seeds = [24301, 424242, 57005]` × `difficulty ∈ [cadet, standard, veteran]` ×
`pairing ∈ [sunweaver-vs-gravemark (player vespari / AI aurion),
gravemark-vs-sunweaver (player aurion / AI vespari)]`. Player executes the frozen safe policy
(place Yard 150/0/20, 2×Ore + 1×Solar, builder returns, commit `FALLBACK_PATH[civ[0]]` at
400/80, train Fighter + unique via tryTrain); AI is fully autonomous. One run = full sim to
21600 ticks or winner. Artifacts per run under
`<out>/<pairing>/<difficulty>/seed-<seed>/`: `manifest.json`, `milestones.json`,
`diagnostics.json`, `world-hashes.json` (FNV-1a over ents + teams + landmarks at each
milestone and every 1200 ticks), `trace.json`, and `sweep-summary.json` at `<out>/` root
(per-run verdict table). Optional `--kill-scout` variant pass (18 extra runs) reuses the VS5
RED scenario (kill rival Scout at reset) to exercise A10.

## 6. Cross-run first-divergence analysis

For each (pairing, difficulty) group (3 seeds):
- **Passing-prefix comparison** — align the two runs' milestone timelines in order; while ids
  match and `world-hashes` at each milestone match, the prefix is common. First divergence =
  earliest tick where a milestone fires in one run and not the other, or hashes differ.
- Report per pair: `earliestDivergingTick`, `priorCommonMilestone` (id+tick),
  `expectedNextMilestone` (from the contract order), `actualEvent` (what fired / state
  observed instead), `resources/pop state` (ore/gas/energy/pop/cap at divergence tick),
  `worldHashBefore/After`, `likelyCategoryLabel` (first classification fired by the diverging
  run, from §2), and `seedReproduced` (whether ≥2 of 3 seeds in the group show the same
  divergence → systemic vs seed-specific).
- **Correlation-not-causation disclaimer** — every divergence entry states: the divergence
  tick correlates with the labeled classification; it is not proof the classification caused
  the divergence. Label "systemic" only when ≥2 of 3 seeds in the group reproduce it.
- Determinism guard: rerun one (seed, difficulty, pairing) triple per group; identical
  milestone ticks and hashes are required, else flag `determinism-break` in the summary.

## 7. Implementation notes

New files (future tasks, not this audit): `src/pacing-contract.ts` (constants, §1),
`scripts/qa-sweep-pacing.ts` (tsx-run headless sweep + optional browser captures;
reuses qa-vs5 instrumentation seams: `__STARHOLD_WORLD__`, `__VS5_TRACE__`-style
instrumentation, `world.kill`, `tryPlace/tryCommitPath/tryTrain` wrapping). Existing
`tests/vs5-pacing.test.ts` and `tests/vs2-ai-doctrine.test.ts` remain the RED gates the sweep
gates mirror; `scripts/qa-vs5-pacing.mjs` remains the browser evidence gate. No production
source changes required for the audit itself.
