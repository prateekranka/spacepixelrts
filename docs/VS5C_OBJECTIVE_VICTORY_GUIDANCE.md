# VS-5C — Post-Army Objective and Victory Guidance

Status: **ACTIVE / FROZEN**. Parent: `docs/VS5_PACING_CLOSURE.md`.

## Loss

Fresh full-chain Sol gate failed the post-army seam: the submitted chain showed army training and
Lumen capture but no visible instruction to command the army to Lumen or toward the rival Nexus.
The standalone VS2B capture fixture also had no progressed economy, so new evidence must come from the
same real VS5 progression run.

No mechanics change. Existing Lumen capture, attack orders, fog discovery, Core winner, AI, and all
costs remain locked.

## New pure guidance states

Add ids:

- `secure-lumen`
- `push-lumen`
- `destroy-core`

Extend `GuidanceEcoState` with optional current `lumenOwner: -1|0|1` and `lumenContested: boolean`.
HUD passes the real `world.lumenState()` values.

After the real Fighter+faction-unique pair exists, guidance order is:

1. Central Lumen undiscovered: existing `select-scout` / `explore-signal` sequence.
2. Lumen discovered and (`owner!==0` or contested):
   - id `secure-lumen`
   - primary `Secure the Central Lumen Field`
   - secondary `Select your army · ATTACK → marked Lumen`
   - target Central Lumen landmark, label `LUMEN`.
3. Player owns Lumen and rival Nexus is not discovered:
   - id `push-lumen`
   - primary `Push through the Lumen lane`
   - secondary `Select your army · ATTACK beyond the field`
   - target Central Lumen landmark, label `PUSH`.
4. Player owns Lumen and rival Nexus is discovered (`seenBy & SEEN_PLAYER`):
   - id `destroy-core`
   - primary `Destroy the rival Nexus`
   - secondary `Select your army · ATTACK → marked Nexus`
   - target rival Hall, label `RIVAL NEXUS`.

Economy/path/army states retain priority. Existing manual MOVE/ATTACK/GATHER semantics are unchanged.
No auto-selection, order, pan, reveal, resource, or winner mutation.

## Strict RED→GREEN proof

Unit tests before production:

- mixed pair + undiscovered Lumen retains scout sequence;
- discovered neutral/rival/contested Lumen returns exact secure state/copy;
- player owner + hidden rival Hall returns exact push state/copy;
- player owner + discovered rival Hall returns exact destroy state/copy;
- economy/path/train states still outrank objective state.

Browser QA extends the same real VS5 run after mixed pair:

1. Issue ordinary Scout Move to the Central Lumen landmark; step until normal discovery.
2. Capture `08-secure-lumen.png`: exact guidance, target LUMEN, real pair still alive.
3. Select pair; issue ordinary `Ord.AttackMove` through `world.issue` to exact field center; step until
   real player control. Capture `09-lumen-control.png`: owner0, push guidance, target PUSH.
4. Continue ordinary Scout/army move beyond center until rival Hall is normally discovered. Capture
   `10-destroy-core.png`: exact guidance, target RIVAL NEXUS; no fog mutation.
5. Issue ordinary player attack/attack-move if still alive; allow normal sim/AI to real terminal.
   Capture renamed `11-terminal.png`.

QA must record no direct resource writes, spawn, fog/seen writes, winner write, or target assignment.
Software sim share<8ms and console/page errors0.

Production scope: `src/opening-guidance.ts`, `src/hud.ts` guidance state/target only. Tests/VS5 QA.
No sim/input/content/render/art/AI/app-flow/results/CSS/package changes.

Acceptance: focused and protected gates PASS; fresh Sol full current-build chain PASS; final one-match
production integrator reaches mixed army, real Lumen state, battle, terminal, and Results by18:00.
