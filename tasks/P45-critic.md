# P45 — Critic verdict (win/lose banners + clickable HUD, live)

**Critic:** fresh blind run · **Bar:** `docs/DESIGN.md` §8 and §9 — scope is **match end is readable**, not the opening tableau bar · **Judged:** 2026-08-16

**Harness (live):** `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p45-critic.png --fps-seconds 3 --wait 3`

**Screenshots reviewed:** `critic/out/p45-critic.png` (fresh-load opening, tick ~121) · `critic/out/p45-victory.png` (enemy Nexus killed) · `critic/out/p45-defeat.png` (player Nexus killed)

**Preview URL:** `https://spacepixelrts.pages.dev`

---

## P45 — **Pass**

| Criterion | Result |
|---|---|
| Probe version ≠ `0.3.1-wave2` | **Pass** — `0.3.2-wave2` |
| `winner` present on probe | **Pass** — `-1` at open |
| Fresh load `winner === -1` | **Pass** |
| HUD **Idle worker** click — button stays in DOM | **Pass** — same node after click + rAF |
| Hall selected → **Worker** train click — button stays in DOM | **Pass** — same node after click + rAF |
| Kill enemy Hall → `winner === 0` | **Pass** — via `__STARHOLD_WORLD__.kill()` + step |
| **VICTORY** banner visible (not blank pause) | **Pass** — green-bordered panel, title **VICTORY**, sub **Enemy Nexus shattered** |
| Fresh load → kill player Hall → `winner === 1` | **Pass** |
| **DEFEAT** banner visible | **Pass** — red-bordered panel, title **DEFEAT**, sub **Your Nexus is ash** |
| Opening tableau not regressed | **Pass** — **8** Helion fighters, Kryos wreck belt (0 living at tick ~121), mid gem, **3** mid workers |
| Harness frame time | **Pass** — p99 **6.1 ms**, 0 frames worse than 45 fps in 3 s probe |

Destroying the enemy Nexus surfaces a readable **VICTORY** banner instead of a silent pause; losing your own Nexus shows **DEFEAT**. Command-bar buttons no longer detach every frame — **Idle worker** and Hall **Worker** train survive click + rAF on the live HUD. The P41 opening tableau (Helion rank above, Kryos wreck line below, gold gem in the gap) is intact on fresh load.

---

## Single biggest gap

None blocking P45 — marginal note only: Kryos wreck count drifts from the scripted **5** to **8** as the mid fight plays during the 3 s harness wait; the tableau still reads Helion intact vs Kryos shattered + mid gem.

---

## Harness (live)

| Field | Value |
|---|---|
| URL | `https://spacepixelrts.pages.dev` |
| p99FrameMs | **6.1** |
| avgFrameMs | 1.49 |
| fps | 672 (uncapped probe) |
| framesWorseThan45fps | 0 |
| Probe version | `0.3.2-wave2` |
| Probe ents | 66 |
| Probe tick (opening) | 121 |
| Probe winner (opening) | **-1** |
| Civ | vespari vs aurion |
| Victory UI | `winner: 0`, `#match-end.win`, title **VICTORY** |
| Defeat UI | `winner: 1`, `#match-end.lose`, title **DEFEAT** |
| HUD DOM stability | `#idlew` sameNode · `#cmds [data-cmd=train-0]` sameNode |
| Opening tableau (tick ~121) | helion 8 · kryos living 0 · wrecks 8 · mid gem · workers 3 |
| Console issues | none |

---

## What passed

- **Probe gate:** version bumped past `0.3.1-wave2`; `winner` field exposed on `__STARHOLD__`.
- **Match-end readability (§8):** `#match-end` panel unhides with styled **VICTORY** / **DEFEAT** titles and Nexus-shattered copy — not a blank pause overlay.
- **Clickable HUD:** top-bar **Idle worker** and Hall **Worker** train tile remain attached across click; P44's detach-every-frame regression is fixed.
- **Win detection:** killing team-1 Hall via harness sets `winner === 0`; killing team-0 Hall sets `winner === 1`.
- **Tableau carry-over:** fresh-load camera still shows Helion green rank, Kryos wreck belt, and central gem between the wings.
- **Performance:** p99 well under 22 ms during probe.

---

## DESIGN §9 checklist (match-end slice)

| # | Bar | Verdict |
|---|---|---|
| 1 | Who is winning the mid fight in 1s | **Pass** (carry-over P41 — Helion rank vs Kryos wreck belt) |
| 2 | Move feels like commanding | Not exercised |
| 3 | Three civs feel like different peoples | Not exercised (same skirmish pair) |
| 4 | World looks like a place | **Pass** (carry-over P41 tableau) |
| 5 | Holds 60 fps while fight is on | **Pass** |
| 6 | Would keep playing | **Pass** — match outcome is legible; I can still reach command buttons |
