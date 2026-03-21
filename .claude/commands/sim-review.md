---
description: Full simulation review — circuit accuracy, speed/RPM/gear, physics, visual sync, UI/UX, and live screenshots. F1-engineer standard. ALWAYS ask scope before running.
allowed-tools: Bash(npx:*), Bash(npm:*), Bash(node:*), Bash(scrot:*), Bash(import:*), Bash(xdotool:*), Bash(gnome-screenshot:*), Read, Grep, Glob, Agent
---

## ⚠️ SCOPE CHECK — DO THIS FIRST

**Before spawning any agents**, ask the user:

> "Which sim-review checks do you want to run? (Full run = ~400k tokens)
>
> **A** — Circuit Geometry (sweep angles, segment lengths, closure)
> **B** — Lap Time Plausibility (vs F1 reference times)
> **C** — Speed / RPM / Gear Profiles (jitter, discontinuities)
> **D** — Physics Correctness (corner speed, braking, combined slip, fuel, tyre)
> **E** — Visual–Physics Sync + UI/UX (animation, heatmap, gauges)
> **F** — Live Screenshots (take browser screenshots and analyse visually)
>
> Reply with letters (e.g. 'A C F') or 'all'."

Only spawn the selected sub-agents. Do NOT run all unless explicitly told.

---

## Sub-agent definitions (spawn only requested ones)

### Agent A — Circuit geometry audit
**Task**: In `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:

Read `src/physics/laptime.ts` and for every circuit in `TRACK_PRESETS` (all 14):

1. **svgPath check**: Does the circuit have `svgPath`? Mark as: GPS, Schematic, or Procedural (no svgPath = won't close spatially).

2. **Segment sweep audit**: For each corner compute `sweep_deg = (length/radius) × (180/π)`. Flag: >200° ERROR, >180° WARN, radius <8m WARN.

3. **Total length**: Sum all segment lengths. Compare to circuit name distance. Flag if >5% off.

4. **Corner direction sanity**: CW circuits should have net right-turn dominance. List right/left balance for each real circuit.

5. **Jitter-risk corners**: Any R ≤ 15m adjacent to another corner (no straight between)? These cause speed step-changes.

6. **buildTrackPath closure**: For any circuit WITHOUT svgPath, does `buildTrackPath` produce a spatially closed path? Run a node simulation of the segment walk and check if final x,y ≈ 0,0.

Return a detailed table for ALL 14 circuits covering all checks.

---

### Agent B — Lap time plausibility
**Task**: In `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:

1. Run `npx tsx src/physics/test-extended.ts 2>&1 | head -100`
2. Run `npx tsx src/physics/validate.ts 2>&1`

For each real circuit, compute ratio = model_time / F1_pole_ref:
- Expected range for 1500 kg / 200 kW / peakMu=1.1: **1.4–2.0×**
- F1 refs: Monaco 72s, Monza 82s, Spa 104s, Silverstone 88s, Suzuka 90s, Nürburgring 80s, Bahrain 88s, Barcelona 79s, Hungaroring 79s, Montreal 74s
- Flag any ratio outside 1.2–2.5× as ERROR
- Flag any two circuits with >25% spread between ratios (inconsistency = wrong layout)
- Check generic circuits for plausibility (club/karting/gt/formula should have avg speed 80–160 kph)

Return: numbered table with model time, ref, ratio, verdict. Summary paragraph on internal consistency.

---

### Agent C — Speed / RPM / gear jitter analysis
**Task**: In `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:

Read `src/components/TrackVisualiser.tsx` (full) and relevant sections of `src/physics/laptime.ts`.

Find every potential source of visual jitter or discontinuity:

1. **Segment boundary speed**: Does `vPrev` at end of straight use the actual simulated exit speed (`vExit`) or the pre-planned target? A mismatch causes step discontinuities in the heatmap.

2. **`buildSpeedProfile()`**: Are all pathFrac intervals covered? Any large jumps? Do adjacent segments share the boundary speed?

3. **`computeGearRPM()` hysteresis**: Can gear oscillate between g and g+1 near a threshold? Is there a ±N% deadband?

4. **`accelG` dt clamp**: Is `dt = timestamp - prevTimestamp` clamped to a max value (e.g. 50ms)? Without a clamp, backgrounding the tab causes catastrophic G-meter spikes.

5. **Car arrow at path wrap**: When pathFrac ≈ 1.0, do ptA and ptB converge to the same point making `atan2(0,0) → 0` (snap East)?

6. **`timeFracToPathFrac` at tf=1.0**: Can it return >1?

Return: each issue with file:line, description, severity (COSMETIC / AFFECTS FEEL / WRONG PHYSICS), proposed fix.

---

### Agent D — Physics correctness audit
**Task**: In `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:

Read `src/physics/laptime.ts`, `src/physics/tyreTemp.ts`, `src/physics/gearModel.ts`, `src/physics/types.ts`.
Run `npx tsx src/physics/validate.ts 2>&1`.

Audit every physics model:

1. **Corner speed V=√(μ_eff×g×R)**: Show code. Is aero correctly included via μ_eff boost? Is it iterative? Does it include friction-circle combined slip penalty at corner entry?

2. **Braking decel**: Formula? Is aero boost applied? Is brakingCapG a reasonable default?

3. **Straight integration**: dt value? Stability? Drag applied every step?

4. **Combined slip at corner entry/exit**: Is friction circle (a_y = √(μ²−a²_brake)) applied? Only on entry or exit too?

5. **Tyre thermal**: Gaussian bell shape? Peak temp (should be ~85°C), cliff (~110°C), warmup constant (expect ~2.5 laps), degradation rate. Compare to real slick tyre data.

6. **Fuel model**: Does mass decrease per lap affect corner speed AND straight accel? Both should decrease as fuel burns.

7. **Gear model**: Unit chain — wheelAngVel → engineOmega → RPM → torque → wheel force. Check for unit errors.

Return: each model rated CORRECT / APPROXIMATE / WRONG with reasoning.

---

### Agent E — Visual–physics sync + UI/UX audit
**Task**: In `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:

Read `src/components/TrackVisualiser.tsx` (full) and `src/components/LapTimePanel.tsx`.

**Visual sync**:
1. Is the timeFrac→pathFrac→SVG mapping proportionally accurate? For circuits with schematic svgPaths, does the car appear in the right section of the circuit at the right time?
2. Does buildTrackPath close with Z? (Affects custom/track-editor circuits)
3. Heatmap seam at S/F — any colour discontinuity where path wraps?
4. Car arrow direction at pathFrac≈1.0 — does the 0.01 clamp cause it to snap?

**UI/UX**:
5. Track selector: are all 14 circuits present and correctly grouped?
6. Speedometer: does scale adapt per circuit (Monaco ~250 kph vs Monza ~380 kph)?
7. Tyre temp: 4-corner labels but 1 value — is this misleading?
8. G-meter: range, sign convention (braking = negative), max expected G
9. RPM gauge: can it exceed redline? Is redline marked?
10. Layout at 1366×768: any overflow, clipping, or wrapping?

Return: sync analysis with file:line, UI/UX table (Feature | Status | Issue | Severity).

---

### Agent F — Live screenshot analysis
**Task**: Take a screenshot of the ApexSim browser app at `http://localhost:5173` and analyse what is visible on screen.

**Step 1 — Take screenshots**:

```bash
# Find browser window
xdotool search --name "localhost:5173" | head -1

# Activate it
xdotool windowactivate --sync $(xdotool search --name "ApexSim\|localhost:5173\|Vite" | head -1) 2>/dev/null || true

# Wait a moment for window to be ready
sleep 1

# Take full screenshot
import -window root /tmp/apexsim-screen-full.png 2>/dev/null || scrot /tmp/apexsim-screen-full.png 2>/dev/null

# Also take focused window shot
import -window $(xdotool getactivewindow) /tmp/apexsim-screen-window.png 2>/dev/null || true
```

If screenshots fail, try: `DISPLAY=:0 import -window root /tmp/apexsim-screen-full.png`

**Step 2 — Read and analyse screenshots**:

Use the Read tool to view `/tmp/apexsim-screen-full.png` (and window screenshot if available).

Analyse AS AN F1 ENGINEER reviewing a data display:

**Circuit map section**:
- Is the circuit shape recognisable? Does it look like a real racing circuit?
- Is the speed heatmap visible? Are the colours correct (red=slow, cyan=fast)?
- Is the car/arrow visible and moving in the right direction on the circuit?
- Is the S/F line visible?
- Does the circuit close cleanly (no visible gap)?

**Telemetry strip** (bottom):
- Is the speedometer readable? Does the needle position look correct for the displayed speed?
- Is the gear display visible and correct (1–8)?
- Is the RPM gauge showing reasonable values?
- Is the G-meter showing the right direction (decel = down)?
- Are tyre temperatures displayed? Do the colours look reasonable?

**Overall UI**:
- Is the layout clean? Any overflow or clipping?
- Is the circuit name displayed correctly?
- Are there any obvious rendering errors, blank areas, or misaligned elements?
- Does the colour scheme (dark theme) work well with the data visualisations?
- Is there anything that looks wrong, surprising, or broken?

**Step 3 — Test multiple circuits** (if practical):
If the app allows switching circuits in the screenshot, also capture:
- A GPS circuit (Spa or Silverstone) — verifies GPS path rendering
- A generic circuit (club or karting) — verifies schematic path rendering
- Monaco — checks if the Grand Hotel Hairpin is visible as a tight bend

Return: detailed visual description of everything observed, circuit-by-circuit if multiple, list of visual bugs or anomalies with severity.

---

## After all selected agents complete — synthesise

Consolidate into a single report:

```
## ApexSim Sim Review — [date]
## Checks run: [list selected agents]

### A. Circuit Geometry
[findings]

### B. Lap Time Plausibility
[findings]

### C. Speed / RPM / Gear Jitter
[findings]

### D. Physics Correctness
[findings]

### E. Visual–Physics Sync + UI/UX
[findings]

### F. Visual Screenshot Analysis
[findings with description of what was seen on screen]

### Action Plan (priority order)
| # | Issue | Severity | File:Line | Fix |
|---|-------|----------|-----------|-----|
...

### Overall Verdict
[RELEASE-READY / NEEDS FIXES / BLOCKED — one paragraph, F1 engineer sign-off]
```

Be direct. If something looks wrong on screen, say exactly what. If a physics formula is wrong, say which one and why. The standard is high.
