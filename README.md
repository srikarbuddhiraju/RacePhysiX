# ApexSim

A browser-based, physics-accurate vehicle dynamics simulator.

**Live:** [apexsim.srikarbuddhiraju.com](https://apexsim.srikarbuddhiraju.com)

## What it does

ApexSim computes and visualises the handling behaviour of a car in real time:

- Bicycle model (yaw, understeer/oversteer gradient)
- Pacejka Magic Formula tyres (lateral + longitudinal)
- Load transfer, suspension roll stiffness, ARB
- Braking model with brake bias and ABS
- Aerodynamics (speed-dependent downforce + drag)
- Gear model and powertrain (6-speed, shift points, rev limiter)
- Tyre thermal model (temperature-dependent grip)
- Lap time simulator over real GPS-accurate circuits
- Race simulation (multi-lap tyre degradation + fuel burn)
- Live circuit map with zone overlay (braking / trail-braking / cornering / full-throttle)

## Circuits

**Schematic:** Club, Karting, GT Circuit, Formula Test, Monaco

**GPS-accurate (TUMFTM):** Monza, Spa, Silverstone, Suzuka, Nürburgring GP, Bahrain, Barcelona, Hungaroring, Montreal

## Tech stack

TypeScript · React · Vite · Recharts · Cloudflare Pages

## Running locally

```bash
npm install
npm run dev
```

## Attribution

Circuit GPS data for 9 circuits is sourced from the
[TUMFTM Racetrack Database](https://github.com/TUMFTM/racetrack-database)
(Technical University of Munich), licensed under
[LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.txt).

See [`LICENSES/TUMFTM-LGPL-3.0.txt`](LICENSES/TUMFTM-LGPL-3.0.txt) for full attribution.

## License

ApexSim application code: [MIT](LICENSE)

Circuit GPS data: [LGPL-3.0](https://www.gnu.org/licenses/lgpl-3.0.txt) — TUMFTM
