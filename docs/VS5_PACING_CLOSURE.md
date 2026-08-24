# VS-5 — First-Match Pacing Closure

Status: **ACTIVE / FROZEN**. Parent: `docs/VERTICAL_SLICE_SPRINT.md`.

## Evidence and root causes

One no-restart production match at 1366×1024 stopped at 18:00 with 390 Ore, completed Yard, visible
path choices, but no commit/army/Lumen/battle/terminal/Results. Evidence:
`/home/bobbyranka/workspace/evidence/starhaven-final-production-match/`.

### Root cause A — guaranteed Ore is arithmetically insufficient

- starting Ore: 220;
- Yard: 150;
- path: 400;
- current opening Ore node reserve: 280;
- `220 - 150 + 280 = 350`, exactly 50 short of the path.

The full compact opening spend is Yard150 + path400 + Habitat60 + Lumen Guard70 + Solar Strider90
= 770 Ore. Starting220 + new safe reserve700 = 920, leaving a 150 Ore buffer. Costs and gather
cadence remain locked.

### Root cause B — guidance directs scouting before economy

Current guidance says Select Scout / Explore Signal until Ore is already >=400. The failed player
followed it from minute4–9 while Workers spread across Ore, Volatiles, and Charge. Economy guidance
must precede Signal exploration.

### Root cause C — no AI reconnaissance replacement

40 measured normal seeds all resolve idle-player matches by 15:08. But killing the only rival Scout at
reset reproduces the terminal stall: no rival Scout, no player-Core discovery, no winner at 18:00.
The expected player Scout path crosses center, so this is a real match state. AI must replace a lost
Scout through normal Hall training and ordinary costs.

## A. Guaranteed safe Ore reserve

Export `OPENING_ORE_RESERVE = 700` from `src/sim.ts` (or one stable source imported there).
`placeOpeningNodeAt(Tile.Ore,...)` sets both hp and maxHp to 700 for both mirrored bases. Gas stays
200. Solar stays160. Starting resources, Yard/path/unit costs, gather cooldown, cargo8, Worker speed,
travel, node positions, and procedural map patches remain unchanged.

Acceptance arithmetic:

- `START_ORE + OPENING_ORE_RESERVE >= 770`;
- one safe Ore node can fund the exact compact sequence without finding a second field;
- mirrored node positions/reserves remain deterministic across resets/seeds.

## B. Economy-first actionable guidance

Extend `OpeningGuidanceId` and `GuidanceEcoState` (`energy` included). Pure state order:

1. no completed Yard and no Yard under construction: `build-yard`
   - primary `Build a Yard`
   - secondary `Select a Worker · 150 Ore + 20 Charge`
   - world target: an idle player Worker, label `WORKER`.
2. Yard exists but progress<1: `complete-yard`
   - primary `Complete your Yard`
   - secondary `Keep the assigned Worker on construction`
   - target: Yard, label `YARD`.
3. no committed path, channel=0, and Ore<400 or Charge<80: `fund-path`
   - primary `Fund technology`
   - secondary `Ore <floor>/400 · Charge <floor>/80 · Keep two Workers on the nearby Ore field`
   - target: nearest visible/discovered player-base Ore node, label `ORE`.
4. no path and affordable: existing `choose-path`
   - secondary retains Nexus/doctrine instruction;
   - target: player Nexus, label `NEXUS`.
5. channel>0: `path-channel`
   - primary `Technology locks in <ceil>s`
   - secondary `Keep gathering Ore and Volatiles`
   - target: Nexus.
6. path locked but Fighter/unique pair incomplete: `train-army`
   - faction-aware primary `Train <missing labels>` using `fighterName`, `uniqueUnit`, `labelOf`;
   - secondary `Select your Yard · Habitat only if population is full`
   - target: completed Yard, label `YARD`.
7. mixed pair alive: existing objective/scout guidance applies.

Economy/progression states outrank discovered Lumen and Scout selection. HUD guidance signature must
include id + primary + secondary so numeric Ore/Charge/countdown text updates. Dataset stores id only.
No new modal, tutorial, resource grant, click automation, or sim order.

## C. Honest AI replacement Scout

At each ordinary AI cadence, before Worker replacement/training:

- if the player Nexus lacks `SEEN_RIVAL`;
- no alive rival Scout exists;
- a completed rival Nexus exists, is idle, has room, and can pay the exact Scout table cost;
- call normal `tryTrain(hall, Kind.Scout)`.

No spawn, refund, accelerated train, resource floor, hidden Core target, or direct map knowledge. If a
replacement dies before discovery, another can be trained under the same legal conditions. Once Core
is discovered, no replacement is required for this contract.

## Strict TDD and proof

New `tests/vs5-pacing.test.ts` before production changes:

1. opening Ore reserve is 700 both teams, maxHp/hp exact, same-seed reset stable;
2. locked opening arithmetic leaves >=150 Ore buffer after Yard+path+Habitat+fighter+unique;
3. normal public-method policy (no grants): place Yard, two Workers Ore + one Solar + builder returns
   to Ore, commit exact path, wait40s, train Fighter+unique; path locks <=8:00, mixed pair <=10:00;
4. guidance sequence/copy/priority/dynamic values/faction labels;
5. kill rival Scout through `kill`, then ordinary steps: replacement uses intercepted successful
   `tryTrain(Hall,Scout)`, pays exact cost/time, discovers Core, >=4 attack begins >=8:00, real winner
   exists <=18:00;
6. at least eight deterministic normal seeds still resolve <=18:00; no hidden targets/grants.

Browser `scripts/qa-vs5-pacing.mjs`, 1366×1024, fast-step real World and composited screenshots:

- build-Yard guidance and WORKER target;
- fund-path dynamic values and ORE target;
- choose-path + exact costs;
- channel countdown updates while id stays path-channel;
- faction-aware train-army guidance + YARD target;
- mixed pair by <=10 simulated minutes;
- killed Scout -> replacement -> real terminal by <=18;
- winner not manually written; resources never granted; console/page errors0; software sim share<8ms.

Production source scope: `src/sim.ts`, `src/opening-guidance.ts`, `src/hud.ts`, tests/new QA/package.
No costs/stats/gather/input/art/render/shader/terrain/app-flow/results changes.
