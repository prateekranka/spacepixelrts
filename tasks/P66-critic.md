# P66 — Critic verdict (Wave 4 wrap — 60 fps / iPad / hardening, live)

**Critic:** fresh blind run · **Bar:** `docs/ARCHITECTURE.md` §8, `docs/DESIGN.md` §7.2 §9 #5 — landscape iPad command deck, 60 fps while the fight is on, no marshal-quit bugs · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p66-critic.png --fps-seconds 3 --wait 3`  
(`npm run critic` prepends `--screenshot critic/out/latest.png`; that file is the authoritative opening capture. Gitignored.)

**Probes (live):** `node scripts/p60-probe.mjs`, `p62-probe.mjs`, `p64-probe.mjs` — gitignored JSON under `critic/out/`.

**Screenshot reviewed:** `critic/out/latest.png` (harness opening, tick ~174)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## Wave 4 — **Pass (locked)**

| Criterion | Result |
|---|---|
| Probe version ≥ `0.5.3-wave4` | **Pass** — `0.5.3-wave4` |
| Opening tableau — Helion rank vs Kryos wrecks + mid gem | **Pass** — green Helion rank center-right on golden mid gem; dark Kryos wreck belt screen-right; worker pocket bottom-left; **2** sparks at p60 sample |
| No HP wallpaper at opening | **Pass** — damaged units in clash suppress bars; only selected Fighter HP in command deck |
| Harness p99 < 22 ms | **Pass** — p99 **9.2 ms**, 0 frames worse than 45 fps |
| Viewport cull — off-screen horde | **Pass** — 180 spawned @ NW: `drawn` **41 → 32** (Δ −9); **246** alive, uploads flat |
| Viewport cull — on-screen horde | **Pass** — 180 @ look-at: `drawn` **46 → 218** (Δ +172) |
| Attack-lock peel — ground right-click → Move | **Pass** — tick **60**: `order` **Move** (`pass: true`) |
| Attack-lock peel — hull right-click → Attack | **Pass** — tick **62**: `order` **Attack**, `tid` matches hull (`pass: true`) |
| Clash holds Attack without input (tick < 240) | **Pass** — **8/8** Helion Fighters on Attack at tick **69** |
| HUD safe-area — CSS `safe-area-inset` | **Pass** — `hudUsesSafeArea: true` |
| Desktop `#bottom` ~168 px (inset 0) | **Pass** — **168 px** |
| iPad mock inset 34 px — verbs above home bar | **Pass** — max verb bottom **701**, clearance **85 px** |
| Screenshot — landscape iPad command, not tech demo | **Pass** — readable rank/gem/wrecks, full command deck + minimap, touch hints; would keep commanding |

Wave 4 hardening holds on live: frame budget, viewport cull, attack-lock peel, and iPad safe-area all pass together without regressing the opening tableau.

---

## Single biggest gap

**None blocking Wave 4** — performance, cull, peel, and HUD safe-area all meet bar on `0.5.3-wave4`.

**Deferred to Wave 5 (not scored here):** third civ (Nihiline) not on screen; surviving Kryos clash fighters can drift Idle late in the opening window while Helion holds Attack; off-screen hordes still inflate sim entity/spatial-hash work even when `drawn` stays flat; master-palette quantization still loose (~315 distinct quantized colors in harness histogram).

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **9.2** |
| avgFrameMs | 2.82 |
| fps | 355 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.5.3-wave4` |
| Probe ents | 66 |
| Probe tick (opening harness) | 174 |
| Probe `rendererInfo.drawn` | **32** |
| Probe `rendererInfo.calls` | 6 |
| Probe `rendererInfo.tris` | 452 |
| Probe hitSfx (opening harness) | **52** |
| Probe selected (opening) | **0** |
| Teams pop (player / enemy) | **22/30** · **9/30** |
| Civ | vespari vs aurion |
| Console issues | none |
| avgLuminance | 68 |
| nonBlackPixelShare | 92.09% |
| distinctQuantizedColors | 315 |

---

## P60 viewport-cull probe

| Probe | opening `drawn` | after horde `drawn` | Δ | Pass |
|---|---:|---:|---:|---|
| Opening tableau | **41** | — | — | sparks + `drawn` > 20 |
| Off-screen @ `(4,4)` | **41** | **32** | **−9** | flat |
| On-screen @ look-at `(36, 37.44)` | **46** | **218** | **+172** | rises |

| Probe | p99FrameMs | framesWorseThan45fps |
|---|---:|---:|
| Opening | **6.6** | 0 |
| Off-screen + sim step | **17.5** | 5 |
| On-screen + sim step | **4.3** | 0 |

---

## P62 attack-lock peel probe

| Probe | tick | Result |
|---|---:|---|
| Opening sample | 60 | Helion Fighters **8** · Kryos Fighters **6** · sparks **2** |
| Ground right-click (empty, behind rank) | 60 | `order` **Move** (`pass: true`) |
| Hull right-click (Kryos sprite) | 62 | `order` **Attack** · `tid` matches hull (`pass: true`) |

---

## P64 HUD safe-area probe

| Probe | Result |
|---|---|
| Critic viewport (1180×820, inset 0) | `#bottom` **168 px** · `hudUsesSafeArea` **true** · p99 **6.2 ms** |
| iPad landscape + mocked inset 34 px | `#bottom` **202 px** · `padding-bottom` **44 px** · max verb bottom **701** · clearance **85 px** |

---

## What passed

- **Version gate:** deploy ships `0.5.3-wave4`.
- **§8 frame budget:** opening p99 **9.2 ms**; on-screen horde p99 **4.3 ms**; off-screen horde p99 **17.5 ms** (under 22 ms bar).
- **Viewport cull:** off-screen fighters do not inflate `drawn`; on-screen spawns raise it **+172**.
- **§7.3 peel:** ground Move, hull Attack, clash Attack-lock without marshal input.
- **§7.2 safe-area:** `safe-area-inset` in HUD CSS; mocked home indicator clears command verbs.
- **§9 #5 / #6:** holds 60 fps with fight on; screenshot reads as a game you'd keep playing, not a demo you'd bounce off.
