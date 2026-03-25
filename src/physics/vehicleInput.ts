/**
 * vehicleInput — converts VehicleParams + PacejkaCoeffs → LapSimInput.
 * Shared between LapTimePanel (lap computation) and TrackVisualiser (trace).
 */

import { computeMaxDriveForce, computeMaxSpeed } from './gearModel';
import type { VehicleParams, PacejkaCoeffs }     from './types';
import type { LapSimInput }                       from './laptime';
import { airDensity, headwindMs as computeHeadwind, crosswindLateralForceN } from './ambient';
import { diffTractionFactor, diffYawMoment, type DiffType } from './differential';
import { computeAeroMapFactors } from './aeroMap';

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

  // Stage 29 + 46: Ride height → rake-based aero balance shift + Stage 46 CFD map CL/CD correction
  const frontH = params.frontRideHeightMm ?? 100;
  const rearH  = params.rearRideHeightMm  ?? 100;
  const wheelbaseMm = params.wheelbase * 1000;
  const rakeAngleDeg = Math.atan((rearH - frontH) / wheelbaseMm) * (180 / Math.PI);
  const effectiveAeroBalance = Math.max(0.25, Math.min(0.75,
    params.aeroBalance - 0.015 * rakeAngleDeg
  ));
  void effectiveAeroBalance; // informational — aeroBalance not in LapSimInput

  // Stage 46: CFD map replaces Stage 29 crude clBoost
  const avgRideHeightMm = (frontH + rearH) / 2;
  const aeroMap = computeAeroMapFactors(
    params.vehicleClass, avgRideHeightMm, params.windAngleDeg ?? 0,
  );
  const effectiveAeroCL = params.aeroCL * aeroMap.CLfactor;
  const effectiveAeroCD = aeroCD * aeroMap.CDfactor;

  // Stage 33: Track rubber — grip builds up on racing line across session
  const rubberLevel = params.trackRubberLevel ?? 0.5;
  const peakMuWithRubber = peakMuWithPressure * (1 + 0.15 * rubberLevel);

  // Stage 34: Wet track grip penalty — depends on compound
  const wetness = params.trackWetness ?? 0.0;
  const compound = params.tyreCompound ?? 'medium';
  let wetGripFactor: number;
  if (compound === 'wet') {
    // Full wet tyre: best at wetness 0.7–1.0, terrible when dry
    wetGripFactor = wetness < 0.3
      ? 0.55 + wetness * 0.45 / 0.3
      : 0.55 + 0.65 * Math.min(1, (wetness - 0.3) / 0.7);
    // Peak at wetness=1.0: factor ~1.05 relative to dry slick on dry track
    wetGripFactor = Math.min(1.05, wetGripFactor);
  } else if (compound === 'inter') {
    // Inter: optimal at 0.3–0.5 wetness
    const peak = Math.exp(-((wetness - 0.4) * (wetness - 0.4)) / (2 * 0.2 * 0.2));
    wetGripFactor = 0.65 + 0.45 * peak;
  } else {
    // Dry slick (soft/medium/hard): grip falls with wetness
    wetGripFactor = Math.max(0.30, 1.0 - 0.70 * wetness);
  }
  const peakMuFinal = peakMuWithRubber * wetGripFactor;

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

  // Stage 32: Traction Control
  const tcOn = params.tcEnabled ?? false;
  const tcThresh = params.tcSlipThreshold ?? 0.15;
  const drivenAxleFrac = params.drivetrainType === 'FWD'
    ? params.frontWeightFraction
    : (1 - params.frontWeightFraction);
  const Fz_driven = mass * G * drivenAxleFrac;
  // TC allows a small slip ratio above the pure friction limit for maximum acceleration
  const tc_limit_N = peakMuFinal * Fz_driven * (1 + tcThresh * 0.5);

  // Stage 35: ERS — adds electric motor power at corner exits
  const ersOn   = params.ersEnabled ?? false;
  const ersPowerW = (params.ersPowerKW ?? 0) * 1000;
  const stratMult: Record<string, number> = { full: 1.0, attack: 1.15, saving: 0.70 };
  const ersDeployMult = stratMult[params.ersDeployStrategy ?? 'full'] ?? 1.0;
  const ersEffectivePowerW = ersOn ? ersPowerW * ersDeployMult : 0;

  return {
    mass,
    peakMu:            peakMuFinal,
    brakingCapG,
    aeroCL:            effectiveAeroCL,
    aeroCD:            effectiveAeroCD,
    aeroReferenceArea,
    dragForce:         (V: number) => {
      const Veff = V + headWind;  // headwind adds to effective airspeed
      return 0.5 * rhoAir * Veff * Veff * aeroReferenceArea * effectiveAeroCD;
    },
    driveForce:        (V: number) => {
      const raw = computeMaxDriveForce(V, params) * diffFactor;
      const ersForce = (ersEffectivePowerW > 0 && V > 0.5)
        ? Math.min(ersEffectivePowerW / V, mass * G * peakMuFinal * 0.6)
        : 0;
      const total = raw + ersForce;
      return tcOn ? Math.min(total, tc_limit_N) : total;
    },
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
    // Stage 47 — tyre thermal trace inputs
    tyreTempStartC:     params.tyreTempCurrentC    ?? 85,
    tyreOptTempC:       params.tyreOptTempC        ?? 85,
    tyreTempHalfWidthC: params.tyreTempHalfWidthC  ?? 30,
  };
}
