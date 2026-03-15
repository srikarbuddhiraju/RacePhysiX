/**
 * ChartsPanel — tyre coefficient controls + dynamic charts.
 *
 * Two tabs:
 *   Presets  — pick a real-world tyre type; auto-fills all coefficients + section width
 *   Advanced — full manual control of every Pacejka parameter + section width
 */

import { useState } from 'react';
import { TyreCurveChart }  from './TyreCurveChart';
import { HandlingDiagram } from './HandlingDiagram';
import { InfoTooltip }     from '../components/InfoTooltip';
import type { PacejkaResult, PhysicsResult, PacejkaCoeffs, VehicleParams, VehicleClass } from '../physics/types';
import './ChartsPanel.css';

// ─── Tyre presets ──────────────────────────────────────────────────────────────

interface TyrePreset {
  id:               string;
  name:             string;
  size:             string;
  category:         'road' | 'track' | 'motorsport';
  description:      string;
  useCase:          string;
  tyreSectionWidth: number;   // m
  coeffs:           PacejkaCoeffs;
}

const PRESETS: TyrePreset[] = [
  {
    id: 'road-economy',
    name: 'Road — Economy',       size: '185/65R15',  category: 'road',
    description: 'Budget all-season tyre. Soft compound, higher C for gentler post-peak drop.',
    useCase: 'City cars, econoboxes, daily commuting.',
    tyreSectionWidth: 0.185,
    coeffs: { B: 8.0, C: 1.32, peakMu: 0.88, E: -1.0 },
  },
  {
    id: 'road-standard',
    name: 'Road — Standard',      size: '205/55R16',  category: 'road',
    description: 'Typical OEM road tyre. Balanced grip, noise, and wear.',
    useCase: 'Default road car fitment. Good all-round baseline.',
    tyreSectionWidth: 0.205,
    coeffs: { B: 10.0, C: 1.30, peakMu: 1.00, E: -1.3 },
  },
  {
    id: 'road-performance',
    name: 'Road — Performance',   size: '235/40R18',  category: 'road',
    description: 'Sport road tyre. Stiffer sidewall, higher μ, sharper response.',
    useCase: 'Performance cars, sporty driving, dry-biased.',
    tyreSectionWidth: 0.235,
    coeffs: { B: 11.5, C: 1.28, peakMu: 1.20, E: -1.5 },
  },
  {
    id: 'road-wet',
    name: 'Road — Wet',           size: '215/55R17',  category: 'road',
    description: 'Dedicated wet-weather tyre. Lower peak μ, higher C for progressive feel.',
    useCase: 'Wet roads. Lower μ reflects reduced friction on standing water.',
    tyreSectionWidth: 0.215,
    coeffs: { B: 7.5, C: 1.35, peakMu: 0.72, E: -0.8 },
  },
  {
    id: 'road-winter',
    name: 'Road — Winter',        size: '205/55R16',  category: 'road',
    description: 'Winter/snow compound. Softer rubber stays pliable in cold; lower μ on dry.',
    useCase: 'Sub-7°C conditions, snow, ice. Not for summer use.',
    tyreSectionWidth: 0.205,
    coeffs: { B: 6.5, C: 1.38, peakMu: 0.62, E: -0.7 },
  },
  {
    id: 'track-semislick',
    name: 'Track — Semi-slick',   size: '225/45R17',  category: 'track',
    description: 'Minimal tread, sticky compound. Significantly higher μ than road.',
    useCase: 'Track days, time attack. Road-legal but poor in wet/cold.',
    tyreSectionWidth: 0.225,
    coeffs: { B: 13.0, C: 1.25, peakMu: 1.45, E: -1.8 },
  },
  {
    id: 'track-slick',
    name: 'Track — Slick',        size: '265/35R18',  category: 'track',
    description: 'Full slick, no tread. Maximum contact patch, high peak μ, sharp post-peak.',
    useCase: 'Circuit racing, dry conditions only.',
    tyreSectionWidth: 0.265,
    coeffs: { B: 15.0, C: 1.20, peakMu: 1.65, E: -2.0 },
  },
  {
    id: 'motorsport-fs',
    name: 'Formula Student Slick', size: '190/570R13', category: 'motorsport',
    description: 'Hoosier/Avon FS slick. Narrow, very high μ, steep onset, sharp peak.',
    useCase: 'Formula SAE/Student competition. Low-speed, high-g.',
    tyreSectionWidth: 0.190,
    coeffs: { B: 16.5, C: 1.18, peakMu: 1.75, E: -2.2 },
  },
];

const CATEGORY_COLOR: Record<TyrePreset['category'], string> = {
  road:       '#4ade80',
  track:      '#f97316',
  motorsport: '#f43f5e',
};

// ─── Advanced slider config ────────────────────────────────────────────────────

interface CoeffSlider {
  key:    keyof PacejkaCoeffs;
  label:  string;
  min:    number;
  max:    number;
  step:   number;
  format: (v: number) => string;
  tip:    string;
  color:  string;
}

const COEFF_SLIDERS: CoeffSlider[] = [
  {
    key: 'B', label: 'B — Stiffness factor', min: 4, max: 20, step: 0.5,
    format: v => v.toFixed(1), color: '#60a5fa',
    tip: 'Scales the slip angle axis. Higher B = steeper initial slope = stiffer tyre. Initial cornering stiffness Cα = B × C × μ × Fz. Road tyre: 8–12. Slick: 14–18.',
  },
  {
    key: 'C', label: 'C — Shape factor', min: 1.0, max: 2.0, step: 0.05,
    format: v => v.toFixed(2), color: '#a78bfa',
    tip: 'Controls what fraction of the sine wave is used. Governs how much force drops post-peak. C ≈ 1.3 = moderate drop (lateral). C ≈ 1.65 = rounder plateau (longitudinal). Higher C = less aggressive falloff.',
  },
  {
    key: 'peakMu', label: 'μ — Peak friction coefficient', min: 0.5, max: 2.0, step: 0.05,
    format: v => v.toFixed(2), color: '#f97316',
    tip: 'Peak friction coefficient. D = μ × Fz. Sets the maximum lateral force the tyre can generate at a given load. Budget road: 0.8–0.9. Performance road: 1.1–1.3. Slick: 1.5–1.8.',
  },
  {
    key: 'E', label: 'E — Curvature factor', min: -3.0, max: 1.0, step: 0.1,
    format: v => v.toFixed(1), color: '#22d3ee',
    tip: 'Shapes the curve near and beyond the peak. E < 0 shifts the peak to a higher slip angle and sharpens the falloff — more progressive feel. E = 1 gives a symmetric sine. Typical lateral: −1 to −2.5.',
  },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  pacejka:        PacejkaResult;
  bicycle:        PhysicsResult;
  coeffs:         PacejkaCoeffs;
  onCoeffsChange: (c: PacejkaCoeffs) => void;
  params:         VehicleParams;
  onParamsChange: (p: VehicleParams) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChartsPanel({
  pacejka, bicycle,
  coeffs, onCoeffsChange,
  params, onParamsChange,
}: Props) {
  const [activeTab, setActiveTab]       = useState<'presets' | 'advanced'>('presets');
  const [selectedPreset, setSelected]   = useState<string>('road-standard');

  const categoryToClass = (cat: TyrePreset['category']): VehicleClass =>
    cat === 'motorsport' ? 'motorsport' : cat === 'track' ? 'track' : 'road';

  const applyPreset = (id: string) => {
    const p = PRESETS.find(p => p.id === id);
    if (!p) return;
    setSelected(id);
    onCoeffsChange(p.coeffs);
    onParamsChange({
      ...params,
      tyreSectionWidth: p.tyreSectionWidth,
      vehicleClass: categoryToClass(p.category),
    });
  };

  const setCoeff = (key: keyof PacejkaCoeffs, value: number) =>
    onCoeffsChange({ ...coeffs, [key]: value });

  const cα4kN = (coeffs.B * coeffs.C * coeffs.peakMu * 4000 / (Math.PI / 180)).toFixed(0);
  const bcd   = (coeffs.B * coeffs.C * coeffs.peakMu).toFixed(3);

  const currentPreset = PRESETS.find(p => p.id === selectedPreset);

  return (
    <div className="charts-panel">

      {/* ── Controls bar ──────────────────────────────────────────────────── */}
      <div className="charts-controls">

        {/* Tab bar */}
        <div className="ctrl-tabs">
          <button
            className={`ctrl-tab ${activeTab === 'presets'  ? 'active' : ''}`}
            onClick={() => setActiveTab('presets')}
          >
            Tyre Presets
          </button>
          <button
            className={`ctrl-tab ${activeTab === 'advanced' ? 'active' : ''}`}
            onClick={() => setActiveTab('advanced')}
          >
            Advanced
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'presets' ? (
          <PresetsTab
            presets={PRESETS}
            selectedId={selectedPreset}
            currentPreset={currentPreset}
            onSelect={applyPreset}
            tyreSectionWidth={params.tyreSectionWidth}
            coeffs={coeffs}
          />
        ) : (
          <AdvancedTab
            coeffs={coeffs}
            setCoeff={setCoeff}
            tyreSectionWidth={params.tyreSectionWidth}
            onWidthChange={w => onParamsChange({ ...params, tyreSectionWidth: w })}
            bcd={bcd}
            cα4kN={cα4kN}
          />
        )}
      </div>

      {/* ── Charts ────────────────────────────────────────────────────────── */}
      <div className="charts-grid">
        <TyreCurveChart result={pacejka} />
        <HandlingDiagram pacejka={pacejka} bicycle={bicycle} />
      </div>

    </div>
  );
}

// ─── Presets tab ──────────────────────────────────────────────────────────────

function PresetsTab({
  presets, selectedId, currentPreset, onSelect, tyreSectionWidth, coeffs,
}: {
  presets: TyrePreset[];
  selectedId: string;
  currentPreset: TyrePreset | undefined;
  onSelect: (id: string) => void;
  tyreSectionWidth: number;
  coeffs: PacejkaCoeffs;
}) {
  return (
    <div className="presets-tab">
      {/* Dropdown */}
      <div className="preset-select-row">
        <select
          className="preset-select"
          value={selectedId}
          onChange={e => onSelect(e.target.value)}
        >
          {(['road', 'track', 'motorsport'] as const).map(cat => (
            <optgroup key={cat} label={cat.charAt(0).toUpperCase() + cat.slice(1)}>
              {presets.filter(p => p.category === cat).map(p => (
                <option key={p.id} value={p.id}>{p.name} ({p.size})</option>
              ))}
            </optgroup>
          ))}
        </select>
        {currentPreset && (
          <span
            className="preset-category-badge"
            style={{ background: CATEGORY_COLOR[currentPreset.category] + '22',
                     color:      CATEGORY_COLOR[currentPreset.category],
                     border:    `1px solid ${CATEGORY_COLOR[currentPreset.category]}44` }}
          >
            {currentPreset.category}
          </span>
        )}
      </div>

      {/* Description */}
      {currentPreset && (
        <div className="preset-desc">
          <div className="preset-desc-main">{currentPreset.description}</div>
          <div className="preset-desc-use">Use case: {currentPreset.useCase}</div>
        </div>
      )}

      {/* Coefficient summary */}
      <div className="preset-coeff-summary">
        <CoeffPill label="B" value={coeffs.B.toFixed(1)}  color="#60a5fa" tip="Stiffness factor — steeper initial slope" />
        <CoeffPill label="C" value={coeffs.C.toFixed(2)}  color="#a78bfa" tip="Shape factor — controls post-peak drop" />
        <CoeffPill label="μ" value={coeffs.peakMu.toFixed(2)} color="#f97316" tip="Peak friction coefficient" />
        <CoeffPill label="E" value={coeffs.E.toFixed(1)}  color="#22d3ee" tip="Curvature factor — peak sharpness" />
        <CoeffPill label="W" value={`${(tyreSectionWidth * 1000).toFixed(0)}mm`} color="#e2e8f0" tip="Tyre section width — visual + contact patch" />
      </div>
    </div>
  );
}

function CoeffPill({ label, value, color, tip }: { label: string; value: string; color: string; tip: string }) {
  return (
    <div className="coeff-pill" style={{ borderColor: color + '44' }}>
      <span className="pill-label" style={{ color }}>
        {label}
        <InfoTooltip text={tip} />
      </span>
      <span className="pill-value">{value}</span>
    </div>
  );
}

// ─── Advanced tab ─────────────────────────────────────────────────────────────

function AdvancedTab({
  coeffs, setCoeff, tyreSectionWidth, onWidthChange, bcd, cα4kN,
}: {
  coeffs: PacejkaCoeffs;
  setCoeff: (key: keyof PacejkaCoeffs, v: number) => void;
  tyreSectionWidth: number;
  onWidthChange: (v: number) => void;
  bcd: string;
  cα4kN: string;
}) {
  return (
    <div className="advanced-tab">
      <div className="adv-sliders">
        {COEFF_SLIDERS.map(({ key, label, min, max, step, format, tip, color }) => {
          const val = coeffs[key] as number;
          return (
            <div className="adv-row" key={key}>
              <div className="adv-header">
                <span className="adv-label" style={{ color }}>
                  {label}
                  <InfoTooltip text={tip} />
                </span>
                <span className="adv-value">{format(val)}</span>
              </div>
              <input
                type="range" min={min} max={max} step={step} value={val}
                style={{ accentColor: color }}
                onChange={e => setCoeff(key, Number(e.target.value))}
              />
            </div>
          );
        })}

        {/* Section width slider */}
        <div className="adv-row">
          <div className="adv-header">
            <span className="adv-label" style={{ color: '#e2e8f0' }}>
              Section width
              <InfoTooltip text="Physical tyre section width in metres. Changes the visual wheel width in the 3D view. Wider tyres have a larger contact patch area → typically higher Cα and peak μ. This slider is independent of B/μ — adjust those manually to match." />
            </span>
            <span className="adv-value">{(tyreSectionWidth * 1000).toFixed(0)} mm</span>
          </div>
          <input
            type="range" min={0.155} max={0.305} step={0.005}
            value={tyreSectionWidth}
            style={{ accentColor: '#e2e8f0' }}
            onChange={e => onWidthChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Derived values */}
      <div className="adv-derived">
        <span>
          BCD = <b>{bcd}</b> × Fz
          <InfoTooltip text="B × C × μ. Multiply by Fz (N) to get the initial cornering stiffness Cα at that load. Dimensionless × N = N/rad." />
        </span>
        <span>
          Cα @ 4 kN = <b>{cα4kN}</b> N/deg
          <InfoTooltip text="Cornering stiffness at 4000N axle load — roughly one corner of a 1500kg car. This is what the bicycle model's Cα slider approximates for the full axle." />
        </span>
        <span>
          Peak α ≈ <b>{(1 / coeffs.B * 180 / Math.PI).toFixed(1)}°</b>
          <InfoTooltip text="Approximate slip angle at peak Fy. Rough estimate: 1/B radians converted to degrees. Wider tyres and softer compounds typically peak at higher slip angles." />
        </span>
      </div>
    </div>
  );
}
