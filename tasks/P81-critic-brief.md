You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P81** (procedural terrain shader).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code. Do **not** spawn agents.

Bar: `docs/PROCEDURAL.md` — ground is GLSL (value weather, dune banding, elevation rims), not a baked canvas atlas. RTS-readable. Opening clash still wows. **p99 < 8 ms**.

Live: https://spacepixelrts.pages.dev (`0.7.1-proc`)

## Inspect

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p81-critic.png --fps-seconds 3 --wait 3`
2. Fail if version is older than `0.7.1-proc`.
3. Opening still Helion rank vs Kryos wrecks + mid gem (gem not lost in noise).
4. Ground should show banding/rims/weather, not a flat purple checker. Rock/dust still distinguishable. P80 VFX still present during clash.
5. p99 **< 8**.

Pass = procedural ground + readable RTS + budget. Fail = one sentence biggest gap.

Write `tasks/P81-critic.md`. Commit `P81: critic verdict on procedural terrain`. No huge PNGs.
