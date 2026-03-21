# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 19 — 2026-03-21  |  branch: `main`

### Status: IN PROGRESS

### ✅ GPS-native animation — Session 19

**Root cause confirmed (user screenshots):** Physics distance fraction ≠ GPS path fraction.
Spa pit straight: 720m physics → La Source position shows 150-180 kph (should be 55-70).
Monza: braking zone appeared AFTER Parabolica, not before.

**Fix — `buildGpsZoneOverlay` fully restored with GPS-native timing:**
- N=400, W=2 coordinate pre-smoothing (5-pt box) → R_noise≈590-830m >> vTop (~278 kph) ✓
- Menger curvature on smoothed coords + 3-pt post-smooth
- Forward/backward Euler passes → speed profile V[i]
- Zone classification: decelG thresholds (>0.3g braking, >0.05g trail, atLimit→cornering, else FT)
- Cumulative GPS timing: tCum += dsReal / vAvg → lapTimeSec
- Returns `{ segs[], anim[], lapTimeSec }` — both overlay and animation from same GPS source
- `gpsAtTime()` binary-search interpolator
- RAF tick: GPS circuits use `gpsAnimRef` for `pathFrac` + telemetry; schematic use physics trace
- Race mode unchanged (physics trace)
- [x] Build clean ✓ | validate 21/21 ✓ | extended 303/303 ✓
- [ ] Browser verify: La Source zone RED at ~55 kph; Parabolica braking BEFORE corner

---

## Session 18 — 2026-03-21  |  branch: `feature/stage16-gps-circuit-maps`

### Status: COMPLETE (merged → main)

### Completed this session (Session 16)

**Heatmap + animation direction reversal fixed for all GPS circuits**
- Root cause: TUMFTM GPS-derived SVG paths are drawn in the **opposite direction** to the physics model traversal. Physics model traverses CW (e.g. La Source first for Spa), but GPS SVG paths traverse CCW. This caused heatmap to show reversed colors across all 9 GPS circuits.
- [x] Added `svgReversed: true` to all 9 GPS circuits in `laptime.ts`: monza, spa, silverstone, suzuka, nurburgring_gp, bahrain, barcelona, hungaroring, montreal
- [x] `TrackVisualiser.tsx` heatmap: samples physics speed at `1 - (i+0.5)/N` when `svgReversed`
- [x] `TrackVisualiser.tsx` car position: uses `(1-pathFrac) * totalPathLen` when `svgReversed`
- [x] `TrackVisualiser.tsx` car heading: swaps ptA/ptB when `svgReversed` — arrow now points in direction of travel
- [x] Arrow snap at lap end fixed — ptA clamped to `totalPathLen - 2*eps` to prevent ptA = ptB
- [x] RPM text capped at `redlineRpm` — text now matches needle clamp
- [x] Added `layoutRef` to RAF tick (same pattern as `resultRef`) so reversed flag is always current
- [x] Build clean ✓ | 303/303 extended tests pass ✓

### ✅ GPS Zone Overlay Fixes — Session 18

**Root cause of reversed/absent zones on GPS circuits confirmed:**
- N=400 → ds=14.5m, shorter than T1 chicane arc (18m). Corner spans <1.2 samples. Menger curvature produces near-zero signal. No braking zone before T1 in overlay.
- 7-point ±43.5m smoothing further diluted any weak signal. Effective R for 18m corner became ~110m (wrong by 2×).
- Absolute decel threshold `V[i+1] < V[i] - 0.3` fails at high speed (e.g. 50 m/s: 0.3g decel = only 0.17 m/s drop per step, below threshold → classified as FT).
- Agent A's backward sign claim was INCORRECT. `+2*aBrake` in backward pass IS correct (backward integration: `V_entry = sqrt(V_exit² + 2*a*ds)`).

**Fixes applied:**
- [x] N: 400 → 2000 (ds=2.9m; T1 18m arc → 6 samples)
- [x] Smoothing: 7-point ±3 → 3-point ±1 (stops blurring tight chicanes)
- [x] Zone classification: removed absolute V[i+1]<V[i]-0.3; use decelG thresholds (braking>0.3g, trail>0.05g, else FT)
- [x] atLimit tolerance: 0.5 → 1.5 m/s (accommodates Euler overshoot ~1.45 m/s)
- [x] Playback speed: 8× real-time (Monza lap now ~18s to watch)
- [x] prevGearRef reset on layout change
- [x] lessons.md + circuit-map-review skill updated
- [x] Build clean ✓ | validate 21/21 ✓ | extended 303/303 ✓

### ✅ TrackVisualiser overhaul — Session 17

**Stage 17 — Physics-trace-based animation + zone overlay + race-engineer UI**
- [x] `src/physics/vehicleInput.ts` (new) — `buildLapSimInput(params, coeffs)` shared between LapTimePanel and TrackVisualiser
- [x] `buildLapTrace(layout, inp)` added to `laptime.ts` — ~5m-resolution Euler trace: distM, timeSec, speedKph, longG, latG, zone
- [x] `LapTimePanel.tsx` — refactored to use `buildLapSimInput` (removed duplicate inpBuilder logic)
- [x] `App.tsx` — computes `lapSimInput` and passes to `TrackVisualiser`
- [x] `TrackVisualiser.tsx` — full rewrite:
  - Animation: binary search on trace timeSec → smooth, physics-accurate position (no linear interp)
  - Zone overlay replaces heatmap: BRAKING / TRAIL / CORNERING / ACCEL / FULL-THROTTLE
  - Car arrow coloured by current zone, with glow
  - New race-engineer UI: header bar | circuit map | telemetry strip (speed + gear + rpm bar + long-G bar + lat-G bar + zone)
  - Monospaced data, dark theme (#07070f), no decorative gauges
- [x] Build clean ✓ | validate 21/21 ✓ | extended 303/303 ✓

### ✅ REGRESSION FIXED — Session 17

- Root cause confirmed: `svgReversed` assumption was wrong. Spa SVG path verified geometrically — starts at S/F, first U-turn is La Source (matches physics order). GPS SVG paths are **already in the same direction** as the physics model. `svgReversed: true` was inverting correct behaviour.
- [x] Removed `svgReversed` field from `TrackLayout` type and all 9 GPS circuits in `laptime.ts`
- [x] Removed reversal logic from `TrackVisualiser.tsx` (heatmap + car position + arrow heading)
- [x] Removed `layoutRef` (only existed to serve the now-deleted reversal logic)
- [x] Build clean ✓ | validate 21/21 ✓ | extended 303/303 ✓

### Completed in Session 15

**Sim review fixes (all 7 actionable items)**
- [x] `vPrev = vExit` (speed discontinuity at segment boundaries)
- [x] Nürburgring Seg 5 split (208.8° → 180° + 29°)
- [x] `dt = Math.min(dt, 50)` (G-meter spike on tab refocus)
- [x] Gear hysteresis (stay in gear if RPM 65–95% redline)
- [x] Symmetric eps clamp for car arrow
- [x] `buildTrackPath` appends `Z`
- [x] Tyre temp labels: "Front" / "Rear"
- [x] Monaco ratio improved to 1.46× (larger corner radii in schematic svgPath)

### OPEN — Pre-release blockers

**🔴 LGPL-3.0 compliance (hard blocker)**
- [ ] Add `LICENSES/TUMFTM-LGPL-3.0.txt` — full license text required with distribution
- [ ] Add attribution section to README (circuit GPS data source + LGPL notice)
- [ ] Add copyright notice to About section or footer in the UI

**🟠 Pending merge + deploy**
- [x] Run `npx tsx src/physics/validate.ts` — 21/21 ✓
- [x] Run `npx tsx src/physics/test-extended.ts` — 303/303 ✓
- [ ] Commit Stage 16+17+18 changes
- [ ] Merge `feature/stage16-gps-circuit-maps` → `main`
- [ ] Deploy to Cloudflare Pages (apexsim.srikarbuddhiraju.com)
- [ ] Browser verify: GPS circuits show braking zones before corners (T1 La Source should be RED)

**🟢 WATCH**
- [ ] Monaco ratio 1.46× — within band. No action unless GPS data becomes available.

---

## Session 13 — 2026-03-16  |  branch: `feature/stage16-gps-circuit-maps`

### Status: IN PROGRESS

### Completed this session (Session 13)

**Stage 16 — GPS-accurate circuit maps**
- [x] Monza, Spa, Silverstone, Suzuka: svgPath + svgViewBox added (TUMFTM GPS data)
- [x] Monaco: remains schematic (not in TUMFTM database)
- [x] Build clean; test-extended 312/312

**TUMFTM License analysis**
- LGPL-3.0 applies to GPS coordinate data we embed as SVG path strings
- Inline code comments exist but are insufficient — formal compliance needed before release
- See critical pre-release items below

**TrackVisualiser UX fixes**
- [x] Eau Rouge radius 22m → 75m: was forcing hard braking (~55 km/h), now taken fast (~103 km/h)
- [x] Layout: 3-column → 2-row (circuit SVG full-width top, telemetry strip bottom)
- [x] Telemetry strip: Speedometer + Gear + RPM side-by-side, then G-meter, tyre temps
- [x] Speedometer + RPM SVG: size prop added (rendered at 118px instead of 160px)
- [x] Car dot → directional arrow: smaller triangle pointing in direction of travel
- [x] Speed heatmap: straight midpoint now uses maxSpeedKph — shows full accel/brake arc
  - Previously: straight only interpolated entry→exit, missed peak speed on Kemmel etc.

### OPEN — To fix next

**Physics: speed display still jumpy on some corners**
- Reported: abrupt speed drops/jumps on all circuits (not just Spa/Eau Rouge)
- Likely cause: corner radii on some schematic circuits are too tight (same root cause as Eau Rouge)
- Review all circuits for corners where V_max < 60 km/h but no hard braking expected
- Candidate fixes: Monaco (many), Monza (Rettifilo chicane R=14m), Spa (Bus Stop R=16m)

**GT circuit expansion**
- TUMFTM has 25 circuits — all F1/DTM/IndyCar. No GT tracks available.
- User requested: Road Atlanta, Lime Rock, Daytona, Kyalami, Le Mans, Imola, Mugello
- Alternative: OpenStreetMap (ODbL licence) — good coverage of all GT venues
- Decision needed: OSM data vs schematic layouts

### CRITICAL — Pre-release blockers

**⚠️ LGPL-3.0 Compliance (TUMFTM data)**
- [ ] Add `LICENSES/TUMFTM-LGPL-3.0.txt` — full license text required with distribution
- [ ] Add attribution section to README (circuit GPS data source + LGPL notice)
- [ ] Add copyright notice to About section or footer in the UI

**⚠️ Pending merge + deploy**
- [ ] Run npx tsx src/physics/validate.ts (target: 21/21)
- [ ] Run npx tsx src/physics/test-extended.ts (target: 312/312)
- [ ] Commit Stage 16 + TrackVisualiser improvements
- [ ] Merge feature/stage16-gps-circuit-maps → main
- [ ] Deploy to Cloudflare Pages (apexsim.srikarbuddhiraju.com)
- [ ] Browser verify: Spa/Monza/Silverstone/Suzuka shapes recognisable

---

## Session 12 — 2026-03-16  |  branch: `feature/stage15-track-editor-visualiser`  |  COMPLETE

- Stage 15: TrackVisualiser, LapTimePanel track editor, circuit map overlay
- Physics: maxCornerSpeed divergence fix (Blanchimont R=230m, CL=4.0)
- UX: MoTeC force arrow colour, legend fixes, slip angle precision, ParameterPanel % labels

---

## Sessions 9–11 — 2026-03-16  |  Status: COMPLETE / MERGED

- S9: Stage 10 (gear model), Stage 11 (tyre thermal)
- S10: Stage 12 (setup optimiser), Stage 13A/B/C (separate Cα, combined slip, yaw transient)
- S11: Stage 14 (race sim), 5 GPS circuits (TUMFTM), fuel model, race UI

---

## Sessions 1–8 — 2026-03-15  |  Status: COMPLETE / MERGED

- S1–S4: Scaffold, bicycle model, Pacejka, load transfer, drivetrain, aero, braking, lap time, Stage 8 (14-DOF)
- S5: Arc length fixes, direction tag fixes, extended test suite
- S6: UX fixes, test reports, Stage 9 (load sensitivity)
- S7: Session-start skill, V_ch formula fix
- S8: ▶ Play animation, double-stroke track map, vectorEffect scaling
