# P43 — Critic verdict (training / pop cap, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §3, §7, §9 — scope is **can you start growing an empire** from the opening skirmish (not re-judging the Wave 1 tableau bar) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p43-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/latest.png` (opening tableau, tick ~122) · `critic/out/p43-opening.png` (fresh-load opening confirm, tick ~69)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P43 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≠ `0.2.16-wave1` | **Pass** — `0.3.0-wave2` |
| `pop < cap` and `cap ≥ 30` at open | **Pass** — **22/30** (Nexus 10 + housing headroom; cap 30) |
| Jump to Nexus (~10.5, 10.5), select hall | **Pass** — hall selected via probe; title reads Nexus/Hall |
| Command deck offers **Train Worker** enabled | **Pass** — `train-0` (Worker) button present, not disabled |
| Click Train Worker → pop ↑, ore ↓ within ~10s | **Pass** — pop **22 → 23**, ore **220 → 170** (50-ore Worker cost) by tick ~291 |
| Wave 1 tableau not regressed (opening camera) | **Pass** — fresh load at opening frustum: **9** intact Helion fighters, **5** Kryos living + **8** wreck props, mid gem, **3** gem workers; screenshot matches P41 (green rank above, Kryos wreck belt below, gold diamond in gap) |
| Harness frame time | **Pass** — p99 **3.9 ms**, 0 frames worse than 45 fps in 3 s probe |

From the opening skirmish I can pan home, select the Nexus, and queue a Worker with ore and pop room — the empire loop starts. The mid fight tableau on a fresh load is unchanged from P41.

---

## Single biggest gap

None blocking P43 — marginal note only: after ~11s of live sim the mid fight **evolves** (Kryos line thins past tick 240); reset camera alone does not freeze the diorama, so regression checks must use a fresh load or early tick, not a post-training late tick.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.9** |
| avgFrameMs | 1.87 |
| fps | 535 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.0-wave2` |
| Probe ents | 66 |
| Probe tick (opening) | 122 |
| Teams pop | **22/30** vs 9/30 |
| Civ | vespari vs aurion |
| Console issues | none |
| Training delta | ore 220→170, pop 22→23 |
| Opening tableau (fresh tick ~69) | helion 9 · kryos living 5 · wrecks 8 · mid gem · workers 3 |
| Console issues | none |

---

## What passed

- **Pop headroom:** 22/30 at open — not pinned at cap; cap raised to 30 (≥ DESIGN Nexus 10 + housing path).
- **Train from Nexus:** Hall command deck shows Worker train enabled; click spends ore and increments pop when room exists.
- **Economy coupling:** Worker queue deducts 50 ore on completion — matches §3 Worker cost table.
- **HUD grammar (§7):** Pop counter updates live (`23/30` after train); command bar verbs appear on building select.
- **Wave 1 preserved:** Opening camera still reads Helion intact rank vs Kryos wreck belt + mid gem + gatherers — P41 tableau intact on fresh load.
- **Performance:** p99 well under 22 ms during probe.

---

## DESIGN §9 checklist (empire-start slice)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Pass** (carry-over P41 — not regressed on fresh open) |
| 2 | Move feels like commanding | Not exercised |
| 3 | Three civs feel like different peoples | Not exercised (same skirmish pair) |
| 4 | World looks like a place | **Pass** (carry-over P41 tableau) |
| 5 | Holds 60 fps while fight is on | **Pass** |
| 6 | Would keep playing | **Pass** — I can train a Worker from the fight and grow pop; empire loop opens |
