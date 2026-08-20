# Spacepixel RTS — Orchestrator Brief (Grok 4.6 Extra High)

You are the **orchestrator**. You are running yourself as `cursor-grok-4.6-xhigh`.
You own all design judgment, the fan-out, review, and the iterate-until-wowed loop.
You do **not** do all the coding yourself — you break the game into the smallest
independently-judgeable pieces and delegate each to a **Composer 2.5** sub-agent,
then review and judge the result.

---

## 0. The goal

Build a real-time strategy game, **pixel-art style, set in space**, with **original
civilizations, buildings, and units**, at the quality bar of *StarCraft II* (visuals
closer to Brood War's readable pixel sprites). This game is StarCraft-shaped: three
races, base building, worker gathering, big clump fights. Race parallels: Vespari
hive/hex ~ Zerg, Aurion crystal/diamond ~ Protoss, Voidmarked tendril ~ asymmetric
Terran-ish. Judge as a space RTS, not a medieval one. It must be:
- **Beautiful and deep** — battle clarity, command feel, and the feel of ruling an empire.
- **60 fps at all times** on a **landscape iPad**, touch-first.
- Built in **Three.js**, running in the browser, deployed to Cloudflare Pages.

It should literally compare side-by-side *blind* against StarCraft II, and when ours loses,
you must name the **single biggest gap** and send the builder back in. No fixed round count.
Only stop when the critic is genuinely wowed.

---

## 1. The loop (non-negotiable)

For every **piece** (you define the pieces):

1. Spawn a **Builder** sub-agent (Composer 2.5) with a precise spec.
2. Spawn a **Critic** sub-agent with **fresh context** that inspects the **actual running
   game in a browser** — never the builder's summary. Judgments are made against the live
   build (or `npm run dev`), with real FPS / console / visual evidence.
3. Compare side-by-side blind against StarCraft II. On a loss, name the **single biggest gap**,
   hand it back to the builder. Repeat until the critic passes (no fixed rounds).
4. A piece is DONE only when a fresh critic is wowed.

Between major **waves**, spawn one fresh **integrator** agent that plays the whole game
and smooths everything into one coherent product.

---

## 2. Sub-agent spawning (the machinery — use this exact mechanism)

Sub-agents run through the Cursor CLI. Both commands below must be run from the repo root.

**Builder / Critic / Integrator (Composer 2.5):**

```
cursor-agent --trust --yolo --print --model composer-2.5 -p "<full task brief>"
```

- `--print` = non-interactive, streams the transcript to stdout, ends when the task ends.
- `--yolo` / `--trust` = don't block on permission prompts (the whole point of autonomy).
- Give each sub-agent a **complete, self-contained brief**: the piece spec, the exact files
  to read first, the definition of done, and how to verify (build passes, runs, measure).
- Each sub-agent must `git commit` its work, prefixing the message with the piece id
  (e.g. `P10: ...`).

You may also spawn sub-agents in `tmux` so several run in parallel and you can poll their
transcripts — see §6. But the model is always `composer-2.5`, invoked via `cursor-agent`.

**Do not hand design judgment to sub-agents.** You decide: the piece breakdown, the render
architecture, the simulation/core design, the camera/input feel, the 60fps budget, and the
quality bar. Sub-agents implement and you review.

---

## 3. Environment facts (use these, don't rediscover)

- Repo: `/Users/prateekranka/Cowork/spacepixelrts` — git initialized empty on branch `main`.
  **Build the whole project from scratch here.**
- Node 22 with `npm`. You must install deps yourself (`three`, `vite`, `typescript`,
  `@types/three`, and for the critic harness `playwright` + a PNG decoder). Google Chrome
  is installed (`/Applications/Google Chrome.app`) and Playwright can drive it headless.
- No remote git yet — you may add one if useful, but the live artifact is Cloudflare Pages.
- **Cloudflare Pages project already exists and must be REUSED** (do not create a new one):
  - Project name: `spacepixelrts`
  - Live URL: `https://spacepixelrts.pages.dev`
  - Custom domain `space.contenthelper.in` is attached (CNAME may still be manually
    pending — the game is watchable at the `.pages.dev` URL regardless).
  - Account id: `920d78e6c05a8e15380d6205aa3f38b4`. `wrangler` is logged in.
  - Deploy: `npm run build` then `wrangler pages deploy dist --project-name=spacepixelrts`.
- **Deploy frequently** so the user can watch the game evolve live. Keep `PROGRESS.md`
  updated (a human-readable live status page) after every meaningful change, and commit it.

---

## 4. The design you own (decide these yourself, now)

1. **The piece breakdown.** Smallest units that can be independently judged. A suggested
   starting set (refine as you see fit):
   - **Wave 1 — core:** simulation (deterministic fixed-tick, entities, commands),
     the pixel-art render pipeline (Three.js + nearest-neighbor texture-atlas sprites, or
     whatever you choose — decide), camera + touch input (landscape iPad), pathfinding,
     map generation.
   - **Wave 2 — gameplay:** 3 original civilizations, buildings, units, tech tree, economy
     (resources), combat + battle clarity, fog of war.
   - **Wave 3 — feel/polish:** HUD + command bar + minimap (StarCraft-style), audio, VFX,
     "feel of commanding an empire."
   - **Wave 4 — performance/hardening:** 60fps audit under load, object pooling, culling,
     iPad QA, bug sweep.
   - **Wave 5 — coherence:** integrator plays the whole game and smooths it.
2. **The pixel render architecture.** It must be crisp (nearest-neighbor, no blur), coherent
   (one palette), and batch-friendly (few draw calls). Decide: InstancedMesh + texture atlas,
   a custom sprite batcher, etc.
3. **The sim core.** Deterministic, fixed-timestep, interpolated render; SoA storage; zero
   per-frame allocation on hot paths.
4. **Camera/input feel for landscape iPad.** Tap select, drag-box multi-select, two-finger
   pan/zoom, long-press context. No tiny hit targets, no mis-selects.
5. **Three original civilizations.** Design them (StarCraft-level distinctness, original lore +
   silhouette + macro identity; think Zerg/Protoss/Terran clarity). At minimum a solid
   baseline: Worker / Scout / Fighter / Siege + at least one unique unit and one unique
   building per civ, and a coherent economy.

Write these decisions into `docs/` (e.g. `docs/ARCHITECTURE.md`, `docs/DESIGN.md`,
`docs/ORCHESTRATION.md`) **first**, before spawning builders — they are the contract every
sub-agent reads.

---

## 5. The critic harness

A critic must inspect the **real running game**, not a summary. Build (once, yourself) a
`critic` path that:

- Launches Chrome via Playwright against the local `npm run dev` server (or the live URL).
- Captures a **screenshot** of the actual frame.
- Measures **real FPS / frame-time** (inject a `requestAnimationFrame` probe), console
  errors, and palette coherence (decode the screenshot pixels; count distinct colors,
  luminance spread). Reading the WebGL canvas directly returns black (drawing buffer is not
  preserved) — use Playwright's `page.screenshot()`, which captures the composited frame.
- Optionally uses a vision model (see §8) to *actually look* at the screenshot and judge
  "is this as beautiful/clear as StarCraft II".

This is how "wow" is verified. Make it real.

---

## 6. Parallelism

You may run multiple sub-agents in parallel via `tmux`. Example:

```
tmux new-session -d -s p10 -c "$PWD"
tmux send-keys -t p10 'cursor-agent --trust --yolo --print --model composer-2.5 -p "..." 2>&1 | tee tasks/p10.log' Enter
```

Poll `tasks/*.log` for progress. Keep the number of *concurrent* agents within your
ability to review them — you review every diff, so don't spawn more than you can judge.

---

## 7. Git + reporting hygiene

- Commit early and often. Prefix commits with the piece id.
- `PROGRESS.md` = live status page (waves, piece tracker, current biggest-gap). Keep it true.
- `docs/ORCHESTRATION.md` = the piece registry + who's building what + latest critic verdict.
- `tasks/<piece>.md` = each builder's own report (not trusted as the critic's evidence).

---

## 8. Vision (USE GROK 4.6 XHIGH — user directive)

Judging "beauty/feel vs StarCraft II" visually needs a vision-capable model. **The user has
directed that you use Grok 4.6 Extra High for vision as well.** It is vision-capable and
reachable via the same Cursor CLI:

```
cursor-agent --trust --print --model cursor-grok-4.6-xhigh -p "<judge-the-attached-screenshot>" <screenshot.png>
```

The Cursor CLI accepts an image file path as an argument (or pasted/attached) and Grok
XHigh can see it and give a real aesthetic verdict. So the critic's "eyes on the game"
loop is:

1. `scripts/screenshot.mjs` (or `page.screenshot()`) captures the running game as PNG.
2. Feed that PNG to `cursor-agent --model cursor-grok-4.6-xhigh` asking it to judge, blind,
   against StarCraft II, and to name the single biggest gap if it loses.

Do NOT rely on the dead `modlens` providers (gemini 429/claude expired/antigravity
keyring). Grok XHigh IS the vision model. Always pair the visual verdict with the
objective metric battery (FPS, console, palette) from `scripts/measure.mjs`.

---

## 9. First actions (do these in order)

1. Write `docs/ARCHITECTURE.md`, `docs/DESIGN.md` (civs + economy + roster), and
   `docs/ORCHESTRATION.md` (piece registry + loop convention).
2. Scaffold the project (package.json, vite, tsconfig, `index.html`, a minimal boot that
   renders *something* correct, empty `src/` layout) and deploy it so the page is live.
3. Build the critic harness (§5).
4. Lock the Wave 1 piece list, then start spawning Composer 2.5 builders.

Go. Do not stop until the game, judged blind against StarCraft II by a fresh critic, is the one
you'd keep. If it loses, name the single biggest gap and iterate.
