# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 12 — 2026-03-16  |  branch: `feature/stage15-track-editor-visualiser`

### Status: IN PROGRESS — Stage 16 (GPS-accurate circuit maps)

### Completed this session (Session 12)

**Stage 15 — Track Editor + Circuit Map Overlay**
- [x] TrackVisualiser.tsx: complete rewrite — premium circuit map overlay
  - 3-column layout: speedometer+gear | SVG circuit | RPM+G-meter+tyre temps
  - Always real-time animation (RAF, result.totalTimeSec duration per lap)
  - Speed heatmap: 300 samples via getPointAtLength, HSL red→yellow→cyan
  - Telemetry cluster: SpeedometerGauge, RpmGauge, GMeter, TyreTempGrid
  - Race animation: lap-by-lap at each lap's real pace
  - Car: glow + speed-colored dot, longitudinal G from speed derivative
- [x] LapTimePanel.tsx: sticky ribbon (circuit name, distance, laptime, top/corner/avg speeds)
- [x] LapTimePanel.tsx: track editor (lock/unlock, segment table, New/Import/Export JSON)
- [x] ChartsPanel.tsx: LapTimePanel always mounted (display:none) so lapResult always populated
- [x] App.tsx: circuit map as full canvas overlay (position:absolute, inset:0, zIndex:50)
- [x] App.tsx: ⊞ Map button at top:46, left:8 (below theme-toggle)
- [x] TopDownView.tsx: "Top View" label at left=46px (avoids theme-toggle overlap)
- [x] TopDownView.tsx: CornerLoadGauges at bottom:72 (clears legend strip)
- [x] Build clean; validate 21/21; test-extended 312/312

**Physics bug fix (this session)**
- [x] maxCornerSpeed() iteration diverges at high CL (e.g. CL=4.0 at Blanchimont R=230m)
  - After 10 iters: ~480 km/h for a 150kW car — physically impossible
  - Fix: cap at `computeMaxSpeed(params)` (power-limited top speed, e.g. 279 km/h)
  - Added `maxVehicleSpeedMs?: number` to LapSimInput; set in inpBuilder
  - Build clean, 312/312 pass

**UX fixes (P1/P2 from /test-ux)**
- [x] Force arrow understeer colour: 0xf97316 (orange) → 0x60a5fa (blue) — MoTeC standard
- [x] Legend colour mismatches fixed: suspension strut → #4ade80, downforce → #818cf8
- [x] CornerLoadGauges: bottom:44 → bottom:72 (safe clearance above legend)
- [x] ResultsPanel: lateral accel now shows both g and m/s²
- [x] ResultsPanel: slip angle precision 3dp → 1dp
- [x] laptime.ts: radius? added to SegmentResult (corners only)
- [x] LapTimePanel: corner radius shown in segment table as R=Xm
- [x] LapTimePanel/fmtTime: lap time format consistent (3dp) everywhere
- [x] TyreCurveChart: title → "Lateral Force Curve (Fy)"; ±5° lines labelled; op-point 5px→8px yellow ring
- [x] HandlingDiagram: Y-axis → "δ steer (deg)"; op-point 5px→8px yellow ring
- [x] ParameterPanel: brake bias / aero balance / AWD split now show % (e.g. 65%F / 35%R)

### Current: Stage 16 — GPS-accurate circuit maps
- [ ] Download/process GPS x/y CSV for Spa, Monza, Monaco, Silverstone, Suzuka from TUMFTM DB
  - Srikar to fetch and paste CSV data (same process as Stage 14 circuits)
  - OR: use the normalised path algorithm from Stage 14 to regenerate svgPath
- [ ] Add svgPath + svgViewBox to each TrackLayout in laptime.ts
- [ ] Verify circuit shapes look recognisable in TrackVisualiser
- [ ] Build clean, validate pass
- [ ] Commit Stage 15+16 work
- [ ] Merge feature/stage15 → main
- [ ] Deploy to Cloudflare Pages

### Known limitations (not bugs)
- Circuit shapes for 5 schematic circuits (Spa, Monza, Monaco, Silverstone, Suzuka)
  are algorithmically reconstructed from segment data — not GPS-accurate (Stage 16 fixes this)
- All 5 GPS-derived circuits from Stage 14 (Nürburgring, Bahrain, Barcelona,
  Hungaroring, Montreal) need svgPath added to show correctly in TrackVisualiser

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
