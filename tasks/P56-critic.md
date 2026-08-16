# P56 — Critic verdict (formation spread, live)

**Critic:** fresh blind run · **Bar:** multi-unit Move does not collapse to one pile · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p56-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Formation probe:** Playwright on live — advance `__STARHOLD_WORLD__` to tick ≥ 300, select **6** team-0 Fighters, `issue(Ord.Move)` to (30, 42), step **120** ticks (~3 s), measure pairwise world distances + unique `(tx, tz)` offsets; screenshot `critic/out/p56-formation.png` (gitignored).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~119) · `critic/out/p56-formation.png` (post-move, 6 selected)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P56 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.4.3-wave3` | **Pass** — `0.4.4-wave3` |
| Opening tableau: Helion vs Kryos wrecks + mid gem | **Pass** — green Helion rank on central yellow gem; dark Kryos wreck blocks on the right; bottom-left worker pocket apart from the belt |
| Post-opening (`tick ≥ 300`): select 4+ player Fighters, `issue(Move)` | **Pass** — **6** Helion Fighters at tick **300** |
| Unique spread destinations at issue | **Pass** — **6 / 6** distinct `(tx, tz)` (hex offsets ~0.7–1.1 tile spacing) |
| After ~3 s: not stacked | **Pass** — **15 / 15** pairwise distances **> 0.5**; min pairwise **0.64** |
| Harness p99 < 22 ms | **Pass** — opening p99 **3.0 ms**; post-probe live p99 **18.5 ms**, 0 frames worse than 45 fps |

Multi-unit Move now assigns a formation grid instead of one tile — the group walks as separate sprites, not a single pile.

---

## Single biggest gap

**Three fighters retarget to `Attack` mid-march once combat resumes, so the live screenshot reads as one tight chase cluster plus a straggler rather than a clean symmetric hex at the click point.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.0** |
| avgFrameMs | 1.43 |
| fps | 701 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.4-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 119 |
| Probe selected (opening) | **0** |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Formation probe (tick ≥ 300, `issue(Move)`)

| Field | Value |
|---|---|
| Tick at issue | **300** |
| Tick after 3 s sim | **420** |
| Fighters ordered | **6** (ids 323, 325, 327, 329, 331, 333) |
| Move click | **(30, 42)** |
| Unique destinations at issue | **6** |
| Pairwise distances > 0.5 | **15 / 15** |
| Min pairwise distance | **0.640** |
| Post-probe p99FrameMs | **18.5** |

### Issue-time destinations (spread offsets)

| Fighter id | `tx` | `tz` |
|---:|---:|---:|
| 323 | 29.168 | 41.640 |
| 325 | 30.000 | 41.640 |
| 327 | 30.832 | 41.640 |
| 329 | 29.584 | 42.360 |
| 331 | 30.416 | 42.360 |
| 333 | 31.248 | 42.360 |

---

## What passed

- **Version gate:** deploy ships `0.4.4-wave3`, past the `0.4.3-wave3` stall.
- **Formation spread:** `issue(Move)` on 6 units assigns distinct hex-ish slots; no shared destination tile.
- **Spatial read:** after 3 s all pairwise separations exceed 0.5 tiles — group is not a stack.
- **Tableau preserved:** P41 grammar intact on fresh load — Helion swarm on mid gem, Kryos wreck belt, separated worker pocket.
- **Performance (§9 #5):** opening and post-move probes stay under 22 ms p99.
