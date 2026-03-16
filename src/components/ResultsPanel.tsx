import type React from 'react';
import type { PhysicsResult, PacejkaResult } from '../physics/types';
import { InfoTooltip } from './InfoTooltip';
import './ResultsPanel.css';

interface Props {
  result:   PhysicsResult;
  pacejka?: PacejkaResult;
}

const BALANCE_CONFIG = {
  understeer: { label: 'UNDERSTEER', color: '#60a5fa' },  // blue = industry convention (MoTeC/Bosch)
  neutral:    { label: 'NEUTRAL',    color: '#4ade80' },
  oversteer:  { label: 'OVERSTEER',  color: '#f43f5e' },
};

interface MetricProps {
  label:     string;
  value:     string;
  sub?:      React.ReactNode;
  highlight?: boolean;
  tip:       string;
}

function Metric({ label, value, sub, highlight, tip }: MetricProps) {
  return (
    <div className={`metric ${highlight ? 'metric--highlight' : ''}`}>
      <div className="metric-value">{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
      <div className="metric-label">
        {label}
        <InfoTooltip text={tip} />
      </div>
    </div>
  );
}

export function ResultsPanel({ result, pacejka }: Props) {
  const bc    = BALANCE_CONFIG[result.balance];
  const kSign = result.underSteerGradientDegPerG >= 0 ? '+' : '';

  const LINEAR_LIMIT_DEG = 5;
  const modelWarning =
    result.frontSlipAngleDeg > LINEAR_LIMIT_DEG ||
    result.rearSlipAngleDeg  > LINEAR_LIMIT_DEG;

  return (
    <div className="results-panel">

      {modelWarning && (
        <div className="model-warning">
          ⚠ Slip angles exceed ~5° — linear model out of range. Results indicative only. See Pacejka charts below for accurate forces.
        </div>
      )}

      <div
        className="balance-badge"
        style={{ borderColor: bc.color, color: bc.color }}
        title="Whether the front or rear axle is generating more slip angle. Understeer = front slips more. Oversteer = rear slips more."
      >
        {bc.label}
        <span className="balance-diff">
          {result.slipAngleDiffDeg >= 0 ? '+' : ''}
          {result.slipAngleDiffDeg.toFixed(2)}° (αf − αr)
        </span>
      </div>

      <div className="metrics-grid">
        <Metric
          label="Lat. acceleration"
          value={result.lateralAccelerationG.toFixed(3)}
          sub={<>g <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>({(result.lateralAccelerationG * 9.81).toFixed(2)} m/s²)</span></>}
          tip="Centripetal acceleration in the corner = V²/R divided by g. At 1g the car is at the grip limit of a typical road tyre. This drives all lateral tyre forces."
        />
        <Metric
          label="Understeer gradient K"
          value={`${kSign}${result.underSteerGradientDegPerG.toFixed(2)}`}
          sub="deg/g"
          highlight={Math.abs(result.underSteerGradientDegPerG) > 2}
          tip="Extra steering angle the driver must add per g of lateral acceleration. K > 0 = understeer (more steer needed as speed rises). K < 0 = oversteer (less steer needed; car becomes unstable above critical speed). K = 0 = neutral steer."
        />
        <Metric
          label="Front slip αf"
          value={result.frontSlipAngleDeg.toFixed(1)}
          sub="deg"
          tip="Angle between the front tyre's velocity direction and its heading. The tyre builds lateral force as α increases. Linear model valid up to ~5°; above that Pacejka is needed."
        />
        <Metric
          label="Rear slip αr"
          value={result.rearSlipAngleDeg.toFixed(1)}
          sub="deg"
          tip="Angle between the rear tyre's velocity direction and its heading. If αr > αf the rear is working harder = oversteer tendency. If αf > αr = understeer."
        />
        <Metric
          label="Steer — kinematic"
          value={result.kinematicSteerAngleDeg.toFixed(3)}
          sub="deg (each wheel)"
          tip="Pure geometry steer angle to follow this arc at zero speed — Ackermann steer angle = wheelbase ÷ radius (rad). This is the angle at one front wheel. Independent of speed and tyre properties."
        />
        <Metric
          label="Dynamic correction"
          value={`${result.dynamicCorrectionDeg >= 0 ? '+' : ''}${result.dynamicCorrectionDeg.toFixed(3)}`}
          sub="deg (K·ay)"
          tip="Extra steer beyond the geometric angle needed to balance tyre slip. = K × ay. Positive = driver adds steer (understeer). Negative = driver removes steer (oversteer)."
        />
        <Metric
          label="Total steer δ"
          value={result.totalSteerAngleDeg.toFixed(3)}
          sub="deg"
          tip="Total steering input = kinematic + dynamic correction. This is the tyre steer angle. Divide by the steering ratio to get steering wheel angle."
        />
        <Metric
          label="Yaw rate"
          value={(result.yawRateRadPerS * 180 / Math.PI).toFixed(1)}
          sub="deg/s"
          tip="How fast the car rotates about its vertical axis. r = V/R. A higher speed or tighter corner = higher yaw rate. Important for stability control systems."
        />
      </div>

      <div className="forces-row">
        <div className="force-item">
          <span className="force-label">
            Front Fy
            <InfoTooltip text="Lateral force generated by the front axle (both tyres combined). Computed from moment equilibrium: Fyf = m·ay·b/L. This is what the front tyres must generate to keep the car on the arc." />
          </span>
          <span className="force-value">{(result.frontLateralForceN / 1000).toFixed(3)} kN</span>
        </div>
        <div className="force-item">
          <span className="force-label">
            Rear Fy
            <InfoTooltip text="Lateral force generated by the rear axle (both tyres combined). Fyr = m·ay·a/L. The front/rear split depends on CG position (a and b)." />
          </span>
          <span className="force-value">{(result.rearLateralForceN / 1000).toFixed(3)} kN</span>
        </div>
      </div>

      {/* ── Stage 3: Load transfer + drivetrain ────────────────────────── */}
      {pacejka && <Stage3Panel p={pacejka} />}

    </div>
  );
}

// ── Stage 3 panel ─────────────────────────────────────────────────────────────

function UtilBar({ label, pct, color }: { label: string; pct: number; color: string }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, marginBottom: 3 }}>
        <span style={{ color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{(pct * 100).toFixed(0)}%</span>
      </div>
      <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct * 100, 100)}%`, background: color, borderRadius: 2, transition: 'width 0.1s' }} />
      </div>
    </div>
  );
}

function DataRow({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, alignItems: 'center' }}>
      <span style={{ color: 'var(--text-faint)' }}>{label}{tip && <InfoTooltip text={tip} />}</span>
      <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</span>
    </div>
  );
}

function CornerLoad({ fz, highlight }: { fz: number; highlight?: boolean }) {
  return (
    <div style={{
      textAlign: 'center', padding: '5px 4px',
      background: highlight ? 'var(--bg-active)' : 'var(--bg-page)',
      borderRadius: 4,
      border: `1px solid ${highlight ? 'var(--accent)' : 'var(--border-subtle)'}`,
    }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>
        {(fz / 1000).toFixed(2)}
      </div>
      <div style={{ fontSize: 8, color: 'var(--text-muted)', marginTop: 1 }}>kN</div>
    </div>
  );
}

function Stage3Panel({ p }: { p: PacejkaResult }) {
  const hasFx = p.FxFront > 1 || p.FxRear > 1;
  // Highlight the more loaded corner (outside) in each row
  const frontOutsideMore = p.FzFR >= p.FzFL;
  const rearOutsideMore  = p.FzRR >= p.FzRL;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        Stage 3 — Load Transfer &amp; Drivetrain
      </div>

      {/* ── Per-corner loads ──────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 6 }}>
          Per-corner loads (Fz)
          <InfoTooltip text="Normal force Fz on each tyre after lateral + longitudinal load transfer. Outside tyres gain load in cornering. Unequal Fz changes the Pacejka curve per tyre → real grip loss captured." />
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px' }}>
          {/* Column headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr', gap: '3px 6px', alignItems: 'center' }}>
            <div />
            <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.06em' }}>INSIDE</div>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', textAlign: 'center', letterSpacing: '0.06em' }}>OUTSIDE</div>

            {/* Front row */}
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right', paddingRight: 4 }}>F</div>
            <CornerLoad fz={p.FzFL} highlight={!frontOutsideMore} />
            <CornerLoad fz={p.FzFR} highlight={frontOutsideMore} />

            {/* Rear row */}
            <div style={{ fontSize: 9, color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right', paddingRight: 4 }}>R</div>
            <CornerLoad fz={p.FzRL} highlight={!rearOutsideMore} />
            <CornerLoad fz={p.FzRR} highlight={rearOutsideMore} />
          </div>

          <div style={{ marginTop: 7, paddingTop: 6, borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, fontSize: 9, color: 'var(--text-faint)', flexWrap: 'wrap' }}>
            <span>Lat ΔFz front: <b style={{ color: 'var(--text-primary)' }}>{(p.latTransferFront / 1000).toFixed(2)} kN</b></span>
            <span>rear: <b style={{ color: 'var(--text-primary)' }}>{(p.latTransferRear / 1000).toFixed(2)} kN</b></span>
            {p.longTransfer > 10 && <span>Long ΔFz: <b style={{ color: 'var(--text-primary)' }}>{(p.longTransfer / 1000).toFixed(2)} kN</b></span>}
          </div>
        </div>
      </div>

      {/* ── Friction circle utilisation ───────────────────────────── */}
      <div>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 6 }}>
          Grip utilisation
          <InfoTooltip text="Front/rear tyre grip usage. Lateral: Fy/(μ·Fz). Combined: √(Fy²+Fx²)/(μ·Fz) — shows how throttle on driven wheels eats into cornering grip." />
        </div>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <UtilBar label="Front lateral" pct={p.frontUtilisation} color="#60a5fa" />
          <UtilBar label="Rear  lateral" pct={p.rearUtilisation}  color="#f87171" />
          {hasFx && <>
            <UtilBar label="Front combined" pct={p.frontCombinedUtil} color="#a78bfa" />
            <UtilBar label="Rear  combined" pct={p.rearCombinedUtil}  color="#f97316" />
          </>}
        </div>
      </div>

      {/* ── Drivetrain (only when throttle > 0) ──────────────────── */}
      {hasFx && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Drivetrain</div>
          <DataRow label="Drive force"    value={`${(p.driveForceN / 1000).toFixed(2)} kN`} />
          <DataRow label="Fx front / rear" value={`${(p.FxFront/1000).toFixed(2)} / ${(p.FxRear/1000).toFixed(2)} kN`} />
          {p.tvYawMoment !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, borderTop: '1px solid var(--border-subtle)', paddingTop: 4, marginTop: 2 }}>
              <span style={{ color: 'var(--text-faint)' }}>TV yaw moment <InfoTooltip text="Torque-vectoring yaw moment = FxRear × tvBias × TW/2. Positive = helps car rotate = reduces understeer." /></span>
              <span style={{ color: p.tvYawMoment > 0 ? '#4ade80' : '#f43f5e', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{p.tvYawMoment.toFixed(0)} Nm</span>
            </div>
          )}
        </div>
      )}

      {/* ── Stage 4: Suspension ─────────────────────────────────── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Suspension</div>
        <DataRow label="Roll angle"     value={`${p.rollAngleDeg.toFixed(2)}°`} />
        <DataRow label="Roll stiff F/R" value={`${p.rollStiffFront.toFixed(0)} / ${p.rollStiffRear.toFixed(0)} Nm/deg`} />
        <DataRow label="LT split"       value={`${(p.rollStiffRatio*100).toFixed(1)}% front`} tip="Lateral load transfer fraction to front axle, set by roll stiffness ratio. >50% = more understeer tendency." />
      </div>

      {/* ── Stage 5: Braking ───────────────────────────────────── */}
      {(p.FxBrakeFront > 1 || p.FxBrakeRear > 1) && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Braking</div>
          <DataRow label="Fx brake F/R" value={`${(p.FxBrakeFront/1000).toFixed(2)} / ${(p.FxBrakeRear/1000).toFixed(2)} kN`} />
          {(p.absActiveFront || p.absActiveRear) && (
            <div style={{ fontSize: 9, color: '#facc15', padding: '2px 0' }}>
              ABS active: {p.absActiveFront ? 'front ' : ''}{p.absActiveRear ? 'rear' : ''}
            </div>
          )}
        </div>
      )}

      {/* ── Stage 6: Aero ──────────────────────────────────────── */}
      {p.aeroDownforceN > 10 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Aerodynamics</div>
          <DataRow label="Downforce"      value={`${(p.aeroDownforceN/1000).toFixed(2)} kN`} tip="½ρV²A·CL — adds to tyre Fz → higher cornering grip at speed." />
          <DataRow label="Drag"           value={`${(p.aeroDragN/1000).toFixed(2)} kN`} tip="½ρV²A·CD — opposing force that must be overcome by drive force." />
          <DataRow label="Aero Fz F/R"    value={`+${(p.FzAeroFront/1000).toFixed(2)} / +${(p.FzAeroRear/1000).toFixed(2)} kN`} tip="Extra tyre load from downforce per axle. Added to static weight before load transfer." />
        </div>
      )}
    </div>
  );
}
