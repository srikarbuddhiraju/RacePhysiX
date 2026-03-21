# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 20 — 2026-03-21  |  branch: `feature/stage16-gps-circuit-maps`

### Status: READY TO MERGE — browser verify pending (user action)

### ✅ 5 TUMFTM GPS circuits added (Session 20)

Added to `laptime.ts` + dropdown (`LapTimePanel.tsx`):
- **Brands Hatch GP** (3.916 km) — TUMFTM LGPL-3.0 GPS path, 250 pts
- **Hockenheim GP** (4.574 km) — TUMFTM LGPL-3.0 GPS path, 250 pts
- **Red Bull Ring / Spielberg** (4.318 km) — TUMFTM LGPL-3.0 GPS path, 250 pts
- **Zandvoort** (4.259 km) — TUMFTM LGPL-3.0 GPS path, 250 pts
- **São Paulo / Interlagos** (4.309 km) — TUMFTM LGPL-3.0 GPS path, 250 pts

All appear in "European Touring (GPS)" group in circuit dropdown.

### ✅ Laguna Seca GPS path replaced (Session 20)

Replaced hand-crafted 13-point schematic with 147-node OSM GPS path.
Attribution updated to "GPS © OpenStreetMap contributors · ODbL".
Added `svgSource: 'osm'` field to TrackLayout interface + laguna_seca entry.

### ✅ Scripted GPS pipeline (Session 20)

`scripts/gen-circuit-paths.mjs` — fetches TUMFTM CSVs, normalises to 400×250 SVG paths
`scripts/gen-osm-paths2.mjs`, `gen-osm-paths3.mjs` — OSM Overpass fetch + way join

### ✅ Remaining GT circuits — GPS paths applied (Session 20 continued)

- **Le Mans**: GPS from OSM relation 2126739 — 926 nodes, 221m closure gap. `svgIsGps: true, svgSource: 'osm'`.
- **Mugello**: GPS from OSM relation 8487163 — 621 nodes, 0m closure gap. `svgIsGps: true, svgSource: 'osm'`.
- **Sebring**: GPS from OSM — 228 nodes, 534m closure gap (fragmented airport circuit). `svgIsGps: true, svgSource: 'osm'`.
- **Imola**: GPS from OSM — 232 nodes, 0m closure gap (35 ways, non-pit non-polygon). `svgIsGps: true, svgSource: 'osm'`.

### ✅ Imola GPS path fixed (Session 20 continued)

Previous: 179-node path had a 96m closure gap + visible artifact near S/F/Tamburello.
Root cause: previous deduplication incorrectly excluded 1021xxx connector ways that are sequential (not duplicate) to 1025xxx ways. All 1021/1025 ways form a chain — excluding any creates gaps.
Fix: include ALL OSM ways except closed polygon (116346020) and Pit Lane (196368195). Result: 232 nodes, 0m closure, clean Imola outline. Variante Bassa (3 ways, 355m gap from chain) not connectable — section simplified as straight. Acceptable for circuit outline.

### ✅ Generic circuits redesigned as closed shapes (Session 20 continued)

Root cause of visual issue: original segment layouts not geometrically closed. `buildTrackPath()` Z command drew huge diagonal closure lines (400–550px = 40–55% of path length), making circuits look like open C-shapes.

All 4 generic circuits redesigned as properly closed geometries. Closure gaps now < 3px (invisible in SVG):
- **Club (~1.9km)**: Twin 180°-hairpin symmetric oval. R=30m (65 kph). Closes within 3px.
- **Karting (~1.0km)**: Twin 180°-hairpin oval. R=8m (35 kph, kart-tight). Closes within 3px.
- **GT circuit (~3.2km)**: Analytically closed layout — 60°/120°/90°/90° corners. Preserves fast sweeper (R=100m, 134 kph) and Bus Stop (R=50m, 94 kph). Closes within 2px.
- **Formula test (~2.1km)**: Rectangular 4×90° layout with tight turns. R=70m/35m mixed corners (73-103 kph). S/F ≠ Back straight (529m vs 600m) to cancel corner arc x-displacement. Closes within 1px.

Physics validation: 21/21 ✓ | Extended tests: 419/419 ✓ | Build clean ✓

### ROADMAP — Racing line overlay (future)

TUMFTM `global_racetrajectory_optimization` repo only has 4 circuits (Berlin, Modena, test tracks) — not usable directly. Plan: develop our own minimum-curvature racing line solver using TUMFTM racetrack-database centerline + track width data (w_tr_right_m, w_tr_left_m). Output: a second svgPath per circuit (thinner overlay showing ideal racing line). Branch when ready: `feature/racing-line-overlay`.

### OPEN — Pre-release blockers

- [x] `LICENSES/TUMFTM-LGPL-3.0.txt` — file present ✓
- [x] Attribution in README — TUMFTM (14 circuits) + OSM (5 circuits) ✓
- [x] docs/lessons.md + memory updated ✓
- [ ] **Browser verify**: Imola — no kink artifact, clean 232-node outline
- [ ] **Browser verify**: Club/Karting/GT/Formula — no diagonal closure line, clean shapes
- [ ] **Browser verify**: 5 new TUMFTM circuits (Brands Hatch, Hockenheim, Spielberg, Zandvoort, São Paulo)
- [ ] **Browser verify**: Laguna Seca, Mugello — clean GPS shapes (not blob/octopus)
- [ ] Commit + merge → main + deploy (after browser verify)

---

## Session 19 — 2026-03-21  |  branch: `main`

### Status: COMPLETE

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

## Sessions 1–13 — 2026-03-15/16  |  Status: COMPLETE / MERGED

- S1–S8: Stages 1–8 (bicycle model, Pacejka, load transfer, aero, braking, lap time, 14-DOF, animation)
- S9–S11: Stages 10–14 (gear, tyre thermal, optimiser, combined slip, race sim, TUMFTM GPS initial)
- S12: Stage 15 (TrackVisualiser, track editor, circuit map overlay, UX fixes)
- S13: Stage 16 start (GPS circuits: Monza, Spa, Silverstone, Suzuka; LGPL compliance identified)
