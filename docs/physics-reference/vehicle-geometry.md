# Vehicle Geometry — ApexSim Physics Reference
*Reference for Claude. Validates against: Milliken & Milliken (Race Car Vehicle Dynamics), Gillespie (Fundamentals of Vehicle Dynamics)*

---

## 1. Fundamental Parameters

| Symbol | Name | Definition |
|--------|------|------------|
| L | Wheelbase | Longitudinal distance between front and rear axle centrelines |
| a | CG-to-front axle | Longitudinal distance from CG to front axle |
| b | CG-to-rear axle | Longitudinal distance from CG to rear axle; L = a + b |
| tf | Front track width | Lateral distance between front contact patch centrelines |
| tr | Rear track width | Lateral distance between rear contact patch centrelines |
| h | CG height | Vertical distance from ground to centre of gravity |
| Wf/W | Front weight fraction | Fraction of total weight on front axle (static) |
| W | Total vehicle weight | mg (Newtons) |

---

## 2. Static Axle Loads

```
Ff = W × (b / L)     [front axle load]
Fr = W × (a / L)     [rear axle load]
```

- `a` = CG to front axle, `b` = CG to rear axle
- Front weight fraction: Wf/W = b/L
- Rear weight fraction: Wr/W = a/L
- Cross-check: Ff + Fr = W always

**Individual wheel loads (symmetric vehicle, static):**
```
F_FL = F_FR = Ff / 2
F_RL = F_RR = Fr / 2
```

**Derived from weight fraction:**
```
a = L × (1 - Wf/W)     [CG to front axle]
b = L × (Wf/W)          [CG to rear axle]
```

---

## 3. Effect of Each Parameter on Dynamics

| Parameter | Increase effect | Decrease effect |
|-----------|----------------|-----------------|
| L (wheelbase) | More longitudinally stable, slower yaw response | Agile but nervous; less pitch during braking/accel |
| tf / tr (track) | Reduces lateral load transfer; more stable in roll | Increases lateral load transfer; more sensitive to roll |
| h (CG height) | Increases both longitudinal and lateral load transfer | Reduces load transfer; preferred for performance |
| Wf/W (front bias) | Tends toward understeer | Tends toward oversteer |
| Wr/W (rear bias) | Tends toward oversteer | Tends toward understeer |

---

## 4. Typical Values — Passenger Car vs Formula Student

| Parameter | Passenger Car | Formula Student (FS) |
|-----------|--------------|----------------------|
| Wheelbase L | 2600–2800 mm | 1500–1700 mm |
| Front track tf | 1400–1550 mm | 1100–1200 mm |
| Rear track tr | 1380–1520 mm | 1050–1150 mm |
| CG height h | 500–600 mm | 250–320 mm |
| Front weight fraction Wf/W | 0.55–0.62 (FWD), 0.48–0.52 (RWD) | 0.43–0.47 (rear-biased) |
| Total mass | 1300–1700 kg | 180–280 kg |
| Wheelbase/track ratio | ~1.8 | ~1.4 |
| Iz (estimated) | 2000–3200 kg·m² | 130–180 kg·m² |

**FS design intent:** low CG + rear bias + narrow wheelbase/track ratio = high yaw agility, low load transfer.
**Passenger car intent:** front-heavy for passive safety (engine over front axle), taller CG acceptable.

---

## 5. Contact Patch

**Definition:** The deformed footprint where the tyre rubber contacts the road. Approximately elliptical;
size depends on tyre pressure, vertical load, and tyre construction.

**Why it matters:**
- All longitudinal (Fx), lateral (Fy), and vertical (Fz) tyre forces are generated and applied here
- The contact patch centre is the effective force application point for tyre modelling (Pacejka, etc.)
- Tyre moments (overturning Mx, rolling resistance My, self-aligning Mz) are calculated about this point
- Slip angle α is defined at the contact patch (velocity vector of contact patch centre vs tyre heading)
- In simulation, the contact patch position must be tracked per wheel as suspension moves

---

## 6. Reference Frames

### 6.1 Vehicle Body Frame (SAE convention)
- Origin: at CG
- x: forward, y: rightward, z: downward (SAE)
- Moves and rotates with the vehicle
- **Used for:** equations of motion, tyre force inputs, inertia tensor

### 6.2 Inertial (World) Frame
- Origin: fixed to ground, non-rotating
- **Used for:** vehicle trajectory integration, track mapping, replay position

### 6.3 Tyre/Wheel Frame
- Origin: at contact patch centre
- x: wheel heading, y: lateral (perpendicular to heading, in ground plane)
- **Used for:** slip angle, slip ratio, Pacejka inputs/outputs
- Tyre forces output in wheel frame; transform to body frame before applying to EOM

**Rule of thumb:** compute forces in body/tyre frame; integrate position/trajectory in inertial frame.

---

## 7. Yaw Inertia — Segel Approximation

```
Iz ≈ m × a × b
```

- FS car (m = 230 kg, a = 0.82 m, b = 0.78 m): Iz ≈ 147 kg·m²
- Passenger car (m = 1500 kg, a = 1.25 m, b = 1.45 m): Iz ≈ 2719 kg·m²

Acceptable for simulation initialisation. Use measured or CAD-derived Iz when available.

---

*See `load-transfer.md` for per-wheel Fz under cornering/braking. See `mechanics-fundamentals.md` for coordinate system and sign conventions.*
