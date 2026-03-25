/**
 * gearUtils — shared gear and RPM computation.
 * Used by TrackVisualiser (animation telemetry) and export utilities (trace CSV).
 */

import type { VehicleParams } from './types';

/**
 * Returns the current gear and engine RPM for a given vehicle speed.
 * Applies hysteresis: stays in prevGear if RPM is within the comfortable band (65–95% redline).
 */
export function computeGearRPM(
  speedKph: number,
  params:   VehicleParams,
  prevGear  = 1,
): { gear: number; rpm: number } {
  const speedMs = speedKph / 3.6;
  if (speedMs < 0.5) return { gear: 1, rpm: params.enginePeakRpm * 0.2 };
  const wheelRpm = (speedMs / params.wheelRadiusM) / (2 * Math.PI) * 60;
  const n    = params.gearCount;
  const step = Math.pow(params.topGearRatio / params.firstGearRatio, 1 / (n - 1));
  // Hysteresis: stay in prevGear if RPM is in the comfortable band
  if (prevGear >= 1 && prevGear <= n) {
    const prevRatio = params.firstGearRatio * Math.pow(step, prevGear - 1);
    const prevRpm   = wheelRpm * prevRatio * params.finalDriveRatio;
    if (prevRpm >= params.enginePeakRpm * 0.65 && prevRpm <= params.engineRedlineRpm * 0.95) {
      return { gear: prevGear, rpm: prevRpm };
    }
  }
  for (let g = 1; g <= n; g++) {
    const ratio = params.firstGearRatio * Math.pow(step, g - 1);
    const rpm   = wheelRpm * ratio * params.finalDriveRatio;
    if (rpm <= params.engineRedlineRpm * 0.92) return { gear: g, rpm: Math.max(rpm, params.enginePeakRpm * 0.15) };
  }
  const topRatio = params.firstGearRatio * Math.pow(step, n - 1);
  return { gear: n, rpm: wheelRpm * topRatio * params.finalDriveRatio };
}
