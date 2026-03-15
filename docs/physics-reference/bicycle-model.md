# Bicycle Model — ApexSim Physics Reference
*Reference for Claude. Validates against: Milliken & Milliken ch.5, Gillespie ch.6*

---

## 1. Model Assumptions

The linear bicycle model collapses a four-wheeled vehicle to a two-axle planar system.
All of the following must hold for the equations below to be valid:

- **No load transfer**: normal forces at each axle are constant (no pitch, no roll).
- **Linear tyre model**: lateral force is proportional to slip angle (Fy = Cα·α); valid only for |α| ≲ 4–5°.
- **Small angle approximation**: sin(δ) ≈ δ, cos(δ) ≈ 1; steer angles are small.
- **Constant longitudinal speed**: V_x is held fixed; no traction/braking forces modelled.
- **Combined-slip neglected**: longitudinal slip does not modify lateral cornering stiffness.
- **Rigid body, flat road**: no suspension compliance, no camber, no aerodynamic forces.
- **Front-steer only**: rear steer angle δ_r = 0 unless explicitly extended.

---

## 2. Geometry and State Variables

```
         a          b
  [Ff]<------CG----->[Fr]
       V_x (forward positive)
       V_y (lateral, leftward positive in ISO; rightward in SAE)
       r   (yaw rate, counterclockwise positive in ISO)
       δ   (front steer angle)
```

- `L = a + b` — wheelbase
- `a` — CG to front axle
- `b` — CG to rear axle
- `m` — vehicle mass
- `Iz` — yaw moment of inertia about CG

---

## 3. Slip Angle Definitions

Slip angle = angle between tyre heading and its velocity vector at the contact patch.

```
αf = δ - (V_y + a·r) / V_x        [front axle]
αr =   - (V_y - b·r) / V_x        [rear axle]
```

- `V_y + a·r` = lateral velocity of the front contact patch in the body frame
- `V_y - b·r` = lateral velocity of the rear contact patch in the body frame
- Positive α → tyre generates positive lateral force (for positive Cα)

---

## 4. Linear Tyre Model

```
Fyf = Cαf · αf
Fyr = Cαr · αr
```

- `Cαf`, `Cαr` — front and rear cornering stiffness [N/rad], always positive
- This is the slope of the Fy-vs-α curve at α = 0 (linear region only)

---

## 5. Equations of Motion

**Lateral** (Newton's 2nd, y-direction in body frame):
```
m · (V_y_dot + V_x · r) = Fyf + Fyr
```
`V_x · r` is the centripetal acceleration term.

**Yaw** (moment about CG):
```
Iz · r_dot = a · Fyf - b · Fyr
```

This yields a 2-state linear system with state [V_y, r] and input δ:

```
[V_y_dot]   [A11  A12] [V_y]   [B1]
[r_dot  ] = [A21  A22] [ r ] + [B2] · δ

A11 = -(Cαf + Cαr) / (m·V_x)
A12 = -(a·Cαf - b·Cαr) / (m·V_x) - V_x
A21 = -(a·Cαf - b·Cαr) / (Iz·V_x)
A22 = -(a²·Cαf + b²·Cαr) / (Iz·V_x)

B1  =  Cαf / m
B2  =  a·Cαf / Iz
```

---

## 6. Steady-State Response

At steady state (V_y_dot = 0, r_dot = 0):

**Yaw rate gain:**
```
r / δ = V_x / (L + K · V_x²)
```

**Lateral acceleration gain:**
```
a_y / δ = V_x² / (L + K · V_x²)
```

**Steer angle required for radius R:**
```
δ = L/R + K · a_y
```
The `L/R` term is the Ackermann (kinematic) steer; `K · a_y` is the dynamic correction.

---

## 7. Understeer Gradient

```
K = (m / L²) · (b/Cαf - a/Cαr)          [rad / (m/s²)]
```

Equivalently per g: `K_g = K · g   [rad/g]`

| Condition | K value | Behaviour |
|-----------|---------|-----------|
| Understeer | K > 0 | More steer required as speed rises |
| Neutral steer | K = 0 | Yaw rate gain constant with speed |
| Oversteer | K < 0 | Less steer required; gain diverges at V_crit |

**Characteristic speed** (understeer, K > 0):
```
V_char = sqrt(g · L / K)
```
At V_char, yaw rate gain = half its low-speed value.

**Critical speed** (oversteer, K < 0):
```
V_crit = sqrt(-g · L / K)
```
At V_crit, yaw rate gain → ∞; vehicle is directionally unstable above V_crit.

---

## 8. Handling Diagram

Plot: lateral acceleration `a_y` on x-axis vs steer correction `δ - L/R` on y-axis.

- **Neutral steer**: horizontal line (steer correction independent of a_y)
- **Understeer**: slopes upward — driver adds steer as a_y rises
- **Oversteer**: slopes downward — driver removes steer as a_y rises; zero at limit
- Gradient at any a_y = instantaneous K
- Axle characteristic curves (slip angle vs lateral force) can be overlaid to show which axle saturates first

---

## 9. Limitations — Why Pacejka is Needed Above ~0.4g

- **Tyre nonlinearity**: Cα is constant only for α ≲ 4–5°. At higher slip, Fy peaks then saturates.
- **Load transfer**: Cα is load-dependent (digressive); front/rear balance shifts dynamically with speed.
- **Combined slip**: simultaneous longitudinal + lateral slip reduces available lateral force (friction circle).
- **Large angles**: small-angle assumption fails above δ ≈ 10° (hairpins, limit cornering).
- **Aerodynamics**: downforce changes Fz at speed — critical for race vehicles, irrelevant below ~80 km/h road.
- **Suspension kinematics**: camber gain, roll steer, compliance steer alter effective slip angles.

**Use bicycle model for:** control law derivation, eigenvalue/stability analysis, steady-state understeer gradient K.
**Switch to Pacejka + load transfer for:** limit handling, balance sensitivity, any simulation above ~0.4g lateral.

---

*See `tyre-pacejka.md` for Magic Formula. See `load-transfer.md` for per-wheel Fz effects.*
