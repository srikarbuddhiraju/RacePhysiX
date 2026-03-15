import { useMemo, useState } from 'react';
import { computeLapTime, TRACK_PRESETS } from '../physics/laptime';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import { InfoTooltip } from './InfoTooltip';

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
