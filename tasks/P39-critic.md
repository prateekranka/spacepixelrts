# P39 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p39-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with round sparks in the gap (not HP bars) | **Pass** — green hood rank upper-right, blue diamond hull rank lower-left; orange/cyan round dots and halos in the gap; no full-width HP chrome on unselected fighters |
| Workers gathering a gold gem between them | **Partial** — large gold diamond sits dead center and one green-hood unit hugs it, but there is no bent gather pose, no gather sparkle on the node, and no second worker or house pad in frame; the drone reads as another fighter parked on the jewel |
| Floor reads as quiet dust (not rainbow checker) | **Pass** — subdued mauve/purple crater repeat; no tri-color starburst checker |
| Silhouettes readable | **Pass** — black hull silhouettes mix with lit sprites; green hood vs blue diamond shapes countable at a glance |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker tile, minimap with blips, Move/Attack/Stop deck, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.2 ms** (avg 1.86 ms, 537 fps uncapped rAF) |

The mid gem and a lone drone are progress, but the opening frame still is not a skirmish **place** I would stay in — I cannot tell who is winning the exchange, the gather loop does not read as economy beside combat, and I would not keep playing this match vs Age of Empires II: DE.

---

## Single biggest gap

The mid fight still has no readable winner in one second — symmetric held ranks and round floor sparks give no casualty skew, hit-flash, wreckage, or formation break to answer who is ahead (§9 #1).

**Three proofs:**

1. **Screenshot fight state:** green and blue wings remain full, mirror-weight clusters across the gem; orange/cyan dots are ambient gap decoration, not directional bolt trails or impact flashes tied to hulls taking damage — I cannot call a leader after a one-second glance.
2. **§6 tableau vs AoE2:** AoE2’s opening clash always sells stakes — arrows crossing, units falling, flank thinning — even without selecting units; here both eight-ish wings look intact and static, so the duel is wallpaper, not a contest.
3. **§9 #6:** I would close the tab — a center gem with one parked drone does not overcome the dead-even fight read; without winner/loser tension the wow shot is still a combat tech demo, not a match I would expand across.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.2** |
| avgFrameMs | 1.86 |
| fps | 537 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.14-wave1` |
| Probe ents | 69 |
| Probe tick | 123 |
| Teams pop | 22 / 17 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 68 |
| nonBlackPixelShare | 92.5% |
| distinctQuantizedColors | 347 |

---

## What passed

- **Mid gem:** stationary gold diamond on the duel floor between the two wings, with round orange floor sparks — anchor is present.
- **Held ranks:** upper green hoods face lower blue hulls across the gem; not a single diagonal overlap pile.
- **Round sparks:** mid-gap orange/cyan circular dots and halos bridge the wings — not HP-bar chrome.
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
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Partial** — quiet dust + center gem + one drone; still no rock breaks or patch field on the belt |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — dead-even fight with thin gather hint; not a skirmish I would stay in |
