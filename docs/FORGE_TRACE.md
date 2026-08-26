# FORGE TRACE — deterministic match tracing, pacing analysis, seed sweeps

Status: **FROZEN for FTR-1** (piece contract). Parent authority: `DIRECTIVE.md`,
`docs/CANONICAL_VOCABULARY.md`, `docs/FIRST_PLAYABLE.md`. This document is the binding
contract for every Forge Trace subagent. Where a subagent proposal conflicts with this
document, this document wins.

## 1. Scope and non-goals

In scope: turning a deterministic automated Starhaven match into a versioned event trace,
a developer-only interactive timeline, pacing/AI-truth diagnostics, milestone/deadline
reports, deterministic world-identity checkpoints, batch seed/difficulty sweeps, and a
frame reference a future Forge Review Deck can consume.

Non-goals: human gesture recording (later Forge Repro Recorder), replay playback of
rendered frames, any change to gameplay/AI doctrine/resources/costs/production times/fog/
deadlines/win conditions, any edit to `src/sim.ts` or `src/engine.ts`, any new runtime
dependency, any production-bundle change.

## 2. Architecture

Headless Node (tsx) drives the real simulation. No browser is needed to produce a trace;
Chromium is used only to render `timeline.png` and for QA.

```
World (untouched) ──wrapped per-instance──▶ TraceCollector ──▶ events[] ──▶ trace.json/events.ndjson
     ▲                                          │                 ├──▶ summary.json (milestones + diagnostics)
     └── Policy (legal public calls only) ──────┘                 ├──▶ timeline.html (+png via Chromium)
                                                                  └──▶ manifest.json (wall-clock metadata)
```

Locked techniques (per the FTR-1 brief):

- Instrument individual `World` instances OUTSIDE `src/sim.ts`: wrap `tryPlace`,
  `tryTrain`, `tryCommitPath` on the instance (bind originals first), observe before/after
  state around `world.step()`, consume `discoveryLog` / subscribe `onDiscover`,
  `matchStats()`, `lumenState()`, `pendingPathOf(t)`, `pathChannelT(t)`, `techPathOf(t)`,
  teams, ents, fog arrays.
- Forbidden: patching `World.prototype`, sim hot-path logic, editing protected files,
  full world snapshots every tick, production telemetry, resource grants, direct winner
  writes, hidden targeting, spawning units outside legal seams.
- The policy drives the world ONLY through `tryPlace`, `tryTrain`, `tryCommitPath`,
  `issue`, `step` (plus reading public state). `world.kill()` is permitted ONLY inside the
  `lost-scout-recovery` scenario and MUST emit a `fault-injection` event. Standard traces
  contain no fault injection.
- Existing QA scripts (`scripts/qa-vs5-pacing.mjs`, `scripts/qa-vs2-ai-doctrine.mjs`,
  their tests) are NOT modified in FTR-1. Their wrapper duplication stays until a later
  proven-parity refactor. The new shared collector powers new tooling only.

## 3. File ownership (exclusive — never two pieces in one file)

| Piece | Owns exclusively |
| --- | --- |
| parent | `package.json`, `PROGRESS.md`, `docs/FORGE_TRACE.md`, `src/pacing-contract.ts`, integration commits |
| FTR-CORE | `src/forge-schema.ts`, `src/forge-snapshot.ts`, `src/forge-collector.ts`, `src/forge-frames.ts` |
| FTR-POLICY | `src/forge-policy.ts` |
| FTR-SWEEP | `src/forge-diagnostics.ts`, `scripts/forge-trace-run.mjs`, `scripts/forge-trace-sweep.mjs` |
| FTR-UI | `scripts/forge-trace-view.mjs`, `scripts/forge-timeline.html` |
| FTR-BROWSER-QA | `scripts/qa-forge-trace.mjs` |
| FTR-TESTS | `tests/forge-trace-{schema,ids,determinism,world-hash,ordering,cadence,size,policy,faults,classification,divergence}.test.ts` |
| FTR-REVIEW-ADAPTER | `tests/forge-trace-review-link.test.ts` |

All new source modules are FLAT files in `src/` (tsconfig includes `src/*.ts`). None may
be imported by `src/main.ts` or anything in the production import graph. Legacy sim IDs
(`vespari`, `aurion`, `voidmarked`) may exist ONLY behind adapters inside these modules
and MUST NOT appear in serialized traces, reports, UI text, or CLI output.

## 4. Shared constants — `src/pacing-contract.ts` (already committed by parent)

Single source of truth for deadlines/windows/bounds not exported by the sim. Builders
import from here; nobody redeclares numbers. Contents: tick math (`TICK_HZ`, `DT`,
`MINUTES_TO_TICKS`), deadline ticks (`PATH_LOCK_BY_TICK=9600`, `MIXED_PAIR_BY_TICK=12000`,
`TERMINAL_BY_TICK=21600`), AI windows (`AI_PATH_WINDOW_TICKS=[5400,9000]`,
`AI_ATTACK_WINDOW_TICKS=[9600,14400]`, `ATTACK_FLOOR_TICK=9600`),
`HONEST_STEP_GAIN_BOUND=96`, diagnostic windows (`STARVATION_WINDOW_TICKS=1200`,
`IDLE_PRODUCTION_WINDOW_TICKS=400`, `REJECTED_CALL_BURST=3`,
`REJECTED_CALL_WINDOW_TICKS=200`), canonical-ID adapters (legacy civ ↔ canonical faction,
kind ordinal ↔ canonical kind name, tech-path ids per faction), milestone ids, and the
event-type list. `REPLACEMENT_SCOUT_COST/TIME` mirrors `STATS[Kind.Scout]` and tests
assert equality with the live table (never copy numbers into a third place).

## 5. Trace schema (version 1)

Serialized by `src/forge-schema.ts`. Every field below is required unless marked optional.

```ts
interface ForgeTraceFile {
  schemaVersion: 1;
  tool: 'forge-trace';
  createdAtNote: null;              // NEVER a wall-clock timestamp (manifest only)
  matchConfig: MatchConfig;         // canonical fields from src/match-config.ts
  policy: { id: PolicyId; identityHash: string };
  tickHz: 20;
  playerFaction: FactionId;         // convenience duplicate of matchConfig.playerFaction
  rivalFaction: FactionId;
  terminalResult: {
    winner: FactionId | null;       // canonical faction, null if none by cap
    tick: number;
    reason: 'core-destroyed' | 'time-cap';
  } | null;
  checkpoints: { seq: number; tick: number; worldHash: string }[];
  events: ForgeTraceEvent[];
}

interface ForgeTraceEvent {
  eventId: string;                  // deterministic: `evt-${seq}`
  seq: number;                      // 0-based, strictly increasing, gapless
  tick: number;                     // sim tick (nondecreasing)
  seconds: number;                  // tick / 20
  type: ForgeEventType;
  team: FactionId | null;           // canonical; null = global/shared
  entityIds: number[];              // related ent ids ([] allowed)
  payload: Record<string, unknown>; // typed per event family; numbers/strings/bools only
  worldHash: string | null;         // present on samples + milestone-class events
  frameRef: FrameRef;               // see §6
  severity: 'info' | 'warning' | 'failure';
}

interface FrameRef {
  policyId: string;
  config: MatchConfig;      // complete match configuration
  seed: number;
  tick: number;
  perspective: 'player' | 'rival' | 'observer';
  camera: { x: number; z: number; halfH: number };
  selectedEntityIds: number[];
}
```

Validation function `validateTraceFile(value: unknown)` returns
`{ valid: true } | { valid: false; errors: string[] }` and enforces: version, enum membership,
seq strict-increase/gaplessness, tick monotonicity, canonical IDs everywhere, no wall-clock
fields, checkpoint hashes hex, frameRef completeness. Malformed input never throws.

### Event taxonomy (frozen; exact type strings)

`match-start`, `application-transition`, `command-issue`, `order-change`,
`resource-sample`, `population-sample`, `worker-assignment-change`, `placement-attempt`,
`construction-start`, `construction-complete`, `training-attempt`, `training-start`,
`unit-completion`, `path-commit-attempt`, `path-channel-start`, `technology-path-lock`,
`entity-discovery`, `landmark-discovery`, `scout-loss`, `scout-replacement-start`,
`scout-replacement-complete`, `lumen-capture-start`, `lumen-contested`,
`lumen-owner-change`, `lumen-income`, `lumen-vision-pulse`, `combat-engagement`,
`core-damage`, `unit-death`, `core-destruction`, `winner`, `match-terminal`,
`fault-injection`.

Payload conventions: costs as `{ ore, gas, energy }` (cost-positive deltas); attempts carry
`ok: boolean` plus `rejectReason` when known; discovery carries `what` + position;
lumen income carries `amount`; combat carries attacker/victim ids and damage rounded to
0.1. Unknown extra keys are forbidden (keeps size bounded and schema honest).

### Sample cadence

Sim runs at 20 Hz. State-change events are recorded when they happen. Once per simulated
second (every 20 ticks) emit exactly one `resource-sample` and one `population-sample`
per team, each carrying `worldHash`. Full entity snapshots are NEVER recorded per tick;
checkpoints store hashes only.

### Size bound

An 18-minute (21,600-tick) trace.json must stay under 8 MB. The size test counts
entity-snapshot-like payloads (must be ≪ tick count) and asserts the byte budget.

## 6. Deterministic world hashing — `src/forge-snapshot.ts`

Canonical snapshot built in fixed order and hashed with FNV-1a (32-bit, `Math.imul`,
repo-proven recipe from `tests/vs2b-lumen-field.test.ts`). Rules:

- Hash integers only. Quantize floats: 3 decimals (0.001 grid) for positions/hp/progress/
  energy-transfer floats; 2 decimals (0.01) for timers (`ageT`, `trainT`, `cooldown`,
  `blinkCd`, `dissolveT`, `corpseT`, `pulseRemaining`, lumen progress). NaN/Infinity throws.
- Sequence: schemaVersion, seed, fog flag, difficulty index, civ indices, tick, winner,
  per-team `{ore,gas,pop,cap,epoch,ageT,techPathCode,pendingPathCode,boost}`,
  links (count + fields in array order), flags (count + fields),
  `lumenState()` fields, landmark `discoveredBy` in fixed table order, alive entities in
  id order (id === index; emit `id,kind,civIndex,team,x,z,vx,vz,hp,maxHp,order,tx,tz,tid,
  cargo,cargoType,cooldown,stealth,frenzy,blinkCd,progress,trainKind,trainT,rallyX,rallyZ,
  pathI,seenBy,rigTeam,rigProgress,rigHp,dissolveT,corpseT`), `matchStats()` counters,
  fog bytes of `visible[0..1]` + `explored[0..1]` folded raw into the same stream,
  discoveryLog length + per-event fields in array order.
- Excluded: `path` arrays, `px/pz`, `anim`, `facing`, `hitFlash`, `combatT`, `vis`,
  private scratch (heap/gScore/free/sparkHead/aiT/sporeT/marshalPeel*). Hidden accumulators
  are covered by bounded-diff sampling (hash every tick).
- Output: lowercase 8-hex string. Computed AFTER `world.step()` returns, same call site,
  same field order, every time. Same seed + config + policy ⇒ identical hash chain.

## 7. Collector — `src/forge-collector.ts`

Instance-scoped. Exact public surface (tests depend on these names):

```ts
class ForgeTraceCollector {
  constructor(world: World, options: {
    config: MatchConfig;            // canonical config for frameRefs
    policyId: string;
    camera?: { x: number; z: number; halfH: number };   // default opening camera preset
    hashEveryTicks?: number;        // default 1
    faultInjectionAllowed?: boolean;// default false
  });
  attach(): void;                   // wraps tryPlace/tryTrain/tryCommitPath on the instance
  detach(): void;                   // restores originals; idempotent
  observe(): void;                  // diff scan; call after step() and after bare mutations
  readonly events: ForgeTraceEvent[];
  readonly checkpoints: { seq: number; tick: number; worldHash: string }[];
  maxPositiveStepGain(teamIndex: 0 | 1): number;
  finalize(): void;                 // emits terminal/winner/match-terminal once; freezes stream
}
```

Behavior: records ALL teams/kinds of placement/train/commit attempts with cost-positive
deltas and post-call trainT; derives construction/training/unit-completion/order-change/
worker-assignment/combat/death/Core-damage/lumen/discovery events from bounded state diffs
in `observe()`; subscribes `world.onDiscover` when available; latches milestones; computes
`worldHash` per §6. Pure observation: mutates nothing on World, uses no Date/RNG, adds no
properties. `reset()` of the world invalidates the collector (documented; runners create a
fresh collector after reset).

## 8. Policies — `src/forge-policy.ts`

Exact exports (tests depend on these names):

```ts
function runStandardOpening(world: World, options: {
  seed: number; difficulty: Difficulty;
  playerFaction: FactionId; rivalFaction: FactionId;
  collector: ForgeTraceCollector;   // already attached
  maxTicks?: number;                // default TERMINAL_BY_TICK
}): StandardOpeningResult;

function prepareLostScoutRecovery(collector: ForgeTraceCollector, world: World):
  { killedEntityId: number; faultEventSeq: number };

interface StandardOpeningResult {
  terminalTick: number;             // last stepped tick
  winner: number;                   // -1 | 0 | 1 (sim indices)
}
```

Policy shape (extracted conceptually from the VS5 QA policy, reimplemented cleanly):
set `civ[0]/civ[1]` via the canonical→legacy adapter, fog, `aiDifficulty`, then
`reset(seed)`. Opening: place Yard through `tryPlace` at the first legal ring spot
(`[-3.4,-3.4],[0,-4.4],[3.4,-3.4],[4.4,0]` around the Core), assign 2 Workers to nearest
Ore + 1 Worker to nearest Solar via `issue(...Ord.Gather...)`, return the builder to Ore
after Yard completion, fund and `tryCommitPath` the faction's standard path
(sunweaver→`sky-dominion`, gravemark→`iron-colossus`), train Fighter then faction unique
through `tryTrain`, march the pair to the Central Lumen Field with `issue AttackMove`,
secure Lumen, discover the rival Core, attack it legally, continue to terminal. Lost-scout
recovery = same opening PLUS one recorded `world.kill(originalRivalScout)` before stepping,
emitting `fault-injection`; replacement happens by the AI through normal Hall training at
real cost/time; NO replacement is trained after the player Core is discovered by the rival
(sim rule; the trace proves it). No grants, instant builds, hidden targets, or winner writes.

## 9. Diagnostics and sweeps — `src/forge-diagnostics.ts`

Exact exports:

```ts
function detectMilestones(events: ForgeTraceEvent[]): MilestoneReport;
// MilestoneReport { reached: { id: MilestoneId; tick: number }[]; missed: { id; deadlineTick }[] }

function classifyFailures(trace: ForgeTraceFile, milestones: MilestoneReport): FailureClassification[];
// one entry per fired classification; ids: deadline-miss, starvation, idle-production,
// pop-cap-stall, lost-scout-recovery-failure, hidden-targeting, early-attack,
// impossible-positive-delta, repeated-rejections, no-terminal

function firstDivergence(passing: ForgeTraceFile, failed: ForgeTraceFile): DivergenceReport | null;
```

Detection rules (defaults locked by the brief): starvation = ≥1200 ticks (60 s) with no
positive resource delta for a team while a cost-funded milestone is pending; avoidable
idle production = ≥400 ticks (20 s) with required unit affordable AND pop capacity AND
producer idle; grant detection bound = `HONEST_STEP_GAIN_BOUND` (96) positive eco sum in
one step; hidden targeting / early attack / rejections per `pacing-contract`.
First divergence: compare normalized milestone sequences + checkpoint hashes against a
passing trace with the same pairing+difficulty; report earliest diverging tick, prior
common milestone, expected next milestone, actual event/state, resources/pop, world hashes,
likely category — labeled DIAGNOSTIC EVIDENCE, correlation not causation.

Game failure vs tool failure: tool errors (server/browser/fs crash) exit 2; invalid trace /
schema violation exits 3; valid trace with game-contract failures exits 0 (reported) or 1
with `--fail-on-game-gate`.

## 10. Commands

```
npm run forge:trace -- --seed=<n> --difficulty=<cadet|standard|veteran> \
  --player=<sunweaver|gravemark> --rival=<sunweaver|gravemark> --out=<absolute dir> \
  [--policy=standard-opening|lost-scout-recovery] [--fail-on-game-gate]

npm run forge:trace:sweep -- --seeds=<csv> --difficulties=<csv> --out=<absolute dir> \
  [--pairings=sunweaver-vs-gravemark,gravemark-vs-sunweaver] [--fail-on-game-gate]

npm run forge:trace:view -- --trace=<abs trace.json> [--out=<dir>] [--review-base-url=<url>]

npm run qa:forge-trace
```

Single-run artifacts in `--out`: `trace.json`, `events.ndjson`, `summary.json`,
`timeline.html`, `timeline.png`, `manifest.json`. Sweep additionally: `sweep.json`,
`sweep.csv`, `failures.json`, `divergences.json`, `sweep-summary.html`.
`manifest.json` carries ALL wall-clock metadata (startedAt/finishedAt/node version);
the deterministic stream carries NONE. Evidence roots stay outside the repository
(resolveOut guard, same rule as existing QA scripts).

The verified QA sweep matrix is seeds `24301,424242,57005` × difficulties
`cadet,standard,veteran` × both pairings = 18 deterministic runs.

## 11. Timeline UI — `scripts/forge-timeline.html` + `scripts/forge-trace-view.mjs`

Standalone self-contained HTML (inline CSS/JS, no framework, no external fetches).
Generation embeds the parsed trace JSON inline (`window.__FORGE_TRACE_DATA__`) AND offers
a file-input loader for arbitrary traces. Tracks (per team unless noted): resources
(Ore/Volatiles/Charge), population+capacity, worker assignments, construction spans,
production queue spans + completions, tech funding/channel/lock, Scout discovery, AI
knowledge, Lumen capture/contest/ownership/income/pulse (shared), commands/orders, combat
engagements, unit deaths, Core health/damage, terminal result (global). Controls: zoom
(zoom-to-cursor), horizontal pan, team filter, event-type filter, milestone-only mode,
search by event/entity ID, prev/next failure navigation with count badge, event-details
panel (exact tick, config, worldHash, payload, frameRef), Copy frame reference, Open in
Forge Review Deck when `reviewBaseUrl` supplied. Hybrid rendering: DOM chrome + canvas
plot field, viewport culling, density columns past 8 marks/px; partial/malformed traces
render what exists with explicit missing-data banners and never crash; unknown event
kinds land in an "Unknown" track. Developer-only: never a Vite input, never imported by
production code, always written to the output directory.

Frame-reference deep link (Review Deck boundary, frozen):

```
<reviewBaseUrl>?qa=<scenario>&qa-seed=<seed>&qa-run=1&orientation=landscape-left&forge-tick=<tick>
```

`scenario` maps from the policy/config (opening-style routes); unknown params are ignored
by the game page, so this is forward-compatible. Without `reviewBaseUrl`, Copy frame
reference still yields the parameter string. `src/forge-frames.ts` builds and parses these
URLs; `tests/forge-trace-review-link.test.ts` round-trips every component through
`src/qa-scenarios.ts` route ids.

## 12. Test strategy (strict RED-GREEN-REFACTOR)

Plain tsx tests, `node:assert/strict`, repo style (see A5 audit). Tests are written FIRST
against the exact surfaces in §§5–9; RED logs saved under `tasks/forge-trace/` before
implementation lands. Required coverage: schema validation accept/reject; canonical IDs
only (regex-scan serialized output for legacy terms); deterministic repeat equality of
normalized streams + checkpoint hashes; world-hash sensitivity and insertion-order
stability; event ordering (seq gapless/increasing, ticks nondecreasing); sample cadence
(exactly one economy + one population sample per simulated second); bounded size (no
per-tick snapshots, <8 MB at 21,600 ticks); legal-policy operations only; fault injection
present iff enabled; game-vs-tool failure classification; deadline/starvation/idle/
hidden-target units; first divergence on synthetic traces; frame-ref round-trip;
malformed/partial trace UI behavior (browser); production-bundle leakage (grep dist);
process cleanup (no leaked vite/chromium).

## 13. Completion criteria

All named acceptance criteria verified by the parent against real runs: central gates
green (`test:m0`, `test:vs2-ai`, `test:vs5`, `build`, `qa:vs5`, `qa:forge-trace`),
double-run determinism compared programmatically, 18-run sweep executed with truthful
manifests, protected files bit-identical to base, dist free of Forge Trace strings,
evidence outside the repo, zero leaked processes, game-gate failures reported not hidden.
