/**
 * TelemetryOverlayChart — Stage 39.
 *
 * Overlays an uploaded telemetry CSV against the current sim lap trace.
 * Three charts stacked vertically: Speed / Lat-G / Long-G vs distance (m).
 * Sim = orange (#f97316), Uploaded = sky (#38bdf8).
 */

import React, { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';
import type { TracePoint } from '../physics/laptime';
import { interp } from '../utils/parseTelemetryCSV';
import type { ParsedTelemetry } from '../utils/parseTelemetryCSV';

interface Props {
  simTrace: TracePoint[];
  uploaded: ParsedTelemetry;
  onClose:  () => void;
}

const SIM_COLOR = '#f97316';   // orange — brand accent
const UP_COLOR  = '#38bdf8';   // sky blue — uploaded data

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#13131c',
  border: '1px solid #2a2a3a',
  borderRadius: 6,
  fontSize: 11,
  color: '#c0c0e0',
};

const TICK_STYLE = { fill: '#5a5a7a', fontSize: 10 };

// ── merged data row ───────────────────────────────────────────────────────────

interface MergedRow {
  dist:     number;
  simSpeed: number;
  upSpeed:  number | undefined;
  simLatG:  number;
  upLatG:   number | undefined;
  simLongG: number;
  upLongG:  number | undefined;
}

// ── component ─────────────────────────────────────────────────────────────────

export default function TelemetryOverlayChart({ simTrace, uploaded, onClose }: Props) {
  const { merged, simTopSpeed, upTopSpeed, simMinSpeed, upMinSpeed, simLapTime, upLapTime } =
    useMemo(() => {
      const upDists  = uploaded.rows.map(r => r.distM);
      const upSpeeds = uploaded.rows.map(r => r.speedKph);
      const upLatGs  = uploaded.rows.map(r => r.latG);
      const upLongGs = uploaded.rows.map(r => r.longG);
      const upTimes  = uploaded.rows.map(r => r.timeSec);

      const rows: MergedRow[] = simTrace.map(pt => ({
        dist:     Math.round(pt.distM),
        simSpeed: pt.speedKph,
        upSpeed:  interp(upDists, upSpeeds, pt.distM),
        simLatG:  pt.latG,
        upLatG:   interp(upDists, upLatGs,  pt.distM),
        simLongG: pt.longG,
        upLongG:  interp(upDists, upLongGs, pt.distM),
      }));

      const simSpeeds = simTrace.map(p => p.speedKph);
      const upSpeedsClean = upSpeeds.filter(isFinite);

      const upLapTime = upTimes.length > 0 && upTimes[upTimes.length - 1] > 0
        ? upTimes[upTimes.length - 1]
        : undefined;
      const simLapTime = simTrace.length > 0
        ? simTrace[simTrace.length - 1].timeSec
        : undefined;

      return {
        merged:       rows,
        simTopSpeed:  Math.max(...simSpeeds),
        upTopSpeed:   upSpeedsClean.length ? Math.max(...upSpeedsClean) : undefined,
        simMinSpeed:  Math.min(...simSpeeds),
        upMinSpeed:   upSpeedsClean.length ? Math.min(...upSpeedsClean) : undefined,
        simLapTime,
        upLapTime,
      };
    }, [simTrace, uploaded]);

  const hasLatG  = uploaded.rows.some(r => r.latG  !== undefined);
  const hasLongG = uploaded.rows.some(r => r.longG !== undefined);

  const fmtTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = (s - m * 60).toFixed(3).padStart(6, '0');
    return m > 0 ? `${m}:${sec}` : `${s.toFixed(3)}s`;
  };

  const deltaStr = (sim: number | undefined, up: number | undefined, unit = '', invert = false) => {
    if (sim === undefined || up === undefined) return '—';
    const d = invert ? up - sim : sim - up;
    const sign = d > 0 ? '+' : '';
    return `${sign}${d.toFixed(1)}${unit}`;
  };

  const subTitle = uploaded.circuitName
    ? `${uploaded.circuitName}${uploaded.lapLabel ? ' · ' + uploaded.lapLabel : ''}`
    : uploaded.filename;

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 6,
      padding: '10px 12px',
      marginTop: 10,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>Telemetry Overlay</div>
          <div style={{ fontSize: 10, color: '#5a5a7a', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {subTitle}
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#5a5a7a', fontSize: 16, lineHeight: 1, padding: '0 2px' }}
          title="Close overlay"
        >×</button>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 6, fontSize: 10 }}>
        <span style={{ color: SIM_COLOR }}>● Sim</span>
        <span style={{ color: UP_COLOR  }}>● Uploaded</span>
      </div>

      {/* Speed chart */}
      <div style={{ fontSize: 10, color: '#5a5a7a', marginBottom: 2 }}>Speed (kph)</div>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={merged} margin={{ top: 2, right: 8, bottom: 2, left: 28 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis dataKey="dist" type="number" tick={TICK_STYLE} tickFormatter={v => `${v}`} />
          <YAxis tick={TICK_STYLE} />
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [Number(v).toFixed(1), n === 'simSpeed' ? 'Sim' : 'Uploaded']} />
          <Line type="monotone" dataKey="simSpeed" stroke={SIM_COLOR} dot={false} strokeWidth={1.5} name="simSpeed" />
          <Line type="monotone" dataKey="upSpeed"  stroke={UP_COLOR}  dot={false} strokeWidth={1.5} name="upSpeed" connectNulls />
        </LineChart>
      </ResponsiveContainer>

      {/* Lat-G chart */}
      {(hasLatG || true) && (
        <>
          <div style={{ fontSize: 10, color: '#5a5a7a', marginTop: 6, marginBottom: 2 }}>Lateral G</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={merged} margin={{ top: 2, right: 8, bottom: 2, left: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="dist" type="number" tick={TICK_STYLE} />
              <YAxis tick={TICK_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [Number(v).toFixed(3), n === 'simLatG' ? 'Sim' : 'Uploaded']} />
              <Line type="monotone" dataKey="simLatG" stroke={SIM_COLOR} dot={false} strokeWidth={1.5} name="simLatG" />
              {hasLatG && <Line type="monotone" dataKey="upLatG" stroke={UP_COLOR} dot={false} strokeWidth={1.5} name="upLatG" connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Long-G chart */}
      {(hasLongG || true) && (
        <>
          <div style={{ fontSize: 10, color: '#5a5a7a', marginTop: 6, marginBottom: 2 }}>Longitudinal G</div>
          <ResponsiveContainer width="100%" height={100}>
            <LineChart data={merged} margin={{ top: 2, right: 8, bottom: 2, left: 28 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis dataKey="dist" type="number" tick={TICK_STYLE} tickFormatter={v => `${v}m`} />
              <YAxis tick={TICK_STYLE} />
              <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v, n) => [Number(v).toFixed(3), n === 'simLongG' ? 'Sim' : 'Uploaded']} />
              <Line type="monotone" dataKey="simLongG" stroke={SIM_COLOR} dot={false} strokeWidth={1.5} name="simLongG" />
              {hasLongG && <Line type="monotone" dataKey="upLongG" stroke={UP_COLOR} dot={false} strokeWidth={1.5} name="upLongG" connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </>
      )}

      {/* Δ stats */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '6px 18px',
        marginTop: 8, fontSize: 11, color: '#8888aa',
        borderTop: '1px solid var(--border)', paddingTop: 6,
      }}>
        <span>Δ top speed: <b style={{ color: 'var(--text)' }}>{deltaStr(simTopSpeed, upTopSpeed, ' kph')}</b></span>
        <span>Δ min corner: <b style={{ color: 'var(--text)' }}>{deltaStr(simMinSpeed, upMinSpeed, ' kph')}</b></span>
        {simLapTime !== undefined && upLapTime !== undefined && upLapTime > 0 && (
          <span>Δ lap time: <b style={{ color: 'var(--text)' }}>
            {deltaStr(simLapTime, upLapTime, 's')} ({fmtTime(simLapTime)} vs {fmtTime(upLapTime)})
          </b></span>
        )}
      </div>
    </div>
  );
}
