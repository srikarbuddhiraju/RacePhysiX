/**
 * Ambient Conditions Model — Stage 24
 *
 * Air density from altitude + temperature (ISA barometric formula).
 * Wind decomposition into headwind (increases drag) and crosswind (reduces
 * available cornering grip).
 *
 * Reference: ICAO Standard Atmosphere Doc 7488/3; ISO 2533:1975
 */

/** Air density [kg/m³] from altitude [m] and ambient temperature [°C]. */
export function airDensity(altitudeM: number, ambientTempC: number): number {
  const T_K   = ambientTempC + 273.15;
  const T_std = 288.15;  // K — ISA sea-level standard temperature
  // Isothermal barometric formula — accurate within ±2% up to 5000 m
  return 1.225 * (T_std / T_K) * Math.exp(-altitudeM / 8500);
}

/** Net headwind speed [m/s]. Positive = car driving into wind. */
export function headwindMs(windSpeedKph: number, windAngleDeg: number): number {
  return (windSpeedKph / 3.6) * Math.cos(windAngleDeg * Math.PI / 180);
}

/** Crosswind speed [m/s] — acts laterally against the car. */
export function crosswindMs(windSpeedKph: number, windAngleDeg: number): number {
  return Math.abs((windSpeedKph / 3.6) * Math.sin(windAngleDeg * Math.PI / 180));
}

/**
 * Crosswind lateral force [N] acting on the car body.
 * Side drag: CD_side ≈ 1.0 (bluff body), A_side ≈ 2.2 × frontal area.
 * This force must be overcome by cornering capacity, reducing available μ for cornering.
 */
export function crosswindLateralForceN(
  windSpeedKph:      number,
  windAngleDeg:      number,
  rhoAir:            number,
  aeroReferenceArea: number,
): number {
  const v_cross = crosswindMs(windSpeedKph, windAngleDeg);
  const A_side  = 2.2 * aeroReferenceArea;
  const CD_side = 1.0;
  return 0.5 * rhoAir * v_cross * v_cross * A_side * CD_side;
}
