/**
 * Stage 11 — Tyre thermal model.
 *
 * Models how peak friction coefficient varies with tyre temperature.
 * Formula: f(T) = floorMu + (1 − floorMu) × exp(−k × (T − T_opt)²)
 *
 * where k = ln(2) / halfWidth²   (derived from the half-maximum condition below)
 *
 * Derivation of k:
 *   At T = T_opt ± halfWidth, grip is halfway between floor and peak:
 *   f = floorMu + (1 − floorMu) × exp(−k × halfWidth²) = 0.5 × (1 + floorMu)
 *   ⟹ exp(−k × halfWidth²) = 0.5
 *   ⟹ k = ln(2) / halfWidth²
 *
 * Properties:
 *   f(T_opt)              = 1.0  (peak grip exactly at optimal)
 *   f(T_opt ± halfWidth)  = 0.5 × (1 + floorMu)  (half-max by construction)
 *   f(T → ±∞)             → floorMu  (floor approached asymptotically)
 *
 * Validation (T_opt=85, hw=30, floor=0.60):
 *   k = ln2/900 = 0.000770  °C⁻²
 *   f(85)  = 1.0000
 *   f(115) = 0.60 + 0.40×exp(−0.693) = 0.60 + 0.20 = 0.80 = 0.5×(1+0.60) ✓
 *   f(0)   ≈ 0.6015  (within 0.025 of floor — near-converged)
 */

import type { VehicleParams } from './types';

export interface TyreTempGripPoint {
  tempC:      number;
  muFraction: number;  // f(T) — multiplier on peakMu
}

/**
 * Compute grip multiplier f(T) ∈ [floorMu, 1.0].
 * Returns 1.0 (no thermal effect) when halfWidthC ≤ 0.
 */
export function computeTyreTempFactor(
  currentTempC: number,
  optTempC:     number,
  halfWidthC:   number,
  floorMu:      number,
): number {
  if (halfWidthC <= 0) return 1.0;
  const k  = Math.LN2 / (halfWidthC * halfWidthC);
  const dT = currentTempC - optTempC;
  const f  = floorMu + (1 - floorMu) * Math.exp(-k * dT * dT);
  return Math.max(f, floorMu);   // defensive floor clamp
}

/** Apply thermal correction to peakMu from VehicleParams tyre temp fields. */
export function computeTyreEffectiveMu(
  peakMu: number,
  params: Pick<VehicleParams, 'tyreTempCurrentC' | 'tyreOptTempC' | 'tyreTempHalfWidthC' | 'tyreTempFloorMu'>,
): number {
  const f = computeTyreTempFactor(
    params.tyreTempCurrentC,
    params.tyreOptTempC,
    params.tyreTempHalfWidthC,
    params.tyreTempFloorMu,
  );
  return peakMu * f;
}

/**
 * Generate a grip curve from 0°C to 200°C for the tyre temperature chart.
 * Returns `points` evenly-spaced samples.
 */
export function computeTyreGripCurve(
  params: Pick<VehicleParams, 'tyreOptTempC' | 'tyreTempHalfWidthC' | 'tyreTempFloorMu'>,
  points = 100,
): TyreTempGripPoint[] {
  const n = Math.max(points, 2);
  const result: TyreTempGripPoint[] = [];
  for (let i = 0; i < n; i++) {
    const tempC = (200 / (n - 1)) * i;
    result.push({
      tempC,
      muFraction: computeTyreTempFactor(tempC, params.tyreOptTempC, params.tyreTempHalfWidthC, params.tyreTempFloorMu),
    });
  }
  return result;
}
