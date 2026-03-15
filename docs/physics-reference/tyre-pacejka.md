# Tyre Model — Pacejka Magic Formula — ApexSim Physics Reference
*Reference for Claude. Validates against: Pacejka (Tyre and Vehicle Dynamics), Milliken & Milliken Appendix*

---

## 1. Why Linear Cornering Stiffness Fails Above ~4 deg Slip Angle

Linear tyre models assume Fy = Cα × α (valid for |α| < ~4 deg). Beyond this, the trailing portion of
the contact patch reaches the adhesion limit and begins sliding. The lateral force gradient (dFy/dα)
decreases. Above ~10–12 deg the tyre is fully saturated and Fy plateaus then degrades.

A linear model:
- Overestimates Fy in the saturation region (non-conservative for handling limit calculations)
- Cannot represent the peak or post-peak drop (essential for stability/oversteer modelling)
- Cannot capture load sensitivity or combined slip effects

The Pacejka Magic Formula captures the full shape: linear rise → peak → saturation.

---

## 2. Pacejka Magic Formula Structure

```
Y(x) = D × sin( C × arctan( B×x − E×(B×x − arctan(B×x)) ) )
```

| Symbol | Role | Description |
|--------|------|-------------|
| Y | Output | Fy (lateral), Fx (longitudinal), or Mz (aligning moment) |
| x | Input | Slip angle α [rad] for lateral; slip ratio κ [-] for longitudinal |
| B | Stiffness factor | Scales the argument; initial slope = B×C×D |
| C | Shape factor | Controls limits of sine function; dictates peak width |
| D | Peak value | Maximum (peak) value of Y; scales with Fz |
| E | Curvature factor | Modifies shape around/beyond the peak; typically ≤ 1 |

**Initial slope (cornering stiffness from the formula):** `dY/dx|_{x=0} = B × C × D`

### Physical Meaning of Each Coefficient

- **B (stiffness factor)**: Stretches/compresses the x-axis. Higher B → steeper initial slope → stiffer tyre. Dimensionless when x is in radians.
- **C (shape factor)**: Controls how much of the sine wave is used. C ≈ 1.3 for lateral (peak with moderate drop); C ≈ 1.65 for longitudinal.
- **D (peak value)**: Maximum force the tyre can generate at the current Fz. D ≈ μ × Fz as first approximation; more precisely a polynomial in Fz. Units: Newtons.
- **E (curvature factor)**: Governs transition from peak into saturation. E < 0 shifts peak to higher slip angles and sharpens fall-off. Typically −3 < E < 1; negative E is common for lateral.

---

## 3. Lateral Force (Fy) vs Slip Angle (α)

Curve shape:
- **0 → ~4 deg**: linear rise, slope = BCD = Cα (cornering stiffness)
- **~4–10 deg**: nonlinear rise, gradient decreasing, adhesion limit spreading from trailing patch edge
- **~10–12 deg**: peak Fy = D
- **>12 deg**: shallow post-peak drop (E < 0 sharpens this); tyre sliding across most of patch

Oversteer = rear tyre operating past its peak. Understeer = front tyre past its peak.

Self-aligning moment Mz peaks before Fy and crosses zero near the Fy peak — pneumatic trail collapses as
patch centre of pressure moves forward. Mz = 0 at peak Fy is a useful on-vehicle diagnostic.

---

## 4. Longitudinal Force (Fx) vs Slip Ratio (κ)

**Slip ratio definition:**
```
κ = (V_wheel − V_vehicle) / V_vehicle
```
Where V_wheel = ω × r_eff (peripheral wheel speed), V_vehicle = longitudinal speed at the hub.

- κ = 0: free rolling
- κ = −1: wheel locked (full brake slide)
- κ > 0: drive (wheel spinning faster than free-roll)

Typical shape: peak at κ ≈ ±0.10–0.15 (10–15% slip), then plateau or slight drop.
Longitudinal stiffness (Cs = BCD for Fx) is typically 2–3× higher than Cα per unit Fz — tyres build
longitudinal force faster (in κ) than lateral force (in α).

---

## 5. Friction Circle (Kamm Circle) — Combined Slip

```
Fy² + Fx² ≤ (μ × Fz)²
```

The contact patch has a finite friction budget. Using it for Fx (braking/acceleration) leaves less for Fy
(cornering), and vice versa. Full braking while cornering reduces available Fy by ~20–40%.

For v0.1 pure-cornering implementation (§7), Fx = 0 — full friction circle available for Fy.
This assumption is only valid with zero brake/throttle during the corner.

---

## 6. Effect of Vertical Load (Fz) on Peak Force — Load Sensitivity

D is not linear in Fz. Peak force coefficient μ_peak decreases as Fz increases (degressive behaviour):

```
D(Fz) = (a1 × Fz² + a2 × Fz)   [Pacejka 96 lateral, simplified]
```

Or: `μ_peak(Fz) = a1×Fz + a2`, where a1 < 0.

**Physical cause:** at high Fz, rubber deforms less efficiently and local adhesion limits are reached earlier.

**Practical consequence:** load transfer during cornering means the loaded outer tyre does NOT compensate
for the unloaded inner tyre. Total axle Fy < 2 × Fy(static). This is why minimising load transfer matters.

---

## 7. Typical Pacejka 96 Coefficients — Passenger Car Lateral (Fy)

Reference load Fz0 = 4000 N (~corner weight of 1500 kg car). Approximate — real data is proprietary.

| Coefficient | Symbol | Typical value | Notes |
|-------------|--------|---------------|-------|
| Shape factor | C | 1.30 | Moderate post-peak drop |
| Stiffness factor | B | 10.0 rad⁻¹ | At reference load |
| Peak value | D | 4800 N | μ ≈ 1.2 at Fz0 |
| Curvature factor | E | −1.5 | Sharpens post-peak drop |
| Cornering stiffness | BCD | ~62 400 N/rad | ≈ 1089 N/deg — consistent with 195/65 R15 literature |

For load variation: D(Fz) = a1×Fz² + a2×Fz with a1 ≈ −0.000 22 [1/N], a2 ≈ 1.40 [-] as a starting point.

---

## 8. v0.1 Implementation — Simplified Pure-Lateral Pacejka

For v0.1: lateral Fy only (pure cornering, Fx = 0, no combined slip).

```typescript
// Pacejka Magic Formula — pure lateral
// alpha: slip angle in radians (signed)
// Fz:   normal load in N
function pacejkaFy(alpha: number, Fz: number): number {
  // Load-sensitive D
  const a1 = -0.000220;  // 1/N
  const a2 =  1.40;      // dimensionless
  const D = (a1 * Fz + a2) * Fz;  // peak force [N]

  const B = 10.0;   // stiffness factor [1/rad]
  const C = 1.30;   // shape factor
  const E = -1.50;  // curvature factor

  const Bx = B * alpha;
  return D * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))));
}
```

**Known limitations of v0.1 model (document in code):**
1. No Fx — cannot simulate braking-in-corner or trail-braking
2. No combined slip — full friction circle available for Fy at all times
3. B and C held constant with Fz — only D varies (slight error vs full Pacejka 96)
4. No camber thrust — valid for upright road car, not motorcycles or cambered slicks
5. Mz not modelled — no steering feel or caster trail effects

**Upgrade path:** add Fx (longitudinal Pacejka) + Kamm circle weighting for v0.2 combined-slip model.

---

*See `bicycle-model.md` for equations of motion using Fy. See `load-transfer.md` for per-wheel Fz calculation.*
