// All units SI unless noted otherwise.
// Sign conventions: SAE J670 — see docs/physics-reference/mechanics-fundamentals.md

export interface VehicleParams {
  mass: number;                      // kg
  wheelbase: number;                 // m
  frontWeightFraction: number;       // 0–1, e.g. 0.55 = 55% on front axle
  corneringStiffnessNPerDeg: number; // N/deg, same front and rear (v0.1 simplification)
  cgHeight: number;                  // m
  turnRadius: number;                // m (constant radius corner scenario)
  speedKph: number;                  // km/h
}

export type Balance = 'understeer' | 'neutral' | 'oversteer';

export interface PhysicsResult {
  // Geometry
  a: number;                          // m, CG to front axle
  b: number;                          // m, CG to rear axle

  // Understeer gradient
  underSteerGradientDegPerG: number;  // deg/g — positive = understeer, negative = oversteer

  // Lateral dynamics
  lateralAccelerationG: number;       // g
  yawRateRadPerS: number;             // rad/s

  // Tyre forces — bicycle model, one lumped force per axle
  frontLateralForceN: number;         // N
  rearLateralForceN: number;          // N

  // Slip angles (linear tyre model: α = Fy / Cα)
  frontSlipAngleDeg: number;          // degrees
  rearSlipAngleDeg: number;           // degrees

  // Steer angles (handling equation: δ = L/R + K·ay)
  kinematicSteerAngleDeg: number;     // L/R in degrees (Ackermann, geometry-only)
  dynamicCorrectionDeg: number;       // K·ay in degrees (dynamic correction)
  totalSteerAngleDeg: number;         // degrees

  // Balance
  balance: Balance;
  slipAngleDiffDeg: number;           // αf − αr, degrees: + = understeer, − = oversteer

  // Speed
  speedMs: number;                    // m/s
}
