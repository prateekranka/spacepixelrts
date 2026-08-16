# P38 — Critic verdict (Wave 1, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 and §9 only (not `tasks/*.md`) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p38-live.png --fps-seconds 3 --wait 3`  
(`npm run critic` duplicates `--screenshot` and keeps the package default `critic/out/latest.png`; that file is the authoritative capture.)

**Screenshot reviewed:** `critic/out/latest.png` (live)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 1 — **Fail**

| Criterion | Result |
|---|---|
| Two countable wings with round sparks in the gap (not HP bars) | **Pass** — green hood rank upper, blue diamond hull rank lower, orange/cyan round dots in the gap; no full-width HP chrome on unselected fighters |
| Stationary gold gem on the duel floor between them | **Pass** — large gold diamond node sits dead center on the belt between the two held wings, with orange spark halos on the floor |
| Floor reads as quiet dust (not rainbow checker) | **Pass** — subdued mauve/purple crater repeat; no tri-color starburst checker |
| Silhouettes readable | **Pass** — black hull silhouettes mix with lit sprites; green hood vs blue diamond shapes countable |
| Workers + camp scrap in the same frustum | **Fail** — orange nexus disc and gold structure hug the top edge, but **no worker drones gather** at patches or the mid gem; the economic loop is invisible in the wow shot |
| Command HUD (AoE2 grammar) | **Pass** — Ore/Vol/Chg/Pop strip, idle-worker tile, minimap with blips, Move/Attack/Stop deck, faction header |
| Harness frame time (p99 < 22 ms) | **Pass** — live p99 **4.1 ms** (avg 1.85 ms, 539 fps uncapped rAF) |

The mid gem finally anchors the duel, but the opening frame still is not a skirmish **place** — I cannot see who is winning, I do not see workers making the belt live, and I would not keep playing this match vs Age of Empires II: DE.

---

## Single biggest gap

Workers and gather activity are absent from the wow frustum — the belt shows two static ranks and a center gem sticker, but no camp-to-node economy in the same frame §6 requires.

**Three proofs:**

1. **Screenshot economy:** the frustum is fighters + one gold gem + edge structures only; no green-hood **Worker** bent at ore/gas/solar, no gather sparkle on the mid node, no house pad with drones in motion — AoE2 frame one always shows villagers on nodes beside the clash.
2. **§6 tableau:** "varied dust/rock, readable gems, and a scrap of camp (house + workers gathering)" must coexist with the held ranks; P38 adds the stationary gem but drops visible workers from the duel lane, so the shot still fails "same frustum must read as a place."
3. **§9 #6:** I would close the tab — a prettier center jewel on an endless purple carpet is not a match I would expand across; without workers the wow moment is still a combat tech demo, not an RTS I would keep playing.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **4.1** |
| avgFrameMs | 1.85 |
| fps | 539 (uncapped probe — not a fail) |
| framesWorseThan45fps | 0 |
| Probe version | `0.2.13-wave1` |
| Probe ents | 63 |
| Probe tick | 123 |
| Teams pop | 16 / 17 (cap 20) |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 67 |
| nonBlackPixelShare | 93.71% |
| distinctQuantizedColors | 339 |

---

## What passed

- **Mid gem:** stationary gold diamond on the duel floor between the two wings, with round orange floor sparks — the P38 target landed.
- **Held ranks:** top green hoods face down, bottom blue hulls face up across the gem; not a diagonal march column.
- **Round sparks:** mid-gap orange/cyan circular dots bridge the wings — not HP-bar chrome.
- **Quiet dust:** subdued mauve floor; no rainbow checker.
- **Silhouettes:** fighters read as distinct hull shapes at a glance.
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
- **HUD:** resource strip, minimap, bottom command deck — AoE2 command grammar, not a debug overlay.

---

## DESIGN §9 checklist (blind vs AoE2:DE)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Fail** — symmetric ranks and sparks; no casualty skew, hit-flash, or HP read to call a winner |
| 2 | Move feels like commanding | Not exercised (static critic run) |
| 3 | Three civs feel like different peoples | **Partial** — blue diamond vs green hood reads; third civ not shown |
| 4 | World looks like a place | **Fail** — quiet dust + one center gem; no rock breaks, no worker gather loop, no node field geography on the belt |
| 5 | Holds 60 fps while fight is on | **Pass** on harness canvas |
| 6 | Would keep playing | **Fail** — center gem is decoration without workers or belt economy; not a skirmish I would stay in |
