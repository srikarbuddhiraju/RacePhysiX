# Mechanics Fundamentals — ApexSim Physics Reference
*Reference for Claude. Validates against: Milliken & Milliken (Race Car Vehicle Dynamics), Gillespie (Fundamentals of Vehicle Dynamics)*

---

## Coordinate System — SAE J670 (chosen for ApexSim)

**ApexSim uses the SAE coordinate system.**

| Axis | Direction | Positive sense |
|------|-----------|----------------|
| X    | Forward (longitudinal) | Vehicle forward travel |
| Y    | Right (lateral) | Rightward from driver perspective |
| Z    | Down | Into the ground |

**Why SAE over ISO:**
- SAE is standard in North American and motorsport literature (Milliken, Gillespie, Dixon).
- Positive slip angle (α > 0) corresponds to a rightward yaw — intuitive for cornering analysis.
- ISO flips Y and Z; Z-up means lateral force sign conventions invert. SAE is more legible in FBDs.
- Majority of tyre data suppliers (MF-Tyre / Pacejka Magic Formula datasets) ship in SAE convention.

**Rotation (moments) — right-hand rule about each axis (SAE):**
- Roll (p): about X-axis, positive = right side down.
- Pitch (q): about Y-axis, positive = nose up.
- Yaw (r): about Z-axis (down), positive = **clockwise when viewed from above** (turning right).

---

## Newton's Laws Applied to Vehicle Motion

### 1. Longitudinal (X-axis)

```
m * ax = ΣFx = (Fx_FL + Fx_FR + Fx_RL + Fx_RR) - Fdrag - Froll
```

- `ax` = longitudinal acceleration (positive = forward).
- `Fx_ij` = tyre longitudinal force at each corner (positive = forward thrust).
- `Fdrag` = aerodynamic drag (always opposing motion).
- `Froll` = rolling resistance (always opposing motion).

### 2. Lateral (Y-axis)

```
m * ay = ΣFy = Fy_FL + Fy_FR + Fy_RL + Fy_RR
```

- `ay` = lateral acceleration (positive = rightward, SAE).
- `Fy_ij` = tyre lateral force at each corner.
- In steady-state cornering: `m * ay = m * V² / R` where R = turn radius.

### 3. Yaw (rotation about Z-axis)

```
Iz * r_dot = Mz = ΣMz_tyres + ΣMz_aero
```

- `Iz` = yaw moment of inertia (kg·m²).
- `r_dot` = yaw angular acceleration (rad/s²).
- `r` = yaw rate (rad/s), positive = turning right (SAE).
- `Mz` = net yaw moment about vehicle CG.

**Yaw moment from tyre lateral forces (bicycle model):**
```
Mz = (Fy_front × a) - (Fy_rear × b)
```
- `a` = distance CG to front axle, `b` = distance CG to rear axle.
- Front lateral force generates a positive (right-turning) moment when turning right;
  rear lateral force generates a restoring (negative) moment — this is the basis of understeer/oversteer.

---

## Yaw Moment of Inertia (Iz)

**What it represents:**
- Iz is the resistance of the vehicle body to angular acceleration about the vertical (Z) axis through the CG.
- A vehicle with mass concentrated near the CG (mid-engine) has a lower Iz than one with mass at the extremities.
- Low Iz → quicker yaw response (more agile); high Iz → sluggish yaw response (more stable).

**Typical values (about CG, Z-axis):**

| Vehicle type | Iz (kg·m²) |
|---|---|
| Compact car (e.g. Golf) | 1,500 – 2,000 |
| Mid-size sedan | 2,500 – 3,200 |
| SUV / estate | 3,500 – 5,000 |
| Formula-style single-seater | 800 – 1,200 |

**Estimation:** `Iz ≈ m × k²` where k = radius of gyration ≈ 1.0–1.3 m for passenger cars.
Segel approximation: `Iz ≈ m × a × b` (reasonable for simulation initialisation).

---

## Free Body Diagram — Cornering Vehicle

Setup: vehicle turning right at constant speed (steady-state), viewed from above.

```
         Fy_FL↑   Fy_FR↑
          [FL]----[FR]
           |   CG   |
          [RL]----[RR]
         Fy_RL↑   Fy_RR↑

         Centripetal acceleration ← (toward centre of turn)
```

**Forces acting:**

1. **Tyre lateral forces (Fy_ij):** Generated at each contact patch. All four Fy contribute to centripetal force.
2. **Tyre longitudinal forces (Fx_ij):** In pure cornering (coast), small — primarily overcoming rolling resistance.
3. **Normal loads (Fz_ij):** In cornering, lateral load transfer reduces Fz on inside wheels, increases on outside.
   Because tyre lateral capacity is nonlinear in Fz, load transfer reduces total lateral force capacity.
4. **Aerodynamic downforce (Fz_aero):** Acts at aero COP (centre of pressure), not necessarily at CG.

---

## Sign Conventions (ApexSim standard)

| Quantity | Positive direction | Notes |
|---|---|---|
| Yaw angle (ψ) | Clockwise from above (turning right) | SAE Z-down, right-hand rule |
| Yaw rate (r = ψ_dot) | Clockwise from above | Positive = turning right |
| Lateral acceleration (ay) | Rightward | Positive in a right-hand turn |
| Slip angle (α) | Positive when velocity vector points left of wheel heading | Front: positive α → positive Fy (rightward) |
| Longitudinal slip (κ) | Positive under drive (wheel spinning faster than free-rolling) | Negative under braking |
| Steering angle (δ) | Positive = front wheels steered right | Consistent with positive yaw convention |

**Slip angle definition:**
```
α = δ - arctan(vy / vx)   [front axle, bicycle model]
α = -arctan(vy / vx)      [rear axle, bicycle model, no rear steer]
```

---

## Why the Contact Patch is the Reference for Tyre Forces

- Tyre forces are physically generated by shear stress at the tyre–road interface. The resultant acts at the contact patch centre.
- Referencing forces at the contact patch eliminates the need to carry a moment arm for the tyre structure in the vehicle-level equations of motion.
- Self-aligning torque (Mz_tyre) = `-Fy × t` where t = pneumatic trail (offset between contact patch centre and centre of pressure of lateral stress distribution).
- In the vehicle FBD, tyre forces (Fx, Fy, Fz) are resolved at the contact patch and transferred to the CG via moment arms (a, b, track/2).

---

## Key Dimensionless / Derived Quantities

| Symbol | Definition | Significance |
|---|---|---|
| ay/g | Lateral g | Normalised cornering demand |
| μ | Tyre–road friction coefficient | Peak: ~0.8–1.0 (road), ~1.5–2.0 (slick race tyre) |
| κ | Longitudinal slip ratio | Drives Fx in Pacejka MF |
| α | Slip angle (deg or rad) | Drives Fy in Pacejka MF |
| Fz | Normal (vertical) tyre load | Modulates both Fx and Fy capacity nonlinearly |
| t | Pneumatic trail | Determines self-aligning torque; decreases near friction limit |

---

*See `bicycle-model.md` for equations of motion. See `tyre-pacejka.md` for Pacejka Magic Formula implementation.*
