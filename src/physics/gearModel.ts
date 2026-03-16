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
 * Maximum wheel drive force at speed V, selecting the optimal gear (highest force).
 * Returns N, capped at 1g traction (mass × G).
 * At near-zero speed returns traction-limited force directly.
 */
export function computeMaxDriveForce(V: number, params: VehicleParams): number {
  const {
    mass, enginePowerKW,
    gearCount, firstGearRatio, topGearRatio,
    finalDriveRatio, wheelRadiusM,
    enginePeakRpm, engineRedlineRpm,
  } = params;

  const tractionLimit = mass * G * 1.0;

  if (V < 0.5) return tractionLimit;   // P/V → ∞ at standstill — traction limited

  const peakPowerW = enginePowerKW * 1000;
  const ratios     = generateGearRatios(gearCount, firstGearRatio, topGearRatio);

  let maxForce = 0;

  for (const ratio of ratios) {
    const wheelAngVel = V / wheelRadiusM;
    const engineOmega = wheelAngVel * ratio * finalDriveRatio;
    const rpm         = engineOmega * 60 / TWO_PI;

    if (rpm > engineRedlineRpm) continue;   // over redline — skip
    if (rpm < 500)              continue;   // below idle    — skip

    const T      = engineTorque(rpm, peakPowerW, enginePeakRpm);
    const Fwheel = T * ratio * finalDriveRatio / wheelRadiusM;

    if (Fwheel > maxForce) maxForce = Fwheel;
  }

  return Math.min(maxForce, tractionLimit);
}

/**
 * Maximum vehicle speed: redline in top gear.
 * V_max = (redlineRpm × 2π/60) × wheelRadiusM / (topGearRatio × finalDriveRatio)
 */
export function computeMaxSpeed(params: VehicleParams): number {
  const omegaRedline = params.engineRedlineRpm * TWO_PI / 60;
  return omegaRedline * params.wheelRadiusM / (params.topGearRatio * params.finalDriveRatio);
}
