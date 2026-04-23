# User Guide

A panel-by-panel walkthrough of the RacePhysiX interface.

---

## Layout overview

```
┌─────────────────────────────────────────────────────────────────┐
│  Vehicle Preset Selector                          [? Help] [☀]  │
├───────────────────┬──────────────────────┬──────────────────────┤
│  Parameter Panel  │   3D Canvas / Track  │   Results Panel      │
│  (left)           │   Visualiser         │   (right)            │
├───────────────────┴──────────────────────┴──────────────────────┤
│  Charts Panel (tyre curve, handling diagram, Pacejka sliders)   │
└─────────────────────────────────────────────────────────────────┘
│  Lap Time Panel (lap sim, race sim, strategy, telemetry)        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Vehicle Preset Selector

Located at the very top. Provides one-click parameter sets for four vehicle classes:

| Preset | Description |
|---|---|
| Road Car | ~1350 kg, 150 kW, FWD, street tyres, no aero |
| Formula Student | ~250 kg, 75 kW, RWD, slick tyres, mild aero |
| GT3 | ~1300 kg, 370 kW, RWD, slick tyres, full aero package |
| F1 | ~800 kg, 900 kW, RWD + ERS, slick tyres, high downforce |

**Reset** — returns all parameters to the currently selected preset's defaults.

**Export / Import** — save the full parameter set as a JSON file, or load one previously saved. Useful for comparing setups across sessions.

---

## Parameter Panel — tabs

### Vehicle tab

Core vehicle parameters that define the fundamental character of the car.

| Parameter | Effect |
|---|---|
| Total mass (kg) | Heavier = more load transfer, slower acceleration, more braking distance |
| Front weight fraction | > 0.5 = nose-heavy; affects understeer balance |
| Wheelbase (m) | Longer = more stable; shorter = more agile |
| Track width (m) | Wider = less roll, less load transfer |
| CG height (m) | Higher = more load transfer, more roll |
| Engine power (kW) | Sets the maximum speed on straights |
| Drivetrain | FWD / RWD / AWD / AWD+TV — affects traction and yaw moment |
| Final drive ratio | With gear ratios, determines top speed vs acceleration |
| Differential | Open / LSD / Locked — affects traction efficiency and yaw moment under power |

### Suspension tab

Controls how the car responds to lateral and longitudinal load changes.

| Parameter | Effect |
|---|---|
| Front / Rear spring stiffness | Stiffer = less roll, but more abrupt load transfer |
| Front / Rear anti-roll bar | Stiffening front ARB increases understeer; rear ARB increases oversteer |
| Front / Rear motion ratio | How much the spring moves per mm of wheel travel (0–1) |
| Roll damper ratio ζ | Damping ratio for the roll mode; 0.7 is critical damping |
| Front / Rear roll centre height | Higher RC = more geometric load transfer, less elastic |
| Camber gain | How much camber changes with roll (deg/deg) |
| Static camber | Pre-set camber at rest; negative camber improves lateral grip |
| Toe angle | Positive toe-out = more understeer; negative toe-in = more oversteer tendency |

### Aero & Braking tab

| Parameter | Effect |
|---|---|
| Front / Rear lift coefficient (CL) | Downforce per axle — more = faster corners, slower straights |
| Drag coefficient (CD) | More drag = lower top speed; unavoidable trade-off with downforce |
| Aero balance | How much downforce acts on the front vs rear axle |
| Ride height (mm) | Lower = more ground effect; below ~30 mm, CL rises steeply |
| Rake angle (deg) | Rear higher than front → aero balance shifts rearward |
| Brake bias (%) | Higher = more front braking; optimal shifts with downforce and fuel load |
| ABS threshold | Slip ratio at which ABS activates; lower = earlier intervention |

### Tyres & Fuel tab

| Parameter | Effect |
|---|---|
| Peak friction coefficient (μ) | The tyre's maximum grip — 1.0 is typical road, 1.6 is slick racing |
| Tyre compound | Soft / Medium / Hard / Inter / Wet — affects warm-up time, peak grip, wear rate |
| Tyre pressure (bar) | Too low or too high reduces cornering stiffness and peak grip |
| Thermal sensitivity | How much tyre μ changes with temperature |
| Optimal tyre temp (°C) | Temperature at which μ peaks |
| Tyre load sensitivity (qFz) | How much μ drops at high vertical load — real tyres are degressive |
| Fuel load (kg) | Starting fuel; heavier = more mass, degrades lap time |
| Fuel burn rate (kg/lap) | Determines fuel strategy options |

### Advanced tab

Pacejka Magic Formula coefficients (B, C, D, E) for front and rear tyres. These define the shape of the Fy vs α curve. See [Physics Models → Pacejka](physics-overview) for what each coefficient controls.

Only edit these if you're fitting data from a real tyre test.

---

## Results Panel

Updates in real time with every parameter change.

### Bicycle model outputs

| Output | Definition |
|---|---|
| Understeer gradient K | K > 0 = understeer, K < 0 = oversteer, K = 0 = neutral |
| Characteristic speed Vch | Speed at which a neutral steer car achieves peak lateral acceleration |
| Critical speed Vcrit | Speed above which an oversteer car becomes unstable (only shown if K < 0) |
| Front slip angle αf | How much the front tyre is deflected from its heading at a given lateral g |
| Rear slip angle αr | Same for rear |
| Yaw rate r | r = V/R at steady cornering state |

### Pacejka model outputs

- **Peak Fy front / rear** — maximum lateral force from each axle
- **Front / Rear cornering stiffness (Cα)** — initial slope of the Fy vs α curve (N/deg)
- **Slip angle at peak** — where the tyre reaches maximum grip

### Load transfer

- **Front / Rear lateral ΔFz** — how much vertical load shifts between inner and outer wheel on a corner
- **Longitudinal ΔFz** — how much shifts front-to-rear under braking or acceleration

---

## Charts Panel

### Tyre lateral force curve (Fy vs α)

Shows the Magic Formula output for both front and rear tyres. The x-axis is slip angle (degrees), the y-axis is lateral force (N).

- Steeper initial slope = higher cornering stiffness = crisper initial response
- Higher peak = more grip
- Flatter peak = more progressive limit (better for driver confidence)
- Sharp drop after peak = "snap" — sudden loss of grip at limit

### Handling diagram

Front slip angle vs rear slip angle at steady-state for a range of lateral accelerations.

- Lines sloping toward the right = understeer (front saturates faster)
- Lines sloping toward the left = oversteer (rear saturates faster)
- Lines on the 45° diagonal = neutral steer

---

## Lap Time Panel

### Circuit selector

22 circuits available — 4 generic (Club, Karting, GT, Formula test) and 18 real circuits. Real circuits are derived from GPS data and are geometrically accurate. See [Circuit Reference](circuits).

### Lap sim

Click **Run Lap Sim** to compute a point-mass lap time. The output shows:

- Total lap time
- Sector 1 / 2 / 3 splits (at 1/3 and 2/3 of circuit distance)
- Minimum / maximum / average speed
- Estimated top speed on the longest straight

The lap sim accounts for: tyre forces, downforce, drag, powertrain limits, braking, gear changes, tyre temperature, and banking/gradient on supported circuits.

### Race simulation

Configure number of laps, starting tyre temperature, and run a full multi-lap race. Each lap accounts for:

- Tyre warm-up (exponential, ~2.5 laps to reach optimal temp)
- Tyre degradation (compound-dependent wear, cliff model, graining)
- Fuel burn (lap time improves as fuel burns off)
- Brake disc temperature and fade

Output: lap-by-lap time table with sector splits. The fastest lap is marked ★.

### Race strategy optimiser

Brute-forces 1-stop and 2-stop strategies over all compound combinations. Shows which strategy minimises total race time and what the compound sequence should be.

### Setup comparison

Save the current parameter set as a **baseline**. Modify any parameters, run the lap sim again, and the comparison view shows Δ lap time side-by-side with every changed parameter.

### Telemetry overlay

Upload a CSV file (from any data logger, or exported from the Lap Trace button) and overlay it against the simulation. Compares speed, lateral G, and longitudinal G vs distance. Useful for validating the model against real data.

### Export

- **Lap Summary** — CSV of all parameters and per-segment results
- **Lap Trace** — high-resolution telemetry at ~5 m intervals (dist, time, speed, gear, RPM, Gs, zone)
- **Race Telemetry** — all laps concatenated, with per-lap summary header

---

## Track Visualiser

Click **Animate Circuit** (button in the 3D view area) to open the full-screen visualiser.

### Zone colour coding

| Colour | Zone |
|---|---|
| Green | Full throttle |
| Blue | Cornering (lateral G dominant) |
| Orange | Braking |
| Yellow | Combined (braking into a corner) |

### Top-down view (left panel)

Shows the car traversing the circuit from above, with:

- Tyre force vectors (length = force magnitude)
- Suspension struts coloured by vertical load
- Downforce arrows (shown when aero force > 100 N)
- Corner load gauges (per-wheel Fz)

### Chase camera (right panel)

Follows the car from behind at a fixed offset. Useful for watching body roll, pitch, and attitude changes through corners.

### Left overlay panel

- 4-corner tyre temperatures (colour-coded cold → optimal → overheating)
- 4-corner brake disc temperatures
- Sector time display (S1/S2/S3)
- Tyre wear bars
- TC / Turbo / ERS status icons

### Right overlay panel

- G-G diagram (lateral vs longitudinal G, with dashed friction circle)
- Full Lap mode (all G values for the current lap) or Live mode (current G only)
- Numerical readout of current Lat-G and Long-G

### Bottom telemetry strip

Throttle % and Brake % bars. Brake fade indicator activates when brake temperature causes a measurable loss of braking capacity.

### Playback controls

- 1× / 4× / 8× speed
- Fullscreen toggle
- Panel open/close buttons

---

## URL sharing

Every parameter set is encoded in the URL hash. Copy and paste the URL to share an exact setup with anyone. Preset-based URLs are very short (`#p=gt3`); custom setups add a compact diff from the nearest preset.

---

## Theme

The sun/moon toggle (top right of the 3D view) switches between dark and light themes. All panels update instantly.
