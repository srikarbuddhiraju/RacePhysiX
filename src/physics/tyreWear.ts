/**
 * Tyre Wear Model — Stage 23
 *
 * Models lap-by-lap mechanical grip degradation. Three phases:
 *   1. Warmup  (laps 1–warmupLaps): grip builds to peak
 *   2. Linear  (post-warmup): gradual μ loss at wearRatePerLap
 *   3. Cliff   (post-cliffLap): exponential μ collapse
 *
 * Graining (soft/inter): laps 1–2 temporary dip (~5%) before rubber cleans up.
 *
 * References: Pirelli compound datasheets; Bauer et al. 2016 F1 strategy models.
 */

export type TyreCompound = 'soft' | 'medium' | 'hard' | 'inter' | 'wet';

interface CompoundParams {
  warmupLaps:     number;
  wearRatePerLap: number;
  cliffLap:       number;
  graining:       boolean;
}

export const COMPOUND_PARAMS: Record<TyreCompound, CompoundParams> = {
  soft:   { warmupLaps: 2,  wearRatePerLap: 0.008, cliffLap: 14, graining: true  },
  medium: { warmupLaps: 3,  wearRatePerLap: 0.005, cliffLap: 22, graining: false },
  hard:   { warmupLaps: 4,  wearRatePerLap: 0.003, cliffLap: 36, graining: false },
  inter:  { warmupLaps: 2,  wearRatePerLap: 0.010, cliffLap: 18, graining: true  },
  wet:    { warmupLaps: 1,  wearRatePerLap: 0.015, cliffLap: 12, graining: false },
};

/**
 * Returns a μ multiplier (0.55–1.0) for a given lap number in a stint.
 * lap = 1 is the first lap on a fresh set.
 */
export function tyreWearFactor(lap: number, compound: TyreCompound): number {
  const p = COMPOUND_PARAMS[compound];

  // Graining: temporary grip dip in first few laps (soft/inter only)
  const grain = p.graining
    ? lap <= 2 ? 0.95 : lap <= 4 ? 0.975 : 1.0
    : 1.0;

  // Linear wear after warmup phase
  const wearLaps = Math.max(0, lap - p.warmupLaps);
  const linear = Math.max(0, 1.0 - p.wearRatePerLap * wearLaps);

  // Cliff: exponential collapse after cliffLap
  const cliffLaps = Math.max(0, lap - p.cliffLap);
  const cliff = cliffLaps > 0 ? Math.exp(-0.25 * cliffLaps) : 1.0;

  return Math.max(0.55, grain * linear * cliff);
}

/** Life fraction consumed (0 = new tyre, 1 = past cliff). For UI progress bar. */
export function tyreLifeFraction(lap: number, compound: TyreCompound): number {
  const p = COMPOUND_PARAMS[compound];
  return Math.min(1.0, lap / (p.cliffLap + 4));
}
