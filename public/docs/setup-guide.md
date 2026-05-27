# Setup Guide

A practical guide to using RacePhysiX for vehicle setup work — how to read the outputs, what to change, and in what order.

---

## The setup workflow

The most effective way to use RacePhysiX is iteratively:

1. **Establish a baseline** — pick a preset, run a lap, note the time and understeer gradient
2. **Identify the problem** — is the car too slow? Too understeery? Overheating tyres?
3. **Change one thing** — adjust a single parameter and re-run
4. **Read the delta** — compare against baseline using the Setup Comparison tool
5. **Repeat** — work through the parameter hierarchy from top to bottom

The Setup Comparison tool (Lap Time panel → Comparison tab) makes this easy. Save your baseline with **Save Baseline**, make changes, and run the lap sim again. You'll see every changed parameter and the resulting Δ lap time side-by-side.

---

## Parameter hierarchy — what matters most

Not all parameters have equal impact. This is the rough order of influence on lap time:

| Priority | Parameter group | Typical lap time impact |
|---|---|---|
| 1 | Peak tyre friction (μ) | ±2–5 seconds |
| 2 | Downforce level (CL total) | ±1–3 seconds on aero circuits |
| 3 | Vehicle mass | ±0.5–2 seconds |
| 4 | Engine power | ±0.5–2 seconds on power circuits |
| 5 | Brake bias + braking G | ±0.3–1 second |
| 6 | Tyre compound | ±0.2–0.8 seconds |
| 7 | Aero balance (front/rear CL split) | ±0.1–0.5 seconds |
| 8 | Spring rates | ±0.05–0.3 seconds |
| 9 | ARB rates | ±0.05–0.2 seconds |
| 10 | Camber, toe, pressure | ±0.02–0.1 seconds |

**Start at the top.** If your μ is set to 0.9 and you're simulating a slick-tyred car (should be ≈1.5), no amount of spring tuning will fix the lap time.

---

## Reading the understeer gradient

The understeer gradient K (Results panel, top right) is the single most useful output for setup direction.

```
K > 0   →  understeer  — front limited, add front grip or remove rear grip
K = 0   →  neutral steer — balanced
K < 0   →  oversteer   — rear limited, add rear grip or remove front grip
```

**Target range by application:**

| Application | Target K |
|---|---|
| Road car (stability priority) | +1.5 to +3.0 deg/g |
| GT racing (balance priority) | +0.5 to +1.5 deg/g |
| Formula Student (agility priority) | 0 to +1.0 deg/g |
| Formula 1 | −0.5 to +0.5 deg/g |

Slightly positive K (mild understeer) is desirable in almost every application — it is self-correcting and stable. K much above +3 means the car fights the driver on corner entry.

---

## Fixing understeer

If K is too high (car pushes on), work through these in order:

### 1. Front downforce
Increase **Aero Balance** (shifts CL rearward from front axle → less front downforce → front grip decreases → understeer increases — wait, that's wrong direction).

Actually: increase **front CL** or reduce **rear CL** to add front downforce and reduce understeer.

### 2. Front spring stiffness
Reduce **Front Spring Rate**. Softer front = more roll = more front outside tyre load = better contact patch = more grip. Diminishing returns beyond ~30% roll.

### 3. Rear ARB
Increase **Rear ARB Rate**. Stiffer rear ARB = more rear lateral load transfer = rear tyres overloaded sooner = rear pushes harder into corners = balance shifts forward = reduces understeer.

### 4. Front tyre pressure
Reduce **Front Tyre Pressure** slightly (toward 1.8–1.9 bar). Lower pressure = higher contact patch area = more cornering stiffness at low loads.

### 5. Front camber
Increase negative **Front Camber** (e.g. −2° to −3°). More camber = better lateral grip on the outside tyre in a corner.

### 6. Rear toe-in
Add a small amount of **Rear Toe-In** (positive toe). Toe-in on the rear adds stability and effectively increases rear cornering stiffness.

---

## Fixing oversteer

If K is negative (car snaps), the rear is the weak axle:

### 1. Rear downforce
Increase **Rear CL**. More rear downforce = more rear grip = more stable = less oversteer.

### 2. Front ARB
Increase **Front ARB Rate**. Stiffer front ARB = more front lateral load transfer = front tyres overloaded sooner = balance shifts rear = adds understeer.

### 3. Rear spring stiffness
Reduce **Rear Spring Rate**. Softer rear = more rear roll = outside rear tyre carries more load more progressively.

### 4. Rear camber
Ensure **Rear Camber** is not too negative. Excessive negative rear camber hurts straight-line traction and can unsettle the rear under braking.

### 5. Brake bias
Move **Brake Bias** forward (higher %). Rear-biased braking loads the rear tyres and causes oversteer under braking. Moving bias forward takes rear braking load off.

---

## Aero setup by circuit type

### High-speed circuits (Monza, Spa straights, Le Mans)

- Minimise total drag → reduce CL
- But: must maintain enough downforce to avoid instability at high speed
- Monza GT3: CL ≈ 1.8–2.2 total, CD ≈ 0.45–0.55
- Balance: neutral to slight understeer at 200+ km/h

### Slow, technical circuits (Hungary, Monaco, Brands Hatch)

- Maximise downforce → increase CL
- Drag is less important — top speeds are low
- Hungary GT3: CL ≈ 3.0–3.5 total
- Balance: neutral — precision matters more than straight-line speed

### Mixed circuits (Spa sector 1+3, Silverstone)

- Compromise: CL ≈ 2.4–2.8 for GT3
- Slightly rear-biased aero balance (55–58% rear) for stability through fast corners

---

## Tyre strategy setup

### For a sprint race (10–20 laps)

1. Set **Tyre Compound** to Soft
2. Set **Fuel Load** to race fuel mass
3. Run Race Simulation — check when tyres degrade past optimal temp range
4. If tyres overheat before halfway, switch to Medium and re-run
5. Use the **Strategy Optimiser** to check if a pit stop for fresher soft tyres beats a one-stint medium run

### For endurance (Le Mans, 24h formats)

1. Use **Hard** or **Medium** compound
2. Set **Driver Aggression** lower (60–70%) — this reduces tyre heat and wear rate
3. Check brake disc temperature across a stint — if brakes fade past lap 15, increase **Brake Disc Mass** (more thermal capacity)
4. Run the 2-stop strategy optimiser — it will find the minimum total time compound sequence

---

## Brake bias tuning

The optimal brake bias depends on:
- **Downforce level**: more rear downforce → more rear brake capacity → bias moves rearward
- **Fuel load**: heavier car = more longitudinal load transfer under braking = front tyres work harder → bias moves forward
- **Tyre temperatures**: if rears are cold, biasing rearward helps warm them

**Quick rule of thumb:**
- Road car: 65–70% front bias
- GT3 (low fuel): 58–62% front bias
- GT3 (full fuel): 60–64% front bias
- F1: 52–58% front bias (very high rear downforce carries rear braking capacity)

---

## Setup optimiser

The automatic Setup Optimiser (Lap Time panel → Optimiser tab) uses Nelder-Mead simplex search to minimise lap time across 7 parameters simultaneously:

- Front and rear spring rates
- Front and rear ARB rates
- Front and rear aero CL
- Brake bias

**How to use it:**
1. Start from a reasonable baseline (a preset is fine)
2. Select the circuit you want to optimise for
3. Click **Run Optimiser** — takes 5–15 seconds
4. The optimiser returns the parameter set with the minimum lap time
5. Check that the understeer gradient is in a sensible range — the optimiser maximises lap time, not driver confidence

**Known limitations:**
- Optimises for a single circuit — the result will be worse on other circuits
- Does not account for tyre degradation across a stint — a harder compound may be faster in the optimised lap time but slower over 20 laps
- Assumes the idealised driver who always uses full grip

---

## Common mistakes

### Mistake 1: Tuning springs before checking μ
If the tyre peak friction is wrong, spring changes are noise. Always check μ and compound first.

### Mistake 2: Chasing lap time without reading the understeer gradient
A 0.2 second lap time gain that moves K from +1.0 to +4.0 is not a good setup — the car will be undriveable on the limit.

### Mistake 3: Ignoring fuel load
The default fuel load in each preset is a qualifying load (minimal fuel). For race simulations, increase fuel to a realistic race start value. Every 10 kg of fuel costs approximately 0.1–0.2 seconds per lap.

### Mistake 4: Setting tyre compound to Inter on a dry track
The Intermediate compound has a wet grip factor of ~0.6 on a dry track. Lap times will be 3–5 seconds slower than a slick. Always check the compound setting when results look wrong.

### Mistake 5: Over-softening springs for grip
Spring rate affects transient response, not just steady-state grip. Very soft springs increase roll, which can overload the outer tyre and actually hurt peak lateral G on fast corners. There is an optimal spring stiffness for each corner type.
