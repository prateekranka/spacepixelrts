# A2 — Determinism & World-Identity Hash Design

**Scope (read-only):** `src/sim.ts` (World), `src/engine.ts` (Ent/TeamEco),
`src/content.ts` (STATS/pathEffects), `src/discovery.ts`, test precedent
`tests/vs2b-lumen-field.test.ts:64-80` (existing FNV-1a over fog arrays).
**Goal:** a canonical per-tick snapshot + hash of the Starhaven `World` that is stable
across runs of the same seed+inputs and sensitive to real gameplay drift, computed
entirely through the existing public surface (no edits to sim.ts).

## 1. Canonical snapshot — state to include (one ordered integer sequence, fixed field order)

- **Schema/identity:** version `1`; inputs `seed`, `fogOfWarEnabled`, `scriptedMarshalEnabled`,
  `aiDifficulty` (0/1/2), `civ[0..1]` (0/1/2). (Teams 2–3 are inert; skip.)
- **Globals:** `tick`, `winner`.
- **Eco per team 0..1 (public `teams[]`):** `ore`, `gas`, `energy` (all integer),
  `pop`, `cap`, `epoch`, `ageT` (2dp — the commit channel), `techPath`
  (int code or −1), then `pendingPathOf(t)` (int code or −1; public accessor for the
  private `pendingPath`). Also `boosts[t]` (public).
- **Links (public array, index order):** `count` then per link `nodeId, hallId, team, severedUntil`.
- **Flags (public array, insertion order):** `count` then `x, z, t` per flag.
- **Lumen (via `lumenState()`):** `owner, capturing, progress, contested, pulseRemaining[0..1]`.
- **Landmarks (fixed `makeHeliosLandmarks()` order, 6 entries):** `discoveredBy` per landmark.
- **Entities — alive only, sorted by id:** `ents` is a fixed `MAX_ENTS` array with
  `id === index`, so iterate `i = 0..MAX_ENTS-1` and emit alive ones (this IS the sort).
  Per alive ent: `id, kind, civ, team, x, z, vx, vz, hp, maxHp, order, tx, tz, tid,
  cargo, cargoType, cooldown, stealth, frenzy, blinkCd, buildKind, progress, trainKind,
  trainT, rallyX, rallyZ, pathI, seenBy, rigTeam, rigProgress, rigHp, rigAccum,
  dissolveT, corpseT`.
  - Corpses stay `alive=true, hp=0` until `corpseT` expires (sim.ts kill/stepCorpses),
    so they hash as hp=0 entities — death timing stays visible; keep `dissolveT/corpseT`
    (2dp) since they gate the alive→false flip.
  - **Excluded (derived or cosmetic):** `path` array (recomputable from map + sx/sz/gx/gz,
    all hashed; keep `pathI`), `px/pz` (derived), `anim`, `facing`, `hitFlash`,
    `combatT`, `vis` (derived from fog arrays, below).
- **matchStats (via public `matchStats()`):** per team 0..1 `resources.ore/gas/energy,
  unitsTrained, unitsLost, coreDamage`. (Tracking is enabled after `reset()`.)
- **Fog:** fold the RAW bytes of `visible[0..1], explored[0..1]` (4 × 5184 bytes) into
  the main fnv stream — do not pre-hash into separate 32-bit values (avoids a second
  collision domain). Stable-hash form only; never the raw arrays in the snapshot.
- **discoveryLog:** `count`, then per event in array order (chronological, index order):
  `team, tick, id` (int id, or a stable code for string landmark ids — index into the
  fixed table central-lumen-field / neutral-tech-relic / expansion-player /
  expansion-rival / safe-route / danger-route), `kind` code, `x, z`. `label` is
  derivable from id/kind/cargoType → skip. Length + content identity both covered.

## 2. Float canonicalization rules

- **Quantize before hashing; hash integers, never raw doubles.**
  `q(v, grid) = Math.round(v / grid) | 0`; per-field grids:
  - **3 decimals (0.001):** `x, z, vx, vz, hp, maxHp, progress, stealth, frenzy, rigHp,
    rigAccum, lumen.progress`. Min real per-tick deltas: movement ≥ 0.0475 (slowest spd
    0.95 × DT 0.05), hp/rig ≥ 0.1 — every single-tick gameplay delta exceeds the grid.
  - **2 decimals (0.01):** timers `ageT, trainT, cooldown, blinkCd, dissolveT,
    corpseT` (all decrement 0.05/tick → 1-tick drift = 0.05 > grid). `pulseRemaining`
    also 2dp (re-anchored to 4.0 on pulse).
- **Why quantize at all:** same-engine same-code runs are bit-identical, but the sim
  uses 15 `Math.hypot/sin/cos/atan2` call sites (steer/stampMesa/dir8/…). These libm
  functions are *not* IEEE-754-exact across engines/platforms; 0.001 absorbs
  1e-16-level engine noise while staying far below any gameplay-significant delta.
- **Normalization:** assert `Number.isFinite` and throw on NaN/Infinity (fail loudly —
  NaN would poison a hash silently). `Math.round` of tiny negatives yields −0; `| 0`
  maps −0 → 0, so no −0/`"0"` vs `"-0"` hazard. Never use `toFixed/toPrecision`
  (locale-independent only by accident); format quantized ints with `String(int)`.

## 3. Object-enumeration-order hazards

- **`ents` is safe:** fixed array, `id === index` (constructor + reset), so
  `for (i=0; i<MAX_ENTS; i++)` IS sorted-by-id. Never hash a filtered copy without an
  explicit `sort((a,b)=>a-b)` — the copy order equals index order today, but that
  invariant must be preserved by rule, not luck.
- **Insertion-ordered mutable arrays:** `links`, `flags`, `discoveryLog`, `bolts`,
  `marshalPeelQ` are push/splice queues — iterate by index (order is part of identity:
  `flags` encodes click order, `discoveryLog` encodes chronology). Correct.
- **Set/Map:** the only Set in gameplay (`stepAiRigs` `claimed`) is add/has-only, never
  iterated — safe. Rule: never fold a Set/Map into the hash without converting to a
  sorted array first; never rely on `for..of` Set order.
- **`ents.find/filter/some`** (AI yard/house/scout/hall lookups, `stepAiFieldOrders`)
  are index-ordered and deterministic — safe because `ents` is an array; any future
  object-keyed lookup must be iterated in sorted key order.
- **Arrays-of-objects vs index arrays:** for objects (`links`, `flags`, log events,
  landmarks), emit fields in fixed per-entry order; landmark order is fixed by
  `makeHeliosLandmarks()` — never sort landmarks by id (breaks the §1 code table).
  Prefer index arrays (fog, tiles) with trivially canonical iteration.
  `q.sort((a,b)=>a-b)` in `buildMarshalPeelQueue` is the pattern to copy.
- **No JSON.stringify of the World or its objects:** property order is insertion order
  and would couple the hash to `makeEnt()` field layout; build the flat sequence
  instead. (For debugging, render the SEQUENCE, not the world.)

## 4. Private state — representation without touching sim.ts

| Private | Public representation | Coverage |
|---|---|---|
| `pendingPath[]` | `pendingPathOf(t)` (public, returns the in-channel path) | exact |
| `matchStatsData` | `matchStats()` (public, returns full copy) | exact |
| `lumenOwner/Capturing/Progress/Contested/PulseRemaining` | `lumenState()` | exact |
| `lumenChargeAccum` / `lumenOwnedAccum` | effects: `eco.energy` +1/s ticks; `lumenState().pulseRemaining` | bounded diff |
| `sporeT` (UniqueB cadence) | effect: extra Worker ent spawns (persistent) | bounded diff |
| `aiT` (AI cadence) | effect: AI actions land in ents/eco/boosts (persistent) | bounded diff |
| `heap/gScore/came/closed/stamp`, `free`, `sparkHead`, `marshalPeelQ/I/Built` | scratch/derived; fully determined by hashed state | none |

**Bounded-diff rule:** every hidden accumulator has a bounded period (<1 s charge,
<30 s pulse, 28 s spore, cadence ≤ 2.6 s) and **re-anchors to 0 on every event**, and
every event leaves a persistent public trace (energy integer, worker entity, pulse
countdown). So sample the hash **at every tick, or at most every ~20 ticks (1 s)**;
any hidden-phase divergence produces a public difference within one period, and the
persistent trace guarantees it is caught at the next sample even if the sample grid
straddles the event. Single-tick sampling is strongest and costs ~nothing
(sequence ≈ 3–6 k ints mid-game; fnv is O(n)).

## 5. Recommended hash recipe

**FNV-1a (32-bit) over the canonical ordered integer sequence** — the recipe already
proven in `tests/vs2b-lumen-field.test.ts:64-71` (`hash = 2166136261; ^= v;
*16777619 via Math.imul; >>> 0`), extended to stream the whole sequence:

```
fnv1a(values: ArrayLike<number>): number   // reuse test helper shape
let h = 2166136261; for (const v of values) { h ^= (v | 0); h = Math.imul(h, 16777619); }
return (h >>> 0).toString(16).padStart(8, '0');
```

- **Why FNV-1a:** pure `Math.imul` integer math → bit-exact on every engine (unlike
  libm); O(n) single pass, no allocation if streamed from a preallocated Int32Array;
  32-bit is ample for run-vs-run comparison (one hash per tick per run; collision risk
  ≈ n/2³², negligible and non-adversarial); repo precedent exists.
- **Recipe rules:** (a) prepend the schema version int so field-list changes
  intentionally invalidate old hashes; (b) quantize every float per §2 before folding;
  (c) fold fog bytes and discovery-log events into the SAME stream (no sub-hashes);
  (d) emit a hex string, and keep the raw sequence under a debug flag for field-level
  diffing; (e) compute after `world.step()` returns (post-`updateFog`), same call site
  and field order every tick — equality per tick is the determinism assertion.
- **Optional hardening:** a 64-bit FNV (two accumulators) if adversarial collision
  resistance is ever wanted; avoid `crypto.subtle` (async) / JSON.stringify (heavy).

**Acceptance criteria (follow-up tests; no sim.ts edits):** (1) two Worlds, same seed
+ identical scripted `issue()` input, step N ticks → equal hashes every tick;
(2) one input perturbed (move target nudged 1 tile) → hash diverges same tick and
never re-converges while state differs; (3) hash equal across `reset()` of the same
seed at tick 0; (4) `fogOfWarEnabled` toggle changes the hash; (5) path commit
mid-channel, lumen capture, and matchStats deltas each flip the hash at the right tick.