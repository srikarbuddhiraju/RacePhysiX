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
import { VEHICLE_PRESETS } from './physics/vehiclePresets';
import './App.css';

// ── URL hash persistence ──────────────────────────────────────────────────────
// Tier 1: exact preset  → "#p=gt3"          (~6 chars)
// Tier 2: preset + diff → "#p=gt3&{base64}" (~20–50 chars for small tweaks)
// Tier 3: full diff     → "#{base64}"        (fallback for fully custom setups)
// All diffs use 2–3 char short keys to minimise base64 length.
// Old full-key base64 URLs (pre-compression) still decode correctly.

const SHORT_KEYS: Record<keyof VehicleParams, string> = {
  mass: 'ms', wheelbase: 'wb', frontWeightFraction: 'fwf',
  corneringStiffnessNPerDeg: 'csf', rearCorneringStiffnessNPerDeg: 'csr',
  cgHeight: 'cgh', trackWidth: 'tw', tyreSectionWidth: 'tsw',
  turnRadius: 'tr', speedKph: 'sp', vehicleClass: 'vc',
  drivetrainType: 'dt', throttlePercent: 'tpc', enginePowerKW: 'ep',
  awdFrontBias: 'afb', frontSpringRate: 'fsp', rearSpringRate: 'rsp',
  frontARBRate: 'far', rearARBRate: 'rar', brakingG: 'bg', brakeBias: 'bb',
  aeroCL: 'cl', aeroCD: 'cd', aeroReferenceArea: 'ara', aeroBalance: 'ab',
  tyreLoadSensitivity: 'tls', tyreOptTempC: 'tot', tyreTempHalfWidthC: 'thw',
  tyreTempCurrentC: 'ttc', tyreTempFloorMu: 'tfm',
  gearCount: 'gc', firstGearRatio: 'fgr', topGearRatio: 'tgr',
  finalDriveRatio: 'fdr', wheelRadiusM: 'wr', enginePeakRpm: 'epr',
  engineRedlineRpm: 'err', fuelLoadKg: 'fl', fuelBurnRateKgPerLap: 'fbr',
  frontCamberDeg: 'fcd', rearCamberDeg: 'rcd', frontToeDeg: 'ftd', rearToeDeg: 'rtd',
  tyreCompound: 'tc', altitudeM: 'alt', ambientTempC: 'atc',
  windSpeedKph: 'wsp', windAngleDeg: 'wad', driverAggression: 'da',
  diffType: 'dft', lsdLockingPercent: 'lsd', brakeDiscMassKg: 'bdm',
  brakeOptTempC: 'bot', brakeHalfWidthC: 'bhw', brakeFloorMu: 'bfm',
  frontTyrePressureBar: 'ftp', rearTyrePressureBar: 'rtp',
  frontRideHeightMm: 'frh', rearRideHeightMm: 'rrh',
  engineCurveType: 'ect', engineMaxTorqueNm: 'emt', engineTorquePeakRpm: 'etp',
  turboBoostRpm: 'tbr', tcEnabled: 'tce', tcSlipThreshold: 'tct',
  trackRubberLevel: 'trl', trackWetness: 'twt', ersEnabled: 'ere',
  ersPowerKW: 'erp', ersBatteryKJ: 'erb', ersDeployStrategy: 'eds',
  frontRollCentreHeightMm: 'frc', rearRollCentreHeightMm: 'rrc',
  camberGainFront: 'cgf', camberGainRear: 'cgr',
  frontMotionRatio: 'fmr', rearMotionRatio: 'rmr',
  rollDamperRatio: 'rdr',
  tyreCoreHeatLag: 'tch',
};

// Reverse map: short key → full VehicleParams key
const LONG_KEYS = Object.fromEntries(
  Object.entries(SHORT_KEYS).map(([k, v]) => [v, k as keyof VehicleParams])
) as Record<string, keyof VehicleParams>;

// Applies a diff object to target; handles both short keys (new) and full keys (old URLs).
function applyDiff(target: Record<string, unknown>, diff: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(diff)) {
    const fullKey: string = LONG_KEYS[k] ?? k;
    target[fullKey] = v;
  }
}

function paramsMatchPreset(p: VehicleParams): string | null {
  const pRec = p as unknown as Record<string, unknown>;
  for (const preset of VEHICLE_PRESETS) {
    const prRec = preset.params as unknown as Record<string, unknown>;
    if (Object.keys(preset.params).every(k => pRec[k] === prRec[k])) return preset.id;
  }
  return null;
}

function encodeParams(p: VehicleParams): string {
  // Tier 1: exact preset match
  const exactId = paramsMatchPreset(p);
  if (exactId) return `p=${exactId}`;

  // Find nearest preset (most fields in common)
  const pRec = p as unknown as Record<string, unknown>;
  let bestId = '', bestMatches = 0;
  for (const pr of VEHICLE_PRESETS) {
    const prRec = pr.params as unknown as Record<string, unknown>;
    const matches = Object.keys(pr.params).filter(k => pRec[k] === prRec[k]).length;
    if (matches > bestMatches) { bestMatches = matches; bestId = pr.id; }
  }

  const bestPreset  = bestMatches > 0 ? VEHICLE_PRESETS.find(pr => pr.id === bestId)! : null;
  const baseParams  = (bestPreset?.params ?? DEFAULT_PARAMS) as unknown as Record<string, unknown>;
  const defaultsRec = DEFAULT_PARAMS as unknown as Record<string, unknown>;

  // Build short-key diff (only fields that differ from chosen base)
  const diff: Record<string, unknown> = {};
  for (const key of Object.keys(DEFAULT_PARAMS) as (keyof VehicleParams)[]) {
    if (pRec[key] !== baseParams[key]) {
      // Also skip if identical to DEFAULT and base is DEFAULT (avoids redundant keys)
      if (!bestPreset && pRec[key] === defaultsRec[key]) continue;
      diff[SHORT_KEYS[key] ?? key] = pRec[key];
    }
  }

  if (Object.keys(diff).length === 0) return bestPreset ? `p=${bestId}` : '';
  try {
    const b64 = btoa(JSON.stringify(diff));
    return bestPreset ? `p=${bestId}&${b64}` : b64;
  } catch { return ''; }
}

function decodeParams(hash: string): { params: Partial<VehicleParams>; presetId: string | null } {
  const raw = hash.replace(/^#/, '');
  const ampIdx = raw.indexOf('&');
  const left  = ampIdx >= 0 ? raw.slice(0, ampIdx) : raw;
  const right = ampIdx >= 0 ? raw.slice(ampIdx + 1) : '';

  // Tier 1: preset only "#p=gt3"
  if (left.startsWith('p=') && !right) {
    const id = left.slice(2);
    const preset = VEHICLE_PRESETS.find(pr => pr.id === id);
    if (preset) return { params: preset.params, presetId: id };
  }

  // Tier 2: preset + diff "#p=gt3&{base64}"
  if (left.startsWith('p=') && right) {
    const id = left.slice(2);
    const preset = VEHICLE_PRESETS.find(pr => pr.id === id);
    const base: Record<string, unknown> = { ...(preset?.params ?? DEFAULT_PARAMS) };
    try { applyDiff(base, JSON.parse(atob(right))); } catch { /* use base as-is */ }
    return { params: base as Partial<VehicleParams>, presetId: id };
  }

  // Tier 3: raw base64 diff (new short-key OR old full-key — both handled by applyDiff)
  try {
    const out: Record<string, unknown> = {};
    applyDiff(out, JSON.parse(atob(raw)));
    return { params: out as Partial<VehicleParams>, presetId: null };
  } catch {
    return { params: {}, presetId: null };
  }
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
  // Stage 41 — Roll centre height + dynamic camber
  frontRollCentreHeightMm: 30,   // mm — typical DWB front RC height
  rearRollCentreHeightMm:  40,   // mm — typical DWB rear RC height
  camberGainFront:         0.7,  // deg/deg — outer tyre camber gain per deg body roll
  camberGainRear:          0.5,
  // Stage 42 — Motion ratio
  frontMotionRatio: 1.0,  // 1.0 = direct (pushrod/pullrod with 1:1 ratio)
  rearMotionRatio:  1.0,
  // Stage 43 — Roll damper
  rollDamperRatio: 0.7,   // ζ — critical damping ratio for body roll (0.7 = slightly underdamped)
  // Stage 45 — Tyre thermal core lag
  tyreCoreHeatLag: 0.3,   // 0.0 = instant surface=core, 0.3 = typical
};

function loadInitialParams(): VehicleParams {
  if (window.location.hash.length > 1) {
    const { params: decoded } = decodeParams(window.location.hash);
    if (decoded && typeof decoded === 'object' && Object.keys(decoded).length > 0) {
      // Always merge over DEFAULT_PARAMS so any missing fields (e.g. new stages added
      // after a URL was shared) fall back to sensible defaults.
      const result = { ...DEFAULT_PARAMS, ...decoded } as VehicleParams;
      // Re-compress URL (replaces old full-blob URLs with short form)
      const compressed = encodeParams(result);
      history.replaceState(null, '', compressed ? `#${compressed}` : window.location.pathname);
      return result;
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
    if (encoded) {
      history.replaceState(null, '', `#${encoded}`);
    } else {
      history.replaceState(null, '', window.location.pathname);
    }
  }, []);

  const resetToDefaults = useCallback(() => {
    setParamsRaw(DEFAULT_PARAMS);
    setCoeffs(DEFAULT_PACEJKA_COEFFS);
    history.replaceState(null, '', window.location.pathname);
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
      <VehiclePresetSelector onSelect={handlePresetSelect} onReset={resetToDefaults} powerUnit={powerUnit} onPowerUnitChange={setPowerUnit} />
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
