# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 25 — 2026-03-22  |  branch: `feature/stage28-30-physics` (IN PROGRESS)

### Status: IN PROGRESS

### Done this session:

**Stage 28 — Tyre Pressure Model**
- `src/physics/types.ts`: `frontTyrePressureBar` + `rearTyrePressureBar` fields on VehicleParams
- `src/physics/bicycleModel.ts`: pressure scaling `Cα(p) = Cα_nom × (p/p_nom)^0.35` applied after toe effect and used in camber thrust, understeer gradient, and slip angles
- `src/physics/pacejkaModel.ts`: pressure scales B (via Cα) and peakMu `(p_nom/p)^0.10` in both `buildHandlingCurve` and `computePacejkaModel` slip angle solving
- `src/physics/vehicleInput.ts`: average axle pressure scales peakMu via contact-patch factor
- `src/App.tsx`: DEFAULT_PARAMS `frontTyrePressureBar: 2.2, rearTyrePressureBar: 2.2`
- `src/physics/vehiclePresets.ts`: pressure fields on all 4 presets (Road=2.2, FS=1.5/1.4, GT3=1.8, F1=1.7)
- `src/components/ParameterPanel.tsx`: Tyre Pressure section in Tyres tab (2 sliders + Cα/μ/cold-set derived display)

**Stage 29 — Ride Height & Rake**
- `src/physics/types.ts`: `frontRideHeightMm` + `rearRideHeightMm` fields on VehicleParams
- `src/physics/vehicleInput.ts`: rake angle → effective aero balance shift; ground-effect CL boost (aeroCL > 2.0); `effectiveAeroCL` passed to LapSimInput
- `src/App.tsx`: DEFAULT_PARAMS `frontRideHeightMm: 100, rearRideHeightMm: 105`
- `src/physics/vehiclePresets.ts`: ride height on all 4 presets (Road=130/135, FS=35/45, GT3=55/65, F1=30/40)
- `src/components/ParameterPanel.tsx`: Ride Height & Rake section in Aero tab (2 sliders + rake angle/balance shift/CL boost derived display)

**Stage 30 — Race Strategy Optimiser**
- `src/physics/strategyOptimiser.ts` — NEW: brute-force 1-stop/2-stop enumeration over dry compounds (soft/medium/hard), thermal+wear grip model per stint, pit stop time loss, deduplication, top-6 results
- `src/components/LapTimePanel.tsx`: import, 3 new state vars, `handleOptimiseStrategy` callback, Strategy Optimiser UI section (pit stop input, optimise button, result cards with OPTIMAL badge)

**Fixtures updated:** `validate.ts` + `test-extended.ts` BASE fixtures include Stage 28/29 fields (pressure=2.0 bar, rideHeight=100/105mm)

### Build: ✅ 0 TypeScript errors (718 modules) | All 21 checks pass | 424/424 extended tests pass

### Pending:
- [ ] Browser verify: pressure sliders, ride height sliders, strategy optimiser button + results
- [ ] git commit on `feature/stage28-30-physics`

### Key files
- `src/physics/strategyOptimiser.ts` — Stage 30 strategy optimiser
- `src/physics/types.ts` — new VehicleParams fields
- `src/physics/vehicleInput.ts` — pressure + ride height effects wired into LapSimInput
- `src/components/ParameterPanel.tsx` — Stage 28/29 UI
- `src/components/LapTimePanel.tsx` — Stage 30 UI

---

## Session 24 — 2026-03-22  |  branch: `feature/stage26-27-physics` (IN PROGRESS)

### Status: IN PROGRESS

### Done this session:

**Stage 26 — Differential Model**
- `src/physics/differential.ts` — NEW: `diffTractionFactor()` and `diffYawMoment()` for open/LSD/locked diffs
- `src/physics/types.ts`: `diffType` + `lsdLockingPercent` fields on VehicleParams
- `src/physics/vehicleInput.ts`: imports diff functions, computes diffFactor, applies to driveForce, returns diffTractionFactor/diffYawMomentNm
- `src/App.tsx`: DEFAULT_PARAMS `diffType: 'open'`, `lsdLockingPercent: 50`
- `src/physics/vehiclePresets.ts`: diff fields on all 4 presets (Road=open, FS/GT3/F1=lsd)
- `src/components/ParameterPanel.tsx`: Differential section in Vehicle tab (3-button selector + LSD locking slider + derived traction/yaw display)

**Stage 27 — Brake Temperature Model**
- `src/physics/brakeTemp.ts` — NEW: `brakeHeatRisePerLap()`, `brakeDiscCoolingPerLap()`, `brakeFadeFactorFromTemp()`
- `src/physics/types.ts`: `brakeDiscMassKg`, `brakeOptTempC`, `brakeHalfWidthC`, `brakeFloorMu` on VehicleParams
- `src/physics/laptime.ts`: imports brakeTemp functions; `LapSimInput` has optional brake temp fields; `LapData` has `brakeDiscTempC` + `brakeFadeFactor`; `simulateRace` evolves brake temp per lap and applies fade to `brakingCapG`
- `src/App.tsx`: DEFAULT_PARAMS brake temp defaults
- `src/physics/vehiclePresets.ts`: brake temp fields on all 4 presets (road=heavy/low-temp, F1=light/high-temp)
- `src/components/ParameterPanel.tsx`: Brake Temperature section in Aero tab (4 sliders + derived heat rise / opt window)

**Fixtures updated:** `validate.ts` + `test-extended.ts` BASE fixtures include Stage 26/27 fields

### Build: ✅ 0 TypeScript errors | All 21 checks pass

### Pending:
- [ ] Browser verify: diff selector, LSD locking slider, brake temp sliders, race sim shows brakeDiscTempC/brakeFadeFactor in LapData
- [ ] git commit on `feature/stage26-27-physics`

### Key files
- `src/physics/differential.ts` — Stage 26 diff model
- `src/physics/brakeTemp.ts` — Stage 27 brake thermal model
- `src/physics/laptime.ts` — LapData + simulateRace updated
- `src/physics/vehicleInput.ts` — diff factor wired into driveForce

---

## Session 23 — 2026-03-22  |  branch: `feature/stage18-22-product` (IN PROGRESS)

### Status: IN PROGRESS 🔧

### Done this session:

**Stage 18 — Vehicle Presets**
- `src/physics/vehiclePresets.ts` — 4 presets: Road Car, Formula Student, GT3, F1 (full VehicleParams + PacejkaCoeffs)
- `src/components/VehiclePresetSelector.tsx` — horizontal preset row, hover tooltip showing specs
- `src/App.tsx` — wired `handlePresetSelect` + `<VehiclePresetSelector>` above app-main

**Stage 19 — Onboarding**
- `src/components/WelcomeBanner.tsx` — first-visit dismissible banner (localStorage flag `racephysix_welcomed_v1`)
- Wired into `App.tsx`

**Stage 20 — Setup Comparison**
- `LapTimePanel.tsx`: `baseline` state, "Save Baseline" / "Update Baseline" button, Δ delta display (green=faster, red=slower), ×clear

**Stage 21 — About / Methodology**
- `LapTimePanel.tsx`: `AboutSection` collapsible ▸/▾ at bottom — physics stages table, textbook refs, circuit attribution, author credit

**Stage 22 — Camber + Toe**
- `src/physics/types.ts`: 4 new `VehicleParams` fields: `frontCamberDeg`, `rearCamberDeg`, `frontToeDeg`, `rearToeDeg`
- `src/physics/bicycleModel.ts`: toe effective stiffness (+12%/deg) + camber thrust (ΔFy = −0.05·Cα·γ)
- `src/physics/pacejkaModel.ts`: same corrections in `buildHandlingCurve` + `computePacejkaModel`
- `src/physics/vehiclePresets.ts`: camber/toe values per preset (Road −1.5/−0.5, FS −2.5/−1.5, GT3 −3.0/−1.5, F1 −3.5/−2.5)
- `src/physics/validate.ts` + `test-extended.ts`: zero camber/toe added to test fixtures
- `src/components/ParameterPanel.tsx`: Camber & Toe section in Suspension tab (4 sliders + derived Cα_eff + ΔFy_γ)

**GPS Zone Overlay — per-preset accuracy fixes**
- N: 400 → 2000 (Session 18 fix restored)
- aero-augmented vMax: `denom = 1 − kAero·R`, `vMax = sqrt(μ·g·R/denom)` (F1 Pouhon flat-out correct)
- speed-dependent braking: `aBrake(V) = max(brakingG, peakMu)·g + kAero·V²` (FS braking zones correct)

**Global power unit (kW / BHP / PS)**
- `src/utils/units.ts` — NEW: `PowerUnit`, `toKW`, `fromKW`, `fmtPower`, `POWER_RANGE`
- `src/components/ParameterPanel.tsx`: removed local helpers, imports from units.ts, `powerUnit` + `onPowerUnitChange` props
- `src/components/VehiclePresetSelector.tsx`: `powerUnit`/`onPowerUnitChange` props, `formatDesc()` helper, global toggle (kW/BHP/PS) on right side
- `src/charts/ChartsPanel.tsx`: `powerUnit` prop threaded through to LapTimePanel
- `src/components/LapTimePanel.tsx`: `powerUnit` prop + `fmtPower` in vehicle identity strip
- `src/App.tsx`: `powerUnit` state lifted to app level, wired to VehiclePresetSelector, ParameterPanel, ChartsPanel
- Build: ✅ 713 modules, 0 errors

### Pending:
- [ ] git commit all staged changes on `feature/stage18-22-product`
- [ ] Browser verify: all stages working, power unit toggle, camber/toe sliders, about section, setup comparison
- [ ] Merge `feature/stage18-22-product` → `main` + deploy to Cloudflare Pages

### Key files
- Presets: `src/physics/vehiclePresets.ts`
- Units: `src/utils/units.ts`
- Camber/toe physics: `src/physics/bicycleModel.ts`, `src/physics/pacejkaModel.ts`
- Panels: `src/components/LapTimePanel.tsx`, `src/components/ParameterPanel.tsx`

---

## Session 22 — 2026-03-22  |  branch: `main` — COMPLETE ✅

- Docs: all ApexSim → RacePhysiX references updated
- CLAUDE.md: Stages 15–16 ✅, 22 circuits, 424 tests
- Deployed to Cloudflare Pages ✅

---

## Session 21 — 2026-03-22  |  branch: `main` — COMPLETE ✅

Physics: Monza Parabolica 48→80m. SEO: `public/` with _redirects/robots/sitemap. TrackVisualiser: live lap timer, lat-G bar, RPM clamp, zone legend, S/F marker. LapTimePanel: Animate Circuit button + dual lap time. ParameterPanel: Tyres & Fuel tab. All 424/424 tests pass.

---

## Sessions 1–20 — COMPLETE / MERGED

GPS circuits (22 total), stage 14 race sim, stages 1–13 physics. See git history.
