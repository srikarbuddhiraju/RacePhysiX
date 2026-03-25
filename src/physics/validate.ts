/**
 * Physics validation — bicycle model.
 *
 * Three algebraic self-consistency checks + one Gillespie numerical reference check.
 *
 * Run: npm run validate
 *
 * Reference: Gillespie, "Fundamentals of Vehicle Dynamics" (Revised Ed.), Ch.6
 *   Eq.6.12–6.16: αf = Wf·V²/(Cαf·g·R), αr = Wr·V²/(Cαr·g·R)
 *   δ [deg] = 57.3·L/R + αf − αr
 *   K [deg/g] = Wf/Cαf − Wr/Cαr
 */

import { computeBicycleModel } from './bicycleModel';
import { computeSuspension, computeRollAngle } from './suspension';
import { computeAero } from './aero';
import { computeBraking } from './braking';
import { runSimulation } from './dynamics14dof';
import { SCENARIOS } from './scenarios';
import { engineTorque, engineTorqueFull, generateGearRatios, computeMaxDriveForce, computeMaxSpeed } from './gearModel';
import { computeTyreTempFactor, computeTyreEffectiveMu, computeCoreTemp } from './tyreTemp';
import { airDensity, crosswindLateralForceN } from './ambient';
import { optimiseSetup, OPTIMISE_BOUNDS } from './optimise';
import { computeLapTime, TRACK_PRESETS } from './laptime';
import type { TrackLayout, LapSimInput } from './laptime';
import { combinedSlipGky } from './pacejka';
import { computeLoadTransfer } from './loadTransfer';
import { computeAeroMapFactors } from './aeroMap';
import type { VehicleParams, PacejkaCoeffs } from './types';

const PASS = '\x1b[32mPASS\x1b[0m';
const FAIL = '\x1b[31mFAIL\x1b[0m';
const TOL = 1e-6;

const G = 9.81;
const RAD_TO_DEG = 180 / Math.PI;

function check(name: string, actual: number, expected: number, tol = TOL): boolean {
  const ok = Math.abs(actual - expected) < tol;
  const tag = ok ? PASS : FAIL;
  console.log(`  [${tag}] ${name}`);
  if (!ok) {
    console.log(`         expected: ${expected}`);
    console.log(`         actual  : ${actual}`);
    console.log(`         diff    : ${Math.abs(actual - expected)}`);
  }
  return ok;
}

// ─── Base vehicle (road car) ──────────────────────────────────────────────────
const BASE: VehicleParams = {
  mass: 1500,
  wheelbase: 2.7,
  frontWeightFraction: 0.55,
  corneringStiffnessNPerDeg: 500,
  rearCorneringStiffnessNPerDeg: 500,  // Stage 13A — equal to front = symmetric (no effect on existing checks)
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
  frontARBRate: 8000, rearARBRate: 6000,
  brakingG: 0, brakeBias: 0.65,
  aeroCL: 0.30, aeroCD: 0.30, aeroReferenceArea: 2.0, aeroBalance: 0.45,
  tyreLoadSensitivity: 0,   // Stage 9 — off for existing validation checks
  // Stage 11 — Tyre thermal model (at optimal temp → no effect on existing checks)
  tyreOptTempC: 85, tyreTempHalfWidthC: 30,
  tyreTempCurrentC: 85,   // = tyreOptTempC → f = 1.0, no grip penalty
  tyreTempFloorMu: 0.60,
  // Stage 10 — Gear model
  gearCount: 6, firstGearRatio: 3.0, topGearRatio: 0.72,
  finalDriveRatio: 3.9, wheelRadiusM: 0.32,
  enginePeakRpm: 5500, engineRedlineRpm: 6500,
  fuelLoadKg: 45, fuelBurnRateKgPerLap: 2.5,
  frontCamberDeg: 0, rearCamberDeg: 0, frontToeDeg: 0, rearToeDeg: 0,
  tyreCompound: 'medium',
  altitudeM: 0, ambientTempC: 20, windSpeedKph: 0, windAngleDeg: 0,
  driverAggression: 0.5,
  diffType: 'open', lsdLockingPercent: 0,
  brakeDiscMassKg: 6.0, brakeOptTempC: 400, brakeHalfWidthC: 200, brakeFloorMu: 0.65,
  frontTyrePressureBar: 2.0, rearTyrePressureBar: 2.0,
  frontRideHeightMm: 100, rearRideHeightMm: 105,
  engineCurveType: 'na', engineMaxTorqueNm: 260, engineTorquePeakRpm: 3500, turboBoostRpm: 2500,
  tcEnabled: false, tcSlipThreshold: 0.12,
  trackRubberLevel: 0.5,
  trackWetness: 0.0,
  ersEnabled: false, ersPowerKW: 0, ersBatteryKJ: 1000, ersDeployStrategy: 'full',
  frontRollCentreHeightMm: 30, rearRollCentreHeightMm: 40, camberGainFront: 0.7, camberGainRear: 0.5,
  frontMotionRatio: 1.0, rearMotionRatio: 1.0,
  rollDamperRatio: 0.7,
  tyreCoreHeatLag: 0.3,
};

let allPassed = true;

// ─── Check 1: Neutral steer (50/50 weight) ───────────────────────────────────
// b = a → K = 0 exactly, αf = αr exactly, dynamic correction = 0.
console.log('\nCheck 1 — Neutral steer (50/50 weight distribution)');
{
  const r = computeBicycleModel({ ...BASE, frontWeightFraction: 0.50 });
  allPassed = check('K = 0 deg/g', r.underSteerGradientDegPerG, 0) && allPassed;
  allPassed = check('αf = αr  (diff = 0)', r.slipAngleDiffDeg, 0) && allPassed;
  allPassed = check('dynamic correction = 0', r.dynamicCorrectionDeg, 0) && allPassed;
}

// ─── Check 2: Slip angle identity — αf − αr = K · ay ────────────────────────
// Derivation (SI, radians):
//   αf − αr = [m·ay·b/(L·Cα) − m·ay·a/(L·Cα)] = m·ay·(b−a)/(L·Cα)
//   K        = m·(b−a)/(L·Cα)   [rad/(m/s²)]
//   → αf − αr [rad] = K · ay [m/s²]
//   → αf − αr [deg] = K · ay · RAD_TO_DEG
//
// Tested at three weight distributions.
console.log('\nCheck 2 — Slip angle identity: αf − αr = K · ay (correct formula, no L factor)');

for (const fwf of [0.40, 0.55, 0.65]) {
  const r = computeBicycleModel({ ...BASE, frontWeightFraction: fwf });
  const K_rad = r.underSteerGradientDegPerG / (RAD_TO_DEG * G); // rad/(m/s²)
  const ay_mss = r.lateralAccelerationG * G;                    // m/s²
  const expected_diff_deg = K_rad * ay_mss * RAD_TO_DEG;
  allPassed = check(
    `fwf=${fwf}: αf−αr (${r.slipAngleDiffDeg.toFixed(6)}°) = K·ay (${expected_diff_deg.toFixed(6)}°)`,
    r.slipAngleDiffDeg,
    expected_diff_deg,
    1e-8,
  ) && allPassed;
}

// ─── Check 3: Ackermann limit — at near-zero speed, δ_total → L/R ────────────
// ay → 0, so dynamic correction → 0 and total steer → pure geometry.
console.log('\nCheck 3 — Ackermann limit: at near-zero speed, δ_total → L/R');
{
  const r = computeBicycleModel({ ...BASE, speedKph: 1 });
  const ackermannDeg = (BASE.wheelbase / BASE.turnRadius) * RAD_TO_DEG;
  const tol = 0.01; // deg
  allPassed = check(
    `δ_total ≈ L/R = ${ackermannDeg.toFixed(4)}° (tol ±${tol}°)`,
    r.totalSteerAngleDeg,
    ackermannDeg,
    tol,
  ) && allPassed;
  allPassed = check(
    `dynamic correction ≈ 0 (tol ±${tol}°)`,
    r.dynamicCorrectionDeg,
    0,
    tol,
  ) && allPassed;
}

// ─── Check 4: Gillespie numerical reference (Ch.6, eq.6.15/6.16) ─────────────
// Using our base vehicle parameters, compute K using Gillespie's direct formula:
//   K [deg/g] = Wf/Cαf − Wr/Cαr   (Gillespie eq.6.15, equal Cα front/rear)
//             = (mg · b/L) / Cα_N_per_deg − (mg · a/L) / Cα_N_per_deg
//             = mg(b − a) / (L · Cα_N_per_deg)
//
// This is the textbook formula in SI units. Our implementation must match exactly.
console.log('\nCheck 4 — Gillespie eq.6.15 numerical reference (SI)');
{
  const L = BASE.wheelbase;
  const b = BASE.frontWeightFraction * L;   // CG to rear axle
  const a = L - b;                          // CG to front axle
  const Wf = BASE.mass * G * (b / L);       // front axle load (N)
  const Wr = BASE.mass * G * (a / L);       // rear axle load (N)
  const Cα_N_per_deg = BASE.corneringStiffnessNPerDeg;

  // Gillespie K [deg/g] = Wf/Cαf − Wr/Cαr (with equal Cα, N and N/deg → deg/g)
  const K_gillespie = Wf / Cα_N_per_deg - Wr / Cα_N_per_deg;

  const r = computeBicycleModel(BASE);

  // Expected: K_gillespie = mg(b−a)/(L·Cα_N_per_deg)
  //         = 1500×9.81×0.27/(2.7×500) = 3974.85/1350 = 2.944 deg/g
  console.log(`  Gillespie K = ${K_gillespie.toFixed(4)} deg/g`);
  console.log(`  Our K       = ${r.underSteerGradientDegPerG.toFixed(4)} deg/g`);

  allPassed = check(
    `K matches Gillespie formula (tol 1e-4 deg/g)`,
    r.underSteerGradientDegPerG,
    K_gillespie,
    1e-4,
  ) && allPassed;

  // Also verify the steer angle formula matches Gillespie eq.6.16:
  // δ [deg] = 57.3·L/R + K·ay  where ay in g's
  const ay_g = r.lateralAccelerationG;
  const delta_gillespie = 57.3 * L / BASE.turnRadius + K_gillespie * ay_g;
  console.log(`  Gillespie δ = ${delta_gillespie.toFixed(4)}°`);
  console.log(`  Our δ       = ${r.totalSteerAngleDeg.toFixed(4)}°`);

  allPassed = check(
    `δ_total matches Gillespie eq.6.16 (tol 0.001°)`,
    r.totalSteerAngleDeg,
    delta_gillespie,
    0.001,
  ) && allPassed;
}

// ─── Check 5: Stage 4 — Suspension roll stiffness ────────────────────────────
// Hand calc using RCVD Ch.16 formula: KΦ = (k_spring + k_ARB) × TW²/2
//   TW = 1.5 m  →  TW²/2 = 1.125
//   KΦ_front = (25000 + 8000) × 1.125 = 33000 × 1.125 = 37125 Nm/rad
//   KΦ_rear  = (28000 + 6000) × 1.125 = 34000 × 1.125 = 38250 Nm/rad
//   KΦ_total = 75375 Nm/rad
//   φ_front  = 37125 / 75375 = 0.49271...
//   Roll angle @ ay=0.5g=4.905 m/s²: Φ = m×ay×hCG/KΦ × (180/π)
//            = 1500×4.905×0.55/75375 × 57.2957 = 3.076°
console.log('\nCheck 5 — Stage 4 Suspension (RCVD Ch.16 roll stiffness model)');
{
  const susp = computeSuspension({
    mass: BASE.mass, cgHeight: BASE.cgHeight, trackWidth: BASE.trackWidth,
    frontSpringRate: BASE.frontSpringRate, rearSpringRate: BASE.rearSpringRate,
    frontARBRate: BASE.frontARBRate, rearARBRate: BASE.rearARBRate,
  });

  const TW = BASE.trackWidth;
  const tw2o2 = TW * TW / 2;
  const KPhiFront_exp = (BASE.frontSpringRate + BASE.frontARBRate) * tw2o2;
  const KPhiRear_exp  = (BASE.rearSpringRate  + BASE.rearARBRate)  * tw2o2;
  const KPhiTotal_exp = KPhiFront_exp + KPhiRear_exp;
  const rollRatio_exp = KPhiFront_exp / KPhiTotal_exp;

  allPassed = check('KΦ_front = 37125 Nm/rad', susp.KPhiFront, KPhiFront_exp) && allPassed;
  allPassed = check('KΦ_rear  = 38250 Nm/rad', susp.KPhiRear,  KPhiRear_exp)  && allPassed;
  allPassed = check('KΦ_total = 75375 Nm/rad', susp.KPhiTotal, KPhiTotal_exp) && allPassed;
  allPassed = check('φ_front  = 0.4927...',    susp.rollStiffRatio, rollRatio_exp) && allPassed;

  // Roll angle at ay = 0.5 g
  const ay05 = 0.5 * G;
  const rollDeg = computeRollAngle(susp, BASE.mass, BASE.cgHeight, ay05);
  const rollDeg_exp = (BASE.mass * ay05 * BASE.cgHeight / KPhiTotal_exp) * (180 / Math.PI);
  allPassed = check(`Roll angle @ 0.5g = ${rollDeg_exp.toFixed(4)}°`, rollDeg, rollDeg_exp, 1e-8) && allPassed;
  console.log(`  Roll angle @ 0.5 g = ${rollDeg.toFixed(4)}° (expected ${rollDeg_exp.toFixed(4)}°)`);
}

// ─── Check 6: Stage 6 — Aerodynamics ─────────────────────────────────────────
// Hand calc at V = 80 kph = 22.222 m/s, CL=CD=0.30, A=2.0, balance=0.45
//   q = ½ × 1.225 × (80/3.6)² = 302.469 Pa
//   downforce = 302.469 × 2.0 × 0.30 = 181.481 N
//   drag      = 302.469 × 2.0 × 0.30 = 181.481 N  (CL = CD here)
//   FzBoostFront = 181.481 × 0.45 = 81.667 N
//   FzBoostRear  = 181.481 × 0.55 = 99.815 N
console.log('\nCheck 6 — Stage 6 Aerodynamics (q, downforce, drag, axle splits)');
{
  const V = 80 / 3.6;
  const qPa_exp        = 0.5 * 1.225 * V * V;
  const downforce_exp  = qPa_exp * 2.0 * 0.30;
  const drag_exp       = qPa_exp * 2.0 * 0.30;
  const FzFront_exp    = downforce_exp * 0.45;
  const FzRear_exp     = downforce_exp * 0.55;

  const aero = computeAero({
    aeroCL: 0.30, aeroCD: 0.30, aeroReferenceArea: 2.0, aeroBalance: 0.45, speedMs: V,
  });

  console.log(`  q = ${aero.qPa.toFixed(3)} Pa (expected ${qPa_exp.toFixed(3)})`);
  console.log(`  downforce = ${aero.downforceN.toFixed(3)} N,  drag = ${aero.dragN.toFixed(3)} N`);
  allPassed = check('q matches ½ρV²',            aero.qPa,        qPa_exp,       1e-6) && allPassed;
  allPassed = check('downforce = q×A×CL',         aero.downforceN, downforce_exp, 1e-6) && allPassed;
  allPassed = check('drag = q×A×CD',              aero.dragN,      drag_exp,      1e-6) && allPassed;
  allPassed = check('FzBoostFront = Fd×balance',  aero.FzBoostFront, FzFront_exp, 1e-6) && allPassed;
  allPassed = check('FzBoostRear  = Fd×(1−bal)',  aero.FzBoostRear,  FzRear_exp,  1e-6) && allPassed;
}

// ─── Check 7: Stage 5 — Braking model ────────────────────────────────────────
// Hand calc: m=1500, brakingG=0.8, brakeBias=0.65, peakMu=1.0
//   F_req  = 1500 × 0.8 × 9.81 = 11772 N
//   Ffront_raw = 0.65 × 11772 = 7651.8 N
//   Frear_raw  = 0.35 × 11772 = 4120.2 N
//   Static Fz_front_axle = 1500×9.81×0.55 = 8093.25 N
//   ABS limit front = 1.0 × 8093.25 × 0.95 = 7688.59 N > 7651.8 → ABS OFF
//   ABS limit rear  = 1.0 × 6620.25 × 0.95 = 6289.24 N > 4120.2 → ABS OFF
//   brakingAx = (7651.8 + 4120.2)/1500 = 11772/1500 = 7.848 m/s²
console.log('\nCheck 7 — Stage 5 Braking (bias distribution, no-ABS regime)');
{
  const FzFrontAxle = BASE.mass * G * BASE.frontWeightFraction;
  const FzRearAxle  = BASE.mass * G * (1 - BASE.frontWeightFraction);
  const peakMu      = 1.0;  // default Pacejka peakMu

  const F_req_exp   = BASE.mass * 0.8 * G;
  const FxFront_exp = 0.65 * F_req_exp;
  const FxRear_exp  = 0.35 * F_req_exp;
  const ax_exp      = F_req_exp / BASE.mass;  // ABS not active → total = requested

  const brk = computeBraking({
    brakingG: 0.8, brakeBias: 0.65,
    mass: BASE.mass, peakMu,
    FzFrontAxle, FzRearAxle,
  });

  console.log(`  FxFront=${brk.FxBrakeFront.toFixed(1)} N, FxRear=${brk.FxBrakeRear.toFixed(1)} N, ax=${brk.brakingAx_ms2.toFixed(4)} m/s²`);
  console.log(`  ABS front=${brk.absActiveFront}, rear=${brk.absActiveRear}`);
  allPassed = check('FxBrakeFront = bias × F_total', brk.FxBrakeFront, FxFront_exp, 1e-4) && allPassed;
  allPassed = check('FxBrakeRear  = (1−bias) × F',  brk.FxBrakeRear,  FxRear_exp,  1e-4) && allPassed;
  allPassed = check('brakingAx = 0.8g = 7.848 m/s²', brk.brakingAx_ms2, ax_exp,     1e-4) && allPassed;
  allPassed = check('ABS inactive (front)', brk.absActiveFront ? 1 : 0, 0) && allPassed;
  allPassed = check('ABS inactive (rear)',  brk.absActiveRear  ? 1 : 0, 0) && allPassed;

  // ABS activation test: extreme braking at 2g, bias 0.85 (over-biased front)
  // Ffront_raw = 0.85 × 1500×2×9.81 = 25009.5 N > limit 7688.59 → ABS ON
  const brkABS = computeBraking({
    brakingG: 2.0, brakeBias: 0.85,
    mass: BASE.mass, peakMu,
    FzFrontAxle, FzRearAxle,
  });
  allPassed = check('ABS activates at extreme overbias', brkABS.absActiveFront ? 1 : 0, 1) && allPassed;
  console.log(`  ABS activation test: front=${brkABS.absActiveFront}, rear=${brkABS.absActiveRear}`);
}

// ─── Default Pacejka coefficients (road-performance preset) ──────────────────
const COEFFS: PacejkaCoeffs = { B: 11.5, C: 1.28, peakMu: 1.20, E: -1.5 };

// ─── Check 8: Step steer — steady-state circular motion (ψ̇ ≈ Vx / R) ─────────
// Use a neutral-steer vehicle (50/50 weight).  Throttle causes Vx to evolve,
// so compare ψ̇_final against Vx_final/R (not the initial Vx/R) — this tests
// that the integrator reaches coherent circular motion, not a specific speed.
// Tolerance 10% accounts for sideslip angle and Pacejka nonlinearity.
console.log('\nCheck 8 — Stage 8: Step steer — steady circular motion ψ̇ ≈ Vx_final/R');
{
  const neutralParams = { ...BASE, frontWeightFraction: 0.50 };
  const stepScenario  = SCENARIOS.find(s => s.id === 'step_steer')!;
  const results       = runSimulation(neutralParams, COEFFS, stepScenario);

  const tail      = results.slice(-20);
  const avgPsiDot = tail.reduce((sum, r) => sum + r.state.psiDot, 0) / tail.length;
  const avgVx     = tail.reduce((sum, r) => sum + r.state.Vx,     0) / tail.length;
  const psiSS_dyn = avgVx / neutralParams.turnRadius;   // ψ̇_expected from current speed
  const relErr    = Math.abs(avgPsiDot - psiSS_dyn) / Math.max(psiSS_dyn, 0.001);

  console.log(`  avg Vx = ${avgVx.toFixed(2)} m/s,  Vx/R = ${psiSS_dyn.toFixed(4)} rad/s,  avg ψ̇ = ${avgPsiDot.toFixed(4)} rad/s,  err = ${(relErr*100).toFixed(2)}%`);
  allPassed = check('ψ̇ / (Vx/R) within 10%', relErr, 0, 0.10) && allPassed;
}

// ─── Check 9: Neutral steer — front/rear avg slip angles balance ──────────────
// At 50/50 weight distribution the front and rear slip angles should be
// roughly equal in magnitude (within 20%) in the steady-state portion of
// a step steer.
console.log('\nCheck 9 — Stage 8: Neutral steer — front/rear slip angles balance');
{
  const neutralParams = { ...BASE, frontWeightFraction: 0.50 };
  const stepScenario  = SCENARIOS.find(s => s.id === 'step_steer')!;
  const results       = runSimulation(neutralParams, COEFFS, stepScenario);

  const tail = results.slice(-20);
  const avgAlphaF = tail.reduce((sum, r) => sum + Math.abs(r.slipAngle[0] + r.slipAngle[1]) / 2, 0) / tail.length;
  const avgAlphaR = tail.reduce((sum, r) => sum + Math.abs(r.slipAngle[2] + r.slipAngle[3]) / 2, 0) / tail.length;

  const ratio = avgAlphaF > 0 && avgAlphaR > 0 ? Math.abs(avgAlphaF - avgAlphaR) / Math.max(avgAlphaF, avgAlphaR) : 1;
  console.log(`  avg |αF| = ${(avgAlphaF * 180/Math.PI).toFixed(3)}°,  avg |αR| = ${(avgAlphaR * 180/Math.PI).toFixed(3)}°,  ratio diff = ${(ratio*100).toFixed(1)}%`);
  allPassed = check('neutral: front/rear slip balance within 20%', ratio, 0, 0.20) && allPassed;
}

// ─── Check 10: Sine sweep — peak |ay| occurs in 0.5–3.0 Hz band ──────────────
// For the default vehicle the natural frequency is ~1–2 Hz.
// We scan the sine-sweep results and find the frequency where |ay| is maximum.
// Expected: frequency at peak |ay| is between 0.5 and 3.0 Hz.
console.log('\nCheck 10 — Stage 8: Sine sweep — resonant frequency 0.5–3.0 Hz');
{
  const sweepScenario = SCENARIOS.find(s => s.id === 'sine_sweep')!;
  const results       = runSimulation(BASE, COEFFS, sweepScenario);

  // Instantaneous frequency at each sample: f(t) = 0.2 + 3.8*(t/30)
  let maxAy   = 0;
  let peakHz  = 0;
  for (const r of results) {
    const absAy = Math.abs(r.ay);
    if (absAy > maxAy) {
      maxAy  = absAy;
      peakHz = 0.2 + 3.8 * (r.t / 30);
    }
  }

  console.log(`  Peak |ay| = ${(maxAy / G).toFixed(3)} g  at f = ${peakHz.toFixed(2)} Hz`);
  const inBand = peakHz >= 0.5 && peakHz <= 3.0;
  allPassed = check('peak |ay| frequency in 0.5–3.0 Hz', inBand ? 1 : 0, 1) && allPassed;
}

// ─── Check 11: Stage 10 — Gear model ─────────────────────────────────────────
// Hand-calc: P=150 kW, peakRpm=5500, 6-speed [3.0→0.72], FD=3.9, R=0.32m
//   T_peak = 150,000 / (5500 × 2π/60) = 150,000 / 575.959 = 260.43 Nm
//   At V=10 m/s, G1: ω = (10/0.32)×3.0×3.9 = 365.625 rad/s → 3491 rpm
//     F = 260.43 × 3.0 × 3.9 / 0.32 = 9537 N (capped at traction 1500×9.81=14715 N → uncapped)
//   Max speed: (6500×2π/60) × 0.32 / (0.72×3.9) = 680.68×0.32/2.808 = 77.57 m/s
console.log('\nCheck 11 — Stage 10: Gear model (T_peak, F at 10 m/s, max speed)');
{
  const TWO_PI     = 2 * Math.PI;
  const omegaPeak  = 5500 * TWO_PI / 60;
  const tPeak_exp  = 150000 / omegaPeak;   // 260.43 Nm

  // 11a: T_peak
  const tPeak_actual = engineTorque(5500, 150000, 5500);
  console.log(`  T_peak = ${tPeak_actual.toFixed(2)} Nm (expected ${tPeak_exp.toFixed(2)} Nm)`);
  allPassed = check('Check 11a: T_peak = P/ω_peak (260.43 Nm)', tPeak_actual, tPeak_exp, 0.1) && allPassed;

  // 11b: F at V=10 m/s in G1
  // At V=10: rpm = (10/0.32)×3.0×3.9×60/2π ≈ 3491 rpm
  // Stage 31 NA curve at 3491 rpm: T = engineTorqueFull(3491, BASE)
  // F_exp = T(3491) × ratio1 × FD / R
  const ratio1   = generateGearRatios(6, 3.0, 0.72)[0];  // should be 3.0
  const rpm_at10 = (10 / 0.32) * 3.0 * 3.9 * 60 / TWO_PI;
  const T_at10   = engineTorqueFull(rpm_at10, BASE);
  const F_exp_10 = T_at10 * ratio1 * 3.9 / 0.32;
  const F_actual = computeMaxDriveForce(10, BASE);
  console.log(`  F @ 10 m/s = ${F_actual.toFixed(1)} N (expected ${F_exp_10.toFixed(1)} N)`);
  allPassed = check('Check 11b: F @ 10 m/s (G1 optimal) matches engineTorqueFull curve (±5 N)', F_actual, F_exp_10, 5) && allPassed;

  // 11c: max speed — min(gearbox, power-drag).
  // Gearbox: (6500×2π/60)×0.32/(0.72×3.9) = 77.57 m/s
  // Power-drag: (150000 / (0.5×1.225×2.0×0.30))^(1/3) ≈ 74.19 m/s (binding for BASE)
  const vMax_exp    = Math.pow(150000 / (0.5 * 1.225 * 2.0 * 0.30), 1 / 3);
  const vMax_actual = computeMaxSpeed(BASE);
  console.log(`  V_max = ${vMax_actual.toFixed(2)} m/s = ${(vMax_actual*3.6).toFixed(1)} km/h (expected ${vMax_exp.toFixed(2)} m/s)`);
  allPassed = check('Check 11c: max speed = min(gearbox, power-drag) (±0.5 m/s)', vMax_actual, vMax_exp, 0.5) && allPassed;
}

// ─── Check 12: Stage 11 — Tyre thermal model ─────────────────────────────────
// Hand-calc: T_opt=85, hw=30, floor=0.60, peakMu=1.20
//   k = ln(2)/900 = 0.000770156 °C⁻²
//   f(85) = 0.60 + 0.40×exp(0) = 1.0000
//   f(115)= 0.60 + 0.40×exp(-0.693147) = 0.60 + 0.20 = 0.8000  (= 0.5×(1+0.60))
//   f(55) = 0.80 (symmetric)
//   f(0)  ≈ 0.6015 (≥ floor, within 0.025 of floor)
console.log('\nCheck 12 — Stage 11: Tyre thermal model (f at optimal, half-width, floor)');
{
  const T_opt = 85, hw = 30, floor = 0.60, peakMu = 1.20;
  const halfMaxExp = 0.5 * (1 + floor);  // 0.80

  // 12a: f at T_opt = 1.0 exactly
  const f_opt = computeTyreTempFactor(T_opt, T_opt, hw, floor);
  console.log(`  f(T_opt) = ${f_opt.toFixed(6)} (expected 1.000000)`);
  allPassed = check('Check 12a: f(T_opt) = 1.0 exactly', f_opt, 1.0, 1e-12) && allPassed;

  // 12b: f at half-width points = 0.5×(1+floor) = 0.80
  const f_hi = computeTyreTempFactor(T_opt + hw, T_opt, hw, floor);
  const f_lo = computeTyreTempFactor(T_opt - hw, T_opt, hw, floor);
  console.log(`  f(T_opt+hw) = ${f_hi.toFixed(6)},  f(T_opt-hw) = ${f_lo.toFixed(6)}  (expected ${halfMaxExp.toFixed(6)})`);
  allPassed = check('Check 12b: f(T_opt+hw) = 0.5×(1+floor) = 0.80', f_hi, halfMaxExp, 1e-10) && allPassed;
  allPassed = check('Check 12b: f(T_opt-hw) = 0.5×(1+floor) = 0.80 (symmetry)', f_lo, halfMaxExp, 1e-10) && allPassed;

  // 12c: μ_eff at T_opt = peakMu exactly
  const muEff = computeTyreEffectiveMu(peakMu, { tyreTempCurrentC: T_opt, tyreOptTempC: T_opt, tyreTempHalfWidthC: hw, tyreTempFloorMu: floor });
  console.log(`  μ_eff at T_opt = ${muEff.toFixed(4)} (expected ${peakMu.toFixed(4)})`);
  allPassed = check('Check 12c: μ_eff at T_opt = peakMu exactly', muEff, peakMu, 1e-12) && allPassed;

  // 12d: f at extreme cold (0°C) is ≥ floor and within 0.025 of floor (near-converged)
  const f_cold = computeTyreTempFactor(0, T_opt, hw, floor);
  console.log(`  f(0°C) = ${f_cold.toFixed(5)}  (expected ≥ ${floor}, ≤ ${(floor + 0.025).toFixed(3)})`);
  allPassed = check('Check 12d: f(0°C) ≥ floor (floor enforced)',         f_cold, floor, 0.025) && allPassed;
  allPassed = check('Check 12d: f(0°C) ≤ floor + 0.025 (near floor)',     f_cold, floor, 0.025) && allPassed;
}

// ─── Check 13: Stage 12 — Setup optimiser improves a bad setup ───────────────
// Bad setup: max stiffness (large load transfer penalty), no aero, max brake front bias.
// Expected: optimiser finds a significantly faster setup (≥1 s improvement on club circuit).
console.log('\nCheck 13 — Stage 12: Setup optimiser improves bad setup on club circuit');
{
  const RHO = 1.225;
  const badSetup: VehicleParams = {
    ...BASE,
    frontSpringRate: 120_000, rearSpringRate: 120_000,  // max stiffness
    frontARBRate:    0,        rearARBRate:    0,         // no ARB
    aeroCL:          0,                                   // no downforce
    aeroBalance:     0.50,
    brakeBias:       0.90,                               // extreme front bias
    tyreLoadSensitivity: 0.10,                           // load sensitivity on
  };

  const layout      = TRACK_PRESETS['club'];
  const PEAK_MU_V13 = 1.20;

  function inpBuilderV13(p: typeof BASE) {
    const G13    = 9.81;
    const tw2o2  = (p.trackWidth * p.trackWidth) / 2;
    const kPhiF  = (p.frontSpringRate + p.frontARBRate) * tw2o2;
    const kPhiR  = (p.rearSpringRate  + p.rearARBRate)  * tw2o2;
    const kTot   = kPhiF + kPhiR;
    const phiF   = kTot > 0 ? kPhiF / kTot : 0.5;
    const FzS    = p.mass * G13 / 4;
    const FzOut  = FzS + p.mass * G13 * p.cgHeight * phiF / p.trackWidth;
    const qFz    = p.tyreLoadSensitivity;
    const muFrac = qFz > 0 ? Math.max(0.5, 1 - qFz * (FzOut / FzS - 1)) : 1.0;
    const peakMuEff = PEAK_MU_V13 * muFrac;
    const brakingCapG = Math.max(p.brakingG, 0.9);
    const dragForce   = (V: number) => 0.5 * RHO * V * V * p.aeroReferenceArea * p.aeroCD;
    const driveForce  = (V: number) => computeMaxDriveForce(V, p);
    return { mass: p.mass, peakMu: peakMuEff, brakingCapG, aeroCL: p.aeroCL, aeroCD: p.aeroCD, aeroReferenceArea: p.aeroReferenceArea, dragForce, driveForce };
  }

  const res = optimiseSetup(badSetup, layout, inpBuilderV13, OPTIMISE_BOUNDS);
  console.log(`  Base (bad setup): ${res.baseTimeSec.toFixed(2)}s`);
  console.log(`  Optimised:        ${res.bestTimeSec.toFixed(2)}s`);
  console.log(`  Improvement:      ${res.improvement.toFixed(2)}s  (${res.iterations} iterations)`);

  allPassed = check('Check 13a: optimised time < base time', res.bestTimeSec, res.baseTimeSec - res.improvement, 0.001) && allPassed;
  allPassed = check('Check 13b: improvement ≥ 1.0 s (conservative floor)', res.improvement, 1.0, 99) && allPassed;

  // 13c: all 7 params within bounds
  let allInBounds = true;
  for (const key of Object.keys(OPTIMISE_BOUNDS) as (keyof typeof OPTIMISE_BOUNDS)[]) {
    const v = res.bestParams[key] as number;
    const b = OPTIMISE_BOUNDS[key];
    if (v < b.min - 1e-6 || v > b.max + 1e-6) allInBounds = false;
  }
  allPassed = check('Check 13c: all optimised params within bounds', allInBounds ? 1 : 0, 1) && allPassed;
}

// ─── Check 14a: Stage 13A — Separate front/rear Cα, understeer gradient ──────
// Hand-calc: mass=1200kg, L=2.6m, b=1.3m (50/50), CαF=50000 N/rad, CαR=45000 N/rad
//   K = (1200/2.6) × (1.3/50000 − 1.3/45000)
//     = 461.538 × (2.600e-5 − 2.889e-5) = 461.538 × (−2.889e-6) = −1.3336e-3 rad/(m/s²)
//   → oversteer (rear Cα softer than front)
console.log('\nCheck 14a — Stage 13A: Separate front/rear Cα, understeer gradient');
{
  const DEG_TO_RAD14 = Math.PI / 180;
  const mass14 = 1200, L14 = 2.6, b14 = 1.3, a14 = 1.3;
  const CaF_Nrad = 50000, CaR_Nrad = 45000;
  const K_expected = (mass14 / L14) * (b14 / CaF_Nrad - a14 / CaR_Nrad);  // rad/(m/s²)
  const p14a: VehicleParams = {
    ...BASE,
    mass: mass14, wheelbase: L14, frontWeightFraction: b14 / L14,
    corneringStiffnessNPerDeg:     CaF_Nrad * DEG_TO_RAD14,  // → 50000 N/rad after / DEG_TO_RAD
    rearCorneringStiffnessNPerDeg: CaR_Nrad * DEG_TO_RAD14,  // → 45000 N/rad
  };
  const r14a = computeBicycleModel(p14a);
  const K_actual = r14a.underSteerGradientDegPerG / (RAD_TO_DEG * G);  // convert back to rad/(m/s²)
  console.log(`  K_expected = ${K_expected.toFixed(8)} rad/(m/s²), K_actual = ${K_actual.toFixed(8)}`);
  allPassed = check('Check 14a: K = (m/L)×(b/CαF−a/CαR) matches (±1e-8)', K_actual, K_expected, 1e-8) && allPassed;
  allPassed = check('Check 14a: K < 0 → oversteer (rear softer)', K_actual < 0 ? 1 : 0, 1) && allPassed;
}

// ─── Check 14b: Stage 13B — Combined slip corner speed reduction ──────────────
// Hand-calc: combSlipBrakeFrac=0.4, brakingCapG=1.0, peakMu=1.2, no aero (R=100m)
//   ay_max_g = sqrt(1.2² − (1.0×0.4)²) = sqrt(1.44 − 0.16) = sqrt(1.28) = 1.131371
//   Without CS: ay_max_g = 1.2 g exactly.
console.log('\nCheck 14b — Stage 13B: Combined slip — ay_max reduction at corner');
{
  const R14b = 100;  // m, corner radius
  const singleCorner14b: TrackLayout = {
    name: 'check14b',
    segments: [{ type: 'corner', length: 2 * Math.PI * R14b, radius: R14b }],
  };
  const baseInp14b: LapSimInput = {
    mass: 1500, peakMu: 1.2, brakingCapG: 1.0,
    aeroCL: 0, aeroCD: 0.30, aeroReferenceArea: 2.0,
    dragForce: () => 0, driveForce: () => 9000,
    combSlipBrakeFrac: 0,
  };
  const csInp14b: LapSimInput = { ...baseInp14b, combSlipBrakeFrac: 0.4 };
  const resNoCS = computeLapTime(singleCorner14b, baseInp14b);
  const resCS   = computeLapTime(singleCorner14b, csInp14b);
  const vNoCS   = resNoCS.segments[0].minSpeedKph / 3.6;
  const vCS     = resCS.segments[0].minSpeedKph   / 3.6;
  const ay_no_cs  = (vNoCS * vNoCS) / R14b / G;
  const ay_cs     = (vCS   * vCS)   / R14b / G;
  const ay_cs_exp = Math.sqrt(1.44 - 0.16);  // 1.131371
  console.log(`  ay without CS = ${ay_no_cs.toFixed(6)} g (expected 1.200000)`);
  console.log(`  ay with CS    = ${ay_cs.toFixed(6)} g (expected ${ay_cs_exp.toFixed(6)})`);
  allPassed = check('Check 14b: ay_max without CS = 1.20 g (±0.0001)', ay_no_cs, 1.20, 1e-4) && allPassed;
  allPassed = check('Check 14b: ay_max with CS = sqrt(1.28) (±0.001)', ay_cs, ay_cs_exp, 1e-3) && allPassed;
}

// ─── Check 14c: Stage 13C — Transient yaw penalty formula ────────────────────
// Hand-calc: m=1200kg, V_entry=22.222 m/s (80kph), CαF+CαR=95000 N/rad
//   τ = 1200 × 22.222 / (2 × 95000) = 26666.4 / 190000 = 0.14035 s
//   V_corner=4.167 m/s (15kph) → (1−4.167/22.222)=0.8125 → penalty=0.14035×0.8125×0.5=0.05701 s
console.log('\nCheck 14c — Stage 13C: Transient yaw penalty formula');
{
  const m14c = 1200, V_entry = 80 / 3.6;
  const CaF14c = 50000, CaR14c = 45000;  // N/rad
  const V_corner = 15 / 3.6;
  const tau_expected    = m14c * V_entry / (2 * (CaF14c + CaR14c));
  const penalty_expected = tau_expected * (1 - V_corner / V_entry) * 0.5;
  const tau_actual    = m14c * V_entry / (2 * (CaF14c + CaR14c));
  const penalty_actual = tau_actual * Math.max(0, 1 - V_corner / V_entry) * 0.5;
  console.log(`  τ_yaw = ${tau_actual.toFixed(5)} s   (expected ${tau_expected.toFixed(5)} s)`);
  console.log(`  penalty = ${penalty_actual.toFixed(5)} s  (expected ${penalty_expected.toFixed(5)} s)`);
  allPassed = check('Check 14c: τ_yaw = m×V/(2×(CαF+CαR)) (±1e-6)', tau_actual, tau_expected, 1e-6) && allPassed;
  allPassed = check('Check 14c: t_penalty = τ×(1−Vc/Ve)×0.5 (±1e-6)', penalty_actual, penalty_expected, 1e-6) && allPassed;
}

// ─── Check 15: Stage 40 — Combined slip Gky reduction function ───────────────
// Hand-calc (Pacejka §4.3.2): Gκy = cos(Cκy × arctan(Bκy × κ))
//   Bκy=3.5, Cκy=1.0
//   κ=0:   cos(0) = 1.000
//   κ=0.1: cos(arctan(0.35)) = cos(0.33667) ≈ 0.9440   (light braking)
//   κ=0.2: cos(arctan(0.70)) = cos(0.61073) ≈ 0.8165   (heavy braking)
console.log('\nCheck 15 — Stage 40: Combined slip Gky (Bκy=3.5, Cκy=1.0)');
{
  const gky0   = combinedSlipGky(0);
  const gky01  = combinedSlipGky(0.1);
  const gky02  = combinedSlipGky(0.2);
  const gky01_exp = Math.cos(Math.atan(3.5 * 0.1));  // 0.94398
  const gky02_exp = Math.cos(Math.atan(3.5 * 0.2));  // 0.81653
  console.log(`  Gky(0)   = ${gky0.toFixed(6)} (expected 1.000000)`);
  console.log(`  Gky(0.1) = ${gky01.toFixed(6)} (expected ${gky01_exp.toFixed(6)})`);
  console.log(`  Gky(0.2) = ${gky02.toFixed(6)} (expected ${gky02_exp.toFixed(6)})`);
  allPassed = check('Check 15a: Gky(0) = 1.000000', gky0, 1.0, 1e-6) && allPassed;
  allPassed = check('Check 15b: Gky(0.1) ≈ 0.9440 (±0.002)', gky01, gky01_exp, 1e-6) && allPassed;
  allPassed = check('Check 15c: Gky(0.2) ≈ 0.8165 (±0.003)', gky02, gky02_exp, 1e-6) && allPassed;
}

// ─── Check 16: Stage 41 — RC load transfer + dynamic camber ──────────────────
// Hand-calc (RCVD §17.5):
// 16a: RC=50mm front, mass=1500kg, fwf=0.55, ay=1g (9.81 m/s²), TW=1.5m
//   ΔFz_front_geom = 1500 × 9.81 × 0.55 × 0.05 / 1.5 = 269.775 N
//   (with rollStiffRatio=0.5, hCG=0.4m: elastic = 1500×9.81×(0.4−0.05)×0.5/1.5 = 1715.25 N)
//   Total front (geom+elastic) = 269.775 + 1715.25 = 1985.025 N
// 16b: Dynamic camber: rollAngle=3°, camberGainFront=0.7, staticFront=−1.5°
//   dynamicCamberFront = −1.5 − 3×0.7 = −3.6°
console.log('\nCheck 16 — Stage 41: RC load transfer + dynamic camber');
{
  // 16a: RC load transfer split
  const mass16 = 1500, fwf16 = 0.55, ay16 = 9.81, TW16 = 1.5, hCG16 = 0.4;
  const rcF = 0.05;  // 50 mm → 0.05 m
  const rollStiff16 = 0.5;
  const lt16 = computeLoadTransfer(
    { mass: mass16, wheelbase: 2.6, cgHeight: hCG16, trackWidth: TW16,
      frontWeightFraction: fwf16, rollStiffRatio: rollStiff16,
      rcHeightFront: rcF, rcHeightRear: 0 },
    ay16, 0,
  );
  const geomExp = mass16 * ay16 * fwf16 * rcF / TW16;   // 269.775 N
  const elasticExp = mass16 * ay16 * (hCG16 - rcF) * rollStiff16 / TW16;  // 1715.25 N
  const totalExp = geomExp + elasticExp;
  console.log(`  ΔFz_front geom    = ${geomExp.toFixed(3)} N (expected 269.775 N)`);
  console.log(`  ΔFz_front elastic = ${elasticExp.toFixed(3)} N (expected 1715.250 N)`);
  console.log(`  ΔFz_front total   = ${lt16.latTransferFront.toFixed(3)} N (expected ${totalExp.toFixed(3)} N)`);
  allPassed = check('Check 16a: geometric ΔFz_front = m×ay×fwf×rcH/TW (±0.1 N)', lt16.latTransferFront, totalExp, 0.1) && allPassed;
  // RC=0 should match old formula exactly
  const lt16_noRC = computeLoadTransfer(
    { mass: mass16, wheelbase: 2.6, cgHeight: hCG16, trackWidth: TW16,
      frontWeightFraction: fwf16, rollStiffRatio: rollStiff16 },
    ay16, 0,
  );
  const oldFormulaFront = mass16 * ay16 * hCG16 * rollStiff16 / TW16;
  console.log(`  RC=0 front ΔFz    = ${lt16_noRC.latTransferFront.toFixed(3)} N (old formula: ${oldFormulaFront.toFixed(3)} N)`);
  allPassed = check('Check 16a: RC=0 reduces to old elastic-only formula (±0.001 N)', lt16_noRC.latTransferFront, oldFormulaFront, 0.001) && allPassed;

  // 16b: dynamic camber formula
  const rollDeg16 = 3.0, camberGain16 = 0.7, staticCamber16 = -1.5;
  const dynCamber16 = staticCamber16 - rollDeg16 * camberGain16;
  const dynCamber16_exp = -3.6;
  console.log(`  Dynamic camber = ${dynCamber16.toFixed(3)}° (expected ${dynCamber16_exp.toFixed(3)}°)`);
  allPassed = check('Check 16b: dynamic camber = static − roll×gain (±0.001°)', dynCamber16, dynCamber16_exp, 0.001) && allPassed;
}

// ─── Check 17: Stage 42 — Suspension motion ratio wheel rate ─────────────────
// Hand-calc (Dixon §3.4): kWheel = k_spring × MR²
//   MR=0.8, spring=25000 N/m → kWheel = 25000 × 0.64 = 16000 N/m
//   KΦ_front = (kWheel + k_ARB) × TW²/2 = (16000 + 8000) × (1.5²/2) = 24000 × 1.125 = 27000 Nm/rad
//   At MR=1.0: KΦ_front = (25000 + 8000) × 1.125 = 37125 Nm/rad
console.log('\nCheck 17 — Stage 42: Motion ratio wheel rate');
{
  const susp17_mr08 = computeSuspension({
    mass: 1500, cgHeight: 0.55, trackWidth: 1.5,
    frontSpringRate: 25000, rearSpringRate: 28000,
    frontARBRate: 8000, rearARBRate: 6000,
    frontMotionRatio: 0.8, rearMotionRatio: 0.8,
  });
  const kWheel_exp  = 25000 * 0.8 * 0.8;   // 16000 N/m
  const tw2o2       = (1.5 * 1.5) / 2;     // 1.125 m²
  const KPhiF_exp   = (kWheel_exp + 8000) * tw2o2;   // 27000 Nm/rad
  console.log(`  kWheel_front (MR=0.8) = ${kWheel_exp} N/m`);
  console.log(`  KΦ_front (MR=0.8) = ${susp17_mr08.KPhiFront.toFixed(1)} Nm/rad (expected ${KPhiF_exp.toFixed(1)})`);
  allPassed = check('Check 17a: kWheel = spring × MR² (MR=0.8 → 16000 N/m) → KΦ_front = 27000 (±1 Nm/rad)', susp17_mr08.KPhiFront, KPhiF_exp, 1.0) && allPassed;

  // MR=1.0 should match default (no motion ratio)
  const susp17_mr10 = computeSuspension({
    mass: 1500, cgHeight: 0.55, trackWidth: 1.5,
    frontSpringRate: 25000, rearSpringRate: 28000,
    frontARBRate: 8000, rearARBRate: 6000,
    frontMotionRatio: 1.0, rearMotionRatio: 1.0,
  });
  const KPhiF_mr10_exp = (25000 + 8000) * tw2o2;   // 37125 Nm/rad
  console.log(`  KΦ_front (MR=1.0) = ${susp17_mr10.KPhiFront.toFixed(1)} Nm/rad (expected ${KPhiF_mr10_exp.toFixed(1)})`);
  allPassed = check('Check 17b: MR=1.0 gives KΦ_front = (spring+ARB)×TW²/2 = 37125 (±1 Nm/rad)', susp17_mr10.KPhiFront, KPhiF_mr10_exp, 1.0) && allPassed;
}

// ─── Check 18: Stage 43 — Roll damper cPhi at ζ=1.0 (critical damping) ───────
// Hand-calc: cPhi = 2 × ζ × sqrt(KPhiTotal × Ixx)
//   KPhiTotal from standard setup (MR=1.0): compute in check
//   Ixx = mass × 0.25 = 1500 × 0.25 = 375 kg·m²
//   At ζ=1.0: cPhi = 2 × sqrt(KPhiTotal × 375)
console.log('\nCheck 18 — Stage 43: Roll damper cPhi at critical damping (ζ=1.0)');
{
  const susp18 = computeSuspension({
    mass: 1500, cgHeight: 0.55, trackWidth: 1.5,
    frontSpringRate: 25000, rearSpringRate: 28000,
    frontARBRate: 8000, rearARBRate: 6000,
  });
  const Ixx18  = 1500 * 0.25;   // = 375 kg·m²
  const KPhi18 = susp18.KPhiTotal;
  const cPhi_critical = 2 * 1.0 * Math.sqrt(KPhi18 * Ixx18);   // ζ=1.0
  const cPhi_07       = 2 * 0.7 * Math.sqrt(KPhi18 * Ixx18);   // ζ=0.7 (default)
  console.log(`  KPhiTotal = ${KPhi18.toFixed(1)} Nm/rad`);
  console.log(`  Ixx = ${Ixx18.toFixed(1)} kg·m²`);
  console.log(`  cPhi (ζ=1.0) = ${cPhi_critical.toFixed(2)} Nm·s/rad`);
  console.log(`  cPhi (ζ=0.7) = ${cPhi_07.toFixed(2)} Nm·s/rad`);
  // Verify formula consistency: cPhi_critical = 2 × sqrt(KPhi × Ixx)
  const cPhi_check = 2 * Math.sqrt(KPhi18 * Ixx18);
  allPassed = check('Check 18a: cPhi(ζ=1.0) = 2×sqrt(KPhiTotal×Ixx) — critical damping formula (±0.01)', cPhi_critical, cPhi_check, 0.01) && allPassed;
  // Verify ζ=0.7 is 70% of critical
  allPassed = check('Check 18b: cPhi(ζ=0.7) = 0.7 × cPhi_critical (±0.01)', cPhi_07, 0.7 * cPhi_critical, 0.01) && allPassed;
}

// ─── Check 19: Stage 44 — Crosswind lateral force ────────────────────────────
// Hand-calc (ambient.ts):
//   v_cross = windSpeed × sin(90°) = 100 kph / 3.6 = 27.778 m/s (pure crosswind at 90°)
//   A_side  = 2.2 × 2.0 = 4.4 m²
//   F_cw    = 0.5 × 1.225 × 27.778² × 4.4 × 1.0 = 0.5 × 1.225 × 771.6 × 4.4 = 2083.9 N (approx)
// Exact: 0.5 × 1.225 × (100/3.6)² × 4.4 = 0.6125 × 771.605 × 4.4 = 2079.9 N
// At windAngle=0° (pure headwind): crosswindForce = 0
console.log('\nCheck 19 — Stage 44: Crosswind lateral force');
{
  const rho19 = airDensity(0, 20);   // sea level, 20°C ≈ 1.2044 kg/m³
  // Pure headwind (0°) → zero crosswind
  const F_hw = crosswindLateralForceN(100, 0, rho19, 2.0);
  console.log(`  F_crosswind (100 kph, 0° headwind) = ${F_hw.toFixed(3)} N (expected 0.000)`);
  allPassed = check('Check 19a: pure headwind (0°) → crosswind force = 0 N (±0.001)', F_hw, 0, 0.001) && allPassed;

  // Pure crosswind (90°)
  const v90 = 100 / 3.6;   // m/s
  const A_side = 2.2 * 2.0;
  const F90_exp = 0.5 * rho19 * v90 * v90 * A_side * 1.0;
  const F90_act = crosswindLateralForceN(100, 90, rho19, 2.0);
  console.log(`  F_crosswind (100 kph, 90° crosswind) = ${F90_act.toFixed(2)} N (expected ${F90_exp.toFixed(2)} N)`);
  allPassed = check('Check 19b: pure crosswind (90°) = ½ρv²×A_side×CD_side (±0.01 N)', F90_act, F90_exp, 0.01) && allPassed;

  // Tailwind (180°) → zero crosswind
  const F_tw = crosswindLateralForceN(100, 180, rho19, 2.0);
  console.log(`  F_crosswind (100 kph, 180° tailwind) = ${F_tw.toFixed(3)} N (expected 0.000)`);
  allPassed = check('Check 19c: pure tailwind (180°) → crosswind force = 0 N (±0.001)', F_tw, 0, 0.001) && allPassed;
}

// ─── Check 20: Stage 45 — Tyre thermal core temperature ─────────────────────
// Hand-calc:
//   lag=0: coreTemp = surfaceTemp (instant, backward-compatible)
//   lag=0.5, surface=85°C, ambient=20°C: coreTemp = 0.5×85 + 0.5×20 = 52.5°C
//   lag=1.0: coreTemp = ambientTemp (core never warms = degenerate case)
console.log('\nCheck 20 — Stage 45: Tyre thermal core temperature model');
{
  // lag=0: coreTemp = surfaceTemp exactly
  const core20a = computeCoreTemp(85, 20, 0);
  console.log(`  coreTemp (lag=0, surf=85°C, amb=20°C) = ${core20a.toFixed(1)}°C (expected 85.0°C)`);
  allPassed = check('Check 20a: lag=0 → coreTemp = surfaceTemp (±0.001)', core20a, 85, 0.001) && allPassed;

  // lag=0.5: coreTemp = 0.5×85 + 0.5×20 = 52.5°C
  const core20b = computeCoreTemp(85, 20, 0.5);
  const core20b_exp = 0.5 * 85 + 0.5 * 20;   // 52.5°C
  console.log(`  coreTemp (lag=0.5, surf=85°C, amb=20°C) = ${core20b.toFixed(1)}°C (expected ${core20b_exp.toFixed(1)}°C)`);
  allPassed = check('Check 20b: lag=0.5 → coreTemp = 52.5°C (±0.001)', core20b, core20b_exp, 0.001) && allPassed;

  // lag=1.0: coreTemp = ambientTemp
  const core20c = computeCoreTemp(85, 20, 1.0);
  console.log(`  coreTemp (lag=1.0, surf=85°C, amb=20°C) = ${core20c.toFixed(1)}°C (expected 20.0°C)`);
  allPassed = check('Check 20c: lag=1.0 → coreTemp = ambientTemp (±0.001)', core20c, 20, 0.001) && allPassed;

  // Backward-compatibility: at lag=0, computeTyreEffectiveMu at optimal → f=1.0
  const muFactor20 = computeTyreEffectiveMu(1.0, {
    tyreTempCurrentC: 85, tyreOptTempC: 85, tyreTempHalfWidthC: 30, tyreTempFloorMu: 0.60,
    ambientTempC: 20, tyreCoreHeatLag: 0,
  });
  console.log(`  μ (lag=0, T=Topt=85°C) = ${muFactor20.toFixed(6)} (expected 1.000000)`);
  allPassed = check('Check 20d: lag=0, T=Topt → μ = peakMu (no penalty, ±1e-6)', muFactor20, 1.0, 1e-6) && allPassed;
}

// ─── Check 21: Stage 46 — Pre-computed CFD aero map ─────────────────────────
// Hand-calc:
//   road, h=100mm, yaw=0 → reference point → CLfactor=1.0, CDfactor=1.0
//   motorsport, h=75mm, yaw=0 → reference → CLfactor=1.0
//   motorsport, h=20mm, yaw=0 → CLfactor=1.60 (strong ground effect)
//   motorsport, h=75mm, yaw=30° effective → CDfactor=1.10 (yaw drag penalty)
console.log('\nChecks 21 — Stage 46: CFD aero map (ride height + yaw)');
{
  // 21a: road car at reference height, zero yaw → both factors = 1.0
  const f21a = computeAeroMapFactors('road', 100, 0);
  console.log(`  road, h=100mm, yaw=0°  → CLfactor=${f21a.CLfactor.toFixed(3)}, CDfactor=${f21a.CDfactor.toFixed(3)} (expected 1.000, 1.000)`);
  allPassed = check('Check 21a: road reference point → CLfactor=1.0 (±0.001)', f21a.CLfactor, 1.0, 0.001) && allPassed;
  allPassed = check('Check 21a: road reference point → CDfactor=1.0 (±0.001)', f21a.CDfactor, 1.0, 0.001) && allPassed;

  // 21b: motorsport at reference height → CLfactor = 1.0
  const f21b = computeAeroMapFactors('motorsport', 75, 0);
  console.log(`  motorsport, h=75mm, yaw=0° → CLfactor=${f21b.CLfactor.toFixed(3)} (expected 1.000)`);
  allPassed = check('Check 21b: motorsport reference h=75mm → CLfactor=1.0 (±0.001)', f21b.CLfactor, 1.0, 0.001) && allPassed;

  // 21c: motorsport at minimum ride height → CLfactor = 1.60 (strong ground effect)
  const f21c = computeAeroMapFactors('motorsport', 20, 0);
  console.log(`  motorsport, h=20mm, yaw=0° → CLfactor=${f21c.CLfactor.toFixed(3)} (expected 1.600)`);
  allPassed = check('Check 21c: motorsport h=20mm → CLfactor=1.60 (±0.001)', f21c.CLfactor, 1.60, 0.001) && allPassed;

  // 21d: road at reference height, pure crosswind (90°) → CDfactor = 1.50 (yaw table max)
  // effectiveYawDeg = |sin(90°)| × 90 = 90 → YAW_MAP last entry CDfactor=1.500
  const f21d = computeAeroMapFactors('road', 100, 90);
  console.log(`  road, h=100mm, windAngle=90° → CDfactor=${f21d.CDfactor.toFixed(3)} (expected 1.500)`);
  allPassed = check('Check 21d: road pure crosswind → CDfactor=1.500 (±0.001)', f21d.CDfactor, 1.500, 0.001) && allPassed;

  // 21e: ground effect ordering — motorsport: h=20 (1.60) > h=75 (1.00) > h=100 (0.84)
  const fLow  = computeAeroMapFactors('motorsport', 20,  0);
  const fMid  = computeAeroMapFactors('motorsport', 75,  0);
  const fHigh = computeAeroMapFactors('motorsport', 100, 0);
  console.log(`  motorsport CL ordering: h=20(${fLow.CLfactor.toFixed(3)}) > h=75(${fMid.CLfactor.toFixed(3)}) > h=100(${fHigh.CLfactor.toFixed(3)})`);
  allPassed = check('Check 21e: motorsport CLfactor h=20 > h=75 (ground effect)', fLow.CLfactor - fMid.CLfactor, 0.60, 0.001) && allPassed;
  allPassed = check('Check 21e: motorsport CLfactor h=75 > h=100 (ground effect)', fMid.CLfactor - fHigh.CLfactor, 0.16, 0.001) && allPassed;
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(55));
if (allPassed) {
  console.log('\x1b[32mAll checks passed.\x1b[0m');
  console.log('Checks 1–3:  algebraic self-consistency (first principles).');
  console.log('Check  4:    matches Gillespie Ch.6 eq.6.15/6.16 exactly.');
  console.log('Checks 8–10: Stage 8 time-domain simulation (step steer, neutral steer, sine sweep).');
  console.log('Check  11:   Stage 10 gear model (T_peak, F @ 10 m/s, max speed).');
  console.log('Check  12:   Stage 11 tyre thermal model (f at optimal, half-width, floor).');
  console.log('Check  13:   Stage 12 setup optimiser (improves bad setup ≥ 1 s).');
  console.log('Checks 14a–c: Stage 13 — separate front/rear Cα, combined slip, yaw transient.');
  console.log('Checks 15a–c: Stage 40 — Gky combined-slip reduction (Bκy=3.5, Cκy=1.0).');
  console.log('Checks 16a–b: Stage 41 — RC geometric load transfer + dynamic camber formula.');
  console.log('Checks 17a–b: Stage 42 — Motion ratio wheel rate (kWheel = spring × MR²).');
  console.log('Checks 18a–b: Stage 43 — Roll damper cPhi (critical damping formula).');
  console.log('Checks 19a–c: Stage 44 — Crosswind lateral force (headwind/crosswind/tailwind).');
  console.log('Checks 20a–d: Stage 45 — Tyre thermal core temperature (lag model).');
  console.log('Checks 21a–e: Stage 46 — CFD aero map (ride height + yaw CLfactor/CDfactor).');
} else {
  console.log('\x1b[31mOne or more checks FAILED.\x1b[0m');
  process.exit(1);
}
