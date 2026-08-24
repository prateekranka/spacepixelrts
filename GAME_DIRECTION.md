# Starhaven direction

> **STATUS NOTICE (2026-08-21):** `docs/FIRST_PLAYABLE.md` is now the active product contract and
> **supersedes the old three-faction first-pass scope below wherever the two conflict** — most
> notably, the First Playable exposes exactly two playable factions (Sunweaver vs Gravemark) on
> one map (Helios Rift); the third faction stays hidden and deferred. The historical body below
> is preserved unchanged for context.

## Product promise

Starhaven is a touch-first space real-time strategy game. It combines a persistent economy, asymmetric factions, exploration, and deliberate tactical control. It must feel like its own game, not a fantasy reskin of an existing age-based RTS.

## Keep the useful RTS foundation

- Deterministic simulation and fixed-step combat.
- Three.js isometric presentation with readable unit silhouettes.
- Workers, scouting, resources, construction, fog of war, and a shared battlefield.
- Faction-specific unit and building data.
- Large touch targets, box selection, pinch zoom, minimap navigation, and camera panning.

## Move the player experience in this direction

1. Start in a player-facing command deck, not directly in a live match.
2. Let the player choose a faction before the simulation starts.
3. Present each faction as a different doctrine with a different economy and battlefield plan.
4. Replace age-first language with technology milestones and strategic paths over time.
5. Make exploration and tactical pauses useful on iPad. The player should not need keyboard speed to make good decisions.
6. Keep the first match readable. A small roster with clear roles is better than a large list of similar units.

## Current faction identities

The current simulation already has three factions. This pass keeps their names and data stable while the player-facing direction becomes clearer:

| Faction | Core identity | Player question |
| --- | --- | --- |
| Helion Compact | Solar geometry, energy, and flexible forward control | Where can I create a safe, bright corridor? |
| Kryos Conclave | Cold precision, durable positions, and long sight lines | Which approach can I freeze and hold? |
| Nihiline | Spore growth, stealth pressure, and disruptive timing | Where can I make the map unsafe? |

These identities are guidance for the menu and future tech paths. They do not replace the existing simulation in this increment.

## First implementation slice

The first player-facing slice is the start screen. It will:

- show the Starhaven title and a short mission statement;
- offer New Match, Tutorial, and Settings actions;
- show the three factions before play begins;
- keep Continue visible but disabled until a save system exists;
- pause the simulation until New Match is selected;
- preserve the current touch command deck after the match starts.

## Follow-up slices

- Add faction-specific technology milestones and replace the current age-up presentation.
- Add a tactical pause and queued touch commands.
- Make the first match objective and scouting route explicit.
- Replace prototype labels in the HUD with faction doctrine, objective, and milestone feedback.

