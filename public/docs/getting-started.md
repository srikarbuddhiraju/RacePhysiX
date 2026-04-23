# Getting Started

RacePhysiX is a physics-accurate vehicle dynamics simulator that runs in your browser.
No install. No account. Just open and simulate.

---

## What it does

RacePhysiX lets you configure a real vehicle — mass, suspension, tyres, aerodynamics, drivetrain — and simulate how it behaves on a circuit. Every parameter change recomputes the physics in real time. You can see understeer gradient, cornering limits, lap times, tyre temperatures, race strategy, and more.

It is not a game. There is no driving. It is a tool for understanding *why* a car behaves the way it does, and *what happens* when you change its setup.

---

## Who it's for

| Audience | Why it's useful |
|---|---|
| Automotive engineering students | Visualise lecture concepts — understeer, Pacejka curves, load transfer — interactively |
| Formula Student teams | A setup tool you can actually afford |
| Club and semi-pro motorsport engineers | Quick sanity checks without expensive software |
| Sim racing enthusiasts | Understand why setup changes matter |
| Vehicle dynamics researchers | Open source model to study and extend |

---

## Your first simulation — 3 steps

### Step 1 — Pick a vehicle preset

At the top of the page, click the **Vehicle Preset** dropdown and pick one:

- **Road Car** — a front-engined, front-wheel-drive family hatchback
- **Formula Student** — a lightweight, open-wheel racecar built by university teams
- **GT3** — a high-downforce endurance racing car
- **F1** — a current-generation Formula 1 car

Each preset fills in all parameters (mass, power, tyre coefficients, aero, suspension) with realistic values for that class of vehicle.

> Start with **GT3** or **Formula Student** — they show the biggest differences between setup changes.

### Step 2 — Choose a circuit and run a lap

1. Open the **Lap Time** tab in the left panel.
2. Pick a circuit from the dropdown — try **Spa-Francorchamps** or **Silverstone**.
3. Click **Run Lap Sim**. The lap time, sector splits, and per-corner speeds appear instantly.

### Step 3 — Change something and see what happens

Try one of these:

- **Reduce front spring stiffness** (Suspension tab → Front Spring) — watch understeer increase, lap time go up slightly.
- **Add rear downforce** (Aero & Braking tab → Rear CL) — lap time drops on fast circuits, increases on slow ones.
- **Switch drivetrain** (Vehicle tab → Drivetrain) from FWD to RWD — the handling balance shifts.
- **Change tyre compound** (Tyres & Fuel tab → Compound) from Medium to Soft — faster, but degrades sooner in a race.

---

## Reading the results

The **Results Panel** (right side) updates instantly with every parameter change:

| Metric | What it means |
|---|---|
| Understeer gradient K | Positive = understeer, negative = oversteer, zero = neutral steer |
| Characteristic speed | Speed at which a neutral car would reach maximum lateral acceleration |
| Front / Rear Cα | Cornering stiffness — how quickly the tyre builds lateral force per degree of slip |
| Peak Fy | Maximum lateral force each axle can generate |
| Yaw rate | How fast the car rotates — r = V/R |

The **Charts** section below shows the tyre lateral force curve (Fy vs slip angle α) and the handling diagram (front vs rear slip at steady state). A crossed pair of curves = neutral steer. Front crossing higher = understeer.

---

## Animate the circuit

Click **Animate Circuit** (top of the 3D view) to open the track visualiser. You'll see:

- A top-down view with the car moving around the circuit, colour-coded by zone (green = full throttle, orange = braking, blue = cornering)
- A chase camera following the car
- Live tyre temperatures, brake disc temperatures, G-G diagram, and throttle/brake traces
- Sector times updating each lap

---

## What to try next

- [User Guide](user-guide) — detailed walkthrough of every panel and control
- [Physics — Foundations](physics-foundations) — bicycle model, Pacejka, load transfer, aero, lap time estimator
- [Physics — Advanced](physics-advanced) — 14-DOF dynamics, race models, thermal models, CFD aero map
- [Circuit Reference](circuits) — all 22 circuits, GPS accuracy, and data attribution
- [FAQ](faq) — common questions and known limitations
