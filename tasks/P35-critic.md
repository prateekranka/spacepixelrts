# P35 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p35-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with round gold/cyan sparks in the gap (not HP bars) | **Pass** — ~7 blue diamonds (bottom-left) and ~6 green hoods (upper-right) face across open tiles; mid-gap shows **round orange/gold and cyan dots** on a diagonal streak, visually distinct from hull chrome |
| Silhouettes readable | **Pass** — fighters show hull silhouettes without full-width HP bars; wings are countable at a glance |
| Some camp / gems | **Pass** — top-right dark structure + glowing orange gem cluster; bottom-left brown pads with worker diamonds apart from center duel |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.85 ms, 540 fps uncapped rAF) |

Round bolts and opening HP chrome are fixed, but the frame still does not sell a skirmish on terrain I would inhabit — not genuinely wowed vs Age of Empires II: DE, and I would not keep playing this match.

---

## Single biggest gap

The battlefield still reads as a repeating tri-color starburst checkerboard, not a dust-belt **place** with varied dust, rock, vents, and readable geography (§6 “place” / §9 #4).

**Three proofs:**

1. **Screenshot terrain:** purple, gold, and cyan squares with identical white star/cross motifs tile the entire frustum; no rock outcrops, ore veins, or dust variation break the pattern into readable geography — it looks like shader fill, not AoE2 ground you'd march across.
2. **Palette / metrics:** top quantized colors are `#111122` (**19.9%**), `#554433`, `#335566`, `#665566` in near-equal bands — abstract tile bands, not a skirmish palette with base pads, pathing rock, and resource clusters dominating distinct zones.
3. **§9 #6:** even with round gap sparks and clean silhouettes, I would close the tab after the opening duel — the wow shot proves combat VFX, not a world worth ruling; AoE2 DE sells both in frame one.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.85 |
| fps | 540 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.10-wave1` |
| Probe ents | 58 |
| Probe tick | 122 |
| Teams pop | 16 / 17 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 75 |
| nonBlackPixelShare | 93.72% |
| distinctQuantizedColors | 424 |

---

## What passed

- **Round bolts:** mid-gap orange/gold and cyan **circular sparks** bridge the wings — no longer the 1×N bar grammar that matched HP chrome in P34.
- **Opening HP chrome:** unselected fighters show hull silhouettes without full-width orange HP strips during the wow shot.
- **Wing separation:** blue diamond and green hood clusters occupy opposite quadrants with a visible gap and active fire in between — not a single overlap pile.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck — reads as RTS command grammar, not a debug overlay.
- **Camp hints:** top-right scrap/gem cluster and bottom-left worker pocket give §6 camp read away from center duel.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Partial** — ranks and round sparks read; no hit-flash or casualty skew to declare a winner instantly |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — starburst glyph floor; terrain does not sell a dust-belt skirmish |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — abstract tiles undermine the bolt duel; not a skirmish I would stay in |
