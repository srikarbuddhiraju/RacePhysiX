# Physics — Foundations

Core models that underpin every output in RacePhysiX. Stages 1–7 cover the bicycle model, Pacejka tyres, load transfer, suspension, braking, aerodynamics, and the lap time estimator.

Validated against:
- **Milliken & Milliken** — *Race Car Vehicle Dynamics* (RCVD), SAE 1995
- **Gillespie** — *Fundamentals of Vehicle Dynamics*, SAE 1992
- **Pacejka** — *Tyre and Vehicle Dynamics*, 3rd ed., Butterworth-Heinemann 2012

All formulas follow the SAE axis system: x = forward, y = left, z = up. Positive yaw = left turn.

See [Physics — Advanced](physics-advanced) for Stages 8–46 (14-DOF dynamics, race simulation, thermal models, CFD aero map).

---

## Stage 1 — Bicycle Model

### Concept

The bicycle model collapses the four-wheel car into a two-axle, single-track vehicle. Both front wheels are treated as one, both rears as one. Valid for steady-state cornering at lateral accelerations below ~0.4 g, where tyre behaviour is approximately linear.

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
m · ay = Fyf + Fyr
```

Yaw moment balance:

```
0 = a · Fyf − b · Fyr
```

Linear tyre model (valid for small slip angles):

```
Fyf = Cαf · αf
Fyr = Cαr · αr
```

Slip angles (geometric, at steady state where Vy = 0 and r = V/R):

```
αf = δ − (V/R) · (a/L + b²/(L·V²/g)) ... (simplified from full dynamic form)
αr = −(V/R) · a·b / (L·V²/g)
```

### Understeer gradient

The understeer gradient K is the most important single number the bicycle model produces. It describes how much additional steering angle is needed per unit of lateral acceleration:

```
δ = L/R + K · ay

K = (m/L) · (b/Cαf − a/Cαr)         [rad per m/s²]
  = (m·g/L) · (Wf/Cαf − Wr/Cαr)     [equivalent form, using axle weights]
```

where `Wf = m·g·b/L` and `Wr = m·g·a/L` are the static front and rear axle weights.

**Interpretation:**
- K > 0 — understeer: driver must add more steering as speed rises
- K = 0 — neutral steer: steering angle is purely geometric (δ = L/R)
- K < 0 — oversteer: the car tries to turn more than the driver inputs; above critical speed it is unstable

### Characteristic and critical speeds

For an **understeering** car (K > 0), lateral acceleration peaks at the characteristic speed:

```
Vch = √(L / K_rad)      where K_rad is K in rad/(m/s²)
```

For an **oversteering** car (K < 0), directional stability is lost above the critical speed:

```
Vcrit = √(−L / K_rad)
```

A car operating near or above Vcrit is dynamically unstable — small disturbances grow rather than damp out.

### What it drives in the simulator

Understeer gradient display, handling diagram, characteristic/critical speed indicators, and the initial cornering stiffness values used by the lap time estimator.

---

## Stage 2 — Pacejka Magic Formula

### Concept

Real tyres are nonlinear. At small slip angles they behave linearly (Fy ≈ Cα · α), but as slip angle grows the tyre saturates and Fy peaks, then drops. The bicycle model cannot capture this. The Pacejka Magic Formula is a curve-fit equation that precisely describes nonlinear tyre behaviour from tyre test data.

### The formula

Lateral force:

```
Fy = D · sin(C · atan(B·α − E·(B·α − atan(B·α))))
```

Longitudinal force (same structure, different coefficients):

```
Fx = D · sin(C · atan(B·κ − E·(B·κ − atan(B·κ))))
```

where α is slip angle and κ is longitudinal slip ratio.

### Coefficient roles

| Coefficient | Name | Effect |
|---|---|---|
| B | Stiffness factor | Controls slope at origin — initial cornering stiffness = B·C·D |
| C | Shape factor | Controls width of peak and transition to saturation |
| D | Peak factor | Sets the peak force (D ≈ μ · Fz) |
| E | Curvature factor | Controls sharpness of peak and falloff; negative E = sharper peak |

The product B·C·D = Cα (cornering stiffness). Increasing B makes the tyre respond more aggressively to small slip angles. Increasing C widens the peak. Negative E sharpens the peak and steepens the dropoff — typical of racing slicks.

### Load dependence

D scales with vertical load Fz, but real tyres are **degressive** — doubling the load does not double the force. This is modelled via the load sensitivity parameter qFz (Stage 9):

```
D = μ(Fz) · Fz
μ(Fz) = μ0 · (1 − qFz · (Fz/Fz0 − 1))
```

A higher qFz means grip drops more steeply as load increases — a fundamental reason why load transfer hurts total grip of both tyres.

### Combined slip

When the tyre simultaneously generates lateral and longitudinal force, both compete for the same friction budget (the friction circle). The MF-Swift model (Stage 40) applies reduction factors:

```
Fy_combined = Fy · Gky(κ)
Fx_combined = Fx · Gxa(α)

Gky(κ) = cos(Cκy · atan(Bκy · κ))
Gxa(α) = cos(Cxα · atan(Bxα · α))
```

Hard braking into a corner reduces available lateral force — this is why trail braking technique is a deliberate compromise at the friction circle boundary.

---

## Stage 3 — Load Transfer & Drivetrain

### Concept

Every time a car accelerates, brakes, or corners, weight shifts between the axles and between inner and outer wheels. Load transfer directly affects tyre grip because Pacejka's D coefficient scales with Fz — but in a nonlinear, degressive way. The net effect is always a grip loss across both affected tyres.

### Longitudinal load transfer (braking / acceleration)

```
ΔFz_long = m · ax · h / L
```

Under braking (ax < 0), the front axle gains load and the rear loses load. The front gains grip; the rear loses grip. This is why rear-biased cars can spin under hard braking.

### Lateral load transfer (cornering)

Load transfers from the inner to the outer wheel on each axle. The split between front and rear axles depends on their relative roll stiffness:

```
ΔFz_lat_front = m · ay · h · (KΦf / KΦtotal) / tf
ΔFz_lat_rear  = m · ay · h · (KΦr / KΦtotal) / tr
```

A stiffer front (higher KΦf) pushes more load transfer to the front axle — degrading front grip → understeer. This is the primary mechanism through which suspension setup changes handling balance.

### Per-wheel vertical loads

```
Fz_FL = (Wf/2) − ΔFz_long/2 − ΔFz_lat_front
Fz_FR = (Wf/2) − ΔFz_long/2 + ΔFz_lat_front
Fz_RL = (Wr/2) + ΔFz_long/2 − ΔFz_lat_rear
Fz_RR = (Wr/2) + ΔFz_long/2 + ΔFz_lat_rear
```

These four values feed directly into the Pacejka model at each corner.

### Drivetrain

The drivetrain type (FWD/RWD/AWD/AWD+TV) determines which axle(s) receive drive torque. The driven axle's slip ratio κ is computed from the drive force and the tyre's Fx curve. Combined slip then reduces the available lateral force — this is why powerful FWD cars understeer badly under acceleration.

Torque vectoring (AWD+TV) applies a yaw moment by biasing torque left-to-right on the rear axle.

---

## Stage 4 — Suspension Roll Stiffness

### Concept

When a car corners, lateral load transfer tends to roll the body. Springs and anti-roll bars resist this. The total roll stiffness determines: (1) how much the body rolls, and (2) how load transfer is split front-to-rear — which directly sets the handling balance.

### Roll stiffness

Per axle — spring contribution:

```
KΦ_spring = ks · t² / 2      (Nm/rad)
```

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

More roll = tyres lean further from vertical = less contact patch area = less grip.

### Motion ratio (Stage 42)

Real suspension has a motion ratio MR < 1 — the wheel moves more than the spring. The effective wheel rate is:

```
k_wheel = k_spring · MR²
```

### Roll damper (Stage 43)

Critical damping ratio for the roll mode:

```
cΦ = 2 · ζ · √(KΦtotal · Ixx)
```

where ζ is the roll damper ratio (0.7 = critical damping, default). Underdamped roll (ζ < 0.5) causes oscillation through fast direction changes.

---

## Stage 5 — Braking Model

### Concept

The braking model computes the deceleration capacity and the optimal brake bias. Brake bias affects both maximum deceleration and the balance of the car under braking.

### Optimal brake bias

To avoid locking a wheel, brake force distribution must match the axle load distribution under braking:

```
Wf_dynamic = (m·g·b/L) + (m · ax · h / L)
Wr_dynamic = (m·g·a/L) − (m · ax · h / L)

B_opt = Wf_dynamic / (Wf_dynamic + Wr_dynamic)
```

- B > B_opt → front locks → understeer under braking (safer, suboptimal)
- B < B_opt → rear locks → spin (dangerous, common in oversteer-tuned cars)

### ABS

When longitudinal slip ratio κ exceeds the ABS threshold, drive/brake force is clipped to the tyre's peak Fx. This prevents lockup at the cost of some peak deceleration (the tyre is not at its true peak κ).

### Combined braking and cornering

The friction circle applies:

```
√(Fx² + Fy²) ≤ μ · Fz
```

The braking model passes κ to the Pacejka combined slip stage (Stage 40), which returns the effective Fx and Fy limits given the combined demand. This is why hard braking into a corner forces a compromise — the tyre cannot give full lateral and full longitudinal force simultaneously.

---

## Stage 6 — Aerodynamics

### Concept

At speed, the car's body generates aerodynamic downforce (negative lift) and drag. Downforce adds to vertical load, increasing tyre grip. Drag opposes forward motion, reducing acceleration and top speed. The trade-off between them is the central aero setup problem.

### Dynamic pressure

```
q = ½ · ρ · V²
```

Air density ρ depends on altitude and temperature (Stage 24 — ISA model):

```
ρ = p₀ · M / (R · T)
```

### Downforce and drag

```
Fa = q · CL · A      (N — downforce, adds to Fz)
Fd = q · CD · A      (N — drag, opposes motion)
```

where A is the reference area.

### Axle split

The aero balance parameter distributes downforce between front and rear:

```
Fa_front = Fa · (1 − aero_balance)
Fa_rear  = Fa · aero_balance
```

These add to Fz_front and Fz_rear, increasing grip at high speed. This is why corner speeds increase with downforce — the tyre's D coefficient rises with Fz.

### Ground effect (Stage 29)

Below a ride height threshold (~30 mm), the underbody venturi effect causes a steep increase in CL. The model applies a nonlinear boost factor as ride height decreases. Rake angle (rear higher than front) shifts aero balance rearward.

### Pre-computed CFD aero map (Stage 46)

A 2D lookup table indexed by [ride height × yaw angle] replaces single CL/CD values. This captures yaw-induced asymmetric downforce, ground effect sensitivity, and drag vs yaw. The map is class-specific (Road / Formula Student / GT3 / F1).

---

## Stage 7 — Lap Time Estimator

### Concept

A point-mass lap simulation. The circuit is represented as a sequence of corners (radius R) and straights (length s). The simulator walks through these segments computing the minimum time to traverse each, subject to tyre friction and power limits.

### Corner speed limit

Maximum speed through a corner of radius R:

```
V_corner = √(μ_eff · g · R)
```

With aerodynamic downforce:

```
V_corner = √((μ · (m·g + Fa) · R) / m)
```

As speed increases, Fa increases, which increases V_corner — a self-reinforcing benefit of downforce. This is why high-downforce cars gain disproportionately on fast circuits.

### Braking and acceleration passes

The simulator uses a backward pass (from corner exit) then forward pass (from corner entry):

```
Backward pass:  V_entry² = V_exit² + 2 · a_brake · ds
Forward pass:   V_exit²  = V_entry² + 2 · (F_drive − Fd) / m · ds
```

F_drive is limited by both power (P/V) and traction (μ · Fz_driven). a_brake = μ_eff · g + Fd/m.

### Track banking and gradient (Stage 37)

On a banked corner with bank angle θ, effective friction is:

```
μ_eff = μ · cosθ + sinθ
```

Gravity assists centripetal force on a banked road — this is why Eau Rouge/Raidillon is flat-out for GT3.

On a gradient of angle α:

```
F_grade = m · g · sinα      (resists on uphill, assists on downhill)
```
