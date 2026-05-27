# Getting Started

RacePhysiX is a physics-accurate vehicle dynamics simulator that runs in your browser.
No install. No account. Just open and simulate.

---

## What it does

RacePhysiX lets you configure a real vehicle — mass, suspension, tyres, aerodynamics, drivetrain — and simulate how it behaves on a circuit. Every parameter change recomputes the full physics model in real time. You can see understeer gradient, cornering limits, lap times, tyre temperatures, race strategy, and more.

It is not a game. There is no driving. It is a tool for understanding *why* a car behaves the way it does, and *what happens to lap time* when you change its setup.

---

## Quick start — 60 seconds to your first result

1. Click **GT3** in the preset selector at the top
2. In the left panel, click the **Lap Time** tab, then select **Spa-Francorchamps** from the circuit dropdown
3. Click **Run Lap Sim**
4. Read the result in the right panel — lap time, sector splits, corner speeds

Now change something: reduce **Aero Balance** (Aero & Braking tab) from 0.45 to 0.35. The understeer gradient in the Results panel will drop. Run the lap sim again — Spa lap time improves by ~0.3–0.8 seconds because the front-heavy aero balance was creating unnecessary drag without enough front grip to compensate.

That is the core loop: **change → observe physics → observe lap time → understand why**.

---

## Who it's for

| Audience | Primary use |
|---|---|
| Automotive engineering students | Visualise lecture concepts (understeer gradient, Pacejka, load transfer, bicycle model) interactively — no textbook derivation required to see the result |
| Formula Student / FSAE teams | Setup direction — spring rates, ARB sizing, aero coefficient targets, weight distribution tradeoffs |
| Club and semi-pro motorsport | Quick sanity checks on setup changes without expensive simulation software |
| Sim racers (ACC, iRacing, rFactor 2) | Understand why setup sliders work the way they do, translate to faster learning in the sim |
| Vehicle dynamics researchers | Open-source model to study, extend, or validate against your own data |
| Curious F1 / motorsport fans | Explore why Monza hates downforce, why tyre compounds matter, and how ERS changes the power curve |

---

## Choosing your path

### I am an engineering student

Start with the **Bicycle Model** output in the Results panel. This is the linear approximation of steady-state cornering — Gillespie Chapter 6, Milliken & Milliken Chapter 5. Change front/rear cornering stiffness and watch K (understeer gradient) shift. Then open the Tyre Curve chart (bottom left) and see how the Pacejka Magic Formula produces the nonlinear Fy vs α curve. Cross-reference with [Physics — Foundations](physics-foundations).

Key concepts to explore in order:
1. Understeer gradient K and characteristic speed
2. Pacejka coefficients and the shape of the lateral force curve
3. Load transfer and why degressive tyre response matters
4. The friction circle and combined slip

### I am on a Formula Student team

Load the **Formula Student** preset and enter your car's actual mass, power, tyre μ, and spring rates. Then use the lap sim on the **Club Circuit** to establish a baseline. Run the Setup Optimiser to find the minimum lap time spring/ARB combination. Use the race sim to plan your endurance strategy.

See the [Formula Student Guide](formula-student) for a complete walkthrough.

### I am a sim racer

Load the **GT3** preset (for ACC) or adjust mass/power to match your sim car. Use the lap sim on the circuit you are struggling with. When you have a handling problem — push on entry, snap on exit, graining — run the physics model to understand the root cause. See the [Sim Racing Guide](sim-racing) for translation between RacePhysiX parameters and ACC/iRacing setup sliders.

### I am a motorsport fan or enthusiast

Start with the **F1** preset and Spa or Monza. Run a lap sim. Then reduce **Aero CL** to near-zero (Monza-spec) and watch the lap time change. Add it back (Hungary-spec) and see the corner speed increase. Switch to **Road Car** and see how a family hatchback compares on the same circuit. The physics works the same — only the parameters change.

---

## Your first simulation — step by step

### Step 1 — Pick a vehicle preset

At the top of the page, click one of the preset buttons:

- **Road Car** — a front-engined, front-wheel-drive family hatchback (~1350 kg, 150 kW, street tyres, no aero)
- **Formula Student** — a lightweight open-wheel racecar (~250 kg, 75 kW, slick tyres, mild aero)
- **GT3** — a high-downforce endurance racing car (~1300 kg, 370 kW, slick tyres, full aero package)
- **F1** — a current-generation Formula 1 car (~800 kg, 900 kW, slick tyres, high downforce + ERS)

> **Tip:** Start with **GT3** — it shows the most interesting balance between downforce, tyre grip, and braking. The numbers are also closest to publicly available real-world data, so you can sanity check the results.

### Step 2 — Run a lap sim

1. In the left panel, click the **Lap Time** tab
2. Select a circuit from the dropdown — try **Spa-Francorchamps** first
3. Click **Run Lap Sim**

Results appear in the right panel:
- **Lap time**: total predicted lap time in m:ss.sss format
- **Sector splits**: S1 / S2 / S3 at 1/3 and 2/3 of circuit distance
- **Segment table**: entry speed, apex speed, exit speed, and time for every corner and straight
- **Min / Max / Average speed**: useful for diagnosing whether the car is traction- or aero-limited

### Step 3 — Change something and observe

Try these changes with the GT3 preset at Spa and note the lap time delta each time:

| Change | Expected effect | Why |
|---|---|---|
| Increase aero CL from 2.6 to 3.4 | −0.5 to −1.2 s | More downforce → higher corner speeds in Eau Rouge, Pouhon, Blanchimont |
| Reduce tyre μ from 1.55 to 1.35 | +1.5 to +2.5 s | Less grip → lower corner speeds everywhere |
| Add 100 kg of mass | +0.8 to +1.5 s | More mass → more load transfer, more braking distance, worse traction |
| Switch compound to Hard | +0.3 to +0.6 s | Hard compound has lower peak grip in warm-up phase |
| Move brake bias rearward (50% to 45%) | +0.1 to +0.3 s | Rear braking is traction-limited; rear brakes lock earlier |

### Step 4 — Animate the circuit

Click **Animate Circuit** (button at the top of the 3D view) to open the full circuit visualiser. You will see:

- **Top-down view**: the car traversing Spa with zone colouring (green = full throttle, orange = braking, blue = cornering)
- **Chase camera**: following the car from behind — watch body pitch and attitude through Eau Rouge
- **Left overlay**: 4-corner tyre temperatures, brake temps, sector times, tyre wear
- **Right overlay**: G-G diagram tracing the lap through the friction circle
- **Bottom strip**: throttle %, brake %, gear

The animation speed can be set to 1×, 4×, or 8× using the controls. Use 4× for a normal race pace view.

---

## Reading the results

### Results Panel (right side)

Updates in real time with every parameter change:

| Output | What it means |
|---|---|
| Understeer gradient K | K > 0 = understeer tendency, K < 0 = oversteer tendency. Target: 0 to +1.5 deg/g for racing |
| Characteristic speed Vch | Speed at which a neutral car achieves peak lateral acceleration |
| Critical speed Vcrit | (Oversteer only) speed above which the car becomes directionally unstable |
| Peak Fy front / rear | Maximum lateral force from each axle — which is the limiting axle? |
| Front / Rear Cα | Cornering stiffness — initial responsiveness to steering input |
| Load transfer ΔFz | How much vertical load shifts per axle under lateral or longitudinal acceleration |

### Charts Panel (bottom)

- **Tyre curve (Fy vs α)**: Shape of the lateral force curve for each axle. Steeper initial slope = more responsive. Higher peak = more grip. Sharper drop = more sensitive at the limit.
- **Handling diagram**: Front vs rear slip angle at steady-state cornering. Lines sloping right = understeer; left = oversteer; 45° = neutral.
- **Pacejka sliders**: Live-edit B, C, D, E coefficients and see the tyre curve update in real time.

---

## What to explore next

- [User Guide](user-guide) — every panel, tab, control, and output explained in detail
- [Setup Guide](setup-guide) — practical setup workflow and parameter hierarchy
- [Formula Student Guide](formula-student) — dedicated guide for FS teams
- [Sim Racing Guide](sim-racing) — translating RacePhysiX into ACC, iRacing, and rFactor 2 setups
- [Physics — Foundations](physics-foundations) — bicycle model, Pacejka, load transfer, aero, lap time
- [Physics — Advanced](physics-advanced) — 14-DOF dynamics, race models, thermal models, CFD aero map
- [Circuit Reference](circuits) — all 22 circuits, GPS accuracy, banking data, and attribution
- [FAQ](faq) — common questions, known limitations, and technical details
