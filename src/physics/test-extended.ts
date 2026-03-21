/**
 * Extended physics test suite — automotive engineer perspective.
 *
 * Covers gaps in validate.ts:
 *   - Load transfer: static equilibrium, dynamic sums, directional signs
 *   - Suspension: roll stiffness ratio influence, edge cases
 *   - Pacejka: curve shape, peak magnitude, symmetry, saturation
 *   - Aerodynamics: V² scaling, axle split sum
 *   - Braking: ABS enforcement, force sum, zero/extreme bias
 *   - Lap time: circuit distance verification, plausible lap times, segment sanity
 *   - Circuit geometry: no corner arc > 2π, arc = R×θ check
 *
 * Run: npx tsx src/physics/test-extended.ts
 */

import { computeBicycleModel }                  from './bicycleModel';
import { computeLoadTransfer }                   from './loadTransfer';
import { computeSuspension, computeRollAngle }   from './suspension';
import { computeAero }                           from './aero';
import { computeBraking }                        from './braking';
import { pacejkaFy, findPeakAlpha }              from './pacejka';
import { computeLapTime, TRACK_PRESETS }         from './laptime';
import { engineTorque, generateGearRatios, computeMaxDriveForce } from './gearModel';
import { optimiseSetup, OPTIMISE_BOUNDS, OPTIMISABLE_KEYS } from './optimise';
import { computeTyreTempFactor, computeTyreEffectiveMu, computeTyreGripCurve } from './tyreTemp';
import type { VehicleParams, PacejkaCoeffs }     from './types';

// ── Test harness ──────────────────────────────────────────────────────────────

const G          = 9.81;
const RAD_TO_DEG = 180 / Math.PI;
let   allPassed  = true;
let   passCount  = 0;
let   failCount  = 0;

function check(
  label:    string,
  actual:   number,
  expected: number,
  tol       = 1e-6,
): boolean {
  const ok  = Math.abs(actual - expected) <= tol;
  const tag = ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  [${tag}] ${label}`);
  if (!ok) {
    console.log(`         expected : ${expected}`);
    console.log(`         actual   : ${actual}`);
    console.log(`         diff     : ${Math.abs(actual - expected)}`);
    allPassed = false;
    failCount++;
  } else {
    passCount++;
  }
  return ok;
}

function checkBool(label: string, actual: boolean, expected: boolean): boolean {
  return check(label, actual ? 1 : 0, expected ? 1 : 0);
}

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

// ── Reference vehicle ─────────────────────────────────────────────────────────
// 1500 kg road car, 55/45 F/R weight split, RWD
const BASE: VehicleParams = {
  mass: 1500,
  wheelbase: 2.7,
  frontWeightFraction: 0.55,
  corneringStiffnessNPerDeg: 500,
  rearCorneringStiffnessNPerDeg: 500,  // Stage 13A — equal to front = symmetric (no effect on prior checks)
  cgHeight: 0.55,
  trackWidth: 1.5,
  tyreSectionWidth: 0.205,
  turnRadius: 200,
  speedKph: 80,
  vehicleClass: 'road',
  drivetrainType: 'RWD',
  throttlePercent: 0,
  enginePowerKW: 150,
  awdFrontBias: 0.40,
  frontSpringRate: 25000, rearSpringRate: 28000,
  frontARBRate: 8000,     rearARBRate: 6000,
  brakingG: 0,            brakeBias: 0.65,
  aeroCL: 0.30,           aeroCD: 0.30,
  aeroReferenceArea: 2.0, aeroBalance: 0.45,
  tyreLoadSensitivity: 0,   // Stage 9 — off for existing test checks
  // Stage 11 — Tyre thermal model (at optimal → f=1.0, no effect on existing checks)
  tyreOptTempC: 85, tyreTempHalfWidthC: 30,
  tyreTempCurrentC: 85,   // = tyreOptTempC → no thermal penalty
  tyreTempFloorMu: 0.60,
  // Stage 10 — Gear model
  gearCount: 6, firstGearRatio: 3.0, topGearRatio: 0.72,
  finalDriveRatio: 3.9, wheelRadiusM: 0.32,
  enginePeakRpm: 5500, engineRedlineRpm: 6500,
  fuelLoadKg: 45, fuelBurnRateKgPerLap: 2.5,
};

const COEFFS: PacejkaCoeffs = { B: 11.5, C: 1.28, peakMu: 1.20, E: -1.5 };

// ── Reference lap sim input builder ──────────────────────────────────────────
function makeLapInput(mass: number, peakMu: number, powerKW: number) {
  const aeroCL = 0.30, aeroCD = 0.30, A = 2.0;
  const RHO = 1.225;
  // Build a simplified driveForce using a P/V curve (no gear model) for legacy section F tests
  const driveForce = (V: number) => Math.min((powerKW * 1000) / Math.max(V, 1), mass * G * 1.0);
  return {
    mass,
    peakMu,
    brakingCapG:   1.1,
    aeroCL,
    aeroCD,
    aeroReferenceArea: A,
    dragForce:  (V: number) => 0.5 * RHO * V * V * A * aeroCD,
    driveForce,
  };
}

// =============================================================================
// SECTION A — LOAD TRANSFER
// =============================================================================

section('A — Load Transfer');

// A1: Static equilibrium — sum of all four corners = m×g (no aero, no dynamics)
{
  const lt = computeLoadTransfer(
    { mass: BASE.mass, wheelbase: BASE.wheelbase, cgHeight: BASE.cgHeight,
      trackWidth: BASE.trackWidth, frontWeightFraction: BASE.frontWeightFraction },
    0, 0,  // ay=0, ax=0
  );
  const totalFz = lt.FzFL + lt.FzFR + lt.FzRL + lt.FzRR;
  check('A1 Static: ΣFz = m×g', totalFz, BASE.mass * G, 1e-4);
  // Front axle = m×g×b/L, rear axle = m×g×a/L
  const b = BASE.frontWeightFraction * BASE.wheelbase;
  const a = BASE.wheelbase - b;
  check('A1 Static: front axle = m×g×(b/L)', lt.FzFrontAxle, BASE.mass * G * (b / BASE.wheelbase), 1e-4);
  check('A1 Static: rear  axle = m×g×(a/L)', lt.FzRearAxle,  BASE.mass * G * (a / BASE.wheelbase), 1e-4);
  // Each wheel = half axle (symmetric at ay=0)
  check('A1 Static: FL = FR (symmetric)',    lt.FzFL, lt.FzFR, 1e-4);
  check('A1 Static: RL = RR (symmetric)',    lt.FzRL, lt.FzRR, 1e-4);
}

// A2: Lateral load transfer — correct direction (left turn, ay>0 → right side gains)
{
  const ay = 0.5 * G;  // 0.5g lateral
  const lt = computeLoadTransfer(
    { mass: BASE.mass, wheelbase: BASE.wheelbase, cgHeight: BASE.cgHeight,
      trackWidth: BASE.trackWidth, frontWeightFraction: BASE.frontWeightFraction },
    ay, 0,
  );
  // ΣFz must still equal m×g
  check('A2 Lateral: ΣFz = m×g (ay=0.5g)', lt.FzFL + lt.FzFR + lt.FzRL + lt.FzRR, BASE.mass * G, 1e-3);
  // Outside (right) > inside (left)
  checkBool('A2 Lateral: FzFR > FzFL (right gains)', lt.FzFR > lt.FzFL, true);
  checkBool('A2 Lateral: FzRR > FzRL (right gains)', lt.FzRR > lt.FzRL, true);
  // Load transfer magnitude: ΔFz = m×ay×hCG×φ/TW
  const phi_f_expected = BASE.frontWeightFraction;  // no rollStiffRatio → fallback to b/L
  const latTransF_exp  = BASE.mass * ay * BASE.cgHeight * phi_f_expected / BASE.trackWidth;
  check('A2 Lateral: latTransferFront matches formula', lt.latTransferFront, latTransF_exp, 1e-4);
}

// A3: Longitudinal transfer — braking adds to front, removes from rear
{
  const ax_braking = -0.8 * G;  // ax < 0 = braking
  const lt = computeLoadTransfer(
    { mass: BASE.mass, wheelbase: BASE.wheelbase, cgHeight: BASE.cgHeight,
      trackWidth: BASE.trackWidth, frontWeightFraction: BASE.frontWeightFraction },
    0, ax_braking,
  );
  check('A3 Long: ΣFz = m×g under braking', lt.FzFL + lt.FzFR + lt.FzRL + lt.FzRR, BASE.mass * G, 1e-3);
  checkBool('A3 Long: front axle gains under braking', lt.FzFrontAxle > BASE.mass * G * BASE.frontWeightFraction, true);
  checkBool('A3 Long: rear  axle loses under braking', lt.FzRearAxle  < BASE.mass * G * (1 - BASE.frontWeightFraction), true);
  // Magnitude: ΔFz = m×|ax|×hCG/L
  const longTransfer_exp = BASE.mass * Math.abs(ax_braking) * BASE.cgHeight / BASE.wheelbase;
  check('A3 Long: |longTransfer| magnitude', Math.abs(lt.longTransfer), longTransfer_exp, 1e-3);
}

// A4: Aero downforce adds to both axles (static + aero)
{
  const FzBoostFront = 500, FzBoostRear = 700;
  const lt = computeLoadTransfer(
    { mass: BASE.mass, wheelbase: BASE.wheelbase, cgHeight: BASE.cgHeight,
      trackWidth: BASE.trackWidth, frontWeightFraction: BASE.frontWeightFraction,
      FzBoostFront, FzBoostRear },
    0, 0,
  );
  const expectedTotal = BASE.mass * G + FzBoostFront + FzBoostRear;
  check('A4 Aero: ΣFz = m×g + aero total', lt.FzFL + lt.FzFR + lt.FzRL + lt.FzRR, expectedTotal, 1e-3);
}

// =============================================================================
// SECTION B — SUSPENSION
// =============================================================================

section('B — Suspension Roll Stiffness');

// B1: Equal front and rear stiffness → φ_front = 0.5
{
  const susp = computeSuspension({
    mass: BASE.mass, cgHeight: BASE.cgHeight, trackWidth: BASE.trackWidth,
    frontSpringRate: 20000, rearSpringRate: 20000,
    frontARBRate: 5000,     rearARBRate: 5000,
  });
  check('B1 Equal stiffness: φ_front = 0.5 exactly', susp.rollStiffRatio, 0.5, 1e-9);
  check('B1 KΦ_front = KΦ_rear', susp.KPhiFront, susp.KPhiRear, 1e-6);
}

// B2: Stiffer front ARB → φ_front > 0.5 (more understeer tendency)
{
  const suspSoftFront = computeSuspension({
    mass: BASE.mass, cgHeight: BASE.cgHeight, trackWidth: BASE.trackWidth,
    frontSpringRate: 20000, rearSpringRate: 20000,
    frontARBRate: 2000,     rearARBRate: 8000,
  });
  const suspStiffFront = computeSuspension({
    mass: BASE.mass, cgHeight: BASE.cgHeight, trackWidth: BASE.trackWidth,
    frontSpringRate: 20000, rearSpringRate: 20000,
    frontARBRate: 12000,    rearARBRate: 2000,
  });
  checkBool('B2 Stiff front ARB → φ_front > 0.5', suspStiffFront.rollStiffRatio > 0.5, true);
  checkBool('B2 Soft  front ARB → φ_front < 0.5', suspSoftFront.rollStiffRatio  < 0.5, true);
  checkBool('B2 Stiff front > Soft front φ',       suspStiffFront.rollStiffRatio > suspSoftFront.rollStiffRatio, true);
}

// B3: Roll angle proportional to ay and hCG
{
  const susp   = computeSuspension({
    mass: BASE.mass, cgHeight: BASE.cgHeight, trackWidth: BASE.trackWidth,
    frontSpringRate: BASE.frontSpringRate, rearSpringRate: BASE.rearSpringRate,
    frontARBRate: BASE.frontARBRate,       rearARBRate: BASE.rearARBRate,
  });
  const ay1 = 0.3 * G, ay2 = 0.6 * G;
  const roll1 = computeRollAngle(susp, BASE.mass, BASE.cgHeight, ay1);
  const roll2 = computeRollAngle(susp, BASE.mass, BASE.cgHeight, ay2);
  // Double ay → double roll angle (linear model)
  check('B3 Roll proportional to ay: roll(2ay) = 2×roll(ay)', roll2, 2 * roll1, 1e-8);
  checkBool('B3 Roll angle positive for positive ay', roll1 > 0, true);
}

// B4: Zero total stiffness → rollAngle = 0 (guard against div/0)
{
  const suspZero = computeSuspension({
    mass: BASE.mass, cgHeight: BASE.cgHeight, trackWidth: BASE.trackWidth,
    frontSpringRate: 0, rearSpringRate: 0,
    frontARBRate: 0,    rearARBRate: 0,
  });
  const rollZero = computeRollAngle(suspZero, BASE.mass, BASE.cgHeight, 0.5 * G);
  check('B4 Zero stiffness: roll angle = 0 (no crash)', rollZero, 0, 1e-9);
}

// =============================================================================
// SECTION C — PACEJKA TYRE CURVES
// =============================================================================

section('C — Pacejka Magic Formula');

const Fz_ref = BASE.mass * G / 4;  // ~3679 N per corner (static)

// C1: Fy = 0 at α = 0 (symmetric at origin)
{
  const Fy_zero = pacejkaFy(0, Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  check('C1 Fy(α=0) = 0', Fy_zero, 0, 1e-10);
}

// C2: Fy antisymmetric — Fy(−α) = −Fy(+α)
{
  const alpha = 5 * (Math.PI / 180);  // 5 deg
  const FyPos = pacejkaFy( alpha, Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  const FyNeg = pacejkaFy(-alpha, Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  check('C2 Antisymmetry: Fy(−α) = −Fy(+α)', FyNeg, -FyPos, 1e-9);
}

// C3: Peak force ≈ peakMu × Fz (should be within 5%)
{
  const peakAlpha = findPeakAlpha(Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  const FyPeak    = pacejkaFy(peakAlpha, Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  const FyExpected = COEFFS.peakMu * Fz_ref;
  const relErr    = Math.abs(FyPeak - FyExpected) / FyExpected;
  console.log(`  C3 Peak Fy = ${FyPeak.toFixed(1)} N, peakMu×Fz = ${FyExpected.toFixed(1)} N, err=${(relErr*100).toFixed(2)}%`);
  check('C3 Peak Fy ≈ peakMu×Fz (within 2%)', relErr, 0, 0.02);
}

// C4: Peak slip angle in expected range for road tyres (5–15°)
{
  const peakAlpha = findPeakAlpha(Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  const peakDeg   = peakAlpha * RAD_TO_DEG;
  console.log(`  C4 Peak slip angle = ${peakDeg.toFixed(2)}°`);
  checkBool('C4 Peak slip angle ≥ 5°',  peakDeg >= 5,  true);
  checkBool('C4 Peak slip angle ≤ 15°', peakDeg <= 15, true);
}

// C5: Fy increases monotonically from 0 to peak (no spurious dips)
{
  const peakAlpha = findPeakAlpha(Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  let   monotone  = true;
  let   prevFy    = 0;
  for (let alpha = 0.002; alpha <= peakAlpha; alpha += 0.002) {
    const Fy = pacejkaFy(alpha, Fz_ref, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
    if (Fy < prevFy - 1) { monotone = false; break; }  // 1N tolerance for numerical noise
    prevFy = Fy;
  }
  checkBool('C5 Fy monotonically increasing up to peak', monotone, true);
}

// C6: Tyre load sensitivity — higher Fz → higher peak Fy (but not linearly)
{
  const Fz1 = 2000, Fz2 = 4000, Fz3 = 8000;
  const peak = (Fz: number) => {
    const pa = findPeakAlpha(Fz, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
    return pacejkaFy(pa, Fz, COEFFS.B, COEFFS.C, COEFFS.peakMu, COEFFS.E);
  };
  const p1 = peak(Fz1), p2 = peak(Fz2), p3 = peak(Fz3);
  checkBool('C6 Higher Fz → higher peak Fy', p3 > p2 && p2 > p1, true);
  // With linear D=peakMu×Fz, peak Fy should scale exactly with Fz
  // (no degressive behaviour unless B,C,E change with Fz — they don't in v0.1)
  check('C6 Peak Fy scales linearly with Fz (v0.1 model)', p2 / p1, Fz2 / Fz1, 0.01);
}

// =============================================================================
// SECTION D — AERODYNAMICS
// =============================================================================

section('D — Aerodynamics');

// D1: Downforce scales with V² — doubling speed → 4× downforce
{
  const V1 = 30, V2 = 60;  // m/s
  const a1 = computeAero({ aeroCL: 1.0, aeroCD: 0.5, aeroReferenceArea: 2.0, aeroBalance: 0.45, speedMs: V1 });
  const a2 = computeAero({ aeroCL: 1.0, aeroCD: 0.5, aeroReferenceArea: 2.0, aeroBalance: 0.45, speedMs: V2 });
  check('D1 V² scaling: DF(2V) = 4 × DF(V)', a2.downforceN / a1.downforceN, 4.0, 1e-6);
  check('D1 V² scaling: Drag(2V) = 4 × Drag(V)', a2.dragN / a1.dragN, 4.0, 1e-6);
}

// D2: FzBoostFront + FzBoostRear = total downforce
{
  const aero = computeAero({ aeroCL: 2.0, aeroCD: 0.8, aeroReferenceArea: 1.8, aeroBalance: 0.42, speedMs: 50 });
  check('D2 FzBoostFront + FzBoostRear = total DF', aero.FzBoostFront + aero.FzBoostRear, aero.downforceN, 1e-6);
}

// D3: At V=0, all aero forces = 0
{
  const aero0 = computeAero({ aeroCL: 3.0, aeroCD: 1.0, aeroReferenceArea: 1.8, aeroBalance: 0.45, speedMs: 0 });
  check('D3 V=0: downforce = 0', aero0.downforceN, 0, 1e-9);
  check('D3 V=0: drag = 0',      aero0.dragN,      0, 1e-9);
}

// D4: aeroBalance = 1.0 → all downforce on front
{
  const aeroFront = computeAero({ aeroCL: 1.0, aeroCD: 0.5, aeroReferenceArea: 2.0, aeroBalance: 1.0, speedMs: 40 });
  check('D4 Balance=1.0: FzBoostFront = total DF',  aeroFront.FzBoostFront, aeroFront.downforceN, 1e-6);
  check('D4 Balance=1.0: FzBoostRear  = 0',          aeroFront.FzBoostRear,  0,                   1e-6);
}

// D5: L/D ratio test — F1-like car (CL=3.0, CD=1.0) → L/D ≈ 3.0
{
  const aeroF1 = computeAero({ aeroCL: 3.0, aeroCD: 1.0, aeroReferenceArea: 1.8, aeroBalance: 0.45, speedMs: 70 });
  const ld = aeroF1.downforceN / aeroF1.dragN;
  check('D5 L/D ratio = CL/CD = 3.0', ld, 3.0, 1e-9);
}

// =============================================================================
// SECTION E — BRAKING
// =============================================================================

section('E — Braking Model');

const FzFront = BASE.mass * G * BASE.frontWeightFraction;
const FzRear  = BASE.mass * G * (1 - BASE.frontWeightFraction);

// E1: No braking (brakingG=0) → all outputs zero
{
  const brk = computeBraking({ brakingG: 0, brakeBias: 0.65, mass: BASE.mass, peakMu: 1.0, FzFrontAxle: FzFront, FzRearAxle: FzRear });
  check('E1 No braking: FxFront = 0',   brk.FxBrakeFront,  0, 1e-9);
  check('E1 No braking: FxRear  = 0',   brk.FxBrakeRear,   0, 1e-9);
  check('E1 No braking: brakeForce = 0', brk.brakeForceN,   0, 1e-9);
  check('E1 No braking: ax = 0',         brk.brakingAx_ms2, 0, 1e-9);
}

// E2: ABS enforced — brake force cannot exceed μ×Fz×0.95
{
  // Extreme bias: 0.95 front. At 1.5g, front force >> limit.
  const brkABS = computeBraking({ brakingG: 1.5, brakeBias: 0.95, mass: BASE.mass, peakMu: 1.0, FzFrontAxle: FzFront, FzRearAxle: FzRear });
  const limitFront = 1.0 * FzFront * 0.95;
  checkBool('E2 ABS: FxBrakeFront ≤ μ×FzFront×0.95', brkABS.FxBrakeFront <= limitFront + 0.01, true);
  checkBool('E2 ABS active on front',                  brkABS.absActiveFront, true);
}

// E3: Total brake force = sum of front + rear (simple addition)
{
  const brk = computeBraking({ brakingG: 0.8, brakeBias: 0.65, mass: BASE.mass, peakMu: 1.0, FzFrontAxle: FzFront, FzRearAxle: FzRear });
  check('E3 Total = FxFront + FxRear', brk.brakeForceN, brk.FxBrakeFront + brk.FxBrakeRear, 1e-6);
}

// E4: brakingAx = brakeForce / mass (Newton's 2nd law)
{
  const brk = computeBraking({ brakingG: 0.6, brakeBias: 0.65, mass: BASE.mass, peakMu: 1.0, FzFrontAxle: FzFront, FzRearAxle: FzRear });
  check('E4 ax = brakeForce/mass (Newton 2nd)', brk.brakingAx_ms2, brk.brakeForceN / BASE.mass, 1e-6);
}

// =============================================================================
// SECTION F — LAP TIME ESTIMATOR
// =============================================================================

section('F — Lap Time Estimator');

const lapInp = makeLapInput(1500, 1.10, 200);  // 1500 kg road-performance car

// F1: Circuit distances match stated totals (critical — arc lengths just fixed)
const expectedLengths: Record<string, number> = {
  monza: 5793, spa: 7004, silverstone: 5891, suzuka: 5807,
};
for (const [name, expectedM] of Object.entries(expectedLengths)) {
  const layout = TRACK_PRESETS[name];
  const totalM = layout.segments.reduce((s, seg) => s + seg.length, 0);
  check(`F1 ${name}: total distance = ${expectedM} m`, totalM, expectedM, 0);
}

// F2: No corner has arc > 2π (would loop the track map)
{
  for (const [name, layout] of Object.entries(TRACK_PRESETS)) {
    for (const seg of layout.segments) {
      if (seg.type === 'corner' && seg.radius) {
        const sweep = seg.length / seg.radius;
        if (sweep > 2 * Math.PI + 0.001) {
          console.log(`  \x1b[31mFAIL\x1b[0m F2 ${name}: corner R${seg.radius}m sweep=${(sweep*RAD_TO_DEG).toFixed(1)}° > 360°`);
          allPassed = false; failCount++;
        } else {
          passCount++;
        }
      }
    }
  }
  console.log(`  [${'\x1b[32mPASS\x1b[0m'}] F2 All corners: arc sweep ≤ 360°`);
}

// F3: Lap times for known circuits are in physically plausible ranges
// 1500 kg, 200 kW, μ=1.1 — fast road car, not a racing car
// Monza ~100–140s, Spa ~140–190s, Silverstone ~110–160s, Suzuka ~120–165s
const lapTimeBounds: Record<string, [number, number]> = {
  monza:       [90,  145],
  spa:         [130, 195],
  silverstone: [105, 165],
  suzuka:      [110, 165],
};
for (const [name, [lo, hi]] of Object.entries(lapTimeBounds)) {
  const result = computeLapTime(TRACK_PRESETS[name], lapInp);
  const t      = result.totalTimeSec;
  console.log(`  F3 ${name}: lap = ${t.toFixed(1)}s, avgV = ${result.avgSpeedKph.toFixed(1)} kph, Vmax = ${result.maxSpeedKph.toFixed(1)} kph`);
  checkBool(`F3 ${name} lap time in [${lo}s, ${hi}s]`, t >= lo && t <= hi, true);
}

// F4: All segment times > 0, all speeds > 0
{
  for (const [name, layout] of Object.entries(TRACK_PRESETS)) {
    const result  = computeLapTime(layout, lapInp);
    const badTime = result.segments.some(s => s.timeSec <= 0);
    const badSpd  = result.segments.some(s => s.minSpeedKph <= 0);
    checkBool(`F4 ${name}: all segment times > 0`, !badTime, true);
    checkBool(`F4 ${name}: all min speeds > 0`,    !badSpd,  true);
  }
}

// F5: Generic preset circuits — sanity bounds (labels are approximate; just verify reasonable range)
const genericPresets = ['club', 'karting', 'gt_circuit', 'formula_test'];
for (const name of genericPresets) {
  if (!TRACK_PRESETS[name]) continue;
  const totalM = TRACK_PRESETS[name].segments.reduce((s, seg) => s + seg.length, 0);
  console.log(`  F5 ${name}: total = ${totalM} m`);
  checkBool(`F5 ${name}: total > 500 m (not degenerate)`, totalM > 500, true);
  checkBool(`F5 ${name}: total < 15000 m (not absurd)`,   totalM < 15000, true);
}

// =============================================================================
// SECTION G — BICYCLE MODEL ADDITIONAL CHECKS
// =============================================================================

section('G — Bicycle Model Additional Checks');

// G1: Characteristic speed (understeer) — V_ch = sqrt(g×L/K)
//     At V_ch, steer angle = 2 × Ackermann (Gillespie eq.6.17)
{
  const r = computeBicycleModel(BASE);
  const K_radmss = r.underSteerGradientDegPerG / (RAD_TO_DEG * G);
  // δ = L/R + K_rad×V²/R; at δ = 2×(L/R): K_rad×V_ch² = L → V_ch = √(L/K_rad)
  const V_ch = Math.sqrt(BASE.wheelbase / K_radmss);  // m/s
  const r_vc = computeBicycleModel({ ...BASE, speedKph: V_ch * 3.6 });
  const ackermannDeg = (BASE.wheelbase / BASE.turnRadius) * RAD_TO_DEG;
  console.log(`  G1 V_ch = ${V_ch.toFixed(1)} m/s (${(V_ch*3.6).toFixed(1)} kph)`);
  console.log(`  G1 δ at V_ch = ${r_vc.totalSteerAngleDeg.toFixed(4)}°, 2×Ackermann = ${(2 * ackermannDeg).toFixed(4)}°`);
  check('G1 At V_ch: δ = 2 × Ackermann (±0.01°)', r_vc.totalSteerAngleDeg, 2 * ackermannDeg, 0.01);
}

// G2: Oversteer vehicle — K < 0, balance = oversteer
{
  // Rear-heavy (30/70 F/R) → a > b → K < 0
  const r = computeBicycleModel({ ...BASE, frontWeightFraction: 0.30 });
  checkBool('G2 Rear-heavy: K < 0 (oversteer)',         r.underSteerGradientDegPerG < 0,   true);
  checkBool('G2 Rear-heavy: balance = oversteer',        r.balance === 'oversteer',         true);
  checkBool('G2 Rear-heavy: αr > αf',                    r.rearSlipAngleDeg > r.frontSlipAngleDeg, true);
}

// G3: Force balance — Fyf + Fyr = m × ay (Newton's 2nd law)
{
  const r  = computeBicycleModel(BASE);
  const ay = r.lateralAccelerationG * G;
  check('G3 Fyf + Fyr = m×ay', r.frontLateralForceN + r.rearLateralForceN, BASE.mass * ay, 1e-4);
}

// G4: Moment balance — a×Fyf = b×Fyr (steady-state no pitch/yaw accel)
{
  const r = computeBicycleModel(BASE);
  const a = r.a, b = r.b;
  check('G4 Moment: a×Fyf = b×Fyr', a * r.frontLateralForceN, b * r.rearLateralForceN, 1e-4);
}

// =============================================================================
// SECTION H — INTEGRATION / EDGE CASES
// =============================================================================

section('H — Edge Cases & Boundary Conditions');

// H1: Very large turn radius (highway cruising) → near-zero lateral acceleration
{
  const r = computeBicycleModel({ ...BASE, turnRadius: 10000, speedKph: 100 });
  checkBool('H1 R=10000m: ay < 0.01g',    r.lateralAccelerationG < 0.01,   true);
  checkBool('H1 R=10000m: balance neutral', r.balance === 'neutral' || Math.abs(r.slipAngleDiffDeg) < 0.5, true);
}

// H2: Very high speed cornering → high ay → clear balance signal
{
  const r = computeBicycleModel({ ...BASE, speedKph: 200, turnRadius: 200 });
  checkBool('H2 High speed: clear balance signal (|diff| > 1°)', Math.abs(r.slipAngleDiffDeg) > 1, true);
}

// H3: Load transfer at extreme ay (1.5g) — no negative Fz (tyre lifting)
{
  const lt = computeLoadTransfer(
    { mass: 1500, wheelbase: 2.7, cgHeight: 0.55, trackWidth: 1.5, frontWeightFraction: 0.55 },
    1.5 * G, 0,
  );
  checkBool('H3 No negative Fz at 1.5g lateral (FL)', lt.FzFL >= 0, true);
  checkBool('H3 No negative Fz at 1.5g lateral (RL)', lt.FzRL >= 0, true);
}

// H4: ABS cannot produce more brake force than requested
{
  const brk = computeBraking({ brakingG: 2.5, brakeBias: 0.9, mass: 1500, peakMu: 1.0, FzFrontAxle: FzFront, FzRearAxle: FzRear });
  const maxPossible = 1.0 * (FzFront + FzRear) * 0.95;
  checkBool('H4 ABS: total brake force ≤ μ×Fz_total×0.95', brk.brakeForceN <= maxPossible + 0.01, true);
}

// =============================================================================
// SECTION I — GEAR MODEL (Stage 10)
// =============================================================================

section('I — Gear Model (Stage 10)');

const GEAR_PARAMS: VehicleParams = {
  ...BASE,
  enginePowerKW:    150,
  enginePeakRpm:    5500,
  engineRedlineRpm: 6500,
  gearCount:        6,
  firstGearRatio:   3.0,
  topGearRatio:     0.72,
  finalDriveRatio:  3.9,
  wheelRadiusM:     0.32,
};
const TWO_PI   = 2 * Math.PI;
const P_W      = 150000;
const omegaPk  = 5500 * TWO_PI / 60;
const T_PEAK   = P_W / omegaPk;  // 260.43 Nm

// I1: Torque curve — flat below peak RPM
{
  const t3000 = engineTorque(3000, P_W, 5500);
  const t5500 = engineTorque(5500, P_W, 5500);
  check('I1 Torque flat at 3000 rpm = T_peak', t3000, T_PEAK, 0.01);
  check('I1 Torque at 5500 rpm = T_peak',      t5500, T_PEAK, 0.01);
}

// I2: Torque curve — constant power above peak RPM
{
  const rpm    = 7000;
  const omega  = rpm * TWO_PI / 60;
  const t_exp  = P_W / omega;
  const t_act  = engineTorque(rpm, P_W, 5500);
  check('I2 Torque at 7000 rpm = P/ω (constant power)', t_act, t_exp, 0.001);
  // Verify T drops from peak
  checkBool('I2 T(7000) < T_peak', engineTorque(7000, P_W, 5500) < T_PEAK, true);
}

// I3: Gear ratio geometric progression
{
  const ratios = generateGearRatios(6, 3.0, 0.72);
  check('I3 ratios[0] = first gear ratio 3.0', ratios[0], 3.0, 1e-9);
  check('I3 ratios[5] = top gear ratio 0.72',  ratios[5], 0.72, 1e-9);
  // Each step: ratios[i+1] / ratios[i] = constant
  const stepRatio = ratios[1] / ratios[0];
  for (let i = 1; i < 5; i++) {
    check(`I3 Step ratio constant at step ${i}`, ratios[i + 1] / ratios[i], stepRatio, 1e-6);
  }
}

// I4: Optimal gear selection — at low speed, G1 gives max force
{
  // At V=5 m/s all gears have rpm < redline; G1 (highest ratio) gives max force
  const ratios = generateGearRatios(6, 3.0, 0.72);
  const V = 5;
  let g1Force = 0, g2Force = 0;
  for (let i = 0; i < 2; i++) {
    const rpm = (V / 0.32) * ratios[i] * 3.9 * 60 / TWO_PI;
    const t   = engineTorque(rpm, P_W, 5500);
    const f   = t * ratios[i] * 3.9 / 0.32;
    if (i === 0) g1Force = f;
    if (i === 1) g2Force = f;
  }
  checkBool('I4 G1 force > G2 force at V=5 m/s', g1Force > g2Force, true);
  // computeMaxDriveForce should match G1 force (capped at traction)
  const maxF    = computeMaxDriveForce(V, GEAR_PARAMS);
  const capF    = Math.min(g1Force, GEAR_PARAMS.mass * G);
  check('I4 computeMaxDriveForce = G1 force (or traction cap)', maxF, capF, 1);
}

// I5: Redline cut — very high speed where G1 exceeds redline
{
  // At V=40 m/s, G1 rpm = (40/0.32) × 3.0 × 3.9 × 60/(2π) = 13965 rpm > 6500 → G1 skipped
  const rpmG1 = (40 / 0.32) * 3.0 * 3.9 * 60 / TWO_PI;
  checkBool('I5 G1 rpm at 40 m/s > redline', rpmG1 > 6500, true);
  // Force must still be > 0 (a higher gear is valid)
  const f40 = computeMaxDriveForce(40, GEAR_PARAMS);
  checkBool('I5 Force > 0 at 40 m/s (higher gear available)', f40 > 0, true);
}

// I6: Max speed — force drops to 0 above redline in all gears
{
  // Above V_max all gears exceed redline → force = 0
  const omegaRed = 6500 * TWO_PI / 60;
  const vMax     = omegaRed * 0.32 / (0.72 * 3.9);   // ~77.6 m/s
  const fBeyond  = computeMaxDriveForce(vMax * 1.05, GEAR_PARAMS);
  check('I6 Force = 0 at 5% above V_max', fBeyond, 0, 0.01);
}

// I7: Edge case — V=0 returns traction-limited force (not infinity)
{
  const f0 = computeMaxDriveForce(0, GEAR_PARAMS);
  const tractionCap = GEAR_PARAMS.mass * G;
  check('I7 V=0 returns traction cap (mass×g)', f0, tractionCap, 0.01);
}

// =============================================================================
// SECTION J — TYRE THERMAL MODEL (Stage 11)
// =============================================================================

section('J — Tyre Thermal Model (Stage 11)');

const T_OPT = 85, HW = 30, FLOOR = 0.60, PEAK_MU = 1.20;
const HALF_MAX = 0.5 * (1 + FLOOR);  // 0.80

// J1: f(T_opt) = 1.0 exactly
{
  const f = computeTyreTempFactor(T_OPT, T_OPT, HW, FLOOR);
  check('J1 f(T_opt) = 1.0 exactly', f, 1.0, 1e-12);
}

// J2: Symmetry — f(T_opt + Δ) = f(T_opt − Δ) at two offsets
{
  for (const delta of [20, 40]) {
    const fHi = computeTyreTempFactor(T_OPT + delta, T_OPT, HW, FLOOR);
    const fLo = computeTyreTempFactor(T_OPT - delta, T_OPT, HW, FLOOR);
    check(`J2 Symmetry at Δ=${delta}°C: f(+Δ) = f(-Δ)`, fHi, fLo, 1e-12);
  }
}

// J3: Half-width condition: f(T_opt ± hw) = 0.5×(1+floor) = 0.80
{
  const fHi = computeTyreTempFactor(T_OPT + HW, T_OPT, HW, FLOOR);
  const fLo = computeTyreTempFactor(T_OPT - HW, T_OPT, HW, FLOOR);
  check('J3 f(T_opt + hw) = 0.5×(1+floor) = 0.80', fHi, HALF_MAX, 1e-10);
  check('J3 f(T_opt - hw) = 0.5×(1+floor) = 0.80', fLo, HALF_MAX, 1e-10);
}

// J4: Floor is never violated over a wide temperature range
{
  let floorViolated = false;
  for (let T = -100; T <= 500; T += 20) {
    const f = computeTyreTempFactor(T, T_OPT, HW, FLOOR);
    if (f < FLOOR - 1e-9) floorViolated = true;
  }
  checkBool('J4 Floor never violated from -100°C to 500°C', floorViolated, false);
}

// J5: Narrower half-width → steeper drop (same offset, more penalty)
{
  const Tdeviation = T_OPT + 20;
  const fNarrow = computeTyreTempFactor(Tdeviation, T_OPT, 10, FLOOR);  // tight window
  const fWide   = computeTyreTempFactor(Tdeviation, T_OPT, 50, FLOOR);  // wide window
  checkBool('J5 Narrower hw → lower f at same deviation', fNarrow < fWide, true);
}

// J6: Integration with Pacejka — cold tyre generates less lateral force
{
  const Fz = 1500 * G / 4;  // static corner load
  const alpha = 0.1;         // 0.1 rad slip angle

  const muOpt  = computeTyreEffectiveMu(PEAK_MU, { tyreTempCurrentC: T_OPT, tyreOptTempC: T_OPT, tyreTempHalfWidthC: HW, tyreTempFloorMu: FLOOR });
  const muCold = computeTyreEffectiveMu(PEAK_MU, { tyreTempCurrentC: T_OPT - 40, tyreOptTempC: T_OPT, tyreTempHalfWidthC: HW, tyreTempFloorMu: FLOOR });

  const FyOpt  = pacejkaFy(alpha, Fz, 11.5, 1.28, muOpt,  -1.5);
  const FyCold = pacejkaFy(alpha, Fz, 11.5, 1.28, muCold, -1.5);
  checkBool('J6 Cold tyre (40°C below opt) → lower Fy than optimal', FyCold < FyOpt, true);
  // Also verify muOpt = PEAK_MU exactly (at optimal temp)
  check('J6 muEff at T_opt = peakMu exactly', muOpt, PEAK_MU, 1e-12);
}

// J7: computeTyreGripCurve — correct length, bounds, and peak location
{
  const curve = computeTyreGripCurve({ tyreOptTempC: T_OPT, tyreTempHalfWidthC: HW, tyreTempFloorMu: FLOOR }, 100);
  check('J7 Curve length = 100', curve.length, 100, 0);
  check('J7 curve[0].tempC = 0', curve[0].tempC, 0, 1e-9);
  check('J7 curve[99].tempC = 200', curve[99].tempC, 200, 1e-9);
  // All muFraction ≥ floor
  let allAboveFloor = true;
  let peakFrac = 0;
  for (const pt of curve) {
    if (pt.muFraction < FLOOR - 1e-9) allAboveFloor = false;
    if (pt.muFraction > peakFrac) peakFrac = pt.muFraction;
  }
  checkBool('J7 All muFraction ≥ floor', allAboveFloor, true);
  check('J7 Peak muFraction ≈ 1.0 (grid nearest T_opt, tol 0.001)', peakFrac, 1.0, 1e-3);
}

// J8: Higher floorMu → higher grip at extreme cold
{
  const fLowFloor  = computeTyreTempFactor(0, T_OPT, HW, 0.40);
  const fHighFloor = computeTyreTempFactor(0, T_OPT, HW, 0.80);
  checkBool('J8 Higher floorMu → higher f at extreme cold', fHighFloor > fLowFloor, true);
}

// =============================================================================
// SECTION K — SETUP OPTIMISER (Stage 12)
// =============================================================================

section('K — Setup Optimiser (Stage 12)');

const RHO_K = 1.225;
const G_K   = 9.81;

function makeOptimInpBuilder(peakMu: number) {
  return (p: VehicleParams) => {
    const tw2o2  = (p.trackWidth * p.trackWidth) / 2;
    const kPhiF  = (p.frontSpringRate + p.frontARBRate) * tw2o2;
    const kPhiR  = (p.rearSpringRate  + p.rearARBRate)  * tw2o2;
    const kTot   = kPhiF + kPhiR;
    const phiF   = kTot > 0 ? kPhiF / kTot : 0.5;
    const FzS    = p.mass * G_K / 4;
    const FzOut  = FzS + p.mass * G_K * p.cgHeight * phiF / p.trackWidth;
    const qFz    = p.tyreLoadSensitivity;
    const muFrac = qFz > 0 ? Math.max(0.5, 1 - qFz * (FzOut / FzS - 1)) : 1.0;
    const brakingCapG = Math.max(p.brakingG, 0.9);
    const dragForce   = (V: number) => 0.5 * RHO_K * V * V * p.aeroReferenceArea * p.aeroCD;
    const driveForce  = (V: number) => computeMaxDriveForce(V, p);
    return {
      mass: p.mass, peakMu: peakMu * muFrac, brakingCapG,
      aeroCL: p.aeroCL, aeroCD: p.aeroCD,
      aeroReferenceArea: p.aeroReferenceArea, dragForce, driveForce,
    };
  };
}

const CLUB_LAYOUT  = TRACK_PRESETS['club'];
const OPTIM_BUILDER = makeOptimInpBuilder(1.20);

// K1: Nelder-Mead reflection step moves toward the minimum
// f(x) = Σ(xi − 0.5)², minimum at x = [0.5,...,0.5].
// Worst vertex at [0.8,...,0.8]. Non-worst centroid at [0.55,...,0.55].
// Reflection: xr = 2×0.55 − 0.8 = [0.30,...] → f = 7×0.04 = 0.28 < f([0.8]) = 7×0.09 = 0.63
{
  const n = 7;
  const bowl = (x: number[]) => x.reduce((s, v) => s + (v - 0.5) ** 2, 0);
  const xw   = new Array(n).fill(0.8);    // worst: all 0.8
  const c    = new Array(n).fill(0.55);   // centroid of non-worst: all 0.55
  const xr   = c.map((cj, j) => cj + 1.0 * (cj - xw[j]));  // reflection
  checkBool('K1 Reflection step: f(xr) < f(xworst)', bowl(xr) < bowl(xw), true);
}

// K2: All optimised params within bounds (bad setup → optimised)
{
  const badParams: VehicleParams = {
    ...BASE, frontSpringRate: 120_000, rearSpringRate: 120_000,
    frontARBRate: 0, rearARBRate: 0, aeroCL: 0, brakeBias: 0.90,
    tyreLoadSensitivity: 0.10,
  };
  const res = optimiseSetup(badParams, CLUB_LAYOUT, OPTIM_BUILDER, OPTIMISE_BOUNDS);
  let allInBounds = true;
  for (const key of OPTIMISABLE_KEYS) {
    const v = res.bestParams[key] as number;
    const b = OPTIMISE_BOUNDS[key];
    if (v < b.min - 1e-6 || v > b.max + 1e-6) allInBounds = false;
  }
  checkBool('K2 All optimised params within bounds', allInBounds, true);
}

// K3: Optimised lap time ≤ base lap time (never worse)
{
  const badParams: VehicleParams = {
    ...BASE, frontSpringRate: 120_000, rearSpringRate: 120_000,
    frontARBRate: 0, rearARBRate: 0, aeroCL: 0, brakeBias: 0.90,
    tyreLoadSensitivity: 0.10,
  };
  const res = optimiseSetup(badParams, CLUB_LAYOUT, OPTIM_BUILDER, OPTIMISE_BOUNDS);
  console.log(`  K3 bad→opt: ${res.baseTimeSec.toFixed(2)}s → ${res.bestTimeSec.toFixed(2)}s  (−${res.improvement.toFixed(2)}s)`);
  checkBool('K3 Optimised time ≤ base time',         res.bestTimeSec <= res.baseTimeSec + 1e-6, true);
  checkBool('K3 Improvement ≥ 0',                    res.improvement >= 0,                      true);
  checkBool('K3 Improvement ≥ 1.0 s on bad setup',   res.improvement >= 1.0,                    true);
}

// K4: Converges in < 500 iterations from a reasonable starting point
{
  const res = optimiseSetup(BASE, CLUB_LAYOUT, OPTIM_BUILDER, OPTIMISE_BOUNDS);
  console.log(`  K4 BASE→opt: iterations=${res.iterations}, improvement=${res.improvement.toFixed(2)}s`);
  checkBool('K4 Converges in < 500 iterations', res.iterations < 500, true);
  checkBool('K4 Iterations > 0',                res.iterations > 0,   true);
}

// =============================================================================
// SECTION L — SEPARATE FRONT/REAR CORNERING STIFFNESS (Stage 13A)
// =============================================================================

section('L — Separate Front/Rear Cornering Stiffness (Stage 13A)');

// L1: Equal front/rear Cα → K matches single-Cα formula
{
  const DEG_TO_RAD = Math.PI / 180;
  const p_sym = { ...BASE, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg };
  const r_sym = computeBicycleModel(p_sym);
  const Ca = BASE.corneringStiffnessNPerDeg / DEG_TO_RAD;
  const bv = BASE.frontWeightFraction * BASE.wheelbase;
  const av = BASE.wheelbase - bv;
  const K_expected = (BASE.mass / BASE.wheelbase) * (bv / Ca - av / Ca);
  const K_actual   = r_sym.underSteerGradientDegPerG / (RAD_TO_DEG * G);
  check('L1 Equal Cα: K matches single-Cα formula (±1e-10)', K_actual, K_expected, 1e-10);
}

// L2: Newton 2nd law holds with separate Cα
{
  const r = computeBicycleModel({ ...BASE, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg * 0.8 });
  const ay = r.lateralAccelerationG * G;
  check('L2 Fyf + Fyr = m×ay (Newton 2nd, separate Cα)', r.frontLateralForceN + r.rearLateralForceN, BASE.mass * ay, 1e-4);
}

// L3: Softer rear → rear slips more → oversteer tendency
{
  const r_eq = computeBicycleModel({ ...BASE, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg });
  const r_sr = computeBicycleModel({ ...BASE, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg * 0.7 });
  checkBool('L3 Softer rear: αr > αf (oversteer tendency)', r_sr.rearSlipAngleDeg > r_sr.frontSlipAngleDeg, true);
  checkBool('L3 Softer rear: K decreases vs equal Cα', r_sr.underSteerGradientDegPerG < r_eq.underSteerGradientDegPerG, true);
}

// L4: Stiffer rear → more understeer
{
  const r_eq = computeBicycleModel({ ...BASE, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg });
  const r_hr = computeBicycleModel({ ...BASE, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg * 1.5 });
  checkBool('L4 Stiffer rear: K > equal-Cα K (more understeer)', r_hr.underSteerGradientDegPerG > r_eq.underSteerGradientDegPerG, true);
}

// L5: 50/50 weight + equal Cα → K = 0 (neutral steer)
{
  const r = computeBicycleModel({ ...BASE, frontWeightFraction: 0.5, rearCorneringStiffnessNPerDeg: BASE.corneringStiffnessNPerDeg });
  check('L5 50/50 + equal Cα: K = 0 (±1e-8)', r.underSteerGradientDegPerG, 0, 1e-8);
  checkBool('L5 50/50 + equal Cα: balance = neutral', r.balance === 'neutral', true);
}

// L6: Hand-validated test case — mass=1200kg, L=2.6m, 50/50, CαF=50000N/rad, CαR=45000N/rad
{
  const DEG_TO_RAD = Math.PI / 180;
  const p14: VehicleParams = {
    ...BASE, mass: 1200, wheelbase: 2.6, frontWeightFraction: 0.5,
    corneringStiffnessNPerDeg:     50000 * DEG_TO_RAD,  // → 50000 N/rad
    rearCorneringStiffnessNPerDeg: 45000 * DEG_TO_RAD,  // → 45000 N/rad
  };
  const K_exp = (1200 / 2.6) * (1.3 / 50000 - 1.3 / 45000);  // rad/(m/s²)
  const r     = computeBicycleModel(p14);
  const K_act = r.underSteerGradientDegPerG / (RAD_TO_DEG * G);
  console.log(`  L6 K_exp=${K_exp.toFixed(8)}, K_act=${K_act.toFixed(8)} rad/(m/s²)`);
  check('L6 Hand-calc K (±1e-8)', K_act, K_exp, 1e-8);
  checkBool('L6 K < 0 = oversteer', K_act < 0, true);
}

// =============================================================================
// SECTION M — COMBINED SLIP IN LAP ESTIMATOR (Stage 13B)
// =============================================================================

section('M — Combined Slip in Lap Estimator (Stage 13B)');

import type { LapSimInput, TrackLayout } from './laptime';

// M1: combSlipBrakeFrac=0 → lap time identical to no-field version (backward compat)
{
  const inpA = makeLapInput(1500, 1.10, 200);
  const inpB = { ...makeLapInput(1500, 1.10, 200), combSlipBrakeFrac: 0 };
  const layout = TRACK_PRESETS['club'];
  const tA = computeLapTime(layout, inpA).totalTimeSec;
  const tB = computeLapTime(layout, inpB).totalTimeSec;
  check('M1 combSlipBrakeFrac=0: lap time identical (±1e-6)', tB, tA, 1e-6);
}

// M2: combSlipBrakeFrac=0.4 → lap time ≥ frac=0 (never faster)
{
  const layout  = TRACK_PRESETS['club'];
  const inpNoCS = { ...makeLapInput(1500, 1.20, 200), combSlipBrakeFrac: 0 };
  const inpCS   = { ...makeLapInput(1500, 1.20, 200), brakingCapG: 1.0, combSlipBrakeFrac: 0.4 };
  const tNoCS   = computeLapTime(layout, inpNoCS).totalTimeSec;
  const tCS     = computeLapTime(layout, inpCS).totalTimeSec;
  console.log(`  M2 no-CS: ${tNoCS.toFixed(2)}s, CS: ${tCS.toFixed(2)}s`);
  checkBool('M2 Combined slip → lap time ≥ no-combined-slip', tCS >= tNoCS - 1e-4, true);
}

// M3: Hand-validated ay_max reduction — peakMu=1.2, brakeFrac=0.4, brakingCapG=1.0, no aero
//   ay_max = sqrt(1.44 − 0.16) = sqrt(1.28) = 1.131371
{
  const R_M3 = 100;
  const singleCorner: TrackLayout = {
    name: 'm3_test',
    segments: [{ type: 'corner', length: 2 * Math.PI * R_M3, radius: R_M3 }],
  };
  const inpCS: LapSimInput = {
    mass: 1500, peakMu: 1.2, brakingCapG: 1.0,
    aeroCL: 0, aeroCD: 0.30, aeroReferenceArea: 2.0,
    dragForce: () => 0, driveForce: () => 9000,
    combSlipBrakeFrac: 0.4,
  };
  const vC      = computeLapTime(singleCorner, inpCS).segments[0].minSpeedKph / 3.6;
  const ay_act  = (vC * vC) / R_M3 / G;
  const ay_exp  = Math.sqrt(1.44 - 0.16);  // 1.131371
  console.log(`  M3 ay_max with CS = ${ay_act.toFixed(6)} g (expected ${ay_exp.toFixed(6)} g)`);
  check('M3 ay_max with CS = sqrt(1.28) (±0.001)', ay_act, ay_exp, 1e-3);
}

// M4: Larger brakeFrac → lower ay_max → slower corner
{
  const R_M4 = 80;
  const singleCorner: TrackLayout = { name: 'm4', segments: [{ type: 'corner', length: 2 * Math.PI * R_M4, radius: R_M4 }] };
  const base4: LapSimInput = { mass: 1500, peakMu: 1.2, brakingCapG: 1.0, aeroCL: 0, aeroCD: 0.30, aeroReferenceArea: 2.0, dragForce: () => 0, driveForce: () => 9000 };
  const v02 = computeLapTime(singleCorner, { ...base4, combSlipBrakeFrac: 0.2 }).segments[0].minSpeedKph;
  const v04 = computeLapTime(singleCorner, { ...base4, combSlipBrakeFrac: 0.4 }).segments[0].minSpeedKph;
  const v06 = computeLapTime(singleCorner, { ...base4, combSlipBrakeFrac: 0.6 }).segments[0].minSpeedKph;
  checkBool('M4 More brakeFrac → slower corner (v0.2 > v0.4 > v0.6)', v02 > v04 && v04 > v06, true);
}

// =============================================================================
// SECTION N — TRANSIENT YAW PENALTY (Stage 13C)
// =============================================================================

section('N — Transient Yaw Time Constant Penalty (Stage 13C)');

// N1: No Ca fields → no transient penalty (all corner times = arc/V_corner)
{
  const layout  = TRACK_PRESETS['club'];
  const res     = computeLapTime(layout, makeLapInput(1500, 1.10, 200));
  let anyPenalty = false;
  for (const seg of res.segments) {
    if (seg.type === 'corner') {
      const vC = seg.minSpeedKph / 3.6;
      const t0 = seg.length / vC;
      if (seg.timeSec > t0 + 1e-4) anyPenalty = true;
    }
  }
  checkBool('N1 No Cα fields → no transient penalty', !anyPenalty, true);
}

// N2: With Ca fields → total lap time ≥ without (penalty ≥ 0)
{
  const DEG_TO_RAD = Math.PI / 180;
  const layout   = TRACK_PRESETS['club'];
  const inpNoT   = makeLapInput(1500, 1.10, 200);
  const inpWithT = { ...inpNoT, frontCaNPerRad: 500 / DEG_TO_RAD, rearCaNPerRad: 450 / DEG_TO_RAD };
  const tNoT     = computeLapTime(layout, inpNoT).totalTimeSec;
  const tWithT   = computeLapTime(layout, inpWithT).totalTimeSec;
  console.log(`  N2 no-transient: ${tNoT.toFixed(2)}s, with transient: ${tWithT.toFixed(2)}s`);
  checkBool('N2 With Cα: lap time ≥ without (penalty ≥ 0)', tWithT >= tNoT - 1e-4, true);
}

// N3: τ formula arithmetic — hand-calc
//   m=1200, V=22.222 m/s, CαF+CαR=95000 N/rad → τ = 0.14035 s; penalty = 0.05701 s
{
  const m = 1200, V = 80 / 3.6, CaF = 50000, CaR = 45000;
  const tau     = m * V / (2 * (CaF + CaR));
  const Vc      = 15 / 3.6;
  const penalty = tau * Math.max(0, 1 - Vc / V) * 0.5;
  console.log(`  N3 τ=${tau.toFixed(5)}s, penalty=${penalty.toFixed(5)}s`);
  check('N3 τ = m×V/(2×(CαF+CαR)) = 0.14035 s (±0.0001)', tau, 0.14035, 0.0001);
  check('N3 penalty = τ×(1−Vc/Ve)×0.5 = 0.05701 s (±0.001)', penalty, 0.05701, 0.001);
}

// N4: No penalty when V_corner >= V_entry
{
  const tau = 0.14, Vc = 25, Ve = 20;  // V_corner > V_entry
  const penalty = tau * Math.max(0, 1 - Vc / Ve) * 0.5;
  check('N4 No penalty when V_corner ≥ V_entry', penalty, 0, 1e-9);
}

// N5: Heavier car → larger τ → larger penalty at same corner
{
  const DEG_TO_RAD = Math.PI / 180;
  const layout  = TRACK_PRESETS['club'];
  const Ca      = 500 / DEG_TO_RAD;
  const inpLt   = { ...makeLapInput(1000, 1.10, 200), frontCaNPerRad: Ca, rearCaNPerRad: Ca };
  const inpHvy  = { ...makeLapInput(2000, 1.10, 200), frontCaNPerRad: Ca, rearCaNPerRad: Ca };
  const tLt     = computeLapTime(layout, inpLt).totalTimeSec;
  const tHvy    = computeLapTime(layout, inpHvy).totalTimeSec;
  checkBool('N5 Heavier car → larger transient penalty → slower lap', tHvy > tLt, true);
}

// =============================================================================
// SUMMARY
// =============================================================================

console.log(`\n${'═'.repeat(60)}`);
console.log(`  Extended test results: ${passCount} passed, ${failCount} failed`);
if (allPassed) {
  console.log('\x1b[32m  All extended checks passed.\x1b[0m');
} else {
  console.log(`\x1b[31m  ${failCount} check(s) FAILED — see above.\x1b[0m`);
  process.exit(1);
}
console.log('═'.repeat(60));
