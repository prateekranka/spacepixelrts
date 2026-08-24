# VS-2A — Honest AI Yard, Technology, Army, and Attack

Status: **ACTIVE / FROZEN**. Parent contract: `docs/VERTICAL_SLICE_SPRINT.md`.
This piece changes opponent behavior only. It does not add center ownership, Results, assets, or
player controls.

## Root cause

Production `scriptedMarshalEnabled=false` correctly disables the old grant/spawn path. The remaining
AI gathers and scouts, but:

1. never calls `tryPlace` for a Yard;
2. never calls `tryCommitPath`;
3. pre-path training is limited to Scouts and post-tick-240 combat training is unreachable;
4. new post-240 units idle because only the disabled marshal peel consumed them;
5. scout movement targets explored-but-not-visible tiles, not unexplored frontier, so map discovery
   stalls before the opposing Core.

Measured fixed-seed Gravemark economy without grants:

- minute 2: 371 Ore / 368 Volatiles / 70 Charge;
- minute 4: 891 / 816 / 70;
- minute 8: 1912 / 1053 / 222.

The economy can fund the slice honestly. Do not add income or reduce player costs in this piece.

## Locked behavior

### Difficulty cadence

`World.aiDifficulty` is public/readable and typed from `Difficulty`; default `standard`.
`prepareMatch` sets it from validated MatchConfig before reset.

- Cadet: 2.6-second decision cadence;
- Standard: 1.4 seconds;
- Veteran: 0.8 seconds.

Difficulty changes cadence only in VS-2A. No income, vision, HP, damage, or cost modifiers.

### Honest Yard construction

When team 1 has no alive Yard and can pay its exact cost:

1. find its alive completed Core;
2. choose one alive Worker with zero cargo, preferring Idle then Gather;
3. test a frozen ring of eight offsets around the Core in array order; use the first
   `canPlace`-legal site;
4. call the existing public `tryPlace(1, Kind.Barracks, x, z, worker.id)` exactly once;
5. never spawn or complete the Yard directly; its Worker builds through `thinkBuild`.

One alive Yard maximum. Do not interrupt a Worker already constructing a building.

The opening four Workers, Scout, and first 2+2 force exceed the Core population cap. After the
Yard is complete, the AI may build exactly one Habitat through the same `canPlace` → `tryPlace` →
Worker construction path. It may not spawn/complete housing directly or build additional Habitats
in VS-2A.

### Honest technology commit

After the Yard is complete, **match time is at least 4:30**, no channel is active, and the exact
400 Ore + 80 Charge is available, call the existing `tryCommitPath`:

- Sunweaver AI: `sky-dominion`;
- Gravemark AI: `iron-colossus`.

The normal 40-second channel must elapse. No direct `techPath` write. No resource floor/grant.

### Mixed compact army

After the path locks, the completed Yard uses `tryTrain` only:

- alternate Fighter and faction unique unit by choosing whichever living+queued count is lower;
- Sunweaver unique is Ravager / Solar Strider;
- Gravemark unique is Prism / Burden Walker;
- first field force must reach at least 2 Fighters + 2 unique units;
- keep producing replacements while affordable and below population cap;
- no Siege, Shade, instant spawn, shortened train time, or Hall combat training.

Yard rally is the Central Lumen Field. New combat units travel there through ordinary orders.

### Imperfect-knowledge scouting and attack

Fix the Scout frontier target:

- candidate is an unexplored, non-blocked tile adjacent (8-neighbor) to at least one explored tile;
- deterministic score favors shorter Scout travel, then progress toward the opposing start quadrant;
- tie-break by tile index;
- no enemy entity position is read to select the frontier target.

Army behavior:

- before the player Core is discovered (`seenBy & SEEN_RIVAL`), combat units use AttackMove to
  rally/hold at the Central Lumen Field so they can fight anything they legitimately meet;
- even if the Core is discovered early, the first Core attack cannot begin before **8:00** match
  time; the force holds center until that floor;
- at/after 8:00, once the Core is discovered, a field force of at least four gets AttackMove orders
  toward that remembered Core through existing movement/combat code;
- never assign an unseen Core id/position;
- existing sight-loss invalidation remains.

### Preservation

- `scriptedMarshalEnabled` stays default false and its legacy branch stays intact for old tests.
- Player team behavior, costs, stats, map, path effects, and sim tick remain unchanged.
- No render/HUD/input/asset work.

## Strict RED→GREEN tests

Create `tests/vs2-ai-doctrine.test.ts` and `test:vs2-ai` before production edits. Save expected RED
output to `tasks/VS2A-red.log`.

Tests instrument public methods (wrap and call through) to prove the AI uses `tryPlace`,
`tryCommitPath`, and `tryTrain` with exact deductions. Required assertions:

1. default Standard, plus 2.6/1.4/0.8 cadence behavior;
2. exactly one legal incomplete→complete Yard; cost deducted, no spawn shortcut;
3. correct faction path begins through `tryCommitPath` no earlier than 4:30 and by 7:30,
   deducts 400/80, remains null during the channel, then locks after ~40 seconds;
4. by minute 8 fixed-seed Standard has >=2 Fighter and >=2 correct unique, zero retired kinds;
5. maximum positive resource jump per step stays within an honest multi-deposit bound; no marshal
   floors/grants and `scriptedMarshalEnabled` remains false;
6. explored tile count continues growing beyond the old stall and Scout targets an unexplored
   frontier;
7. no combat unit receives the player Core target before discovery or before 8:00;
8. before 8:00, >=4-unit force holds center with AttackMove orders and no Core tid;
9. after legitimate Scout vision discovers the Core and the 8:00 floor passes, >=4-unit force
   receives attack-move toward it; first attack is by minute 12;
10. same seed+difficulty produces the same Yard position, path, counts, and first attack tick.

## Browser proof

Add `scripts/qa-vs2-ai-doctrine.mjs` + `qa:vs2-ai-doctrine`:

- `?qa=opening&qa-run=1`, fixed seed, Standard, 1366×1024;
- fast-step real World only; no resource/entity/path mutation;
- capture AI Yard construction, channel, mixed force at center, and discovered-Core attack;
- manifest records milestone ticks, exact economies, path, unit counts, target visibility,
  sim-step timing, composited screenshots, and console errors;
- fail if any milestone misses minute 12; this piece does not require match winner yet;
- software GL records render p99 and gates sim-work share <8ms.

## Acceptance

- RED transcript exists and failed for missing Yard/path/army.
- `test:vs2-ai`, all m0–m6/VS-1 gates, QA, and build pass.
- No resource grants; code review confirms all actions use existing public game rules.
- Luna focused check is <=5 real minutes and inspects the fast-stepped visible milestones.
- Fresh Sol blind gate sees a constructed rival base, mixed force, and attack state; visual debt may
  remain, but no state may look empty or fabricated.
- Builder commits with prefix `VS2A:`.
