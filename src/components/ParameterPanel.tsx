import type { VehicleParams } from '../physics/types';
import './ParameterPanel.css';

interface Props {
  params: VehicleParams;
  onChange: (params: VehicleParams) => void;
}

interface SliderConfig {
  label: string;
  key: keyof VehicleParams;
  min: number;
  max: number;
  step: number;
  unit: string;
  format?: (v: number) => string;
}

const SLIDERS: SliderConfig[] = [
  {
    label: 'Speed',
    key: 'speedKph',
    min: 20,
    max: 200,
    step: 5,
    unit: 'km/h',
  },
  {
    label: 'Front weight',
    key: 'frontWeightFraction',
    min: 0.30,
    max: 0.70,
    step: 0.01,
    unit: '%',
    format: (v) => (v * 100).toFixed(0),
  },
  {
    label: 'Cornering stiffness',
    key: 'corneringStiffnessNPerDeg',
    min: 200,
    max: 1500,
    step: 25,
    unit: 'N/deg',
  },
  {
    label: 'Turn radius',
    key: 'turnRadius',
    min: 20,
    max: 200,
    step: 5,
    unit: 'm',
  },
];

export function ParameterPanel({ params, onChange }: Props) {
  const set = (key: keyof VehicleParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  return (
    <div className="param-panel">
      <div className="param-title">ApexSim</div>
      <div className="param-subtitle">Vehicle Dynamics Simulator</div>

      <div className="param-section-label">Inputs</div>

      {SLIDERS.map(({ label, key, min, max, step, unit, format }) => {
        const raw = params[key] as number;
        const display = format ? format(raw) : raw.toFixed(raw < 10 ? 2 : 0);
        return (
          <div className="slider-row" key={key}>
            <div className="slider-header">
              <span className="slider-label">{label}</span>
              <span className="slider-value">{display} {unit}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={step}
              value={raw}
              onChange={(e) => set(key, Number(e.target.value))}
            />
          </div>
        );
      })}

      <div className="param-section-label" style={{ marginTop: '24px' }}>Vehicle (fixed)</div>
      <div className="fixed-params">
        <div className="fixed-row">
          <span>Mass</span><span>{params.mass} kg</span>
        </div>
        <div className="fixed-row">
          <span>Wheelbase</span><span>{params.wheelbase} m</span>
        </div>
        <div className="fixed-row">
          <span>CG height</span><span>{params.cgHeight} m</span>
        </div>
      </div>

      <div className="param-note">
        Bicycle model — steady-state constant radius.<br />
        Same Cα front and rear (v0.1).
      </div>
    </div>
  );
}
