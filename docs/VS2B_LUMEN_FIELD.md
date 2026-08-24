# VS-2B — Central Lumen Field Ownership

Status: **ACTIVE / FROZEN**. Parent: `docs/VERTICAL_SLICE_SPRINT.md`.
This piece gives both legal armies a reason to hold the shared center. It is not an alternate victory
and it does not change unit stats, costs, AI production, or terminal flow.

## Spatial contract

Use the existing landmark `central-lumen-field` coordinates. Capture radius is 4.5 world units.
Only living combat-roster units count:

- Fighter (Lumen Guard / Rift Guard);
- Ravager (Solar Strider);
- Prism (Burden Walker).

Workers, Scouts, buildings, resources, corpses, retired Siege/Shade, and neutral entities never
capture. One qualifying unit is enough.

## Deterministic state

World exposes read-only-through-method state:

```ts
interface LumenState {
  owner: -1 | 0 | 1;
  capturing: -1 | 0 | 1;
  progress: number;       // seconds, [0,5]
  contested: boolean;
  pulseRemaining: readonly [number, number];
}
world.lumenState(): LumenState
```

Internal accumulators reset in `World.reset`.

Rules per fixed sim step:

1. no qualifying units in radius: `contested=false`, `capturing=-1`, `progress=0`; owner persists;
2. both teams present: `contested=true`, `capturing=-1`, `progress=0`; owner persists;
3. exactly one team present and already owner: no capture, owner persists;
4. exactly one non-owner team present: `capturing=team`, progress increases by DT;
5. capture side changes or leaves: prior progress is lost;
6. at 5 seconds: owner becomes capturing team; `capturing=-1`, `progress=0`;
7. ownership never sets winner and never damages either Core.

Tie/order behavior must be seed-independent and byte-deterministic.

## Reward

While owned:

- owner receives exactly +1 Charge per second through an accumulator (not `+DT` UI drift);
- every 30 owned seconds, owner receives a 4-second global vision pulse;
- capture/recapture resets that owner's reward accumulators, so first pulse occurs 30 seconds after
  ownership;
- losing ownership stops income/pulse accumulation; an already-active pulse may finish its remaining
  time;
- pulse fills that team's current visibility for 4 seconds and permanently records exploration /
  discovery reached during the pulse;
- after pulse, current visibility returns to normal fog. No entity position is changed.

Fog off remains fog off. AI receives the same pulse rules.

## AI interaction

VS-2A already rallies with AttackMove to the landmark. Do not rewrite AI doctrine. Its legal units
must naturally capture if uncontested and contest/fight when the player arrives.

## HUD / minimap

The objective panel appears only after `central-lumen-field` has `SEEN_PLAYER`.
Place it under the existing 1v1 faction tiles (`#civpick`) to avoid topbar/bottom-deck crowding.

Exact visible copy:

- `LUMEN · NEUTRAL`
- `LUMEN · CAPTURING — SUNWEAVER`
- `LUMEN · CAPTURING — GRAVEMARK`
- `LUMEN · CONTESTED`
- `LUMEN · SUNWEAVER CONTROL`
- `LUMEN · GRAVEMARK CONTROL`

A 6px progress bar is visible only while capturing and fills 0→100% over five seconds.
When player pulse is active, add second line `VISION PULSE · Ns`.
Panel is pointer-transparent, <=156px wide, minimum text 12px.

The existing minimap central-objective marker remains discovery-gated. Tint its ring and diamond:

- neutral/capturing/contested: existing amber/cream;
- Sunweaver owner: amber/lime;
- Gravemark owner: ice/sky.

## World-space objective asset (R2)

The first blind gate failed because the status panel had no spatial link to the field. After
landmark discovery, `GameRenderer` must draw a projected pixel-sharp objective asset on the overlay:

- a complete 4.5-world-unit ground ring, projected from at least 32 world points;
- 5px dark under-stroke plus >=2.5px owner/state stroke;
- neutral amber/cream, Sunweaver lime/amber, Gravemark ice/sky, contested coral;
- a center diamond beacon and compact `LUMEN` plate anchored to the projected landmark center;
- capture progress overlays a brighter partial ring from 0→100%;
- pulse adds one restrained outer pulse ring; no full-screen flash;
- marker is hidden before discovery and follows pan/zoom exactly;
- overlay adds zero WebGL draw calls and no sim state.

Enlarge the minimap objective ring so colored pixels remain visible at +/-10 internal-canvas pixels
from center after CSS scaling. Keep it discovery-gated.

Do not add another topbar resource or modal.

## Strict RED→GREEN

Create `tests/vs2b-lumen-field.test.ts` + `test:vs2b` before production edits. Save RED transcript
`tasks/VS2B-red.log`.

Tests stage real spawned qualifying units and fixed-step them; production code is untouched until
RED. Required assertions:

1. Worker/Scout alone never captures after 10 seconds;
2. Fighter captures at 5s ± one DT; owner persists when empty;
3. both teams contest and zero progress; leaving resets progress;
4. recapture requires a fresh full five seconds;
5. owner gains exactly 10 Charge over 10 owned seconds, non-owner gains 0 from objective;
6. first pulse begins at 30s, lasts 4s ± one DT, fills visibility/exploration, then current visibility
   closes while exploration persists;
7. identical sequence in two worlds yields identical state/economies/visible+explored hashes;
8. winner remains -1 through all objective transitions;
9. reset clears owner/progress/contested/pulses/accumulators.

## Browser proof

Add `scripts/qa-vs2b-lumen.mjs` + `qa:vs2b` at 1366×1024, fixed seed.
The QA fixture may spawn exact roster units for both teams and move them; it must not grant resources,
set owner/progress/pulse, or write visibility directly.

Capture and assert:

1. undiscovered panel absent;
2. discovered neutral;
3. Sunweaver 50% capture;
4. Sunweaver control + minimap amber/lime;
5. contested;
6. Gravemark control + minimap ice/sky;
7. player vision pulse visible and all-map current visibility;
8. pulse ended, exploration persists, current visibility returns;
9. projected overlay perimeter has >=20/32 non-transparent ring samples in each discovered state;
10. minimap owner ring is visible at +/-10 internal-canvas pixels;
11. exact Charge deltas, winner -1, zero console errors;
12. software GL gates sim share <8ms; hardware GL p99 <8ms.

Evidence outside repo. Fresh Sol gate judges only objective-state clarity and map/HUD cohesion.

## Scope / acceptance

Owned files: `src/sim.ts`, `src/hud.ts`, `src/render.ts`, tests/new QA/package. `src/main.ts`,
input, content, stats, combat assets, AI doctrine, and app flow untouched.
All existing gates/build must pass. Builder commits prefix `VS2B:`; lead reviews actual captures,
then short Sol gate. Deploy after PASS.
