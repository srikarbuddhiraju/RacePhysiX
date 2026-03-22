import { useState, useMemo, useEffect, useCallback } from 'react';
import { computeBicycleModel } from './physics/bicycleModel';
import { computePacejkaModel, DEFAULT_PACEJKA_COEFFS } from './physics/pacejkaModel';
import { ParameterPanel }   from './components/ParameterPanel';
import { ResultsPanel }     from './components/ResultsPanel';
import { TopDownView }      from './visualisation/TopDownView';
import { ChartsPanel }      from './charts/ChartsPanel';
import { TrackVisualiser }  from './components/TrackVisualiser';
import { TRACK_PRESETS } from './physics/laptime';
import type { LapResult, RaceResult, TrackLayout } from './physics/laptime';
import type { VehicleParams, PacejkaCoeffs } from './physics/types';
import { buildLapSimInput } from './physics/vehicleInput';
import { VehiclePresetSelector } from './components/VehiclePresetSelector';
import { WelcomeBanner } from './components/WelcomeBanner';
import { type PowerUnit } from './utils/units';
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
  rearCorneringStiffnessNPerDeg: 500,   // Stage 13A — default = same as front (neutral steer)
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
  aeroCL:            0,
  aeroCD:            0.28,
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
  // Race simulation
  fuelLoadKg:             45,
  fuelBurnRateKgPerLap:   2.5,
  // Stage 22 — Camber + Toe
  frontCamberDeg: -1.5,   // deg — negative camber (road default)
  rearCamberDeg:  -0.5,
  frontToeDeg:     0.05,  // deg — slight toe-in front
  rearToeDeg:      0.15,  // deg — toe-in rear (stability)
  // Stage 23 — Tyre compound
  tyreCompound:    'medium',
  // Stage 24 — Ambient
  altitudeM:       0,
  ambientTempC:    20,
  windSpeedKph:    0,
  windAngleDeg:    0,
  // Stage 25 — Driver
  driverAggression: 0.5,
  // Stage 26 — Differential
  diffType:            'open',
  lsdLockingPercent:   50,
  // Stage 27 — Brake temperature
  brakeDiscMassKg:     6.0,
  brakeOptTempC:       400,
  brakeHalfWidthC:     200,
  brakeFloorMu:        0.65,
  // Stage 28 — Tyre pressure
  frontTyrePressureBar: 2.2,
  rearTyrePressureBar:  2.2,
  // Stage 29 — Ride height & rake
  frontRideHeightMm: 100,
  rearRideHeightMm:  105,
  // Stage 31 — Engine torque curve
  engineCurveType: 'na',
  engineMaxTorqueNm: 260,
  engineTorquePeakRpm: 3500,
  turboBoostRpm: 2500,
  // Stage 32 — Traction control
  tcEnabled: false,
  tcSlipThreshold: 0.12,
  // Stage 33 — Track rubber evolution
  trackRubberLevel: 0.5,
  // Stage 34 — Track wetness
  trackWetness: 0.0,
  // Stage 35 — ERS / Hybrid
  ersEnabled: false,
  ersPowerKW: 120,
  ersBatteryKJ: 4000,
  ersDeployStrategy: 'full',
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
  const [darkMode, setDarkMode]     = useState(true);
  const [powerUnit, setPowerUnit]   = useState<PowerUnit>('kW');

  // Track Visualiser state — shared between LapTimePanel (editor) and TrackVisualiser (map)
  const [trackKey,      setTrackKey]      = useState<string>('club');
  const [lapResult,     setLapResult]     = useState<LapResult | null>(null);
  const [raceResult,    setRaceResult]    = useState<RaceResult | null>(null);
  const [triggerRace,   setTriggerRace]   = useState<number>(0);
  const [showTrackViz,  setShowTrackViz]  = useState<boolean>(false);
  const [effectiveLayout, setEffectiveLayout] = useState<TrackLayout | null>(null);

  /** Fallback lap result computed from default params until LapTimePanel mounts. */
  const fallbackLayout = TRACK_PRESETS[trackKey] ?? TRACK_PRESETS['club'];

  // Keep URL hash in sync with params
  const setParams = useCallback((p: VehicleParams) => {
    setParamsRaw(p);
    const encoded = encodeParams(p);
    if (encoded) history.replaceState(null, '', `#${encoded}`);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  const bicycle      = useMemo(() => computeBicycleModel(params),            [params]);
  const pacejka      = useMemo(() => computePacejkaModel(params, coeffs),    [params, coeffs]);
  const lapSimInput  = useMemo(() => buildLapSimInput(params, coeffs),       [params, coeffs]);

  const handlePresetSelect = useCallback((p: VehicleParams, c: PacejkaCoeffs) => {
    setParams(p);
    setCoeffs(c);
  }, [setParams]);

  return (
    <div className="app">
      <VehiclePresetSelector onSelect={handlePresetSelect} powerUnit={powerUnit} onPowerUnitChange={setPowerUnit} />
      <WelcomeBanner />
      {/* Top row: param panel | 3D view | results */}
      <div className="app-main">
        <ParameterPanel params={params} onChange={setParams} powerUnit={powerUnit} onPowerUnitChange={setPowerUnit} />
        <div className="canvas-area">
          <TopDownView params={params} result={bicycle} pacejka={pacejka} coeffs={coeffs} darkMode={darkMode} />
          <button
            className="theme-toggle"
            onClick={() => setDarkMode(d => !d)}
            title={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? '☀' : '🌙'}
          </button>
          {/* Circuit Map toggle — below theme-toggle */}
          <button
            onClick={() => setShowTrackViz(v => !v)}
            title={showTrackViz ? 'Close circuit animation' : 'Open circuit animation'}
            style={{
              position: 'absolute', top: 46, left: 8,
              padding: '4px 10px', fontSize: 9, fontWeight: 700,
              background: showTrackViz ? 'rgba(100,100,255,0.25)' : 'rgba(99,102,241,0.15)',
              border: `1px solid ${showTrackViz ? '#6466f1' : '#6466f1'}`,
              borderRadius: 5, color: showTrackViz ? '#a0a0ff' : '#a0a0ff',
              cursor: 'pointer', zIndex: 10, whiteSpace: 'nowrap',
              animation: showTrackViz ? 'none' : 'pulse-border 2s ease-in-out infinite',
            }}
          >
            {showTrackViz ? '⊟ Close' : '⊞ Animate Circuit'}
          </button>
          {/* Circuit Map overlay — covers entire canvas-area */}
          {showTrackViz && lapResult && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: '#0a0a14',
            }}>
              <TrackVisualiser
                layout={effectiveLayout ?? fallbackLayout}
                result={lapResult}
                lapSimInput={lapSimInput}
                raceResult={raceResult}
                triggerRace={triggerRace}
                params={params}
                onClose={() => setShowTrackViz(false)}
              />
            </div>
          )}
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
          trackKey={trackKey}
          onTrackChange={setTrackKey}
          onLapResultChange={setLapResult}
          onRaceResultChange={setRaceResult}
          onTriggerRaceAnim={() => setTriggerRace(n => n + 1)}
          onLayoutChange={setEffectiveLayout}
          powerUnit={powerUnit}
        />
      </div>
    </div>
  );
}
