/**
 * Tyre Curve Chart — Fy vs slip angle α (Pacejka Magic Formula)
 *
 * Shows the full lateral force curve for front and rear axles.
 * Moving dots show the current operating slip angle + force for each axle.
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { PacejkaResult } from '../physics/types';

interface Props {
  result: PacejkaResult;
}

const FRONT_COLOR = '#60a5fa'; // blue-400
const REAR_COLOR  = '#f87171'; // red-400

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#13131c',
  border: '1px solid #2a2a3a',
  borderRadius: 6,
  fontSize: 11,
  color: '#c0c0e0',
};

export function TyreCurveChart({ result }: Props) {
  const { curveData, frontOpAlphaDeg, frontOpFyKN, rearOpAlphaDeg, rearOpFyKN } = result;

  // Determine y-axis max from the curve peak, rounded up
  const peakKN   = Math.max(...curveData.map(p => Math.max(p.FyFrontKN, p.FyRearKN)));
  const yMax     = Math.ceil(peakKN * 10) / 10;

  return (
    <div className="chart-block">
      <div className="chart-title">Tyre Lateral Force — Fy vs α</div>
      <div className="chart-sub">Pacejka Magic Formula · front (blue) / rear (red)</div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={curveData} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />

          <XAxis
            dataKey="alphaDeg"
            type="number"
            domain={[-15, 15]}
            tickCount={7}
            tick={{ fill: '#5a5a7a', fontSize: 10 }}
            label={{ value: 'Slip angle α (deg)', position: 'insideBottom', offset: -2, fill: '#4a4a6a', fontSize: 10 }}
          />
          <YAxis
            domain={[-yMax, yMax]}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fill: '#5a5a7a', fontSize: 10 }}
            label={{ value: 'Fy (kN)', angle: -90, position: 'insideLeft', offset: 10, fill: '#4a4a6a', fontSize: 10 }}
          />

          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [`${Number(value).toFixed(3)} kN`, String(name)]}
            labelFormatter={(label: unknown) => `α = ${Number(label).toFixed(1)}°`}
          />
          <Legend
            wrapperStyle={{ fontSize: 10, color: '#5a5a7a' }}
            iconType="line"
          />

          {/* Linear model limit */}
          <ReferenceLine x={5}  stroke="#facc15" strokeDasharray="4 4" strokeOpacity={0.5} />
          <ReferenceLine x={-5} stroke="#facc15" strokeDasharray="4 4" strokeOpacity={0.5} />

          <Line
            dataKey="FyFrontKN"
            name="Front axle"
            stroke={FRONT_COLOR}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            dataKey="FyRearKN"
            name="Rear axle"
            stroke={REAR_COLOR}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />

          {/* Operating point dots */}
          <ReferenceDot
            x={frontOpAlphaDeg}
            y={frontOpFyKN}
            r={5}
            fill={FRONT_COLOR}
            stroke="#0a0a12"
            strokeWidth={2}
          />
          <ReferenceDot
            x={rearOpAlphaDeg}
            y={rearOpFyKN}
            r={5}
            fill={REAR_COLOR}
            stroke="#0a0a12"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Utilisation bars */}
      <div className="utilisation-row">
        <UtilBar label="Front grip" value={result.frontUtilisation} color={FRONT_COLOR} />
        <UtilBar label="Rear grip"  value={result.rearUtilisation}  color={REAR_COLOR}  />
      </div>
    </div>
  );
}

function UtilBar({ label, value, color }: { label: string; value: number; color: string }) {
  const pct    = Math.min(value, 1) * 100;
  const danger = value > 0.9;
  return (
    <div className="util-bar-wrap">
      <div className="util-bar-header">
        <span className="util-bar-label">{label}</span>
        <span className="util-bar-pct" style={{ color: danger ? '#f43f5e' : color }}>
          {(value * 100).toFixed(0)}%
        </span>
      </div>
      <div className="util-bar-track">
        <div
          className="util-bar-fill"
          style={{ width: `${pct}%`, background: danger ? '#f43f5e' : color }}
        />
      </div>
    </div>
  );
}
