# Civilization front-end scenes

Starhaven uses one real interface over two faction-specific scene packs. The player faction is the source of truth. A new profile starts with Sunweaver. A faction change updates the menu immediately and persists for the next visit.

## Scene packs

| Scene ID | Faction | Composition |
| --- | --- | --- |
| `sunweaver-capital` | Sunweaver | Open solar horizon, tapered towers, light lattice structures, and Wind Striders |
| `gravemark-quarry` | Gravemark | Fractured moon, quarry fortress, gravity cranes, heavy walkers, and mineral light |

Both scenes use a 960 × 540 logical canvas. The renderer scales the canvas with `cover` rules. It updates moving scene elements at a stepped 10–12 frames per second. It draws movement on integer logical coordinates. Reduced Motion freezes nonessential movement.

The two packs use different geometry, skyline, celestial body, vehicles, ground treatment, and palette. A color filter is not a civilization scene.

## Interface boundary

The canvas contains only the world. The DOM contains all player controls, text, badges, focus states, dialogs, and match setup fields.

The main menu has one primary action: **New Skirmish**. **Start Match** exists only inside match setup. The utility dock contains real buttons for **Records**, **Match History**, **Tech Codex**, and **Dispatches**.

The local profile stores:

- preferred faction;
- match totals and fastest victory;
- up to 20 recent match summaries;
- unlocked achievement identifiers;
- the last Dispatches version seen.

The profile does not contain a resumable match snapshot. Therefore, the menu does not show a nonfunctional Continue control.

## Asset and provenance rule

The previous approved menu and loading WebP files are opaque 960 × 540 paintings. They do not have separable source layers or recorded license provenance. The new runtime does not split, color-key, filter, or load those files.

The current scene packs use local procedural canvas geometry. Future raster or model layers must record their source, dimensions, alpha contract, allowed transforms, and license before runtime use.

## Validation

- `npm run test:m0` checks app flow, profile normalization, faction mapping, scene identifiers, stepped timing, and Reduced Motion behavior.
- `npm run qa:front-end -- --url=<served-build> --out=<durable-path>` tests real controls, panels, profile persistence, faction switching, Reduced Motion, responsive layouts, browser errors, and screenshots.
- `npm run build` verifies the deployable desktop route.

The obsolete four-theme random selector and approved-art hotspot checks are not release gates.
