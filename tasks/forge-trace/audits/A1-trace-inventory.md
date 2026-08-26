# A1 — Trace Inventory Audit

Read-only inventory of every trace/pacing/instrumentation/milestone site, its duplicated concepts, the reusable adapter contract, and extraction risks. Repo branch `hermes/forge-trace`.

## 1. Wrap sites: tryPlace / tryCommitPath / tryTrain + eco diff around step()

**scripts/qa-vs5-pacing.mjs** (browser; patches the live `__STARHOLD_WORLD__` instance)
- L307–341: setup block wraps `tryTrain` (L311–327), `tryPlace` (L328–334), `tryCommitPath` (L335–341). Records `{tick, team, kind/buildingKind, path, ok, delta:{ore,gas,energy} (cost-positive before−after), trainT}` into `__VS5_TRACE__` arrays. `tryTrain` latches `replacementTrainTick` (L325: first ok rival Hall→Scout).
- L343–357: `__VS5_OBSERVE__` definition — latches `coreDiscoveryTick` (hall.seenBy & SEEN_RIVAL, L344–345), `replacementScoutId` (L346–349), `attackTick` (L350–355, gated `tick >= 8*60*20`, Fighter/Ravager/Prism with order Attack(2)/AttackMove(6) and `tid === hall.id`), `winnerTick` (L356).
- L205–224: `stepWorld()` — per-step team-0 eco diff (before L211, gain L214–217), `maxPositiveGain`, `__VS5_OBSERVE__` after each step (L218), winner break (L219).
- `__VS5_OBSERVE__` call sites: L218, 418, 435, 453, 479, 488, 515, 548, 569, 574, 579, 606, 649, 692, 743. L435/453/479/515 fire **after mutations without step** (issue/tryCommitPath).
- L738–759 terminal: reads `trace` + `world.discoveryLog` (L746–747), filters replacement train calls after discovery (L747). L771–773 asserts replacement cost/time from recorded delta; L764 asserts attack floor `attackTick >= 8*60*20`.
- L777–785 perf probe steps a **fresh** `new CurrentWorld()` instance (no instrumentation).

**scripts/qa-vs2-ai-doctrine.mjs** (browser; no method wrapping)
- L257–277: `stepWorld()` — per-step team-1 eco diff (before L263–267, gain L270–273), chunked `maxPositiveGain`.
- L362–440: milestone loop — `maxPositiveStepGain` (L384), `hiddenCoreTargetEver` (L386), `beforeAttackFloorCoreTargetEver` (L387), coreSeen transition → `coreDiscovery` (L388, 436–439); latch milestones yard/yardComplete/pathStart/pathLocked/forceReady/mixedCenter/discoveredCoreAttack (L390–435). Asserts: L489–513 (path windows, hidden/pre-floor targets, `maxPositiveStepGain <= 96` L510).
- `readWorld()` attackTargets filter (L196–199) duplicates the unit-target predicate.

**tests/vs5-pacing.test.ts**
- L337–386 `runOpeningPolicy`: inline wrappers for `tryPlace` (L348–360, team-0 filter), `tryCommitPath` (L361–372, team-0 filter), `tryTrain` (L373–386, team-0 + Fighter/unique filter at L377). L418–430 duplicates a commit capture manually (before/after diff) through the same wrapper.
- L406–412: step-loop team-0 eco diff → `maxPositiveStepGain`; asserted ≤ 96 (L464).
- L488–516: 8-seed loop — per-step team-1 eco diff (L496–502), hidden-Core-target polling (L503–510), `winnerTick` (L511); asserts ≤ 96 (L514).
- L518–599 Scout-replacement block: `tryTrain`-only wrapper (L540–560), then per-step polling for `discoveryTick` (L568), `attackTick` (L569–577), `winnerTick` (L578); asserts L581–598 (cost/time L587–592, attack floor L594).

**tests/vs2-ai-doctrine.test.ts**
- L157–216 `installInstrumentation(world)`: wraps `tryPlace` (L174–188), `tryCommitPath` (L189–200), `tryTrain` (L201–214); returns `{placements, commits, trains}`. Helpers `ecoSnapshot` (L103–106), `ecoDelta` (L108–114), `positiveGain` (L116–120). Records **all teams/kinds**.
- L237–385 `runDoctrine`: per-step team-1 eco diff (L262, 272–273), core-discovery transition (L263–264, 274–276), scout frontier sampling (L278–300), yard milestones (L302–308), force-ready (L310–321), pre-8:00 center hold (L322–333), hidden/pre-floor Core-target ticks (L334–345).
- L387–476 `validateRun`: asserts on instrumentation (placement/commit/train deltas == STATS tables, L409–411/425–426/435; call counts L404/418–419; `maxPositiveStepGain` L460; hidden/pre-floor ticks L465–466; first-target/attack windows L468–474).
- L478–485 `cadenceFirstTrainTick`: no wrapping (scout order/target diff).

**scripts/measure.mjs** — no milestone/trace logic at all: FPS/RAf probe (L42–69) + screenshot palette (L74–113). Nothing to extract.

**src/sim.ts seams** (all public, instance methods): `reset` L244, `matchStats` L304, `spawn` L324, `kill` L381, `checkWinner` L414, `issue` L445, `tryCommitPath` L488, `techPathOf` L510, `pendingPathOf` L515, `pathChannelT` L520, `lumenState` L525, `tryTrain` L535, `tryPlace` L554, `step` L600, `recountPop` L2506. `discoveryLog` L172 (cleared L291, pushed L1802/L1822). **`onDiscover` L174 fires (L1803/L1823) but is never subscribed anywhere** (grep: zero assignments) — a dead hook QA could use instead of seenBy polling. AI calls the wrapped methods internally (sim.ts L2105, 2187, 2192, 2261, 2300, 2330–2331), so per-instance wrappers capture AI behavior — all four sites rely on this.

## 2. Duplicated concepts

- **Eco delta capture (cost-positive before−after)**: qa-vs5 L321/332/339; vs5 test L356/368/381/422–428/553–556; vs2 test `ecoDelta` L108–114 used at L185/197/210. Same shape `{ore, gas, energy}` in 11 places.
- **Call recording** (`{tick, team, kind, ok, delta, trainT?}` arrays): qa-vs5 `__VS5_TRACE__` L307–341; vs5 test L337–386; vs2 test `installInstrumentation` L157–216. Three independent implementations of one contract.
- **maxPositiveStepGain / maxPositiveGain grant detection** (per-step positive-only eco sum, max): qa-vs5 L209–217; qa-vs2 L261–274; vs5 test L400–412 & L492–502; vs2 test L246–273. Bound constant 96 duplicated: qa-vs2 L24/510, vs2 test L13/460, vs5 test L464/514.
- **Discovery detection**: seenBy polling/transitions — qa-vs5 L344–345 (+discoveryLog lookup L746), qa-vs2 L388/436–439, vs5 test L503–510/568, vs2 test L263–276. `onDiscover` hook exists but is unused.
- **Attack-floor checks** (combat unit targeting player Hall; gated pre-8:00 or hidden): unit predicate `alive && hp>0 && team===1 && kind∈{Fighter,Ravager,Prism} && tid===hall.id` repeated at qa-vs5 L351–353, qa-vs2 L196–199, vs5 test L505–509/570–575, vs2 test L334–345. Floor logic: qa-vs5 L350/764; qa-vs2 L20–21/431/512–513; vs5 test L594; vs2 test L322/339/468–474.
- **First-latch milestone pattern** `if (!x && cond) x = {tick, ...snapshot}`: qa-vs2 L390–435; vs2 test L248–259/302–345.

## 3. Reusable instance-scoped trace adapter contract

`attach(world)` → `{ detach(), placements, commits, trains, maxStepGain(team), coreDiscoveryTick(team), firstAttack: {tick, force}, milestones, observe() }`, wrapping `tryPlace`/`tryCommitPath`/`tryTrain` (+ optional `step`) on the instance, same-realm (inside `page.evaluate` for browser scripts; direct in tests). Must expose:
- **Call records with full fidelity**: `{tick, team, kind, buildingKind, path, x, z, builderId, ok, delta:{ore,gas,energy} (cost-positive), trainT}` — recorded *after* the original call (trainT must be post-call `building.trainT`). Record all teams/kinds; consumers filter.
- **`observe()`/`flush()`** called explicitly after any mutation (step loops AND bare issue/commit sites) — replaces `__VS5_OBSERVE__`; plus optional automatic post-step firing when `step` is wrapped.
- **Per-team step gain**: before/after eco snapshot per `step()`, maintained `maxStepGain(team)`.
- **Discovery**: subscribe to `world.onDiscover` (fires at sim.ts L1803/L1823) with seenBy-poll fallback; latch `coreDiscoveryTick(team)`.
- **Attack-floor helpers**: `coreTargetTicks(hallId)` → `{hiddenTicks, preFloorTicks, firstTargetTick, firstAttackTick, firstAttackForce}` using the shared unit predicate.
- **Milestone latch**: `milestone(name, predicate, snapshot?)`.
- **Contracts**: pure observation (no world mutation, no RNG/Date, no added ent/team properties); `detach()` restores originals; opt-in per instance so perf probes (fresh instances, qa-vs5 L780, qa-vs2 L447) stay uninstrumented.

## 4. Extraction breakage risks

- **Field-exact deepEqual**: `delta` must be exactly `{ore, gas, energy}` (no extra keys): vs5 test L447–451/455/458–462; qa-vs5 L773; vs2 test L409–411/425–426/435. Record-shape renames break qa-vs5 terminal filters (L747/771, uses `buildingKind`, `call.tick > discoveryEvent.tick`).
- **Record-time filters differ per site**: vs5 test filters team-0/Fighter/unique at record time and asserts raw counts (`commitCalls.length === 1` L453; `placementCalls.filter(ok).length === 1` L445); vs2 test and qa-vs5 record all. Adapter must record all; each site's filter semantics must be preserved or those assertions change.
- **Gated vs ungated attack detection**: qa-vs5 gates `attackTick` at ≥8:00 (L350), vs5 test latches unconditionally (L569). Adapter should record unconditioned first-attack; qa-vs5's L764 assert still passes, but note the current gate is a latent blind spot for pre-floor attacks — unconditioned recording would newly surface (and fail on) behavior the old code never detected.
- **`__VS5_OBSERVE__` fires without step** (L435/453/479/515): a step-only hook misses these; adapter needs the explicit `observe()` call.
- **step() wrapping side effects**: browser RAF loop and perf probes call `step()`; per-instance opt-in avoids polluting the 8 ms sim-share budget (qa-vs2 L519, qa-vs5 L790). `reset()` (L244) replaces `teams[]` and clears `discoveryLog` but keeps patched methods — adapter state must reset with the instance or be re-attached.
- **Manifest consumers**: qa-vs5 embeds the full `trace` in `manifest.checks.terminal` (L757) — downstream critics read these field names; renames break evidence reviews.
- **Determinism**: vs2 test runs the same seed twice and asserts identical ticks (L493–500); adapter must be deterministic (no Date/RNG/key-order variation).
- **Dead `onDiscover`**: adapter may subscribe safely today, but if `src/main.ts` later wires it, ownership must be defined (adapter must not assume exclusivity).
