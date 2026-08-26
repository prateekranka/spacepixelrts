# A3 — Timeline UX Specification (interactive trace timeline)

Scope: developer-only, read-only viewer for deterministic RTS match traces. Single standalone HTML file (`timeline.html`), zero runtime deps (repo has none — `three` is the only dependency and is a game-engine dep, not a chart lib; build must stay clean, so no new packages). Browser-loads `trace.json` via `fetch`/file input/drag-drop. Follows the repo's established tool pattern (`town-center-viewer.html`: one file, fixed overlay panels, keyboard-hint line) and the self-view-harness board composition style: ink `#0B0A12` background, `ui-monospace` stack, uppercase letter-spaced section headers, ochre `#D09A4E` accents, muted `#9CA6A5` secondary text, palette-adherent tokens only.

## 1. Data model (assumed trace.json, as being defined in parallel audits)

- Header: `{ schemaVersion, config, worldHash, tickRateHz: 20, terminalResult, teams: [{id, name, color}], reviewBaseUrl? }`.
- Events carry `{ tick, config, worldHash, payload, frameRef }` (frameRef = canonical replay seek handle; config/worldHash optional per event — display when present).
- Track sources (all per-team unless noted): resource series (Ore, Volatiles=Gas, Charge=Energy), population+capacity series, worker-assignment counts, construction spans (start→finish), production-queue spans + completion markers, tech funding/channel/lock markers, Scout discovery events, AI knowledge events, Lumen capture/contest/owner/income/pulse (single shared field, team-tagged), command/order markers, combat engagements (span), unit deaths (point), Core health/damage series + damage points, terminal result (global).

## 2. Track layout hierarchy and grouping

Group by team block, then by kind; blocks in fixed order: **Economy → Military → Field → Meta** (per team), followed by one **Shared** block (Lumen, Core, terminal). Within a block, fixed track order:

- Economy: Resources (3 mini-tracks: Ore / Volatiles / Charge), Population+Capacity, Worker Assignments.
- Military: Construction, Production Queue, Tech, Commands/Orders, Combat, Unit Deaths.
- Field: Scout Discovery, AI Knowledge.
- Shared: Lumen Field, Core, Terminal Result.

Row height 22px; group header row (team name, uppercase, ochre) spans the track list; collapsible per block and per team. Track labels are a fixed 190px left gutter; every track column header repeats the axis legend. A track is rendered if its data exists; empty tracks hidden with a count note ("0 events — suppressed").

## 3. Time axis and tick↔seconds mapping

- Sim runs at **20Hz ⇒ tick = 50ms**. Axis in **MM:SS.d** (deciseconds); a tick ruler under the axis shows raw tick every N seconds. `seconds = tick / 20`, `tick = round(seconds * 20)` — the UI is tick-native internally, seconds only for display.
- Axis ticks: major every 30s, minor every 10s, decisecond ruler only at high zoom (≥ 8 px/s).
- Extent = max terminal tick (or last event tick if terminal missing). Matches render tick-aligned (never time-aligned), preserving determinism.

## 4. Rendering approach — decision: **HTML/CSS structure + Canvas plot field**

| | DOM | SVG | Canvas |
|---|---|---|---|
| 50k marks | unusable (node cost, layout thrash) | heavy (50k nodes, slow zoom) | fine (draw = one pass) |
| Zoom/pan | relayout cost | re-render DOM tree | redraw primitives, cheap |
| Hit-testing | free (element events) | free-ish (needs per-node events) | manual (spatial index) |
| Text labels | native | native | manual raster/measure |

Decision: **hybrid**. Track rows, group headers, gutter labels, axis, toolbar, panels = DOM (few hundred nodes). All marks/spans/series inside the plot field = **one canvas per track row** (or one shared canvas with per-row bands), redrawn on zoom/pan/filter. This is the only approach that keeps 10k–50k marks interactive.

- **Viewport culling**: only draw marks whose tick ∈ [visibleStart, visibleEnd]; at > 8 marks/pixel-column, merge to density columns (count glyph + tooltip "N events here").
- **Zoom**: wheel over plot (ctrl/⌘+wheel or plain wheel per pref), zoom-to-cursor (anchor tick under pointer stays fixed), range 1 s/view to full match, discrete steps ×1.5, clamp at 20 px/tick max.
- **Pan**: drag empty plot area (cursor: grab/grabbing), shift+wheel horizontal, trackpad horizontal scroll; clamped to [−10%, extent+10%].
- Series (resources/pop/Core HP) = filled stepped polylines (economy ticks are stepped, not linear). Spans = rounded bars; points = glyphs (◆ tech, ● death, ▲ scout discovery, ★ Lumen events, ⚠ failures). Per-team color from `teams[].color`, falling back to palette tokens (copper/ochre for team A, sky/ice for team B, red for hostile actions, amber for milestones).
- Redraw budget: full redraw ≤ 8ms at 50k marks (target); keep series point-decimation factor adaptive so p99 stays under 12ms. `requestAnimationFrame`-coalesced; no redraw while idle.

## 5. Controls (toolbar, top)

- **Zoom**: buttons +/−, "Fit" (full extent), zoom % readout. **Pan**: drag as above, Home/End jump, "Jump to tick" input (accepts `MM:SS.d`, `tick:N`, or raw seconds).
- **Team filter**: per-team checkbox chips (team A / B / Shared).
- **Event-type filter**: checkbox list mirroring track kinds; unchecked kinds collapse their tracks (not just dim).
- **Milestone-only mode**: toggle; shows only milestone-tagged events (terminal, tech locks, Lumen captures, first scout discoveries, deaths, combat starts) as tall markers on a single overview strip above the axis — used to find "interesting" ticks fast.
- **Search** (Ctrl/Cmd+F in-tool): matches event/entity IDs and payload text; results dropdown (tick, kind, id); Enter cycles hits, each hit centers view on that tick and flashes the mark; Esc closes. Invalid query = empty state, no error.
- **Prev/next failure navigation**: ⚠ buttons step to the previous/next event flagged `severity: failure` (or deaths/Core damage events when no explicit failure flag exists); button badges show count; status line shows "Failure 3/7 — tick 45213 (37:42.6)".
- Keyboard shortcuts shown in a `?` hint line, consistent with repo viewers.

## 6. Event-details panel + frame links

- Click a mark/span → right-side panel (fixed, 300px, collapsible) with: kind, team, tick (raw + MM:SS.d), config (pretty-printed when present), worldHash (mono, truncated middle), full payload (read-only JSON), frameRef.
- **Copy frame-ref** button: `navigator.clipboard.writeText(frameRef)`; button flips to "copied ✓" for 1.5s. frameRef format (suggested): `frame:<worldHash>:<tick>` — enough to re-seek deterministically.
- **Open in review deck**: shown only when header `reviewBaseUrl` is present; URL = `reviewBaseUrl + '#' + encodeURIComponent(frameRef)` (query param `?frame=` also accepted); opens new tab.
- Deep links INTO the timeline: `timeline.html?trace=…&tick=45213&sel=<eventId>` — selects the event, opens its panel, centers view.
- Selection is single; Esc or click empty space clears. Selected mark gets a 2px amber halo; on canvas, selection is redrawn on top.

## 7. Accessibility (developer tool — pragmatic WCAG 2.1 AA)

- Full keyboard nav: Tab order = toolbar → track list → plot; arrow keys pan (left/right 10% view, up/down scroll tracks), +/- zoom, Enter/Space activate focused mark, Esc clear/close panel.
- Plot marks exposed to AT via a hidden sorted list (`role="list"`, aria-label "events") of focused/selected events; canvas itself `role="img"` with aria-label summarizing visible range ("ticks 4000–8000, 124 events, 3 failures"). Live region announces selection and failure-step results.
- Focus styles: 2px ochre outline, never removed on mouse-only (use `:focus-visible`).
- Contrast: text uses cream `#F0E7D2`/muted `#9CA6A5`/sand `#D6B98A` on ink `#0B0A12` (all ≥ 7:1); avoid red `#B84B45` text on ink for body text (use cream with red glyph); series colors checked against each other (copper vs ochre never adjacent on same track).
- `prefers-reduced-motion`: disable flash animations and smooth scroll; `prefers-color-scheme` ignored (fixed dark dev theme).

## 8. Partial / malformed trace behavior (never crash)

- **Parse defense**: wrap load in try/catch; validate header; per-event validation is lenient — a bad event is skipped with a counter, not a throw. Numeric coercion with `Number.isFinite` guards; malformed spans (end < start) render as a 1-tick point.
- **Missing sections**: render every track whose source exists; header banners (ochre, top of gutter) list what is missing: "No AI-knowledge section — 0 events", "worldHash absent — frame links degraded (frameRef built from tick only)", "config absent", "terminalResult absent — extent = last event tick".
- **Unknown event kinds** (schemaVersion drift): collected into a "Unknown (N)" track under Meta, payload shown raw in the details panel — never dropped silently, never fatal.
- **Empty file / wrong JSON**: friendly error panel with the parse error and "drop another file" state; the page itself never goes blank. All state transitions (load, filter, zoom) guarded so the canvas simply draws nothing rather than throwing.
- Frame links: if `frameRef` missing on an event, Copy uses the computed `frame:<worldHash>:<tick>` fallback and notes it.

## 9. Implementation notes (for the builder)

- One file: `<style>` + `<script type="module">`; no imports beyond browser APIs. Load trace via fetch (same-origin/`file://` blocked → also accept drag-drop + `<input type=file>`).
- Data pipeline: raw events → indexed arrays per track (pre-sorted by tick at load; binary-search cursor per track for viewport queries) → draw. Precompute per-event `x` lazily and cache per zoom level where cheap.
- State: single `ViewState { zoom, viewStartTick, selected, filters, milestoneOnly, searchQuery }`; all controls reduce to it; URL hash syncs `tick`/`sel` for reloadable deep links.
- Perf budget: load + index 50k events ≤ 200ms; first paint ≤ 300ms; pan/zoom redraw p99 ≤ 12ms; search over 50k payloads via pre-built string index (concatenated `id|kind|payload`), ≤ 50ms.
- Success criteria (manual QA): 50k-event synthetic trace stays interactive; zoom-to-cursor anchors correctly; every filter combination renders; broken JSON, missing sections, and unknown kinds each produce the specified banner behavior with a live page; keyboard-only pass through all controls.
