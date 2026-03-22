/**
 * Vehicle Presets — Stage 18
 *
 * Four reference vehicles covering the full spectrum from road car to F1.
 * Each preset defines a complete VehicleParams + PacejkaCoeffs set.
 *
 * Physics references:
 *  - Formula Student: FSAE/FS Rules + Hoosier R25B tyre data
 *  - GT3: FIA GT3 Technical Regulations + Michelin racing tyre data
 *  - F1: FIA Technical Regulations 2024 + Pirelli tyre data
 *  - Road: Milliken & Milliken typical road car values
 */

import type { VehicleParams, PacejkaCoeffs } from './types';

export interface VehiclePreset {
  id:          string;
  label:       string;
  description: string;
  params:      VehicleParams;
  coeffs:      PacejkaCoeffs;
}

// ── Road Car (Sport Sedan) ────────────────────────────────────────────────────
// Representative of a 200 hp RWD sports sedan (BMW 3 Series / Porsche 718 class)
const ROAD_CAR: VehiclePreset = {
  id: 'road',
  label: 'Road Car',
  description: 'Sport sedan · 150 kW · Street tyres · RWD',
  params: {
    mass: 1500,
    wheelbase: 2.70,
    frontWeightFraction: 0.55,
    corneringStiffnessNPerDeg: 500,
    rearCorneringStiffnessNPerDeg: 480,
    cgHeight: 0.55,
    trackWidth: 1.50,
    tyreSectionWidth: 0.225,
    turnRadius: 200,
    speedKph: 80,
    vehicleClass: 'road',
    drivetrainType: 'RWD',
    throttlePercent: 0,
    enginePowerKW: 150,
    awdFrontBias: 0.40,
    frontSpringRate: 25000,
    rearSpringRate:  28000,
    frontARBRate:    8000,
    rearARBRate:     6000,
    brakingG:   0,
    brakeBias:  0.65,
    aeroCL:            0,
    aeroCD:            0.28,
    aeroReferenceArea: 2.0,
    aeroBalance:       0.45,
    tyreLoadSensitivity: 0.10,
    tyreOptTempC:       80,
    tyreTempHalfWidthC: 30,
    tyreTempCurrentC:   80,
    tyreTempFloorMu:    0.60,
    gearCount:        6,
    firstGearRatio:   3.0,
    topGearRatio:     0.72,
    finalDriveRatio:  3.9,
    wheelRadiusM:     0.32,
    enginePeakRpm:    5500,
    engineRedlineRpm: 6500,
    fuelLoadKg:           45,
    fuelBurnRateKgPerLap: 2.5,
    frontCamberDeg: -1.5,   // typical road/sport setup
    rearCamberDeg:  -0.5,
    frontToeDeg:     0.05,  // slight toe-in front
    rearToeDeg:      0.15,
    tyreCompound: 'medium',
    altitudeM: 0, ambientTempC: 20, windSpeedKph: 0, windAngleDeg: 0,
    driverAggression: 0.5,
  },
  coeffs: { B: 10.0, C: 1.30, peakMu: 1.00, E: -1.50 },
};

// ── Formula Student (FSAE / FS) ───────────────────────────────────────────────
// Typical FSAE/FS car: 600cc moto engine, full aero, Hoosier R25B slicks
// Mass: ~230 kg car + 80 kg driver = 310 kg
// Reference: FSAE Rules 2024, Hoosier R25B tyre data
const FORMULA_STUDENT: VehiclePreset = {
  id: 'formula_student',
  label: 'Formula Student',
  description: 'FSAE/FS · 80 kW · Hoosier slicks · Full aero',
  params: {
    mass: 315,
    wheelbase: 1.55,
    frontWeightFraction: 0.47,
    corneringStiffnessNPerDeg: 180,
    rearCorneringStiffnessNPerDeg: 200,
    cgHeight: 0.27,
    trackWidth: 1.22,
    tyreSectionWidth: 0.20,
    turnRadius: 9,            // tight autocross hairpin
    speedKph: 40,
    vehicleClass: 'motorsport',
    drivetrainType: 'RWD',
    throttlePercent: 0,
    enginePowerKW: 80,        // CBR600RR / KTM 690 class
    awdFrontBias: 0.40,
    frontSpringRate: 35000,
    rearSpringRate:  30000,
    frontARBRate:    6000,
    rearARBRate:     5000,
    brakingG:   0,
    brakeBias:  0.70,
    aeroCL:            1.50,  // full aero package (front + rear wing + underbody)
    aeroCD:            1.20,
    aeroReferenceArea: 1.0,
    aeroBalance:       0.44,
    tyreLoadSensitivity: 0.15,
    tyreOptTempC:       80,
    tyreTempHalfWidthC: 25,
    tyreTempCurrentC:   80,
    tyreTempFloorMu:    0.65,
    gearCount:        6,
    firstGearRatio:   3.50,
    topGearRatio:     1.00,
    finalDriveRatio:  4.50,
    wheelRadiusM:     0.23,   // 13" wheel + R25B tyre, ~460mm OD
    enginePeakRpm:    11000,
    engineRedlineRpm: 13500,
    fuelLoadKg:           3,
    fuelBurnRateKgPerLap: 0.4,
    frontCamberDeg: -2.5,   // aggressive FS setup: tight autocross cornering
    rearCamberDeg:  -1.5,
    frontToeDeg:     0.0,   // zero toe front (minimise straight-line drag)
    rearToeDeg:      0.2,
    tyreCompound: 'soft',
    altitudeM: 0, ambientTempC: 20, windSpeedKph: 0, windAngleDeg: 0,
    driverAggression: 0.7,
  },
  coeffs: { B: 12.0, C: 1.30, peakMu: 1.80, E: -0.80 },
};

// ── GT3 ───────────────────────────────────────────────────────────────────────
// FIA GT3 class: homologated GT car, ~500 hp, Michelin racing slicks
// Mass: 1300 kg (minimum + ballast), aero: 200 kg downforce at 200 kph
// Reference: FIA GT3 Technical Regulations, Michelin racing tyre data
const GT3: VehiclePreset = {
  id: 'gt3',
  label: 'GT3',
  description: 'FIA GT3 · 450 kW · Michelin slicks · RWD',
  params: {
    mass: 1300,
    wheelbase: 2.65,
    frontWeightFraction: 0.48,
    corneringStiffnessNPerDeg: 700,
    rearCorneringStiffnessNPerDeg: 750,
    cgHeight: 0.45,
    trackWidth: 1.90,
    tyreSectionWidth: 0.305,
    turnRadius: 80,
    speedKph: 150,
    vehicleClass: 'track',
    drivetrainType: 'RWD',
    throttlePercent: 0,
    enginePowerKW: 450,       // ~600 hp NA / turbocharged per homologation
    awdFrontBias: 0.40,
    frontSpringRate: 80000,
    rearSpringRate:  90000,
    frontARBRate:    25000,
    rearARBRate:     20000,
    brakingG:   0,
    brakeBias:  0.60,
    aeroCL:            2.00,
    aeroCD:            0.85,
    aeroReferenceArea: 1.85,
    aeroBalance:       0.44,
    tyreLoadSensitivity: 0.15,
    tyreOptTempC:       90,
    tyreTempHalfWidthC: 30,
    tyreTempCurrentC:   90,
    tyreTempFloorMu:    0.55,
    gearCount:        6,
    firstGearRatio:   3.00,
    topGearRatio:     0.75,
    finalDriveRatio:  3.60,
    wheelRadiusM:     0.33,   // 18" wheel + 305/680R18
    enginePeakRpm:    7500,
    engineRedlineRpm: 8200,
    fuelLoadKg:           65,
    fuelBurnRateKgPerLap: 4.0,
    frontCamberDeg: -3.0,   // FIA GT3 homologated setup range
    rearCamberDeg:  -1.5,
    frontToeDeg:     0.0,
    rearToeDeg:      0.3,   // rear toe-in for high-speed stability
    tyreCompound: 'medium',
    altitudeM: 0, ambientTempC: 20, windSpeedKph: 0, windAngleDeg: 0,
    driverAggression: 0.8,
  },
  coeffs: { B: 10.0, C: 1.35, peakMu: 1.60, E: -0.70 },
};

// ── Formula 1 (2024) ──────────────────────────────────────────────────────────
// FIA F1 Technical Regulations 2024: 798 kg minimum, hybrid PU ~800 kW total
// Ground effect floor + complex aero: ~4.0 CL at reference speed
// Pirelli C3 medium compound slick (nominal)
// Reference: FIA Technical Regulations 2024, Pirelli tyre data
const FORMULA_1: VehiclePreset = {
  id: 'f1',
  label: 'Formula 1',
  description: 'FIA F1 2024 · 800 kW · Pirelli slicks · Ground effect',
  params: {
    mass: 800,
    wheelbase: 3.60,
    frontWeightFraction: 0.455,
    corneringStiffnessNPerDeg: 950,
    rearCorneringStiffnessNPerDeg: 1000,
    cgHeight: 0.28,
    trackWidth: 2.00,
    tyreSectionWidth: 0.305,
    turnRadius: 100,
    speedKph: 200,
    vehicleClass: 'motorsport',
    drivetrainType: 'RWD',
    throttlePercent: 0,
    enginePowerKW: 800,       // ~600 kW ICE + ~120 kW MGU-K
    awdFrontBias: 0.40,
    frontSpringRate: 200000,
    rearSpringRate:  250000,
    frontARBRate:    80000,
    rearARBRate:     60000,
    brakingG:   0,
    brakeBias:  0.58,
    aeroCL:            4.00,  // ground effect + wings; ~1600 N at 200 kph
    aeroCD:            1.05,
    aeroReferenceArea: 1.50,
    aeroBalance:       0.42,  // slight rear bias (ground effect dominant)
    tyreLoadSensitivity: 0.20,
    tyreOptTempC:       95,
    tyreTempHalfWidthC: 22,
    tyreTempCurrentC:   95,
    tyreTempFloorMu:    0.50,
    gearCount:        8,
    firstGearRatio:   4.00,
    topGearRatio:     0.65,
    finalDriveRatio:  3.10,
    wheelRadiusM:     0.34,   // 18" wheel + 30-profile tyre, ~660 mm OD
    enginePeakRpm:    10500,
    engineRedlineRpm: 15000,
    fuelLoadKg:           110,
    fuelBurnRateKgPerLap: 3.5,
    frontCamberDeg: -3.5,   // FIA F1 2024 — max allowed ≈ −3.5°F / −2.5°R
    rearCamberDeg:  -2.5,
    frontToeDeg:    -0.05,  // slight toe-out front (reduces scrub in slow corners)
    rearToeDeg:      0.1,   // minimal rear toe-in (ground effect provides stability)
    tyreCompound: 'soft',
    altitudeM: 0, ambientTempC: 30, windSpeedKph: 0, windAngleDeg: 0,
    driverAggression: 0.9,
  },
  coeffs: { B: 15.0, C: 1.40, peakMu: 2.00, E: -1.00 },
};

export const VEHICLE_PRESETS: VehiclePreset[] = [
  ROAD_CAR,
  FORMULA_STUDENT,
  GT3,
  FORMULA_1,
];
