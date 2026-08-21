# M2-B — Persistent discovery and hidden map data

Status: **ACTIVE IMPLEMENTATION CONTRACT**

Read `docs/M2_OPENING_SCOUTING.md` first.

## Goal

Undiscovered resources, enemy structures, relics, expansions, routes, and the Central Lumen objective
must not exist in the player's usable map knowledge. Scout LOS earns persistent discovery.

## Entity discovery

Add `seenBy: number` to `Ent` and reset it on every spawn. Bit 1 is player team 0; bit 2 is AI team
1.

When a team currently sees an entity tile for the first time:

- set its bit once;
- append one deterministic discovery event;
- call an optional discovery callback;
- never clear the bit.

Rules:

- Own entities remain visible.
- Enemy units require current LOS and are not remembered as live targets.
- Enemy structures can remain remembered on the minimap after leaving LOS, but are not interactable as
  a live combat target without current LOS.
- Neutral resource nodes are absent until first sight, then remain visible through explored fog and on
  the minimap as remembered map data.
- Fog-off matches mark all entities and landmarks discovered for both teams.

## Helios Rift landmarks

Create `src/discovery.ts` with deterministic records:

- `central-lumen-field` — `central-objective`, around `OPENING_CENTER`;
- `neutral-tech-relic` — `relic`, at the existing central wreck field;
- mirrored player/rival expansion pads — `expansion`;
- one `safe-route` marker;
- one `danger-route` marker.

Each record has stable id, kind, label, x/z, and `discoveredBy` bit mask. Discovery occurs only when its
tile is currently visible to that team.

The existing central Solar/Lumen resource art is the visible objective. Existing wreck prop art is the
relic. Add no new asset.

## Public state

World exposes read-only-to-consumers arrays:

- `landmarks`;
- `discoveryLog` with team, tick, id, kind, label, x/z;
- optional `onDiscover(event)` callback.

The QA probe exposes cloned discovery and landmark snapshots. It exposes no setter.

## Rendering and minimap

- Renderer keeps persistent discovered neutral resources visible beneath explored fog.
- Undiscovered nodes do not draw.
- Minimap draws resource/objective/relic/remembered enemy-structure markers only after the player
  discovery bit is set.
- Current enemy units still require current `vis`.
- Strengthen the far-zoom fog distinction: explored fog remains readable; unexplored space is visibly
  darker. Do not add a hard neon border.

## Input

- Resource targeting follows entity visibility/seen state.
- Undiscovered nodes cannot be selected or assigned.
- Discovered resource nodes can be ordered to from remembered explored territory.
- No change to attack target rules.

## Deterministic tests

Add `tests/m2-discovery.test.ts` and include it in `test:m2`.

At seed `0x5eed` with fog on:

1. Central objective resource, rival Core, relic, and central landmarks start undiscovered.
2. Safe base resources start discovered for their nearby team only.
3. Move/teleport the player scout into LOS and step: entity/landmark bits set once and log once.
4. Move scout away and step: resource knowledge persists; enemy unit current visibility does not.
5. Fog off marks all records discovered.
6. Reset clears all latches/logs and reproduces identical landmark coordinates.

## Browser evidence

Add `qa:m2-discovery`:

- frozen `?qa=scouting` at 1366 × 1024;
- capture before discovery;
- use deterministic QA state to place the scout near the center and step the sim;
- capture after discovery;
- prove central resource and landmark state changed exactly once;
- prove persistent resource memory after scout leaves LOS;
- browser errors 0, p99 < 8 ms, non-black images, reliable cleanup.

## Owned files

- `src/engine.ts`
- `src/discovery.ts`
- `src/sim.ts`
- `src/render.ts`
- `src/hud.ts`
- `src/main.ts` (QA snapshot only)
- `tests/m2-discovery.test.ts`
- `scripts/qa-m2-discovery.mjs`
- `package.json`
- `docs/M2_B_DISCOVERY.md`
- `PROGRESS.md`

No AI policy, contextual prompt UI, combat, economy, technology, roster, or asset changes.

## Acceptance

- `test:m0`, `test:m2`, build, diff check.
- `qa:m2-opening` remains green.
- `qa:m2-discovery` green.
- M1 interaction and full 26-route regression green.
- Commit exactly `feat: hide undiscovered resources and objectives`, push, verify remote.
