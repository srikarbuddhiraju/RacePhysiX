# RacePhysiX — Browser-Based Vehicle Dynamics & Lap Time Simulator

A physics-accurate car setup and lap time simulation tool that runs entirely in the browser.
No install, no login, no account.

**Live:** [racephysix.srikarbuddhiraju.com](https://racephysix.srikarbuddhiraju.com)

---

## What is RacePhysiX?

RacePhysiX is an open-source vehicle dynamics simulator covering the full physics stack — from tyre contact patch forces to race strategy optimisation. Adjust any parameter and immediately see the effect on handling balance, cornering speed, braking performance, and predicted lap time across 22 real-world circuits.

**Who it's for:**
- Motorsport engineering students learning vehicle dynamics from first principles
- Formula Student / FSAE teams using it as a quick setup reference
- Sim racers building intuition for how setup changes affect lap time
- Anyone curious about the physics behind understeer, oversteer, and the Magic Formula tyre model

---

## Physics Model (45 stages)

| Stage | Model | What it captures |
|---|---|---|
| 1 | Bicycle model | Steady-state yaw, understeer gradient, slip angles (Gillespie Ch.6) |
| 2 | Pacejka Magic Formula | Nonlinear tyre lateral + longitudinal forces (RCVD Ch.2) |
| 3 | Load transfer + drivetrain | Per-corner Fz, combined slip, FWD/RWD/AWD/AWD+TV |
| 4 | Suspension (roll stiffness) | Roll angle, ARB contribution, accurate Fz split front/rear |
| 5 | Braking model | Brake bias, ABS clip, combined braking + cornering friction circle |
| 6 | Aerodynamics | Speed-dependent downforce + drag, front/rear aero balance |
| 7 | Lap time estimator | Point-mass simulation over corner + straight segments |
| 8 | 14-DOF time domain | Step steer / sine sweep / brake-in-turn, RK4 ODE solver |
| 9 | Tyre load sensitivity | Pacejka degressive μ with Fz (qFz parameter) |
| 10 | Gear model + powertrain | Gear ratios, shift points, rev-limited P/V curve |
| 11 | Tyre thermal model | μ bell curve vs temperature, warmup + degradation |
| 12 | Setup optimisation | Nelder-Mead simplex over 7 params → minimum lap time |
| 13 | Full nonlinear model | Separate F/R Cα, friction circle, yaw transient penalty |
| 14 | Race simulation | Multi-lap: tyre warmup/degradation, fuel burn, sector times |
| 15 | Track editor | Editable segment table, SVG preview, JSON import/export |
| 16 | GPS circuit maps | 22 circuits — TUMFTM (LGPL-3.0) + OSM (ODbL) GPS paths |
| 18 | Vehicle presets | Road / Formula Student / GT3 / F1 one-click parameter sets |
| 19 | Onboarding | First-visit dismissible banner, localStorage flag |
| 20 | Setup comparison | Save baseline → run variant → Δ lap time side-by-side |
| 22 | Camber + toe | Camber thrust + toe effective Cα in bicycle + Pacejka models |
| 23 | Tyre wear model | Soft/medium/hard/inter/wet — warmup, linear wear, cliff, graining |
| 24 | Wind + ambient | ISA air density (altitude + temp), headwind drag, crosswind μ |
| 25 | Driver model | Aggression 0–100%: tyre heat rate, wear rate, μ utilisation scaling |
| 26 | Differential model | Open / LSD / Locked — traction efficiency + yaw moment (RCVD Ch.22) |
| 27 | Brake temperature | Disc temp per lap, Gaussian fade model, braking capacity scaling |
| 28 | Tyre pressure | Cα × (p/2.0)^0.35, μ × (2.0/p)^0.10 (Pacejka §4.3.1) |
| 29 | Ride height + rake | Rake → aero balance shift; CL boost at low ride height |
| 30 | Race strategy optimizer | Brute-force 1/2-stop over soft/medium/hard, per-stint grip model |
| 31 | Engine torque curve | NA bell curve, turbo flat plateau after boost RPM, electric flat |
| 32 | Traction control | Driven axle slip ratio threshold — clamps drive force |
| 33 | Track rubber evolution | peakMu × (1 + 0.15 × rubberLevel) — green to fully rubbed |
| 34 | Wet track + drying line | Per-compound wetGripFactor — slick → 0.30 at standing water |
| 35 | ERS / Hybrid | MGU-K additive force, deploy strategies, energy budget |
| 36 | Multi-car comparison | Mass/power/peakMu vs baseline — Δ lap time comparison cards |
| 37 | Track banking + elevation | Banked corner FBD (Milliken RCVD §2.5), gradient drive/brake forces |
| 38 | Data export | Lap trace + race telemetry CSV (speed, gear, RPM, G-forces, zone) |
| 39 | Telemetry overlay | Upload any lap trace CSV — compare against sim in overlaid charts |
| 40 | MF-Swift combined slip | Pacejka Fx + Gky/Gxa cosine reduction (replaces Kamm circle) |
| 41 | Roll centre + dynamic camber | Geometric/elastic load transfer split; outer tyre camber gain from roll |
| 42 | Suspension motion ratio | Wheel rate = spring rate × MR²; ARB already at wheel rate; accurate roll stiffness |
| 43 | Roll damper model | Critical damping ratio ζ for body roll in 14-DOF transient sim |
| 44 | Crosswind in balance model | Lateral crosswind force added to tyre load balance in Pacejka model |
| 45 | Tyre thermal core | Two-layer surface/core model; μ evaluated at core temp; coreTemp lags surface via tyreCoreHeatLag |

All 32 physics validation checks pass. Extended suite: 424/424 pass.

---

## Circuits (22 total)

**Generic (4):** Club (~1.9 km), Karting (~1.0 km), GT Circuit (~3.2 km), Formula Test (~2.1 km)

**Schematic real circuits (4):** Monza, Spa-Francorchamps, Silverstone, Suzuka

**GPS-accurate — TUMFTM (LGPL-3.0, 10):**
Nürburgring GP, Bahrain/Sakhir, Barcelona/Catalunya, Hungaroring, Montreal,
Brands Hatch, Hockenheim, Red Bull Ring/Spielberg, Zandvoort, São Paulo/Interlagos

**GPS-accurate — OSM (ODbL, 4):**
Laguna Seca, Imola, Le Mans, Mugello

---

## Interface

**Left panel — Vehicle Parameters**
All 56 vehicle parameters grouped by system: Mass & Geometry, Tyres, Suspension, Brakes, Aerodynamics,
Powertrain, Race, Driver, Ambient. Every change recalculates the full physics model in real time.
One-click presets: Road car, Formula Student, GT3, F1.

**Centre — Circuit Visualiser**
Animated top-down circuit map with live telemetry strip (speed, gear, RPM, G-forces) and zone overlay
(braking / trail-braking / cornering / full-throttle). Zones are computed from the physics model —
they shift when you change mass, aero, or tyre compound. Supports single-lap and multi-lap race animation.

**Right panel — Results + Lap Time**
- Physics results: understeer gradient, lateral acceleration, per-corner tyre loads, combined utilisation
- Lap time: per-segment speed breakdown (entry, apex, exit, time, time%)
- Race simulation: lap-by-lap tyre temp/wear, fuel burn, sector times, gap to fastest
- Setup comparison: baseline vs variant Δ lap time
- Data export: lap summary CSV, high-res lap trace CSV (dist, time, speed, gear, RPM, G-forces), race telemetry CSV
- Telemetry import: upload any CSV and overlay it against the current sim lap

**Bottom panel — Charts**
Tyre curve (Fy vs slip angle), handling diagram (steering vs lateral G), Pacejka coefficients tuner,
14-DOF time-domain scenarios (step steer, sine sweep, brake-in-turn).

---

## Running Locally

```bash
npm install
npm run dev
```

Build for production:

```bash
npm run build
```

---

## Validation

```bash
npx tsx src/physics/validate.ts
```

Runs 21 physics checks against Gillespie Ch.6 (bicycle model), RCVD Ch.16 (suspension),
Pacejka §4.3 (tyre), and the 14-DOF time-domain model. Extended suite: 424/424 pass.

---

## Tech Stack

TypeScript · React · Vite · Three.js · Recharts · Cloudflare Pages

---

## Disclaimers

**Lap time estimator** uses a point-mass quasi-static model. It does not simulate tyre
warm-up laps, traction control intervention, or driver variation. Predictions are indicative —
expect ±5–15% vs real-world lap times depending on car category.

**Tyre model** uses generic Pacejka coefficients. Real homologated compound data is not
available. Corner speed predictions will differ from real measured data.

**Not for real vehicle setup decisions.** RacePhysiX is an educational and enthusiast tool.
Do not use outputs for professional motorsport engineering decisions.

---

## Attribution

**TUMFTM circuits (10):** GPS data from the
[TUMFTM Racetrack Database](https://github.com/TUMFTM/racetrack-database)
(Technical University of Munich, Institute of Automotive Technology),
licensed under [LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.txt).
See [`LICENSES/TUMFTM-LGPL-3.0.txt`](LICENSES/TUMFTM-LGPL-3.0.txt).

**OSM circuits (4):** GPS data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
licensed under the [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/).

---

## License

RacePhysiX application code: [MIT](LICENSE)

Circuit GPS data licences: LGPL-3.0 (TUMFTM) · ODbL (OSM)
