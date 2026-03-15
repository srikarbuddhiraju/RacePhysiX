import type { VehicleParams } from '../physics/types';
import { InfoTooltip } from './InfoTooltip';
import './ParameterPanel.css';

interface Props {
  params: VehicleParams;
  onChange: (params: VehicleParams) => void;
}

interface SliderConfig {
  label:   string;
  key:     keyof VehicleParams;
  min:     number;
  max:     number;
  step:    number;
  unit:    string;
  format?: (v: number) => string;
  tip:     string;
}

const SLIDERS: SliderConfig[] = [
  // ── Corner scenario ───────────────────────────────────────────────────────
  {
    label: 'Speed',
    key:   'speedKph',
    min:   20, max: 250, step: 5,
    unit:  'km/h',
    tip:   'How fast the car travels through the corner. Higher speed → higher lateral acceleration (ay = V²/R) → tyres work harder and slip angles rise.',
  },
  {
    label: 'Turn radius',
    key:   'turnRadius',
    min:   15, max: 500, step: 5,
    unit:  'm',
    tip:   'Radius of the corner arc. Smaller = tighter corner = more lateral g at the same speed. Typical: 15 m hairpin, 80–200 m medium-speed corner, 400+ m fast sweep.',
  },
  // ── Tyre / aero ───────────────────────────────────────────────────────────
  {
    label: 'Cornering stiffness Cα',
    key:   'corneringStiffnessNPerDeg',
    min:   100, max: 2000, step: 25,
    unit:  'N/deg',
    tip:   'How steeply lateral force rises with slip angle in the linear range (Fy = Cα·α). Higher = stiffer tyre, sharper response. Applied to both axles (v0.1). Typical road tyre: 300–600 N/deg per axle.',
  },
  // ── Weight distribution ───────────────────────────────────────────────────
  {
    label: 'Front weight',
    key:   'frontWeightFraction',
    min:   0.30, max: 0.70, step: 0.01,
    unit:  '%',
    format: v => (v * 100).toFixed(0),
    tip:   'Fraction of total weight over the front axle at rest. Shifts the balance: more front weight → more understeer (K increases). Neutral steer = 50/50 split with equal Cα.',
  },
  // ── Vehicle geometry ──────────────────────────────────────────────────────
  {
    label: 'Mass',
    key:   'mass',
    min:   500, max: 3000, step: 50,
    unit:  'kg',
    tip:   'Total vehicle mass. More mass → more lateral force needed at the same ay → higher slip angles at the same speed/radius. Typical: 1100 kg (Formula Student), 1500 kg (road car), 2200 kg (SUV).',
  },
  {
    label: 'Wheelbase',
    key:   'wheelbase',
    min:   1.8, max: 4.0, step: 0.05,
    unit:  'm',
    format: v => v.toFixed(2),
    tip:   'Front-to-rear axle distance. Longer wheelbase = less yaw agility, more stable, typically more understeer. Moment arm for lateral force balance. Typical: 2.4 m (FS car), 2.7 m (road car), 3.0 m (larger saloon).',
  },
  {
    label: 'CG height',
    key:   'cgHeight',
    min:   0.20, max: 0.90, step: 0.01,
    unit:  'm',
    format: v => v.toFixed(2),
    tip:   'Height of the centre of gravity above the ground plane. Higher CG → more lateral load transfer in corners → grip loss via Pacejka nonlinearity (outer tyre doesn\'t compensate for inner). Critical for Stage 3. Typical: 0.25 m (FS), 0.55 m (road car), 0.70 m (SUV).',
  },
  {
    label: 'Track width',
    key:   'trackWidth',
    min:   1.0, max: 2.5, step: 0.05,
    unit:  'm',
    format: v => v.toFixed(2),
    tip:   'Lateral distance between left and right tyres. Wider track → less lateral load transfer → more total grip (less degressive Fz penalty). Used in Stage 3 load transfer model. Typical: 1.2 m (FS), 1.5 m (road car), 1.8 m (race car).',
  },
];

export function ParameterPanel({ params, onChange }: Props) {
  const set = (key: keyof VehicleParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  // Derived display values
  const speedMs     = (params.speedKph / 3.6);
  const ay          = (speedMs * speedMs) / params.turnRadius / 9.81;
  const L           = params.wheelbase;
  const b           = params.frontWeightFraction * L;
  const a           = L - b;

  return (
    <div className="param-panel">
      <div className="param-title">ApexSim</div>
      <div className="param-subtitle">Vehicle Dynamics Simulator</div>

      {/* Corner scenario section */}
      <div className="param-section-label">Corner scenario</div>
      {SLIDERS.slice(0, 2).map(cfg => <SliderRow key={cfg.key} cfg={cfg} params={params} set={set} />)}

      <div className="param-derived">
        <DerivedRow label="Lateral accel." value={`${ay.toFixed(3)} g`} tip="ay = V²/R. If this exceeds ~0.4g the linear model is becoming inaccurate — switch attention to the Pacejka charts below." />
      </div>

      {/* Tyre section */}
      <div className="param-section-label">Tyre (bicycle model)</div>
      {SLIDERS.slice(2, 3).map(cfg => <SliderRow key={cfg.key} cfg={cfg} params={params} set={set} />)}

      {/* Weight & geometry */}
      <div className="param-section-label">Weight & geometry</div>
      {SLIDERS.slice(3).map(cfg => <SliderRow key={cfg.key} cfg={cfg} params={params} set={set} />)}

      {/* Derived geometry display */}
      <div className="param-derived">
        <DerivedRow label="CG→front (a)" value={`${a.toFixed(3)} m`} tip="Distance from centre of gravity to front axle. a = L − b = wheelbase × (1 − front weight fraction)." />
        <DerivedRow label="CG→rear (b)"  value={`${b.toFixed(3)} m`} tip="Distance from centre of gravity to rear axle. b = L × front weight fraction. Front load = mg·b/L." />
        <DerivedRow label="Front load Wf" value={`${(params.mass * 9.81 * b / L / 1000).toFixed(2)} kN`} tip="Static front axle load = mass × g × b/L. This is the Fz each front tyre sees at rest (half per tyre)." />
        <DerivedRow label="Rear load Wr"  value={`${(params.mass * 9.81 * a / L / 1000).toFixed(2)} kN`} tip="Static rear axle load = mass × g × a/L." />
      </div>

      <div className="param-note">
        Bicycle model — steady-state constant radius.<br />
        Equal Cα front &amp; rear · no load transfer (v0.1)
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SliderRow({
  cfg,
  params,
  set,
}: {
  cfg: SliderConfig;
  params: VehicleParams;
  set: (key: keyof VehicleParams, v: number) => void;
}) {
  const { label, key, min, max, step, unit, format, tip } = cfg;
  const raw     = params[key] as number;
  const display = format ? format(raw) : raw < 10 ? raw.toFixed(2) : raw.toFixed(0);

  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">
          {label}
          <InfoTooltip text={tip} />
        </span>
        <span className="slider-value">{display} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={e => set(key, Number(e.target.value))}
      />
    </div>
  );
}

function DerivedRow({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div className="derived-row">
      <span className="derived-label">
        {label}
        <InfoTooltip text={tip} />
      </span>
      <span className="derived-value">{value}</span>
    </div>
  );
}
