# Physics Reference — Index
*Read this before reading any physics doc. Jump directly to the relevant file + section.*

---

## Quick lookup

| I need to know about... | Go to |
|---|---|
| Coordinate system (SAE vs ISO) | `mechanics-fundamentals.md §Coordinate System` |
| Sign conventions (yaw, slip, steer) | `mechanics-fundamentals.md §Sign Conventions` |
| Newton's laws applied to the vehicle | `mechanics-fundamentals.md §Newton's Laws` |
| Yaw inertia Iz, how to estimate it | `mechanics-fundamentals.md §Iz` |
| What a, b, L, h, track mean | `vehicle-geometry.md §1` |
| How front weight fraction maps to a and b | `vehicle-geometry.md §2` |
| Typical parameter values (road car vs FS) | `vehicle-geometry.md §4` |
| Bicycle model assumptions (when it's valid) | `bicycle-model.md §1` |
| Slip angle definitions (full dynamic form) | `bicycle-model.md §3` |
| Equations of motion (state-space A, B matrices) | `bicycle-model.md §5` |
| Handling equation δ = L/R + K·ay | `bicycle-model.md §6` |
| Understeer gradient K — formula + derivation | `bicycle-model.md §7` |
| Characteristic speed / critical speed | `bicycle-model.md §7` |
| Handling diagram (α vs ay plot) | `bicycle-model.md §8` |
| Why the bicycle model fails above ~0.4g | `bicycle-model.md §9` |
| Why linear Cα fails above ~4 deg | `tyre-pacejka.md §1` |
| Pacejka Magic Formula (B, C, D, E roles) | `tyre-pacejka.md §2` |
| Fy vs α curve shape | `tyre-pacejka.md §3` |
| Fx vs κ (longitudinal), slip ratio | `tyre-pacejka.md §4` |
| Friction circle / combined slip | `tyre-pacejka.md §5` |
| Load sensitivity of D(Fz) | `tyre-pacejka.md §6` |
| Typical Pacejka coefficients (passenger car) | `tyre-pacejka.md §7` |
| Pacejka TypeScript implementation (v0.1) | `tyre-pacejka.md §8` |
| What load transfer is, why it matters | `load-transfer.md §1` |
| Longitudinal load transfer (braking/accel) | `load-transfer.md §3` |
| Lateral load transfer per axle | `load-transfer.md §4` |
| Per-wheel Fz equations | `load-transfer.md §5` |
| How load transfer causes balance shift with speed | `load-transfer.md §7` |
| What the bicycle model ignores (load transfer) | `load-transfer.md §8` |
| All load transfer equations in one block | `load-transfer.md §9` |

---

## File summaries

### `mechanics-fundamentals.md` (159 lines)
Coordinate system, Newton's laws for longitudinal/lateral/yaw, Iz values, FBD, sign conventions table.
**Read first** if implementing a new EOM or unsure about sign conventions.

### `vehicle-geometry.md` (126 lines)
Parameters: a, b, L, h, track. Static axle load formulas. Parameter effect table. Typical values for road car vs Formula Student. Reference frames. Segel Iz approximation.
**Read first** if working with geometry, weight distribution, or load calculations.

### `bicycle-model.md` (180 lines)
Full linear bicycle model: assumptions, slip angles, EOM (state-space), steady-state response, understeer gradient K, handling diagram, limits. Validated against Gillespie Ch.6.
**Key notation:** ApexSim uses b = CG to REAR axle (opposite to Gillespie).
**Read before** any change to `bicycleModel.ts`.

### `tyre-pacejka.md` (161 lines)
Pacejka Magic Formula: B/C/D/E roles, Fy curve shape, Fx vs κ, friction circle, load sensitivity, typical coefficients, TypeScript snippet for Stage 2.
**Read before** implementing Stage 2 (Pacejka tyre model).

### `load-transfer.md` (159 lines)
Longitudinal + lateral load transfer formulas, per-wheel Fz, Pacejka nonlinearity, how load transfer drives balance shift with speed, bicycle model limitations.
**Read before** implementing Stage 3 (four-wheel model with Fz-dependent tyres).

---

## Notation conventions (ApexSim vs Gillespie)

| Quantity | ApexSim | Gillespie Ch.6 |
|---|---|---|
| CG to front axle | `a` | `c` |
| CG to rear axle | `b` | `b` |
| Front weight fraction | `b/L` | `c/L` |
| Understeer gradient | `K = (m/L)(b−a)/Cα` | `K = Wf/Cαf − Wr/Cαr` |

Both are equivalent — just different symbols. The formulas give the same numerical result.
