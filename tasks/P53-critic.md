# P53 — Critic verdict (foot ellipses + combat-only HP bars, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §5.4 #3–4 — HP bars only when selected/damaged/in-combat; selection is a foot ellipse, not a box through the sprite · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p53-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Selection probe:** Playwright on live — tap mid-map Helion Fighter via `__STARHOLD_VIEW__.project()`, screenshot `critic/out/p53-tap-select.png` (gitignored).

**Post-opening probe:** Fast-forward sim to tick ≥ 240 via `__STARHOLD_WORLD__`, nothing selected — count entities matching render `showHp` rule (gitignored screenshot `critic/out/p53-post-opening.png`).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~123) · `critic/out/p53-tap-select.png` (selected Fighter)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P53 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.4.1-wave3` | **Pass** — `0.4.2-wave3` |
| Opening, nothing selected: no HP bar wallpaper | **Pass** — HUD “Nothing selected”; tick 123 still in opening grace (`tick < 240` → bars only on selection); frame shows zero overhead HP chrome on the exchange belt |
| Opening tableau: Helion vs Kryos wrecks + mid gem | **Pass** — green Helion rank on central yellow gem; dark Kryos wreck blocks on the right; bottom-left worker pocket apart from the belt |
| Select a unit: foot ellipse, not a box through sprite | **Pass** — thin flat green ellipse sits on the dust at the Fighter’s feet; no vertical selection rect cutting the hood |
| Select a unit: HP when selected (or damaged) | **Pass** — tapped Fighter at 78/78 shows ally-green HP bar + HUD card; programmatic select matches |
| Combat-only HP after opening grace | **Pass** — at tick 260, nothing selected: **9 / 44** alive ents show bars (7 damaged + 2 combat-only); full-HP idle units stay clean |
| Harness p99 < 22 ms | **Pass** — p99 **3.0 ms**, 0 frames worse than 45 fps in 3 s probe |

Chrome is earned: the opening tableau stays clean, selection reads as a foot ring, and HP bars appear only on the units the bar rules allow — not wallpaper over the whole wreck belt.

---

## Single biggest gap

**The opening grace window (`tick < 240`) suppresses all non-selected HP bars, so the harness screenshot never exercises mid-fight combat-only bars — that behavior only shows after ~4 s of sim or a manual tick advance.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.0** |
| avgFrameMs | 1.42 |
| fps | 703 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.2-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 123 |
| Probe selected (opening) | **0** |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |

---

## Selection probe (tap mid-map Fighter)

| Field | Value |
|---|---|
| Tap target | team-0 Fighter id **323** at (36.7, 36.2) |
| HUD | **Fighter** · HP **78/78** · Atk 10 · Range 3.1 |
| Foot ellipse | green `#48f048` stroke at projected feet |
| HP bar | ally-green fill + 1px outline above sprite (selected, full HP) |

---

## Post-opening HP rule (tick 260, nothing selected)

| Bucket | Count |
|---|---:|
| Entities showing HP bar | **9** |
| Damaged (not selected) | 7 |
| Combat-only (`combatT > 0`, full HP) | 2 |
| Selected | 0 |
| Alive visible (non-resource) | 44 |

---

## What passed

- **Version gate:** deploy ships `0.4.2-wave3`, past the `0.4.1-wave3` stall.
- **No opening wallpaper (§5.4 #3):** unselected opening frame is bar-free; fight reads from sprites and VFX, not green/red ticks over every head.
- **Foot ellipse (§5.4 #4):** selection ring is `ctx.ellipse` at ground projection — not a billboard box through the hood.
- **Selected HP:** selection immediately earns the ally-green bar even at full HP, matching the “selected OR damaged OR in-combat” contract.
- **Combat-only filter:** after opening grace, only damaged or recently-fighting units keep bars; healthy idle ranks stay clean.
- **Tableau preserved:** P41 grammar intact — Helion swarm on mid gem, Kryos wreck belt, separated worker pocket.
- **Performance (§9 #5):** p99 well under 22 ms with overlay HP/selection live.
