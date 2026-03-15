import type { PhysicsResult } from '../physics/types';
import './ResultsPanel.css';

interface Props {
  result: PhysicsResult;
}

const BALANCE_CONFIG = {
  understeer: { label: 'UNDERSTEER', color: '#f97316' },
  neutral:    { label: 'NEUTRAL',    color: '#4ade80' },
  oversteer:  { label: 'OVERSTEER',  color: '#f43f5e' },
};

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}

function Metric({ label, value, sub, highlight }: MetricProps) {
  return (
    <div className={`metric ${highlight ? 'metric--highlight' : ''}`}>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      <div className="metric-label">{label}</div>
    </div>
  );
}

export function ResultsPanel({ result }: Props) {
  const bc = BALANCE_CONFIG[result.balance];

  const kSign = result.underSteerGradientDegPerG >= 0 ? '+' : '';

  // Linear model valid only up to ~4–5° slip angle
  const LINEAR_LIMIT_DEG = 5;
  const modelWarning =
    result.frontSlipAngleDeg > LINEAR_LIMIT_DEG ||
    result.rearSlipAngleDeg  > LINEAR_LIMIT_DEG;

  return (
    <div className="results-panel">

      {modelWarning && (
        <div className="model-warning">
          ⚠ Slip angles exceed ~5° — linear model out of range. Results indicative only.
        </div>
      )}

      <div className="balance-badge" style={{ borderColor: bc.color, color: bc.color }}>
        {bc.label}
        <span className="balance-diff">
          {result.slipAngleDiffDeg >= 0 ? '+' : ''}
          {result.slipAngleDiffDeg.toFixed(2)}° (αf − αr)
        </span>
      </div>

      <div className="metrics-grid">
        <Metric
          label="Lat. acceleration"
          value={result.lateralAccelerationG.toFixed(2)}
          sub="g"
        />
        <Metric
          label="Understeer gradient K"
          value={`${kSign}${result.underSteerGradientDegPerG.toFixed(2)}`}
          sub="deg/g"
          highlight={Math.abs(result.underSteerGradientDegPerG) > 2}
        />
        <Metric
          label="Front slip angle αf"
          value={result.frontSlipAngleDeg.toFixed(2)}
          sub="deg"
        />
        <Metric
          label="Rear slip angle αr"
          value={result.rearSlipAngleDeg.toFixed(2)}
          sub="deg"
        />
        <Metric
          label="Steer — kinematic"
          value={result.kinematicSteerAngleDeg.toFixed(2)}
          sub="deg (L/R)"
        />
        <Metric
          label="Steer — dynamic correction"
          value={`${result.dynamicCorrectionDeg >= 0 ? '+' : ''}${result.dynamicCorrectionDeg.toFixed(2)}`}
          sub="deg (K·ay)"
        />
        <Metric
          label="Total steer angle δ"
          value={result.totalSteerAngleDeg.toFixed(2)}
          sub="deg"
        />
        <Metric
          label="Yaw rate"
          value={(result.yawRateRadPerS * 180 / Math.PI).toFixed(1)}
          sub="deg/s"
        />
      </div>

      <div className="forces-row">
        <div className="force-item">
          <span className="force-label">Front Fy</span>
          <span className="force-value">{(result.frontLateralForceN / 1000).toFixed(2)} kN</span>
        </div>
        <div className="force-item">
          <span className="force-label">Rear Fy</span>
          <span className="force-value">{(result.rearLateralForceN / 1000).toFixed(2)} kN</span>
        </div>
      </div>

    </div>
  );
}
