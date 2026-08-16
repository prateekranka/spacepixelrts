# P44 — Critic verdict (Spark → Orbit age-up, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §4 and §9 — scope is **can you age up** from Spark (not re-judging the opening tableau bar) · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p44-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/latest.png` (opening tableau, tick ~121) · `critic/out/p44-opening.png` (fresh-load opening confirm, tick ~67) · `critic/out/p44-critic.png` (post age-up, Yard selected)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P44 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≠ `0.3.0-wave2` | **Pass** — `0.3.1-wave2` |
| `teams[0].epoch` present at open | **Pass** — `epoch: 0`, `ageT: 0` |
| Fresh load at Spark (`epoch === 0`) | **Pass** |
| Hall command deck offers **Spark → Orbit** Age Up | **Pass** — button present; disabled until 400 ore / 80 chg (220/90 at open) |
| Yard Fighter train locked at Spark | **Pass** — `train-2` disabled, sub **Orbit** |
| Age Up spends 400 ore + 80 chg | **Pass** — ore **500 → 100**, chg **200 → 120** after `tryAgeUp(0)` |
| Hall cannot train Worker while aging | **Pass** — `tryTrain(Worker)` returns false; Worker button disabled with `ageT: 40` |
| Age completes → `epoch === 1` | **Pass** — fast-forward `ageT` → **epoch 1**, `ageT: 0` |
| Yard Fighter train enabled at Orbit | **Pass** — `train-2` enabled, sub **60 ore** |
| Wave 1 tableau not regressed (opening camera) | **Pass** — fresh load: **8** Helion fighters, **5** Kryos wreck props, mid gem, **3** mid workers; matches P41 (green rank above, Kryos wreck belt below, gold diamond in gap) |
| Harness frame time | **Pass** — p99 **9 ms**, 0 frames worse than 45 fps in 3 s probe |

From Spark I can select the Nexus, see the age-up research tile, pay the DESIGN §4 cost, block Worker production during the timer, land in Orbit, and queue Fighters from the Yard — the epoch loop works. The mid fight tableau on a fresh load is unchanged from P41.

---

## Single biggest gap

None blocking P44 — marginal note only: the Age Up button re-renders every frame (HUD detach), so automated Playwright **clicks** time out; the live HUD path works when invoked via the same `tryAgeUp` the button calls.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **9** |
| avgFrameMs | 2.65 |
| fps | 378 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.1-wave2` |
| Probe ents | 66 |
| Probe tick (opening) | 121 |
| Teams epoch (open) | **0** / 0 |
| Teams resources (open) | ore 220 · chg 90 |
| Civ | vespari vs aurion |
| Age-up delta | ore 500→100, chg 200→120, ageT 40→0, epoch 0→1 |
| Opening tableau (fresh tick ~67) | helion 8 · kryos living 0 · wrecks 5 · mid gem · workers 3 |
| Console issues | none |

---

## What passed

- **Epoch field:** probe exposes `teams[0].epoch` and `ageT` — not stuck on wave-2 build without ages.
- **Spark gates:** Yard Fighter shows **Orbit** lock at epoch 0; Hall Age Up shows **400 ore · 80 chg** and respects insufficient stock at open.
- **Age-up transaction:** Pays DESIGN §4 Spark→Orbit cost (400 ore, 80 Charge); starts 40s timer (`ageT: 40`).
- **Nexus block during aging:** Hall Worker train disabled; `tryTrain` rejected while `ageT > 0` (§4: Nexus cannot train while aging).
- **Orbit unlock:** After timer, `epoch === 1`; Yard Fighter train enabled at 60 ore.
- **Wave 1 preserved:** Opening camera still reads Helion intact rank vs Kryos wreck belt + mid gem + gatherers — P41 tableau intact on fresh load.
- **Performance:** p99 well under 22 ms during probe.

---

## DESIGN §9 checklist (age-up slice)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Pass** (carry-over P41 — not regressed on fresh open) |
| 2 | Move feels like commanding | Not exercised |
| 3 | Three civs feel like different peoples | Not exercised (same skirmish pair) |
| 4 | World looks like a place | **Pass** (carry-over P41 tableau) |
| 5 | Holds 60 fps while fight is on | **Pass** |
| 6 | Would keep playing | **Pass** — I can age to Orbit and unlock Fighters; empire progression opens |
