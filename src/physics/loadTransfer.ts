/**
 * Load transfer — lateral and longitudinal.
 *
 * Lateral (cornering) — Stage 3 → 4:
 *   ΔFz_total = m × ay × hCG / TW
 *   Split front/rear by roll stiffness ratio φ_front (Stage 4).
 *   Falls back to b/L weight-fraction if rollStiffRatio not provided.
 *
 * Longitudinal (throttle/braking):
 *   ΔFz_long = m × ax × hCG / L
 *   ax > 0 = acceleration → rear gains, front loses.
 *   ax < 0 = braking      → front gains, rear loses.
 *
 * Reference: Milliken & Milliken RCVD Ch.17; Gillespie Ch.2
 */

const G = 9.81;

export interface LoadTransferInput {
  mass:                number;  // kg
  wheelbase:           number;  // m
  cgHeight:            number;  // m
  trackWidth:          number;  // m
  frontWeightFraction: number;
  rollStiffRatio?:     number;  // KΦ_front / KΦ_total (Stage 4). Defaults to b/L.
  FzBoostFront?:       number;  // N, aero downforce boost on front (Stage 6)
  FzBoostRear?:        number;  // N, aero downforce boost on rear
}

export interface LoadTransferResult {
  FzFrontAxle: number;
  FzRearAxle:  number;

  FzFL: number;
  FzFR: number;
  FzRL: number;
  FzRR: number;

  latTransferFront: number;
  latTransferRear:  number;
  longTransfer:     number;
}

export function computeLoadTransfer(
  p: LoadTransferInput,
  ay_ms2: number,
  ax_ms2: number,  // positive = acceleration, negative = braking
): LoadTransferResult {
  const {
    mass, wheelbase: L, cgHeight: hCG, trackWidth: TW,
    frontWeightFraction,
    rollStiffRatio,
    FzBoostFront = 0,
    FzBoostRear  = 0,
  } = p;

  const b = frontWeightFraction * L;
  const a = L - b;

  // Static axle loads + aero downforce boost
  const FzFront_s = mass * G * (b / L) + FzBoostFront;
  const FzRear_s  = mass * G * (a / L) + FzBoostRear;

  // Longitudinal: ax > 0 → rear gains (throttle); ax < 0 → front gains (braking)
  const longTransfer = mass * ax_ms2 * hCG / L;
  const FzFrontAxle  = Math.max(0, FzFront_s - longTransfer);
  const FzRearAxle   = Math.max(0, FzRear_s  + longTransfer);

  // Lateral: use roll stiffness ratio if available, else weight fraction b/L
  const phiFront = rollStiffRatio !== undefined ? rollStiffRatio : (b / L);
  const phiRear  = 1 - phiFront;

  const latTransferFront = mass * ay_ms2 * hCG * phiFront / TW;
  const latTransferRear  = mass * ay_ms2 * hCG * phiRear  / TW;

  const FzFL = Math.max(0, FzFrontAxle / 2 - latTransferFront);
  const FzFR = Math.max(0, FzFrontAxle / 2 + latTransferFront);
  const FzRL = Math.max(0, FzRearAxle  / 2 - latTransferRear);
  const FzRR = Math.max(0, FzRearAxle  / 2 + latTransferRear);

  return { FzFrontAxle, FzRearAxle, FzFL, FzFR, FzRL, FzRR, latTransferFront, latTransferRear, longTransfer };
}
