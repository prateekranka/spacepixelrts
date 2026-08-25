# Starhaven Pixel UI Shell — FPE-6 Final QA Manifest

Status: **PASS with documented SwiftShader warnings**

Evidence parent: `edde763adda58279e5a8e231d6443be0166d65fe` (`FPE-5: polish responsive pixel shell and motion`)

Branch: `hermes/starhaven-pixel-ui-shell`
Generated: `2026-08-25T10:11:45+05:30`

The machine-readable manifest is [qa-manifest.json](./qa-manifest.json). It contains the exact command list, hashes, action records, dimensions, performance values, error records, and asset-size inventory.

## Reconciliation and protected truth

- PR base: `origin/chatgptpro2008` at `b406cb6c23fc562865963d31df1f4cb70e1d40a8`.
- Authored art branch: `origin/hermes/starhaven-aaa-front-end` at `9020475dd89a53ead0b3f2c0c01c189664879745`.
- Both are the merge bases of the FPE-5 integration parent, as established by FPE-0.
- Required baseline: `645b0ec90c6f60906e1114dbe46e07b4fae23934`.
- `src/sim.ts`, `src/engine.ts`, `src/render.ts`, and `src/front-end-scene.ts` are byte-identical to the baseline. The full authored civilization tree is byte-identical too.
- No gameplay, simulation, renderer/compositor, or civilization asset changes were made. The only proven integration repairs were the durable no-argument `qa:vs3` output default and regenerating tracked `desktop.html` from the corrected `index.html` so it could not retain the stale portrait font stack.

Protected SHA-256 values:

| Path | SHA-256 |
|---|---|
| `src/sim.ts` | `fb0f3d7b3e8d8a1ef97afebb7c23b3a7ad4e9bb04dc5ff6ac98437be6694dd0a` |
| `src/engine.ts` | `182830c08fb36041da67254890ba640c7fc50c251cb720bac27fd0174795c8e8` |
| `src/render.ts` | `e528bd3ffd43358bbed30e5bcf93baa2e87ce316082b79e838fffa324bc664b4` |
| `src/front-end-scene.ts` | `270e4eaf7c3feaf84de40eead31fd64e324aaa7a9e00263952efeaa75e17a32b` |
| authored civilization tree | `94d13254dba5072fd12d5d22b57036c44faddb9872b2c7e5f1150cf422f59cda` |

The distinct authored packs are:

| Pack | Scene IDs | Manifest SHA-256 | Files | Bytes |
|---|---|---|---:|---:|
| Sunweaver | `sunweaver-capital` / `sunweaver-capital` | `2c2bef314e7248cb1f21709c2ac9c74d151d5d3cc1a04318c532181039cc5f13` | 22 | 4,501,071 |
| Gravemark | `gravemark-quarry` / `gravemark-quarry` | `b9cdbc6ae85460e2271e3123bcdb2b5205d3f4dceaaa1abfd9d9e19f7bbb50c1` | 21 | 5,169,603 |

Both use authored 960 × 540 scene buffers. Their menu layer counts are 6 each; menu sprite-sheet counts are 5 and 4; loading layer counts are 5 each; loading sprite-sheet counts are 4 each. The combined authored tree is 43 files and 9,670,674 bytes.

## Gate results

Every requested protected test and QA command passed in the final run:

```text
npm run test:m0                         PASS
npm run test:aaa                        PASS
npm run test:pixel-front-end            PASS
npm run test:m2                         PASS
npm run test:m2-ai                      PASS
npm run test:m3                         PASS
npm run test:m4                         PASS
npm run test:m5                         PASS
npm run test:vs2-ai                     PASS
npm run test:vs2b                       PASS
npm run test:vs3                        PASS
npm run test:vs4                        PASS
npm run test:vs5                        PASS
npm run build                           PASS
npm run qa:pixel-front-end -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/pixel-front-end  PASS
npm run qa:aaa                          PASS
npm run qa:m1 -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/m1-flow  PASS
npm run qa:touch-contract               PASS
npm run qa:progression-handoff          PASS
npm run qa:vs3                          PASS
npm run qa:vs3 -- --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/vs3-explicit-check  PASS
npm run qa:vs5                          PASS
npm run qa:front-end -- --url http://127.0.0.1:4173 --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/front-end-regression  PASS
node scripts/measure.mjs --url http://127.0.0.1:4173/desktop.html?qa=opening&qa-run=1 --state Playing --fps-seconds 4 --wait 3 --screenshot /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/measure.png --out /home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/measure.json  PASS_WITH_WARNINGS
npm run qa:front-end-video              PASS
ffprobe ... utility-panel-interaction.mp4  PASS
git diff --quiet 645b0ec -- protected paths  PASS
git diff --check HEAD                  PASS
```

The first no-argument `npm run qa:vs3` invocation exposed a harness-only issue: the old script rejected the exact command because `--out` was mandatory. FPE-6 now derives its durable portable external default from `REPO_ROOT`, preserves explicit `--out` (also rerun successfully), and the exact no-argument command above was rerun and passed. No product assertion ran in the rejected invocation.

The final pixel matrix has 84 assertions, 80 captures, and zero errors. It covers both landscape orientations, both factions, all four landscape viewports, portrait rotate-gate sizes, utility/panel interactions, Reduced Motion, keyboard/focus/Escape, and touch contracts. Its manifest is `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/pixel-front-end/manifest.json` with SHA-256 `9e556f0bbc76fbd9ef08e14c9c997434f4de58f32b3679a5dceec9c4dc213c87`.

The built-preview front-end regression has 24 assertions, 9 screenshots, and zero errors. Its manifest is `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/front-end-regression/manifest.json` with SHA-256 `ee79c6d27630cfdbd24f0904b0421a954e5592a3d12f0a4bc53a1ef3c7108df1`.

## Focused browser flow

The honest Playwright integrator session lasted 313,550 ms (5.2258 minutes) at 1366 × 1024. Its complete action record is `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/integrator-session.json` with SHA-256 `209eb6587b35b911d50cd9bde9d4a2e0a6c36d82c88142ea6e72dde865f7c444`.

It exercised:

- Sunweaver Main Menu and the Records, Match History, Tech Codex, and Dispatches utilities, each held for 12 seconds, with readable content and focus restoration.
- Tutorial and Settings, each held for 10 seconds, plus Factions selection Gravemark → Sunweaver and focus restoration.
- Match Setup first with Gravemark, then deterministic Sunweaver vs Gravemark on `helios-rift`, Veteran, fog off, speed 1.25, on-demand tactical pause, seed `424242`.
- Loading stages `1,2,3`, one reset, then Playing. The 180-second observation ran 183,219 ms and reached tick 1,331 without a fabricated state change.
- The real terminal/results route reached Victory at tick 1,333, Results showed `01:06`, and Main Menu return hid HUD and Results.

The immediate Gravemark selection sample recorded the correct `gravemark-quarry` scene ID before `data-art-ready` settled; the packaged video capture now explicitly waits for the exact faction, scene ID, and `data-art-ready="true"`, then records that real attribute and asserts it. The session had no console errors, page errors, or request errors. It did record four SwiftShader `ReadPixels` performance warnings; these are recorded warnings, not application failures.

`qa:vs3` independently passed Victory, Defeat, Results, replay reset, terrain change, and Main Menu return. Victory and defeat fixtures showed `01:00` Results durations; replay reset to tick 4 with winner `-1` and one canvas.

## Final independent visual gate

Fresh DeepSeek blind gates inspected the final composited build, not builder summaries:

- The six-frame Sunweaver/Gravemark Menu → Match Setup → Loading contact sheet: **PASS**. Its only note requested a percentage or stage estimate; the product contract intentionally forbids fake percentage progress and ties all 16 segment changes to real lifecycle stages.
- The final compact Match History and Factions panels: **PASS** for hierarchy, shared `880px` width, empty-space balance, and clipping. The exact raw verdict is [final-panels-blind-critic.txt](./final-panels-blind-critic.txt).
- A full-resolution OCR control read the Match History copy exactly as `No matches recorded yet. Your recent Helios Rift sorties will appear here.` and returned **PASS**. This overrides a downscaled contact-sheet OCR hallucination; the measured final frame is `880 × 204px` with the accent baseline inside the panel.
- The raw flow and OCR outputs are [final-flow-blind-critic.txt](./final-flow-blind-critic.txt) and [final-history-ocr-control.txt](./final-history-ocr-control.txt).

The managed `video_analyze` endpoint returned HTTP 500, so no semantic claim rests on it. Lead verification instead used the successful in-browser action assertions, `ffprobe`, and an 11-frame two-second contact sheet from the committed MP4. The contact sheet showed each readable utility panel and the completed authored Sunweaver → Gravemark scene change, with no missing-art or black-frame defect.

## Input and persistence contracts

- Mouse hover/press: PASS.
- Keyboard Tab/Enter/Escape: PASS.
- Focus trap and focus restoration for all utility dialogs and Factions: PASS.
- Touch MOVE/GATHER/income/context/mixed filtering: PASS (`qa:touch-contract`).
- Reduced Motion normal/alternate surfaces in both factions and orientations: PASS.
- Dispatches: initial `NEW` badge, badge absent after opening, absent after reload: PASS.

## Loading and performance

The applicable renderer rule was used without weakening it: hardware GL would gate live game-work p99 below 8 ms; SwiftShader/llvmpipe records render p99 and gates deterministic five-fixed-step simulation share below 8 ms. This run used Playwright Chromium with unmasked renderer:

```text
ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)
softwareGl: true
```

`qa:m1` recorded render p99 28.2 ms, sim step 0.2808 ms, and five-fixed-step sim share 1.404 ms; the software gate passed. `qa:vs5` recorded sim share 1.411 ms and passed. The measurement is observational and is not presented as a hardware render gate:

- rAF average 123.38 ms, p99 209.7 ms, observed FPS 8, 32 frames worse than 45 FPS.
- Published Playing work p99 528.7 ms, tick 75, draws 9, entities 46, published FPS 20.
- No page errors or request issues; four SwiftShader ReadPixels warnings were recorded.

Palette measurement recorded 375 quantized colors, average luminance 25, luminance range 0–250, and 97.62% non-black pixels. The most common quantized colors were `#000011` 50.4%, `#111122` 16.3%, `#221122` 12.9%, `#221133` 3.5%, `#222233` 2.9%, `#110011` 2.5%, `#000000` 2.2%, and `#332233` 0.9%. AAA sampled menu values were Sunweaver 5244/5244/5250/5244 and Gravemark 4736/4728/4727/4736 for 1920 × 1080, 1366 × 768, 1366 × 1024, and 1180 × 820 respectively.

## Final build and PR-base impact

Final built payload sizes:

| Category | Files / aggregate |
|---|---:|
| `dist/assets/main-XOYmvciV.js` | 268,953 bytes |
| `dist/assets/three.module-D3Ki9nFI.js` | 537,741 bytes |
| `dist/assets/townCenter-P3qR8o-O.js` | 52,829 bytes |
| Built JavaScript total | 859,523 bytes |
| `dist/front-end-shell.css` | 45,617 bytes |
| `dist/front-end-scene.css` | 1,338 bytes |
| Built CSS total | 46,955 bytes |
| Font files | 93,784 bytes |
| Font files plus license/provenance files | 106,959 bytes |
| SVG icon files | 2,044 bytes |
| Authored scene packs | 9,670,674 bytes |

Against `origin/chatgptpro2008`, the accepted pre-FPE6 branch is 113 files changed, 10,497 insertions, and 3,116 deletions, including 43 civilization-pack files, 18 front-end UI/shell files, and 7 source files. The PR base has no committed `dist` tree, so there is no tracked bundle-byte delta; the generated sizes above are the final build footprint. `dist/` remains untracked/ignored and is not part of the commit.

Static truth checks passed: no front-end `hue-rotate`, `backdrop-filter`, banned Trebuchet/Segoe/Arial/generic-sans stack, or Unicode icon remains in the shell scope; no hue rotation or procedural production scene path was active in final captures. The protected authored-scene fallback remains in its unchanged implementation but was not selected.

## Committed final artifacts

All six PNGs and the MP4 are in this directory. Before frames are exact copies from the FPE-0 baseline; after frames are exact final QA captures.

| Artifact | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| [before-sunweaver-menu.png](./before-sunweaver-menu.png) | 1920 × 1080 | 1,095,076 | `a6c8c6ea0da5217066772009a3279cd2619bcfa3497b75901d9e21f61d103614` |
| [after-sunweaver-menu.png](./after-sunweaver-menu.png) | 1366 × 1024 | 507,220 | `e86f9a5127d768e8e935ef1436605a8ff7a5df14d0656e4964e2eab152cbeb65` |
| [before-gravemark-menu.png](./before-gravemark-menu.png) | 1920 × 1080 | 1,146,431 | `97bdefcfa587f9fb9880ebbd885d0ef77f0032e61b0a286e7251e84c76293093` |
| [after-gravemark-menu.png](./after-gravemark-menu.png) | 1366 × 1024 | 525,723 | `47496498298879acd4968e69c97917d14cf0011da6f3299967167095866a20ea` |
| [after-sunweaver-loading.png](./after-sunweaver-loading.png) | 1366 × 1024 | 473,388 | `f550b822fab7f22a235e5f694494846659fadcb9abdf2eae760c1e2e0e2edb54` |
| [after-gravemark-loading.png](./after-gravemark-loading.png) | 1366 × 1024 | 456,172 | `c4ddfa3523982e7923a374bff6a63cb1c01c12795fb158b44e4c01fce6b0a75b` |
| [utility-panel-interaction.mp4](./utility-panel-interaction.mp4) | 1366 × 1024 | 3,004,408 | `0746cbfeea924ed8de523c9c402057ca0808fdc06b4de5f166bdf4a86e3ddbd6` |

The MP4 is H.264, `yuv420p`, 21.56 seconds, nonzero size, and has no audio. The measurement artifacts are `/home/bobbyranka/workspace/evidence/starhaven-pixel-ui-shell/final/measure.json` (SHA-256 `dc28e3968f89183f8d858e02f11ce00cbc95e7d2cd7b0289b5cf5967c176b312`) and `measure.png` (SHA-256 `bae87c8f2dcfcc6e48278f3093ae8ecd915874b15fd6941110f00451016abb13`).

Honest limitations are unchanged: SwiftShader makes render/work p99 observational rather than a hardware gate; Loading stage 3 can be brief unless held by the truthful QA route; and this commit makes no deployment, push, or PR claim.
