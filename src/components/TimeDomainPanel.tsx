/**
 * TimeDomainPanel — Stage 8 time-domain simulation UI.
 *
 * Renders scenario picker, run button, and Recharts charts for:
 *   - Yaw rate (deg/s)
 *   - Lateral acceleration (g)
 *   - Roll angle (deg)
 *   - Scenario-specific charts (slip angles or wheel speeds)
 */

import { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ReferenceLine, ResponsiveContainer,
} from 'recharts';
import { runSimulation }  from '../physics/dynamics14dof';
import { SCENARIOS }      from '../physics/scenarios';
import type { ScenarioDef } from '../physics/scenarios';
import type { SimResult }   from '../physics/vehicleState';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import './TimeDomainPanel.css';

const RAD_TO_DEG = 180 / Math.PI;
const G          = 9.81;

interface Props {
  params: VehicleParams;
  coeffs: PacejkaCoeffs;
}

// ── Chart data point type ──────────────────────────────────────────────────────
interface ChartPt {
  t:         number;
  psiDotDeg: number;   // yaw rate  (deg/s)
  ayG:       number;   // lat accel (g)
  rollDeg:   number;   // roll angle (deg)
  // slip angles (deg) — step steer + sine sweep
  alphaFL:   number;
  alphaFR:   number;
  alphaRL:   number;
  alphaRR:   number;
  // wheel speeds (rpm) — brake-in-turn
  rpmFL:     number;
  rpmFR:     number;
  rpmRL:     number;
  rpmRR:     number;
}

function toChartData(results: SimResult[]): ChartPt[] {
  return results.map(r => ({
    t:         Math.round(r.t * 1000) / 1000,
    psiDotDeg: r.state.psiDot * RAD_TO_DEG,
    ayG:       r.ay / G,
    rollDeg:   r.state.phi * RAD_TO_DEG,
    alphaFL:   r.slipAngle[0] * RAD_TO_DEG,
    alphaFR:   r.slipAngle[1] * RAD_TO_DEG,
    alphaRL:   r.slipAngle[2] * RAD_TO_DEG,
    alphaRR:   r.slipAngle[3] * RAD_TO_DEG,
    rpmFL:     r.state.omegaFL * 60 / (2 * Math.PI),
    rpmFR:     r.state.omegaFR * 60 / (2 * Math.PI),
    rpmRL:     r.state.omegaRL * 60 / (2 * Math.PI),
    rpmRR:     r.state.omegaRR * 60 / (2 * Math.PI),
  }));
}

// ── Small chart wrapper ────────────────────────────────────────────────────────
function TdChart({
  label,
  data,
  dataKeys,
  colors,
  unit,
  refLines = [],
}: {
  label:    string;
  data:     ChartPt[];
  dataKeys: (keyof ChartPt)[];
  colors:   string[];
  unit:     string;
  refLines?: { x?: number; y?: number; label?: string }[];
}) {
  return (
    <div className="td-chart-row">
      <div className="td-chart-label">{label} ({unit})</div>
      <ResponsiveContainer width="100%" height={130}>
        <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="t"
            type="number"
            tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
            tickFormatter={v => v.toFixed(1)}
            domain={['dataMin', 'dataMax']}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--text-faint)' }}
            tickFormatter={v => v.toFixed(1)}
            width={42}
          />
          <Tooltip
            contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: 10 }}
            formatter={(val: unknown) => [(val as number).toFixed(3), '']}
            labelFormatter={l => `t = ${(l as number).toFixed(3)} s`}
          />
          {refLines.map((rl, i) =>
            rl.x !== undefined ? (
              <ReferenceLine key={i} x={rl.x} stroke="#f97316" strokeDasharray="4 3"
                label={{ value: rl.label, position: 'top', fontSize: 8, fill: '#f97316' }} />
            ) : (
              <ReferenceLine key={i} y={rl.y} stroke="#60a5fa" strokeDasharray="4 3"
                label={{ value: rl.label, position: 'right', fontSize: 8, fill: '#60a5fa' }} />
            )
          )}
          {dataKeys.map((key, i) => (
            <Line
              key={key as string}
              type="monotone"
              dataKey={key as string}
              stroke={colors[i]}
              dot={false}
              strokeWidth={1.5}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function TimeDomainPanel({ params, coeffs }: Props) {
  const [activeScenario, setScenario] = useState<ScenarioDef>(SCENARIOS[0]);
  const [results,        setResults]  = useState<SimResult[] | null>(null);
  const [isRunning,      setRunning]  = useState(false);

  const handleRun = () => {
    setRunning(true);
    setResults(null);
    // Defer to allow React to re-render the progress indicator first
    setTimeout(() => {
      const r = runSimulation(params, coeffs, activeScenario);
      setResults(r);
      setRunning(false);
    }, 0);
  };

  const chartData = results ? toChartData(results) : [];

  // Steady-state yaw rate reference: Vx / R
  const Vx_ss  = params.speedKph / 3.6;
  const rSS    = params.turnRadius;
  const psiSS  = (Vx_ss / rSS) * RAD_TO_DEG;  // deg/s

  // Reference lines per scenario
  const stepRefLines = [
    { x: 1.0, label: 'step' },
    { y: psiSS, label: `ψ̇_ss=${psiSS.toFixed(1)}` },
  ];
  const brakeRefLines = [
    { x: 2.0, label: 'brake' },
    { y: psiSS, label: `ψ̇_ss=${psiSS.toFixed(1)}` },
  ];
  const sweepRefLines: { x?: number; y?: number; label?: string }[] = [];

  const yawRefLines =
    activeScenario.id === 'step_steer'    ? stepRefLines  :
    activeScenario.id === 'brake_in_turn' ? brakeRefLines :
    sweepRefLines;

  const brakeEvent = activeScenario.id === 'brake_in_turn';
  const stepEvent  = activeScenario.id === 'step_steer';

  return (
    <div className="td-panel">

      {/* Scenario picker */}
      <div className="td-scenario-picker">
        {SCENARIOS.map(sc => (
          <button
            key={sc.id}
            className={`td-scenario-btn ${activeScenario.id === sc.id ? 'active' : ''}`}
            onClick={() => { setScenario(sc); setResults(null); }}
          >
            {sc.name}
          </button>
        ))}
      </div>

      {/* Run button / progress */}
      {isRunning ? (
        <div className="td-progress">Running simulation…</div>
      ) : (
        <button className="td-run-btn" onClick={handleRun} disabled={isRunning}>
          Run Simulation
        </button>
      )}

      {/* Charts */}
      {results === null && !isRunning && (
        <div className="td-empty">Select a scenario and press Run Simulation.</div>
      )}

      {results !== null && (
        <div className="td-charts-grid">

          {/* Yaw rate */}
          <TdChart
            label="Yaw Rate"
            data={chartData}
            dataKeys={['psiDotDeg']}
            colors={['#60a5fa']}
            unit="deg/s"
            refLines={yawRefLines}
          />

          {/* Lateral acceleration */}
          <TdChart
            label="Lateral Acceleration"
            data={chartData}
            dataKeys={['ayG']}
            colors={['#a78bfa']}
            unit="g"
            refLines={
              brakeEvent ? [{ x: 2.0, label: 'brake' }] :
              stepEvent  ? [{ x: 1.0, label: 'step'  }] : []
            }
          />

          {/* Roll angle */}
          <TdChart
            label="Roll Angle"
            data={chartData}
            dataKeys={['rollDeg']}
            colors={['#f97316']}
            unit="deg"
            refLines={
              brakeEvent ? [{ x: 2.0, label: 'brake' }] :
              stepEvent  ? [{ x: 1.0, label: 'step'  }] : []
            }
          />

          {/* Scenario-specific: slip angles for step steer + sine sweep */}
          {(activeScenario.id === 'step_steer' || activeScenario.id === 'sine_sweep') && (
            <TdChart
              label="Slip Angles"
              data={chartData}
              dataKeys={['alphaFL', 'alphaFR', 'alphaRL', 'alphaRR']}
              colors={['#22d3ee', '#34d399', '#f43f5e', '#fb923c']}
              unit="deg"
              refLines={stepEvent ? [{ x: 1.0, label: 'step' }] : []}
            />
          )}

          {/* Scenario-specific: wheel speeds for brake-in-turn */}
          {activeScenario.id === 'brake_in_turn' && (
            <TdChart
              label="Wheel Speeds"
              data={chartData}
              dataKeys={['rpmFL', 'rpmFR', 'rpmRL', 'rpmRR']}
              colors={['#22d3ee', '#34d399', '#f43f5e', '#fb923c']}
              unit="rpm"
              refLines={[{ x: 2.0, label: 'brake' }]}
            />
          )}

        </div>
      )}

    </div>
  );
}
