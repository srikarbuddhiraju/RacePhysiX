/**
 * Stage 12 — Setup Optimisation.
 *
 * Nelder-Mead simplex algorithm over 7 vehicle setup parameters.
 * Objective: minimise lap time on a chosen circuit.
 *
 * Parameters optimised:
 *   frontSpringRate, rearSpringRate  — affect roll stiffness ratio → load transfer
 *   frontARBRate, rearARBRate        — same
 *   aeroCL                           — corner speed via downforce grip boost
 *   aeroBalance                      — front/rear downforce split
 *   brakeBias                        — longitudinal brake force distribution
 *
 * Spring/ARB effect path:
 *   roll stiffness ratio φ_front → lateral ΔFz on outer tyre at 1g representative
 *   → load sensitivity (qFz) → effective peakMu reduction → slower corners.
 *   With tyreLoadSensitivity=0.10 (default) the effect is real and ~7% at worst.
 *
 * Algorithm: Nelder-Mead simplex (Gao & Han 2012 variant).
 *   α=1 (reflect), γ=2 (expand), β=0.5 (contract), δ=0.5 (shrink).
 *   Operates in normalised [0,1]^7 space to handle the ~1000× scale difference
 *   between spring rates (N/m) and ratios (dimensionless).
 *
 * Complexity: typically 150–300 evaluations, each ~0.5 ms → <2 s total.
 */

import { computeLapTime }        from './laptime';
import type { TrackLayout, LapSimInput } from './laptime';
import type { VehicleParams }    from './types';

export type OptimisableKey =
  | 'frontSpringRate' | 'rearSpringRate'
  | 'frontARBRate'    | 'rearARBRate'
  | 'aeroCL'          | 'aeroBalance'
  | 'brakeBias';

export const OPTIMISABLE_KEYS: OptimisableKey[] = [
  'frontSpringRate', 'rearSpringRate',
  'frontARBRate',    'rearARBRate',
  'aeroCL',          'aeroBalance',
  'brakeBias',
];

export interface ParamBound { min: number; max: number; }
export type OptimiseBounds = Record<OptimisableKey, ParamBound>;

/** Bounds match ParameterPanel slider ranges exactly. */
export const OPTIMISE_BOUNDS: OptimiseBounds = {
  frontSpringRate: { min: 5_000,  max: 150_000 },
  rearSpringRate:  { min: 5_000,  max: 150_000 },
  frontARBRate:    { min: 0,      max: 40_000  },
  rearARBRate:     { min: 0,      max: 40_000  },
  aeroCL:          { min: 0,      max: 4.0     },
  aeroBalance:     { min: 0.30,   max: 0.70    },
  brakeBias:       { min: 0.40,   max: 0.90    },
};

export type InpBuilder = (params: VehicleParams) => LapSimInput;

export interface OptimiseResult {
  bestParams:  VehicleParams;
  bestTimeSec: number;
  baseTimeSec: number;
  improvement: number;   // baseTimeSec − bestTimeSec, always ≥ 0
  iterations:  number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const N = OPTIMISABLE_KEYS.length;   // 7

function xToParam(x: number, b: ParamBound): number {
  return b.min + Math.max(0, Math.min(1, x)) * (b.max - b.min);
}
function paramToX(v: number, b: ParamBound): number {
  const range = b.max - b.min;
  return range > 0 ? (v - b.min) / range : 0;
}

/** Apply a normalised vector to baseParams, returning a modified VehicleParams. */
function applyX(x: number[], base: VehicleParams): VehicleParams {
  const out = { ...base };
  for (let i = 0; i < N; i++) {
    const key = OPTIMISABLE_KEYS[i];
    (out as unknown as Record<string, number>)[key] = xToParam(x[i], OPTIMISE_BOUNDS[key]);
  }
  return out;
}

// ── Main optimiser ────────────────────────────────────────────────────────────

export function optimiseSetup(
  baseParams: VehicleParams,
  layout:     TrackLayout,
  inpBuilder: InpBuilder,
  _bounds:    OptimiseBounds = OPTIMISE_BOUNDS,
): OptimiseResult {
  // Objective: lap time (lower is better)
  function objective(x: number[]): number {
    try {
      const p   = applyX(x, baseParams);
      const inp = inpBuilder(p);
      return computeLapTime(layout, inp).totalTimeSec;
    } catch {
      return 999_999;
    }
  }

  // ── Initial simplex ─────────────────────────────────────────────────────────
  // Vertex 0: current params
  const x0: number[] = OPTIMISABLE_KEYS.map(k => paramToX(baseParams[k] as number, OPTIMISE_BOUNDS[k]));

  // Vertices 1..N: perturb one dimension +10% of normalised range
  const simplex: number[][] = [x0];
  for (let i = 0; i < N; i++) {
    const v = x0.slice();
    v[i] = Math.min(1, v[i] + 0.10);
    simplex.push(v);
  }

  const fvals: number[] = simplex.map(objective);
  const baseTimeSec     = fvals[0];

  // Nelder-Mead constants
  const ALPHA = 1.0;   // reflect
  const GAMMA = 2.0;   // expand
  const BETA  = 0.5;   // contract
  const DELTA = 0.5;   // shrink

  const MAX_ITER = 500;
  const CONV_TOL = 0.01;  // seconds

  let iterations = 0;

  for (; iterations < MAX_ITER; iterations++) {
    // Sort ascending by objective
    const order = Array.from({ length: N + 1 }, (_, i) => i)
      .sort((a, b) => fvals[a] - fvals[b]);
    const best  = order[0];
    const worst = order[N];
    const secondWorst = order[N - 1];

    // Convergence check
    if (fvals[worst] - fvals[best] < CONV_TOL) break;

    // Centroid of all except worst
    const c = new Array<number>(N).fill(0);
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        c[j] += simplex[order[i]][j] / N;
      }
    }

    // Reflection: x_r = c + α*(c − x_worst), clamped to [0,1]
    const xw = simplex[worst];
    const xr = c.map((cj, j) => Math.max(0, Math.min(1, cj + ALPHA * (cj - xw[j]))));
    const fr = objective(xr);

    if (fr < fvals[best]) {
      // Try expansion
      const xe = c.map((cj, j) => Math.max(0, Math.min(1, cj + GAMMA * (xr[j] - cj))));
      const fe = objective(xe);
      if (fe < fr) {
        simplex[worst] = xe; fvals[worst] = fe;
      } else {
        simplex[worst] = xr; fvals[worst] = fr;
      }
      continue;
    }

    if (fr < fvals[secondWorst]) {
      // Accept reflection
      simplex[worst] = xr; fvals[worst] = fr;
      continue;
    }

    // Contraction
    if (fr < fvals[worst]) {
      // Outside contraction
      const xc = c.map((cj, j) => Math.max(0, Math.min(1, cj + BETA * (xr[j] - cj))));
      const fc = objective(xc);
      if (fc <= fr) {
        simplex[worst] = xc; fvals[worst] = fc;
        continue;
      }
    } else {
      // Inside contraction
      const xc = c.map((cj, j) => Math.max(0, Math.min(1, cj + BETA * (xw[j] - cj))));
      const fc = objective(xc);
      if (fc < fvals[worst]) {
        simplex[worst] = xc; fvals[worst] = fc;
        continue;
      }
    }

    // Shrink — re-evaluate all except best
    for (let i = 1; i <= N; i++) {
      const idx = order[i];
      simplex[idx] = simplex[best].map((bj, j) =>
        Math.max(0, Math.min(1, bj + DELTA * (simplex[idx][j] - bj)))
      );
      fvals[idx] = objective(simplex[idx]);
    }
  }

  // Best vertex after convergence
  let bestIdx = 0;
  for (let i = 1; i <= N; i++) {
    if (fvals[i] < fvals[bestIdx]) bestIdx = i;
  }

  const bestParams  = applyX(simplex[bestIdx], baseParams);
  const bestTimeSec = fvals[bestIdx];

  return {
    bestParams,
    bestTimeSec,
    baseTimeSec,
    improvement: Math.max(0, baseTimeSec - bestTimeSec),
    iterations,
  };
}
