/**
 * Braking model — Stage 5.
 *
 * Computes brake force distribution across front/rear axles,
 * applies ideal ABS (clip at tyre friction limit × Fz), and
 * returns net longitudinal deceleration.
 *
 * Brake force distribution:
 *   F_brake_total = m × brakingG × g          [N]
 *   F_brake_front = brakeBias × F_brake_total
 *   F_brake_rear  = (1 − brakeBias) × F_brake_total
 *
 * Ideal ABS: cap each axle at peakMu × FzAxle (no wheel lock).
 *   The peak friction coefficient is the same as the tyre's lateral peakMu
 *   (isotropic friction circle assumed — same μ in all directions).
 *
 * Net ax:  ax_net = ax_drive − ax_brake  (negative = net deceleration)
 *
 * Combined braking+cornering is handled in the Pacejka friction ellipse
 * in pacejka.ts (FxBrake feeds into the same solveSlipAngleTyreAxle).
 *
 * Reference: Milliken & Milliken RCVD Ch.5; Gillespie Ch.3
 */

const G = 9.81;

export interface BrakingInput {
  brakingG:    number;  // g, requested deceleration (0 = no braking)
  brakeBias:   number;  // 0–1, fraction of brake force to front
  mass:        number;  // kg
  peakMu:      number;  // tyre peak friction coefficient
  FzFrontAxle: number;  // N, effective front axle load (after load transfer)
  FzRearAxle:  number;  // N, effective rear axle load
}

export interface BrakingResult {
  FxBrakeFront:   number;   // N, front axle brake force (≤ ABS limit)
  FxBrakeRear:    number;   // N, rear axle brake force
  brakeForceN:    number;   // N, total actual brake force
  brakingAx_ms2:  number;   // m/s², magnitude (positive number = deceleration)
  absActiveFront: boolean;  // true if ABS clipped front
  absActiveRear:  boolean;  // true if ABS clipped rear
}

export function computeBraking(inp: BrakingInput): BrakingResult {
  const { brakingG, brakeBias, mass, peakMu, FzFrontAxle, FzRearAxle } = inp;

  if (brakingG <= 0) {
    return { FxBrakeFront: 0, FxBrakeRear: 0, brakeForceN: 0, brakingAx_ms2: 0, absActiveFront: false, absActiveRear: false };
  }

  const F_requested = mass * brakingG * G;
  const FxFrontRaw  = brakeBias * F_requested;
  const FxRearRaw   = (1 - brakeBias) * F_requested;

  // Ideal ABS — clip to friction limit
  const limitFront = peakMu * FzFrontAxle * 0.95;
  const limitRear  = peakMu * FzRearAxle  * 0.95;

  const FxBrakeFront   = Math.min(FxFrontRaw, limitFront);
  const FxBrakeRear    = Math.min(FxRearRaw,  limitRear);
  const absActiveFront = FxFrontRaw > limitFront;
  const absActiveRear  = FxRearRaw  > limitRear;

  const brakeForceN   = FxBrakeFront + FxBrakeRear;
  const brakingAx_ms2 = brakeForceN / mass;

  return { FxBrakeFront, FxBrakeRear, brakeForceN, brakingAx_ms2, absActiveFront, absActiveRear };
}
