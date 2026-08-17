# P91 — Critic verdict (quiet the ground)

**Critic:** fresh Grok-vision · **Bar:** AoE2:DE — the ground recedes so units/buildings read · **Judged:** 2026-08-17

**Screenshot reviewed:** `critic/out/p91-orch.png` (orchestrator live capture, 1180×820). Ground-only; buildings-as-places and unit roster are out of scope.

---

## P91 — **PASS**

The playable floor is a calm mauve dust field. Sprites are no longer fighting a purple-and-white stamp. Green infantry, black hall silhouettes, the gold mid gem, and cyan crystal all have readable edges. This is the AoE2 recede: the dirt shuts up so the army can be counted.

| Criterion | Result |
|---|---|
| 1. Calm, low-contrast dust (near-flat base + subtle large-scale value variation) | **Pass** — empty playfield is ~95% `#63566a` / `#64566a` (luma **89–90**). Empty-patch luma std **0.6–1.0**. A faint 1–4 luma wash (a few scanlines at the top of the field, plus discrete darker rock blobs) is the large-scale variation; it does not sparkle. |
| 2. No purple-and-white zigzag / checker / repeating stamp | **Pass** — empty ground is two adjacent mauve tones, not a high-frequency tile. Checker 2×2 delta is noise. Sparse `#c0b7d2` motes are isolated specks (playfield handful), not a fighting grid. |
| 3. Small units and dark building silhouettes pop | **Pass** — dark hall/outline luma **~5** vs dust **~89** (edge delta **~79**). Green unit pixels vs adjacent dust **~65** luma. Lime plates, muzzle flashes, and black ink outlines read cleanly; nothing in the dirt competes with sprite edges. |
| 4. Rock / gem still distinguishable from dust (not a flat void) | **Pass** — darker rock blobs luma **~58** (`#403744`) vs dust **89**; gold gem/ore **~173–225** (`#deab30` / `#ffdf9d`); cyan crystal **~111–154**. Pads, gem, and rocks remain separate objects, not melted into the fill. |

---

## Single biggest gap

**None blocking P91.** The zigzag that drowned the sprites is gone; the floor recedes.

**Marginal (not scored here):** open dust is *very* quiet — almost a solid fill at RTS zoom (quantized unique ground colors collapse to one dominant `#605060` bin at **94.8%**). That is the point of this piece. Place-ness now lives in rock blobs and resource nodes, not in terrain noise. Buildings-as-places and unit character are P92/P93.

---

## Pixel notes (playfield x 180–1160, y 70–640)

| Metric | Value |
|---|---|
| Dust fraction | **83–86%** of playfield |
| Dominant dust | `#63566a` / `#64566a` (luma 89.4 / 90.2) |
| Ground luma mean / std | **89.1** / **5.2** (std is rocks + rims, not sparkle; empty patches std **<1**) |
| Ground strong-edge >8 | **0.86%** (sprite/rock rims, not a stamp) |
| Dark-vs-dust edge Δ luma | **~79** |
| Unit-vs-dust \|Δ luma\| | **~65** |
