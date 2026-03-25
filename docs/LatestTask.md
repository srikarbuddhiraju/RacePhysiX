# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 31 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Stage 40 — MF-Swift combined slip** (commit `922eacb`, merged `5de4902`)

- `pacejkaFx(κ, Fz, peakMu, qFz, Fz0)`: longitudinal Pacejka, Bx=12.0, Cx=1.65, Ex=−0.80
- `combinedSlipGky(κ)`: cos(Cκy × arctan(Bκy × κ)) — proper Pacejka '96 Fy reduction
- `combinedSlipGxa(α)`: cos(Cxα × arctan(Bxα × α)) — proper Fx reduction
- `solveSlipAngleTyreAxle`: Kamm circle replaced with Gky (physically accurate at moderate slip)
- Checks 15a–c: Gky(0/0.1/0.2) verified against Pacejka §4.3.2

**Stage 41 — Roll centre height + dynamic camber** (same commit)

- 4 new `VehicleParams`: `frontRollCentreHeightMm` (30 mm), `rearRollCentreHeightMm` (40 mm), `camberGainFront` (0.7), `camberGainRear` (0.5)
- `loadTransfer.ts`: geometric + elastic split — ΔFz_geom = m×ay×fwf×rcH/TW; RC=0 → identical to old formula
- `pacejkaModel.ts`: dynamic camber = staticCamber − rollAngle × camberGain → feeds camber thrust (ΔFy_F22/R22)
- 4 sliders in ParameterPanel Suspension tab under "Roll Centre Heights (Stage 41)"
- Checks 16a–b: RC load transfer formula + dynamic camber verified

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `5de4902`)
- Physics: 28/28 checks pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Next session plan
1. **Docs + README update** — add Stages 40–41 to physics table
2. **Marketing Phase 1** (deferred — Srikar away)
3. **Multi-device testing** (Surface Pro 6 + real users — deferred)

---

## Session 30 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**URL compression + desktop responsive layout** (merged `57d7e6c`)

URL:
- Short-key map: 56 VehicleParams fields → 2–3 char codes
- Nearest-preset encoding: `#p=gt3&{tiny-b64}` (~28 chars) vs old ~950 chars
- Backwards-compatible: old full-key base64 URLs still decode

Layout:
- `min-width: 900px` on `.app` — horizontal scroll before collapse
- 1100px breakpoint: panels shrink to 200px, canvas gets more space
- `max-height: 700px` query: vertical scroll on short screens, charts accessible
- ChartsPanel: collapses to 1-column at ≤1000px
- Multi-device testing deferred (will test on different devices later)

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `57d7e6c`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

---

## Session 29 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Stage 39 — Telemetry overlay** (commit `81dcc85`, merged `9dd77cb`)

- "Import Telemetry" button in Lap Time panel — uploads any CSV with `dist_m` + `speed_kph`
- Accepts Stage 38 Lap Trace format natively (parses circuit/lap metadata from header comments)
- Three overlaid Recharts: Speed / Lat-G / Long-G vs distance (m)
- Sim = orange, Uploaded = sky-blue; Δ top speed, Δ min corner, Δ lap time stats row
- Live update: changing params updates sim line; uploaded trace stays fixed
- Self-consistency: export Lap Trace → re-import → all Δ values = 0 ✓
- New files: `parseTelemetryCSV.ts` (parser + interp helper), `TelemetryOverlayChart.tsx`

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `9dd77cb`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Next session plan
1. **URL compression** — custom-param URLs still long
2. **Docs + README**, **Marketing Phase 1**
3. **Multi-device / user testing** — Surface Pro 6 + real users (future session)

---

## Session 28 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Stage 38 — Data export** (commit `785af88`, merged `0ed7919`)

Three export buttons in Lap Time panel:
- **Lap Summary** (renamed): params + per-segment breakdown CSV (existing)
- **Lap Trace**: single-lap high-res telemetry, ~5 m steps, ~1400 pts/lap at Spa
  Columns: `dist_m, time_s, speed_kph, gear, rpm, long_g, lat_g, zone`
- **Race Telemetry**: all laps concatenated, per-lap summary header
  Header: fastest lap, lap_time_s, sector times, tyre_temp, tyre_wear, fuel_kg, brake_temp_c

New files: `src/physics/gearUtils.ts` — shared `computeGearRPM` (gear hysteresis, redline logic)
New function: `buildRaceLapTraces` — per-lap physics scaling (μ×wear, fuel mass, brake fade)

Verified by Srikar: all 3 CSVs downloaded, physics correct (lap 1 slow cold tyres, fastest lap 6)

---

**Stage 37 — Track banking & elevation** (commit `aa5d0a5`)

Physics: banked corner FBD (Milliken RCVD §2.5):
- `muEff = μ cosθ + sinθ` — gravity assists centripetal force on banked road
- `gradientPct` on straights: `F_grade = mg sinα` reduces drive accel; assists braking uphill
- GPS circuits: `BankingProfile` lookup in `buildGpsZoneOverlay` raises `vMax[i]`

Circuit data added:
| Circuit | Corner | Banking | Effect |
|---|---|---|---|
| Spa | Eau Rouge | 5° | GT3 flat-out (208 kph) ✓ |
| Spa | Raidillon | 6° | GT3 flat-out (235 kph) ✓ |
| Spa | Uphill to Eau Rouge | 18% gradient | Reduced accel on uphill run |
| Spa | Kemmel Straight | -4% gradient | Slight downhill speed boost |
| Monza | Parabolica | 3° | Slight corner speed increase |
| Silverstone | Copse | 3° | Slight corner speed increase |
| Suzuka | 130R | 2° | Slight corner speed increase |

Verified by Srikar in UI: Eau Rouge/Raidillon zone overlay **blue (full-throttle)** for GT3 ✓

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `0ed7919`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Remaining P0 bugs
1. ~~Erratic animation after param change~~ FIXED ✓
2. ~~Race simulation wrong speeds on GPS circuits~~ FIXED ✓
3. ~~Eau Rouge braking zone~~ FIXED ✓ (Stage 37 banking)
4. **URL compression** — custom-param URLs still long
5. **Surface Pro 6 camera** — needs device testing

### Next session plan
1. **Stage 39** — Telemetry replay (upload CSV from data logger, overlay vs sim)
2. **Browser verify** — end-to-end check all Stages 23–38 in UI
3. **Docs + README**, **Marketing Phase 1**

---

## Session 27 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**P0 Bug fix: erratic animation after param change + race simulation on GPS circuits**

Two root causes fixed in `TrackVisualiser.tsx`:

1. **Stable tick / stale-ref race condition** — `tick` was in `useCallback([playing, params])`, so every param change restarted the RAF. New RAF fired before `gpsAnimRef` could update → stale speed profile locked in. Fix: `paramsRef` pattern, `tick` now `useCallback([playing])` only — RAF never restarts on param change.

2. **Race simulation on GPS circuits** — Race animation block fell through to schematic-trace code even on GPS circuits. Schematic distance fractions applied to GPS SVG path → wrong positions + telemetry. Fix: GPS branch inside race animation block uses `tGps = t * gpsA.lapTimeSec` → `gpsAtTime()` for correct GPS-path animation.

**Commits:** `a47cda5`, `43fea13`, `b6e0070` — merged to `main`

### Eau Rouge braking zone — known limitation

- **GT3**: flat-road model correctly brakes at Raidillon (R ~115-150m, threshold R > 185m for flat-out). Real-world flat-out requires banking (~4-8° at Raidillon). Fix: Stage 37 (track banking).
- **F1**: should be flat-out (threshold R > 109m). If F1 shows braking → possible GPS curvature artifact; needs curvature debug.

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `b6e0070`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Remaining P0 bugs
1. ~~Erratic animation after param change~~ FIXED ✓
2. ~~Race simulation wrong speeds on GPS circuits~~ FIXED ✓
3. **Eau Rouge braking zone** — GT3 known limitation (Stage 37); confirm F1 behaviour
4. **URL compression** — custom-param URLs still long; needs short-key map + binary packing
5. **Surface Pro 6 camera** — needs device testing

### Next session plan
1. **Stage 37** — Track banking/elevation (fixes Eau Rouge for GT3)
2. **Stage 38** — Data export (CSV/JSON)
3. **Stage 39** — Telemetry replay
4. **Browser verify** — end-to-end check all Stages 23–36 in UI
5. **Docs + README**, **Marketing Phase 1**

---

## Session 26 — 2026-03-24  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Logo integration**

- Srikar created `RacePhysiX_LightBG.png` and `RacePhysiX_DarkBG.png` (+ `RacePhysiX_master.svg`) in `docs/Logo/`
- Logo concept: charcoal wordmark "RacePhysi" + orange X-with-engineering-crosshair icon
- Copied to `public/logo-light.png` and `public/logo-dark.png`
- Added to `ParameterPanel.tsx` header — replaces plain "RacePhysiX / Vehicle Dynamics Simulator" text
- CSS theme-swap via `[data-theme]` attribute: `logo-dark-theme` / `logo-light-theme` classes in `index.css`
- Sizing: `width: 100%, height: auto` — fills panel width, AR always maintained
- Favicon placeholder added to `index.html` using `logo-dark.png` (pending X-only icon)
- All commits pushed to `main`, Cloudflare Pages auto-deployed

**Bugs fixed this session**
- Logo AR distorted by flex column stretch → fixed with `alignSelf: flex-start` then replaced with `width: 100% / height: auto`
- Logo too small → removed `maxHeight` constraint, now fills full panel width

**Favicon TODO (next session)**
- Srikar to create X-only PNG (just the crosshair icon, no wordmark)
- Drop in `public/favicon.png`, update `index.html` `<link rel="icon">` + add `apple-touch-icon`

### State
- All on `main`, pushed, live on Cloudflare Pages (commit `29eca34`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

---

## Session 25 — 2026-03-22  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Bug fixes deployed to main + Cloudflare Pages**

| Fix | Root cause | Files |
|---|---|---|
| Top speed 800-900 kph for F1/GT3 | `computeMaxSpeed` used only gearbox limit (redline-in-top-gear), ignoring power-drag balance. F1 gave 954 kph. | `gearModel.ts`, `validate.ts` |
| Speed jumps 200→338 kph at S/F | `vBoundary` was set after Euler passes — V[1]…V[N-1] still computed from old V[0]=vTop. Post-reconciliation passes not run. | `TrackVisualiser.tsx` |
| Animation always starts at S/F (zero feel) | `startRef.current = timestamp` always started at tGps=0 (S/F). | `TrackVisualiser.tsx` |
| URL too long (~500 chars for presets) | Full params blob always encoded, even for presets. | `App.tsx` |
| No reset button | — | `VehiclePresetSelector.tsx`, `App.tsx` |

**Fix details:**
- `computeMaxSpeed` now `min(gearbox, power-drag)`: F1 338 kph ✓, GT3 279 kph ✓, Road 273 kph ✓, FS 172 kph ✓
- TrackVisualiser: 4→8 main Euler iters + 4 post-reconciliation passes to propagate corrected V[0]
- Rolling start: `startRef` offset by random fraction of lap time on first load
- URL: preset → `#p=f1` (7 chars), diff-only encoding for custom params, old URLs auto-recompressed on load
- Reset button in Vehicle row — restores all params + Pacejka coeffs, clears URL hash
- All 21 physics checks pass, 0 TS errors

**Also this session:**
- Security audit: 0 vulnerabilities, no XSS vectors, no secrets, no external calls
- Removed copyrighted textbook PDFs from git history (git filter-repo + force push)
- Added `docs/Textbooks/` and `docs/marketing.md` to .gitignore
- Created `docs/marketing.md` (private, gitignored) — working doc for marketing strategy
- Discussed marketing: phases 1–4, target audiences, content ideas, community seeding plan

### State
- All on `main`, pushed, Cloudflare Pages auto-deployed (commit `eb1e3e1`)
- Dev server: `http://localhost:5173/`
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities
- Git history clean — no PDFs, no secrets

### Next session plan

#### P0 Bugs (found on live site — 2026-03-24)
1. **[BUG] Erratic animation after param change** — When any param in the left panel (vehicle, aero, drivetrain) is changed, the arrow goes full throttle into corner 1 with absurd speeds (200–250+ kph), then brakes erratically. Behaves like the old V[0] propagation bug. Persists even after hitting Reset — suggests stale physics state or cached speed profile is not being recomputed/cleared on param change. Affects all circuits.
2. **[BUG] Braking zone before Eau Rouge (Spa)** — GT3 and F1 should be flat-out through Eau Rouge. A braking zone is shown there which is physically wrong. Root cause likely in the lap time estimator corner classification or the corner-speed solver treating Raidillon as a hairpin.
3. **[BUG] URL compression incomplete** — Preset short-codes work (e.g. `#p=f1`) but custom-param URLs are still long. Need a systematic, robust URL encoding scheme: short keys, base64 or numeric packing, max ~100 chars for any valid config.
4. **[BUG] Top/chase camera broken on Surface Pro 6** — Views distorted or misaligned on Surface Pro 6 display (likely high-DPI / non-standard aspect ratio). Site must render consistently across all desktop screen sizes and DPI scales (mobile is out of scope for now).

#### Existing plan
5. **Browser verify** — end-to-end check all Stages 23–36 in UI
6. **Stage 37** — Track banking/elevation (lateral g correction on banked corners, gradient drag/assist on hills)
7. **Stage 38** — Data export (CSV/JSON download of lap + race simulation data)
8. **Stage 39** — Telemetry replay (upload CSV from data logger, overlay vs sim)
9. **Docs + README** — User-facing docs, README, in-app landing copy (prerequisite for marketing)
10. **Marketing Phase 1** — Screenshots/GIF, first Reddit post (see `docs/marketing.md`)

#### Realism roadmap (Stages 40–45 — future)
MF-Swift tyres (+15%), non-linear suspension (+10%), damper model (+8%), aero yaw (+5%), tyre thermal core (+8%), pre-computed CFD map (+20%). Target ~93% accuracy by Stage 45.

#### v3 (long-term): Tauri + Rust WASM + tyre shell FEA (~95% accuracy). Srikar to lead FE formulation.

---

## Sessions 1–27 — COMPLETE / MERGED

Stages 1–37: full physics from bicycle model through track banking/elevation.
See git history for details.
22 GPS circuits. 424/424 tests. See git history.
