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
    rearCorneringStiffnessNPerDeg,
    turnRadius: R,
    speedKph,
  } = params;

  const speedMs = speedKph / 3.6;
  const CαF_base = corneringStiffnessNPerDeg / DEG_TO_RAD;  // N/rad, front axle (Stage 13A)
  const CαR_base = ((rearCorneringStiffnessNPerDeg ?? corneringStiffnessNPerDeg)) / DEG_TO_RAD;  // N/rad, rear axle

  // ── Stage 22: Camber + Toe ────────────────────────────────────────────────
  // Toe-in pre-loads the tyre contact patch → increased effective cornering stiffness.
  // Reference: RCVD §2.3.3; k_toe = 0.12 → each 1° toe ≈ +12% effective Cα.
  const k_toe = 0.12;
  const CαF = CαF_base * (1 + k_toe * Math.abs(params.frontToeDeg ?? 0));
  const CαR = CαR_base * (1 + k_toe * Math.abs(params.rearToeDeg  ?? 0));

  // Camber thrust: Fy_γ = Cγ × γ, where Cγ = 0.05 × Cα (RCVD §2.3.5; typical radial racing tyre).
  // Negative setup camber (γ < 0) → camber thrust aids lateral force → reduces required slip angle.
  // Sign: ΔFy = -k_camber × Cα × camberDeg × DEG_TO_RAD  (negative camber → positive thrust in corner direction)
  const k_camber = 0.05;
  const ΔFy_F = -k_camber * CαF * (params.frontCamberDeg ?? 0) * DEG_TO_RAD;
  const ΔFy_R = -k_camber * CαR * (params.rearCamberDeg  ?? 0) * DEG_TO_RAD;

  // ── Geometry ──────────────────────────────────────────────────────────────
  // Wf/W = b/L  →  b = frontWeightFraction × L
  // (front weight fraction equals b/L; see vehicle-geometry.md §2)
  const b = frontWeightFraction * L;   // m, CG to rear axle
  const a = L - b;                     // m, CG to front axle

  // ── Understeer gradient ───────────────────────────────────────────────────
  // Gillespie eq.6.15: K = (m/L) × (b/CαF − a/CαR)  [rad/(m/s²)]
  // K > 0: understeer, K < 0: oversteer, K = 0: neutral
  // Stage 13A: separate front/rear Cα. With equal Cα: reduces to (m/L)×(b−a)/Cα.
  const K = (mass / L) * (b / CαF - a / CαR); // rad/(m/s²)
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

  // ── Slip angles (linear tyre: α = (Fy − Fy_camber) / Cα_eff) ────────────
  // Stage 13A: use per-axle stiffness. Stage 22: subtract camber thrust from required Fy.
  const frontSlipAngleDeg = ((frontLateralForceN - ΔFy_F) / CαF) * RAD_TO_DEG;
  const rearSlipAngleDeg  = ((rearLateralForceN  - ΔFy_R) / CαR) * RAD_TO_DEG;

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
