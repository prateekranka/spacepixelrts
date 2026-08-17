# Isometric Rewrite — LOCKED PLAN (batch grill result)

Decisions confirmed with user. This is the contract for the rewrite.

## Locked decisions

1. **Projection:** full isometric 3/4 (AoE2-style, ~2:1 iso). Buildings show two sides + roof;
   units are upright depth-sorted sprites.
2. **Sprite facings:** 8-direction (N/NE/E/SE/S/SW/W/NW). Autorun-mirror E/W to halve work:
   ~5 hand-authored facings + mirrored rest.
3. **Sprite resolution:** 48px-tall units, 64×96 building cells. Enough for material-trio +
   emissive detail.
4. **Art generation:** procedural code-drawn at startup (no disk assets). ⚠️ This is the
   highest-risk decision — see note below.
5. **Team color:** ONE emissive glow region (lens/engine/staff orb/trim), tinted to team.
   REPLACE the loud #FF00FF facade banner. This alone fixes the "magenta" complaint.
6. **Terrain:** procedural ELEVATION on every map — mountains + valleys as battle-changers
   (chokepoints, high ground, ramps), not flat plains. Heightmap-driven tiles/cliffs. Iso
   projection makes elevation readable.
7. **HUD:** selection ring + dotted order-path + resource counters (+/min) + territory-blob
   minimap. Defer full production strip if it threatens 60fps.
8. **Sequencing (bones → skin):**
   - **Wave A** — projection (top-down → iso) + terrain elevation + team-color emissive.
   - **Wave B** — 8-dir sprite art (units then buildings) on the new projection.
   - **Wave C** — HUD (ring, path, counters, minimap) + polish.
9. **Done =** a fresh blind Grok-vision critic vs AoE2:DE on the running build says "name units
   by silhouette + factions at a glance + reads as an isometric place", AND user visually
   signs off (not just critic PASS).

## The flag on #4 (procedural code-drawn)

Hand-drawing 8-dir isometric pixel characters in code at AoE2 fidelity is the single hardest,
riskiest item and previously failed 3 rounds at a lower bar. AoE2 sprites are artist-authored.
The plan keeps procedural code-drawn as decided, but if Wave B stalls, the fallback is
AI-generated sprite data committed once (bundled, not runtime disk-load). Flag immediately if
Wave B loops without converging.

## Reference anchors (references/ folder)

Starhaven concept sheets: `067B6054` (magitech unit, 8-dir walk, emissive cyan, material trio),
`DCFA6AB0` (HD-2D unit, colored outline, one saturated accent = team color), `1DDA6E91` +
`B0F72E79` (unit-evolution "age = material change" rosters), `44D4BCEE`/`B0592688`/`C6F98685`
(isometric maps: quiet terrain + bright POI lamps, territory-blob minimap, dotted order path).
Plus `widelands.png` (RTS logistics) and the terrain-*.jpg (elevation banding).

## Scope guardrail (locked)

**PRESERVE game design, rewrite ONLY the look.** Win condition, 3 civs, 3 resources, building/
unit roster, mechanics, and all critic-passed gameplay (Waves 2-5) stay untouched. This is a
pure visual/projection rewrite. Do not drift into redesigning economies/units/tech — if a
builder is tempted, it is out of scope and should stop.
