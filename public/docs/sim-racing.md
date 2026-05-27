# Sim Racing Guide

How to use RacePhysiX to build a deeper understanding of car setup — and carry that knowledge into ACC, iRacing, rFactor 2, and other simulators.

---

## What RacePhysiX adds to sim racing

Sim games give you the setup screen and the lap time. RacePhysiX gives you the *why* — the physics behind why each slider matters, what it does to the tyre contact patch, and how it interacts with every other parameter.

After using RacePhysiX:
- You will understand why stiffening the front ARB increases understeer, not just that it does
- You will know when adding rear wing is worth the drag penalty and when it is not
- You will be able to diagnose handling problems from symptoms (push, snap, graining) rather than guessing

---

## Matching your sim car to a RacePhysiX preset

### ACC (Assetto Corsa Competizione)

Use the **GT3** preset as your starting point. ACC GT3 cars have:

| Parameter | ACC typical | RacePhysiX preset |
|---|---|---|
| Mass with driver | 1295–1310 kg | 1300 kg |
| Engine power | 360–420 kW | 370 kW |
| Peak μ (slick, optimal temp) | ~1.55–1.65 | 1.55 |
| Front CL | ~1.2–1.5 | 1.2 |
| Rear CL | ~1.4–1.8 | 1.4 |

> **Tip:** Don't match exact numbers — match the character. Then use RacePhysiX to understand what each ACC setup slider does.

### iRacing

- **GT3 / GTE / IMSA**: use the GT3 preset
- **Open-wheel (F3/F4/IR-18)**: reduce mass to ~580–680 kg, increase μ to ~1.7, reduce power, increase aero
- **Oval / NASCAR**: lower μ to ~1.2, add significant banking (the banking model is in Circuit Reference)

### Gran Turismo / Forza

- Match the car's mass, power, and drivetrain type to the closest preset
- Set μ based on tyre compound: street tyres ~0.9–1.0, sport ~1.1–1.2, racing slick ~1.5–1.6
- These games often have unrealistic aero — start with CL = 0 for road cars

---

## Translating setup terms

Many sim games use different labels for the same physical quantities. Here is the mapping:

| RacePhysiX term | ACC | iRacing | What it actually is |
|---|---|---|---|
| Front Spring Rate | Front Springs | Spring Rate (F) | Wheel rate in N/mm |
| Front ARB Rate | Front ARB | Anti-Roll Bar (F) | ARB stiffness in N/mm at wheel |
| Aero Balance | Front Splitter / Rear Wing | Wicker Bill / Front Splitter | % of downforce on front axle |
| Brake Bias | Brake Bias | Brake Bias | % of total braking force on front axle |
| Tyre Pressure | Tyre Pressure | Tyre Pressure | Target hot pressure in bar or PSI |
| Camber | Camber | Camber | Degrees negative = top of tyre leans in |
| Toe | Toe-In | Toe | Degrees; toe-in = fronts point inward |

---

## Understanding the physics behind your setup

### Why does understeer happen?

At steady-state, the front tyres need to generate more lateral force than the rear to turn the car. When they saturate (reach peak Fy) before the rear, the front slips outward — understeer.

**In the simulator:** Watch the **Tyre Curve** chart (bottom left). If the front tyre curve peaks at a lower slip angle than the rear, you have a setup that will push on corner entry. The **Handling Diagram** (bottom right) shows this directly — lines sloping right = understeer at steady-state.

**The ACC connection:** When your car "pushes" on corner entry in ACC, it is because the front tyre slip angle has exceeded its peak. The fix is to move grip to the front: softer front spring, stiffer rear ARB, more front downforce, or less negative front camber.

### Why does tyre temperature matter so much?

The Pacejka D coefficient — peak friction — is modelled as a Gaussian bell curve over temperature. On a cold tyre, D is reduced by up to 30%. On an overheating tyre, D drops progressively as the compound degrades.

**In the simulator:** Run a **Race Simulation** and watch the tyre temperature column. If it climbs beyond the optimal temperature (shown in the Results panel) by lap 3, your tyres are overheating. Options:
- Switch to a harder compound (higher optimal temp, slower warmup)
- Reduce driver aggression
- Soften springs (reduces dynamic loads, reduces heat input)

**The ACC connection:** In ACC, cold tyres in qualifying laps 1–2 is exactly this. The tyre needs 2–3 laps of heat input before μ reaches its peak. RacePhysiX's warmup model (exponential, ~2.5 lap time constant) matches this qualitatively.

### Why does aero balance matter on fast circuits?

High-speed corners generate very large downforce values. If the front-rear aero balance is wrong, one axle will be significantly over- or under-loaded relative to its mechanical grip.

**In the simulator:** On Spa or Silverstone, adjust the **Aero Balance** slider from 40% front to 60% front and watch the understeer gradient change. You will see K change by 1–3 deg/g just from aero balance — more influence than spring rates on a fast circuit.

**The ACC connection:** The front splitter and rear wing in ACC control exactly this. Adding rear wing increases total downforce and shifts balance rearward (more rear grip, less understeer). But it also adds drag — the trade-off shows in the lap time model.

---

## Setup recipes for common problems

### Problem: Car understeers on corner entry (turn-in push)

The front tyre is saturating before the rear. Solutions in order of effectiveness:

1. Soften front springs → more roll → front outside tyre loads up more progressively
2. Stiffen rear ARB → more rear load transfer → rear tyres saturate sooner (careful — too much causes snap oversteer)
3. Increase front downforce → more front load → more front grip
4. Reduce front brake bias → less front lock-up risk into corners

**Test in RacePhysiX:** Soften front spring from 80 to 60 N/mm on Spa, check K delta. You should see K drop 0.3–0.8 deg/g.

### Problem: Car oversteers on corner exit (power oversteer)

The rear tyres are losing grip under combined lateral + longitudinal load. Solutions:

1. Reduce throttle (driver input) — modelled via Driver Aggression slider
2. Soften rear springs → more progressive rear load transfer
3. Reduce rear ARB → less lateral load transfer → more even rear tyre loading
4. If RWD: reduce rear tyre slip via Traction Control threshold

**The physics:** RWD cars under power have the rear tyres fighting combined slip. Fx (drive force) uses part of the friction circle that would otherwise be available for Fy (cornering force). The combined slip model in RacePhysiX shows this — reduce power on corner exit and watch rear tyre utilisation drop.

### Problem: Graining on soft compound tyres

The tyre surface is being overworked — micro-sliding generates heat faster than it can dissipate, shearing the compound.

**In RacePhysiX:** Switch compound to Medium and re-run the race sim. If lap times over 10+ laps are better with Medium than Soft, the Soft is graining and you should switch compound in your sim too.

**Signs in the race sim:** Tyre temperature climbs beyond the optimal range by lap 5–6 and keeps rising. Once past the cliff temperature, the drop-off in μ is steep.

### Problem: Can't judge how much brake bias affects lap time

Use Setup Comparison:
1. Save baseline with current brake bias
2. Move bias forward 2%
3. Run lap sim and compare

Typical finding: ±1% brake bias changes lap time by 0.05–0.15 seconds. The direction depends on circuit — rear-biased circuits (lots of heavy braking into slow corners) may benefit from moving bias slightly rearward.

---

## Race strategy

### 1-stop vs 2-stop

The **Strategy Optimiser** (Lap Time panel → Strategy tab) brute-forces compound combinations:
- Soft → Hard (1-stop)
- Medium → Medium (1-stop)
- Soft → Medium → Hard (2-stop)
- etc.

The output shows which strategy minimises total race time, factoring in:
- Tyre wear across each stint
- Grip level per compound per lap
- Time lost in pit stop (fixed 25-second penalty in the model)

**Applying to ACC:** The optimiser won't match ACC's exact tyre model (it uses a representative generic model), but the directional recommendation is reliable. If the model says 1-stop medium beats 2-stop soft by 15 seconds, the relative advantage is meaningful even if the exact times differ.

### Fuel load sensitivity

Each 10 kg of fuel costs approximately 0.15–0.25 seconds per lap (circuit-dependent). Qualify with minimum fuel. Start the race heavy. The fuel burn model shows lap times improving progressively as fuel burns off — a useful sanity check that your real-world race data should approximately follow.

---

## Circuits in ACC, iRacing, and rFactor 2

RacePhysiX has GPS-accurate versions of these circuits (all available in the circuit selector):

| Real-world circuit | In ACC | In iRacing | In rFactor 2 |
|---|---|---|---|
| Spa-Francorchamps | ✓ | ✓ | ✓ |
| Monza | ✓ | ✓ | ✓ |
| Silverstone | ✓ | ✓ | ✓ |
| Barcelona/Catalunya | ✓ | ✓ | — |
| Hungaroring | ✓ | ✓ | — |
| Zandvoort | ✓ | ✓ | — |
| Imola | ✓ | ✓ | — |
| Red Bull Ring | ✓ | ✓ | — |
| Nürburgring GP | ✓ | ✓ | ✓ |
| Brands Hatch | ✓ | — | ✓ |
| Mugello | ✓ | — | — |
| Bahrain | ✓ | ✓ | — |

Use the matching circuit in RacePhysiX when diagnosing why your sim setup isn't working on a specific track.

---

## Telemetry overlay

If you export telemetry from ACC (MoTeC i2, SimHub) or iRacing as CSV, you can upload it to RacePhysiX and overlay it against the simulation.

**What to look for:**
- **Speed trace mismatch on straights**: check engine power, drag coefficient, or gear ratios
- **Minimum corner speed too low in sim**: check μ, tyre temperature, or brake efficiency
- **Lateral G peaks higher in real data**: check if the sim is underestimating downforce — increase CL

The telemetry import is in the Lap Time panel → Telemetry tab. Expected CSV format: `distance_m, speed_kph, lateral_g, longitudinal_g` (exported from the Lap Trace function works natively).
