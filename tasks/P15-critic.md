# P15 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **URL:** https://spacepixelrts.pages.dev · **Harness:** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/live.png --fps-seconds 4 --wait 3` · **Screenshot:** `critic/out/live.png` · **Judged:** 2026-08-16

**Quality bar read:** `docs/DESIGN.md`, `docs/ARCHITECTURE.md` (not `tasks/*.md` or `PROGRESS.md`).

**Modlens:** attempted `modlens analyze -i critic/out/live.png -p openai`; failed (OpenAI-compatible API 400). Visual verdict below is from the PNG + harness only.

---

## Wave 1 scope — **Fail**

| Criterion | Result |
|---|---|
| Playable isometric skirmish | Partial — units exist and fight, but no mid-map army tableau |
| Select / move | HUD + command deck present; not exercised in this run |
| Fight readable | Weak — only a few blobs visible; silhouettes/civ identity unclear at default view |
| 60 fps | **Fail** — harness 30 fps |
| Palette discipline | **Fail** — 280 distinct quantized colors (target ~32–40) |

---

## Single biggest gap

The live canvas does not deliver the Wave 1 “wow shot”: it reads as a dark grid demo with a tiny skirmish, not a battlefield you would keep commanding.

**Three proof metrics:**

1. **~5 combat sprites visible** in the opening screenshot (3 green circles + 2 cyan diamonds) vs DESIGN §6 opening tableau of **8 vs 8 Fighters + one unique each + workers** already in motion.
2. **30 fps** measured (`avgFrameMs` 33.19, `framesWorseThan45fps` 120, probe `fps` 30) vs **60 fps** non-negotiable (DESIGN §9.5, ARCHITECTURE §1.7).
3. **280** `distinctQuantizedColors` vs master-palette target **~32–40**; top canvas share **35.8%** `#111122` — muddy near-blacks, not a crisp limited palette.

---

## Harness JSON (`critic/out/latest.json`)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| FPS (avg) | **30** |
| avgFrameMs | 33.19 |
| p99FrameMs | 35.1 |
| framesWorseThan45fps | 120 |
| Probe version | `0.2.0-wave1` |
| Probe tick | 149 |
| Probe ents | 52 |
| Probe map | 72 |
| Console issues | **none** |
| distinctQuantizedColors | **280** |
| avgLuminance | 33 |
| nonBlackPixelShare | 78.19% |

Top palette shares: `#111122` 35.8%, `#000011` 18.5%, `#221133` 7.5%, `#333333` 6.7%.

---

## What I actually saw in the screenshot

**Terrain:** Large dark purple/charcoal isometric blocks; some tiles show a 4-pixel grey grid. No readable ore/gas/solar nodes, bases, or fog-of-war drama — mostly void and dust slabs.

**Units:** A small central clash — ~3 bright green circular units (antenna blobs) vs ~2 cyan diamond units. Tiny green/red HP bars. Sparse green/red pixel sparks between groups. No visible Nexus, workers en route, or 8v8 mass.

**HUD:** Top strip — **HELION COMPACT / STARHOLD**, resources **220 ORE · 40 VOL · 90 CHG · 11/15 POP**, “Idle worker” control. Instruction line: landscape command deck / two-finger pan / box-select. Bottom command deck — minimap (green/blue dots, white viewport box), **“Nothing selected”**, Helion Compact hint text, dimmed Move/Attack/Stop, group I/II/III. Top-right small **“60”** label (contradicts harness 30 fps).

**Overall feel:** Retro micro-pixel UI is clean; the **game field** is too empty and too dark to pass the AoE2 blind bar for battle clarity or empire presence.

---

## Blind comparison vs Age of Empires II: Definitive Edition

| Axis | vs AoE2 DE |
|---|---|
| **Battle clarity** | Far below — fight is a handful of pixels; cannot read army composition or winner in one second |
| **Command feel** | Unverified interactively; chrome suggests intent but field does not feel like ruling an army |
| **Empire presence** | Missing — no bases, economy motion, or scale; pop 11/15 with almost nothing on screen |
| **Pixel craft** | Below — palette undisciplined, terrain generic; units lack strong civ silhouettes at play zoom |
| **60 fps** | Fail — 30 fps on critic harness while fight is tiny |

---

## Verdict for builder

Wave 1 is **not done**. Ship the opening tableau first (8v8 + uniques + workers, readable at zoom), fix frame rate to real 60 on the critic canvas, and quantize to the master palette before asking for another critic pass.
