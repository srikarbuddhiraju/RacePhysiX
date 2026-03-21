/**
 * Export utilities — Item 5.
 *
 * exportParamsAndResultsCSV: serialises vehicle params + key results to CSV.
 * exportLapTimeCSV: serialises lap time + segment breakdown for a chosen circuit.
 * exportChartAsSVG: grabs an SVG element from the DOM and downloads it.
 */

import type { VehicleParams, PhysicsResult, PacejkaResult, PacejkaCoeffs } from '../physics/types';
import type { LapResult } from '../physics/laptime';

// ── Internal helper ───────────────────────────────────────────────────────────

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── CSV export ────────────────────────────────────────────────────────────────

/** Converts params + results to a two-column CSV and triggers download. */
export function exportParamsAndResultsCSV(
  params:  VehicleParams,
  bicycle: PhysicsResult,
  pacejka: PacejkaResult,
): void {
  const rows: [string, string | number][] = [
    ['RacePhysiX export', new Date().toISOString()],
    ['', ''],
    ['--- Vehicle parameters ---', ''],
    ['mass_kg',                  params.mass],
    ['wheelbase_m',              params.wheelbase],
    ['front_weight_fraction',    params.frontWeightFraction],
    ['cornering_stiffness_N_deg',params.corneringStiffnessNPerDeg],
    ['cg_height_m',              params.cgHeight],
    ['track_width_m',            params.trackWidth],
    ['turn_radius_m',            params.turnRadius],
    ['speed_kph',                params.speedKph],
    ['drivetrain',               params.drivetrainType],
    ['throttle_pct',             params.throttlePercent],
    ['engine_power_kW',          params.enginePowerKW],
    ['front_spring_N_m',         params.frontSpringRate],
    ['rear_spring_N_m',          params.rearSpringRate],
    ['front_ARB_N_m',            params.frontARBRate],
    ['rear_ARB_N_m',             params.rearARBRate],
    ['braking_g',                params.brakingG],
    ['brake_bias',               params.brakeBias],
    ['aero_CL',                  params.aeroCL],
    ['aero_CD',                  params.aeroCD],
    ['aero_area_m2',             params.aeroReferenceArea],
    ['aero_balance',             params.aeroBalance],
    ['', ''],
    ['--- Bicycle model results ---', ''],
    ['understeer_gradient_deg_g', bicycle.underSteerGradientDegPerG.toFixed(4)],
    ['lateral_acceleration_g',    bicycle.lateralAccelerationG.toFixed(4)],
    ['front_slip_angle_deg',      bicycle.frontSlipAngleDeg.toFixed(4)],
    ['rear_slip_angle_deg',       bicycle.rearSlipAngleDeg.toFixed(4)],
    ['total_steer_deg',           bicycle.totalSteerAngleDeg.toFixed(4)],
    ['', ''],
    ['--- Pacejka / Stage 3–6 results ---', ''],
    ['aero_downforce_N',       pacejka.aeroDownforceN.toFixed(1)],
    ['aero_drag_N',            pacejka.aeroDragN.toFixed(1)],
    ['roll_angle_deg',         pacejka.rollAngleDeg.toFixed(3)],
    ['roll_stiff_front_Nm_deg',pacejka.rollStiffFront.toFixed(1)],
    ['roll_stiff_rear_Nm_deg', pacejka.rollStiffRear.toFixed(1)],
    ['FzFL_N',                 pacejka.FzFL.toFixed(1)],
    ['FzFR_N',                 pacejka.FzFR.toFixed(1)],
    ['FzRL_N',                 pacejka.FzRL.toFixed(1)],
    ['FzRR_N',                 pacejka.FzRR.toFixed(1)],
    ['front_lat_utilisation',  pacejka.frontUtilisation.toFixed(3)],
    ['rear_lat_utilisation',   pacejka.rearUtilisation.toFixed(3)],
    ['front_combined_util',    pacejka.frontCombinedUtil.toFixed(3)],
    ['rear_combined_util',     pacejka.rearCombinedUtil.toFixed(3)],
    ['FxBrakeFront_N',         pacejka.FxBrakeFront.toFixed(1)],
    ['FxBrakeRear_N',          pacejka.FxBrakeRear.toFixed(1)],
    ['abs_active_front',       pacejka.absActiveFront ? 'yes' : 'no'],
    ['abs_active_rear',        pacejka.absActiveRear  ? 'yes' : 'no'],
    ['lateral_accel_g',        pacejka.lateralAccelerationG.toFixed(4)],
    ['balance',                pacejka.balance],
  ];

  const csv = rows.map(([k, v]) => `"${k}","${v}"`).join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv' }), 'racephysix_export.csv');
}

// ── Lap time CSV export ───────────────────────────────────────────────────────

function fmtTimeCsv(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : `${s.toFixed(3)}s`;
}

/** Exports lap time summary + per-segment breakdown for the chosen circuit. */
export function exportLapTimeCSV(
  circuitName: string,
  result: LapResult,
  params: VehicleParams,
  coeffs: PacejkaCoeffs,
): void {
  const headerRows = [
    ['RacePhysiX Lap Time Export', new Date().toISOString()],
    ['', ''],
    ['--- Circuit ---', ''],
    ['circuit',       circuitName],
    ['total_length_m', result.totalLengthM.toFixed(0)],
    ['', ''],
    ['--- Vehicle (summary) ---', ''],
    ['mass_kg',        String(params.mass)],
    ['engine_power_kW',String(params.enginePowerKW)],
    ['drivetrain',     params.drivetrainType],
    ['peak_mu',        coeffs.peakMu.toFixed(2)],
    ['aero_CL',        params.aeroCL.toFixed(2)],
    ['aero_CD',        params.aeroCD.toFixed(2)],
    ['', ''],
    ['--- Lap summary ---', ''],
    ['lap_time',        fmtTimeCsv(result.totalTimeSec)],
    ['lap_time_sec',    result.totalTimeSec.toFixed(3)],
    ['avg_speed_kph',   result.avgSpeedKph.toFixed(1)],
    ['top_speed_kph',   result.maxSpeedKph.toFixed(1)],
    ['min_corner_kph',  result.minCornerKph.toFixed(1)],
    ['', ''],
    ['--- Segment breakdown ---', ''],
  ];

  const segmentHeader = ['segment', 'type', 'length_m', 'time_sec', 'entry_kph', 'exit_kph', 'min_kph', 'max_kph', 'time_pct'];

  const csv =
    headerRows.map(r => r.map(v => `"${v}"`).join(',')).join('\n') + '\n' +
    segmentHeader.map(v => `"${v}"`).join(',') + '\n' +
    result.segments.map(seg => {
      const pct = (seg.timeSec / result.totalTimeSec * 100).toFixed(1);
      return [
        seg.label, seg.type, seg.length.toFixed(0),
        seg.timeSec.toFixed(3),
        seg.entrySpeedKph.toFixed(1), seg.exitSpeedKph.toFixed(1),
        seg.minSpeedKph.toFixed(1), seg.maxSpeedKph.toFixed(1),
        pct,
      ].map(v => `"${v}"`).join(',');
    }).join('\n');

  const safeCircuit = circuitName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  downloadBlob(new Blob([csv], { type: 'text/csv' }), `racephysix_laptime_${safeCircuit}.csv`);
}

// ── SVG export ────────────────────────────────────────────────────────────────

/**
 * Finds an SVG element inside containerRef and downloads it as an .svg file.
 * Works for Recharts-rendered SVGs (they embed inline styles).
 */
export function exportChartAsSVG(container: HTMLElement | null, filename = 'chart.svg'): void {
  if (!container) return;
  const svg = container.querySelector('svg');
  if (!svg) { console.warn('exportChartAsSVG: no <svg> found in container'); return; }

  // Clone so we can mutate without affecting the DOM
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  if (!clone.getAttribute('width'))  clone.setAttribute('width',  String(svg.clientWidth  || 400));
  if (!clone.getAttribute('height')) clone.setAttribute('height', String(svg.clientHeight || 300));

  const serialized = new XMLSerializer().serializeToString(clone);
  downloadBlob(new Blob([serialized], { type: 'image/svg+xml' }), filename);
}
