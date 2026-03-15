/**
 * Suspension roll stiffness model — Stage 4.
 *
 * Replaces the simple b/L weight-fraction lateral load transfer split
 * with a proper roll stiffness ratio based on spring rates and ARBs.
 *
 * Roll stiffness per axle:
 *   KΦ_springs = k_spring × TW² / 2          [Nm/rad, per-wheel spring rate contribution]
 *   KΦ_ARB     = k_ARB × TW² / 2             [Nm/rad, ARB as equivalent wheel-rate]
 *   KΦ_axle    = KΦ_springs + KΦ_ARB
 *
 * Roll stiffness ratio (front fraction):
 *   φ_front = KΦ_front / (KΦ_front + KΦ_rear)
 *
 * Lateral load transfer then uses φ_front / φ_rear instead of b/L:
 *   ΔFz_front = m × ay × hCG × φ_front / TW
 *   ΔFz_rear  = m × ay × hCG × φ_rear  / TW
 *
 * Roll angle (steady state):
 *   Φ_roll = m × ay × hCG / KΦ_total   [rad]
 *
 * Reference: Milliken & Milliken RCVD Ch.16 (Roll Couple Distribution)
 */

const RAD_TO_DEG = 180 / Math.PI;

export interface SuspensionInput {
  mass:              number;  // kg
  cgHeight:          number;  // m
  trackWidth:        number;  // m
  frontSpringRate:   number;  // N/m, per-wheel spring rate
  rearSpringRate:    number;  // N/m, per-wheel spring rate
  frontARBRate:      number;  // N/m, ARB as equivalent wheel rate contribution
  rearARBRate:       number;  // N/m
}

export interface SuspensionResult {
  KPhiFront:       number;  // Nm/rad, front axle roll stiffness
  KPhiRear:        number;  // Nm/rad, rear axle roll stiffness
  KPhiTotal:       number;  // Nm/rad, total
  KPhiFrontNmDeg:  number;  // Nm/deg (display)
  KPhiRearNmDeg:   number;  // Nm/deg (display)
  rollStiffRatio:  number;  // KΦ_front / KΦ_total  (0–1)
  rollAngleDeg:    number;  // deg at current ay (set separately — 0 here, applied in model)
}

export function computeSuspension(inp: SuspensionInput): SuspensionResult {
  const { trackWidth: TW, frontSpringRate, rearSpringRate, frontARBRate, rearARBRate } = inp;

  // Roll stiffness = (spring + ARB) × (TW/2)²  × 2  =  k_total × TW²/2
  // Factor of 2: two wheels; (TW/2)²: moment arm squared; divide by 2 cancels.
  const tw2over2 = (TW * TW) / 2;

  const KPhiFront = (frontSpringRate + frontARBRate) * tw2over2;
  const KPhiRear  = (rearSpringRate  + rearARBRate)  * tw2over2;
  const KPhiTotal = KPhiFront + KPhiRear;

  const rollStiffRatio = KPhiTotal > 0 ? KPhiFront / KPhiTotal : 0.5;

  return {
    KPhiFront,
    KPhiRear,
    KPhiTotal,
    KPhiFrontNmDeg: KPhiFront / RAD_TO_DEG,
    KPhiRearNmDeg:  KPhiRear  / RAD_TO_DEG,
    rollStiffRatio,
    rollAngleDeg: 0, // populated by caller once ay is known
  };
}

/** Roll angle given lateral acceleration [g] */
export function computeRollAngle(susp: SuspensionResult, mass: number, cgHeight: number, ay_ms2: number): number {
  if (susp.KPhiTotal === 0) return 0;
  return (mass * ay_ms2 * cgHeight / susp.KPhiTotal) * RAD_TO_DEG;
}
