/**
 * Aerodynamics model — Stage 6.
 *
 * Computes speed-dependent downforce (adds to tyre normal loads → more grip)
 * and drag (opposes longitudinal motion → limits top speed).
 *
 * Downforce:    F_down = ½ × ρ × V² × A × CL          [N]
 * Drag:         F_drag = ½ × ρ × V² × A × CD          [N]
 *
 * Split to axles by aeroBalance (fraction of downforce on front):
 *   ΔFz_front = F_down × aeroBalance
 *   ΔFz_rear  = F_down × (1 − aeroBalance)
 *
 * CL sign convention: positive CL = downforce (car pushed into ground).
 * This is the motorsport convention (inverted wing = positive CL here).
 *
 * Reference: Milliken & Milliken RCVD Ch.5; Katz "Race Car Aerodynamics"
 */

const RHO_AIR = 1.225;  // kg/m³ at sea level, 15°C

export interface AeroInput {
  aeroCL:            number;  // downforce coefficient (0 = no wing, ~0.3 road, ~3.0 F1)
  aeroCD:            number;  // drag coefficient (~0.25 road, ~0.5 GT, ~0.8 open wheel)
  aeroReferenceArea: number;  // m², frontal reference area (~2.0 road, ~1.8 track)
  aeroBalance:       number;  // 0–1, fraction of downforce on front axle (0.45 typical)
  speedMs:           number;  // m/s
}

export interface AeroResult {
  qPa:           number;  // dynamic pressure, Pa
  downforceN:    number;  // N, total downforce
  dragN:         number;  // N, drag force
  FzBoostFront:  number;  // N, extra Fz on front axle from downforce
  FzBoostRear:   number;  // N, extra Fz on rear axle from downforce
}

export function computeAero(inp: AeroInput): AeroResult {
  const { aeroCL, aeroCD, aeroReferenceArea: A, aeroBalance, speedMs: V } = inp;

  const qPa       = 0.5 * RHO_AIR * V * V;
  const downforceN = qPa * A * aeroCL;
  const dragN      = qPa * A * aeroCD;

  return {
    qPa,
    downforceN,
    dragN,
    FzBoostFront: downforceN * aeroBalance,
    FzBoostRear:  downforceN * (1 - aeroBalance),
  };
}
