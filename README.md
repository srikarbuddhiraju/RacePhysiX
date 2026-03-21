# RacePhysiX — Free Browser-Based Vehicle Dynamics & Lap Time Simulator

A physics-accurate car setup and lap time simulation tool that runs entirely in the browser.
No install, no login. Designed for motorsport engineers, racing enthusiasts, and students learning vehicle dynamics.

**Live:** [racephysix.srikarbuddhiraju.com](https://racephysix.srikarbuddhiraju.com)

---

## What is RacePhysiX?

RacePhysiX is an open-source vehicle dynamics simulator covering the full physics stack from tyre model
to lap time estimation. Adjust any parameter — suspension stiffness, brake bias, downforce, tyre compound —
and immediately see the effect on handling balance, cornering speed, braking distances, and predicted lap time
across 19 real-world circuits.

It is aimed at anyone who wants to understand how a car's setup affects its on-track behaviour:
motorsport engineering students, sim racers building an intuition for setup, or hobbyists exploring
the physics behind understeer, oversteer, and the Pacejka tyre model.

---

## Features

- **Tyre model** — Pacejka Magic Formula with load sensitivity, thermal warm-up/degradation, and combined slip
- **Vehicle dynamics** — bicycle model, understeer/oversteer gradient, yaw response, slip angles
- **Load transfer** — per-corner Fz under braking and cornering; front/rear roll stiffness split via ARB
- **Suspension** — spring rates, anti-roll bars, roll angle computation (RCVD Ch.16 methodology)
- **Braking** — brake bias, ABS activation threshold, combined braking + cornering friction circle
- **Aerodynamics** — speed-dependent downforce and drag, front/rear aero balance
- **Powertrain** — 6-speed gearbox with custom ratios, shift points, rev limiter, P/V curve
- **Lap time estimator** — point-mass simulation over corner + straight segments; real GPS-accurate circuits
- **Race simulation** — multi-lap tyre degradation, fuel burn, sector times, gap to fastest
- **Live circuit map** — animated car with zone overlay: braking / trail-braking / cornering / full-throttle
- **Setup optimiser** — Nelder-Mead simplex search over 7 parameters to minimise lap time

---

## Interface Guide

### Vehicle Parameters (left panel)
All vehicle parameters are controlled via sliders grouped by system: **Mass & Geometry**, **Tyres**,
**Suspension**, **Brakes**, **Aerodynamics**, and **Powertrain**. Every slider change recalculates
the full physics model in real time. The results update across all panels simultaneously.

### Dynamics Visualiser (top-right)
Shows lateral and longitudinal force arrows, slip angle indicators, and the understeer gradient chart.
The chart plots steering input vs lateral acceleration — the gradient (positive = understeer,
negative = oversteer) tells you the handling balance at any speed. The neutral steer point and
characteristic speed are marked automatically.

### Lap Time Estimator
Select a circuit from the dropdown (19 circuits available), then read off the predicted lap time
and a per-segment speed table. Each row shows entry speed, apex speed, exit speed, and time for
every corner and straight. Useful for identifying which corners are lap-time-critical.

### Race Simulation
Run a multi-lap race to see how tyre degradation and fuel burn evolve over a stint. The table shows
lap time, sector splits, tyre temperature, and gap to the theoretical fastest lap on each lap.
Adjust fuel load and tyre parameters to simulate different stint strategies.

### Circuit Map & Zone Overlay
An animated top-down circuit map showing:
- **Zone colours** — red (braking), orange (trail-braking), yellow (cornering), green (full-throttle)
- **Directional arrow** — car position and heading, coloured by current zone
- **Telemetry strip** — speed (km/h), gear, RPM bar, longitudinal G-bar, lateral G-bar, zone label

GPS circuits animate at 8× real-time. The zone overlay is computed from the physics model — zones
shift position when you change mass, aero, or tyre compound.

---

## Circuits (19 total)

**Schematic:** Club (~1.9 km), Karting (~1.0 km), GT Circuit (~3.2 km), Formula Test (~2.1 km), Monaco

**GPS-accurate (TUMFTM · LGPL-3.0):**
Monza, Spa-Francorchamps, Silverstone, Suzuka, Nürburgring GP, Bahrain/Sakhir, Barcelona/Catalunya,
Hungaroring, Montreal, Brands Hatch, Hockenheim, Red Bull Ring/Spielberg, Zandvoort, São Paulo/Interlagos

**GPS-accurate (OSM · ODbL):**
Laguna Seca, Imola, Le Mans, Mugello, Sebring

---

## Disclaimers

- **Educational tool only.** RacePhysiX is not a certified engineering tool. Lap time predictions are
  indicative, not race-engineer-grade. Do not use outputs for real vehicle setup decisions.
- **Point-mass model.** The lap time simulator uses a simplified point-mass vehicle model. It does not
  simulate transient dynamics (weight transfer timing, tyre warm-up laps, traction control intervention).
- **Tyre model simplified.** The Pacejka coefficients are generic defaults. Real tyre data (homologated
  compound data) is not available. Corner speed predictions will differ from real data by ±10–20%.
- **Physics reference.** Models are validated against Milliken & Milliken *Race Car Vehicle Dynamics* (RCVD)
  and Gillespie *Fundamentals of Vehicle Dynamics*. All 21 validation checks pass.

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

## Tech Stack

TypeScript · React · Vite · Recharts · Cloudflare Pages

---

## Attribution

**TUMFTM circuits (14):** GPS data from the
[TUMFTM Racetrack Database](https://github.com/TUMFTM/racetrack-database)
(Technical University of Munich), licensed under [LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.txt).
See [`LICENSES/TUMFTM-LGPL-3.0.txt`](LICENSES/TUMFTM-LGPL-3.0.txt) for full license text.

**OSM circuits (5):** GPS data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright),
licensed under the [Open Database Licence (ODbL)](https://opendatacommons.org/licenses/odbl/).

---

## License

RacePhysiX application code: [MIT](LICENSE)

Circuit GPS data:
- TUMFTM circuits: [LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.txt)
- OSM circuits: [ODbL](https://opendatacommons.org/licenses/odbl/)
