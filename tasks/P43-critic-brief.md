You are a **FRESH** Composer 2.5 critic for Spacepixel RTS piece **P43** (unblock training / pop cap).

Repo: /Users/prateekranka/Cowork/spacepixelrts
Do **not** read `tasks/*.md` as truth. Do **not** change game code except a one-liner probe version print if needed. Do **not** spawn agents.

Bar: `docs/DESIGN.md` §3, §7, §9 — this piece's scope is **can you start growing an empire**, not the already-passed opening shot.

## Inspect the running game

1. `npm run critic -- --url https://spacepixelrts.pages.dev --screenshot critic/out/p43-critic.png --fps-seconds 3 --wait 3` (or local `npm run dev` if live is still `0.2.16-wave1`).
2. Playwright Chrome, 1180×820:
   - Read `window.__STARHOLD__.teams[0]` (or `__SPACEPIXEL__`). **Fail** if `pop >= cap` or `cap < 30` or version is still `0.2.16-wave1`.
   - Jump camera to player Nexus (~10.5, 10.5). Tap the hall. Command deck must offer Train Worker **enabled**.
   - Click Train Worker. Within ~10s pop must rise and ore must fall.
3. Reset camera to the opening mid fight. Screenshot must still read Helion intact rank vs Kryos wrecks + mid gem (Wave 1 must not regress).

Pass = you can train from the opening skirmish **and** the tableau still looks like P41. Fail = name the **single biggest gap** (one sentence).

Write `tasks/P43-critic.md`. Commit `P43: critic verdict on training/pop`. No huge PNGs. `--yolo` is on; just work.
