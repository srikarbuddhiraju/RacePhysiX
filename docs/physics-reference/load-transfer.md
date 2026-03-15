# Load Transfer — ApexSim Physics Reference
*Reference for Claude. Validates against: Milliken & Milliken ch.17, Gillespie ch.6*

---

## 1. What Load Transfer Is

Load transfer is the redistribution of vertical tyre loads (Fz) across the four contact patches in response
to inertial forces during acceleration, braking, or cornering. No mass physically moves — it is a moment
reaction to the inertial force acting at the CG height above the ground plane.

**Why it matters:** The Pacejka peak force D scales with Fz, but NOT linearly (degressive). Load transfer
always causes a net loss of total axle grip capacity, and the asymmetry between inner/outer tyres drives
balance (oversteer/understeer) changes with speed and lateral acceleration.

---

## 2. Symbol Reference

| Symbol | Definition |
|--------|-----------|
| m | Total vehicle mass (kg) |
| g | Gravitational acceleration (9.81 m/s²) |
| h | CG height above ground (m) |
| L | Wheelbase: front axle to rear axle (m) |
| a | CG to front axle (m) |
| b | CG to rear axle (m); L = a + b |
| tf | Front track width (m) |
| tr | Rear track width (m) |
| ax | Longitudinal acceleration, positive = forward (m/s²) |
| ay | Lateral acceleration, positive = rightward SAE (m/s²) |
| Ff | Static front axle load = m × g × b / L (N) |
| Fr | Static rear axle load = m × g × a / L (N) |

---

## 3. Longitudinal Load Transfer

During braking or acceleration, the pitching moment transfers load between front and rear axles.

```
ΔFz_long = m × ax × h / L
```

- **Braking** (ax < 0): front axle gains load, rear loses load
- **Acceleration** (ax > 0): rear axle gains load, front loses load
- Higher h → more transfer per g

```
Fz_front_axle = Ff - ΔFz_long
Fz_rear_axle  = Fr + ΔFz_long
```

Note: under hard braking the front axle is loaded above its static value — this is why front brakes do
the majority of the work in any well-biased system.

---

## 4. Lateral Load Transfer

Cornering generates a rolling moment split between front and rear axles in proportion to their CG distance.

```
ΔFz_lat_front = m × ay × h × (b / L) / tf
ΔFz_lat_rear  = m × ay × h × (a / L) / tr
```

- `(b/L)` = rear weight distribution fraction — governs how much overturning moment the front axle resists
- Narrower track → more lateral load transfer per g
- Higher CG → more lateral load transfer per g

---

## 5. Per-Wheel Vertical Loads (Steady-State, Left Turn, ay > 0 SAE)

```
FL_front = Ff/2 + ΔFz_lat_front    (outer — loaded)
FR_front = Ff/2 - ΔFz_lat_front    (inner — unloaded)
FL_rear  = Fr/2 + ΔFz_lat_rear     (outer — loaded)
FR_rear  = Fr/2 - ΔFz_lat_rear     (inner — unloaded)
```

For a right turn (ay < 0 SAE): swap signs (inner/outer swap sides).
In combined braking + cornering: superimpose ΔFz_long on axle sums before splitting laterally.

**Sanity check:** FL_front + FR_front + FL_rear + FR_rear = m × g (always, steady-state).

---

## 6. Pacejka Nonlinearity and Tyre Saturation Asymmetry

Due to load sensitivity, a loaded outer tyre does NOT compensate for an unloaded inner tyre:

```
Fy_outer + Fy_inner < 2 × Fy_peak(Fz_static)
```

Common linearised approximation:
```
Fy_peak(Fz) ≈ c1 × Fz - c2 × Fz²      (c1, c2 > 0)
```

The greater ΔFz (higher ay, higher h, narrower track), the larger the grip loss. This is why
minimising load transfer (low CG, wide track) directly improves the lateral acceleration limit.

---

## 7. How Load Transfer Drives Balance Change with Speed

Balance depends on front vs rear effective cornering stiffness:
```
K = (m/L²) × (b/Cαf - a/Cαr)     [understeer gradient]
```

As speed rises → ay rises → lateral load transfer increases → due to Pacejka saturation:
- If **front axle** has higher lateral load transfer stiffness (stiffer front ARB, narrower front track):
  front loses more cornering stiffness → **understeer increases with speed**
- If **rear axle** loses more: vehicle transitions toward oversteer at higher lateral g

This speed-dependent balance shift cannot be captured by a fixed K — it requires the full four-wheel
model with Fz-dependent Pacejka lookups recomputed at every solver timestep.

---

## 8. What the Bicycle Model Ignores

The bicycle model lumps each axle into a single tyre at the centreline:
- No lateral load transfer — each axle's Fz fixed at its static value (Ff, Fr)
- No inner/outer tyre distinction — no left/right asymmetry
- Cornering stiffness treated as constant, not Fz-dependent
- Tyre saturation from load transfer is invisible; model stays linear until slip angle saturation

**Use bicycle model for:** yaw dynamics, steady-state K, transfer function derivations.
**Do not use for:** balance sensitivity, limit handling, tyre wear, or anything requiring per-wheel grip.

---

## 9. Quick Reference — Key Equations

```
ΔFz_long       = m × ax × h / L
ΔFz_lat_front  = m × ay × h × (b / L) / tf
ΔFz_lat_rear   = m × ay × h × (a / L) / tr

Fz_front_axle  = Ff - ΔFz_long
Fz_rear_axle   = Fr + ΔFz_long

FL_front = Ff/2 + ΔFz_lat_front
FR_front = Ff/2 - ΔFz_lat_front
FL_rear  = Fr/2 + ΔFz_lat_rear
FR_rear  = Fr/2 - ΔFz_lat_rear

Ff = m × g × b / L
Fr = m × g × a / L
```

---

*See `tyre-pacejka.md` for Pacejka full formulation. See `bicycle-model.md` for yaw dynamics context.*
