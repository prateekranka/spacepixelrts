# P46 — Critic verdict (enemy marshal Nexus pressure, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §6 §9 — after the opening shot, the enemy must threaten your Nexus so macro has stakes · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p46-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/p46-critic.png` (fresh-load opening, tick ~119)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P46 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≠ `0.3.2-wave2` | **Pass** — `0.3.3-wave2` |
| Fresh early tick: Helion rank vs Kryos wrecks, no peel yet | **Pass** — tick **91**: Helion **9** living clash units, Kryos **0** living / **8** wrecks, **3** mid-gem workers; **0** enemy AttackMove on player Hall |
| Tick ≥ 280: ≥ 3 living enemy military committed on player Nexus | **Pass** — tick **296**: **3** enemy Scouts, `order=AttackMove`, `tid` = player Hall **359** at ~(10.5, 10.5); marching SW from NE base |
| Fresh-load opening still P41-like | **Pass** — tick **151** reload: Helion **9**, Kryos wrecks **8**, mid workers **3**, peel still off |
| Harness frame time | **Pass** — p99 **2.8 ms**, 0 frames worse than 45 fps in 3 s probe |

After the tableau holds through tick ~240, the enemy marshal peels: by tick 296 three Scouts are AttackMove-committed on the player Nexus while mid workers still boom on the gem. Opening tableau is unchanged from P41 — intact green Helion wing, shattered Kryos wreck line, contested gem between them. Macro now has a clock: scouts are inbound from ~(50–54, 52–56) toward your Hall at ~(10, 10).

---

## Single biggest gap

None blocking P46 — marginal note only: pressure is **three Scouts** at tick 296, not a six-fighter wave; threat reads on the minimap and probe but is still light until tick ~400 when five scouts are en route and two have crossed mid-map.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **2.8** |
| avgFrameMs | 1.35 |
| fps | 743 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.3-wave2` |
| Probe ents | 66 |
| Probe tick (opening harness) | 119 |
| Probe winner (opening) | **-1** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Playwright probes (live)

| Probe | Tick | Helion living | Kryos living | Kryos wrecks | Mid workers | Enemy committed on Hall |
|---|---:|---:|---:|---:|---:|---:|
| Early (pre-peel) | 91 | 9 | 0 | 8 | 3 | 0 |
| Late (≥ 280) | 296 | 9 | 0 | 6 | 3 | **3** Scouts AttackMove → Hall 359 |
| Fresh reload | 151 | 9 | 0 | 8 | 3 | 0 |
| Extended (sanity) | 400 | — | — | — | — | **5** Scouts AttackMove → Hall |

Late committed units (tick 296): Scout ids **324, 336, 338** at ~(54.3, 52.3), (52.7, 55.7), (50.5, 53.5) — all `AttackMove`, `tid=359`.

---

## What passed

- **Version gate:** live bumped to `0.3.3-wave2` (not stale `0.3.2-wave2`).
- **Opening preserved (§6):** Helion intact rank + Kryos wreck belt + mid gem workers; peel inactive before tick 240.
- **Nexus pressure (§6 AI):** marshal peel staggers enemy military onto player Hall via AttackMove after opening clash ends.
- **Macro stakes (§9):** while workers still gather the contested gem, enemy scouts are marching on your Nexus — I would boom faster or wall, not ignore the clock.
- **Performance:** p99 well under 22 ms during harness.

---

## DESIGN §9 checklist (Nexus-pressure slice)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Pass** (carry-over P41 — Helion rank vs Kryos wreck belt) |
| 2 | Move feels like commanding | Not exercised |
| 3 | Three civs feel like different peoples | Not exercised (same skirmish pair) |
| 4 | World looks like a place | **Pass** (carry-over P41 tableau) |
| 5 | Holds 60 fps while fight is on | **Pass** |
| 6 | Would keep playing | **Pass** — opening wow intact and macro now has inbound Nexus pressure |
