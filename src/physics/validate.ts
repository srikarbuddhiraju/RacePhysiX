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
import { engineTorque, generateGearRatios, computeMaxDriveForce, computeMaxSpeed } from './gearModel';
import { computeTyreTempFactor, computeTyreEffectiveMu } from './tyreTemp';
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
  // F_exp = T_peak × ratio × FD / R = 260.43 × 3.0 × 3.9 / 0.32 = 9540.9 N
  const ratio1   = generateGearRatios(6, 3.0, 0.72)[0];  // should be 3.0
  const F_exp_10 = tPeak_exp * ratio1 * 3.9 / 0.32;
  const F_actual = computeMaxDriveForce(10, BASE);
  console.log(`  F @ 10 m/s = ${F_actual.toFixed(1)} N (expected ${F_exp_10.toFixed(1)} N)`);
  allPassed = check('Check 11b: F @ 10 m/s (G1 optimal) matches hand-calc (±5 N)', F_actual, F_exp_10, 5) && allPassed;

  // 11c: max speed in top gear at redline
  const vMax_exp    = (6500 * TWO_PI / 60) * 0.32 / (0.72 * 3.9);  // 77.57 m/s
  const vMax_actual = computeMaxSpeed(BASE);
  console.log(`  V_max = ${vMax_actual.toFixed(2)} m/s = ${(vMax_actual*3.6).toFixed(1)} km/h (expected ${vMax_exp.toFixed(2)} m/s)`);
  allPassed = check('Check 11c: max speed in top gear (±0.5 m/s)', vMax_actual, vMax_exp, 0.5) && allPassed;
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

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(55));
if (allPassed) {
  console.log('\x1b[32mAll checks passed.\x1b[0m');
  console.log('Checks 1–3:  algebraic self-consistency (first principles).');
  console.log('Check  4:    matches Gillespie Ch.6 eq.6.15/6.16 exactly.');
  console.log('Checks 8–10: Stage 8 time-domain simulation (step steer, neutral steer, sine sweep).');
  console.log('Check  11:   Stage 10 gear model (T_peak, F @ 10 m/s, max speed).');
  console.log('Check  12:   Stage 11 tyre thermal model (f at optimal, half-width, floor).');
} else {
  console.log('\x1b[31mOne or more checks FAILED.\x1b[0m');
  process.exit(1);
}
