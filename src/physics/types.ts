// All units SI unless noted otherwise.
// Sign conventions: SAE J670 — see docs/physics-reference/mechanics-fundamentals.md
// Reference: docs/physics-reference/tyre-pacejka.md

export type VehicleClass    = 'road' | 'track' | 'motorsport';
export type DrivetrainType  = 'FWD' | 'RWD' | 'AWD' | 'AWD_TV';

export interface VehicleParams {
  mass: number;                      // kg
  wheelbase: number;                 // m — front axle to rear axle
  frontWeightFraction: number;       // 0–1, e.g. 0.55 = 55% on front axle
  corneringStiffnessNPerDeg: number; // N/deg, front axle cornering stiffness (Stage 13A: separate front/rear)
  rearCorneringStiffnessNPerDeg: number; // N/deg, rear axle cornering stiffness (Stage 13A — equal to front = symmetric)
  cgHeight: number;                  // m — CG height above ground
  trackWidth: number;                // m — lateral distance L/R tyres
  tyreSectionWidth: number;          // m — physical tyre section width (e.g. 0.205 for 205mm), drives visual
  turnRadius: number;                // m (constant radius corner scenario)
  speedKph: number;                  // km/h
  vehicleClass: VehicleClass;        // drives car silhouette in visualisation
  // ── Stage 3 ──────────────────────────────────────────────────────────────
  drivetrainType:  DrivetrainType;   // FWD / RWD / AWD / AWD_TV
  throttlePercent: number;           // 0–100  — fraction of full throttle applied
  enginePowerKW:   number;           // kW     — peak wheel power
  awdFrontBias:    number;           // 0–1    — fraction of torque to front (AWD modes only)
  // ── Stage 4 — Suspension ─────────────────────────────────────────────────
  frontSpringRate: number;           // N/m — per-wheel spring rate (ride spring)
  rearSpringRate:  number;           // N/m
  frontARBRate:    number;           // N/m — ARB as equivalent wheel-rate contribution
  rearARBRate:     number;           // N/m
  // ── Stage 5 — Braking ────────────────────────────────────────────────────
  brakingG:        number;           // g   — braking deceleration demand (0 = coasting)
  brakeBias:       number;           // 0–1 — fraction of brake force to front axle
  // ── Stage 6 — Aero ───────────────────────────────────────────────────────
  aeroCL:            number;         // downforce coeff (0 = none, 0.3 road, 3+ F1)
  aeroCD:            number;         // drag coefficient
  aeroReferenceArea: number;         // m², frontal reference area
  aeroBalance:       number;         // 0–1, fraction of downforce on front axle
  // ── Stage 9 — Tyre load sensitivity ─────────────────────────────────────
  tyreLoadSensitivity: number;       // qFz: degressive μ factor (0 = off, 0.1 typical road, 0.2 max)
  // ── Stage 11 — Tyre thermal model ───────────────────────────────────────
  tyreOptTempC:        number;       // °C — optimal tyre temperature (peak grip)
  tyreTempHalfWidthC:  number;       // °C — half-width at half-maximum (grip drops 50% at ±this from opt)
  tyreTempCurrentC:    number;       // °C — current tyre temperature (user-controlled)
  tyreTempFloorMu:     number;       // 0–1 — minimum μ fraction at extreme temperatures (e.g. 0.60)
  // ── Stage 10 — Gear model ────────────────────────────────────────────────
  gearCount:            number;      // number of forward gears (4–8)
  firstGearRatio:       number;      // 1st gear ratio (e.g. 3.0 for sports, 3.5 for road)
  topGearRatio:         number;      // top gear ratio (e.g. 0.72 for OD, 1.0 for direct)
  finalDriveRatio:      number;      // final drive ratio (e.g. 3.9)
  wheelRadiusM:         number;      // loaded tyre radius (m) — e.g. 0.32m for 225/45R17
  enginePeakRpm:        number;      // RPM at peak power (e.g. 5500)
  engineRedlineRpm:     number;      // rev limit (e.g. 6500)
  // ── Race simulation ──────────────────────────────────────────────────────────
  fuelLoadKg:              number;   // kg — fuel mass at race start (e.g. 45 for road, 2 for short sprint)
  fuelBurnRateKgPerLap:    number;   // kg/lap — fuel consumed per lap (e.g. 2.5 road, 1.7 F1)
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
  // Geometry
  a: number;                      // m, CG to front axle
  b: number;                      // m, CG to rear axle

  // ── Per-axle normal loads ────────────────────────────────────────────────
  FzFrontN: number;               // N — effective front axle load (after long. transfer)
  FzRearN:  number;               // N — effective rear axle load

  // ── Per-corner loads (Stage 3a/3b) ───────────────────────────────────────
  FzFL: number;                   // N — front-left  (inside in left-hand corner)
  FzFR: number;                   // N — front-right (outside)
  FzRL: number;                   // N — rear-left   (inside)
  FzRR: number;                   // N — rear-right  (outside)
  latTransferFront: number;       // N — lateral ΔFz on front axle (outer − static/2)
  latTransferRear:  number;       // N — lateral ΔFz on rear axle
  longTransfer:     number;       // N — longitudinal ΔFz (positive = rear gains)

  // ── Drivetrain (Stage 3c/3d) ─────────────────────────────────────────────
  driveForceN:  number;           // N — total wheel drive force
  ax_ms2:       number;           // m/s² — longitudinal acceleration
  FxFront:      number;           // N — drive force on front axle
  FxRear:       number;           // N — drive force on rear axle
  tvYawMoment:  number;           // Nm — torque-vectoring yaw moment (0 if not AWD_TV)

  // ── Operating-point slip angles ──────────────────────────────────────────
  frontSlipAngleDeg: number;      // deg
  rearSlipAngleDeg:  number;      // deg
  slipAngleDiffDeg:  number;      // αf − αr: +ve = understeer, −ve = oversteer

  // ── Lateral forces ───────────────────────────────────────────────────────
  frontLateralForceN: number;     // N
  rearLateralForceN:  number;     // N
  lateralAccelerationG: number;   // g

  // ── Balance ──────────────────────────────────────────────────────────────
  balance: Balance;

  // ── Tyre utilisation ─────────────────────────────────────────────────────
  frontUtilisation:        number;  // lateral Fy / peak Fy available
  rearUtilisation:         number;
  frontCombinedUtil:       number;  // combined √(Fx²+Fy²) / (μ×Fz) — friction circle usage
  rearCombinedUtil:        number;

  // ── Chart data ───────────────────────────────────────────────────────────
  curveData:     TyreCurvePoint[];
  handlingCurve: HandlingPoint[];
  frontOpAlphaDeg: number;
  frontOpFyKN:     number;
  rearOpAlphaDeg:  number;
  rearOpFyKN:      number;

  speedMs: number;

  // ── Stage 4 — Suspension ─────────────────────────────────────────────────
  rollAngleDeg:    number;   // deg
  rollStiffFront:  number;   // Nm/deg, front axle
  rollStiffRear:   number;   // Nm/deg, rear axle
  rollStiffRatio:  number;   // KΦ_front / KΦ_total

  // ── Stage 5 — Braking ────────────────────────────────────────────────────
  FxBrakeFront:    number;   // N
  FxBrakeRear:     number;   // N
  absActiveFront:  boolean;
  absActiveRear:   boolean;

  // ── Stage 6 — Aero ───────────────────────────────────────────────────────
  aeroDownforceN:  number;   // N total
  aeroDragN:       number;   // N
  FzAeroFront:     number;   // N extra Fz front
  FzAeroRear:      number;   // N extra Fz rear
}
