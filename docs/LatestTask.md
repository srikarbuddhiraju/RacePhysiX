# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 11 — 2026-03-16  |  branch: `feature/stage8-14dof-timedomain`

### Status: IN PROGRESS — 5 new circuits + race simulation + UI complete

### Completed this session (Session 11)
- [x] VehicleParams: added `fuelLoadKg` (default 45 kg), `fuelBurnRateKgPerLap` (default 2.5 kg/lap)
- [x] App.tsx: fuel defaults added
- [x] laptime.ts: 5 new GPS-accurate circuit presets (TUMFTM LGPL-3.0)
  - `nurburgring_gp` — Nürburgring GP (5.148 km) — 29 segments from 1029 GPS pts, ±3 m
  - `bahrain` — Bahrain International Circuit / Sakhir (5.412 km) — 32 segs, ±9 m
  - `barcelona` — Circuit de Barcelona-Catalunya (4.655 km) — 28 segs, ±7 m
  - `hungaroring` — Hungaroring / Budapest (4.381 km) — 27 segs, ±1 m
  - `montreal` — Circuit Gilles Villeneuve (4.361 km) — 27 segs, ±3 m
  - Algorithm: circumradius (3-pt) → 9-pt rolling mean → 200m threshold → merge → harmonic-mean R
  - Attribution: TUMFTM LGPL-3.0 comment in every circuit block
- [x] laptime.ts: `simulateRace()` function
  - Per-lap tyre temp: exponential warmup (TC=2.5 laps) → 1.5°C/lap degradation
  - μ fraction: Gaussian bell curve (tyreTempHalfWidthC, tyreTempFloorMu from VehicleParams)
  - Fuel burn: mass -= fuelBurnRateKgPerLap per lap
  - Sector splits at 1/3 and 2/3 cumulative distance
  - Returns LapData[] (lap, lapTimeSec, s1/s2/s3Sec, tyreTempC, muFraction, fuelMassKg, gapToFastestSec)
- [x] LapTimePanel.tsx: Race Simulation section
  - Laps slider (1–50), Start tyre temp slider (10–80°C)
  - Fuel load + burn rate display (from params)
  - "Simulate Race" button (async setTimeout)
  - Results table: Lap | Time | Gap | S1 | S2 | S3 | T°C | μ% | Fuel | fastest lap ★
- [x] LapTimePanel.tsx: Track selector — 5 new circuits in Real Circuits group
- [x] ParameterPanel.tsx: "Fuel & Race" section (fuelLoadKg, fuelBurnRateKgPerLap sliders)
- [x] validate.ts + test-extended.ts: BASE params updated with fuel fields
- [x] `npm run build` → clean (0 errors)
- [x] `npx tsx src/physics/validate.ts` → 21/21 pass
- [x] `npx tsx src/physics/test-extended.ts` → 309/309 pass

### Verification needed (browser)
- [ ] Lap time panel: 5 new circuits appear in selector and produce sensible lap times
- [ ] Race simulation: Simulate Race button produces results table with tyre warmup visible
  (lap 1 should be slower, laps 3–5 near fastest, later laps degrade)
- [ ] Fuel burn visible: lap times improve slightly lap-over-lap as mass drops
- [ ] ParameterPanel: Fuel & Race sliders visible in Vehicle tab

### Next steps
- [ ] Track editor UI (user-editable segment table + live SVG preview + JSON import/export)
- [ ] Commit this session's work on current branch
- [ ] Merge `feature/stage8-14dof-timedomain` → `main`
- [ ] Deploy to Cloudflare Pages

---

## Session 10 — 2026-03-16  |  branch: `feature/stage12-setup-optimisation`

### Status: COMPLETE

### Completed this session (Session 10)
- [x] Stage 12: Setup optimiser — Nelder-Mead simplex over 7 parameters
- [x] Stage 13A: Separate front/rear Cα — per-axle understeer gradient, slip angles
- [x] Stage 13B: Combined slip friction circle — ay_max = sqrt(μ² − brakeDemand²)
- [x] Stage 13C: Yaw transient penalty — τ = m×V/(2×(CαF+CαR)), t_penalty added per corner
- [x] Black screen fix: `npm run build` surfaced 2 tsc -b errors (not caught by tsc --noEmit)
- [x] HMR state mismatch fix: `(params[key] as number) ?? min` guard in SliderRow
- [x] `npm run build` → clean; validate 21/21 pass; test-extended 235/235 pass

---

## Session 9 — 2026-03-16  |  branch: `feature/stage8-14dof-timedomain`

### Status: COMPLETE

### Completed this session (Session 9)
- [x] Stage 10: Gear model — geometric ratio progression, flat torque + constant power
- [x] Stage 11: Tyre thermal model — bell-curve f(T), k=ln2/hw²
- [x] Validate 16/16 pass; test-extended 209/209 pass

---

## Sessions 1–8 — 2026-03-15  |  Status: COMPLETE / MERGED

- S1–S4: Scaffold, bicycle model, Pacejka, load transfer, drivetrain, aero, braking, lap time, Stage 8 (14-DOF)
- S5: Arc length fixes, direction tag fixes, extended test suite created
- S6: UX fixes, test reports, Stage 9 (load sensitivity)
- S7: Session-start skill, V_ch formula fix
- S8: ▶ Play animation, double-stroke track map, vectorEffect scaling
