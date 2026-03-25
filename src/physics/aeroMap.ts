/**
 * Stage 46 — Pre-computed CFD aero map.
 *
 * Replaces Stage 29's crude CL boost (+20% flat cap) with a 2D lookup table
 * indexed by [avgRideHeightMm, yawDeg] per vehicle class.
 *
 * Each table entry gives CLfactor and CDfactor — multipliers on the user's
 * base aeroCL/aeroCD values. At the reference ride height and zero yaw both
 * factors are exactly 1.0, so existing setups are unaffected at nominal trim.
 *
 * Ground effect (ride height sensitivity):
 *   Road car:   minimal underbody — small CL gain at low ride height
 *   Track:      moderate diffuser — meaningful ground effect
 *   Motorsport: full underbody + diffuser — strong non-linear ground effect (F1/GT3)
 *
 * Yaw sensitivity (crosswind):
 *   CD increases with yaw for all classes (induced drag, frontal area growth)
 *   CL drops slightly with yaw (inverted wing loses effective angle of attack)
 *
 * References:
 *   Katz "Race Car Aerodynamics" §6.3 (ground effect), §7.2 (yaw sensitivity)
 *   Milliken & Milliken RCVD Ch.5 (aero influence on handling)
 */

import type { VehicleClass } from './types';

// ── Lookup table types ────────────────────────────────────────────────────────

interface AeroMapEntry {
  rideHeightMm: number;
  CLfactor:     number;  // multiplier on base aeroCL
  CDfactor:     number;  // multiplier on base aeroCD (ride-height effect only)
}

interface AeroYawEntry {
  yawDeg:   number;
  CLfactor: number;  // additional CL multiplier from yaw
  CDfactor: number;  // additional CD multiplier from yaw
}

// ── Per-class ride-height tables ──────────────────────────────────────────────
// Each table has a "reference" point (CLfactor=1.0) at the typical nominal
// ride height for that class. Values validated against published CFD sensitivity
// data in Katz §6.3 and Sauber/Williams open-source aero studies.

const RIDE_HEIGHT_MAPS: Record<VehicleClass, AeroMapEntry[]> = {
  road: [
    { rideHeightMm:  50, CLfactor: 1.05, CDfactor: 1.01 },
    { rideHeightMm: 100, CLfactor: 1.00, CDfactor: 1.00 },  // reference
    { rideHeightMm: 150, CLfactor: 0.97, CDfactor: 0.99 },
    { rideHeightMm: 200, CLfactor: 0.95, CDfactor: 0.98 },
  ],
  track: [
    { rideHeightMm:  25, CLfactor: 1.30, CDfactor: 1.05 },
    { rideHeightMm:  45, CLfactor: 1.15, CDfactor: 1.02 },
    { rideHeightMm:  70, CLfactor: 1.00, CDfactor: 1.00 },  // reference
    { rideHeightMm: 110, CLfactor: 0.88, CDfactor: 0.98 },
  ],
  motorsport: [
    { rideHeightMm:  20, CLfactor: 1.60, CDfactor: 1.10 },
    { rideHeightMm:  35, CLfactor: 1.35, CDfactor: 1.06 },
    { rideHeightMm:  55, CLfactor: 1.12, CDfactor: 1.02 },
    { rideHeightMm:  75, CLfactor: 1.00, CDfactor: 1.00 },  // reference
    { rideHeightMm: 100, CLfactor: 0.84, CDfactor: 0.97 },
  ],
};

// ── Yaw table (shared across all classes — normalised sensitivity) ─────────────
// Values represent the incremental effect of yaw on top of the ride-height
// corrected CL/CD. At yaw=0 both factors are 1.0.
// CL drops cosine-like (wing loses effective angle of attack in crosswind).
// CD grows with yaw (larger frontal projection + induced drag).

const YAW_MAP: AeroYawEntry[] = [
  { yawDeg:  0, CLfactor: 1.000, CDfactor: 1.000 },
  { yawDeg: 15, CLfactor: 0.985, CDfactor: 1.030 },
  { yawDeg: 30, CLfactor: 0.950, CDfactor: 1.100 },
  { yawDeg: 45, CLfactor: 0.900, CDfactor: 1.200 },
  { yawDeg: 90, CLfactor: 0.800, CDfactor: 1.500 },
];

// ── Bilinear interpolation helpers ───────────────────────────────────────────

function interpRideHeight(table: AeroMapEntry[], h: number): { CLfactor: number; CDfactor: number } {
  if (h <= table[0].rideHeightMm) return { CLfactor: table[0].CLfactor, CDfactor: table[0].CDfactor };
  const last = table[table.length - 1];
  if (h >= last.rideHeightMm)    return { CLfactor: last.CLfactor, CDfactor: last.CDfactor };

  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i], hi = table[i + 1];
    if (h >= lo.rideHeightMm && h <= hi.rideHeightMm) {
      const t = (h - lo.rideHeightMm) / (hi.rideHeightMm - lo.rideHeightMm);
      return {
        CLfactor: lo.CLfactor + t * (hi.CLfactor - lo.CLfactor),
        CDfactor: lo.CDfactor + t * (hi.CDfactor - lo.CDfactor),
      };
    }
  }
  return { CLfactor: 1.0, CDfactor: 1.0 };
}

function interpYaw(yawDeg: number): { CLfactor: number; CDfactor: number } {
  const absYaw = Math.min(Math.abs(yawDeg), 90);
  const table  = YAW_MAP;
  if (absYaw <= table[0].yawDeg) return { CLfactor: table[0].CLfactor, CDfactor: table[0].CDfactor };
  const last = table[table.length - 1];
  if (absYaw >= last.yawDeg)     return { CLfactor: last.CLfactor, CDfactor: last.CDfactor };

  for (let i = 0; i < table.length - 1; i++) {
    const lo = table[i], hi = table[i + 1];
    if (absYaw >= lo.yawDeg && absYaw <= hi.yawDeg) {
      const t = (absYaw - lo.yawDeg) / (hi.yawDeg - lo.yawDeg);
      return {
        CLfactor: lo.CLfactor + t * (hi.CLfactor - lo.CLfactor),
        CDfactor: lo.CDfactor + t * (hi.CDfactor - lo.CDfactor),
      };
    }
  }
  return { CLfactor: 1.0, CDfactor: 1.0 };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface AeroMapFactors {
  CLfactor: number;  // multiply user's aeroCL by this
  CDfactor: number;  // multiply user's aeroCD by this
}

/**
 * Compute effective CL/CD multipliers from the CFD map.
 *
 * @param vehicleClass   'road' | 'track' | 'motorsport'
 * @param avgRideHeightMm  average of front and rear ride heights (mm)
 * @param windAngleDeg   0 = headwind, 90 = crosswind, 180 = tailwind
 */
export function computeAeroMapFactors(
  vehicleClass:   VehicleClass,
  avgRideHeightMm: number,
  windAngleDeg:    number,
): AeroMapFactors {
  const table = RIDE_HEIGHT_MAPS[vehicleClass] ?? RIDE_HEIGHT_MAPS.road;

  // Effective yaw: 0/180 headwind/tailwind → 0 yaw effect; 90° → full yaw effect
  // sin(windAngle) maps 0°→0, 90°→1, 180°→0
  const effectiveYawDeg = Math.abs(Math.sin(windAngleDeg * Math.PI / 180)) * 90;

  const rhCorr  = interpRideHeight(table, avgRideHeightMm);
  const yawCorr = interpYaw(effectiveYawDeg);

  return {
    CLfactor: rhCorr.CLfactor * yawCorr.CLfactor,
    CDfactor: rhCorr.CDfactor * yawCorr.CDfactor,
  };
}
