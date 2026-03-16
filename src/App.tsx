import { useState, useMemo, useEffect, useCallback } from 'react';
import { computeBicycleModel } from './physics/bicycleModel';
import { computePacejkaModel, DEFAULT_PACEJKA_COEFFS } from './physics/pacejkaModel';
import { ParameterPanel } from './components/ParameterPanel';
import { ResultsPanel }   from './components/ResultsPanel';
import { TopDownView }    from './visualisation/TopDownView';
import { ChartsPanel }    from './charts/ChartsPanel';
import type { VehicleParams, PacejkaCoeffs } from './physics/types';
import './App.css';

// ── URL hash persistence ──────────────────────────────────────────────────────
function encodeParams(p: VehicleParams): string {
  try { return btoa(JSON.stringify(p)); } catch { return ''; }
}
function decodeParams(hash: string): Partial<VehicleParams> {
  try { return JSON.parse(atob(hash.replace(/^#/, ''))) as Partial<VehicleParams>; } catch { return {}; }
}

const DEFAULT_PARAMS: VehicleParams = {
  mass: 1500,
  wheelbase: 2.7,
  frontWeightFraction: 0.55,
  corneringStiffnessNPerDeg: 500,
  cgHeight: 0.55,
  trackWidth: 1.5,
  tyreSectionWidth: 0.205,
  turnRadius: 200,
  speedKph: 80,
  vehicleClass: 'road',
  drivetrainType: 'RWD',
  throttlePercent: 0,
  enginePowerKW: 150,
  awdFrontBias: 0.40,
  // Stage 4 — Suspension
  frontSpringRate: 25000,
  rearSpringRate:  28000,
  frontARBRate:    8000,
  rearARBRate:     6000,
  // Stage 5 — Braking
  brakingG:   0,
  brakeBias:  0.65,
  // Stage 6 — Aero
  aeroCL:            0.30,
  aeroCD:            0.30,
  aeroReferenceArea: 2.0,
  aeroBalance:       0.45,
  // Stage 9 — Tyre load sensitivity
  tyreLoadSensitivity: 0.10,
  // Stage 11 — Tyre thermal model
  tyreOptTempC:       85,
  tyreTempHalfWidthC: 30,
  tyreTempCurrentC:   85,   // start at optimal — no grip penalty
  tyreTempFloorMu:    0.60,
  // Stage 10 — Gear model
  gearCount:        6,
  firstGearRatio:   3.0,
  topGearRatio:     0.72,
  finalDriveRatio:  3.9,
  wheelRadiusM:     0.32,
  enginePeakRpm:    5500,
  engineRedlineRpm: 6500,
};

function loadInitialParams(): VehicleParams {
  if (window.location.hash.length > 1) {
    const decoded = decodeParams(window.location.hash);
    if (decoded && typeof decoded === 'object' && 'mass' in decoded) {
      return { ...DEFAULT_PARAMS, ...decoded };
    }
  }
  return DEFAULT_PARAMS;
}

export function App() {
  const [params, setParamsRaw] = useState<VehicleParams>(loadInitialParams);
  const [coeffs, setCoeffs]    = useState<PacejkaCoeffs>(DEFAULT_PACEJKA_COEFFS);
  const [darkMode, setDarkMode] = useState(true);

  // Keep URL hash in sync with params
  const setParams = useCallback((p: VehicleParams) => {
    setParamsRaw(p);
    const encoded = encodeParams(p);
    if (encoded) history.replaceState(null, '', `#${encoded}`);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const bicycle = useMemo(() => computeBicycleModel(params),         [params]);
  const pacejka = useMemo(() => computePacejkaModel(params, coeffs), [params, coeffs]);

  return (
    <div className="app">
      {/* Top row: param panel | 3D view | results */}
      <div className="app-main">
        <ParameterPanel params={params} onChange={setParams} />
        <div className="canvas-area">
          <TopDownView params={params} result={bicycle} pacejka={pacejka} coeffs={coeffs} darkMode={darkMode} />
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '🌙'}
          </button>
        </div>
        <ResultsPanel result={bicycle} pacejka={pacejka} />
      </div>

      {/* Bottom row: dynamic charts (tyre curve + handling diagram + Pacejka sliders) */}
      <div className="app-charts">
        <ChartsPanel
          pacejka={pacejka}
          bicycle={bicycle}
          coeffs={coeffs}
          onCoeffsChange={setCoeffs}
          params={params}
          onParamsChange={setParams}
        />
      </div>
    </div>
  );
}
