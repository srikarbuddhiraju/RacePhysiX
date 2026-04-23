# Physics Models

RacePhysiX implements 36 physics stages, validated against three standard textbooks:

- **Milliken & Milliken** — *Race Car Vehicle Dynamics* (RCVD), SAE 1995
- **Gillespie** — *Fundamentals of Vehicle Dynamics*, SAE 1992
- **Pacejka** — *Tyre and Vehicle Dynamics*, 3rd ed., Butterworth-Heinemann 2012

All 37 validation checks pass. Extended test suite: 424/424.

Formulas throughout this page follow standard vehicle dynamics notation (SAE axis system):
x = forward, y = left, z = up. Positive yaw = left turn.

---

## Stage 1 — Bicycle Model

### Concept

The bicycle model collapses the four-wheel car into a two-axle, single-track vehicle. Both front wheels are treated as one, both rears as one. This is valid for steady-state cornering at lateral accelerations below ~0.4 g, where tyre behaviour is approximately linear.

It answers the fundamental question: *does this car understeer or oversteer, and by how much?*

### Key variables

| Symbol | Meaning |
|---|---|
| m | Vehicle mass (kg) |
| L | Wheelbase = a + b (m) |
| a | CG to front axle (m) |
| b | CG to rear axle (m) |
| Cαf, Cαr | Front and rear cornering stiffness (N/rad) |
| V | Forward speed (m/s) |
| r | Yaw rate (rad/s) |
| δ | Front steer angle (rad) |
| R | Corner radius (m) |

### Equations of motion (linear, steady-state)

Lateral force balance:

```
m·ay = Fyf + Fyr
```

Yaw moment balance:

```
0 = a·Fyf − b·Fyr
```

Linear tyre model (valid for small slip angles):

```
Fyf = Cαf · αf
Fyr = Cαr · αr
```

Slip angles (geometric):

```
αf = δ − (Vy + a·r) / Vx
αr =   − (Vy − b·r) / Vx
```

At steady state, Vy = 0 and r = V/R:

```
αf = δ − (a/R + b/R·(b/L)) = δ − b·V²/(L·g·R) ... (simplified)
αr = −a/R·...
```

### Understeer gradient

The understeer gradient K is the most important single number the bicycle model produces. It tells you how much extra steering angle is needed per unit of lateral acceleration:

```
δ = L/R + K · ay

K = (m/L) · (b/Cαf − a/Cαr)      [rad per m/s²]
  = (m·g/L) · (Wf/Cαf − Wr/Cαr)  [equivalent form using axle weights]
```

where `Wf = m·g·b/L` and `Wf = m·g·a/L` are the static front and rear axle weights.

**Interpretation:**
- `K > 0` — understeer: driver must add more steering as speed rises
- `K = 0` — neutral steer: steering angle is purely geometric (δ = L/R)
- `K < 0` — oversteer: the car tries to turn more than the driver inputs; above critical speed, it is unstable

### Characteristic and critical speeds

For an **understeering** car (K > 0), lateral acceleration peaks at the characteristic speed:

```
Vch = √(L / K_rad)      where K_rad = K in rad/(m/s²)
```

For an **oversteering** car (K < 0), directional stability is lost above the critical speed:

```
Vcrit = √(−L / K_rad)
```

A car operating near or above Vcrit is dynamically unstable — small disturbances grow rather than damp out.

### What it drives in the simulator

The bicycle model feeds: understeer gradient display, handling diagram, characteristic/critical speed indicators, and the initial cornering stiffness values used by the lap time estimator.

---

## Stage 2 — Pacejka Magic Formula

### Concept

Real tyres are nonlinear. At small slip angles they behave linearly (Fy ≈ Cα · α), but as slip angle grows the tyre saturates and Fy peaks, then drops. The bicycle model cannot capture this. The Pacejka Magic Formula is a curve-fit equation that precisely describes this nonlinear behaviour from tyre test data.

### The formula

Lateral force:

```
Fy = D · sin(C · atan(B·α − E·(B·α − atan(B·α))))
```

Longitudinal force (same structure, different coefficients):

```
Fx = D · sin(C · atan(B·κ − E·(B·κ − atan(B·κ))))
```

where α is slip angle, κ is longitudinal slip ratio.

### Coefficient roles

| Coefficient | Name | Effect |
|---|---|---|
| B | Stiffness factor | Controls the slope at the origin — initial cornering stiffness = B·C·D |
| C | Shape factor | Controls the width of the peak and the transition to saturation |
| D | Peak factor | Sets the peak force (D ≈ μ · Fz for a normalised formula) |
| E | Curvature factor | Controls the sharpness of the peak and the falloff after peak |

The product B·C·D = Cα (cornering stiffness). Increasing B makes the tyre respond more aggressively to small slip angles. Increasing C widens the peak. Negative E sharpens the peak and steepens the dropoff — typical of racing slicks.

### Load dependence

D is not constant — it scales with vertical load Fz:

```
D = μ · Fz
```

But real tyres are **degressive** — doubling the load does not double the force. This is modelled via the load sensitivity parameter qFz (Stage 9):

```
μ(Fz) = μ0 · (1 − qFz · (Fz/Fz0 − 1))
```

A higher qFz means grip drops more steeply as load increases — a fundamental reason why load transfer hurts the total grip of both tyres.

### Combined slip

When the tyre simultaneously generates lateral and longitudinal force, the two forces compete for the same friction budget (friction circle). The MF-Swift combined slip model (Stage 40) applies reduction factors:

```
Fy_combined = Fy · Gky(κ)
Fx_combined = Fx · Gxa(α)

Gky(κ) = cos(Cκy · atan(Bκy · κ))
Gxa(α) = cos(Cxα · atan(Bxα · α))
```

Hard braking into a corner reduces available lateral force — this is why trail braking technique is a compromise.

---

## Stage 3 — Load Transfer & Drivetrain

### Concept

Every time a car accelerates, brakes, or corners, weight shifts between the axles and between inner and outer wheels. Load transfer directly affects tyre grip because Pacejka's D coefficient scales with Fz — but in a nonlinear, degressive way.

### Longitudinal load transfer (braking / acceleration)

```
ΔFz_long = m · ax · h / L
```

Under braking (ax < 0), the front axle gains load, the rear loses load. The front gains grip; the rear loses grip. This is why rear-biased cars can spin under hard braking.

### Lateral load transfer (cornering)

Per axle:

```
ΔFz_lat_front = m · ay · (hRC_f/t_f) · (KΦf/KΦtotal) + m · ay · h · (1/L·KΦf/KΦtotal)
```

The total lateral load transfer is split between front and rear axles in proportion to their roll stiffness contributions. A stiffer front (higher KΦf) pushes more load transfer to the front — degrading front grip → understeer.

### Per-wheel vertical loads

```
Fz_FL = (Wf/2) − ΔFz_long/2 − ΔFz_lat_front
Fz_FR = (Wf/2) − ΔFz_long/2 + ΔFz_lat_front
Fz_RL = (Wr/2) + ΔFz_long/2 − ΔFz_lat_rear
Fz_RR = (Wr/2) + ΔFz_long/2 + ΔFz_lat_rear
```

These four values feed directly into the Pacejka model at each corner.

### Drivetrain

The drivetrain type (FWD/RWD/AWD/AWD+TV) determines which axle(s) receive drive torque. The driven axle's slip ratio κ is computed from the drive force and the tyre's Fx curve. Combined slip then reduces the available lateral force on the driven axle — this is why powerful FWD cars understeer badly under acceleration.

Torque vectoring (AWD+TV) applies a yaw moment by biasing torque left-to-right on the rear axle.

---

## Stage 4 — Suspension Roll Stiffness

### Concept

When a car corners, lateral load transfer tends to roll the body. Springs and anti-roll bars resist this. The total roll stiffness determines: (1) how much the body rolls, (2) how load transfer is split front-to-rear.

### Roll stiffness

Per axle (spring contribution):

```
KΦ_spring = ks · t² / 2      (Nm/rad)
```

where ks is spring stiffness (N/m) and t is track width (m).

Anti-roll bar contribution:

```
KΦ_ARB = k_ARB · t² / 4
```

Total per axle:

```
KΦ = KΦ_spring + KΦ_ARB
```

### Roll angle

At a given lateral acceleration ay:

```
φ = m · ay · h / (KΦf + KΦr)      (rad)
```

Roll angle feeds the dynamic camber calculation (Stage 41):

```
γ_dynamic = γ_static − φ · camber_gain
```

More roll = tyres lean further from vertical = less contact patch = less grip. This is why roll stiffness matters beyond just "feel."

### Motion ratio

Real suspension systems have a motion ratio MR < 1 — the wheel moves more than the spring. The effective wheel rate is:

```
k_wheel = k_spring · MR²
```

(Stage 42)

---

## Stage 5 — Braking Model

### Concept

The braking model computes the deceleration capacity and the optimal brake bias distribution. Brake bias affects both the maximum deceleration and the balance of the car under braking.

### Optimal brake bias

To avoid locking a wheel, the brake force distribution must match the axle load distribution under braking. For a given deceleration ax:

```
Wf_dynamic = (m·g·b/L) + (m · ax · h / L)
Wr_dynamic = (m·g·a/L) − (m · ax · h / L)

B_opt = Wf_dynamic / (Wf_dynamic + Wr_dynamic)
```

Front-biased brake bias (B > B_opt) → front lock → understeer under braking (safer but suboptimal).
Rear-biased (B < B_opt) → rear lock → spin (dangerous but common in oversteer-tuned cars).

### ABS

When longitudinal slip ratio κ exceeds the ABS threshold, drive/brake force is clipped to the tyre's peak Fx. This prevents lockup at the cost of some peak deceleration.

### Combined braking and cornering

Under simultaneous braking and cornering, the friction circle applies:

```
√(Fx² + Fy²) ≤ μ · Fz
```

The braking model passes κ to the Pacejka combined slip stage, which returns the effective Fx and Fy limits given the combined demand.

---

## Stage 6 — Aerodynamics

### Concept

At speed, the car's body generates aerodynamic downforce (negative lift) and drag. Downforce adds to vertical load, increasing tyre grip. Drag opposes forward motion, reducing acceleration and top speed.

### Dynamic pressure

```
q = ½ · ρ · V²
```

where ρ is air density (kg/m³) and V is airspeed (m/s).

Air density itself depends on altitude and temperature (Stage 24 — ISA model):

```
ρ = p₀ · M / (R · T)   (ideal gas)
```

### Downforce and drag

```
Fa = q · CL · A      (N, downforce — adds to Fz)
Fd = q · CD · A      (N, drag — opposes motion)
```

where A is the reference area (typically frontal area for drag, plan area for lift).

### Axle split

The aero balance parameter distributes downforce between front and rear:

```
Fa_front = Fa · (1 − aero_balance)
Fa_rear  = Fa · aero_balance
```

These add to Fz_front and Fz_rear, directly increasing grip at high speed. This is why corner speeds increase with downforce — the tyre's D coefficient rises.

### Ground effect (Stage 29)

Below a ride height threshold (~30 mm), the underbody venturi effect causes a steep increase in CL. The model applies a nonlinear boost factor as ride height decreases.

Rake angle (rear higher than front) shifts the aero balance rearward.

### Pre-computed CFD aero map (Stage 46)

For high-fidelity mode, a 2D lookup table indexed by [ride height × yaw angle] replaces the single CL/CD values. This captures: yaw-induced asymmetric downforce, ground effect sensitivity curve, and drag vs yaw. The CFD map is class-specific (Road / Formula Student / GT3 / F1).

---

## Stage 7 — Lap Time Estimator

### Concept

A point-mass lap simulation. The circuit is represented as a sequence of corners (with radius R) and straights (with length s). The simulator walks through these segments and computes the minimum time to traverse each, subject to the tyre friction and power limits.

### Corner speed limit

Maximum speed through a corner of radius R:

```
V_corner = √(μ_eff · g · R)
```

With aerodynamic downforce:

```
V_corner = √((μ · (m·g + Fa) · R) / m)
```

As speed increases, Fa increases, which increases V_corner — a self-reinforcing benefit. This is why high-downforce cars gain disproportionately on fast circuits.

### Braking and acceleration

Working backwards from the corner entry, the simulator computes the maximum entry speed by integrating:

```
V_entry² = V_exit² + 2 · a_brake · ds      (backward pass)
```

where a_brake = μ_eff · g + Fd/m (deceleration capacity).

Forward pass (acceleration out of corner):

```
V_exit² = V_entry² + 2 · (F_drive − Fd) / m · ds
```

Limited by both power (F_drive = P/V) and traction (F_drive ≤ μ · Fz_driven).

### Track banking and gradient (Stage 37)

On a banked corner with bank angle θ, the effective friction is:

```
μ_eff = μ · cosθ + sinθ
```

(gravity assists centripetal force on a banked road — this is why Eau Rouge / Raidillon is flat-out for GT3).

On a gradient of angle α:

```
F_grade = m · g · sinα      (resists on uphill, assists on downhill)
```

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
| 4× wheel spin | Each wheel's rotational speed |
| 2× steer inputs | Front and rear steering |

### Integration

At each timestep dt:

```
dVx/dt = (Fx_total − Fd − m·r·Vy) / m
dVy/dt = (Fy_total − m·r·Vx) / m
dr/dt  = (a·Fyf − b·Fyr + Mz) / Iz
dφ/dt  = φ̇
dφ̇/dt = (m·ay·h − KΦ·φ − cφ·φ̇) / Ixx
```

The tyre forces (Fx, Fy) at each corner are computed from the Pacejka model at the current slip angle and slip ratio, accounting for the instantaneous vertical load (from suspension deflection and load transfer).

### ISO scenarios

Three standard test scenarios:
- **Step steer**: 0→δ at t=1s, run for 5s — measures yaw rate overshoot and settling time
- **Sine sweep**: δ = δ₀·sin(2πft) with f ramping from 0.5 to 4 Hz — measures frequency response
- **Brake-in-turn**: steady cornering at 0.3g, then full braking — measures brake-steer coupling

---

## Stages 9–13 — Tyre Refinements

### Stage 9 — Load sensitivity

Real tyres are degressive: doubling Fz does not double Fy. The peak factor D scales as:

```
D(Fz) = μ · Fz · (1 − qFz · (Fz/Fz0 − 1))
```

A higher qFz (more load sensitivity) means inner/outer load transfer hurts the total more — justifying wider tracks and lower CG heights.

### Stage 11 — Tyre thermal model

Tyre μ follows a Gaussian bell curve with temperature:

```
μ(T) = μ_peak · exp(−((T − T_opt)² / (2 · σ²)))
```

Below T_opt: cold tyres — the car understeers and slides; above T_opt: overheated tyres — grip falls off sharply. The warm-up time constant is compound-dependent (soft warms faster than hard).

Tyre core temperature (Stage 45) adds a lag model — the bulk of the tyre takes longer to heat than the surface, affecting thermal inertia.

### Stage 12 — Setup optimisation

Nelder-Mead simplex optimiser minimises lap time over 7 parameters simultaneously:

- Front and rear spring stiffness
- Front and rear ARB stiffness
- Front and rear aero CL
- Brake bias

The optimiser runs ~200 lap simulations per call, converging to a local minimum in under 1 second.

### Stage 13 — Full nonlinear model

Replaces the linear Cα approximation in the balance solver with separate front and rear Magic Formula curves. Applies the combined slip friction circle at each corner. Adds a yaw transient penalty term for transitions between braking and cornering.

---

## Stages 14–36 — Race, Strategy, and Advanced Models

| Stage | Model | Key physics |
|---|---|---|
| 14 | Race simulation | Tyre degradation over laps; fuel burn reduces mass |
| 15 | Track editor | User-defined circuit segments |
| 16 | GPS circuits | 22 real circuits from GPS data |
| 22 | Camber + toe | Camber thrust ΔFy = Cγ · γ; toe modifies effective Cα |
| 23 | Tyre wear | Compound-specific wear cliff and graining model |
| 24 | Wind + ambient | ISA density model; headwind drag; crosswind lateral force |
| 25 | Driver model | Aggression scales μ utilisation, wear rate, tyre heat rate |
| 26 | Differential | Open/LSD/Locked: traction efficiency + yaw moment (RCVD Ch.22) |
| 27 | Brake temperature | Disc thermal model; Gaussian fade above threshold |
| 28 | Tyre pressure | Cα × (p/2.0)^0.35; μ × (2.0/p)^0.10 (Pacejka §4.3.1) |
| 29 | Ride height + rake | Ground effect boost below 30 mm; rake → aero balance shift |
| 30 | Race strategy | Brute-force 1/2-stop over compound combinations |
| 31 | Engine torque curve | NA bell, turbo plateau, electric flat-from-zero |
| 32 | Traction control | Slip ratio threshold clamps drive force on driven axle |
| 33 | Track rubber evolution | peakMu × (1 + 0.15 × rubber level) — green to fully rubbed |
| 34 | Wet track | Per-compound wetGripFactor; slick drops to 0.30 at standing water |
| 35 | ERS / Hybrid | MGU-K additive force; saving/full/attack deploy strategies |
| 36 | Multi-car comparison | Δ lap time between configurations on shared chart |
| 37 | Banking + elevation | Banked corner effective μ; gradient drive/brake forces |
| 38 | Data export | Lap trace CSV; race telemetry CSV |
| 39 | Telemetry overlay | Upload real data; compare vs simulation |
| 40 | MF-Swift combined slip | Pacejka '96 Gky/Gxa reduction factors |
| 41 | Roll centre + camber | Geometric/elastic load transfer split; dynamic camber |
| 42 | Motion ratio | k_wheel = k_spring × MR² |
| 43 | Roll damper | Critical damping ratio for roll mode |
| 44 | Crosswind balance | Crosswind lateral force in front/rear balance equation |
| 45 | Tyre thermal core | Core temperature lag model (surface vs bulk) |
| 46 | CFD aero map | 2D lookup [ride height × yaw] → CL/CD correction factor |

---

## Validation methodology

Every physics stage is validated before being considered complete:

1. Choose 2–3 known inputs with a hand-calculated expected output (from textbook or real-world data).
2. Run the model at those inputs.
3. Accept if the result matches within tolerance (typically < 1% for analytical models).

The full validation suite is in `src/physics/validate.ts`. Run with:

```bash
npx tsx src/physics/validate.ts
```

All 37 checks pass. The extended suite (`src/physics/test-extended.ts`) covers 424 cases including edge conditions, sign conventions, and parameter extremes.
