# VS-5B — Counted Ore-Worker Assignment

Status: **ACTIVE / FROZEN**. Parent: `docs/VS5_PACING_CLOSURE.md`.

## Loss and root cause

The second no-restart production match failed before path commitment. It ended with 222 Ore and 240
Volatiles. Screenshots show the first Worker went to the blue Volatiles node; later only one Worker
worked at the orange `ORE` marker. Guidance said “Keep two Workers” but gave no count or confirmation
that a second order landed.

Evidence: `/home/bobbyranka/workspace/evidence/starhaven-final-production-match-r2/`.

No economy tuning is allowed. Opening Ore700, start resources, all costs, cargo, cooldown, Worker
speed, node positions, and AI remain locked.

## Pure assignment truth

Add `assign-ore` to `OpeningGuidanceId`.

A player Worker counts as assigned to Ore iff it is alive, hp>0, team0, `Ord.Gather` or `Ord.Return`,
and either:

- its live `tid` target is a `Kind.Resource` with `cargoType===Tile.Ore`; or
- it is returning with `cargoType===Tile.Ore`.

Gas/Solar targets, Idle/Build/Move/Attack orders, dead Workers, and rival Workers never count.

## Frozen guidance order

After Yard completion, before path commitment/channel:

1. If Ore Workers<2:
   - id: `assign-ore`
   - primary: `Assign 2 Workers to Ore`
   - secondary: `Ore Workers <count>/2 · Find Idle Worker → GATHER → marked Ore`
   - spatial target: nearest visible/discovered base Ore node, label `ORE · <count>/2`.
2. Once Ore Workers>=2 but path funds are incomplete:
   - existing id `fund-path`
   - primary `Fund technology`
   - secondary `Ore <ore>/400 · Charge <charge>/80 · Ore Workers <count>/2`
   - target label `ORE · <count>/2`.
3. Affordable path and all later states remain unchanged.

Economy/progression states still outrank Signal/scout guidance. Guidance signature remains dynamic.
No order is issued automatically. The player must use visible controls and tap the marked node.

## Strict RED→GREEN proof

Extend `tests/vs5-pacing.test.ts` before production:

- 0/2 state and exact copy;
- one ordinary `world.issue(...Ord.Gather..., ore.id)` gives1/2;
- second gives fund-path2/2;
- a Gas gatherer does not count;
- Ore Return with cargo counts;
- dead/rival Worker does not count;
- affordable with2+ advances to choose-path.

Extend browser QA before production:

- after real Yard completion with no resource assignments: capture `02-assign-ore.png`, state/copy
  exact, target `ORE · 0/2`;
- issue first ordinary Gather: assert dynamic `1/2` and target update;
- issue second ordinary Gather plus one Solar Gather: capture `03-fund-path.png`, state/copy exact,
  target `ORE · 2/2`;
- continue existing path/channel/army/replacement/terminal proof;
- no resource writes, spawn, winner write, or input automation.

Production scope: `src/opening-guidance.ts`, `src/hud.ts` target routing/label only. Tests/new QA only.
No sim/input/costs/stats/art/render/AI/app-flow/results changes.

Acceptance:

- focused unit/browser gates PASS at1366×1024;
- fresh Sol assignment→funding→path→army→terminal chain PASS;
- one final no-restart production match reaches mixed army and a real terminal by18:00.
