/**
 * Drivetrain model — drive force distribution and torque vectoring.
 *
 * Computes:
 *  1. Total drive force from engine power + throttle + speed
 *  2. Distribution to axles (FWD / RWD / AWD / AWD_TV)
 *  3. Longitudinal acceleration ax
 *  4. Torque-vectoring yaw moment (AWD_TV only)
 *
 * Combined slip (friction ellipse) is applied inside the Pacejka solver,
 * not here. This module only computes Fx values.
 *
 * TV control law:
 *   tvBias ∝ slipAngleDiffDeg (understeer → bias outside rear wheel)
 *   Mz_TV = FxRear × tvBias × (trackWidth / 2)
 *
 * Reference: Milliken & Milliken RCVD Ch.2, Pacejka TVD §11
 */

import type { DrivetrainType } from './types';

const TV_GAIN    = 0.25;   // yaw-moment sensitivity to slip angle diff [−]
const TV_MAX_BIAS = 0.80;  // maximum left/right split asymmetry (80% to one side)

export interface DrivetrainInput {
  drivetrainType:  DrivetrainType;
  throttlePercent: number;   // 0–100
  enginePowerKW:   number;   // kW, peak wheel power
  awdFrontBias:    number;   // 0–1, torque fraction to front (AWD modes)
  mass:            number;   // kg
  speedMs:         number;   // m/s (must be > 0)
  peakMu:          number;   // tyre peak friction coefficient
  FzFrontAxle:     number;   // N, effective front axle load (after long. transfer step 0)
  FzRearAxle:      number;   // N, effective rear axle load
  trackWidth:      number;   // m
  slipAngleDiffDeg: number;  // αf − αr [deg], for TV control law
}

export interface DrivetrainResult {
  driveForceN: number;  // N, total drive force at wheels
  ax_ms2:      number;  // m/s², longitudinal acceleration
  FxFront:     number;  // N, drive force on front axle (≤ friction limit)
  FxRear:      number;  // N, drive force on rear axle
  tvYawMoment: number;  // Nm, TV yaw moment (+ = helps turn = reduces understeer)
}

export function computeDrivetrain(inp: DrivetrainInput): DrivetrainResult {
  const {
    drivetrainType, throttlePercent, enginePowerKW, awdFrontBias,
    mass, speedMs, peakMu, FzFrontAxle, FzRearAxle, trackWidth, slipAngleDiffDeg,
  } = inp;

  // ── Raw drive force from engine ───────────────────────────────────────────
  // F = P / V.  At very low speed cap via traction limit instead.
  const vSafe    = Math.max(speedMs, 2.0);   // avoid divide-by-zero
  const Fengine  = (enginePowerKW * 1000 * throttlePercent / 100) / vSafe;

  // ── Per-axle traction limits ──────────────────────────────────────────────
  const FxMaxFront = peakMu * FzFrontAxle;
  const FxMaxRear  = peakMu * FzRearAxle;

  // ── Distribute force to axles ─────────────────────────────────────────────
  let FxFrontRaw = 0, FxRearRaw = 0;
  switch (drivetrainType) {
    case 'FWD':
      FxFrontRaw = Fengine;
      FxRearRaw  = 0;
      break;
    case 'RWD':
      FxFrontRaw = 0;
      FxRearRaw  = Fengine;
      break;
    case 'AWD':
    case 'AWD_TV':
      FxFrontRaw = Fengine * awdFrontBias;
      FxRearRaw  = Fengine * (1 - awdFrontBias);
      break;
  }

  // Clamp each axle to its traction limit
  const FxFront = Math.min(FxFrontRaw, FxMaxFront * 0.95);
  const FxRear  = Math.min(FxRearRaw,  FxMaxRear  * 0.95);

  const driveForceN = FxFront + FxRear;
  const ax_ms2      = driveForceN / mass;

  // ── Torque vectoring (AWD_TV only) ────────────────────────────────────────
  // Positive slipAngleDiffDeg = understeer → bias torque to outside rear wheel
  // Creating a yaw moment in the same direction as the corner = helps rotation
  let tvYawMoment = 0;
  if (drivetrainType === 'AWD_TV' && FxRear > 0) {
    const tvBias = Math.max(-TV_MAX_BIAS, Math.min(TV_MAX_BIAS, slipAngleDiffDeg * TV_GAIN));
    tvYawMoment  = FxRear * tvBias * (trackWidth / 2);
  }

  return { driveForceN, ax_ms2, FxFront, FxRear, tvYawMoment };
}
