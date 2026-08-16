# P36 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p36-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with round sparks in the gap (not HP bars) | **Pass** — ~8 green hoods (upper) and ~9 blue diamonds (lower) face across open tiles; mid-gap shows **round orange and cyan dots** on a diagonal streak, visually distinct from hull chrome |
| Floor reads as a quiet dust place (not a rainbow checker) | **Partial** — tri-color starburst checker is gone; frustum is now a flat mauve/purple smear with faint repeat, but it still does not read as varied belt geography |
| Silhouettes readable | **Pass** — green hood and blue diamond hulls are countable without full-width HP bars on unselected fighters |
| Some camp / gems | **Partial** — top-right scrap with orange glow and bottom-left base pad are visible, but no workers on nodes and no ore/gas/solar gems readable on the duel floor |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.2 ms** (avg 1.86 ms, 538 fps uncapped rAF) |

The checkerboard is dead and gap sparks are clean, but the wow shot still does not sell a skirmish **place** I would inhabit — not genuinely wowed vs Age of Empires II: DE, and I would not keep playing this match.

---

## Single biggest gap

The frustum is a featureless quiet-dust void with no readable ore/gas/solar nodes, rock breaks, or workers gathering — it fails §6’s “same frustum must read as a place” and §9 #4 even though the rainbow checker is gone.

**Three proofs:**

1. **Screenshot terrain:** the entire battlefield is one low-contrast purple-grey wash with a faint repeating nebula motif; no distinct ore patches, cyan gas vents, gold solar vents, or rock outcrops break the floor into marchable geography the way AoE2 ground does in frame one.
2. **Palette / metrics:** top quantized colors are `#554455` (**31.6%**), `#111122` (**22.2%**), `#665577` (**20.3%**) — three muddy purple bands covering **~74%** of pixels with no resource-hue clusters (no cyan/gold gem reads in the top band).
3. **§9 #6:** I would close the tab after the opening duel — quiet dust removed the shader noise but also removed the world; two sprite wings on empty fog is still a tech-demo tableau, not a belt I would expand across.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.2** |
| avgFrameMs | 1.86 |
| fps | 538 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.11-wave1` |
| Probe ents | 58 |
| Probe tick | 122 |
| Teams pop | 16 / 17 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 68 |
| nonBlackPixelShare | 93.62% |
| distinctQuantizedColors | 338 |

---

## What passed

- **Quiet dust (vs P35):** no tri-color starburst checker; floor is subdued mauve/purple instead of rainbow tile fill.
- **Round bolts:** mid-gap orange and cyan **circular sparks** bridge the wings — not HP-bar chrome.
- **Wing separation:** green hood and blue diamond clusters occupy opposite halves with active fire between — not a single overlap pile.
- **Silhouettes:** fighters read as distinct hull shapes at a glance.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck — AoE2 command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Partial** — ranks and round sparks read; no hit-flash, HP skew, or casualties to declare a winner instantly |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — quiet dust smear without nodes, rock, vents, or gather loop |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — empty purple void undermines the bolt duel; not a skirmish I would stay in |
