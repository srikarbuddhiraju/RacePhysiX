/**
 * Linear bicycle model — steady-state constant radius corner.
 *
 * Assumptions: no load transfer, linear tyre (Fy = Cα·α), small angles,
 * constant speed, same cornering stiffness front and rear.
 *
 * Reference: Milliken & Milliken ch.5, Gillespie ch.6
 * See docs/physics-reference/bicycle-model.md for full derivation.
 */

import type { VehicleParams, PhysicsResult, Balance } from './types';

const G = 9.81;           // m/s²
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

// Slip angle difference below this → call it neutral steer
const NEUTRAL_THRESHOLD_DEG = 0.1;

export function computeBicycleModel(params: VehicleParams): PhysicsResult {
  const {
    mass,
    wheelbase: L,
    frontWeightFraction,
    corneringStiffnessNPerDeg,
    turnRadius: R,
    speedKph,
  } = params;

  const speedMs = speedKph / 3.6;
  const Cα = corneringStiffnessNPerDeg / DEG_TO_RAD; // N/rad

  // ── Geometry ──────────────────────────────────────────────────────────────
  // Wf/W = b/L  →  b = frontWeightFraction × L
  // (front weight fraction equals b/L; see vehicle-geometry.md §2)
  const b = frontWeightFraction * L;   // m, CG to rear axle
  const a = L - b;                     // m, CG to front axle

  // ── Understeer gradient ───────────────────────────────────────────────────
  // K = (m / L²) × (b/Cαf − a/Cαr),  Cαf = Cαr = Cα
  // K > 0: understeer, K < 0: oversteer, K = 0: neutral
  const K = (mass / (L * L)) * ((b - a) / Cα); // rad/(m/s²)
  const underSteerGradientDegPerG = K * G * RAD_TO_DEG;

  // ── Lateral acceleration (circular motion) ────────────────────────────────
  const lateralAccelerationMss = (speedMs * speedMs) / R;
  const lateralAccelerationG = lateralAccelerationMss / G;

  // ── Yaw rate ──────────────────────────────────────────────────────────────
  const yawRateRadPerS = speedMs / R;

  // ── Tyre forces (moment equilibrium, steady state) ────────────────────────
  // a·Fyf = b·Fyr  and  Fyf + Fyr = m·ay
  // → Fyf = m·ay·(b/L),  Fyr = m·ay·(a/L)
  const frontLateralForceN = mass * lateralAccelerationMss * (b / L);
  const rearLateralForceN  = mass * lateralAccelerationMss * (a / L);

  // ── Slip angles (linear tyre: α = Fy / Cα) ───────────────────────────────
  const frontSlipAngleDeg = (frontLateralForceN / Cα) * RAD_TO_DEG;
  const rearSlipAngleDeg  = (rearLateralForceN  / Cα) * RAD_TO_DEG;

  // ── Steer angles (handling equation: δ = L/R + K·ay) ─────────────────────
  const kinematicSteerAngleDeg = (L / R) * RAD_TO_DEG;
  const dynamicCorrectionDeg   = K * lateralAccelerationMss * RAD_TO_DEG;
  const totalSteerAngleDeg     = kinematicSteerAngleDeg + dynamicCorrectionDeg;

  // ── Balance ───────────────────────────────────────────────────────────────
  // αf − αr > 0: front slips more → understeer
  // αf − αr < 0: rear slips more  → oversteer
  const slipAngleDiffDeg = frontSlipAngleDeg - rearSlipAngleDeg;

  let balance: Balance;
  if (Math.abs(slipAngleDiffDeg) < NEUTRAL_THRESHOLD_DEG) {
    balance = 'neutral';
  } else {
    balance = slipAngleDiffDeg > 0 ? 'understeer' : 'oversteer';
  }

  return {
    a,
    b,
    underSteerGradientDegPerG,
    lateralAccelerationG,
    yawRateRadPerS,
    frontLateralForceN,
    rearLateralForceN,
    frontSlipAngleDeg,
    rearSlipAngleDeg,
    kinematicSteerAngleDeg,
    dynamicCorrectionDeg,
    totalSteerAngleDeg,
    balance,
    slipAngleDiffDeg,
    speedMs,
  };
}
