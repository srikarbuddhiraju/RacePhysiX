/** Power unit helpers — shared across ParameterPanel, VehiclePresetSelector, LapTimePanel. */

export type PowerUnit = 'kW' | 'BHP' | 'PS';

/** Convert a display value in the given unit back to kW (for storage). */
export const toKW = (v: number, u: PowerUnit): number =>
  u === 'BHP' ? v / 1.34102 : u === 'PS' ? v / 1.35962 : v;

/** Convert kW to the given display unit. */
export const fromKW = (v: number, u: PowerUnit): number =>
  u === 'BHP' ? v * 1.34102 : u === 'PS' ? v * 1.35962 : v;

/** Format a kW value as a display string in the given unit (rounded). */
export const fmtPower = (kw: number, u: PowerUnit): string =>
  `${Math.round(fromKW(kw, u))} ${u}`;

export const POWER_RANGE: Record<PowerUnit, { min: number; max: number; step: number }> = {
  kW:  { min: 50,  max: 600, step: 5 },
  BHP: { min: 67,  max: 805, step: 5 },
  PS:  { min: 68,  max: 816, step: 5 },
};
