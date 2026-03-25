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
  // Stage 41 — roll centre heights [m]. Default 0 = pure elastic (reduces to old formula).
  rcHeightFront?:      number;  // m — front roll centre height above ground
  rcHeightRear?:       number;  // m — rear roll centre height above ground
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
    rcHeightFront = 0,
    rcHeightRear  = 0,
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

  // ── Lateral load transfer: geometric + elastic split (Stage 41) ───────────
  // Geometric: transferred directly through the RC linkage (bypasses springs/ARBs).
  //   ΔFz_geom_axle = Fy_axle × rcHeight / TW = mass × ay × (axleWeightFrac) × rcH / TW
  // Elastic: via body roll through springs+ARBs, using reduced moment arm (hCG − rcH).
  //   ΔFz_elastic_axle = mass × ay × (hCG − rcH) × rollStiffFrac / TW
  // When rcH = 0 → geometric = 0 → elastic = mass × ay × hCG × rollStiffFrac / TW → same as before.
  // Reference: Milliken & Milliken RCVD Ch.17 §17.5
  const phiFront = rollStiffRatio !== undefined ? rollStiffRatio : (b / L);
  const phiRear  = 1 - phiFront;

  const latTransferFrontGeom    = mass * ay_ms2 * frontWeightFraction * rcHeightFront / TW;
  const latTransferRearGeom     = mass * ay_ms2 * (1 - frontWeightFraction) * rcHeightRear / TW;
  const latTransferFrontElastic = mass * ay_ms2 * Math.max(0, hCG - rcHeightFront) * phiFront / TW;
  const latTransferRearElastic  = mass * ay_ms2 * Math.max(0, hCG - rcHeightRear)  * phiRear  / TW;

  const latTransferFront = latTransferFrontGeom + latTransferFrontElastic;
  const latTransferRear  = latTransferRearGeom  + latTransferRearElastic;

  const FzFL = Math.max(0, FzFrontAxle / 2 - latTransferFront);
  const FzFR = Math.max(0, FzFrontAxle / 2 + latTransferFront);
  const FzRL = Math.max(0, FzRearAxle  / 2 - latTransferRear);
  const FzRR = Math.max(0, FzRearAxle  / 2 + latTransferRear);

  return { FzFrontAxle, FzRearAxle, FzFL, FzFR, FzRL, FzRR, latTransferFront, latTransferRear, longTransfer };
}
