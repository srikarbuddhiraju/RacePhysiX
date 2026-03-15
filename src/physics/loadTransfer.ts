/**
 * Load transfer — lateral and longitudinal.
 *
 * Lateral (cornering):
 *   ΔFz_total = m × ay × hCG / TW
 *   Split front/rear by static weight fraction (equal roll stiffness assumption).
 *   Inside tyre unloads, outside tyre gains.  Net AXLE load unchanged.
 *
 * Longitudinal (throttle/braking):
 *   ΔFz_long = m × ax × hCG / L
 *   Front axle LOSES load under throttle (ax > 0); GAINS under braking (ax < 0).
 *   Changes TOTAL axle load → changes peak Fy per axle.
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
}

export interface LoadTransferResult {
  // Per-axle effective loads (after longitudinal transfer)
  FzFrontAxle: number;
  FzRearAxle:  number;

  // Per-corner loads (FL = front-left = inside for a left-hand corner)
  FzFL: number;
  FzFR: number;
  FzRL: number;
  FzRR: number;

  // Transfer deltas for display
  latTransferFront: number;   // N, how much shifts to outside front tyre
  latTransferRear:  number;   // N, how much shifts to outside rear tyre
  longTransfer:     number;   // N, positive = rear gains under throttle
}

export function computeLoadTransfer(
  p: LoadTransferInput,
  ay_ms2: number,
  ax_ms2: number,
): LoadTransferResult {
  const { mass, wheelbase: L, cgHeight: hCG, trackWidth: TW, frontWeightFraction } = p;

  const b = frontWeightFraction * L;   // CG→rear axle
  const a = L - b;                     // CG→front axle

  // Static axle loads
  const FzFront_s = mass * G * (b / L);
  const FzRear_s  = mass * G * (a / L);

  // Longitudinal: ΔFz_long = m × ax × hCG / L  (positive = rear gains under throttle)
  const longTransfer = mass * ax_ms2 * hCG / L;

  const FzFrontAxle = Math.max(0, FzFront_s - longTransfer);
  const FzRearAxle  = Math.max(0, FzRear_s  + longTransfer);

  // Lateral: ΔFz_lat_front = m × ay × hCG / TW × (b/L)  (front axle share)
  //          ΔFz_lat_rear  = m × ay × hCG / TW × (a/L)  (rear axle share)
  const latTransferFront = mass * ay_ms2 * hCG / TW * (b / L);
  const latTransferRear  = mass * ay_ms2 * hCG / TW * (a / L);

  // Per-corner: inside (left for left turn) unloads, outside (right) gains
  const FzFL = Math.max(0, FzFrontAxle / 2 - latTransferFront);
  const FzFR = Math.max(0, FzFrontAxle / 2 + latTransferFront);
  const FzRL = Math.max(0, FzRearAxle  / 2 - latTransferRear);
  const FzRR = Math.max(0, FzRearAxle  / 2 + latTransferRear);

  return { FzFrontAxle, FzRearAxle, FzFL, FzFR, FzRL, FzRR, latTransferFront, latTransferRear, longTransfer };
}
