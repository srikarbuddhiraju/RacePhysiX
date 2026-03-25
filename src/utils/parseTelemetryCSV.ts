/**
 * parseTelemetryCSV — Stage 39.
 *
 * Parses a RacePhysiX Lap Trace CSV (Stage 38 format) or any generic telemetry
 * CSV that contains at minimum dist_m and speed_kph columns.
 *
 * Required columns : dist_m, speed_kph
 * Optional columns : time_s, gear, rpm, long_g, lat_g, zone
 */

export interface ParsedTelemetryRow {
  distM:    number;
  timeSec:  number;
  speedKph: number;
  gear?:    number;
  rpm?:     number;
  longG?:   number;
  latG?:    number;
  zone?:    string;
}

export interface ParsedTelemetry {
  rows:         ParsedTelemetryRow[];
  filename:     string;
  lapLabel?:    string;   // e.g. "lap1"
  circuitName?: string;   // e.g. "Spa-Francorchamps (7.004 km)"
}

// ── helpers ───────────────────────────────────────────────────────────────────

function num(s: string): number { return parseFloat(s.trim()); }

// Linear interpolation: given sorted xs/ys, interpolate at x.
export function interp(xs: number[], ys: (number | undefined)[], x: number): number | undefined {
  if (xs.length === 0) return undefined;
  if (x <= xs[0])  return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  let lo = 0, hi = xs.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (xs[mid] <= x) lo = mid; else hi = mid;
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo]);
  const ylo = ys[lo], yhi = ys[hi];
  if (ylo === undefined || yhi === undefined) return undefined;
  return ylo + t * (yhi - ylo);
}

// ── main parser ───────────────────────────────────────────────────────────────

export function parseTelemetryCSV(text: string, filename: string): ParsedTelemetry | null {
  const lines = text.split(/\r?\n/);

  let lapLabel:    string | undefined;
  let circuitName: string | undefined;

  // Scan comment lines for our header: "# RacePhysiX Lap Trace — {circuit} — {label}"
  for (const line of lines) {
    if (!line.startsWith('#')) break;
    const m = line.match(/^#\s*RacePhysiX Lap Trace\s*[—-]\s*(.+?)\s*[—-]\s*(.+?)\s*$/);
    if (m) { circuitName = m[1].trim(); lapLabel = m[2].trim(); }
  }

  // Find header row (first non-comment, non-blank line)
  const headerIdx = lines.findIndex(l => l.trim() !== '' && !l.startsWith('#'));
  if (headerIdx === -1) { console.error('parseTelemetryCSV: no header row found'); return null; }

  const headers = lines[headerIdx].split(',').map(h => h.trim().toLowerCase());
  const col = (name: string) => headers.indexOf(name);

  const iDist  = col('dist_m');
  const iSpeed = col('speed_kph');
  if (iDist === -1 || iSpeed === -1) {
    console.error('parseTelemetryCSV: missing required columns dist_m / speed_kph');
    return null;
  }

  const iTime = col('time_s');
  const iGear = col('gear');
  const iRpm  = col('rpm');
  const iLong = col('long_g');
  const iLat  = col('lat_g');
  const iZone = col('zone');

  const rows: ParsedTelemetryRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('#')) continue;
    const parts = line.split(',');
    const distM    = num(parts[iDist]);
    const speedKph = num(parts[iSpeed]);
    if (!isFinite(distM) || !isFinite(speedKph) || speedKph < 0) continue;
    rows.push({
      distM,
      timeSec:  iTime >= 0 ? (isFinite(num(parts[iTime]))  ? num(parts[iTime])  : 0) : 0,
      speedKph,
      gear:     iGear >= 0 ? (isFinite(num(parts[iGear]))  ? num(parts[iGear])  : undefined) : undefined,
      rpm:      iRpm  >= 0 ? (isFinite(num(parts[iRpm]))   ? num(parts[iRpm])   : undefined) : undefined,
      longG:    iLong >= 0 ? (isFinite(num(parts[iLong]))  ? num(parts[iLong])  : undefined) : undefined,
      latG:     iLat  >= 0 ? (isFinite(num(parts[iLat]))   ? num(parts[iLat])   : undefined) : undefined,
      zone:     iZone >= 0 ? parts[iZone]?.trim() : undefined,
    });
  }

  if (rows.length < 10) {
    console.error(`parseTelemetryCSV: only ${rows.length} valid rows (need ≥ 10)`);
    return null;
  }

  return { rows, filename, lapLabel, circuitName };
}
