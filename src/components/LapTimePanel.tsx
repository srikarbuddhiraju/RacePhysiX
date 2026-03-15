import { useMemo, useState } from 'react';
import { computeLapTime, TRACK_PRESETS } from '../physics/laptime';
import type { TrackLayout } from '../physics/laptime';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import { InfoTooltip } from './InfoTooltip';
import { exportParamsAndResultsCSV } from '../utils/export';
import { computeBicycleModel } from '../physics/bicycleModel';
import { computePacejkaModel } from '../physics/pacejkaModel';

interface Props {
  params: VehicleParams;
  coeffs: PacejkaCoeffs;
}

const RHO_AIR = 1.225;

function fmtTime(sec: number): string {
  const m   = Math.floor(sec / 60);
  const s   = sec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : `${s.toFixed(3)}s`;
}

export function LapTimePanel({ params, coeffs }: Props) {
  const [trackKey, setTrackKey] = useState<string>('club');
  const layout = TRACK_PRESETS[trackKey];

  const result = useMemo(() => {
    const { mass, enginePowerKW, brakingG, aeroCL, aeroCD, aeroReferenceArea } = params;
    const peakMu = coeffs.peakMu;
    // Effective braking g: max of user setting and 0.9g default
    const brakingCapG = Math.max(brakingG, 0.9);

    const dragForce = (V: number) => 0.5 * RHO_AIR * V * V * aeroReferenceArea * aeroCD;

    return computeLapTime(layout, {
      mass, peakMu, enginePowerKW, brakingCapG,
      aeroCL, aeroCD, aeroReferenceArea, dragForce,
    });
  }, [params, coeffs, layout]);

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', height: '100%' }}>

      {/* Header + track selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Lap Time Estimator
          <InfoTooltip text="Point-mass lap simulation. Max corner speed from Pacejka μ + aero grip. Straight speed from engine P/V curve minus drag. Braking zones computed backward from corner entry." />
        </span>
        <button
          onClick={() => {
            const bicycle = computeBicycleModel(params);
            const pacejka = computePacejkaModel(params, coeffs);
            exportParamsAndResultsCSV(params, bicycle, pacejka);
          }}
          title="Export params + results as CSV"
          style={{
            marginLeft: 'auto', padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
        <select
          value={trackKey}
          onChange={e => setTrackKey(e.target.value)}
          style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-primary)', fontSize: 10,
            padding: '4px 8px', cursor: 'pointer', outline: 'none',
          }}
        >
          {Object.entries(TRACK_PRESETS).map(([k, v]) => (
            <option key={k} value={k}>{v.name}</option>
          ))}
        </select>
      </div>

      {/* Track map */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
        <TrackMapSVG layout={layout} />
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <SummaryCard label="Lap time" value={fmtTime(result.totalTimeSec)} accent />
        <SummaryCard label="Avg speed" value={`${result.avgSpeedKph.toFixed(1)} km/h`} />
        <SummaryCard label="Top speed" value={`${result.maxSpeedKph.toFixed(1)} km/h`} />
        <SummaryCard label="Min corner" value={`${result.minCornerKph.toFixed(1)} km/h`} />
      </div>

      {/* Segment breakdown */}
      <div style={{ fontSize: 9, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Segment breakdown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {result.segments.map((seg, i) => (
          <SegmentRow key={i} seg={seg} totalTime={result.totalTimeSec} />
        ))}
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4 }}>
        Point-mass model — no gear shifts, no tyre temp, no slip angle limits on straights.<br />
        Accuracy improves with Stage 3–6 parameters tuned to the actual vehicle.
      </div>
    </div>
  );
}

// ── Track map SVG ─────────────────────────────────────────────────────────────

function buildTrackPath(layout: TrackLayout): string {
  // Walk the track: straight = forward, corner = arc turn (always left-hand circuit)
  const SCALE = 0.4;  // pixels per metre
  let x = 0, y = 0, heading = 0;  // heading in radians, 0 = right (+x)
  const pts: string[] = [`M 0 0`];

  for (const seg of layout.segments) {
    if (seg.type === 'straight') {
      const dx = Math.cos(heading) * seg.length * SCALE;
      const dy = Math.sin(heading) * seg.length * SCALE;
      x += dx; y += dy;
      pts.push(`l ${dx.toFixed(1)} ${dy.toFixed(1)}`);
    } else if (seg.type === 'corner' && seg.radius) {
      // Arc: sweep angle = arcLength / radius (radians), always turning left
      const sweep = seg.length / seg.radius;  // radians
      const R = seg.radius * SCALE;
      // Centre of arc: perpendicular left of current heading
      const cx = x + Math.cos(heading - Math.PI / 2) * R;
      const cy = y + Math.sin(heading - Math.PI / 2) * R;
      // New end point on arc
      const newHeading = heading + sweep;
      const nx = cx + Math.cos(newHeading + Math.PI / 2) * R;
      const ny = cy + Math.sin(newHeading + Math.PI / 2) * R;
      // SVG arc: large-arc-flag=0 (sweep < π), sweep-flag=1 (clockwise in SVG coords)
      const largeArc = sweep > Math.PI ? 1 : 0;
      pts.push(`A ${R.toFixed(1)} ${R.toFixed(1)} 0 ${largeArc} 1 ${nx.toFixed(1)} ${ny.toFixed(1)}`);
      x = nx; y = ny;
      heading = newHeading;
    }
  }
  pts.push('Z');
  return pts.join(' ');
}

function TrackMapSVG({ layout }: { layout: TrackLayout }) {
  const path = useMemo(() => buildTrackPath(layout), [layout]);

  // Fit to a viewBox by measuring bounding box of the path (approx via a temp SVG element)
  const W = 220, H = 120;
  return (
    <svg
      viewBox={`-20 -20 ${W} ${H}`}
      width="100%"
      style={{ maxHeight: 110, display: 'block' }}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {/* Start/finish marker */}
      <circle cx="0" cy="0" r="3.5" fill="var(--accent-text)" />
    </svg>
  );
}

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--bg-active)' : 'var(--bg-card)',
      border: `1px solid ${accent ? 'var(--accent)' : 'var(--border-subtle)'}`,
      borderRadius: 6, padding: '7px 8px',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: accent ? 16 : 13, fontWeight: 700, color: accent ? 'var(--accent-text)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

function SegmentRow({ seg, totalTime }: { seg: import('../physics/laptime').SegmentResult; totalTime: number }) {
  const isCorner = seg.type === 'corner';
  const pct      = (seg.timeSec / totalTime) * 100;
  const color    = isCorner ? '#f87171' : '#60a5fa';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 48px 80px 1fr 48px',
      alignItems: 'center', gap: 6, fontSize: 10,
    }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: isCorner ? 600 : 400 }}>
        {seg.label}
      </span>
      <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtTime(seg.timeSec)}
      </span>
      <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>
        {isCorner
          ? `${seg.minSpeedKph.toFixed(0)} km/h`
          : `${seg.minSpeedKph.toFixed(0)}→${seg.maxSpeedKph.toFixed(0)} km/h`}
      </span>
      {/* time share bar */}
      <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 9, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
