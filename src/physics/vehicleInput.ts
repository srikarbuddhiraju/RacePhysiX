/**
 * vehicleInput — converts VehicleParams + PacejkaCoeffs → LapSimInput.
 * Shared between LapTimePanel (lap computation) and TrackVisualiser (trace).
 */

import { computeMaxDriveForce, computeMaxSpeed } from './gearModel';
import type { VehicleParams, PacejkaCoeffs }     from './types';
import type { LapSimInput }                       from './laptime';
import { airDensity, headwindMs as computeHeadwind, crosswindLateralForceN } from './ambient';
import { diffTractionFactor, diffYawMoment, type DiffType } from './differential';

const G       = 9.81;

export function buildLapSimInput(params: VehicleParams, coeffs: PacejkaCoeffs): LapSimInput {
  const { mass, brakingG, aeroCD, aeroReferenceArea, cgHeight, trackWidth,
          tyreLoadSensitivity, corneringStiffnessNPerDeg,
          rearCorneringStiffnessNPerDeg } = params;

  const peakMu      = coeffs.peakMu;
  const brakingCapG = Math.max(brakingG, 0.9);

  const tw2o2    = (trackWidth * trackWidth) / 2;
  const kPhiF    = (params.frontSpringRate + params.frontARBRate) * tw2o2;
  const kPhiR    = (params.rearSpringRate  + params.rearARBRate)  * tw2o2;
  const kPhiTot  = kPhiF + kPhiR;
  const phiFront = kPhiTot > 0 ? kPhiF / kPhiTot : 0.5;

  const FzStatic  = mass * G / 4;
  const dFzOuter  = mass * G * cgHeight * phiFront / trackWidth;
  const FzOuter   = FzStatic + dFzOuter;
  const muFrac    = tyreLoadSensitivity > 0
    ? Math.max(0.5, 1 - tyreLoadSensitivity * (FzOuter / FzStatic - 1))
    : 1.0;
  const peakMuEff = peakMu * muFrac;

  // Stage 24: Ambient conditions — air density and wind
  const rhoAir       = airDensity(params.altitudeM ?? 0, params.ambientTempC ?? 20);
  const headWind     = computeHeadwind(params.windSpeedKph ?? 0, params.windAngleDeg ?? 0);
  const crossLatN    = crosswindLateralForceN(
    params.windSpeedKph ?? 0, params.windAngleDeg ?? 0, rhoAir, aeroReferenceArea,
  );
  // Crosswind reduces available μ for cornering (lateral force budget)
  const crosswindMuPenalty = Math.min(0.15, crossLatN / (mass * G * peakMuEff));
  const peakMuWithWind = peakMuEff * (1 - crosswindMuPenalty);

  const DEG_TO_RAD = Math.PI / 180;

  // Stage 28: Tyre pressure — contact patch area scales peakMu
  const P_NOM = 2.0;
  const pAvg = ((params.frontTyrePressureBar ?? 2.0) + (params.rearTyrePressureBar ?? 2.0)) / 2;
  const pressMuFactor = Math.pow(P_NOM / Math.max(0.5, pAvg), 0.10);
  const peakMuWithPressure = peakMuWithWind * pressMuFactor;

  // Stage 29: Ride height → aero balance shift + ground effect CL boost
  const frontH = params.frontRideHeightMm ?? 100;
  const rearH  = params.rearRideHeightMm  ?? 100;
  const wheelbaseMm = params.wheelbase * 1000;
  const rakeAngleDeg = Math.atan((rearH - frontH) / wheelbaseMm) * (180 / Math.PI);
  const effectiveAeroBalance = Math.max(0.25, Math.min(0.75,
    params.aeroBalance - 0.015 * rakeAngleDeg
  ));
  void effectiveAeroBalance; // informational — aeroBalance not in LapSimInput
  const h_min = Math.min(frontH, rearH);
  const clBoost = params.aeroCL > 2.0 ? 0.20 * Math.max(0, 1 - h_min / 80) : 0;
  const effectiveAeroCL = params.aeroCL * (1 + clBoost);

  // Stage 26: Differential model — traction efficiency and yaw moment
  const diffFactor = diffTractionFactor({
    mass, peakMu: peakMuWithWind,
    cgHeight: params.cgHeight, trackWidth: params.trackWidth,
    frontWeightFraction: params.frontWeightFraction,
    drivetrainType: params.drivetrainType,
    diffType: (params.diffType ?? 'open') as DiffType,
    lsdLockingPercent: params.lsdLockingPercent ?? 0,
  });

  const diffYawNm = diffYawMoment({
    mass, peakMu: peakMuWithWind,
    cgHeight: params.cgHeight, trackWidth: params.trackWidth,
    frontWeightFraction: params.frontWeightFraction,
    drivetrainType: params.drivetrainType,
    diffType: (params.diffType ?? 'open') as DiffType,
    lsdLockingPercent: params.lsdLockingPercent ?? 0,
  });

  return {
    mass,
    peakMu:            peakMuWithPressure,
    brakingCapG,
    aeroCL:            effectiveAeroCL,
    aeroCD,
    aeroReferenceArea,
    dragForce:         (V: number) => {
      const Veff = V + headWind;  // headwind adds to effective airspeed
      return 0.5 * rhoAir * Veff * Veff * aeroReferenceArea * aeroCD;
    },
    driveForce:        (V: number) => computeMaxDriveForce(V, params) * diffFactor,
    combSlipBrakeFrac: 0.4,
    frontCaNPerRad:    corneringStiffnessNPerDeg / DEG_TO_RAD,
    rearCaNPerRad:     (rearCorneringStiffnessNPerDeg ?? corneringStiffnessNPerDeg) / DEG_TO_RAD,
    maxVehicleSpeedMs: computeMaxSpeed(params),
    rhoAir,
    headwindMs:        headWind,
    tyreCompound:      params.tyreCompound ?? 'medium',
    driverAggression:  params.driverAggression ?? 0.5,
    diffTractionFactor: diffFactor,
    diffYawMomentNm:    diffYawNm,
    brakeDiscMassKg:    params.brakeDiscMassKg ?? 6.0,
    brakeOptTempC:      params.brakeOptTempC   ?? 400,
    brakeHalfWidthC:    params.brakeHalfWidthC ?? 200,
    brakeFloorMu:       params.brakeFloorMu    ?? 0.65,
    ambientTempC:       params.ambientTempC    ?? 20,
  };
}
