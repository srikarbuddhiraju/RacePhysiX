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
import type { VehicleParams } from './types';

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

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(55));
if (allPassed) {
  console.log('\x1b[32mAll checks passed.\x1b[0m');
  console.log('Checks 1–3: algebraic self-consistency (first principles).');
  console.log('Check 4: matches Gillespie Ch.6 eq.6.15/6.16 exactly.');
} else {
  console.log('\x1b[31mOne or more checks FAILED.\x1b[0m');
  process.exit(1);
}
