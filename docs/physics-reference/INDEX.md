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

## Textbook catalogue

All PDFs in `docs/Textbooks/`.

### Gillespie — *Fundamentals of Vehicle Dynamics* (Revised Ed.)
**Notation:** `b`=CG to FRONT, `c`=CG to REAR — **opposite** to ApexSim.

| Topic | Location |
|---|---|
| Tyre slip, lateral force, SAE axes | Ch.2 |
| Bicycle model EOM | Ch.6 §6.1–6.2 |
| Understeer gradient K (eq.6.15) | Ch.6 §6.3 |
| Handling equation δ=L/R+K·ay (eq.6.16) | Ch.6 §6.3 |
| Characteristic / critical speed | Ch.6 §6.3 |
| Handling diagram | Ch.6 §6.4 |

### Milliken & Milliken — *Race Car Vehicle Dynamics* (RCVD)
**Notation:** `a`=CG to front, `b`=CG to rear — **matches ApexSim**.

| Topic | Location |
|---|---|
| Tyre lateral force, friction circle, combined slip | Ch.2 p.13 |
| Vehicle axis systems | Ch.4 p.113 |
| Bicycle model, K, characteristic/critical speed | Ch.5 p.123 |
| Transient stability, dynamic response | Ch.6 p.231 |
| g-g diagram | Ch.9 p.345 |
| Tyre data treatment, Pacejka nondimensionalisation | Ch.14 p.473 |
| Lateral + longitudinal load transfer, per-wheel Fz | Ch.18 p.665 |

### Pacejka — *Tyre and Vehicle Dynamics* (3rd Ed.)
**Notation:** ISO (z-up); α sign opposite SAE (positive α → positive Fy). C_Fα = BCD.
**Filename:** use symlink `Pacejka-Tire-and-Vehicle-Dynamics-2016.pdf` (Unicode in original).

| Topic | Location |
|---|---|
| Slip angle α, longitudinal slip κ, C_Fα definition | Ch.1 §1.2.1 p.3 |
| Magic Formula basic form B,C,D,E (eq.1.6) | Ch.1 §1.2.1 p.7 |
| Effective axle cornering characteristics | Ch.1 §1.2.2 p.7 |
| Bicycle model EOM, linear 2-DOF, steady-state | Ch.1 §1.3.1–1.3.2 p.16 |
| Nonlinear steady-state, handling diagram | Ch.1 §1.3.3 p.35 |
| Brush model (physical tyre) | Ch.3 |
| Magic Formula — full formulation | Ch.4 |
| Transient tyre, relaxation length | Ch.7–8 |
| SWIFT model (high-frequency) | Ch.9 |

---

## Notation conventions (ApexSim vs Gillespie)

| Quantity | ApexSim | Gillespie Ch.6 |
|---|---|---|
| CG to front axle | `a` | `c` |
| CG to rear axle | `b` | `b` |
| Front weight fraction | `b/L` | `c/L` |
| Understeer gradient | `K = (m/L)(b−a)/Cα` | `K = Wf/Cαf − Wr/Cαr` |

Both are equivalent — just different symbols. The formulas give the same numerical result.
