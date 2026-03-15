/**
 * Pacejka tyre model — steady-state constant radius corner.
 *
 * Uses the Magic Formula (pacejka.ts) to compute realistic slip angles and
 * lateral forces. Generates pre-computed chart data for the tyre curve and
 * handling diagram.
 *
 * Assumptions (same as bicycle model plus):
 *  - No load transfer: axle Fz fixed at static value (no lateral/longitudinal transfer)
 *  - Same B, C, peakMu, E for front and rear (v0.1 simplification)
 *  - Pure lateral cornering: no brake/traction forces
 *
 * Reference: docs/physics-reference/tyre-pacejka.md
 *            docs/physics-reference/bicycle-model.md
 */

import { pacejkaFy, solveSlipAngle } from './pacejka';
import type { VehicleParams, PacejkaCoeffs, PacejkaResult, TyreCurvePoint, HandlingPoint } from './types';

const G           = 9.81;
const RAD_TO_DEG  = 180 / Math.PI;
const DEG_TO_RAD  = Math.PI / 180;

export const DEFAULT_PACEJKA_COEFFS: PacejkaCoeffs = {
  B:      10.0,   // stiffness factor [1/rad]
  C:      1.30,   // shape factor
  peakMu: 1.20,   // peak friction coefficient — D = 1.2 × Fz (typical passenger car)
  E:     -1.50,   // curvature factor
};

// Threshold for neutral steer classification (deg)
const NEUTRAL_THRESHOLD_DEG = 0.1;

// ─── Tyre curve sweep ────────────────────────────────────────────────────────

function buildCurveData(
  FzFront: number,
  FzRear:  number,
  B: number, C: number, peakMu: number, E: number,
): TyreCurvePoint[] {
  const points: TyreCurvePoint[] = [];
  for (let alphaDeg = -15; alphaDeg <= 15.001; alphaDeg += 0.2) {
    const alpha_rad = alphaDeg * DEG_TO_RAD;
    points.push({
      alphaDeg:  Math.round(alphaDeg * 10) / 10,
      FyFrontKN: pacejkaFy(alpha_rad, FzFront, B, C, peakMu, E) / 1000,
      FyRearKN:  pacejkaFy(alpha_rad, FzRear,  B, C, peakMu, E) / 1000,
    });
  }
  return points;
}

// ─── Handling diagram sweep ──────────────────────────────────────────────────

function buildHandlingCurve(
  mass: number,
  a: number,
  b: number,
  FzFront: number,
  FzRear:  number,
  B: number, C: number, peakMu: number, E: number,
  L: number,
): HandlingPoint[] {
  const points: HandlingPoint[] = [];

  // Limit: ay at which either axle saturates = peakMu × g
  // (Both axles saturate at the same ay for equal peakMu, as static Fz scales linearly with b/L and a/L)
  const ayLimitMs2 = peakMu * G * 0.97; // stay 3% below limit for numerical safety
  const N_STEPS    = 100;

  for (let i = 0; i <= N_STEPS; i++) {
    const ay_ms2    = (i / N_STEPS) * ayLimitMs2;
    const ayG       = ay_ms2 / G;

    const FyFrontReq = mass * ay_ms2 * (b / L);  // moment equilibrium
    const FyRearReq  = mass * ay_ms2 * (a / L);

    const alphaF_rad = solveSlipAngle(FyFrontReq, FzFront, B, C, peakMu, E);
    const alphaR_rad = solveSlipAngle(FyRearReq,  FzRear,  B, C, peakMu, E);

    const steerCorrDeg = (alphaF_rad - alphaR_rad) * RAD_TO_DEG;

    points.push({ ayG: Math.round(ayG * 1000) / 1000, steerCorrDeg: Math.round(steerCorrDeg * 10000) / 10000 });
  }

  return points;
}

// ─── Main function ───────────────────────────────────────────────────────────

export function computePacejkaModel(
  params: VehicleParams,
  coeffs: PacejkaCoeffs,
): PacejkaResult {
  const {
    mass,
    wheelbase: L,
    frontWeightFraction,
    turnRadius: R,
    speedKph,
  } = params;
  const { B, C, peakMu, E } = coeffs;

  const speedMs = speedKph / 3.6;

  // ── Geometry (identical to bicycleModel.ts) ───────────────────────────────
  const b = frontWeightFraction * L;   // CG to rear axle
  const a = L - b;                     // CG to front axle

  // ── Per-axle normal loads (static, no load transfer) ─────────────────────
  const FzFrontN = mass * G * (b / L);   // front axle load [N]
  const FzRearN  = mass * G * (a / L);   // rear axle load  [N]

  // ── Lateral acceleration (circular motion) ────────────────────────────────
  const ay_ms2            = (speedMs * speedMs) / R;
  const lateralAccelerationG = ay_ms2 / G;

  // ── Required axle lateral forces (moment equilibrium) ────────────────────
  const frontLateralForceN = mass * ay_ms2 * (b / L);
  const rearLateralForceN  = mass * ay_ms2 * (a / L);

  // ── Slip angles: invert Pacejka curve ────────────────────────────────────
  const frontSlipAngleRad = solveSlipAngle(frontLateralForceN, FzFrontN, B, C, peakMu, E);
  const rearSlipAngleRad  = solveSlipAngle(rearLateralForceN,  FzRearN,  B, C, peakMu, E);

  const frontSlipAngleDeg = frontSlipAngleRad * RAD_TO_DEG;
  const rearSlipAngleDeg  = rearSlipAngleRad  * RAD_TO_DEG;
  const slipAngleDiffDeg  = frontSlipAngleDeg - rearSlipAngleDeg;

  // ── Balance ───────────────────────────────────────────────────────────────
  const balance =
    Math.abs(slipAngleDiffDeg) < NEUTRAL_THRESHOLD_DEG ? 'neutral' :
    slipAngleDiffDeg > 0 ? 'understeer' : 'oversteer';

  // ── Tyre utilisation ──────────────────────────────────────────────────────
  const frontUtilisation = frontLateralForceN / (peakMu * FzFrontN);
  const rearUtilisation  = rearLateralForceN  / (peakMu * FzRearN);

  // ── Operating-point overlays for chart ───────────────────────────────────
  const frontOpFyKN = frontLateralForceN / 1000;
  const rearOpFyKN  = rearLateralForceN  / 1000;

  // ── Pre-computed chart data ───────────────────────────────────────────────
  const curveData     = buildCurveData(FzFrontN, FzRearN, B, C, peakMu, E);
  const handlingCurve = buildHandlingCurve(mass, a, b, FzFrontN, FzRearN, B, C, peakMu, E, L);

  return {
    a, b,
    FzFrontN, FzRearN,
    frontSlipAngleDeg, rearSlipAngleDeg, slipAngleDiffDeg,
    frontLateralForceN, rearLateralForceN,
    lateralAccelerationG,
    balance,
    curveData,
    handlingCurve,
    frontOpAlphaDeg: frontSlipAngleDeg,
    frontOpFyKN,
    rearOpAlphaDeg:  rearSlipAngleDeg,
    rearOpFyKN,
    frontUtilisation,
    rearUtilisation,
    speedMs,
  };
}
