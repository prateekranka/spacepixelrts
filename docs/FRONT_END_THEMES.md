# Random Full-HD Front-End Themes

Starhaven now selects one coherent main-menu/loading presentation per page session. The selected theme remains stable from Main Menu through Match Setup and Loading, so the transition feels intentional rather than shuffled mid-flow.

## Included variants

| Theme ID | Direction | Accent |
| --- | --- | --- |
| `violet-orbit` | P6/L6-inspired purple orbital colony | Violet |
| `solar-foundry` | Golden sun and industrial foundry | Amber |
| `cyan-rift` | Teal Lumen vortex and frontier city | Cyan |
| `crimson-citadel` | Red volcanic citadel and lava lanes | Coral red |

Every background is rendered as 960 × 540 pixel art and nearest-neighbour upscaled to a 1920 × 1080 image before display. The UI title is **STARHAVEN** only; `RTS` is not placed beneath the name.

## Selection behavior

Normal entry selects one of the four themes with equal probability. QA routes remain deterministic on `violet-orbit` unless an explicit override is supplied.

Use these preview routes to inspect a particular variant:

- `/desktop?front-theme=violet-orbit`
- `/desktop?front-theme=solar-foundry`
- `/desktop?front-theme=cyan-rift`
- `/desktop?front-theme=crimson-citadel`

## Validation

- `npm run test:m0` checks the four IDs, random quartiles, deterministic QA fallback, explicit URL override, copy, and theme metadata.
- `npm run qa:front-end-themes -- --out=/tmp/starhaven-front-end` launches Chromium at 1920 × 1080, captures a menu and loading screen for every variant, verifies the title/copy/progress/state, rejects console errors, and proves all eight captures are distinct.
- The standard First Playable GitHub workflow runs both gates and uploads the screenshots and manifest with the existing browser evidence.
