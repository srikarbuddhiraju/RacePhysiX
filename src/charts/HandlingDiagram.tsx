/**
 * Handling Diagram — steer correction (δ − L/R) vs lateral acceleration (ay)
 *
 * Classic vehicle dynamics handling diagram. Curve gradient = instantaneous K.
 * With Pacejka tyres the curve is nonlinear — slope steepens as tyres saturate.
 *
 * Reference: docs/physics-reference/bicycle-model.md §8
 */

import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ReferenceDot, ResponsiveContainer,
} from 'recharts';
import type { PacejkaResult, PhysicsResult } from '../physics/types';

interface Props {
  pacejka: PacejkaResult;
  bicycle: PhysicsResult;
}

const PACEJKA_COLOR = '#a78bfa'; // violet-400
const LINEAR_COLOR  = '#4ade80'; // green-400

const TOOLTIP_STYLE: React.CSSProperties = {
  background: '#13131c',
  border: '1px solid #2a2a3a',
  borderRadius: 6,
  fontSize: 11,
  color: '#c0c0e0',
};

export function HandlingDiagram({ pacejka, bicycle }: Props) {
  const { handlingCurve, lateralAccelerationG } = pacejka;

  // Build linear bicycle model reference line (δ_corr = K × ay, a straight line)
  const K_degPerG = bicycle.underSteerGradientDegPerG;
  const linearData = handlingCurve.map(pt => ({
    ayG: pt.ayG,
    linearCorrDeg: K_degPerG * pt.ayG,
  }));

  // Merge into one dataset for recharts
  const data = handlingCurve.map((pt, i) => ({
    ...pt,
    linearCorrDeg: linearData[i].linearCorrDeg,
  }));

  // Y-axis range: find max steer correction
  const maxCorr = Math.max(
    ...handlingCurve.map(p => Math.abs(p.steerCorrDeg)),
    Math.abs(K_degPerG) * (handlingCurve[handlingCurve.length - 1]?.ayG ?? 1),
    0.5,
  );
  const yRange = Math.ceil(maxCorr * 1.2 * 10) / 10;

  // Find current steer correction at operating ay (nearest point)
  const nearestPt = handlingCurve.reduce((best, pt) =>
    Math.abs(pt.ayG - lateralAccelerationG) < Math.abs(best.ayG - lateralAccelerationG) ? pt : best,
    handlingCurve[0],
  );

  return (
    <div className="chart-block">
      <div className="chart-title">Handling Diagram</div>
      <div className="chart-sub">
        δ−L/R vs ay · Pacejka (violet) / Linear model (green dashed)
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />

          <XAxis
            dataKey="ayG"
            type="number"
            tickFormatter={(v: number) => v.toFixed(2)}
            tick={{ fill: '#5a5a7a', fontSize: 10 }}
            label={{ value: 'Lat. accel. ay (g)', position: 'insideBottom', offset: -2, fill: '#4a4a6a', fontSize: 10 }}
          />
          <YAxis
            domain={[-yRange, yRange]}
            tickFormatter={(v: number) => v.toFixed(1)}
            tick={{ fill: '#5a5a7a', fontSize: 10 }}
            label={{ value: 'δ steer (deg)', angle: -90, position: 'insideLeft', offset: 10, fill: '#4a4a6a', fontSize: 10 }}
          />

          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: unknown, name: unknown) => [`${Number(value).toFixed(3)}°`, String(name)]}
            labelFormatter={(label: unknown) => `ay = ${Number(label).toFixed(3)} g`}
          />

          {/* Zero-correction reference */}
          <ReferenceLine y={0} stroke="#2a2a3a" strokeWidth={1} />

          {/* Current operating ay */}
          <ReferenceLine
            x={lateralAccelerationG}
            stroke="#facc15"
            strokeDasharray="4 4"
            strokeOpacity={0.6}
          />

          {/* Linear bicycle model prediction (dashed) */}
          <Line
            dataKey="linearCorrDeg"
            name="Linear (bicycle)"
            stroke={LINEAR_COLOR}
            strokeWidth={1.5}
            strokeDasharray="6 3"
            dot={false}
            isAnimationActive={false}
          />

          {/* Pacejka nonlinear handling curve */}
          <Line
            dataKey="steerCorrDeg"
            name="Pacejka"
            stroke={PACEJKA_COLOR}
            strokeWidth={2.5}
            dot={false}
            isAnimationActive={false}
          />

          {/* Current operating point */}
          <ReferenceDot
            x={nearestPt.ayG}
            y={nearestPt.steerCorrDeg}
            r={8}
            fill={PACEJKA_COLOR}
            stroke="#facc15"
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* K annotation */}
      <div className="handling-annotation">
        <span className="ha-label">K (bicycle model)</span>
        <span className="ha-value" style={{ color: K_degPerG >= 0 ? '#f97316' : '#f43f5e' }}>
          {K_degPerG >= 0 ? '+' : ''}{K_degPerG.toFixed(2)} deg/g
        </span>
        <span className="ha-label" style={{ marginLeft: 16 }}>Current ay</span>
        <span className="ha-value">{lateralAccelerationG.toFixed(3)} g</span>
        <span className="ha-label" style={{ marginLeft: 16 }}>Steer corr.</span>
        <span className="ha-value">{nearestPt.steerCorrDeg.toFixed(3)}°</span>
      </div>
    </div>
  );
}
