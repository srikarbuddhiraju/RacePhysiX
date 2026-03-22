/**
 * Stage 10 — Gear model.
 *
 * Generates gear ratios (geometric progression), computes engine torque curve
 * (flat torque below peak RPM, constant power above), and selects the optimal
 * gear at a given speed to maximise wheel drive force.
 *
 * Reference: Milliken & Milliken RCVD App.B; standard transmission design.
 *
 * Validation (hand-calc, 150 kW, 5500 rpm peak, 6-speed [3.0→0.72], FD=3.9, R=0.32m):
 *   T_peak = 150,000 / (5500 × 2π/60) = 150,000 / 575.959 = 260.4 Nm
 *   At V = 10 m/s, G1: ω_eng = (10/0.32) × 3.0 × 3.9 = 365.6 rad/s → 3491 rpm
 *     F = 260.4 × 3.0 × 3.9 / 0.32 = 9536 N
 *   Max speed (top gear, redline): (6500 × 2π/60) × 0.32 / (0.72 × 3.9) = 77.6 m/s
 */

import type { VehicleParams } from './types';

const TWO_PI = 2 * Math.PI;
const G      = 9.81;

/** Generate gear ratios as a geometric progression from firstGearRatio to topGearRatio. */
export function generateGearRatios(
  gearCount:      number,
  firstGearRatio: number,
  topGearRatio:   number,
): number[] {
  if (gearCount === 1) return [firstGearRatio];
  const ratios: number[] = [];
  for (let i = 0; i < gearCount; i++) {
    ratios.push(firstGearRatio * Math.pow(topGearRatio / firstGearRatio, i / (gearCount - 1)));
  }
  return ratios;
}

/** Engine torque at given RPM: flat torque below peakRpm, constant power above. */
export function engineTorque(rpm: number, peakPowerW: number, peakRpm: number): number {
  if (rpm <= 0) return 0;
  const omegaPeak = peakRpm * TWO_PI / 60;   // rad/s at peak power
  const tPeak     = peakPowerW / omegaPeak;  // Nm — flat torque plateau
  if (rpm <= peakRpm) {
    return tPeak;
  } else {
    const omega = rpm * TWO_PI / 60;
    return peakPowerW / omega;               // constant power: T drops above peak
  }
}

/**
 * Full engine torque curve incorporating curve shape.
 * Falls back to simple flat-torque model if new params are not set.
 * Stage 31.
 */
export function engineTorqueFull(rpm: number, params: VehicleParams): number {
  const { enginePowerKW, enginePeakRpm, engineRedlineRpm } = params;
  const peakPowerW  = enginePowerKW * 1000;
  const omegaPeak   = enginePeakRpm * TWO_PI / 60;
  const T_ref       = peakPowerW / omegaPeak;   // Nm — reference from P/ω

  const T_peak      = params.engineMaxTorqueNm   ?? T_ref;
  const torquePeakRpm = params.engineTorquePeakRpm ?? enginePeakRpm;
  const curveType   = params.engineCurveType     ?? 'na';

  if (rpm <= 0) return 0;

  if (curveType === 'electric') {
    // Flat torque from 0 to peak-power RPM, then constant power
    if (rpm <= enginePeakRpm) return T_peak;
    return peakPowerW / (rpm * TWO_PI / 60);
  }

  if (curveType === 'turbo') {
    const boostRpm = params.turboBoostRpm ?? 2500;
    if (rpm < 500)      return T_peak * 0.15;
    if (rpm < boostRpm) {
      const t = (rpm - 500) / Math.max(1, boostRpm - 500);
      return T_peak * (0.15 + 0.85 * t);
    }
    if (rpm <= enginePeakRpm) return T_peak;
    return peakPowerW / (rpm * TWO_PI / 60);
  }

  // NA — bell curve: rise linearly to peak torque, fall gently to redline
  if (rpm < 500)           return T_peak * 0.20;
  if (rpm <= torquePeakRpm) {
    const t = (rpm - 500) / Math.max(1, torquePeakRpm - 500);
    return T_peak * (0.20 + 0.80 * t);
  }
  const t = (rpm - torquePeakRpm) / Math.max(1, engineRedlineRpm - torquePeakRpm);
  return T_peak * Math.max(0.68, 1.0 - 0.32 * t);
}

/**
 * Maximum wheel drive force at speed V, selecting the optimal gear (highest force).
 * Returns N, capped at 1g traction (mass × G).
 * At near-zero speed returns traction-limited force directly.
 */
export function computeMaxDriveForce(V: number, params: VehicleParams): number {
  const {
    mass,
    gearCount, firstGearRatio, topGearRatio,
    finalDriveRatio, wheelRadiusM,
    engineRedlineRpm,
  } = params;

  const tractionLimit = mass * G * 1.0;

  if (V < 0.5) return tractionLimit;   // P/V → ∞ at standstill — traction limited

  const ratios = generateGearRatios(gearCount, firstGearRatio, topGearRatio);

  let maxForce = 0;

  for (const ratio of ratios) {
    const wheelAngVel = V / wheelRadiusM;
    const engineOmega = wheelAngVel * ratio * finalDriveRatio;
    const rpm         = engineOmega * 60 / TWO_PI;

    if (rpm > engineRedlineRpm) continue;   // over redline — skip
    if (rpm < 500)              continue;   // below idle    — skip

    const T      = engineTorqueFull(rpm, params);
    const Fwheel = T * ratio * finalDriveRatio / wheelRadiusM;

    if (Fwheel > maxForce) maxForce = Fwheel;
  }

  return Math.min(maxForce, tractionLimit);
}

/**
 * Maximum vehicle speed: minimum of gearbox-limited and power-drag-limited top speed.
 *
 * 1. Gearbox: V = (redlineRpm × 2π/60) × wheelRadiusM / (topGearRatio × finalDriveRatio)
 * 2. Power-drag balance: at top speed, drive = drag → P = 0.5·ρ·A·CD·V³
 *    → V = (P / (0.5·ρ·A·CD))^(1/3)
 *
 * The gearbox limit alone is wrong for high-revving cars with tall gear ratios:
 * F1 (15000 rpm, OD 0.65, FDR 3.10) gives 265 m/s (954 km/h) — physically impossible.
 * Power-drag for F1 (800 kW, CD=1.05, A=1.50) gives 93.9 m/s (338 km/h) — correct.
 */
export function computeMaxSpeed(params: VehicleParams): number {
  // 1. Gearbox-limited top speed
  const omegaRedline = params.engineRedlineRpm * TWO_PI / 60;
  const vGearbox = omegaRedline * params.wheelRadiusM / (params.topGearRatio * params.finalDriveRatio);

  // 2. Power-drag-limited top speed
  const RHO = 1.225;
  const dragCoeff = 0.5 * RHO * params.aeroReferenceArea * params.aeroCD;
  const vPowerDrag = dragCoeff > 0
    ? Math.pow(params.enginePowerKW * 1000 / dragCoeff, 1 / 3)
    : vGearbox;

  return Math.min(vGearbox, vPowerDrag);
}
