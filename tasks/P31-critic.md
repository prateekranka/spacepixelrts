# P31 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p31-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings exchanging fire | **Fail** — one blue diamond wedge (~9) holds center-left; no opposing green fighter rank trades bolts across the mid gap |
| Hold-fire ranks (not one stack) | **Fail** — green silhouettes appear only as an upper-right camp huddle, not a facing combat wing |
| Silhouettes readable at fight scale | **Partial** — blue diamonds read; green hood blobs at camp are indistinct at gather scale |
| Playfield feels like a place | **Fail** — repeating purple/blue/tan glyph tiles fill the frustum; no dust-belt, rock, or vent variety |
| Camp / workers / gems beside wing between HUD bars | **Partial** — dark house + orange gems + ~6–8 green hood figures upper-right in playfield; bodies overlap into a smear, gather loop not readable |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4 ms** (avg 1.88 ms, 533 fps uncapped rAF) |

Not genuinely wowed vs Age of Empires II: DE. Workers beside the house are progress, but I would not keep playing a skirmish that frames a lone fighter wedge on abstract flooring with no mid-map exchange fire.

---

## Single biggest gap

The §6 opening tableau no longer shows two facing ranks exchanging bolts — only a blue fighter wedge occupies center while green units appear solely as a corner worker blob, so the wow shot is a half-fight on glyph tiles rather than the inhabited mid-map duel AoE2 sells in frame one.

**Three proofs:**

1. **Screenshot combat:** the playfield between HUD bars shows **~9 blue diamond fighters** on a diagonal with red HP bars, but **no green fighter rank** faces them and **no bolt streaks or muzzle flashes** span the mid gap.
2. **Screenshot camp vs fight:** green hood figures cluster **upper-right** beside an orange gem and dark house (~6–8 overlapping blobs), while the **center belt holds only the blue wedge** — §6’s “same frustum” duel + camp reads as two disconnected vignettes, not one tableau.
3. **Metrics / palette:** `p99FrameMs` **4** passes the fps bar, but `probe.ents` **61**, palette top `#111122` at **19.7%**, and **avgLuminance 74** confirm the world is still void-and-glyph filler — not the varied dust/rock/vent belt §9.4 and §9.6 require to keep playing.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4** |
| avgFrameMs | 1.88 |
| fps | 533 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.6-wave1` |
| Probe ents | 61 |
| Probe tick | 123 |
| Teams pop | 17 / 19 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 74 |
| nonBlackPixelShare | 93.06% |
| distinctQuantizedColors | 453 |

---

## What passed

- **Workers beside house:** green silhouettes, orange gems, and a dark structure now share the upper-right playfield between HUD bars — partial §6 camp placement.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck (Move / Attack / Stop, group keys, idle-worker affordance) — reads as RTS command grammar, not a debug overlay.
- **Blue fighter silhouettes:** diamond rank members are roughly countable when isolated from the camp blob.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — one wedge, no opposing rank or readable exchange fire |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — glyph floor; camp corner does not sell dust-belt terrain |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — half-duel on abstract tiles, not a skirmish I would stay in |
