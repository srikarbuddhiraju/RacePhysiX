/**
 * Pacejka Magic Formula — pure lateral (v0.1)
 *
 * Reference: docs/physics-reference/tyre-pacejka.md §2, §7, §8
 *
 * Limitations (v0.1):
 *  1. Pure lateral only — Fx = 0 (no braking/traction combined slip)
 *  2. Full friction circle available for Fy at all times
 *  3. B, C, E held constant with Fz — only D varies (D = peakMu × Fz, linear scaling)
 *  4. No camber thrust
 *  5. No aligning moment Mz
 */

/**
 * Compute Pacejka lateral force Fy.
 *
 * @param alpha_rad  Slip angle [rad], signed — positive α gives positive Fy
 * @param Fz         Normal load [N], must be > 0
 * @param B          Stiffness factor [1/rad] — BCD equals the cornering stiffness Cα
 * @param C          Shape factor [-] — ~1.3 for lateral force
 * @param peakMu     Peak friction coefficient [-] — D = peakMu × Fz
 * @param E          Curvature factor [-] — governs transition into saturation, typically < 0
 * @returns          Lateral force [N], same sign as alpha
 */
export function pacejkaFy(
  alpha_rad: number,
  Fz: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
): number {
  const D  = peakMu * Fz;
  const Bx = B * alpha_rad;
  return D * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))));
}

/**
 * Scan for the slip angle at which Fy peaks (ascending scan, stops after peak).
 * Returns the peak alpha in radians.
 */
export function findPeakAlpha(
  Fz: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
): number {
  const STEP = 0.002; // ~0.11 deg
  let maxFy    = 0;
  let peakAlpha = STEP;
  for (let alpha = STEP; alpha <= 0.45; alpha += STEP) {
    const Fy = pacejkaFy(alpha, Fz, B, C, peakMu, E);
    if (Fy > maxFy) { maxFy = Fy; peakAlpha = alpha; }
    else if (Fy < maxFy - 50) break; // well past peak — stop scanning
  }
  return peakAlpha;
}

/**
 * Bisection solver: find the slip angle [rad] that produces a given lateral force.
 * Assumes Fy is monotonically increasing on [0, peakAlpha].
 * If Fy_required exceeds the tyre peak, returns peakAlpha (saturated state).
 *
 * @param Fy_required  Target lateral force [N], must be ≥ 0
 */
export function solveSlipAngle(
  Fy_required: number,
  Fz: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
): number {
  const peakAlpha = findPeakAlpha(Fz, B, C, peakMu, E);
  const FyPeak    = pacejkaFy(peakAlpha, Fz, B, C, peakMu, E);

  if (Fy_required >= FyPeak) return peakAlpha; // tyre saturated

  // Bisection on [0, peakAlpha]
  let lo = 0;
  let hi = peakAlpha;
  for (let i = 0; i < 50; i++) {
    const mid   = (lo + hi) * 0.5;
    const FyMid = pacejkaFy(mid, Fz, B, C, peakMu, E);
    if (FyMid < Fy_required) lo = mid;
    else                     hi = mid;
  }
  return (lo + hi) * 0.5;
}
