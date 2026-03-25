/**
 * Suspension roll stiffness model — Stage 4 + Stage 42.
 *
 * Stage 4: roll stiffness from spring rates + ARBs.
 * Stage 42: motion ratio — wheel rate = spring rate × MR²
 *   (ARB rates already expressed as equivalent wheel rates — MR not applied to ARB)
 *
 * Roll stiffness per axle:
 *   KΦ_springs = k_spring × MR² × TW² / 2    [Nm/rad, motion-ratio-corrected]
 *   KΦ_ARB     = k_ARB × TW² / 2             [Nm/rad, ARB as equivalent wheel-rate]
 *   KΦ_axle    = KΦ_springs + KΦ_ARB
 *
 * Roll stiffness ratio (front fraction):
 *   φ_front = KΦ_front / (KΦ_front + KΦ_rear)
 *
 * Reference: Milliken & Milliken RCVD Ch.16; Dixon "Suspension Geometry and Computation" §3.4
 */

const RAD_TO_DEG = 180 / Math.PI;

export interface SuspensionInput {
  mass:              number;  // kg
  cgHeight:          number;  // m
  trackWidth:        number;  // m
  frontSpringRate:   number;  // N/m, per-wheel spring rate (at the spring, not the wheel)
  rearSpringRate:    number;  // N/m, per-wheel spring rate
  frontARBRate:      number;  // N/m, ARB as equivalent wheel rate contribution (already at wheel)
  rearARBRate:       number;  // N/m
  // Stage 42 — motion ratio (default 1.0 = direct, no leverage)
  frontMotionRatio?: number;  // wheel rate = spring rate × MR²; 1.0 = pushrod/direct
  rearMotionRatio?:  number;
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
  const { trackWidth: TW, frontSpringRate, rearSpringRate, frontARBRate, rearARBRate,
          frontMotionRatio = 1.0, rearMotionRatio = 1.0 } = inp;

  // Stage 42: wheel rate = spring rate × MR² (motion ratio squared, Dixon §3.4)
  // ARB already expressed as equivalent wheel rate — MR not applied.
  const kWheelFront = frontSpringRate * frontMotionRatio * frontMotionRatio;
  const kWheelRear  = rearSpringRate  * rearMotionRatio  * rearMotionRatio;

  // Roll stiffness = (wheel rate + ARB) × TW²/2
  const tw2over2 = (TW * TW) / 2;

  const KPhiFront = (kWheelFront + frontARBRate) * tw2over2;
  const KPhiRear  = (kWheelRear  + rearARBRate)  * tw2over2;
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
