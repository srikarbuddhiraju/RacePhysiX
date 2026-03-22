# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

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
