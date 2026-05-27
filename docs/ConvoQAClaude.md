# ConvoQA — RacePhysiX Decisions & Open Questions

Running log. Most recent session at top.

---

## Session 40 — 2026-05-27

### Decisions Made
- **Monetisation strategy agreed**: Full details in `docs/monetisation.md`. Summary:
  - Free tier stays free forever — no features pulled back
  - Pro tier (£6–8/month): cloud saves, setup library, PDF reports, custom track upload
  - Team tier (£20–25/month): multi-user, FS Edition, API access, priority support
  - Consulting (one-time): setup analysis reports at £100–250 each
  - Formula Student teams identified as the priority wedge (replaces OptimumLap)
- **Licence change decided**: MIT → **AGPL v3** + commercial dual licence
  - AGPL v3: free for non-commercial, viral clause deters commercial extraction
  - Commercial licence: sold separately to companies wanting non-AGPL terms
  - MIT rejected: no protection against commercial exploitation
  - BSL rejected: not technically open source, unnecessary friction
- **Competitive position confirmed**: RacePhysiX is uncontested in browser-based space.
  OptimumLap (~$250/yr, desktop) is the incumbent to displace for FS + club racing.
- **v3 FEA direction confirmed** (from memory `project_v3_fea_direction.md`):
  - Tauri + Rust WASM + WebGPU, ~200–500 element tyre shell model
  - ~95% accuracy target, matches FTire-class on consumer hardware
  - Srikar leads FE formulation; Claude implements solver
  - Prerequisite: v2 stable + generating revenue first
- **Docs updated**: `project-overview.md` rewritten, `docs/monetisation.md` created,
  `docs/roadmap.md` created (v1/v2/v3 milestones + FEA prerequisites)
- **Canvas button layout fixed**: flex group + centred ViewLabels (see LatestTask.md Session 40)

### Open Questions / Next Steps
- [ ] Implement licence change (LICENSE file + README + package.json)
- [ ] GitHub Sponsors page
- [ ] Marketing Phase 1: README, screenshots, community posts
- [ ] Pro tier waitlist landing page (before building auth/billing)
- [ ] M5b: 3D effects (brake glow, body roll) — deferred, Three.js work

---

## Session 11 — 2026-03-16

### Decisions Made
- **5 new circuits**: Added nurburgring_gp, bahrain, barcelona, hungaroring, montreal. GPS-derived from TUMFTM Racetrack Database (LGPL-3.0). Circumradius segmentation: 3-point circumradius → rolling-mean smooth (w=9) → threshold 200m → merge consecutive same-type segments → harmonic-mean radius per corner. Lengths accurate to ≤9m; corrected by adjusting largest straight. Attribution comment in every circuit block.
- **TUMFTM CSV filenames**: Nuerburgring.csv, Sakhir.csv (not Bahrain), Catalunya.csv, Budapest.csv, Montreal.csv.
- **Assetto Corsa tracks**: CANNOT be used — EULA explicitly prohibits public/educational use.
- **Race simulation**: `simulateRace()` added to laptime.ts. Tyre model: exponential warmup (TC=2.5 laps) then linear drift (1.5°C/lap); μ = Gaussian bell. Fuel model: mass decreases per lap. Sectors split at 1/3 and 2/3 distance (not circuit-specific sector markers).
- **Fuel params**: Added to VehicleParams (`fuelLoadKg`, `fuelBurnRateKgPerLap`). Defaults: 45 kg load, 2.5 kg/lap burn.
- **Race UI**: Race Simulation section in LapTimePanel. Num-laps slider, start-temp slider, "Simulate Race" button, results table. Fastest lap marked with ★.

### Open Questions
- [x] Browser verify: race sim tyre warmup visible in first 3 laps; degradation after ~10 laps — confirmed Session 39
- [x] Track editor: user-editable segment table with live SVG preview — Stage 15 ✅
- [x] Deploy to Cloudflare Pages — live since Session 25

---

## Session 6 — 2026-03-15

### Decisions Made
- **Test reports**: Stored in `docs/test-reports/` — one file per test type (physics, UX). After fixes applied, content trimmed to brief status table.
- **Understeer colour**: Changed from orange to blue across TopDownView + ResultsPanel. Matches MoTeC/Bosch DDU/Pi Toolbox convention. Orange was non-standard.
- **TopDownView overlays**: All three (`TyreCompoundBadge`, `AeroOverlay`, `CornerLoadGauges`) wrapped in a `position:absolute left:0 width:60%` container. Chase View (right 40%) is now always clear.
- **Spa distance**: Code review agent alleged Spa was 1000m short. Manual node verification showed original code was already correct at 7004m. Agent made arithmetic error. No change made.
- **Final-straight braking**: Replaced `(i+1) % n` single-step lookup with forward scan to find next corner — fixes braking target missing on lap close for all 5 real circuits.
- **Lap time format**: 3dp → 1dp (mm:ss.s / ss.s). Matches model accuracy.
- **Track selector**: Added `<optgroup>` separating Generic from Real Circuits.

### Decisions Made (continued)
- **v1 scope expanded**: Stages 9–13 added to v1, all must ship before public launch. Roadmap updated in `CLAUDE.md`.

### Open Questions
- [x] Browser verify: Chase View visible, overlays in top-down panel only — confirmed Session 39
- [x] Browser verify: track maps for all 5 circuits — confirmed
- [x] Remaining open UX items — resolved Session 39 (no open UX items)
- [x] Deploy to Cloudflare Pages — live since Session 25

---

## Session 5 — 2026-03-15

### Decisions Made
- **Arc lengths fixed**: All 5 real circuits recalculated using `arc = R × θ`. Filler straights adjusted to preserve exact total distances. All verified to the metre.
- **Direction tags fixed**: CW circuits → `'left'`, CCW circuits → `'right'`, chicane pairs alternate (T1 against, T2 with). Monza: Lesmo 1/2 + Parabolica fixed. Monaco: Casino Square, Nouvelle Chicane, Swimming Pool, Anthony Noghes. Spa: Malmedy, Pouhon, Campus, Bus Stop. Silverstone: Abbey, Farm, Loop, Aintree. Suzuka: Turn 2, 130R, Casio.
- **Theme toggle moved**: `right: 8px` → `left: 8px`. Eliminates overlap with tyre compound badge.
- **Extended test suite created**: `src/physics/test-extended.ts` — 178 checks across sections A–H. All pass.
- **Skills created**: `.claude/commands/test.md` (physics testing, sub-agents), `.claude/commands/test-ux.md` (UX testing, sub-agents). Global: `~/.claude/commands/session-start.md`.
- **V_ch formula**: Characteristic speed is `sqrt(L / K_rad)` NOT `sqrt(g×L / K_rad)`. Derivation: set δ = 2×L/R in the handling equation → K_rad×V² = L.

### Open Questions
- [x] Deploy to Cloudflare Pages — live since Session 25
- [x] Browser verify: track maps for all 5 circuits — confirmed
- [x] Stage 8 browser test: all 3 scenarios render charts without crash — Stage 8 ✅
- [x] Run `/test` and `/test-ux` skills — 424/424 tests pass

### Resolved Bugs
- [x] Bug 1: Corner arc lengths > 2π — fixed all 5 circuits
- [x] Bug 2: Direction tags wrong — fixed all 5 circuits
- [x] Bug 3: Theme toggle overlaps tyre badge — moved to left side

---

## Session 4 — 2026-03-15

### Decisions Made
- **Stage 8**: Implemented — 14-state RK4 ODE integrator, 3 ISO scenarios (step steer, sine sweep, brake-in-turn)
- **Slip angle sign convention**: SAE y-left frame — `α = steerAngle − atan2(Vy_contact, Vx_contact)`. Positive δ → positive α → positive Fy (leftward centripetal). Verified by Check 8–10 passing.
- **Check 8 fix**: Dynamic steady-state psiDot = `avgVx_final / R` (not initial Vx/R), because throttle=0.3 accelerates car over 5s
- **Real circuits**: Added Monza/Monaco/Spa/Silverstone/Suzuka to TRACK_PRESETS. Total distances correct.
- **Visualizer**: Added suspension struts (Fz-colored), downforce arrows (aero > 100N), tyre badge (peakMu), road surface, corner load gauges, aero overlay panel
- **SVG direction convention**: `direction: 'left'` (default) = heading increases = **clockwise on screen** (y-down flip). `direction: 'right'` = counter-clockwise on screen.

### Open Bugs (must fix next session — see LatestTask.md)
- [x] Bug 1: Circuit corner arc lengths are wrong — fixed Session 5
- [x] Bug 2: Direction tags wrong on real circuits — fixed Session 5
- [x] Bug 3: Theme toggle button overlaps tyre badge — fixed Session 5

### Open Questions
- [x] Deploy to Cloudflare Pages — live since Session 25
- [x] Stage 8 validation: run browser test for all 3 scenarios — Stage 8 ✅
- [x] After circuit fix: verify track maps look plausible — confirmed

---

## Session 3 — 2026-03-15

### Decisions Made
- **Tech stack**: Locked — TypeScript + React + Vite + Three.js + Recharts
- **Hosting**: Cloudflare Pages — `racephysix.srikarbuddhiraju.com`
- **Validation standard**: 18 checks pass — Stages 1–3 (Gillespie) + Stages 4–6 (hand-calc)
- **Export format**: CSV (params + results) + SVG (chart)
- **URL sharing**: btoa/atob over JSON.stringify(params)
- **Track map SVG**: Procedural — walk segments, arcs use `arcLength/radius` radians
- **v1 status**: Feature-complete (Stages 1–7). Stage 8 added in Session 4.

---

## Session 1 — 2026-03-15

### Decisions Made
- **Project name**: RacePhysiX
- **Physics accuracy standard**: Validate against Milliken & Milliken AND real-world data
- **Session start checklist**: ConvoQAClaude.md + lessons.md + LatestTask.md
- **Physics reference docs**: `docs/physics-reference/`, 200-line limit each
