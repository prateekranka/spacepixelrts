# P29 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p29-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Pass** — green hooded rank (~7–8) trades green bolts with blue diamond rank (~8); muzzle flashes visible in the gap |
| Hold-fire ranks (not one stack) | **Pass** — wings occupy opposing halves with a clear mid gap; no central overlap pile |
| Silhouettes readable at fight scale | **Partial** — green mass vs blue diamond reads at a glance, but units stay small on flat glyph tiles |
| Playfield feels like a place | **Fail** — repeating star/wave/hatch floor fills the frustum; one corner crag with gems does not sell dust-belt terrain or flank camps |
| Camp / workers / gems between HUD bars | **Fail** — three resource icons sit on the top-right crag under the FPS readout; no house, workers, or gather loop in the central belt |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **6.3 ms** (avg 2.15 ms, 465 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. The hold-fire exchange finally reads as two armies, but I would not keep playing a skirmish framed as patterned floor tiles with no visible flank camp economy in the belt I am meant to rule.

---

## Single biggest gap

The §6 flank-camp tableau still never appears in the opening frustum — workers, structures, and gather loops are absent from the playfield between the HUD bars, so the wow shot remains a ranged duel on abstract tiles rather than a place with camps and economy.

**Three proofs:**

1. **Screenshot economy:** the entire central band between the resource strip and command deck shows **only two combat wedges** on star/wave/hatch tiles — **no worker silhouettes**, no Nexus/Habitat footprint, and no gather animation anywhere in frame despite probe pop **17/20**.
2. **Screenshot “flank camp”:** the sole resource tableau is **three gems on a crag** jammed into the **top-right corner** beneath the **421 FPS** readout — outside the mid-map belt where §6 expects readable gems **and** a scrap of camp (house + workers gathering).
3. **Metrics / palette:** `p99FrameMs` **6.3** passes the fps bar, but `probe.ents` **62** and palette top color `#111122` at **20%** with **avgLuminance 75** confirm the frustum is still void-and-tile filler — not the inhabited dust/rock/vent belt AoE2 sells in frame one (§9.4, §9.6).

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.3** |
| avgFrameMs | 2.15 |
| fps | 465 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.4-wave1` |
| Probe ents | 62 |
| Probe tick | 123 |
| Teams pop | 17 / 17 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 75 |
| nonBlackPixelShare | 94.17% |
| distinctQuantizedColors | 410 |

---

## What passed

- **Hold-fire ranks:** two separated wings with visible exchange fire — meets §6’s “not one overlap pile” and “hold `Ord.Attack` in place” intent.
- **Silhouettes:** blue diamond fighters vs green hooded fighters are distinguishable; each rank member is roughly countable.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Partial** — ranks and HP bars readable; no clear casualty pressure or front-line collapse yet |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — two distinct silhouettes on screen; third civ not shown |
| 4 | World looks like a place | **Fail** — glyph floor and corner crag; no flank camps, vents, or gather tableau in main view |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — readable skirmish, not a world I would stay in |
