# Formula Student Guide

A dedicated guide for Formula Student / FSAE teams using RacePhysiX as a setup and design tool.

---

## Why RacePhysiX for Formula Student?

Professional vehicle dynamics software (CarSim, VI-Grade, Adams) costs $20,000–$100,000 per year. RacePhysiX implements the same core models — Pacejka tyre model, load transfer, suspension kinematics, lap time simulation — and runs in any browser for free under AGPL-3.0.

It won't replace a full multibody dynamics solver for detailed suspension geometry. But for:
- **Design decisions**: spring rates, ARB sizing, aero coefficient targets, weight distribution
- **Setup direction**: quick parameter sweeps before a test day
- **Lap time sensitivity analysis**: which parameter matters most on your specific circuit?
- **Race strategy**: tyre compound choice, fuel load, stint planning (if your event has endurance)

…it is a genuinely useful tool that takes minutes to set up and seconds to run.

---

## Loading the Formula Student preset

Click **Formula Student** in the preset selector at the top of the page. This loads:

| Parameter | Value | Basis |
|---|---|---|
| Mass | 250 kg | Typical FS car with driver (65 kg driver + 185 kg car) |
| Engine power | 75 kW | ~100 hp — restricted single-cylinder or 600 cc inline-4 |
| Wheelbase | 1.6 m | Typical FS wheelbase |
| CG height | 0.28 m | Low CG, no body roll concerns |
| Front weight fraction | 0.45 | Slight rear bias |
| Drivetrain | RWD | Most common FS configuration |
| Peak μ | 1.75 | Hoosier or Avon 6" slick on a dry track |
| Aero CL | 1.8 total | Moderate FS aero package |
| Front spring | 20 N/mm | Soft — FS cars have minimal unsprung mass |
| Rear spring | 22 N/mm | Slightly stiffer rear |

Adjust from there for your car's actual specifications.

---

## Entering your car's real parameters

Work through each tab and enter your car's actual values. Key parameters that most affect results:

### Mass and weight distribution (Vehicle tab)

- **Total mass**: weigh your car with a representative driver. Include fuel.
- **Front weight fraction**: measure at all four corners with the car at race ride height. Front fraction = (FL + FR) / total.
- **CG height**: if you have not measured this, use 0.25–0.32 m for a typical FS car.
- **Wheelbase and track**: measure from the actual car, not the CAD model (they differ in practice).

### Tyre data (Tyres & Fuel tab)

The default Pacejka coefficients are set for a representative Hoosier 18×6.0–10 slick. If you have actual tyre test data (from FSAE Tyre Test Consortium or your own flat-track testing), enter the coefficients directly in the Advanced tab.

Key coefficients to check:
- **D (peak value)**: should match your measured peak μ at your expected tyre load range
- **C (shape factor)**: 1.5 is typical for a bias-ply FS slick
- **E (curvature factor)**: −2.0 to −2.5 for a slick with a sharp peak

If you have no tyre data, the defaults are a reasonable starting point for a Hoosier slick.

### Suspension (Suspension tab)

- **Spring rates**: enter your actual wheel rates (spring rate × motion ratio²), not the coilover spring rate
- **Motion ratio**: important — most FS teams use coilovers with MR of 0.6–0.85
- **ARB rates**: if you have active ARBs or no ARBs, set to 0
- **Roll centre heights**: estimate from your suspension geometry at ride height

### Aerodynamics (Aero & Braking tab)

If your car has aero:
- **CL**: use your CFD results or tunnel data total lift coefficient × reference area (typically 1.0–1.2 m²)
- **CD**: your total drag coefficient × reference area
- **Aero balance**: percentage of downforce on the front axle (front wing CL / total CL)
- **Reference area**: use 1.0 m² as a baseline if unsure — the model uses CL × area directly

If no aero: set CL = 0, CD = your car's body drag only.

---

## Key design questions RacePhysiX can answer

### 1. What is the ideal weight distribution for my circuit?

Run a parameter sweep:
1. Set all other parameters to your car's values
2. Vary **Front Weight Fraction** from 0.40 to 0.55 in steps of 0.01
3. Run Lap Sim at each value on your event's circuit
4. The minimum lap time corresponds to the optimal static weight distribution

Typical result: FS cars with significant aero want ~0.43–0.47 front bias for most FSAE-style circuits.

### 2. How much does my aero package actually help?

1. Set CL = 0, CD = car body drag only → run lap sim → note time
2. Set CL = your full aero package → run lap sim → note time
3. The delta is the aero benefit on your event circuit

On a typical FS autocross (lots of slow corners, few straights), downforce helps significantly through tight corners. On endurance (longer straights), the drag penalty starts to matter.

### 3. What spring rates minimise lap time?

Use the **Setup Optimiser** (Lap Time panel → Optimiser tab). It will find the spring rate and ARB combination that minimises lap time on your target circuit. Cross-check that the resulting understeer gradient (K) is in a sensible range for a FS car (0 to +1.0 deg/g).

### 4. How sensitive is lap time to mass reduction?

A useful rule of thumb from the simulation: on a typical FS circuit, every 10 kg of mass reduction saves approximately 0.3–0.5 seconds per lap. This quantifies the return on investment of lightweight components against design time.

### 5. What tyre pressure should I run?

The tyre pressure model (Pacejka §4.3.1) predicts:
- **Too low (<1.5 bar)**: cornering stiffness drops, tyre runs hotter, μ decreases
- **Too high (>2.2 bar)**: contact patch shrinks, μ drops

For a Hoosier 6" slick, the model suggests 1.6–1.9 bar for maximum grip. Validate against your flat-track or skidpad data.

---

## Event-specific circuit guidance

### Skidpad

- Run the **Karting** or **Club** circuit as a proxy (tight, circular)
- Focus on peak lateral G rather than lap time
- Key levers: front-rear balance, tyre μ, ARB ratio

### Autocross

- Most FSAE autocross courses are equivalent to a 1.0–1.5 km circuit with a mix of hairpins (R ≈ 4–6 m), slaloms, and short straights
- Use the **Club Circuit** preset as your starting point
- Tune for: maximum cornering speed, traction out of hairpins, minimal terminal understeer

### Endurance

- Use the **Race Simulation** tab with 22 laps (typical FSAE endurance distance ~22 km)
- Set tyre compound to a representative hard compound (longer wear curve)
- Track the tyre temperature across laps — if it climbs monotonically, you are overworking the tyres

### Acceleration

- Lap time simulation is not the right tool for this event
- Instead, focus on: peak engine torque × final drive ratio vs traction limit
- The gear model will tell you whether you are traction-limited or power-limited in each gear

---

## Validating against real skidpad data

If you have skidpad results (lateral G at 9.144 m radius), you can validate the model:

1. Set your car's actual parameters
2. Set **Turn Radius** to 9.144 m
3. Set **Speed** to match your entry speed
4. Check the **Lateral Acceleration** output against your measured value

A match within ±0.05 g suggests your μ and mass are correct. If the model is optimistic (higher than measured), reduce μ or check mass. If pessimistic (lower), check that tyre temperatures are not being penalised (set current tyre temp to optimal temperature for a cold-tyre-independent comparison).

---

## Formula Student tyre resources

- **FSAE Tyre Test Consortium (FSAE TTC)**: tyre data from Hoosier, Goodyear, and others at realistic loads. Available to FSAE member teams. If you have TTC data, use the B, C, D, E coefficients from the MF5.2 fit directly.
- **OptimumTire**: software for fitting Pacejka coefficients to TTC data. The output B/C/D/E values are ready to paste into RacePhysiX's Advanced tab.

---

## Typical FS car benchmarks

These numbers are from the simulation at default FS preset on the Club Circuit (1.9 km):

| Metric | Default FS preset |
|---|---|
| Lap time (Club Circuit) | ~54–56 seconds |
| Peak lateral G | ~2.1 g |
| Understeer gradient | +0.4 deg/g |
| Max speed | ~85–95 km/h |
| Tyre temp rise per lap | ~8–12°C |

If your numbers are significantly outside these ranges with realistic parameters, double-check mass, μ, and spring rates first.
