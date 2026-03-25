/**
 * Pacejka tyre model — Stages 3–6: load transfer, drivetrain, suspension,
 * braking, aerodynamics, combined slip.
 *
 * Computation order:
 *  1. Aero (Stage 6)         — speed-dependent ΔFz + drag
 *  2. Suspension (Stage 4)   — roll stiffness ratio φ_front
 *  3. Drive/brake (Stage 3/5) — Fx per axle, net ax_ms2
 *  4. Load transfer          — per-corner Fz using φ_front + aero boost
 *  5. Two-pass drivetrain    — TV control uses preliminary slip diff
 *  6. Slip angles + Pacejka  — friction ellipse per tyre
 *  7. Roll angle, utilisation, chart data
 */

import { pacejkaFy, solveSlipAngleTyreAxle, loadSensitiveMu } from './pacejka';
import { computeLoadTransfer }                from './loadTransfer';
import { computeDrivetrain }                  from './drivetrain';
import { computeSuspension, computeRollAngle } from './suspension';
import { computeAero }                        from './aero';
import { computeBraking }                     from './braking';
import { computeTyreEffectiveMu }             from './tyreTemp';
import { airDensity, crosswindLateralForceN } from './ambient';
import type { VehicleParams, PacejkaCoeffs, PacejkaResult, TyreCurvePoint, HandlingPoint } from './types';

const G          = 9.81;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export const DEFAULT_PACEJKA_COEFFS: PacejkaCoeffs = {
  B:      10.0,
  C:      1.30,
  peakMu: 1.20,
  E:     -1.50,
};

const NEUTRAL_THRESHOLD_DEG = 0.1;

function buildCurveDataBoth(
  FzFO: number, FzFI: number,
  FzRO: number, FzRI: number,
  B: number, C: number, peakMu: number, E: number,
  qFz: number, Fz0: number,
): TyreCurvePoint[] {
  const pts: TyreCurvePoint[] = [];
  for (let alphaDeg = -15; alphaDeg <= 15.001; alphaDeg += 0.2) {
    const alpha_rad = alphaDeg * DEG_TO_RAD;
    pts.push({
      alphaDeg:  Math.round(alphaDeg * 10) / 10,
      FyFrontKN: (pacejkaFy(alpha_rad, FzFO, B, C, peakMu, E, qFz, Fz0) +
                  pacejkaFy(alpha_rad, FzFI, B, C, peakMu, E, qFz, Fz0)) / 1000,
      FyRearKN:  (pacejkaFy(alpha_rad, FzRO, B, C, peakMu, E, qFz, Fz0) +
                  pacejkaFy(alpha_rad, FzRI, B, C, peakMu, E, qFz, Fz0)) / 1000,
    });
  }
  return pts;
}

function buildHandlingCurve(
  params: VehicleParams,
  _B: number, C: number, peakMu: number, E: number,
  FxFront_fixed: number,
  FxRear_fixed:  number,
  rollStiffRatio: number,
  FzBoostFront: number,
  FzBoostRear:  number,
  qFz: number,
  Fz0: number,
  rcHeightFront = 0,
  rcHeightRear  = 0,
): HandlingPoint[] {
  const { mass, wheelbase: L, frontWeightFraction, cgHeight: hCG, trackWidth: TW,
          corneringStiffnessNPerDeg, rearCorneringStiffnessNPerDeg } = params;
  const b = frontWeightFraction * L;
  const a = L - b;

  // Stage 13A: derive per-axle B from cornering stiffness (B = Cα / (C × peakMu × Fz0))
  // Stage 22: toe-in increases effective Cα → higher B (RCVD §2.3.3).
  // Stage 28: pressure scales Cα^0.35, scales peak μ by (p_nom/p)^0.10.
  const k_toe_hc = 0.12;
  const P_NOM_hc = 2.0;
  const pF_hc = Math.max(0.5, params.frontTyrePressureBar ?? 2.0);
  const pR_hc = Math.max(0.5, params.rearTyrePressureBar  ?? 2.0);
  const pressCαF_hc = Math.pow(pF_hc / P_NOM_hc, 0.35);
  const pressCαR_hc = Math.pow(pR_hc / P_NOM_hc, 0.35);
  const pressMuF_hc = Math.pow(P_NOM_hc / pF_hc, 0.10);
  const pressMuR_hc = Math.pow(P_NOM_hc / pR_hc, 0.10);
  const CαF_Nrad = (corneringStiffnessNPerDeg / DEG_TO_RAD) * (1 + k_toe_hc * Math.abs(params.frontToeDeg ?? 0)) * pressCαF_hc;
  const CαR_Nrad = ((rearCorneringStiffnessNPerDeg ?? corneringStiffnessNPerDeg) / DEG_TO_RAD) * (1 + k_toe_hc * Math.abs(params.rearToeDeg ?? 0)) * pressCαR_hc;
  const B_front  = CαF_Nrad / (C * (peakMu * pressMuF_hc) * Fz0);
  const B_rear   = CαR_Nrad / (C * (peakMu * pressMuR_hc) * Fz0);

  // Stage 9: limit is reduced when load sensitivity is active (μ_eff < μ₀ at high loads)
  const peakMuEff  = loadSensitiveMu(Fz0 * 1.5, Fz0, peakMu, qFz); // effective mu at ~1.5× nominal load
  const ayLimitMs2 = peakMuEff * G * 0.97;
  const ax_ms2     = (FxFront_fixed + FxRear_fixed) / mass;
  const pts: HandlingPoint[] = [];

  for (let i = 0; i <= 100; i++) {
    const ay_ms2 = (i / 100) * ayLimitMs2;
    const lt = computeLoadTransfer(
      { mass, wheelbase: L, cgHeight: hCG, trackWidth: TW, frontWeightFraction, rollStiffRatio, FzBoostFront, FzBoostRear,
        rcHeightFront, rcHeightRear },
      ay_ms2, ax_ms2,
    );
    const FyFReq = mass * ay_ms2 * (b / L);
    const FyRReq = mass * ay_ms2 * (a / L);
    const aF = solveSlipAngleTyreAxle(FyFReq, lt.FzFR, lt.FzFL, FxFront_fixed, B_front, C, peakMu, E, qFz, Fz0);
    const aR = solveSlipAngleTyreAxle(FyRReq, lt.FzRR, lt.FzRL, FxRear_fixed,  B_rear,  C, peakMu, E, qFz, Fz0);
    const steerCorrDeg = (aF - aR) * RAD_TO_DEG;
    pts.push({ ayG: Math.round(ay_ms2 / G * 1000) / 1000, steerCorrDeg: Math.round(steerCorrDeg * 1e4) / 1e4 });
  }
  return pts;
}

export function computePacejkaModel(params: VehicleParams, coeffs: PacejkaCoeffs): PacejkaResult {
  const { mass, wheelbase: L, frontWeightFraction, turnRadius: R, speedKph, cgHeight: hCG, trackWidth: TW } = params;
  const { B, C, E } = coeffs;
  // Stage 11 — apply thermal correction to peakMu before any force calculation.
  // tyreTempCurrentC = tyreOptTempC → f = 1.0 → no change. Flows through all Pacejka calls.
  const peakMu = computeTyreEffectiveMu(coeffs.peakMu, params);

  // Stage 9 — load sensitivity reference load = static corner load (mass/4 × g)
  const Fz0  = mass * G / 4;
  const qFz  = params.tyreLoadSensitivity ?? 0;

  const speedMs = speedKph / 3.6;
  const b = frontWeightFraction * L;
  const a = L - b;
  const ay_ms2           = (speedMs * speedMs) / R;
  const lateralAccelerationG = ay_ms2 / G;

  // ── Stage 6: Aero ──────────────────────────────────────────────────────────
  const aero = computeAero({
    aeroCL: params.aeroCL, aeroCD: params.aeroCD,
    aeroReferenceArea: params.aeroReferenceArea, aeroBalance: params.aeroBalance,
    speedMs,
  });

  // ── Stage 4: Suspension roll stiffness ─────────────────────────────────────
  const susp = computeSuspension({
    mass, cgHeight: hCG, trackWidth: TW,
    frontSpringRate: params.frontSpringRate, rearSpringRate: params.rearSpringRate,
    frontARBRate: params.frontARBRate, rearARBRate: params.rearARBRate,
    frontMotionRatio: params.frontMotionRatio ?? 1.0,
    rearMotionRatio:  params.rearMotionRatio  ?? 1.0,
  });

  // ── Stage 41: Roll angle + dynamic camber ───────────────────────────────────
  // Computed early (before slip angle solving) so dynamic camber can feed into
  // camber thrust reduction of the required lateral force.
  const rollAngleDeg = computeRollAngle(susp, mass, hCG, ay_ms2);
  const rcF_m  = (params.frontRollCentreHeightMm ?? 0) / 1000;
  const rcR_m  = (params.rearRollCentreHeightMm  ?? 0) / 1000;
  // Outer tyre gains negative camber during roll: dynamicCamber = static − roll × gain
  const dynamicCamberFrontDeg = (params.frontCamberDeg ?? 0) - rollAngleDeg * (params.camberGainFront ?? 0);
  const dynamicCamberRearDeg  = (params.rearCamberDeg  ?? 0) - rollAngleDeg * (params.camberGainRear  ?? 0);

  // Static loads with aero boost (used for pass-0 traction limits)
  const FzFront_s0 = mass * G * (b / L) + aero.FzBoostFront;
  const FzRear_s0  = mass * G * (a / L) + aero.FzBoostRear;

  // ── Stage 3+5: Drive / Brake — Pass 0 (static Fz for initial traction limit) ─
  const dt0 = computeDrivetrain({
    drivetrainType: params.drivetrainType, throttlePercent: params.throttlePercent,
    enginePowerKW: params.enginePowerKW, awdFrontBias: params.awdFrontBias,
    mass, speedMs, peakMu, FzFrontAxle: FzFront_s0, FzRearAxle: FzRear_s0,
    trackWidth: TW, slipAngleDiffDeg: 0,
  });

  // Braking pass 0
  const brk0 = computeBraking({
    brakingG: params.brakingG, brakeBias: params.brakeBias,
    mass, peakMu, FzFrontAxle: FzFront_s0, FzRearAxle: FzRear_s0,
  });

  // Net longitudinal acceleration (drive wins if both non-zero; physically unusual)
  const ax_ms2_0 = dt0.ax_ms2 - brk0.brakingAx_ms2;

  // ── Load transfer (pass 0) ─────────────────────────────────────────────────
  const lt0 = computeLoadTransfer(
    { mass, wheelbase: L, cgHeight: hCG, trackWidth: TW, frontWeightFraction,
      rollStiffRatio: susp.rollStiffRatio, FzBoostFront: aero.FzBoostFront, FzBoostRear: aero.FzBoostRear,
      rcHeightFront: rcF_m, rcHeightRear: rcR_m },
    ay_ms2, ax_ms2_0,
  );

  // Quick slip estimate for TV control
  const FyFReq0 = mass * ay_ms2 * (b / L);
  const FyRReq0 = mass * ay_ms2 * (a / L);
  const aF0 = solveSlipAngleTyreAxle(FyFReq0, lt0.FzFR, lt0.FzFL, dt0.FxFront, B, C, peakMu, E, qFz, Fz0);
  const aR0 = solveSlipAngleTyreAxle(FyRReq0, lt0.FzRR, lt0.FzRL, dt0.FxRear,  B, C, peakMu, E, qFz, Fz0);
  const slipDiff0 = (aF0 - aR0) * RAD_TO_DEG;

  // ── Drive Pass 1: refined Fx + TV with updated Fz + slip diff ──────────────
  const dt = computeDrivetrain({
    drivetrainType: params.drivetrainType, throttlePercent: params.throttlePercent,
    enginePowerKW: params.enginePowerKW, awdFrontBias: params.awdFrontBias,
    mass, speedMs, peakMu, FzFrontAxle: lt0.FzFrontAxle, FzRearAxle: lt0.FzRearAxle,
    trackWidth: TW, slipAngleDiffDeg: slipDiff0,
  });

  // Braking Pass 1 with updated Fz
  const brk = computeBraking({
    brakingG: params.brakingG, brakeBias: params.brakeBias,
    mass, peakMu, FzFrontAxle: lt0.FzFrontAxle, FzRearAxle: lt0.FzRearAxle,
  });
  const ax_ms2 = dt.ax_ms2 - brk.brakingAx_ms2;

  // ── Final load transfer ────────────────────────────────────────────────────
  const lt = computeLoadTransfer(
    { mass, wheelbase: L, cgHeight: hCG, trackWidth: TW, frontWeightFraction,
      rollStiffRatio: susp.rollStiffRatio, FzBoostFront: aero.FzBoostFront, FzBoostRear: aero.FzBoostRear,
      rcHeightFront: rcF_m, rcHeightRear: rcR_m },
    ay_ms2, ax_ms2,
  );

  // Combined Fx per axle: drive + brake (brake is always opposing, so subtract)
  const FxFrontNet = dt.FxFront - brk.FxBrakeFront;
  const FxRearNet  = dt.FxRear  - brk.FxBrakeRear;

  // ── Stage 44: Crosswind lateral force ─────────────────────────────────────
  // Crosswind creates an additional lateral force on the car body.
  // The tyres must provide extra lateral force to resist it (on top of centripetal).
  // F_crosswind is distributed front/rear by weight fraction (approximate — acts at CG).
  const rhoAir44   = airDensity(params.altitudeM ?? 0, params.ambientTempC ?? 20);
  const F_crosswind = crosswindLateralForceN(
    params.windSpeedKph ?? 0,
    params.windAngleDeg ?? 0,
    rhoAir44,
    params.aeroReferenceArea,
  );

  // ── Final slip angles ──────────────────────────────────────────────────────
  const FyFrontReq = mass * ay_ms2 * (b / L) + F_crosswind * (b / L);
  const FyRearReq  = mass * ay_ms2 * (a / L) + F_crosswind * (a / L);

  // Stage 22+28: subtract camber thrust from required Fy before solving slip angle.
  // Cγ = 0.05 × Cα (rad); negative camber (deg < 0) → positive thrust aids cornering.
  // Stage 28: Cα and peakMu scale with pressure.
  const DEG2RAD = Math.PI / 180;
  const P_NOM_pm = 2.0;
  const pF_pm = Math.max(0.5, params.frontTyrePressureBar ?? 2.0);
  const pR_pm = Math.max(0.5, params.rearTyrePressureBar  ?? 2.0);
  const pressCαF_pm = Math.pow(pF_pm / P_NOM_pm, 0.35);
  const pressCαR_pm = Math.pow(pR_pm / P_NOM_pm, 0.35);
  const pressMuF_pm = Math.pow(P_NOM_pm / pF_pm, 0.10);
  const pressMuR_pm = Math.pow(P_NOM_pm / pR_pm, 0.10);
  const Cα_F_eff = (params.corneringStiffnessNPerDeg / DEG2RAD) * (1 + 0.12 * Math.abs(params.frontToeDeg ?? 0)) * pressCαF_pm;
  const Cα_R_eff = ((params.rearCorneringStiffnessNPerDeg ?? params.corneringStiffnessNPerDeg) / DEG2RAD) * (1 + 0.12 * Math.abs(params.rearToeDeg ?? 0)) * pressCαR_pm;
  // Stage 41: use dynamic camber (static − roll × camberGain) for thrust calculation
  const ΔFy_F22 = -0.05 * Cα_F_eff * dynamicCamberFrontDeg * DEG2RAD;
  const ΔFy_R22 = -0.05 * Cα_R_eff * dynamicCamberRearDeg  * DEG2RAD;
  // Apply pressure-scaled B per axle and pressure-scaled peakMu for slip angle solving
  const B_front_pm = Cα_F_eff / (C * (peakMu * pressMuF_pm) * Fz0);
  const B_rear_pm  = Cα_R_eff / (C * (peakMu * pressMuR_pm) * Fz0);

  // Stage 28: use pressure-scaled B and peakMu per axle
  const frontSlipAngleRad = solveSlipAngleTyreAxle(Math.max(0, FyFrontReq - ΔFy_F22), lt.FzFR, lt.FzFL, Math.abs(FxFrontNet), B_front_pm, C, peakMu * pressMuF_pm, E, qFz, Fz0);
  const rearSlipAngleRad  = solveSlipAngleTyreAxle(Math.max(0, FyRearReq  - ΔFy_R22), lt.FzRR, lt.FzRL, Math.abs(FxRearNet),  B_rear_pm,  C, peakMu * pressMuR_pm, E, qFz, Fz0);

  const frontSlipAngleDeg = frontSlipAngleRad * RAD_TO_DEG;
  const rearSlipAngleDeg  = rearSlipAngleRad  * RAD_TO_DEG;
  const slipAngleDiffDeg  = frontSlipAngleDeg - rearSlipAngleDeg;
  const balance =
    Math.abs(slipAngleDiffDeg) < NEUTRAL_THRESHOLD_DEG ? 'neutral' :
    slipAngleDiffDeg > 0 ? 'understeer' : 'oversteer';

  // ── Utilisation ───────────────────────────────────────────────────────────
  const frontUtilisation = FyFrontReq / Math.max(peakMu * lt.FzFrontAxle, 1);
  const rearUtilisation  = FyRearReq  / Math.max(peakMu * lt.FzRearAxle,  1);
  const frontCombinedUtil = Math.min(1, Math.hypot(
    FyFrontReq        / Math.max(peakMu * lt.FzFrontAxle, 1),
    Math.abs(FxFrontNet) / Math.max(peakMu * lt.FzFrontAxle, 1),
  ));
  const rearCombinedUtil = Math.min(1, Math.hypot(
    FyRearReq         / Math.max(peakMu * lt.FzRearAxle, 1),
    Math.abs(FxRearNet)  / Math.max(peakMu * lt.FzRearAxle, 1),
  ));

  const curveData     = buildCurveDataBoth(lt.FzFR, lt.FzFL, lt.FzRR, lt.FzRL, B, C, peakMu, E, qFz, Fz0);
  const handlingCurve = buildHandlingCurve(params, B, C, peakMu, E, dt.FxFront, dt.FxRear,
    susp.rollStiffRatio, aero.FzBoostFront, aero.FzBoostRear, qFz, Fz0, rcF_m, rcR_m);

  return {
    a, b,
    FzFrontN: lt.FzFrontAxle, FzRearN: lt.FzRearAxle,
    FzFL: lt.FzFL, FzFR: lt.FzFR, FzRL: lt.FzRL, FzRR: lt.FzRR,
    latTransferFront: lt.latTransferFront, latTransferRear: lt.latTransferRear,
    longTransfer: lt.longTransfer,
    driveForceN: dt.driveForceN, ax_ms2, FxFront: dt.FxFront, FxRear: dt.FxRear,
    tvYawMoment: dt.tvYawMoment,
    frontSlipAngleDeg, rearSlipAngleDeg, slipAngleDiffDeg,
    frontLateralForceN: FyFrontReq, rearLateralForceN: FyRearReq,
    lateralAccelerationG, balance,
    frontUtilisation, rearUtilisation, frontCombinedUtil, rearCombinedUtil,
    curveData, handlingCurve,
    frontOpAlphaDeg: frontSlipAngleDeg, frontOpFyKN: FyFrontReq / 1000,
    rearOpAlphaDeg: rearSlipAngleDeg,   rearOpFyKN:  FyRearReq  / 1000,
    speedMs,
    // Stage 4 — Suspension
    rollAngleDeg,
    rollStiffFront: susp.KPhiFrontNmDeg, rollStiffRear: susp.KPhiRearNmDeg,
    rollStiffRatio: susp.rollStiffRatio,
    // Stage 5 — Braking
    FxBrakeFront: brk.FxBrakeFront, FxBrakeRear: brk.FxBrakeRear,
    absActiveFront: brk.absActiveFront, absActiveRear: brk.absActiveRear,
    // Stage 6 — Aero
    aeroDownforceN: aero.downforceN, aeroDragN: aero.dragN,
    FzAeroFront: aero.FzBoostFront, FzAeroRear: aero.FzBoostRear,
  };
}
