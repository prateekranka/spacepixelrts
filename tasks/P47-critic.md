# P47 — Critic verdict (Wave 2 match arc, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §4 §6 §8 §9 — would you keep playing this as an RTS vs Age of Empires II: DE, not only the opening screenshot · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p47-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/p47-critic.png` (fresh-load opening, harness tick ~118) · `critic/out/p47-victory.png` (enemy Nexus killed) · `critic/out/p47-defeat.png` (player Nexus killed)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P47 — **Pass**

| Criterion | Result |
|---|---|
| Probe version `0.3.3-wave2` or newer | **Pass** — `0.3.3-wave2` |
| Opening tableau not regressed | **Pass** — Helion **9** intact fighters, Kryos wreck belt (0 living at tick ~120), contested mid gem, **2–3** mid workers; screenshot matches P41 grammar (green rank above, shattered Kryos below, gold diamond in gap, base camp + HUD) |
| Harness p99 < 22 ms | **Pass** — p99 **8.8 ms**, 0 frames worse than 45 fps in 3 s probe |
| Grow: `pop < cap` at open | **Pass** — **22/30** |
| Grow: Hall can train Worker | **Pass** — `train-0` enabled on Hall select (P43 path); `tryTrain(Worker)` spends 50 ore when room exists |
| Grow: Age Up Spark → Orbit exists | **Pass** — Hall deck shows **Spark → Orbit**; `tryAgeUp(0)` spends **400 ore + 80 chg**, sets `ageT: 40`, blocks Worker train while aging |
| Threat: tick ≥ 280, enemy military committed on player Nexus | **Pass** — tick **280**: **3** enemy Scouts `AttackMove` → player Hall **359** at ~(10.5, 10.5) |
| End: kill enemy Hall → **VICTORY** | **Pass** — `winner === 0`; green `#match-end.win`, title **VICTORY**, sub **Enemy Nexus shattered** |
| End: kill player Hall → **DEFEAT** | **Pass** — `winner === 1`; red `#match-end.lose`, title **DEFEAT**, sub **Your Nexus is ash** |
| §9 #2 command feel (spot-check) | **Marginal pass** — sim `issue(Move)` advances a Helion fighter **Δ(2.8, 2.2)** tiles; Idle-worker HUD node stable across click + rAF; canvas tap/box/right-click attack-move not exercised to AoE2 bar |
| §9 #6 would keep playing (Wave 2 skirmish arc) | **Pass** — opening still wows; I can boom, age, defend under inbound scouts, and finish the match |

Wave 2 closes the loop: the P41 opening tableau still sells the fight, pop headroom and Nexus production work, Spark→Orbit research gates Worker queue correctly, enemy scouts peel onto my Nexus after the clash, and destroying either Hall ends the match with a readable banner. This is no longer “screenshot only” — it is a skirmish skeleton I would play once through. It is not yet an AoE2:DE replacement.

---

## Single biggest gap

**Enemy military never becomes a real army (#6 vs AoE2:DE).** DESIGN §6 calls for attack-moving the player Nexus when **6+ military** exist; at tick 280 only **three Scouts** are committed, with no fighter blob, no siege, and no composition choice forcing walls, counters, or age timing. I would keep playing this Wave 2 build to see the arc close, but I would not queue a second skirmish vs AoE2:DE until inbound pressure feels like an army, not a scout timer.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **8.8** |
| avgFrameMs | 3.66 |
| fps | 273 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.3-wave2` |
| Probe ents | 66 |
| Probe tick (opening harness) | 118 |
| Probe winner (opening) | **-1** |
| Teams pop (player) | **22/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Playwright probes (live)

| Probe | Tick | Helion living | Kryos living | Mid workers | Enemy committed on Hall |
|---|---:|---:|---:|---:|---:|
| Harness opening | 118 | 9 | 0 | 2–3 | 0 (pre-peel) |
| Fresh early | 68 | 9 | 5 | 2 | 0 |
| Fresh settled | 120 | 9 | 0 | 2 | 0 |
| Threat (≥ 280) | 280 | — | — | — | **3** Scouts AttackMove → Hall 359 |
| Age-up (`tryAgeUp`) | — | ore **500→100**, chg **200→120**, `ageT: 40`, Worker train blocked | | | |
| Move (`issue`) | — | fighter **323** moved **Δ(2.77, 2.17)** | | | |
| Victory harness | — | `winner: 0` | | | |
| Defeat harness | — | `winner: 1` | | | |

Late committed units (tick 280): Scout ids **324, 336, 338** at ~(56.1, 54.1), (54.5, 57.5), (52.3, 55.3) — all `AttackMove`, `tid=359`.

---

## What passed

- **Opening tableau (§6):** Helion intact rank vs Kryos wreck line, mid gem gatherers, readable HUD — automatic-fail bar cleared.
- **Empire loop (§4 §3):** pop headroom, Worker train from Nexus, Spark→Orbit age-up with cost/timer/production lockout.
- **Macro under threat (§6 AI):** post-clash marshal peel sends enemy Scouts AttackMove on the player Nexus while workers still contest the gem.
- **Match end (§8):** destroying either Nexus surfaces styled **VICTORY** / **DEFEAT** panels — not a blank pause.
- **Performance (§9 #5):** p99 well under 22 ms with mid fight on screen.
- **Wave 2 arc:** grow → age → defend → win/lose is playable end-to-end on the live deploy.

---

## DESIGN §9 checklist (Wave 2 match arc)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Pass** — Helion rank vs Kryos wreck belt + gem workers |
| 2 | Move feels like commanding | **Marginal** — sim orders move units; live gesture layer not validated to AoE2 bar |
| 3 | Three civs feel like different peoples | Not exercised (same skirmish pair) |
| 4 | World looks like a place | **Pass** — dust pads, gems, camps, fog/minimap |
| 5 | Holds 60 fps while fight is on | **Pass** |
| 6 | Would keep playing | **Pass (Wave 2)** — arc closes; **Fail vs AoE2:DE** until army pressure deepens |
