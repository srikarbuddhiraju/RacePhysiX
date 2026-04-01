/**
 * Stage 48 — Vehicle Setup JSON import / export.
 *
 * Export: serialises VehicleParams + PacejkaCoeffs → downloadable JSON file.
 * Import: reads a JSON file, validates every field (type + range), returns
 *         a structured result so the caller can decide whether to apply.
 *
 * Validation philosophy:
 *  - Missing or wrong-type required fields → hard error (must fix before apply)
 *  - Out-of-range values → soft warning (user can "Apply anyway")
 *  - Unknown extra fields are silently ignored
 */

import type { VehicleParams, PacejkaCoeffs } from './types';

// ─── Export ───────────────────────────────────────────────────────────────────

export interface SetupJSON {
  version:    number;
  exportedAt: string;
  params:     VehicleParams;
  coeffs:     PacejkaCoeffs;
}

export function exportSetupJSON(params: VehicleParams, coeffs: PacejkaCoeffs): void {
  const payload: SetupJSON = {
    version:    1,
    exportedAt: new Date().toISOString(),
    params,
    coeffs,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `racephysix-setup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Validation ───────────────────────────────────────────────────────────────

export interface ValidationResult {
  /** Hard errors — missing fields, wrong types. Setup cannot be applied safely. */
  errors:   string[];
  /** Soft warnings — values outside expected ranges. Can be applied with caution. */
  warnings: string[];
  /** Parsed params if structure is valid (even with warnings). undefined on hard error. */
  params?:  VehicleParams;
  /** Parsed coeffs if structure is valid. undefined on hard error. */
  coeffs?:  PacejkaCoeffs;
}

type FieldSpec =
  | { type: 'number';  min: number; max: number }
  | { type: 'boolean' }
  | { type: 'string';  enum?: string[] };

// VehicleParams field specs — ranges informed by physics model context.
// Limits are generous to accommodate edge-case research setups.
const PARAM_SPECS: Record<keyof VehicleParams, FieldSpec> = {
  mass:                         { type: 'number',  min: 100,   max: 5000 },
  wheelbase:                    { type: 'number',  min: 1.0,   max: 5.0  },
  frontWeightFraction:          { type: 'number',  min: 0.2,   max: 0.8  },
  corneringStiffnessNPerDeg:    { type: 'number',  min: 100,   max: 3000 },
  rearCorneringStiffnessNPerDeg:{ type: 'number',  min: 100,   max: 3000 },
  cgHeight:                     { type: 'number',  min: 0.1,   max: 1.5  },
  trackWidth:                   { type: 'number',  min: 0.8,   max: 3.0  },
  tyreSectionWidth:             { type: 'number',  min: 0.12,  max: 0.40 },
  turnRadius:                   { type: 'number',  min: 5,     max: 1000 },
  speedKph:                     { type: 'number',  min: 0,     max: 400  },
  vehicleClass:                 { type: 'string',  enum: ['road', 'track', 'motorsport'] },
  drivetrainType:               { type: 'string',  enum: ['FWD', 'RWD', 'AWD', 'AWD_TV'] },
  throttlePercent:              { type: 'number',  min: 0,     max: 100  },
  enginePowerKW:                { type: 'number',  min: 1,     max: 2000 },
  awdFrontBias:                 { type: 'number',  min: 0,     max: 1    },
  frontSpringRate:              { type: 'number',  min: 1000,  max: 200000 },
  rearSpringRate:               { type: 'number',  min: 1000,  max: 200000 },
  frontARBRate:                 { type: 'number',  min: 0,     max: 100000 },
  rearARBRate:                  { type: 'number',  min: 0,     max: 100000 },
  brakingG:                     { type: 'number',  min: 0,     max: 5    },
  brakeBias:                    { type: 'number',  min: 0.2,   max: 0.9  },
  aeroCL:                       { type: 'number',  min: 0,     max: 10   },
  aeroCD:                       { type: 'number',  min: 0,     max: 2    },
  aeroReferenceArea:            { type: 'number',  min: 0.5,   max: 5    },
  aeroBalance:                  { type: 'number',  min: 0,     max: 1    },
  tyreLoadSensitivity:          { type: 'number',  min: 0,     max: 0.5  },
  tyreOptTempC:                 { type: 'number',  min: 50,    max: 150  },
  tyreTempHalfWidthC:           { type: 'number',  min: 5,     max: 80   },
  tyreTempCurrentC:             { type: 'number',  min: -20,   max: 200  },
  tyreTempFloorMu:              { type: 'number',  min: 0,     max: 1    },
  gearCount:                    { type: 'number',  min: 1,     max: 10   },
  firstGearRatio:               { type: 'number',  min: 1.0,   max: 6.0  },
  topGearRatio:                 { type: 'number',  min: 0.5,   max: 3.0  },
  finalDriveRatio:              { type: 'number',  min: 1.0,   max: 8.0  },
  wheelRadiusM:                 { type: 'number',  min: 0.20,  max: 0.50 },
  enginePeakRpm:                { type: 'number',  min: 2000,  max: 25000 },
  engineRedlineRpm:             { type: 'number',  min: 2500,  max: 25000 },
  fuelLoadKg:                   { type: 'number',  min: 0,     max: 200  },
  fuelBurnRateKgPerLap:         { type: 'number',  min: 0,     max: 10   },
  frontCamberDeg:               { type: 'number',  min: -6,    max: 2    },
  rearCamberDeg:                { type: 'number',  min: -6,    max: 2    },
  frontToeDeg:                  { type: 'number',  min: -2,    max: 2    },
  rearToeDeg:                   { type: 'number',  min: -2,    max: 2    },
  tyreCompound:                 { type: 'string',  enum: ['soft', 'medium', 'hard', 'inter', 'wet'] },
  altitudeM:                    { type: 'number',  min: -100,  max: 5000 },
  ambientTempC:                 { type: 'number',  min: -30,   max: 55   },
  windSpeedKph:                 { type: 'number',  min: 0,     max: 200  },
  windAngleDeg:                 { type: 'number',  min: 0,     max: 360  },
  driverAggression:             { type: 'number',  min: 0,     max: 1    },
  diffType:                     { type: 'string',  enum: ['open', 'lsd', 'locked'] },
  lsdLockingPercent:            { type: 'number',  min: 0,     max: 100  },
  brakeDiscMassKg:              { type: 'number',  min: 1,     max: 30   },
  brakeOptTempC:                { type: 'number',  min: 200,   max: 900  },
  brakeHalfWidthC:              { type: 'number',  min: 50,    max: 400  },
  brakeFloorMu:                 { type: 'number',  min: 0,     max: 1    },
  frontTyrePressureBar:         { type: 'number',  min: 0.5,   max: 5    },
  rearTyrePressureBar:          { type: 'number',  min: 0.5,   max: 5    },
  frontRideHeightMm:            { type: 'number',  min: 10,    max: 300  },
  rearRideHeightMm:             { type: 'number',  min: 10,    max: 300  },
  engineCurveType:              { type: 'string',  enum: ['na', 'turbo', 'electric'] },
  engineMaxTorqueNm:            { type: 'number',  min: 10,    max: 3000 },
  engineTorquePeakRpm:          { type: 'number',  min: 500,   max: 20000 },
  turboBoostRpm:                { type: 'number',  min: 500,   max: 10000 },
  tcEnabled:                    { type: 'boolean' },
  tcSlipThreshold:              { type: 'number',  min: 0.01,  max: 0.5  },
  trackRubberLevel:             { type: 'number',  min: 0,     max: 1    },
  trackWetness:                 { type: 'number',  min: 0,     max: 1    },
  ersEnabled:                   { type: 'boolean' },
  ersPowerKW:                   { type: 'number',  min: 0,     max: 500  },
  ersBatteryKJ:                 { type: 'number',  min: 0,     max: 10000 },
  ersDeployStrategy:            { type: 'string',  enum: ['full', 'saving', 'attack'] },
  frontRollCentreHeightMm:      { type: 'number',  min: -50,   max: 200  },
  rearRollCentreHeightMm:       { type: 'number',  min: -50,   max: 200  },
  camberGainFront:              { type: 'number',  min: 0,     max: 3    },
  camberGainRear:               { type: 'number',  min: 0,     max: 3    },
  frontMotionRatio:             { type: 'number',  min: 0.3,   max: 1.2  },
  rearMotionRatio:              { type: 'number',  min: 0.3,   max: 1.2  },
  rollDamperRatio:              { type: 'number',  min: 0.05,  max: 2.0  },
  tyreCoreHeatLag:              { type: 'number',  min: 0,     max: 1    },
};

const COEFF_SPECS: Record<keyof PacejkaCoeffs, FieldSpec> = {
  B:      { type: 'number', min: 1,    max: 30   },
  C:      { type: 'number', min: 0.5,  max: 3.0  },
  peakMu: { type: 'number', min: 0.1,  max: 3.0  },
  E:      { type: 'number', min: -5.0, max: 1.0  },
};

export function validateSetupJSON(raw: unknown): ValidationResult {
  const errors:   string[] = [];
  const warnings: string[] = [];

  // 1. Must be an object
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { errors: ['File is not a valid JSON object.'], warnings: [] };
  }

  const obj = raw as Record<string, unknown>;

  // 2. Warn on version mismatch
  if (obj['version'] !== undefined && obj['version'] !== 1) {
    warnings.push(`version is ${obj['version']} — this tool expects version 1. Some fields may not apply.`);
  }

  // 3. params block must exist and be an object
  if (typeof obj['params'] !== 'object' || obj['params'] === null) {
    return { errors: ['Missing or invalid "params" block in file.'], warnings };
  }

  // 4. coeffs block must exist and be an object
  if (typeof obj['coeffs'] !== 'object' || obj['coeffs'] === null) {
    return { errors: ['Missing or invalid "coeffs" block in file.'], warnings };
  }

  const rawParams = obj['params'] as Record<string, unknown>;
  const rawCoeffs = obj['coeffs'] as Record<string, unknown>;

  // 5. Validate every VehicleParams field
  const params = {} as Record<string, unknown>;
  for (const [field, spec] of Object.entries(PARAM_SPECS) as [keyof VehicleParams, FieldSpec][]) {
    const val = rawParams[field];

    if (val === undefined || val === null) {
      errors.push(`params.${field}: missing required field`);
      continue;
    }

    if (spec.type === 'boolean') {
      if (typeof val !== 'boolean') {
        errors.push(`params.${field}: expected boolean, got ${typeof val}`);
      } else {
        params[field] = val;
      }
    } else if (spec.type === 'string') {
      if (typeof val !== 'string') {
        errors.push(`params.${field}: expected string, got ${typeof val}`);
      } else if (spec.enum && !spec.enum.includes(val)) {
        warnings.push(`params.${field}: "${val}" is not a recognised value (expected one of: ${spec.enum.join(', ')})`);
        params[field] = val; // apply anyway — user may have a future value
      } else {
        params[field] = val;
      }
    } else {
      // number
      if (typeof val !== 'number' || !isFinite(val)) {
        errors.push(`params.${field}: expected number, got ${typeof val === 'number' ? 'NaN/Infinity' : typeof val}`);
      } else {
        if (val < spec.min || val > spec.max) {
          warnings.push(`params.${field}: ${val} is outside expected range [${spec.min}, ${spec.max}]`);
        }
        params[field] = val;
      }
    }
  }

  // 6. Validate PacejkaCoeffs
  const coeffs = {} as Record<string, unknown>;
  for (const [field, spec] of Object.entries(COEFF_SPECS) as [keyof PacejkaCoeffs, FieldSpec][]) {
    const val = rawCoeffs[field];

    if (val === undefined || val === null) {
      errors.push(`coeffs.${field}: missing required field`);
      continue;
    }

    if (spec.type === 'number') {
      if (typeof val !== 'number' || !isFinite(val)) {
        errors.push(`coeffs.${field}: expected number, got ${typeof val}`);
      } else {
        if (val < spec.min || val > spec.max) {
          warnings.push(`coeffs.${field}: ${val} is outside expected range [${spec.min}, ${spec.max}]`);
        }
        coeffs[field] = val;
      }
    }
  }

  // 7. If hard errors → cannot safely apply
  if (errors.length > 0) {
    return { errors, warnings };
  }

  return {
    errors,
    warnings,
    params:  params as unknown as VehicleParams,
    coeffs:  coeffs as unknown as PacejkaCoeffs,
  };
}
