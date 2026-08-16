# P37 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p37-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with round sparks in the gap (not HP bars) | **Partial** — blue diamond hulls trail from bottom-left and green hoods sit upper-right, but the center reads as a **diagonal march column** (~6 hulls) with an orange spark streak, not two held 8+unique facing ranks on the same X split by Z |
| Floor reads as quiet dust (not rainbow checker) | **Pass** — subdued mauve/purple crater repeat; no tri-color starburst checker |
| Readable gems + rocks + workers in the same frustum | **Fail** — five green-hood workers and top-right camp scrap are visible, but **no rock outcrops** break the duel lane and **no stationary ore/gas/solar node gems** sit on the belt floor; mid-frame orange dots read as bolt trails, not gatherable patches |
| Silhouettes readable | **Pass** — green hood vs blue diamond hulls countable without full-width HP bars on unselected fighters |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker control, minimap with blips, Move/Attack/Stop tiles, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.3 ms** (avg 1.88 ms, 532 fps uncapped rAF) |

Quiet dust holds, workers and spark VFX improved, but the wow shot still does not sell a skirmish **place** with readable belt geography in the same frame as the fight — not genuinely wowed vs Age of Empires II: DE, and I would not keep playing this match.

---

## Single biggest gap

Readable rock breaks and gatherable ore/gas/solar gems still do not appear on the duel floor — workers and orange spark trails hug the margins while the center remains an empty quiet-dust void, failing §6’s “same frustum must read as a place.”

**Three proofs:**

1. **Screenshot terrain:** the march lane is one low-contrast purple-grey wash from edge to edge; no grey **Rock** tiles block pathing, no cyan **Gas** vents, no gold **Solar** nodes, and no distinct **Ore** patches break the floor into geography you could route workers across — unlike AoE2 frame one where nodes and rock are obvious on the fight tile.
2. **Mid-gap reads:** the orange and cyan **round dots** form a diagonal streak between moving hulls — they look like projectile sparks in flight, not the ≥9 ore / 6 gas / 5 solar **node entities** §6 places outside base pads; palette top bands stay muddy purple (`#554455` **31.5%**, `#111122` **22.2%**, `#665577` **20.3%**) with no resource-hue clusters dominating the frustum.
3. **§9 #6:** I would close the tab after this opening — edge camp + spark column on empty fog is a prettier tech demo than P36, but still not a belt I would expand across; AoE2 DE sells gather loop, rock, and ranks in one glance.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.3** |
| avgFrameMs | 1.88 |
| fps | 532 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.12-wave1` |
| Probe ents | 60 |
| Probe tick | 123 |
| Teams pop | 16 / 17 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 68 |
| nonBlackPixelShare | 94.73% |
| distinctQuantizedColors | 332 |

---

## What passed

- **Quiet dust:** no rainbow checker; floor is subdued mauve/purple crater repeat.
- **Workers in frame:** green-hood gatherers visible near top-right camp scrap — §6 camp hint is present for the first time in the wow shot.
- **Round sparks:** mid-gap orange/cyan circular dots bridge hull groups — not HP-bar chrome.
- **Silhouettes:** fighters read as distinct hull shapes at a glance.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck — AoE2 command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — diagonal column march, not two held ranks; no casualty skew or hit-flash to declare a winner |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — quiet dust without rock, nodes, or gather geography on the duel floor |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — empty purple void undermines the spark column; not a skirmish I would stay in |
