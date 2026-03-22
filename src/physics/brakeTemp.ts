/**
 * Brake Temperature Model — Stage 27
 *
 * Lap-by-lap brake disc temperature evolution and fade model.
 *
 * Heat input per lap ∝ braking energy (kinetic energy dissipated as heat).
 * Cooling: convective, proportional to temperature difference and lap time.
 * Fade: Gaussian bell curve — same structure as tyre thermal model.
 *
 * Reference: Limpert, Brake Design and Safety (3rd ed.), Ch.7
 *            SAE Paper 2003-01-3313 (brake thermal analysis)
 */

const G       = 9.81;
const CP_IRON = 460;   // J/(kg·K) — grey cast iron brake disc specific heat

/**
 * Estimate brake disc temperature rise per lap from braking energy.
 *
 * @param mass            kg — vehicle mass
 * @param brakingCapG     g — braking deceleration
 * @param lapLengthM      m — total lap distance
 * @param brakeDiscMassKg kg — total disc mass (all 4 discs combined)
 */
export function brakeHeatRisePerLap(
  mass:            number,
  brakingCapG:     number,
  lapLengthM:      number,
  brakeDiscMassKg: number,
): number {
  // Fraction of lap spent at full braking — empirical: 15–20% of distance
  const brakingFrac = 0.17;
  const brakingDistM = lapLengthM * brakingFrac;

  // Energy = F × d = m × a × d
  const E_braking = mass * brakingCapG * G * brakingDistM;  // J

  // All braking energy goes to disc heat (simplified — no pad, no radiation)
  const ΔT = E_braking / (brakeDiscMassKg * CP_IRON);
  return ΔT;
}

/**
 * Brake disc cooling per lap (convective + radiative, simplified).
 *
 * @param T_disc      current disc temperature (°C)
 * @param T_ambient   ambient air temperature (°C)
 * @param lapTimeSec  s
 * @param brakingCapG g — higher braking → larger ducts → faster cooling
 */
export function brakeDiscCoolingPerLap(
  T_disc:      number,
  T_ambient:   number,
  lapTimeSec:  number,
  brakingCapG: number,
): number {
  // Time constant: road car ~90s (small ducts), race car ~45s (large ducts)
  const τ_cool = brakingCapG > 1.2 ? 45 : brakingCapG > 0.9 ? 65 : 90;
  return (T_disc - T_ambient) * (1 - Math.exp(-lapTimeSec / τ_cool));
}

/**
 * Brake fade factor (0–1) as a Gaussian function of disc temperature.
 * fadeFactor = 1.0 at optimal temperature → peak braking.
 * fadeFactor → brakeFloorMu at extreme temperatures.
 */
export function brakeFadeFactorFromTemp(
  T_disc:          number,
  brakeOptTempC:   number,
  brakeHalfWidthC: number,
  brakeFloorMu:    number,
): number {
  const dT = T_disc - brakeOptTempC;
  const hw2 = brakeHalfWidthC * brakeHalfWidthC;
  return brakeFloorMu + (1 - brakeFloorMu) * Math.exp(-(dT * dT) / (2 * hw2));
}
