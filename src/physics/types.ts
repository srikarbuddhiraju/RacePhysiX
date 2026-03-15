// All units SI unless noted otherwise.
// Sign conventions: SAE J670 — see docs/physics-reference/mechanics-fundamentals.md
// Reference: docs/physics-reference/tyre-pacejka.md

export type VehicleClass = 'road' | 'track' | 'motorsport';

export interface VehicleParams {
  mass: number;                      // kg
  wheelbase: number;                 // m — front axle to rear axle
  frontWeightFraction: number;       // 0–1, e.g. 0.55 = 55% on front axle
  corneringStiffnessNPerDeg: number; // N/deg, same front and rear (v0.1 simplification)
  cgHeight: number;                  // m — CG height above ground
  trackWidth: number;                // m — lateral distance L/R tyres (used in Stage 3 load transfer)
  tyreSectionWidth: number;          // m — physical tyre section width (e.g. 0.205 for 205mm), drives visual
  turnRadius: number;                // m (constant radius corner scenario)
  speedKph: number;                  // km/h
  vehicleClass: VehicleClass;        // drives car silhouette in visualisation
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

// ─── Pacejka tyre model ───────────────────────────────────────────────────────

// User-tunable Magic Formula shape coefficients.
// D is NOT exposed directly — it is computed load-sensitively from peakMu × Fz.
export interface PacejkaCoeffs {
  B:      number;  // stiffness factor [1/rad] — BCD = Cα (initial cornering stiffness)
  C:      number;  // shape factor [-]          — ~1.3 for lateral, ~1.65 for longitudinal
  peakMu: number;  // peak friction coefficient  — D = peakMu × Fz
  E:      number;  // curvature factor [-]       — governs post-peak shape, typically < 0
}

// One point on the pre-computed tyre curve sweep (used by TyreCurveChart)
export interface TyreCurvePoint {
  alphaDeg:  number;   // deg
  FyFrontKN: number;   // kN at front axle Fz
  FyRearKN:  number;   // kN at rear axle Fz
}

// One point on the pre-computed handling diagram sweep (used by HandlingDiagram)
export interface HandlingPoint {
  ayG:          number;   // g
  steerCorrDeg: number;   // δ − L/R [deg]: +ve = understeer, −ve = oversteer
}

// Full output of computePacejkaModel()
export interface PacejkaResult {
  // Geometry (same derivation as PhysicsResult)
  a: number;                      // m, CG to front axle
  b: number;                      // m, CG to rear axle

  // Per-axle normal loads (static — no load transfer in v0.1)
  FzFrontN: number;               // N
  FzRearN:  number;               // N

  // Operating-point slip angles (solved numerically from Pacejka curve inversion)
  frontSlipAngleDeg: number;      // deg
  rearSlipAngleDeg:  number;      // deg
  slipAngleDiffDeg:  number;      // αf − αr: +ve = understeer, −ve = oversteer

  // Lateral forces at operating point
  frontLateralForceN: number;     // N (required, equals Pacejka output at solved α)
  rearLateralForceN:  number;     // N

  // Lateral acceleration
  lateralAccelerationG: number;   // g

  // Balance
  balance: Balance;

  // Pre-computed chart data (generated inside computePacejkaModel, used by chart components)
  curveData:     TyreCurvePoint[];   // tyre Fy vs α sweep, −15→+15 deg, 0.2 deg step
  handlingCurve: HandlingPoint[];    // δ−L/R vs ay, 0→ay_limit, ~100 steps

  // Operating-point overlays for the tyre curve chart
  frontOpAlphaDeg: number;
  frontOpFyKN:     number;
  rearOpAlphaDeg:  number;
  rearOpFyKN:      number;

  // Tyre utilisation (0→1 fraction of peak grip used)
  frontUtilisation: number;
  rearUtilisation:  number;

  speedMs: number;                // m/s
}
