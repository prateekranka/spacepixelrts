# Starhold — live status

**Play:** https://spacepixelrts.pages.dev  
**Bar:** Age of Empires II: Definitive Edition, blind, on the running game.

## Now

**Sunweaver Town Center — neutral-clay structural rebuild in progress** (asset `SunweaverTownCenter_Structural_v01`). Loop: Sol orchestrates, Luna Max A implements via local Codex (`codex exec -m gpt-5.6-luna`), Luna B is the blind visual critic. Bar: structural fidelity >= 0.70 with every gate passing vs the approved reference pack.

- PTC-CLAY-02 wings: ACCEPTED (radial lobes, no pagoda roofs).
- PTC-CLAY-03 crown (broad faceted mandorla + front spine + collar): ACCEPTED (gate a PASS).
- PTC-CLAY-06 diagonal bent-talon cage: **all five structural gates PASS** for the first time (interlocking four-talon cage reads in front ortho — the 4-round crown interlock fight is closed). Committed `cd66387`.
- PTC-CLAY-07 re-proportion + central energy-vault (`59f7a88`): lower mass rebuilt to the reference profile (total ~11.7 tall on 7-unit footprint; two-tier plinth; tall vaulted front). Proportions layer fixed 0.5→0.7. Gates (b)(c)(d)(e) PASS.
- Round 7 critic: overall 0.60; gate (a) regressed — mandorla reads as hollow portal (needs solid faceted vault + dominant spine), side towers approach crown height. Round 8 (PTC-CLAY-08) in flight.
- PTC-CLAY-08 (`94453a2`): mandorla base 0.95, spine 0.22×0.18, towers lowered to top ~8.2. Proportions hold at 0.7; gates (b)(c)(d)(e) PASS.
- PTC-CLAY-09 (`5e57a47`): mandorla rebuilt as convex faceted shell + dominant ridge; luminance gate proves mandorla is bright-centered. PTC-CLAY-10 (`741246b`): mandorla fills the talon cage (max half-width 1.15), talons hug it.
- PTC-CLAY-11 (`3e1d9dc`): energy-vault dark recess replaced with a solid convex faceted jewel + small base doorway; vault-luminance gate PASS. Gates (b)(c)(e) underlying geometry accepted.
- ROOT CAUSE of the persistent gate-(a) "hollow/portal/void" (all 7 rounds of it): an independent critic's pixel probe on the REAL capture shows the crown center at luma 89 vs background 133 — DARKER than the void. The isolated luminance gate (which hides the talon cage) measured the same center at 143 (bright). The talon cage's front panels + shadows OCCLUDE and darken the mandorla center in the real image — that is the "dark inner void" every critic saw. Old gate measured the wrong (cage-hidden) view.
- Round 12 (PTC-CLAY-12 `a186e39` + `7fc816c`): central column UNIFIED (vault -> collar -> crown as one continuous convex faceted form, no collar ledge — no-shelf gate PASS) + front-biased key light so the column reads lit. Objective: real-capture crown center luma rose 88-124 -> 106-174 (above the 133 background in most bands); vault band still ~88-117 (one residual dark spot). p99 3ms, errors 0.
- Reviewer noise remains high on gate (a) after 13 rounds (descriptions have hallucinated "pyramid towers / squat gabled core" that contradict verified geometry). Best recent overall 0.6 with (b)(c)(e) PASS. Checkpoint for user eyes on the crown before further gate-(a) rounds.
- **Gate (a) BREAKTHROUGH (round 12 post-light review):** overall 0.59 — gate (a) PASS (unified solid jewel-column reads, no hollow/portal), (b) PASS, (e) PASS. The front-biased key + column unification were the answer to the 13-round combat.
- Round 13 (PTC-CLAY-13 `ed166c0`): stepped plinth rims + 14-tread south stair with landing + entrance collar. Stair gate (d) now PASSES in the full blind critic. Reviewer noise persisted on (a)/(b)/(c); the luna orchestrator (via opencode-go) ruled DECISION (a): accept the clay geometry baseline, move to materials/palette.
- **Toolchain switched to bobbyranka opencode-go account** (`https://opencode.ai/zen/go/v1`): implementer = **hy3** (max thinking) via `opencode run -m opencode/hy3`; orchestrator + blind visual critic = **gpt-5.6-luna** (max) via `opencode run -m opencode/gpt-5.6-luna` with `-f` image attachments (verified: reads images; crown reads SOLID; key registered in ~/.local/share/opencode/auth.json and opencode provider baseURL points at zen/go/v1; helper scripts/go-ml.mjs + opencode CLI). The codex/openai route is quota-blocked until Aug 24.
- PTC-MAT-01 (hy3, `0452b04`): palette pass on the accepted clay geometry — ivory stone, gold trim, teal #7AB591 / cyan #36C9FF emissive crystal column, deep blue #1E3A6D; beauty-clay default preserved; palette captures added; p99 4.7 ms. Crystal crown center confirmed cyan; stone ivory; gold apex.
- PTC-MAT-02 (hy3, `87cea81`): material craft — layered gold bands (drums/vault/wing arches/talon feet/stair lip), darker stone recesses + masonry courses, crystal emissive ~2x with deep-blue facets. Independently verified: shots 0 errors, palette p99 5.0 ms, crown center cyan.
- Palette critic #2: FAIL (0.48, material 0.54), new gap = "ornamental complexity across vault/wings/facade". Scores drift down on improvements (0.56→0.48) — goalpost symptom again. **luna orchestrator ruling: DECISION b** — integrate into the RUNNING GAME + deploy, judge in-context; defer ornament until in-game evidence.
- **Deployed**: structural palette viewer LIVE at https://spacepixelrts.pages.dev/town-center-structural-viewer.html?ui=0&view=front-3q&stage=4&pass=palette&freeze=1 (200 OK). The in-game Town Center is still a 2D sprite billboard; 3D integration = the next staged piece (renderer pipeline change; Wave A still awaits user sign-off).
- Objective gates hold throughout: p99 ~3-5 ms (< 8), console errors 0, gameplay captures distinct, no rear stair, footprint 7.0.

## Tracker

| Wave | Status |
|---|---|
| 0 docs/harness/deploy | done |
| 1–6 + art gaps | **PASS** |
| Wave A P94 iso projection | **PASS** |
| Wave A P95 emissive team color | **PASS** |
| Wave A P96 terrain elevation | **PASS** `tasks/P96-critic.md` |
