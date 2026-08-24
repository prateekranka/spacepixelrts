# Starhaven Pixel Front-End System

Status: **FROZEN** for branch `hermes/starhaven-pixel-ui-shell`.
Scope: DOM front-end shell only. Preserve simulation, app flow, profile behavior, and the accepted authored civilization scene packs.

## 1. Product rule

The front-end must look like one premium pixel-art strategy game. The accepted Sunweaver and Gravemark compositions remain the visual foundation. The DOM shell must use the same hard grid, stepped cadence, limited ramps, and integer placement.

Protected files and systems:

- `src/sim.ts`, `src/engine.ts`, `src/render.ts`
- economy, AI, combat, pacing, map generation, and app-flow transitions
- `public/front-end/civilizations/<civ>/` manifests and scene assets
- the 960 × 540 scene buffer, 12 fps stepped scene motion, and Reduced Motion behavior
- all menu actions, panel content, profile persistence, loading lifecycle, focus management, keyboard input, and touch input

Do not replace or recolor the two authored scene packs. A crop or safe-zone correction is allowed only when a target viewport clips required scene or UI content.

## 2. Hard bans

Production front-end CSS and markup must not contain or activate:

- `backdrop-filter`, `filter: blur`, frosted glass, or translucent invisible hotspots
- smooth blurred `box-shadow`
- control gradients or material gradients
- `cubic-bezier`, spring motion, scale-on-hover, or fractional transforms
- border radii above 2 px; primary frame geometry must be square or chamfered
- Unicode utility icons or icon fonts
- Trebuchet, Segoe UI, Arial, generic sans-serif dashboard stacks, or runtime font CDNs
- hue rotation as faction identity
- procedural front-end scene drawing in the normal production path
- one scene recolored for both factions
- duplicate main-menu Start actions

## 3. Grid and integer geometry

- Base spacing unit: 4 CSS px.
- Primary gaps, padding, frame offsets, and icon cells use multiples of 4 px.
- Border weights: 1 px, 2 px, or 4 px only.
- Hard shadow offsets: 4 px for controls; 4–6 px for panels.
- Visible touch targets: at least 52 × 52 px for the dock and at least 44 × 44 px for every other control.
- Decoration and motion must land on whole CSS pixels.
- Decorative rasters and pixel icons use `image-rendering: pixelated` and `image-rendering: crisp-edges`.
- Normal body text must not use pixelated image rendering.

Chamfer recipe: an 8 px corner cut formed with `clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px)`. The focus outline must remain outside the clipped body through a separate wrapper or pseudo-element.

## 4. Typography

All fonts are bundled as local WOFF2 files. Runtime network font requests are forbidden.

### Display role

- Face: Pixelify Sans Bold, SIL OFL 1.1.
- Uses: STARHAVEN, panel titles, and loading status.
- Desktop STARHAVEN: 96 px; 1920 × 1080 may use 104 px.
- 1366 × 1024: 80 px.
- 1366 × 768: 68 px.
- 1180 × 820: 64 px.
- Line height: 0.9–1.0. Tracking: 0.04 em.
- Optional hard offset text shadow: 2 px 2 px 0 `--px-border-dark`.
- No glow or blur.

### Interface-label role

- Face: Silkscreen Bold/Regular, SIL OFL 1.1.
- Uses: button labels, field labels, tabs, tooltips, micro labels, badge text, and profile labels.
- Size: 14–20 px by hierarchy. Dock tooltips: 12–14 px.
- Uppercase for control labels. Tracking: 0.04–0.08 em.

### Body role

- Face: Kode Mono Regular/Medium, SIL OFL 1.1.
- Uses: descriptions, tutorial copy, history, codex, settings text, and metadata.
- Size: 14–16 px. Minimum 13 px only at 1366 × 768.
- Line height: 1.4–1.5.
- Must remain readable at 1180 × 820 without horizontal scrolling.

Commit the OFL license text and a font provenance file with source repository paths and retained file names.

## 5. Central color tokens

```css
:root {
  --px-black: #05070c;
  --px-ink: #090d15;
  --px-panel: #0d1420;
  --px-panel-raised: #131b29;
  --px-border-dark: #020408;
  --px-border-mid: #39485c;
  --px-text: #f1ead8;
  --px-text-muted: #a6b0bd;
  --px-disabled: #59616d;
}

[data-civ="sunweaver"], [data-faction="sunweaver"] {
  --civ-primary: #f3b83f;
  --civ-bright: #ffe8a4;
  --civ-secondary: #75d7df;
  --civ-warning: #e37d48;
  --civ-shadow: #6d4315;
}

[data-civ="gravemark"], [data-faction="gravemark"] {
  --civ-primary: #76d5df;
  --civ-bright: #cafaff;
  --civ-secondary: #6f9b82;
  --civ-warning: #e37d48;
  --civ-shadow: #193a43;
}
```

Faction color appears only on active borders, selected controls, focus, dividers, progress segments, profile sigil, unread state, and restrained motifs. Panels stay neutral.

## 6. Main menu at 1366 × 1024

Safe area: 32 px from each viewport edge. The scene remains full-bleed.

Command deck:

- Width: 448 px.
- Right edge: 32 px.
- Top safe origin: 40 px.
- Profile card: 448 × 64 px.
- Navigation button: 448 × 64 px.
- Navigation gap: 8 px.
- Use one primary New Skirmish action. Continue remains only when the existing flow makes it available.

Button frame:

- Opaque `--px-panel` body.
- 2 px outer border; 1 px inner highlight.
- 4 px hard bottom/right shadow.
- 8 px chamfers.
- Default steel border and ivory label.
- Primary: faction border plus a 4 px faction strip. No gradient.
- Hover: translateX(2px), brighter border, pixel selection marker; 100 ms `steps(2, end)`.
- Pressed: translateY(2px), reduce shadow from 4 px to 2 px.
- Focus: 2 px `--civ-bright` outline with 2 px dark separation.
- Disabled: opaque dark body, `--px-disabled` copy, no hover movement.

Title deck:

- Kicker uses interface-label role and faction divider.
- STARHAVEN uses display role.
- Promise and descriptor use body role.
- No soft shadow or glow.

Profile card:

- 448 × 64 px, opaque, 2 px frame, 4 px hard shadow.
- Sigil cell: 44 × 44 px with its own 2 px frame.
- Micro label, faction/player name, and compact records line remain visible.

Utility dock:

- Four real `<button>` elements: Records, Match History, Tech Codex, Dispatches.
- Each button: 56 × 56 px. Gap: 8 px.
- Shared opaque frame with 2 px border and 4 px hard shadow.
- Four SVG icons on an integer 16 × 16 or 20 × 20 grid with `shape-rendering="crispEdges"`.
- Tooltips use an opaque pixel frame and label font. They appear on hover and keyboard focus.
- Unread badge: rectangular, 16–20 px, 2 px border, no pill radius. It clears and persists through the existing profile path.

Faction motifs:

- Sunweaver: thin symmetric brackets and solar diamonds.
- Gravemark: reinforced corner blocks and industrial status bars.
- Keep motifs sparse. They cannot reduce text or scene readability.

## 7. Panels and dialogs

Applies to Tutorial, Factions, Settings, Records, Match History, Tech Codex, Dispatches, Match Setup, and Results if the shared selector reaches it.

- Desktop max width: 880 px.
- Width at 1180 × 820: viewport minus 48 px.
- Height: viewport minus 48 px; internal scroll only.
- Opaque panel fill; alpha may not be below 0.94.
- 2 px outer border, 1 px inner highlight, 6 px hard shadow, 8 px chamfers.
- Header: display title, one faction accent line, a real 44 × 44 px close button.
- Entrance: 140 ms, 4 stepped frames. No zoom and no spring.
- Custom scrollbar uses square track/thumb and faction focus color.
- Focus containment, Escape close, focus restoration, touch support, and existing callbacks are protected behavior.

Match Setup controls:

- Group fields in framed pixel sections.
- Segment controls use 2 px borders and flat two-tone selected fills.
- Selected state must be visible without color alone.
- Seed input uses a square pixel frame and body font.
- Start Match uses primary button recipe. Back uses secondary recipe.
- Player faction selection must persist and swap the active scene through existing behavior.

## 8. Loading at 1366 × 1024

- Lower-center command panel, width 704 px, height 152 px.
- Bottom safe gap: 24 px.
- Opaque neutral body, 2 px frame, 4 px hard shadow, 8 px chamfers.
- Content order:
  1. `STARHAVEN // HELIOS RIFT`
  2. `PREPARING SKIRMISH`
  3. Civilization · Difficulty · Seed
  4. segmented progress track
  5. gameplay tip
- The panel must stay outside the primary scene focal point.

Progress:

- 16 real DOM segments.
- 2 px track border and 4 px gaps.
- Filled segments use `--civ-primary`; remaining segments use dark steel.
- Progress updates only in complete segment steps and remains truthful to the existing loading lifecycle.
- No continuous width interpolation and no fake percentage.
- Status may blink with `steps()` only. Reduced Motion keeps state changes and removes decorative flashes.

## 9. Portrait gate

Use the same local type, neutral panel colors, 2 px border, hard shadow, and square/chamfered geometry. Keep the existing orientation message and behavior. Do not introduce a second visual system before the game loads.

## 10. Responsive rules

Test all states at 1920 × 1080, 1366 × 768, 1366 × 1024, and 1180 × 820.

- Main command deck must not exceed viewport safe width or height.
- At shorter landscape heights, reduce title size and vertical gaps in 4 px increments. Do not shrink touch targets below 44 px.
- Panels fit inside a 24 px safe inset and never create document-level horizontal scrolling.
- The scene remains full-bleed with its accepted authored crop. Correct only a proven clipping or focal-point collision.
- All primary frame edges and control positions must report whole-pixel `getBoundingClientRect()` values at deviceScaleFactor 1.

## 11. Motion and Reduced Motion

Allowed:

```css
transition:
  transform 100ms steps(2, end),
  border-color 100ms steps(2, end),
  background-color 100ms steps(2, end);
```

Use 2 px hover and pressed moves, 3–5 frame panel reveals, stepped badge blink, and discrete loading changes. Reduced Motion disables decorative movement and animation while retaining immediate focus, hover, selected, and loading state changes.

## 12. Automated gates

Tests and browser QA must prove:

- all visible controls have real actions; dock controls are buttons
- no Unicode utility icon text
- no banned fonts, `backdrop-filter`, blur, smooth shadow, control gradients, active hue rotation, or smooth `cubic-bezier`
- no UI border radius above 2 px
- loading uses 16 segments
- preferred faction persistence and faction-aware loading
- Dispatches unread clear/persist behavior
- focus trapping, Escape close, and focus restoration
- no missing assets or console errors
- distinct Sunweaver and Gravemark manifests and compositions
- the authored compositor is active and the procedural scene is absent
- four target viewports, touch, keyboard, mouse, and Reduced Motion

## 13. Visual acceptance

A fresh blind critic receives composited screenshots from the actual running build. It passes only when it cannot reasonably describe the UI as a website, SaaS dashboard, glass overlay, or smooth modern card system. The single largest visible gap is repaired per round. Objective evidence accompanies each verdict: console errors, viewport overflow, font load, integer geometry, touch targets, distinct scene assets, and performance metrics.
