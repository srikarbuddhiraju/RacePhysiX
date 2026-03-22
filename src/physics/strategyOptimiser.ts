/**
 * Race Strategy Optimiser — Stage 30
 *
 * Enumerates 1-stop and 2-stop strategies for all combinations of
 * dry compounds (soft / medium / hard), finding the minimum total race time.
 *
 * Algorithm: Brute-force enumeration — fast because stint time computation
 * is O(numLaps) and total search space is small (<100k evaluations).
 *
 * Stint time model: baseLapTime / (thermalFactor × wearFactor) per lap.
 * thermalFactor: same Gaussian bell as simulateRace (WARMUP_TC = 2.5 laps)
 * wearFactor: from tyreWear.ts tyreWearFactor()
 */

import { tyreWearFactor, type TyreCompound } from './tyreWear';

export interface StintPlan {
  compound:  TyreCompound;
  startLap:  number;   // race lap (1-indexed)
  endLap:    number;
  stintLaps: number;   // laps in this stint (= endLap − startLap + 1)
  timeSec:   number;   // total stint time
}

export interface StrategyResult {
  stints:        StintPlan[];
  pitLaps:       number[];    // lap on which pitstop occurs (end of that lap)
  totalTimeSec:  number;
  numStops:      number;
}

const DRY_COMPOUNDS: TyreCompound[] = ['soft', 'medium', 'hard'];
const WARMUP_TC = 2.5;  // laps — matches simulateRace

/**
 * Simulate a single stint: return total time for `numLaps` laps on `compound`.
 * isFirstStint: starts from cold tyre (low temp); otherwise starts at ~75% optimal.
 */
function stintTime(
  compound:      TyreCompound,
  numLaps:       number,
  baseLapSec:    number,
  optTempC:      number,
  halfWidthC:    number,
  floorMu:       number,
  aggression:    number,
  isFirstStint:  boolean,
): number {
  if (numLaps <= 0) return 0;

  const startTemp  = isFirstStint ? 30 : optTempC * 0.85;  // pit tyres start warm
  const degRate    = 1.5 * (1 + 0.4 * aggression);
  let   tyreTempC  = startTemp;
  let   total      = 0;

  for (let lap = 1; lap <= numLaps; lap++) {
    // Thermal evolution
    if (tyreTempC < optTempC) {
      tyreTempC += (optTempC - tyreTempC) * (1 - Math.exp(-1 / WARMUP_TC));
    } else {
      tyreTempC += degRate;
    }
    const dT = tyreTempC - optTempC;
    const hw2 = halfWidthC * halfWidthC;
    const thermalFac = floorMu + (1 - floorMu) * Math.exp(-(dT * dT) / (2 * hw2));

    // Wear (aggression scales effective lap count)
    const effectiveLap = lap * (1 + 0.4 * aggression);
    const wearFac = tyreWearFactor(effectiveLap, compound);

    // Lap time: inversely proportional to combined grip factor
    const gripFac = Math.max(0.55, thermalFac * wearFac);
    total += baseLapSec / gripFac;
  }
  return total;
}

/**
 * Find the best 1-stop and 2-stop strategies.
 * Returns up to 6 strategies sorted by totalTimeSec ascending.
 */
export function optimiseRaceStrategy(
  numLaps:        number,
  baseLapSec:     number,   // lap time on fresh medium tyre (from computeLapTime)
  optTempC:       number,
  halfWidthC:     number,
  floorMu:        number,
  aggression:     number,
  pitStopTimeSec: number,   // pit lane time loss (e.g. 22s F1, 28s GT3)
): StrategyResult[] {
  const results: StrategyResult[] = [];

  // ── 1-stop ───────────────────────────────────────────────────────────────
  for (const c1 of DRY_COMPOUNDS) {
    for (const c2 of DRY_COMPOUNDS) {
      if (c1 === c2) continue;  // must use different compounds (F1 rule + general practice)
      // Enumerate pit lap
      for (let pitLap = 3; pitLap <= numLaps - 3; pitLap++) {
        const stint1Laps = pitLap;
        const stint2Laps = numLaps - pitLap;
        const t1 = stintTime(c1, stint1Laps, baseLapSec, optTempC, halfWidthC, floorMu, aggression, true);
        const t2 = stintTime(c2, stint2Laps, baseLapSec, optTempC, halfWidthC, floorMu, aggression, false);
        const total = t1 + pitStopTimeSec + t2;
        results.push({
          stints: [
            { compound: c1, startLap: 1,          endLap: pitLap,  stintLaps: stint1Laps, timeSec: t1 },
            { compound: c2, startLap: pitLap + 1,  endLap: numLaps, stintLaps: stint2Laps, timeSec: t2 },
          ],
          pitLaps: [pitLap],
          totalTimeSec: total,
          numStops: 1,
        });
      }
    }
  }

  // ── 2-stop ───────────────────────────────────────────────────────────────
  for (const c1 of DRY_COMPOUNDS) {
    for (const c2 of DRY_COMPOUNDS) {
      for (const c3 of DRY_COMPOUNDS) {
        // Enumerate pit laps (pit2 at least 5 laps after pit1)
        for (let pit1 = 3; pit1 <= numLaps - 8; pit1 += 2) {
          for (let pit2 = pit1 + 5; pit2 <= numLaps - 3; pit2 += 2) {
            const t1 = stintTime(c1, pit1,           baseLapSec, optTempC, halfWidthC, floorMu, aggression, true);
            const t2 = stintTime(c2, pit2 - pit1,    baseLapSec, optTempC, halfWidthC, floorMu, aggression, false);
            const t3 = stintTime(c3, numLaps - pit2, baseLapSec, optTempC, halfWidthC, floorMu, aggression, false);
            const total = t1 + pitStopTimeSec + t2 + pitStopTimeSec + t3;
            results.push({
              stints: [
                { compound: c1, startLap: 1,        endLap: pit1,    stintLaps: pit1,          timeSec: t1 },
                { compound: c2, startLap: pit1 + 1,  endLap: pit2,    stintLaps: pit2 - pit1,   timeSec: t2 },
                { compound: c3, startLap: pit2 + 1,  endLap: numLaps, stintLaps: numLaps - pit2, timeSec: t3 },
              ],
              pitLaps: [pit1, pit2],
              totalTimeSec: total,
              numStops: 2,
            });
          }
        }
      }
    }
  }

  // Sort by totalTimeSec ascending
  results.sort((a, b) => a.totalTimeSec - b.totalTimeSec);

  // Deduplicate: keep best per (numStops, c1, c2[, c3])
  const seen = new Set<string>();
  const deduped: StrategyResult[] = [];
  for (const r of results) {
    const key = `${r.numStops}_${r.stints.map(s => s.compound).join('_')}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(r);
    }
  }

  return deduped.slice(0, 6);  // top 6 unique compound combinations
}

/** Format seconds as mm:ss */
export function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}
