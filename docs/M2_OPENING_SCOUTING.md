# M2 — Opening and scout-driven discovery

Status: **ACTIVE MILESTONE CONTRACT**

Read after `DIRECTIVE.md`, `docs/CANONICAL_VOCABULARY.md`, and `docs/FIRST_PLAYABLE.md`.

## Player outcome

The first three minutes begin as a real skirmish, not a staged battle:

1. One Core, four workers, and one scout per side.
2. Safe nearby resources and unexplored surroundings.
3. Player selects the scout and sends it through fog.
4. Exploration reveals resources, routes, expansions, a neutral technology relic, enemy structures,
   and the central Lumen objective.
5. Undiscovered data is absent from world view, input targeting, and minimap.
6. Contextual prompts teach through action.
7. The AI scouts under the same fog rules and does not know hidden targets.

## Production versus QA

- Production `World.reset` uses only the six-entity opening for each side.
- The old art-review clash, forward camps, forced corpses, and forced center vision are removed from
  production.
- `?qa=battle` can remain an honest scaffold until the combat milestone supplies a dedicated fixture.
  Do not preserve the old tableau by leaking it into normal play.

## Atomic sequence

### M2-A — scout and fog foundation

- Exact six-entity opening, safe resource nodes, honest fog, base-first camera, touch long-press move.
- Commit: `feat: complete scout-driven fog exploration loop`

### M2-B — persistent discovery

- Add entity discovery latches and deterministic Helios Rift landmark records.
- Hide resources/objective/relic/expansions/minimap markers until discovery; remember valid discovered
  map data after current LOS closes.
- Commit: `feat: hide undiscovered resources and objectives`

### M2-C — contextual opening guidance

- Non-modal prompt sequence: Select your scout -> Explore the nearby signal -> A shared Lumen field
  has been discovered -> The enemy may contest this location.
- Prompts react to real selection/discovery state and never block input.
- Commit: `feat: add contextual opening guidance`

### M2-D — imperfect AI knowledge

- Deterministic frontier scouting from `explored[1]` only.
- Resource retargeting uses AI-explored nodes only.
- Enemy Core/attack targets are latched only after AI vision; no global entity scan for hidden targets.
- Commit: `feat: give AI imperfect scouting knowledge`

## Discovery model

- `visible[team]`: current LOS.
- `explored[team]`: persistent terrain memory.
- Entity `seenBy` bit mask: player bit 1, AI bit 2; set only when that team currently sees the entity.
- Helios landmark record: stable id, kind, label, world x/z, `discoveredBy` bit mask.
- First-slice landmark kinds: expansion, relic, safe-route, danger-route, central-objective.
- Existing Central Lumen resource art is the visible objective. Existing wreck prop art is the neutral
  technology relic. No new asset sheet is required.

## Touch contract

- Tap selects.
- Drag box-selects.
- Two fingers pan/pinch.
- Right-click/Shift-click keeps desktop order behavior.
- A stationary single-finger long press of at least 450 ms issues a Move order for the current
  selection. Movement beyond the drag threshold cancels the long press.
- Radial commands remain M6 scope.

## Objective gates

- Fixed seed `0x5eed`.
- 1366 × 1024 and both landscape safe-area labels.
- Browser errors 0.
- p99 game work < 8 ms.
- Full M0/M1 regression stays green.
- Three independent DeepSeek critiques after M2-D; critic judges only visible fog readability,
  discovery clarity, touch-target clarity, normal-view silhouettes, and UI density.

## Non-goals

No technology choice, asymmetric economy rewrite, roster expansion, combat rebalance, radial menu,
formation logic, campaign, multiplayer, or new map.
