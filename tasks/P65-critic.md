# P65 — Critic verdict (iPad HUD safe-area, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §7.2 — landscape iPad home indicator / notch must not cover command tiles or resource numerals; desktop critic layout must stay the opening tableau · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p65-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**P64 probes:** `node scripts/p64-probe.mjs --url https://spacepixelrts.pages.dev` (gitignored JSON `critic/out/p64-probe.json`).

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~119)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P64 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.5.3-wave4` | **Pass** — `0.5.3-wave4` |
| Opening tableau — Helion rank vs Kryos wrecks | **Pass** — green Helion rank center-right; dark Kryos wreck belt; mid gem clash; worker pocket bottom-left; `hitSfx` **50** |
| Harness p99 < 22 ms | **Pass** — p99 **3.2 ms**, 0 frames worse than 45 fps |
| Desktop `#bottom` height ~168 px (insets 0) | **Pass** — `#bottom` **168 px**; resource bar flush at top |
| HUD CSS includes `safe-area-inset` | **Pass** — stylesheet rules reference `safe-area-inset` (`hudUsesSafeArea: true`) |
| Mocked `env(safe-area-inset-bottom)` 34 px — verbs above home bar | **Pass** — max verb `bottom` **701** ≤ `innerHeight − inset` (**786**); clearance **85 px** |
| `viewport-fit=cover` meta | **Pass** — present on deploy |
| Screenshot — desktop opening unchanged | **Pass** — command deck, minimap, and numerals match prior critic layout |

Landscape iPad safe-area padding lifts the command bar and top resource strip without regressing the desktop opening tableau.

---

## Single biggest gap

**None blocking ship** — mocked 34 px home-indicator inset leaves **85 px** clearance above command verbs; desktop `#bottom` stays **168 px** with zero insets.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **3.2** |
| avgFrameMs | 1.45 |
| fps | 690 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.5.3-wave4` |
| Probe ents | 66 |
| Probe tick (opening harness) | 119 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.calls` | 6 |
| Probe `rendererInfo.tris` | 452 |
| Probe hitSfx (opening harness) | **52** |
| Probe selected (opening) | **0** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 70 |
| nonBlackPixelShare | 93.21% |
| distinctQuantizedColors | 348 |

---

## P64 safe-area probes

| Probe | Result |
|---|---|
| Critic viewport (1180×820, inset 0) | Helion Fighters **8** · Kryos Fighters **5** · `#bottom` **168 px** · `hudUsesSafeArea` **true** · p99 **3.1 ms** |
| iPad landscape + mocked inset 34 px | `#bottom` height **202 px** · `padding-bottom` **44 px** · max verb bottom **701** · clearance above home bar **85 px** |

---

## What passed

- **Version gate:** deploy ships `0.5.3-wave4`.
- **§7.2 safe-area:** HUD styles use `safe-area-inset`; `viewport-fit=cover` set; command verbs clear mocked home indicator.
- **Desktop critic unchanged:** `#bottom` **168 px** with zero insets; opening Helion rank vs Kryos wreck tableau intact.
- **Performance:** p99 **3.2 ms** with HUD, clash, and sparks live.
