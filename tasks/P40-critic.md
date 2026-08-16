# P40 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p40-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with round sparks in the gap (not HP bars) | **Partial** — green hood cluster and dark hull cluster are both visible with orange/white sparks in the gap, but the ranks overlap at center instead of holding a clean left/right split; still countable, not a single pile |
| Workers gathering a gold gem between them | **Partial** — large gold diamond anchors mid-map and green-hood units hug it, but gather pose/sparkle is weak; one drone reads parked on the jewel rather than an active economy loop beside combat |
| Floor reads as quiet dust (not rainbow checker) | **Pass** — subdued mauve/purple crater repeat; no tri-color starburst checker |
| Silhouettes readable | **Pass** — green hood vs dark angular hull shapes distinguishable at zoom; no HP-bar chrome on unselected fighters |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker tile, minimap with blips, Move/Attack/Stop deck, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.86 ms, 539 fps uncapped rAF) |

Two wings, sparks, gem, quiet dust, and HUD are present, but the opening frame still does not sell a contest — I cannot tell who is winning the mid fight in one second, and I would not keep playing this match vs Age of Empires II: DE.

---

## Single biggest gap

The mid fight still has no readable winner in one second — held ranks, ambient floor sparks, and a center gem give no casualty skew, hit-flash, wreckage, or formation break to answer who is ahead (§9 #1).

**Three proofs:**

1. **Screenshot fight state:** green and dark wings remain full-weight clusters around the gold diamond; white/orange sparks float in the gap as decoration, not directional bolt trails or impact flashes tied to hulls taking damage — I cannot call a leader after a one-second glance.
2. **§6 tableau vs AoE2:** AoE2’s opening clash always sells stakes — arrows crossing, units falling, flank thinning — even without selecting units; here both sides look intact and static around the gem, so the duel is wallpaper, not a contest with a leader.
3. **§9 #6:** I would close the tab — performance and HUD are fine, but a symmetric mid-map scrum with no winner read is still a combat tech demo, not a skirmish I would expand across.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.86 |
| fps | 539 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.15-wave1` |
| Probe ents | 64 |
| Probe tick | 122 |
| Teams pop | 22 / 12 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 67 |
| nonBlackPixelShare | 92.84% |
| distinctQuantizedColors | 339 |

---

## What passed

- **Two wings:** green hood rank and dark hull rank face each other across the mid belt; not a single diagonal overlap pile.
- **Round sparks:** mid-gap orange/white dots and halos bridge the wings — not HP-bar chrome.
- **Mid gem:** stationary gold diamond on the duel floor between the clusters.
- **Quiet dust:** subdued mauve floor; no rainbow checker.
- **Silhouettes:** fighters read as distinct hull shapes at a glance.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck — AoE2 command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — symmetric ranks and ambient sparks; no casualty or hit read |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — green hood vs dark hull reads; third civ not shown |
| 4 | World looks like a place | **Partial** — quiet dust + center gem + edge structures; still thin camp/gather loop in frame |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — dead-even fight with no stakes; not a match I would stay in |
