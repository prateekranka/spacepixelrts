# M1-B — Skirmish setup and civilization selection

Status: **ACTIVE IMPLEMENTATION CONTRACT**

Read first: `DIRECTIVE.md`, `docs/CANONICAL_VOCABULARY.md`, `docs/FIRST_PLAYABLE.md`,
`docs/M1_A_MAIN_MENU.md`, and `PROGRESS.md`.

## Goal

Replace the M1-A setup placeholder with a complete, touch-first skirmish form. Do not start the
world in this slice. M1-C connects the validated form to Loading and deterministic match creation.

## Required controls

- Player civilization: Sunweaver or Gravemark.
- AI civilization: Sunweaver or Gravemark.
- AI difficulty: Cadet, Standard, Veteran.
- Map: Helios Rift, visible as the single selected map.
- Fog of War: On or Off.
- Match speed: 0.75x, 1x, 1.25x.
- Tactical pause: Enabled or On-demand.
- Seed mode: Random or Deterministic.
- Deterministic seed: unsigned 32-bit integer, visible only when relevant; default `24301`
  (`0x5eed`).
- Back and Start Match actions.

The two faction fields are real controls. The current First Playable does not allow mirror matches.
If a player selection would equal the AI selection, automatically switch the other side to the
remaining faction and announce the change in the screen summary.

## Faction summaries

- **Sunweaver:** Mobility, information, energy efficiency, elite precision.
- **Gravemark:** Extraction, armor, heavy production, positional control.

Show the chosen player's summary next to the player selector. Show the AI summary in a smaller
opposing panel. Do not expose legacy IDs.

## Layout

- 1366 × 1024 4:3 landscape is primary.
- Two columns: faction match-up on the left, match rules on the right.
- Every row remains at least 52 px high. Segmented choices are at least 44 px high and 44 px wide.
- Use safe-area margins on all sides.
- Keep Start Match as the only bright primary action.
- Back is clear but secondary.
- Do not add campaign, multiplayer, store, achievements, or map browser UI.

## State and config

- Enter through legal `MainMenu OPEN_SETUP -> MatchSetup`.
- Back dispatches `BACK` and restores MainMenu.
- The form owns a cloned canonical `MatchConfig` and validates through `validateMatchConfig`.
- Form changes update the app active config through one typed callback. No scattered global fields.
- For this B slice, Start Match is shown but disabled with the plain note `Match connection pending`.
- `?qa=match-setup` uses `QA_MATCH_CONFIG` and displays deterministic seed `24301`.
- `window.__STARHAVEN_QA__.config` matches the visible QA form.

## Owned files

- `src/start-screen.ts`
- `src/main.ts`
- `docs/M1_B_SKIRMISH_SETUP.md`
- `PROGRESS.md`

Do not edit simulation, engine, renderer, input, HUD, content, M0 state/config/scenario modules,
assets, package files, or evidence scripts.

## Acceptance

- `npm run test:m0`
- `npm run build`
- `git diff --check`
- Run `qa:m0` route `match-setup` at 1366 × 1024 in both landscape orientations to a durable
  M1-B evidence path.
- Browser errors 0, state `MatchSetup`, resetCount `0`, deterministic seed `24301` visible, and no
  deprecated public names.

## Commit

`feat: add skirmish setup and civilization selection`
