# A6 — Integration & Tool Sprawl Audit (read-only)

Date: 2026-08-26 · Worktree: `hermes/forge-trace` @ `ced0b94` (clean) · Main checkout: `hermes/starhaven-aaa-front-end` @ `ced0b94` + uncommitted FRD work.
Scope: shared server/capture/manifest/browser helpers across `scripts/*.mjs`; smallest safe boundary vs. concurrent Forge Review Deck (FRD); prod-leak + branch-conflict risks. No files modified except this report.

## 1. Duplicated helper inventory

Every QA script re-implements the same bootstrap block (~40 lines each). Totals across 34 scripts:

| Helper | Definition lines (named files) | # files | Notes |
|---|---|---|---|
| `parseArgs` | qa-vs5:29, qa-vs2:37, qa-m2-ai:24, self-view:37, qa-vs3:24, qa-m4:36, qa-m1:26 | 17 | identical `--k=v` / `--k v` parser |
| `resolveOut` | qa-vs5:42, qa-vs2:50, qa-m2-ai:37, self-view:65, qa-m0:88 | 17 (+1 `resolveOutput` qa-front-end-rebuild:48) | repo-escape guard vs `REPO_ROOT` |
| `delay` | qa-vs5:53, qa-vs2:62, qa-m2-ai:49, self-view:77 | 17 | one-liner, copy-pasted |
| `findOpenPort` | qa-vs5:57, qa-vs2:66, qa-m2-ai:53, self-view:109, qa-m0:153 | 17 | net.listen(0) pattern |
| `startServer` | qa-vs5:75, qa-vs2:84, qa-m2-ai:71, qa-vs3:74, qa-m4:80 | 14 + self-view `startDevServer`:127 | spawn vite `--host 127.0.0.1 --port --strictPort`, `detached:true`, fetch-poll 120s |
| `stopServer` | qa-vs5:103, qa-vs2:110, qa-m2-ai:99, self-view `stopDevServer`:153 | 14 + 1 | `process.kill(-pid,SIGTERM)` → SIGKILL escalation; **not present in qa-aaa-front-end.mjs / qa-m0.mjs** (leak risk) |
| `analyzePng` | qa-vs5:123, qa-vs2:137, qa-m2-ai:128, qa-m0:288, qa-vs4:194 | 14 + self-view `analyzeCell`:251 (richer: palette adherence) | pngjs `PNG.sync.read`; luminance/litRatio gates |
| `settle` / `settleFrames` | qa-vs5 `settle`:145, qa-vs2:168, qa-m2-ai:154, self-view:189, qa-vs3 `settle`:112 | 15 | double-rAF |
| `launchBrowser` | self-view:172 only (chrome → `/usr/bin/chromium` → bundled) | 1 named; ~20 inline | others inline the 2-attempt `channel:'chrome'` fallback: qa-vs5:271-275, qa-vs2:330-334, qa-m2-ai:186-190, qa-front-end-rebuild:525, qa-aaa-front-end:225; `measure.mjs:20-30` / `screenshot.mjs:18` assume chrome only (no fallback) |
| manifest write | qa-vs5:805-806, qa-vs2:532-533, qa-m2-ai:351-352, self-view:523-524 | ~all | ad-hoc shapes: `{tool,startedAt,finishedAt,args,checks,captures,errors,ok}`; no schema, no git meta |

Browser-launch divergence is the sprawl cost: 3 variants (chrome-only, chrome→bundled, chrome→/usr/bin/chromium→bundled). The FRD spec (`docs/FORGE_REVIEW_DECK.md`, main checkout, untracked) builds the *same* helper set as `tools/forge-review/lib/{server,browser,pixels,git-meta,manifest,capture}.mjs` — that is the consolidation target, but see §2: we must not import it either.

## 2. Smallest safe integration boundary with Forge Review Deck

Recommendation: **a URL `frameRef` contract + a `reviewBaseUrl` option only. No code imports in either direction.**

- `frameRef` (stable, all keys already shipped at `ced0b94`; unknown keys ignored — forward compatible):
  - `qa=<scenario>` — id from `makeScenario('([a-z0-9-]+)')` in `src/qa-scenarios.ts` (self-view:87). No encoding needed; use `encodeURIComponent` anyway.
  - `orientation=landscape-left|landscape-right` (self-view:402 pattern).
  - `qa-seed=<0..2^32-1>` decimal — deterministic seed override (FRD spec §Seed correctness; legacy defect was config-pinned `0x5eed`).
  - `qa-run=1` — frozen deterministic run (qa-m2-ai:200).
  - Optional future: `view=ui-free|selected-scout|close|far` mapping self-view extras (lines 439-444) — declare later, never break.
  - Example: `http://127.0.0.1:5173/?qa=opening&orientation=landscape-left&qa-seed=424242&qa-run=1`
- Response contract: the page's `globalThis.__STARHAVEN_QA__` probe (`{state,scenario,config,seed,fps,p99FrameMs}`) — read-only, exists in prod bundle (see §3). Do NOT depend on FRD's `__STARHAVEN_FORGE__` control (installs only when `import.meta.env.DEV && forge=1`).
- `reviewBaseUrl`: a `--review-base-url` flag / `reviewBaseUrl` manifest arg so deck tools reuse an already-running server (self-view already has `--url`; QA scripts do not). Default: boot own vite via the §1 lifecycle.
- Explicitly out of scope: importing `tools/forge-review/lib/*`, sharing `src/dev/*`, editing `src/sim.ts`/`src/engine.ts` (FRD hard constraint #1), or touching `docs/FORGE_REVIEW_DECK.md` (concurrent agent owns it, untracked).

## 3. Production-leak risks (Forge Trace stays out of dist)

- What lands in dist: `vite.config.ts` `rollupOptions.input` = `index.html` (game), `desktop.html`, `town-center-viewer.html`; separate `dist-structural` via `vite.structural.config.ts`. `public/` is copied verbatim into dist — **never place forge HTML in `public/`** (precedent already leaks there: `public/buildings.html`, `progress.html`, `reference.html`).
- `src/main.ts` imports verified at `ced0b94`: engine/sim/render/input/hud/audio/content/opening-presentation/start-screen/app-flow/match-config/qa-scenarios/player-profile — **no forge references**. `?qa=` routes ship in the prod bundle by design (that is why the §2 URL contract is prod-safe); FRD's `forge=1` control correctly does not.
- Required posture: forge-trace UI = standalone self-contained HTML artifact written to the evidence dir — the `composeBoard` pattern (self-view:319-356: inline data-URL PNGs + inline CSS, no external refs) is the template. Never a repo-root HTML, never a vite input, never imported by `src/main.ts`.
- Verification (run at integration time; read-only now): no `dist/` exists in either checkout (clean baseline). Gate: `npm run build && grep -riE 'forge|self-view|review' dist/ dist-structural/` → zero hits; FRD's own test suite asserts the same for its inputs.

## 4. Branch-conflict risks vs. parallel agent (main checkout)

- Main checkout `hermes/starhaven-aaa-front-end` @ same base `ced0b94`, dirty: `package.json` (+`forge:review`, `forge:review:capture` scripts), `src/main.ts`(+44), `src/qa-scenarios.ts`(+24), `src/render.ts`(+83); untracked `docs/FORGE_REVIEW_DECK.md`, `scripts/forge-capture.mjs`, `scripts/qa-forge-review.mjs`, `src/dev/`, `tests/forge-review.test.ts`, `tools/`, `tsconfig.forge.json`, `.hermes/`.
- Conflict surfaces: **package.json** (both agents add scripts; ours would collide at `"self-view"` vicinity), **PROGRESS.md** (tracked, shared), **docs/** (FRD doc untracked; our docs/ edits would land in a different worktree but share the tree at merge time).
- Mitigation: we own `hermes/forge-trace` only; our worktree is clean and isolated. Parent applies package.json script edits (we do NOT edit it in our branch); never touch untracked `FORGE_REVIEW_DECK.md`; keep our changes inside `scripts/` + `tasks/forge-trace/`; final integration cherry-picks our commits into our branch only — parent reconciles the shared files. Same-base branches mean merges are trivial unless both edit package.json/src — hence the ownership split.

## 5. Process-hygiene checklist (every QA/capture run)

1. Kill vite process group: `stopServer` does `process.kill(-child.pid, SIGTERM)` then SIGKILL escalation (detached spawn = own pgid). Manual fallback: `pkill -f 'node_modules/.bin/vite'` — never kill by port only.
2. Close browser in `finally`: `browser.close()` (self-view:520). Headless chromium exits with its parent Playwright driver; check `pgrep -af 'chromium.*--headless'`.
3. Verify no listeners remain: `ss -tlnp | grep 127.0.0.1` (ephemeral QA ports must be gone); `pgrep -af 'node_modules/.bin/vite'` → empty.
4. Note: scripts without `stopServer` cleanup in their failure path — `qa-aaa-front-end.mjs` (no stopServer def; browser close at :225 catch only) and `qa-m0.mjs` — retest these; FRD acceptance E2E already gates "zero leaked processes (vite/chromium/helper)" — adopt that as our shared bar.
5. Currently no vite/chromium QA processes running (only the user's own Chromium session, unrelated).

**Verdict:** consolidation target is `tools/forge-review/lib/*` once FRD lands, but the *contract* we ship today is the frameRef URL + `__STARHAVEN_QA__` probe + `reviewBaseUrl` option — stable with zero cross-agent imports. No prod-leak vector exists at `ced0b94`; enforce the dist grep gate at build time.
