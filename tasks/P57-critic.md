# P57 — Critic verdict (combat hit SFX, live)

**Critic:** fresh blind run · **Bar:** combat is not silent — hit callback fires during the opening exchange · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p57-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Hit-SFX probe:** Playwright on live — sample `window.__STARHOLD__.hitSfx` at 0–3 s during the opening clash (no audio path in headless Chrome).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~120)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P57 — **Pass**

| Criterion | Result |
|---|---|
| Probe version not stuck at `0.4.4-wave3` | **Pass** — `0.4.5-wave3` |
| Opening tableau: Helion vs Kryos wrecks + mid gem | **Pass** — green Helion rank on central yellow gem; dark Kryos wreck blocks on the right; bottom-left worker pocket apart from the belt |
| `hitSfx` increases during opening clash | **Pass** — **9 → 50** over 3 s (monotonic; **52** at harness tick 120) |
| Harness p99 < 22 ms | **Pass** — p99 **3.1 ms**, 0 frames worse than 45 fps in 3 s probe |

Combat is wired: `world.onHit` drives `Sfx.hit()` and the probe counter climbs from the first frame of the opening exchange — hits are not silent at the callback layer.

---

## Single biggest gap

**Headless Playwright cannot hear audio — only the `hitSfx` invocation counter proves wiring; audible mix/level was not verified in this run.**

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.1** |
| avgFrameMs | 1.44 |
| fps | 692 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.4.5-wave3` |
| Probe ents | 66 |
| Probe tick (opening harness) | 120 |
| Probe hitSfx (opening harness) | **52** |
| Probe selected (opening) | **0** |
| Probe winner (opening) | **-1** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 69 |
| nonBlackPixelShare | 93.32% |
| distinctQuantizedColors | 355 |

---

## Hit-SFX probe (opening clash, live)

| wait (s) | tick | hitSfx | ents |
|---:|---:|---:|---:|
| 0 | 9 | **9** | 74 |
| 0.5 | 19 | **16** | 74 |
| 1.0 | 29 | **26** | 74 |
| 1.5 | 39 | **31** | 74 |
| 2.0 | 50 | **40** | 73 |
| 2.5 | 60 | **45** | 72 |
| 3.0 | 70 | **50** | 71 |

Counter rises every sample — hit callbacks fire continuously through the opening Helion–Kryos exchange.

---

## What passed

- **Version gate:** deploy ships `0.4.5-wave3`, past the `0.4.4-wave3` stall.
- **Hit wiring:** `hitSfx` climbs from 9 on first tick to 50+ within 3 s; harness snapshot shows **52** at tick 120.
- **Tableau preserved:** P41/P56 grammar intact — Helion swarm on mid gem, Kryos wreck belt, separated worker pocket; palette metrics match prior live critics (avg luminance 69, 93.3% non-black).
- **Performance:** p99 well under 22 ms; zero frames worse than 45 fps in the 3 s probe.
