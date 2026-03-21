---
description: Circuit map animation review — validates zone overlay accuracy, corner speeds, braking zones, and animation physics against real-world vehicle behaviour. Code-analysis only (no screenshots). Produces a prioritised action plan.
allowed-tools: Bash(npx:*), Bash(npm:*), Bash(node:*), Read, Grep, Glob, Agent
---

## Circuit Map Animation Review

No screenshots. Validate entirely from code + computed values vs real-world references.

Spawn all four sub-agents **in parallel**, then synthesise.

---

### Agent A — GPS zone overlay algorithm audit

**Task**: Read `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim/src/components/TrackVisualiser.tsx` (full) and audit `buildGpsZoneOverlay`.

Check each step of the algorithm:

**1. Curvature computation (Menger formula)**
- Is `κ = 2|AB × BC| / (|AB| · |BC| · |AC|)` correct?
- Are the vectors AB and BC computed correctly (pts[i]-pts[i-1], pts[i+1]-pts[i])?
- What is AC in the code — is it pts[i+1]-pts[i-1] (correct) or something else?
- At N=400 for a 5793m (Monza) circuit, each step = 14.5m. For a 55m-radius corner, the chord spanning 29m gives a sagitta of ≈ 1.9m. Is this enough signal for the cross-product to register clearly vs GPS coordinate noise?

**2. Scale factor**
- `svgToMeter = totalDist / pathLen` — is `totalDist` computed from `layout.segments` or from `result`? Segments is correct (physics reference). Result is runtime. Which is used?
- For GPS paths projected to a 400×250 viewBox: if the real circuit is 7km × 2km (Spa) but viewBox is 400×250, the x-scale ≠ y-scale. A horizontal segment and a vertical segment of equal real length have different SVG lengths. This means `κ_real = κ_svg / svgToMeter` is WRONG when the projection is non-isometric. Verify whether TUMFTM SVG paths preserve aspect ratio.

**3. V_max formula**
- `V_max = sqrt(peakMu × g × R_real)` — this ignores aero. At 150 km/h, a CL=0.3, A=2.0 car gets F_downforce = 0.5×1.225×0.3×2.0×41.7² = 637N on a 1500kg car → Δμ_eff ≈ 0.043. For slower corners this is negligible, for fast corners (Eau Rouge R≈170m at 220 km/h) it matters. Quantify the error.

**4. Forward/backward integration**
- `dsReal = totalDist / N` — is this the real step size in meters? Or SVG units?
- In the forward pass: `V[i+1] = min(sqrt(V[i]² + 2·a_drive·dsReal), vMax[i+1])`. Is `a_drive = (driveForce(v) - dragForce(v)) / mass` correct? Can it be negative (drag > drive at high speed)?
- In the backward pass: `V[i-1] = min(sqrt(V[i]² + 2·aBrake·dsReal), vMax[i-1])`.
  - NOTE: The backward pass uses `+` sign: `V[i-1] = sqrt(V[i]² + 2·aBrake·ds)`. This is CORRECT. The backward pass answers: "what is the max entry speed from which you can brake to V[i] over distance ds?" Derivation: `V[i]² = V[i-1]² − 2·a·ds` → `V[i-1]² = V[i]² + 2·a·ds`. Do NOT flag this as a bug.
- 4 iterations — is this enough to propagate brake constraints around the full circuit?

**5. Zone classification**
- `isLimited = vMax[i] < vTop - 2` — if vTop = maxVehicleSpeedMs, what is the typical value for default params (1500kg, 150kW)? Run: `npx tsx -e "import {buildLapSimInput} from './src/physics/vehicleInput'; import {DEFAULT_PACEJKA_COEFFS} from './src/physics/pacejkaModel'; const params = {mass:1500,wheelbase:2.7,frontWeightFraction:0.55,corneringStiffnessNPerDeg:500,rearCorneringStiffnessNPerDeg:500,cgHeight:0.55,trackWidth:1.5,tyreSectionWidth:0.205,turnRadius:200,speedKph:80,vehicleClass:'road',drivetrainType:'RWD',throttlePercent:0,enginePowerKW:150,awdFrontBias:0.40,frontSpringRate:25000,rearSpringRate:28000,frontARBRate:8000,rearARBRate:6000,brakingG:0,brakeBias:0.65,aeroCL:0.30,aeroCD:0.30,aeroReferenceArea:2.0,aeroBalance:0.45,tyreLoadSensitivity:0.10,tyreOptTempC:85,tyreTempHalfWidthC:30,tyreTempCurrentC:85,tyreTempFloorMu:0.60,gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500,fuelLoadKg:45,fuelBurnRateKgPerLap:2.5}; const inp = buildLapSimInput(params, DEFAULT_PACEJKA_COEFFS); console.log('maxVehicleSpeedMs:', inp.maxVehicleSpeedMs, 'peakMu:', inp.peakMu, 'brakingCapG:', inp.brakingCapG);" 2>&1`
- `atLimit = V[i] >= vMax[i] - 0.5` — is 0.5 m/s (1.8 km/h) a tight enough tolerance? If the forward pass slightly undershoots vMax due to Euler discretisation, valid cornering sections could be misclassified as full-throttle.
- `decelG > 0.3 → braking vs trail-braking` — 0.3g threshold: for the default car braking at 0.85g max, the first 35% of speed reduction would be trail-braking. Is this realistic? Real cars: trail-braking ends when driver reaches full cornering load, typically well into the corner.

**6. Smoothing adequacy**
- 7-point Gaussian smooth: at N=400, the smoothing window spans 3 samples = 43.5m on Monza. Is this wide enough to smooth GPS noise? Is it too wide (blurs tight chicane apices)?
- For Monza's Rettifilo chicane (R≈55m, arc≈18m), the peak curvature spans <2 samples at N=400. After 7-point smoothing, will the peak be detectably above the straight baseline?

Return: each check with PASS / WARN / FAIL verdict and specific line numbers from the code.

---

### Agent B — Corner speed calibration vs real-world

**Task**: Validate that corner speeds from the GPS curvature approach match known real-world references for a 1500 kg road car.

**Step 1**: Run the following computation to get LapSimInput defaults:
```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx -e "
const {buildLapSimInput} = await import('./src/physics/vehicleInput.js');
const {DEFAULT_PACEJKA_COEFFS} = await import('./src/physics/pacejkaModel.js');
const params = {mass:1500,wheelbase:2.7,frontWeightFraction:0.55,corneringStiffnessNPerDeg:500,rearCorneringStiffnessNPerDeg:500,cgHeight:0.55,trackWidth:1.5,tyreSectionWidth:0.205,turnRadius:200,speedKph:80,vehicleClass:'road',drivetrainType:'RWD',throttlePercent:0,enginePowerKW:150,awdFrontBias:0.40,frontSpringRate:25000,rearSpringRate:28000,frontARBRate:8000,rearARBRate:6000,brakingG:0,brakeBias:0.65,aeroCL:0.30,aeroCD:0.30,aeroReferenceArea:2.0,aeroBalance:0.45,tyreLoadSensitivity:0.10,tyreOptTempC:85,tyreTempHalfWidthC:30,tyreTempCurrentC:85,tyreTempFloorMu:0.60,gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500,fuelLoadKg:45,fuelBurnRateKgPerLap:2.5};
const inp = buildLapSimInput(params, DEFAULT_PACEJKA_COEFFS);
const G=9.81;
// Key corners (real-world radius from segment definitions)
const corners = [
  {name:'Monza Rettifilo T1',    R:55,  realKph:[65,85]},
  {name:'Monza Roggia T1',       R:60,  realKph:[70,90]},
  {name:'Monza Lesmo 1',         R:48,  realKph:[60,80]},
  {name:'Monza Lesmo 2',         R:40,  realKph:[55,75]},
  {name:'Monza Parabolica',      R:48,  realKph:[80,100]},
  {name:'Monaco Sainte Devote',  R:15,  realKph:[40,60]},
  {name:'Monaco Grand Hotel',    R:10,  realKph:[30,50]},
  {name:'Spa La Source',         R:20,  realKph:[50,70]},
  {name:'Spa Eau Rouge entry',   R:60,  realKph:[100,150]},
  {name:'Spa Bus Stop',          R:16,  realKph:[45,65]},
];
corners.forEach(c => {
  const vMs = Math.sqrt(inp.peakMu * G * c.R);
  const vKph = vMs * 3.6;
  const ok = vKph >= c.realKph[0] && vKph <= c.realKph[1];
  console.log(ok?'PASS':'FAIL', c.name.padEnd(25), vKph.toFixed(1)+'kph', 'expected:', c.realKph.join('-')+'kph');
});
console.log('peakMu:', inp.peakMu, 'brakingCapG:', inp.brakingCapG);
" 2>&1
```

**Step 2**: For each FAIL, diagnose root cause:
- Is peakMu unrealistic? (road car should be 0.9-1.1, race car 1.4-1.8)
- Is the segment radius wrong vs the real circuit?
- Is the formula missing aero or load sensitivity?

**Step 3**: Compute braking distances for key corners on Monza and compare to real-world:
```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx -e "
const {buildLapSimInput} = await import('./src/physics/vehicleInput.js');
const {DEFAULT_PACEJKA_COEFFS} = await import('./src/physics/pacejkaModel.js');
const params = {mass:1500,wheelbase:2.7,frontWeightFraction:0.55,corneringStiffnessNPerDeg:500,rearCorneringStiffnessNPerDeg:500,cgHeight:0.55,trackWidth:1.5,tyreSectionWidth:0.205,turnRadius:200,speedKph:80,vehicleClass:'road',drivetrainType:'RWD',throttlePercent:0,enginePowerKW:150,awdFrontBias:0.40,frontSpringRate:25000,rearSpringRate:28000,frontARBRate:8000,rearARBRate:6000,brakingG:0,brakeBias:0.65,aeroCL:0.30,aeroCD:0.30,aeroReferenceArea:2.0,aeroBalance:0.45,tyreLoadSensitivity:0.10,tyreOptTempC:85,tyreTempHalfWidthC:30,tyreTempCurrentC:85,tyreTempFloorMu:0.60,gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500,fuelLoadKg:45,fuelBurnRateKgPerLap:2.5};
const inp = buildLapSimInput(params, DEFAULT_PACEJKA_COEFFS);
const G=9.81;
const aBrake = inp.brakingCapG * G;
// Braking: from top-speed-before-corner down to apex speed
const events = [
  {name:'Monza T1 (S/F→Rettifilo)', vEntry:220, vExit:75,  realBrakeM:[80,130]},
  {name:'Monza Parabolica',         vEntry:170, vExit:85,  realBrakeM:[60,100]},
  {name:'Spa La Source',            vEntry:230, vExit:60,  realBrakeM:[90,140]},
  {name:'Spa Bus Stop',             vEntry:270, vExit:55,  realBrakeM:[110,160]},
];
events.forEach(e => {
  const vi = e.vEntry/3.6, vo = e.vExit/3.6;
  const d = (vi*vi - vo*vo)/(2*aBrake);
  const ok = d >= e.realBrakeM[0] && d <= e.realBrakeM[1];
  console.log(ok?'PASS':'FAIL', e.name.padEnd(30), d.toFixed(0)+'m braking', 'expected:', e.realBrakeM.join('-')+'m', 'aBrake:', aBrake.toFixed(2)+'m/s²');
});
" 2>&1
```

**Step 4**: Check top speed on Monza main straight (1050m from ~75 km/h entry):
```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx -e "
const {buildLapSimInput} = await import('./src/physics/vehicleInput.js');
const {DEFAULT_PACEJKA_COEFFS} = await import('./src/physics/pacejkaModel.js');
const params = {mass:1500,wheelbase:2.7,frontWeightFraction:0.55,corneringStiffnessNPerDeg:500,rearCorneringStiffnessNPerDeg:500,cgHeight:0.55,trackWidth:1.5,tyreSectionWidth:0.205,turnRadius:200,speedKph:80,vehicleClass:'road',drivetrainType:'RWD',throttlePercent:0,enginePowerKW:150,awdFrontBias:0.40,frontSpringRate:25000,rearSpringRate:28000,frontARBRate:8000,rearARBRate:6000,brakingG:0,brakeBias:0.65,aeroCL:0.30,aeroCD:0.30,aeroReferenceArea:2.0,aeroBalance:0.45,tyreLoadSensitivity:0.10,tyreOptTempC:85,tyreTempHalfWidthC:30,tyreTempCurrentC:85,tyreTempFloorMu:0.60,gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500,fuelLoadKg:45,fuelBurnRateKgPerLap:2.5};
const inp = buildLapSimInput(params, DEFAULT_PACEJKA_COEFFS);
const G=9.81, DT=0.005;
let V = 75/3.6, x=0;
while(x < 1050) {
  const F = inp.driveForce(V) - inp.dragForce(V);
  V += (F/inp.mass)*DT; x += V*DT;
}
console.log('Monza S/F straight top speed (1050m from 75kph):', (V*3.6).toFixed(1), 'kph');
console.log('Expected for 1500kg 150kW: 200-240 kph');
console.log('maxVehicleSpeedMs:', inp.maxVehicleSpeedMs, '->', (inp.maxVehicleSpeedMs*3.6).toFixed(1), 'kph');
" 2>&1
```

**Step 5**: Read `src/physics/laptime.ts` — check the Monza, Spa, Silverstone, Suzuka, Bahrain, Barcelona, Hungaroring, Montreal, Nürburgring segment definitions. For each GPS circuit, verify:
- Corner order matches real circuit direction (clockwise/anticlockwise)
- Key corner radii are physically plausible (La Source R~20m, Eau Rouge R~160m, Raidillon R~180m)
- Total length matches circuit name (within 2%)

Return: PASS/FAIL table for all corner speed, braking distance, and top speed checks. List all segment-level concerns with severity.

---

### Agent C — Animation physics and timing audit

**Task**: Read `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim/src/components/TrackVisualiser.tsx` (full).

**1. Animation speed (real-time vs accelerated)**
- Find where `timeSec_cur` is computed from the RAF `timestamp`.
- Is there a playback speed multiplier? If not, a 2:18 Monza lap takes 138 real seconds to watch. A race engineer uses time-compressed replays at 4–10x. What speed does the current animation play at?
- Compute: for a Club circuit lap of ~65s, does the animation take 65s real-time? This should be noted as a UX issue if not accelerated.

**2. Car position accuracy on GPS circuits**
- For GPS circuits, the animation maps `physics_distM / totalDist → svgPathFrac`. Is this the same distance-fraction mapping we just proved is inaccurate for GPS circuits (because SVG path length ≠ physics distance)?
- Does the animation use the new `buildGpsZoneOverlay` result for position, or still the old trace-based `traceAtDist` approach?
- Concretely: after our latest changes, the ZONE OVERLAY correctly uses GPS curvature. But does the CAR ARROW position also use curvature-based physics, or is it still using segment-based trace? If they use different physics, the car will appear in wrong zone sections.

**3. Telemetry accuracy**
- Speed display: uses `tp.speedKph` from `traceAtTime`. Is this interpolated smoothly or does it jump at segment boundaries?
- Gear/RPM: `computeGearRPM(speedKph, params, prevGear)` — does gear change smoothly or snap? At what speed does gear 1→2 transition occur for default params?

Run:
```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx -e "
// Compute gear transition speeds for default params
const params = {gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500};
const n = params.gearCount;
const step = Math.pow(params.topGearRatio/params.firstGearRatio, 1/(n-1));
for(let g=1; g<=n; g++){
  const ratio = params.firstGearRatio * Math.pow(step, g-1);
  // shift at 95% redline
  const shiftRpm = params.engineRedlineRpm * 0.92;
  const wheelRpm = shiftRpm / (ratio * params.finalDriveRatio);
  const vMs = wheelRpm / 60 * 2 * Math.PI * params.wheelRadiusM;
  console.log('Gear', g, 'shifts at', (vMs*3.6).toFixed(1), 'kph', 'ratio:', ratio.toFixed(3));
}
" 2>&1
```

- **Telemetry vs zone consistency**: When `telemetry.zone = 'braking'`, is `longG` negative (deceleration)? When `zone = 'full-throttle'`, is `longG` positive? Read the zone assignment in the RAF tick.

**4. Lap loop continuity**
- When `timeSec_cur` wraps around (lap end → lap start), does the car position jump? Is there any smoothing or does it teleport?
- Is `startRef.current` reset correctly on layout change?

**5. LongG bar display**
- `longG` in the trace: during braking on a straight, `longG = -a_brake/G = -0.85`. Does the GBar show this correctly (bar fills left, negative territory)?
- During full-throttle at high speed (longG ≈ +0.1g), does the bar show a small positive deflection?

**6. Zone label vs actual behaviour**
- When the car is in Parabolica (long cornering zone), does `telemetry.zone` show 'CORNERING'? Or could it briefly flash 'BRAKING' / 'FULL THROTTLE' due to the trace interpolation?

Return: each check with PASS/WARN/FAIL, file:line, and specific fix recommendation. Flag the car-position vs zone-overlay mismatch as highest priority if confirmed.

---

### Agent D — Real-world behaviour validation

**Task**: Validate whether the complete animation pipeline produces physically plausible behaviour for a 1500 kg road car, from a motorsport engineering perspective.

Read:
- `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim/src/physics/laptime.ts` — full `buildLapTrace` and `buildGpsZoneOverlay` (in TrackVisualiser)
- `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim/src/components/TrackVisualiser.tsx` — zone overlay + animation

Run `npx tsx src/physics/test-extended.ts 2>&1 | tail -5` and `npx tsx src/physics/validate.ts 2>&1 | grep -E "PASS|FAIL"`.

**1. Zone proportions (reality check)**
For the Club circuit (~1.9 km, default params), compute the expected fraction of lap distance in each zone:
```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx -e "
const {buildLapTrace} = await import('./src/physics/laptime.js');
const {buildLapSimInput} = await import('./src/physics/vehicleInput.js');
const {DEFAULT_PACEJKA_COEFFS} = await import('./src/physics/pacejkaModel.js');
const {TRACK_PRESETS} = await import('./src/physics/laptime.js');
const params = {mass:1500,wheelbase:2.7,frontWeightFraction:0.55,corneringStiffnessNPerDeg:500,rearCorneringStiffnessNPerDeg:500,cgHeight:0.55,trackWidth:1.5,tyreSectionWidth:0.205,turnRadius:200,speedKph:80,vehicleClass:'road',drivetrainType:'RWD',throttlePercent:0,enginePowerKW:150,awdFrontBias:0.40,frontSpringRate:25000,rearSpringRate:28000,frontARBRate:8000,rearARBRate:6000,brakingG:0,brakeBias:0.65,aeroCL:0.30,aeroCD:0.30,aeroReferenceArea:2.0,aeroBalance:0.45,tyreLoadSensitivity:0.10,tyreOptTempC:85,tyreTempHalfWidthC:30,tyreTempCurrentC:85,tyreTempFloorMu:0.60,gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500,fuelLoadKg:45,fuelBurnRateKgPerLap:2.5};
const inp = buildLapSimInput(params, DEFAULT_PACEJKA_COEFFS);
const layout = TRACK_PRESETS['club'];
const trace = buildLapTrace(layout, inp);
const counts = {};
trace.forEach(p => counts[p.zone] = (counts[p.zone]||0)+1);
const total = trace.length;
Object.entries(counts).forEach(([z,c]) => console.log(z.padEnd(15), ((c/total*100).toFixed(1)+'%').padStart(7)));
console.log('Total trace points:', total);
console.log('Lap total dist:', trace[trace.length-1].distM.toFixed(0), 'm');
console.log('Lap total time:', trace[trace.length-1].timeSec.toFixed(1), 's');
" 2>&1
```

For a road car on Club circuit, expected zone distribution:
- Braking: 8–15% (proportional to number of braking events × braking distance)
- Trail-braking: 3–8%
- Cornering: 20–35% (depends on number and length of corners)
- Full-throttle: 50–70%
Flag if any zone is 0% (never occurs) or >80% (dominates unrealistically).

**2. Speed profile shape**
Run the same for Monza:
```bash
cd /var/home/srikarbuddhiraju/Srikar/Repo/ApexSim && npx tsx -e "
const {buildLapTrace, TRACK_PRESETS} = await import('./src/physics/laptime.js');
const {buildLapSimInput} = await import('./src/physics/vehicleInput.js');
const {DEFAULT_PACEJKA_COEFFS} = await import('./src/physics/pacejkaModel.js');
const params = {mass:1500,wheelbase:2.7,frontWeightFraction:0.55,corneringStiffnessNPerDeg:500,rearCorneringStiffnessNPerDeg:500,cgHeight:0.55,trackWidth:1.5,tyreSectionWidth:0.205,turnRadius:200,speedKph:80,vehicleClass:'road',drivetrainType:'RWD',throttlePercent:0,enginePowerKW:150,awdFrontBias:0.40,frontSpringRate:25000,rearSpringRate:28000,frontARBRate:8000,rearARBRate:6000,brakingG:0,brakeBias:0.65,aeroCL:0.30,aeroCD:0.30,aeroReferenceArea:2.0,aeroBalance:0.45,tyreLoadSensitivity:0.10,tyreOptTempC:85,tyreTempHalfWidthC:30,tyreTempCurrentC:85,tyreTempFloorMu:0.60,gearCount:6,firstGearRatio:3.0,topGearRatio:0.72,finalDriveRatio:3.9,wheelRadiusM:0.32,enginePeakRpm:5500,engineRedlineRpm:6500,fuelLoadKg:45,fuelBurnRateKgPerLap:2.5};
const inp = buildLapSimInput(params, DEFAULT_PACEJKA_COEFFS);
const trace = buildLapTrace(TRACK_PRESETS['monza'], inp);
const vKph = trace.map(p=>p.speedKph);
console.log('Monza min speed:', Math.min(...vKph).toFixed(1), 'kph (expected: 70-90)');
console.log('Monza max speed:', Math.max(...vKph).toFixed(1), 'kph (expected: 200-240)');
console.log('Monza avg speed:', (vKph.reduce((a,b)=>a+b)/vKph.length).toFixed(1), 'kph (expected: 130-170)');
console.log('Lap time:', trace[trace.length-1].timeSec.toFixed(1), 's (expected: 120-160s for road car)');
const zones = {}; trace.forEach(p=>zones[p.zone]=(zones[p.zone]||0)+1);
const tot=trace.length; Object.entries(zones).forEach(([z,c])=>console.log(z.padEnd(15),((c/tot*100).toFixed(1)+'%').padStart(7)));
" 2>&1
```

**3. Specific physics checks (real-world plausibility)**

a) **Cornering speed realism**: For a 1500 kg road car with peakMu=1.2 (slightly optimistic for performance road tyres), corner speeds should be:
   - Tight hairpin R=10m: V = √(1.2×9.81×10) = 10.9 m/s = 39 km/h — realistic (Monaco-style hairpin)
   - Medium corner R=50m: V = 24.3 m/s = 87 km/h — realistic
   - Fast corner R=150m: V = 42.1 m/s = 152 km/h — realistic for a road car
   Verify peakMu from the computation above.

b) **Braking realism**: A road car with good brakes decelerates at 0.8–1.0g. brakingCapG should be in this range.

c) **Top speed realism**: A 150kW / 1500kg car's theoretical top speed = when drive force = drag force. At Vmax: P/Vmax = 0.5×ρ×CD×A×Vmax² → Vmax = (2P/(ρ×CD×A))^(1/3). With CD=0.30, A=2.0, P=150000W: Vmax = (300000/0.3675)^(1/3) = (816326)^(1/3) = 93.4 m/s = 336 km/h. Is this what maxVehicleSpeedMs gives? This seems high — check if aero drag is computed correctly.

d) **Zone transitions on schematic circuit**: In `buildLapTrace`, after a corner exit at V_corner, the next straight should show 'full-throttle' immediately (the car is at full throttle from the exit). Verify that `lastZone = 'full-throttle'` is set on the first step after the corner, not 'trail-braking'.

e) **Parabolica braking zone**: With the new R=48m and 200m approach straight:
   - V_ascari_exit = √(1.2×9.81×55) = 25.4 m/s. After 200m at full throttle, V_entry_parabolica ≈ ?
   - V_parabolica = √(1.2×9.81×48) = 23.8 m/s
   - Does the physics trace actually show a braking event on this 200m straight?
   Run and check the trace around the Parabolica (last corner before pit straight).

Return: zone distribution verdict (realistic/unrealistic), specific failing plausibility checks, root cause analysis, and concrete code fixes needed.

---

## After all agents complete — synthesise

Produce the full report:

```
## Circuit Map Animation Review — [date]

### Algorithm Correctness (Agent A)
[findings: what is correct, what is wrong]

### Corner Speed Calibration (Agent B)
[PASS/FAIL table with real-world comparison]

### Animation Physics (Agent C)
[timing, car position, telemetry accuracy]

### Real-World Plausibility (Agent D)
[zone distributions, speed profiles, specific physics]

### Action Plan (priority order)
| # | Issue | Impact | File:Line | Fix | Effort |
|---|-------|--------|-----------|-----|--------|
...
(P1 = blocks realism, P2 = significant improvement, P3 = polish)

### Overall Verdict
[One paragraph: what works, what breaks realism, what a real race engineer would object to first]
```

Severity definitions:
- **P1 — Blocks realism**: Zones in completely wrong place, speeds 2x off, animation broken
- **P2 — Significant**: Zones approximately right but 20%+ positional error, braking zones too long/short
- **P3 — Polish**: Minor inaccuracies a race engineer would notice but wouldn't reject the tool for
