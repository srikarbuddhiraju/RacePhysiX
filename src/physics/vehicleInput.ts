/**
 * vehicleInput — converts VehicleParams + PacejkaCoeffs → LapSimInput.
 * Shared between LapTimePanel (lap computation) and TrackVisualiser (trace).
 */

import { computeMaxDriveForce, computeMaxSpeed } from './gearModel';
import type { VehicleParams, PacejkaCoeffs }     from './types';
import type { LapSimInput }                       from './laptime';

const G       = 9.81;
const RHO_AIR = 1.225;

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

  const DEG_TO_RAD = Math.PI / 180;

  return {
    mass,
    peakMu:            peakMuEff,
    brakingCapG,
    aeroCL:            params.aeroCL,
    aeroCD,
    aeroReferenceArea,
    dragForce:         (V: number) => 0.5 * RHO_AIR * V * V * aeroReferenceArea * aeroCD,
    driveForce:        (V: number) => computeMaxDriveForce(V, params),
    combSlipBrakeFrac: 0.4,
    frontCaNPerRad:    corneringStiffnessNPerDeg / DEG_TO_RAD,
    rearCaNPerRad:     (rearCorneringStiffnessNPerDeg ?? corneringStiffnessNPerDeg) / DEG_TO_RAD,
    maxVehicleSpeedMs: computeMaxSpeed(params),
  };
}
