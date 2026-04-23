# Physics — Advanced Models

Stages 8–46: transient dynamics, tyre refinements, race simulation, strategy, and high-fidelity aero. These models build on the [foundations](physics-foundations) and are active in the race simulator, telemetry, and optimiser.

---

## Stage 8 — 14-DOF Time-Domain Model

### Concept

For transient dynamics — step steer, sine sweep, brake-in-turn — a quasi-static lap sim is insufficient. The 14-DOF model integrates the full equations of motion over time using a 4th-order Runge-Kutta (RK4) integrator.

### Degrees of freedom

| DOF | State |
|---|---|
| x, y | Longitudinal and lateral position |
| ψ | Yaw angle |
| Vx, Vy | Longitudinal and lateral velocity |
| r | Yaw rate |
| φ | Roll angle |
| φ̇ | Roll rate |
| 4 × wheel spin | Each wheel's rotational speed |
| 2 × steer inputs | Front and rear steering |

### Equations of motion

At each timestep dt (RK4):

```
dVx/dt = (Fx_total − Fd − m·r·Vy) / m
dVy/dt = (Fy_total − m·r·Vx) / m
dr/dt  = (a·Fyf − b·Fyr + Mz) / Iz
dφ/dt  = φ̇
dφ̇/dt = (m·ay·h − KΦ·φ − cΦ·φ̇) / Ixx
```

Tyre forces (Fx, Fy) at each corner are computed from the Pacejka model at the current slip angle and slip ratio, accounting for instantaneous vertical load from suspension deflection and load transfer.

### ISO scenarios

| Scenario | Input | Measures |
|---|---|---|
| Step steer | δ: 0 → δ₀ at t=1 s, held for 5 s | Yaw rate overshoot and settling time |
| Sine sweep | δ = δ₀·sin(2πft), f: 0.5→4 Hz | Frequency response (yaw gain, phase) |
| Brake-in-turn | Steady 0.3g cornering → full brake | Brake-steer coupling |

---

## Stages 9–13 — Tyre Refinements

### Stage 9 — Load sensitivity

Real tyres are degressive: doubling Fz does not double Fy. Peak factor D scales as:

```
D(Fz) = μ · Fz · (1 − qFz · (Fz/Fz0 − 1))
```

Higher qFz means inner/outer load transfer hurts total grip more — justifying wider tracks and lower CG heights as primary setup levers.

### Stage 11 — Tyre thermal model

Tyre μ follows a Gaussian bell curve with temperature:

```
μ(T) = μ_peak · exp(−(T − T_opt)² / (2 · σ²))
```

Below T_opt: cold tyres — the car understeers and slides. Above T_opt: overheated tyres — grip falls off sharply. Warm-up time constant is compound-dependent (soft warms faster than hard).

Tyre core temperature (Stage 45) adds a thermal lag model. The tyre bulk takes longer to heat than the surface, affecting how long peak grip is sustained:

```
T_core = (1 − lag) · T_surface + lag · T_ambient
```

### Stage 12 — Setup optimisation

Nelder-Mead simplex optimiser minimises lap time over 7 parameters simultaneously:

- Front and rear spring stiffness
- Front and rear ARB stiffness
- Front and rear aero CL
- Brake bias

Runs ~200 lap simulations per call, converging to a local minimum in under 1 second.

### Stage 13 — Full nonlinear model

Replaces the linear Cα approximation with separate front and rear Magic Formula curves. Applies the combined slip friction circle at each corner. Adds a yaw transient penalty term for transitions between braking and cornering — captures the "snap" that occurs when a car exceeds its yaw damping capacity.

---

## Stages 14–46 — Race, Strategy, and Advanced Models

| Stage | Model | Key physics |
|---|---|---|
| 14 | Race simulation | Multi-lap: tyre warmup, fuel burn, sector times |
| 15 | Track editor | User-defined circuit segments |
| 16 | GPS circuits | 22 real circuits from GPS data |
| 22 | Camber + toe | Camber thrust ΔFy = Cγ · γ; toe modifies effective Cα |
| 23 | Tyre wear | Compound-specific wear cliff and graining model |
| 24 | Wind + ambient | ISA density model; headwind drag; crosswind lateral force |
| 25 | Driver model | Aggression 0–100% scales μ utilisation, wear rate, heat rate |
| 26 | Differential | Open / LSD / Locked — traction efficiency + yaw moment (RCVD Ch.22) |
| 27 | Brake temperature | Disc thermal model; Gaussian fade above threshold |
| 28 | Tyre pressure | Cα × (p/2.0)^0.35; μ × (2.0/p)^0.10 (Pacejka §4.3.1) |
| 29 | Ride height + rake | Ground effect boost below 30 mm; rake → aero balance shift |
| 30 | Race strategy | Brute-force 1/2-stop over compound combinations |
| 31 | Engine torque curve | NA bell curve, turbo plateau, electric flat-from-zero |
| 32 | Traction control | Slip ratio threshold clamps drive force on driven axle |
| 33 | Track rubber evolution | peakMu × (1 + 0.15 × rubber level) — green to fully rubbed |
| 34 | Wet track | Per-compound wetGripFactor; slick drops to 0.30 at standing water |
| 35 | ERS / Hybrid | MGU-K additive force; saving/full/attack deploy strategies |
| 36 | Multi-car comparison | Δ lap time between configurations on shared chart |
| 37 | Banking + elevation | Banked corner FBD (RCVD §2.5); gradient drive/brake forces |
| 38 | Data export | Lap trace CSV; race telemetry CSV |
| 39 | Telemetry overlay | Upload real data; compare vs simulation in speed/G charts |
| 40 | MF-Swift combined slip | Pacejka '96 Gky/Gxa reduction factors (replaces Kamm circle) |
| 41 | Roll centre + dynamic camber | Geometric/elastic load transfer split; camber from roll angle |
| 42 | Motion ratio | k_wheel = k_spring × MR² |
| 43 | Roll damper | cΦ = 2ζ√(KΦ·Ixx); ζ default 0.7 |
| 44 | Crosswind balance | Crosswind lateral force in front/rear balance solver |
| 45 | Tyre thermal core | Core temperature lag model (surface vs bulk heat transfer) |
| 46 | CFD aero map | 2D lookup [ride height × yaw] → CL/CD correction factor |

---

## Validation methodology

Every physics stage is validated before being considered complete:

1. Choose 2–3 known inputs with a hand-calculated expected output (from textbook or real-world data).
2. Run the model at those inputs.
3. Accept if the result matches within tolerance (typically < 1% for analytical models).

The full validation suite is in `src/physics/validate.ts`. Run with:

```
npx tsx src/physics/validate.ts
```

All 37 checks pass. The extended suite (`src/physics/test-extended.ts`) covers 424 cases including edge conditions, sign conventions, and parameter extremes.
