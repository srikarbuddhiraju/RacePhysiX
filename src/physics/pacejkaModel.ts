/**
 * Pacejka tyre model — Stage 3: load transfer + drivetrain + combined slip.
 *
 * Computation order:
 *  1. ay = V²/R  (fixed by scenario)
 *  2. Drivetrain pass 0 — initial Fx estimate with static Fz
 *  3. ax from Fx/mass → longitudinal load transfer
 *  4. Load transfer (lat + long) → per-corner Fz
 *  5. Drivetrain pass 1 — refined Fx + TV moment using updated Fz + slip diff
 *  6. Slip angles via solveSlipAngleTyreAxle (per-corner + friction ellipse)
 *  7. Balance, utilisation, chart data
 */

import { pacejkaFy, solveSlipAngleTyreAxle } from './pacejka';
import { computeLoadTransfer }                from './loadTransfer';
import { computeDrivetrain }                  from './drivetrain';
import type { VehicleParams, PacejkaCoeffs, PacejkaResult, TyreCurvePoint, HandlingPoint } from './types';

const G          = 9.81;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export const DEFAULT_PACEJKA_COEFFS: PacejkaCoeffs = {
  B:      10.0,
  C:      1.30,
  peakMu: 1.20,
  E:     -1.50,
};

const NEUTRAL_THRESHOLD_DEG = 0.1;

// Both-axle tyre curve using per-corner Fz (pure lateral, no Fx)
function buildCurveDataBoth(
  FzFO: number, FzFI: number,
  FzRO: number, FzRI: number,
  B: number, C: number, peakMu: number, E: number,
): TyreCurvePoint[] {
  const pts: TyreCurvePoint[] = [];
  for (let alphaDeg = -15; alphaDeg <= 15.001; alphaDeg += 0.2) {
    const alpha_rad = alphaDeg * DEG_TO_RAD;
    pts.push({
      alphaDeg:  Math.round(alphaDeg * 10) / 10,
      FyFrontKN: (pacejkaFy(alpha_rad, FzFO, B, C, peakMu, E) +
                  pacejkaFy(alpha_rad, FzFI, B, C, peakMu, E)) / 1000,
      FyRearKN:  (pacejkaFy(alpha_rad, FzRO, B, C, peakMu, E) +
                  pacejkaFy(alpha_rad, FzRI, B, C, peakMu, E)) / 1000,
    });
  }
  return pts;
}

// Handling curve — sweeps ay with fixed Fx (constant throttle)
function buildHandlingCurve(
  params: VehicleParams,
  B: number, C: number, peakMu: number, E: number,
  FxFront_fixed: number,
  FxRear_fixed:  number,
): HandlingPoint[] {
  const { mass, wheelbase: L, frontWeightFraction, cgHeight: hCG, trackWidth: TW } = params;
  const b = frontWeightFraction * L;
  const a = L - b;
  const ayLimitMs2 = peakMu * G * 0.97;
  const ax_ms2     = (FxFront_fixed + FxRear_fixed) / mass;
  const pts: HandlingPoint[] = [];

  for (let i = 0; i <= 100; i++) {
    const ay_ms2 = (i / 100) * ayLimitMs2;
    const lt = computeLoadTransfer(
      { mass, wheelbase: L, cgHeight: hCG, trackWidth: TW, frontWeightFraction },
      ay_ms2, ax_ms2,
    );
    const FyFReq = mass * ay_ms2 * (b / L);
    const FyRReq = mass * ay_ms2 * (a / L);
    const aF = solveSlipAngleTyreAxle(FyFReq, lt.FzFR, lt.FzFL, FxFront_fixed, B, C, peakMu, E);
    const aR = solveSlipAngleTyreAxle(FyRReq, lt.FzRR, lt.FzRL, FxRear_fixed,  B, C, peakMu, E);
    const steerCorrDeg = (aF - aR) * RAD_TO_DEG;
    pts.push({ ayG: Math.round(ay_ms2 / G * 1000) / 1000, steerCorrDeg: Math.round(steerCorrDeg * 1e4) / 1e4 });
  }
  return pts;
}

export function computePacejkaModel(params: VehicleParams, coeffs: PacejkaCoeffs): PacejkaResult {
  const { mass, wheelbase: L, frontWeightFraction, turnRadius: R, speedKph, cgHeight: hCG, trackWidth: TW } = params;
  const { B, C, peakMu, E } = coeffs;

  const speedMs = speedKph / 3.6;
  const b = frontWeightFraction * L;
  const a = L - b;
  const ay_ms2             = (speedMs * speedMs) / R;
  const lateralAccelerationG = ay_ms2 / G;
  const FzFront_s = mass * G * (b / L);
  const FzRear_s  = mass * G * (a / L);

  // Pass 0: drivetrain with static Fz
  const dt0 = computeDrivetrain({
    drivetrainType: params.drivetrainType, throttlePercent: params.throttlePercent,
    enginePowerKW: params.enginePowerKW, awdFrontBias: params.awdFrontBias,
    mass, speedMs, peakMu, FzFrontAxle: FzFront_s, FzRearAxle: FzRear_s,
    trackWidth: TW, slipAngleDiffDeg: 0,
  });

  // Load transfer
  const lt = computeLoadTransfer(
    { mass, wheelbase: L, cgHeight: hCG, trackWidth: TW, frontWeightFraction },
    ay_ms2, dt0.ax_ms2,
  );

  // Quick slip angle estimate for TV
  const FyFReq0 = mass * ay_ms2 * (b / L);
  const FyRReq0 = mass * ay_ms2 * (a / L);
  const aF0 = solveSlipAngleTyreAxle(FyFReq0, lt.FzFR, lt.FzFL, dt0.FxFront, B, C, peakMu, E);
  const aR0 = solveSlipAngleTyreAxle(FyRReq0, lt.FzRR, lt.FzRL, dt0.FxRear,  B, C, peakMu, E);
  const slipDiff0 = (aF0 - aR0) * RAD_TO_DEG;

  // Pass 1: drivetrain with updated Fz + slip diff for TV
  const dt = computeDrivetrain({
    drivetrainType: params.drivetrainType, throttlePercent: params.throttlePercent,
    enginePowerKW: params.enginePowerKW, awdFrontBias: params.awdFrontBias,
    mass, speedMs, peakMu, FzFrontAxle: lt.FzFrontAxle, FzRearAxle: lt.FzRearAxle,
    trackWidth: TW, slipAngleDiffDeg: slipDiff0,
  });

  // Final slip angles
  const FyFrontReq = mass * ay_ms2 * (b / L);
  const FyRearReq  = mass * ay_ms2 * (a / L);
  const frontSlipAngleRad = solveSlipAngleTyreAxle(FyFrontReq, lt.FzFR, lt.FzFL, dt.FxFront, B, C, peakMu, E);
  const rearSlipAngleRad  = solveSlipAngleTyreAxle(FyRearReq,  lt.FzRR, lt.FzRL, dt.FxRear,  B, C, peakMu, E);

  const frontSlipAngleDeg = frontSlipAngleRad * RAD_TO_DEG;
  const rearSlipAngleDeg  = rearSlipAngleRad  * RAD_TO_DEG;
  const slipAngleDiffDeg  = frontSlipAngleDeg - rearSlipAngleDeg;
  const balance =
    Math.abs(slipAngleDiffDeg) < NEUTRAL_THRESHOLD_DEG ? 'neutral' :
    slipAngleDiffDeg > 0 ? 'understeer' : 'oversteer';

  const frontUtilisation = FyFrontReq / Math.max(peakMu * lt.FzFrontAxle, 1);
  const rearUtilisation  = FyRearReq  / Math.max(peakMu * lt.FzRearAxle,  1);
  const frontCombinedUtil = Math.min(1, Math.hypot(
    FyFrontReq / Math.max(peakMu * lt.FzFrontAxle, 1),
    dt.FxFront / Math.max(peakMu * lt.FzFrontAxle, 1),
  ));
  const rearCombinedUtil = Math.min(1, Math.hypot(
    FyRearReq  / Math.max(peakMu * lt.FzRearAxle, 1),
    dt.FxRear  / Math.max(peakMu * lt.FzRearAxle, 1),
  ));

  const curveData     = buildCurveDataBoth(lt.FzFR, lt.FzFL, lt.FzRR, lt.FzRL, B, C, peakMu, E);
  const handlingCurve = buildHandlingCurve(params, B, C, peakMu, E, dt.FxFront, dt.FxRear);

  return {
    a, b,
    FzFrontN: lt.FzFrontAxle, FzRearN: lt.FzRearAxle,
    FzFL: lt.FzFL, FzFR: lt.FzFR, FzRL: lt.FzRL, FzRR: lt.FzRR,
    latTransferFront: lt.latTransferFront, latTransferRear: lt.latTransferRear,
    longTransfer: lt.longTransfer,
    driveForceN: dt.driveForceN, ax_ms2: dt.ax_ms2, FxFront: dt.FxFront, FxRear: dt.FxRear,
    tvYawMoment: dt.tvYawMoment,
    frontSlipAngleDeg, rearSlipAngleDeg, slipAngleDiffDeg,
    frontLateralForceN: FyFrontReq, rearLateralForceN: FyRearReq,
    lateralAccelerationG, balance,
    frontUtilisation, rearUtilisation, frontCombinedUtil, rearCombinedUtil,
    curveData, handlingCurve,
    frontOpAlphaDeg: frontSlipAngleDeg, frontOpFyKN: FyFrontReq / 1000,
    rearOpAlphaDeg: rearSlipAngleDeg,   rearOpFyKN:  FyRearReq  / 1000,
    speedMs,
  };
}
