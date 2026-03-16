# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 9 — 2026-03-16  |  branch: `feature/stage8-14dof-timedomain`

### Status: IN PROGRESS — Stages 10+11 implemented, browser verification pending

### Completed this session (Session 9)
- [x] Stage 10: Gear model — `src/physics/gearModel.ts` (geometric ratio progression, flat torque + constant power curve, optimal gear selection)
- [x] `VehicleParams` + 7 Stage 10 fields + 4 Stage 11 fields
- [x] `LapSimInput`: `enginePowerKW` removed, `driveForce: (V)=>N` added
- [x] `LapTimePanel.tsx`: binds `computeMaxDriveForce` from gearModel
- [x] Stage 11: Tyre thermal model — `src/physics/tyreTemp.ts` (bell-curve f(T), k=ln2/hw², floor enforced)
- [x] `pacejkaModel.ts`: `peakMu` thermally-corrected at top of `computePacejkaModel` — flows through all Pacejka calls
- [x] `ParameterPanel.tsx`: Stage 10 + Stage 11 sections with sliders + derived display
- [x] `validate.ts`: Checks 11+12 — all pass; `test-extended.ts`: Sections I+J — all pass
- [x] `npx tsc --noEmit` → 0 errors
- [x] `npx tsx src/physics/validate.ts` → 16/16 pass
- [x] `npx tsx src/physics/test-extended.ts` → 209/209 pass

### Verification still needed (browser)
- [ ] Vehicle tab shows "Engine & Gears (Stage 10)" + "Tyre Temperature (Stage 11)" sections
- [ ] Stage 10 derived display: T_peak, top speed, gear ratio list
- [ ] Stage 11 derived display: μ fraction, grip deficit, tyre status
- [ ] Changing gear count updates ratio list; changing tyre temp changes μ fraction live
- [ ] Lap time changes when switching gear count (6 vs 4 gears on same circuit)

### Next steps
- [ ] Merge `feature/stage8-14dof-timedomain` → `main` (release gate pending browser verify)
- [ ] Stage 12: Setup optimisation
- [ ] Stage 13: Full nonlinear

---

## Session 8 — 2026-03-16  |  branch: `feature/stage8-14dof-timedomain`

### Status: COMPLETE

### Completed this session (Session 8)
- [x] Stage 9: Tyre load sensitivity (carried from S7) — 10/10 validate, 178/178 extended pass.
- [x] Track map arc math fixed: `buildTrackPath` had 3 bugs (sign inversion, sweepFlag inversion, end-point sign error) — all due to y-up vs y-down coordinate confusion. Circuits now topologically correct.
- [x] Track map: game-style double-stroke rendering (thick outer kerb + thinner road surface).
- [x] Track map: `vectorEffect="non-scaling-stroke"` — path always visible at any circuit scale.
- [x] Track map: S/F marker and arrow now scale relative to viewBox (always visible).
- [x] Track map: ▶ Play button — animates a red dot around circuit in 5s, speed proportional to segment times (fast straights, slow corners). Uses `getTotalLength` + `getPointAtLength`.
- [x] Track map: `svgPath?` / `svgViewBox?` fields added to TrackLayout interface for future GPS data.
- [x] `tsc --noEmit` → 0 errors.

### Known limitation
- Circuit shapes are topology-correct schematic approximations (heading accumulation from arc data). They show the right sequence of corners/straights but won't match GPS-accurate layouts. Real GPS data should be fetched in a dedicated session from OpenStreetMap or F1 datasets.

### Next steps — Session 9

#### Release gate
- [ ] Browser verify: all 5 circuits render recognizable shapes; Play animation works
- [ ] Browser verify: Stage 9 slider affects Pacejka curves in chart
- [ ] Browser verify: Chase View clear, all overlays in top-down panel
- [ ] Merge `feature/stage8-14dof-timedomain` → `main`
- [ ] Deploy to Cloudflare Pages (`apexsim.srikarbuddhiraju.com`)

#### Circuit maps (future session)
- [ ] Fetch GPS trace data for 5 real circuits from OpenStreetMap (circuits are public domain)
- [ ] Convert to normalized SVG path and store as `svgPath` in TRACK_PRESETS
- [ ] This will give pixel-perfect game-radar style circuit outlines

#### Stages 10–13
- [ ] Stage 10: Gear model — gear ratios, shift points, rev-limited power curve
- [ ] Stage 11: Thermal tyre — temperature vs μ, warm-up/degradation
- [ ] Stage 12: Setup optimisation — auto-find spring/ARB/aero for min lap time
- [ ] Stage 13: Full nonlinear — separate front/rear Cα, Stage 8 transients in lap sim

---

## Session 6 — 2026-03-15  |  branch: `feature/stage8-14dof-timedomain`

### Status: COMPLETE

### Completed this session
- [x] First `/test` run: 178/178 extended pass, 10/10 validate pass, build clean
- [x] First `/test-ux` run: 5 P1 bugs, 13 P2 issues identified
- [x] Test reports saved: `docs/test-reports/physics-test-report.md`, `docs/test-reports/ux-test-report.md`
- [x] Fix: TopDownView overlays wrapped in 60%-width container — Chase View no longer buried
- [x] Fix: Understeer colour orange → blue (MoTeC/Bosch industry convention)
- [x] Fix: `DL` → `DF` label in AeroOverlay (standard abbreviation)
- [x] Fix: View labels 9px dim → 11px/muted (readable on dark canvas)
- [x] Fix: Trailing `%` removed from AWD split / Aero balance / Brake bias sliders
- [x] Fix: Kinematic steer sub-label `(L/R)` → `(each wheel)` (clear language)
- [x] Fix: BCD tooltip clarified N/rad vs N/deg
- [x] Fix: lap time segment format 3dp → 1dp (matches estimator precision)
- [x] Fix: Track selector `<optgroup>` — Generic / Real Circuits separated
- [x] Fix: Final-straight braking wrap — scans forward for next corner (all 5 real circuits)
- [x] Note: Spa total was ALREADY correct at 7004m — code review agent made arithmetic error
- [x] `npx tsc --noEmit` → 0 errors, all validation passes

### Next steps — Session 7

#### PRIORITY: Circuit visuals (janky — must fix first)
- [ ] Audit all 5 circuit SVG outputs in browser — screenshot each
- [ ] Fix: direction-of-travel arrow on track map (start/finish to first corner)
- [ ] Fix: "S/F" label on the start dot (currently unlabelled 4px circle)
- [ ] Fix: circuit shapes don't look like real layouts — investigate heading accumulation, filler straight placement, and arc direction tags
- [ ] Fix: add corner numbers to segment table (e.g. "Eau Rouge" not "R22m")
- [ ] Fix: track selector thumbnails look similar for Monaco/Silverstone — add scale bar or total distance card

#### UX open items
- [ ] Add vehicle identity strip to LapTimePanel (mass / power / μ — so lap time has car context)
- [ ] Add suspension strut + downforce arrow legend entries to TopDownView
- [ ] Fix: lap time CSV export to actually export lap time + segment data + circuit name

#### Stages 9–13 (v1 expanded scope — implement before launch)
- [ ] Stage 9: Tyre load sensitivity — Pacejka B/C/E as functions of Fz
- [ ] Stage 10: Gear model — gear ratios, shift points, rev-limited power curve
- [ ] Stage 11: Thermal tyre — temperature vs μ, warm-up/degradation curves
- [ ] Stage 12: Setup optimisation — auto-find spring/ARB/aero for min lap time
- [ ] Stage 13: Full nonlinear — separate front/rear Cα, Stage 8 transients in lap sim

#### Release gate
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] Browser verify: Chase View clear, all overlays in top-down panel
- [ ] Merge `feature/stage8-14dof-timedomain` → `main`
- [ ] Deploy to Cloudflare Pages (`apexsim.srikarbuddhiraju.com`)

---

## Session 5 — 2026-03-15  |  branch: `feature/stage8-14dof-timedomain`

### Status: COMPLETE

- Arc lengths fixed for all 5 circuits. Direction tags fixed. Theme toggle moved.
- Extended test suite 178/178. Skills: test.md, test-ux.md, session-start.md.
- lessons.md, ConvoQAClaude.md updated.

---

## Sessions 1–4 — 2026-03-15  |  Status: COMPLETE / MERGED

- S1: Scaffold, bicycle model, Pacejka, Three.js TopDownView
- S2: Load transfer, drivetrain, dark/light theme
- S3: Stages 4–7 (suspension, braking, aero, lap time), track map SVG, 18 validation checks pass
- S4: Stage 8 (14-DOF time-domain, 3 ISO scenarios), 5 real circuits, visualizer enrichments
