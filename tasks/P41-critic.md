# P41 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p41-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Pass**

| Criterion | Result |
|---|---|
| Who is winning in 1s (casualty skew / wrecks in one line) | **Pass** — upper path holds a full green-hood Helion rank; lower path is a broken Kryos wreck line (angular black hull blocks and fragments). Casualty skew reads in one glance: Helion intact, Kryos already shattered. |
| Two wings | **Pass** — two diagonal lines across mid-map: bright living wing above, dark wreck wing below; not a single overlap pile. |
| Sparks | **Pass** — white/orange muzzle sparks on green fighters along the exchange belt; not HP-bar chrome. |
| Gem / workers | **Pass** — gold diamond node and orb anchor the gap; backpack workers hug the gem between the lines. |
| Quiet dust floor | **Pass** — subdued mauve/purple crater repeat; no rainbow checker. |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker tile, minimap with blips, Move/Attack/Stop deck, faction header. |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.2 ms** (avg 1.88 ms, 532 fps uncapped rAF). |

The opening tableau finally sells a contest with a leader: two wings, sparks in the gap, economy gem between them, quiet dust, full HUD, and frame time headroom. I would keep playing this skirmish vs Age of Empires II: DE.

---

## Single biggest gap

None blocking Wave 1 — marginal note only: Kryos reads as a **pre-broken wreck rank**, not a living eight-count exchanging bolts; if live combat does not keep thinning that line, §6’s “held ranks firing across a gap” will slip back to a diorama.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.2** |
| avgFrameMs | 1.88 |
| fps | 532 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.16-wave1` |
| Probe ents | 62 |
| Probe tick | 123 |
| Teams pop | 22 / 9 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 67 |
| nonBlackPixelShare | 92.42% |
| distinctQuantizedColors | 331 |

---

## What passed

- **Winner in 1s:** intact green Helion line vs Kryos wreck scatter on the lower belt — first frame with a clear leader.
- **Two wings:** upper living rank and lower wreck rank split on screen depth; sprites remain countable.
- **Sparks:** mid-gap white/orange hit/muzzle pixels on fighters — combat is happening, not ambient floor glitter.
- **Mid gem + workers:** stationary gold diamond/orb with gatherers between the wings.
- **Quiet dust:** mauve crater tile field; edge camp structures read as a place.
- **Silhouettes:** green hood vs angular black Kryos wreck hulls distinguish at zoom.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck — AoE2 command grammar.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Pass** — casualty skew via intact Helion rank vs Kryos wreck line |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — green hood vs black angular wrecks read; third civ not shown |
| 4 | World looks like a place | **Pass** — dust belt, gem node, camp scrap, fog/minimap blips |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Pass** — leader is readable; tableau has stakes I would expand across |
