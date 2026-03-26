import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { computeLapTime, simulateRace, TRACK_PRESETS } from '../physics/laptime';
import { optimiseRaceStrategy, fmtTime as fmtStratTime, type StrategyResult } from '../physics/strategyOptimiser';
import type { TrackLayout, TrackSegment, LapResult, RaceResult, LapSimInput } from '../physics/laptime';
import { optimiseSetup, OPTIMISE_BOUNDS, OPTIMISABLE_KEYS } from '../physics/optimise';
import type { OptimiseResult } from '../physics/optimise';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import { buildLapSimInput } from '../physics/vehicleInput';
import { InfoTooltip } from './InfoTooltip';
import { exportLapTimeCSV, exportLapTraceCSV, exportRaceTelemetryCSV } from '../utils/export';
import { buildLapTrace, buildRaceLapTraces } from '../physics/laptime';
import { type PowerUnit, fmtPower } from '../utils/units';
import { parseTelemetryCSV, type ParsedTelemetry } from '../utils/parseTelemetryCSV';
import TelemetryOverlayChart from './TelemetryOverlayChart';

interface Props {
  params:              VehicleParams;
  coeffs:              PacejkaCoeffs;
  onChange:            (p: VehicleParams) => void;
  powerUnit:           PowerUnit;
  /** Lifted to App so TrackVisualiser can share the same selected circuit. */
  trackKey:            string;
  onTrackChange:       (k: string) => void;
  /** Called whenever the computed lap result changes (feeds TrackVisualiser). */
  onLapResultChange:   (r: LapResult) => void;
  /** Called when race simulation completes (feeds TrackVisualiser). */
  onRaceResultChange:  (r: RaceResult) => void;
  /** Increment this to signal TrackVisualiser to start race animation. */
  onTriggerRaceAnim:   () => void;
  /** Called whenever effectiveLayout changes (feeds TrackVisualiser overlay). */
  onLayoutChange:      (layout: TrackLayout) => void;
}

/** Labels for the 7 optimisable params shown in the result card. */
const OPTIM_LABELS: Record<string, string> = {
  frontSpringRate: 'Front spring',
  rearSpringRate:  'Rear spring',
  frontARBRate:    'Front ARB',
  rearARBRate:     'Rear ARB',
  aeroCL:          'Aero CL',
  aeroBalance:     'Aero balance',
  brakeBias:       'Brake bias',
};
function fmtParamValue(key: string, v: number): string {
  if (key === 'aeroCL')      return v.toFixed(2);
  if (key === 'aeroBalance') return `${(v * 100).toFixed(0)}%F/${((1 - v) * 100).toFixed(0)}%R`;
  if (key === 'brakeBias')   return `${(v * 100).toFixed(0)}%F/${((1 - v) * 100).toFixed(0)}%R`;
  return `${(v / 1000).toFixed(1)}k N/m`;
}


function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return m > 0 ? `${m}:${s.toFixed(3).padStart(6, '0')}` : `${s.toFixed(3)}s`;
}

type OptimState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: OptimiseResult }
  | { status: 'error'; message: string };

type RaceSimState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: RaceResult }
  | { status: 'error'; message: string };

// ── localStorage for custom circuits ─────────────────────────────────────────

const STORAGE_KEY = 'racephysix_custom_tracks';

function loadCustomTracks(): Record<string, TrackLayout> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, TrackLayout>) : {};
  } catch { return {}; }
}

function saveCustomTracks(tracks: Record<string, TrackLayout>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks)); } catch { /* quota */ }
}

const BUILTIN_KEYS = new Set([
  'club', 'karting', 'gt_circuit', 'formula_test',
  'monza', 'spa', 'silverstone', 'suzuka',
  'nurburgring_gp', 'bahrain', 'barcelona', 'hungaroring', 'montreal',
  'laguna_seca', 'imola', 'le_mans', 'sebring', 'mugello',
  'brands_hatch', 'hockenheim', 'spielberg', 'zandvoort', 'sao_paulo',
]);

// ── Main component ─────────────────────────────────────────────────────────────

export function LapTimePanel({
  params, coeffs, onChange,
  trackKey, onTrackChange,
  onLapResultChange, onRaceResultChange, onTriggerRaceAnim, onLayoutChange,
  powerUnit,
}: Props) {
  const [optimState,  setOptimState]  = useState<OptimState>({ status: 'idle' });
  const [raceState,   setRaceState]   = useState<RaceSimState>({ status: 'idle' });

  // Stage 30 — Race Strategy Optimiser
  const [strategyResult,  setStrategyResult]  = useState<StrategyResult[] | null>(null);
  const [strategyRunning, setStrategyRunning] = useState(false);
  const [pitStopSec,      setPitStopSec]      = useState<number>(25);

  // Stage 20 / 36 — Setup Comparison
  const [baseline, setBaseline] = useState<{
    timeSec: number;
    s1Sec: number; s2Sec: number; s3Sec: number;
    label: string;
    powerKW: number;
    mass: number;
    peakMu: number;
  } | null>(null);
  const [numLaps,     setNumLaps]     = useState<number>(10);
  const [startTempC,  setStartTempC]  = useState<number>(30);
  const [uploadedTelemetry, setUploadedTelemetry] = useState<ParsedTelemetry | null>(null);
  const telemetryFileInputRef = useRef<HTMLInputElement>(null);

  // Custom circuit registry (localStorage backed)
  const [customTracks, setCustomTracks] = useState<Record<string, TrackLayout>>(loadCustomTracks);

  // Track editor state
  const isBuiltin    = BUILTIN_KEYS.has(trackKey);
  const baseLayout   = isBuiltin ? TRACK_PRESETS[trackKey] : (customTracks[trackKey] ?? TRACK_PRESETS['club']);
  const [isLocked,   setIsLocked]   = useState<boolean>(isBuiltin);
  const [editSegs,   setEditSegs]   = useState<TrackSegment[]>(() => baseLayout.segments.map(s => ({ ...s })));
  const [editName,   setEditName]   = useState<string>(baseLayout.name);
  const importRef = useRef<HTMLInputElement>(null);

  // Reset editor state when circuit changes
  useEffect(() => {
    const layout = isBuiltin ? TRACK_PRESETS[trackKey] : (customTracks[trackKey] ?? TRACK_PRESETS['club']);
    setIsLocked(isBuiltin);
    setEditSegs(layout.segments.map(s => ({ ...s })));
    setEditName(layout.name);
  }, [trackKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Effective layout: use edited segments when unlocked
  const effectiveLayout = useMemo<TrackLayout>(() => ({
    ...baseLayout,
    name: editName || baseLayout.name,
    segments: isLocked ? baseLayout.segments : editSegs,
  }), [baseLayout, isLocked, editSegs, editName]);

  const inpBuilder = useCallback((p: VehicleParams): LapSimInput =>
    buildLapSimInput(p, coeffs), [coeffs]);

  const result = useMemo(() => computeLapTime(effectiveLayout, inpBuilder(params)), [params, effectiveLayout, inpBuilder]);

  // Push result up to App / TrackVisualiser whenever it changes
  useEffect(() => { onLapResultChange(result); }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  // Push effective layout up to App / TrackVisualiser overlay whenever it changes
  useEffect(() => { onLayoutChange(effectiveLayout); }, [effectiveLayout]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleOptimise = () => {
    setOptimState({ status: 'running' });
    setTimeout(() => {
      try {
        const res = optimiseSetup(params, effectiveLayout, inpBuilder, OPTIMISE_BOUNDS);
        setOptimState({ status: 'done', result: res });
      } catch (e) {
        setOptimState({ status: 'error', message: String(e) });
      }
    }, 0);
  };

  const handleApply = (res: OptimiseResult) => {
    onChange(res.bestParams);
    setOptimState({ status: 'idle' });
  };

  const handleSimulateRace = () => {
    setRaceState({ status: 'running' });
    setTimeout(() => {
      try {
        const inp    = inpBuilder(params);
        const raceResult = simulateRace(
          effectiveLayout, inp,
          numLaps,
          params.fuelLoadKg ?? 45,
          params.fuelBurnRateKgPerLap ?? 2.5,
          startTempC,
          params.tyreOptTempC,
          params.tyreTempHalfWidthC,
          params.tyreTempFloorMu,
        );
        setRaceState({ status: 'done', result: raceResult });
        onRaceResultChange(raceResult);
        onTriggerRaceAnim();
      } catch (e) {
        console.error(e);
        setRaceState({ status: 'error', message: String(e) });
      }
    }, 0);
  };

  const handleOptimiseStrategy = useCallback(() => {
    setStrategyRunning(true);
    setStrategyResult(null);
    setTimeout(() => {
      try {
        const inp = inpBuilder(params);
        const lapResult = computeLapTime(effectiveLayout, inp);
        const results = optimiseRaceStrategy(
          numLaps,
          lapResult.totalTimeSec,
          params.tyreOptTempC,
          params.tyreTempHalfWidthC,
          params.tyreTempFloorMu,
          params.driverAggression ?? 0.5,
          pitStopSec,
        );
        setStrategyResult(results);
      } catch (e) {
        console.error(e);
      } finally {
        setStrategyRunning(false);
      }
    }, 0);
  }, [params, effectiveLayout, inpBuilder, numLaps, pitStopSec]);

  // ── Track editor helpers ──────────────────────────────────────────────────

  const updateSeg = (idx: number, patch: Partial<TrackSegment>) => {
    setEditSegs(segs => segs.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const addSeg = () => {
    setEditSegs(segs => [...segs, { type: 'straight', length: 200 }]);
  };

  const removeSeg = (idx: number) => {
    setEditSegs(segs => segs.filter((_, i) => i !== idx));
  };

  const handleNewTrack = () => {
    const id = `custom_${Date.now()}`;
    const track: TrackLayout = {
      name: 'My Track',
      segments: [
        { type: 'straight', length: 400 },
        { type: 'corner',   length: 94, radius: 60, direction: 'left' },
        { type: 'straight', length: 300 },
        { type: 'corner',   length: 63, radius: 20, direction: 'left' },
      ],
    };
    const updated = { ...customTracks, [id]: track };
    setCustomTracks(updated);
    saveCustomTracks(updated);
    onTrackChange(id);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as Partial<TrackLayout>;
        if (!parsed.name || !Array.isArray(parsed.segments) || parsed.segments.length === 0) {
          alert('Invalid track file — must have "name" and "segments" array.');
          return;
        }
        const id = `custom_${Date.now()}`;
        const track: TrackLayout = { name: parsed.name, segments: parsed.segments };
        const updated = { ...customTracks, [id]: track };
        setCustomTracks(updated);
        saveCustomTracks(updated);
        onTrackChange(id);
      } catch {
        alert('Failed to parse track file — must be valid JSON.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleExport = () => {
    const json = JSON.stringify(effectiveLayout, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `${effectiveLayout.name.replace(/\s+/g, '_')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Auto-save edits to localStorage for custom tracks
  useEffect(() => {
    if (isBuiltin || isLocked || !trackKey.startsWith('custom_')) return;
    const updated = { ...customTracks, [trackKey]: { name: editName, segments: editSegs } };
    setCustomTracks(updated);
    saveCustomTracks(updated);
  }, [editSegs, editName]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalEditLength = editSegs.reduce((s, seg) => s + (seg.length || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Sticky ribbon ── */}
      <div style={{
        flexShrink: 0,
        background: '#0e0e1a',
        borderBottom: '2px solid var(--accent)',
        padding: '6px 14px',
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 80 }}>
          {effectiveLayout.name}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
          {(effectiveLayout.segments.reduce((s, seg) => s + seg.length, 0) / 1000).toFixed(3)} km
        </span>
        <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--accent-text)', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.02em' }}>
          {fmtTime(result.totalTimeSec)}
          <span style={{ fontSize: 10, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>({result.totalTimeSec.toFixed(1)}s)</span>
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          Top <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{result.maxSpeedKph.toFixed(0)} km/h</span>
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          Corner <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{result.minCornerKph.toFixed(0)} km/h</span>
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-muted)' }}>
          Avg <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{result.avgSpeedKph.toFixed(1)} km/h</span>
        </span>
      </div>

    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', flex: 1 }}>

      {/* Header + track selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Lap Time Estimator
          <InfoTooltip text="Point-mass lap simulation. Max corner speed from Pacejka μ + aero grip. Straight speed from engine P/V curve minus drag. Braking zones computed backward from corner entry." />
        </span>
        <button
          onClick={() => exportLapTimeCSV(effectiveLayout.name, result, params, coeffs)}
          title="Export lap time + segment breakdown as CSV"
          style={{
            marginLeft: 'auto', padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Lap Summary
        </button>
        <button
          onClick={() => {
            const trace = buildLapTrace(effectiveLayout, inpBuilder(params), trackKey);
            exportLapTraceCSV(trace, effectiveLayout.name, 'lap1', params);
          }}
          title="Export high-res single-lap telemetry trace (~5 m steps): speed, gear, RPM, G-forces, zone"
          style={{
            padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Lap Trace
        </button>
        <button
          onClick={() => {
            if (raceState.status !== 'done') return;
            const baseInp = inpBuilder(params);
            const traces  = buildRaceLapTraces(effectiveLayout, baseInp, raceState.result);
            exportRaceTelemetryCSV(traces, raceState.result, effectiveLayout.name, params);
          }}
          title={raceState.status === 'done' ? 'Export full race telemetry (all laps): speed, gear, RPM, G-forces, zone + lap summary header' : 'Run race simulation first'}
          disabled={raceState.status !== 'done'}
          style={{
            padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5,
            color: raceState.status === 'done' ? 'var(--text-secondary)' : 'var(--text-muted)',
            cursor: raceState.status === 'done' ? 'pointer' : 'not-allowed',
            opacity: raceState.status === 'done' ? 1 : 0.45,
          }}
        >
          Race Telemetry
        </button>
        <button
          onClick={() => telemetryFileInputRef.current?.click()}
          title="Upload a Lap Trace CSV to overlay against the current sim"
          style={{
            padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: uploadedTelemetry ? '#0c2a3a' : 'var(--bg-card)',
            border: `1px solid ${uploadedTelemetry ? '#38bdf8' : 'var(--border)'}`,
            borderRadius: 5, color: uploadedTelemetry ? '#38bdf8' : 'var(--text-secondary)',
            cursor: 'pointer',
          }}
        >
          {uploadedTelemetry ? 'Overlay: ON' : 'Import Telemetry'}
        </button>
        <input
          ref={telemetryFileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            file.text().then(txt => {
              const parsed = parseTelemetryCSV(txt, file.name);
              if (parsed) setUploadedTelemetry(parsed);
              else alert('Could not parse CSV — file needs at least dist_m and speed_kph columns.');
            }).catch(err => console.error('telemetry import error', err));
            e.target.value = '';
          }}
        />
        <select
          value={trackKey}
          onChange={e => onTrackChange(e.target.value)}
          style={{
            background: 'var(--bg-panel)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-primary)', fontSize: 10,
            padding: '4px 8px', cursor: 'pointer', outline: 'none',
          }}
        >
          <optgroup label="Generic">
            {['club', 'karting', 'gt_circuit', 'formula_test'].map(k => (
              <option key={k} value={k}>{TRACK_PRESETS[k].name}</option>
            ))}
          </optgroup>
          <optgroup label="World Championship Circuits">
            {['monza', 'spa', 'silverstone', 'suzuka',
              'nurburgring_gp', 'bahrain', 'barcelona', 'hungaroring', 'montreal'].map(k => (
              <option key={k} value={k}>{TRACK_PRESETS[k].name}</option>
            ))}
          </optgroup>
          <optgroup label="GT / Endurance">
            {['laguna_seca', 'imola', 'le_mans', 'sebring', 'mugello'].map(k => (
              <option key={k} value={k}>{TRACK_PRESETS[k].name}</option>
            ))}
          </optgroup>
          <optgroup label="International Circuits (GPS)">
            {['brands_hatch', 'hockenheim', 'spielberg', 'zandvoort', 'sao_paulo'].map(k => (
              <option key={k} value={k}>{TRACK_PRESETS[k].name}</option>
            ))}
          </optgroup>
          {Object.keys(customTracks).length > 0 && (
            <optgroup label="My Circuits">
              {Object.entries(customTracks).map(([id, t]) => (
                <option key={id} value={id}>{t.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Vehicle identity strip */}
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.mass} kg</span>
        <span>·</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtPower(params.enginePowerKW, powerUnit)}</span>
        <span>·</span>
        <span>μ <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{coeffs.peakMu.toFixed(2)}</span></span>
        <span>·</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.drivetrainType}</span>
        {params.aeroCL > 0.05 && <>
          <span>·</span>
          <span>CL <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.aeroCL.toFixed(2)}</span></span>
        </>}
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <SummaryCard label="Lap time" value={fmtTime(result.totalTimeSec)} accent />
        <SummaryCard label="Avg speed" value={`${result.avgSpeedKph.toFixed(1)} km/h`} />
        <SummaryCard label="Top speed" value={`${result.maxSpeedKph.toFixed(1)} km/h`} />
        <SummaryCard label="Min corner" value={`${result.minCornerKph.toFixed(1)} km/h`} />
      </div>

      {/* Stage 39 — Telemetry overlay */}
      {uploadedTelemetry && (
        <TelemetryOverlayChart
          simTrace={buildLapTrace(effectiveLayout, inpBuilder(params), trackKey)}
          uploaded={uploadedTelemetry}
          onClose={() => setUploadedTelemetry(null)}
        />
      )}

      {/* Stage 20 — Setup comparison */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button
          onClick={() => setBaseline({
            timeSec: result.totalTimeSec,
            s1Sec: 0, s2Sec: 0, s3Sec: 0,
            label: `${params.vehicleClass} ${new Date().toLocaleTimeString()}`,
            powerKW: params.enginePowerKW,
            mass: params.mass,
            peakMu: inpBuilder(params).peakMu,
          })}
          title="Save current lap time as baseline for comparison"
          style={{
            padding: '3px 10px', fontSize: 9, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          {baseline ? 'Update Baseline' : 'Save Baseline'}
        </button>
        {baseline && (
          <>
            <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
              Baseline: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{fmtTime(baseline.timeSec)}</span>
              <span style={{ color: 'var(--text-dim)' }}> ({baseline.label})</span>
            </span>
            {(() => {
              const delta = result.totalTimeSec - baseline.timeSec;
              const sign  = delta >= 0 ? '+' : '';
              const color = delta < -0.05 ? '#4ade80' : delta > 0.05 ? '#f87171' : 'var(--text-secondary)';
              return (
                <span style={{ fontSize: 11, fontWeight: 700, color }}>
                  {sign}{delta.toFixed(3)} s
                </span>
              );
            })()}
            <button
              onClick={() => setBaseline(null)}
              title="Clear baseline"
              style={{
                padding: '2px 7px', fontSize: 9, background: 'transparent',
                border: '1px solid var(--border)', borderRadius: 4,
                color: 'var(--text-dim)', cursor: 'pointer',
              }}
            >
              ×
            </button>
          </>
        )}
      </div>

      {/* Stage 36 — Multi-car comparison param cards */}
      {baseline && (() => {
        const inp = inpBuilder(params);
        return (
          <div style={{ padding: '6px 8px', borderRadius: 5, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', fontSize: 9, marginTop: 4 }}>
            <div style={{ display: 'flex', gap: 12, marginBottom: 4, alignItems: 'center' }}>
              <span style={{ color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>vs {baseline.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
              {[
                { label: 'Mass', a: `${baseline.mass} kg`, b: `${params.mass} kg`, better: params.mass < baseline.mass },
                { label: 'Power', a: `${baseline.powerKW} kW`, b: `${params.enginePowerKW} kW`, better: params.enginePowerKW > baseline.powerKW },
                { label: 'Peak μ', a: baseline.peakMu.toFixed(2), b: inp.peakMu.toFixed(2), better: inp.peakMu > baseline.peakMu },
              ].map(({ label, a, b, better }) => (
                <div key={label} style={{ background: 'var(--bg)', borderRadius: 3, padding: '2px 5px' }}>
                  <div style={{ color: 'var(--text-dim)', fontSize: 8 }}>{label}</div>
                  <div style={{ color: 'var(--text-faint)', fontSize: 8 }}>A: {a}</div>
                  <div style={{ color: better ? '#86efac' : '#f87171', fontSize: 8 }}>B: {b}</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Setup optimiser */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4, marginBottom: 2 }}>
          Setup Optimiser
          <InfoTooltip text="Nelder-Mead optimisation over 7 setup parameters (springs, ARBs, aero, brake bias) to minimise lap time on the selected circuit. Spring/ARB effects are computed via load transfer → tyre load sensitivity → effective μ penalty." />
        </span>
        <button
          onClick={handleOptimise}
          disabled={optimState.status === 'running'}
          style={{
            padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-secondary)', cursor: optimState.status === 'running' ? 'default' : 'pointer',
            opacity: optimState.status === 'running' ? 0.6 : 1,
          }}
        >
          {optimState.status === 'running' ? 'Optimising…' : 'Optimise Setup'}
        </button>
        {optimState.status === 'idle' && (
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>~1–2 s</span>
        )}
      </div>

      {optimState.status === 'done' && (
        <OptimResultCard result={optimState.result} baseParams={params} onApply={handleApply} />
      )}
      {optimState.status === 'error' && (
        <div style={{ fontSize: 10, color: '#f87171', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 6, border: '1px solid #f87171' }}>
          Optimisation failed: {optimState.message}
        </div>
      )}

      {/* Segment breakdown */}
      <div style={{ fontSize: 9, color: 'var(--text-faint)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        Segment breakdown
      </div>
      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '90px 48px 80px 48px 1fr 48px', alignItems: 'center', gap: 6, fontSize: 8, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        <span>Segment</span>
        <span>Time</span>
        <span>Speed</span>
        <span>Length</span>
        <span></span>
        <span style={{ textAlign: 'right' }}>%</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {result.segments.map((seg, i) => (
          <SegmentRow key={i} seg={seg} totalTime={result.totalTimeSec} />
        ))}
      </div>

      {/* Race Simulation */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-text)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4, marginBottom: 2 }}>
            Race Simulation
            <InfoTooltip text="Multi-lap simulation with tyre thermal evolution and fuel burn. Tyre temp rises from cold start → optimal → degrades. μ follows a bell curve centred at optimal temp. Fuel mass reduction is modelled per-lap. Sectors split at 1/3 and 2/3 of track distance." />
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 3 }}>
              Laps: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{numLaps}</span>
            </div>
            <input type="range" min={1} max={50} value={numLaps}
              onChange={e => setNumLaps(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
          <div>
            <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 3 }}>
              Start tyre temp: <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{startTempC}°C</span>
              <span style={{ color: 'var(--text-dim)', fontSize: 8 }}> (opt: {params.tyreOptTempC}°C)</span>
            </div>
            <input type="range" min={10} max={80} value={startTempC}
              onChange={e => setStartTempC(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--accent)' }} />
          </div>
        </div>

        <div style={{ fontSize: 9, color: 'var(--text-muted)', display: 'flex', gap: 12 }}>
          <span>Fuel load: <span style={{ color: 'var(--text-secondary)' }}>{(params.fuelLoadKg ?? 45).toFixed(0)} kg</span></span>
          <span>Burn rate: <span style={{ color: 'var(--text-secondary)' }}>{(params.fuelBurnRateKgPerLap ?? 2.5).toFixed(1)} kg/lap</span></span>
          <span style={{ color: 'var(--text-dim)' }}>→ {(numLaps * (params.fuelBurnRateKgPerLap ?? 2.5)).toFixed(1)} kg total</span>
        </div>

        <button
          onClick={handleSimulateRace}
          disabled={raceState.status === 'running'}
          style={{
            padding: '5px 14px', fontSize: 10, fontWeight: 700, alignSelf: 'flex-start',
            background: raceState.status === 'running' ? 'var(--bg-card)' : 'var(--accent)',
            border: 'none', borderRadius: 5,
            color: raceState.status === 'running' ? 'var(--text-muted)' : 'var(--accent-text)',
            cursor: raceState.status === 'running' ? 'default' : 'pointer',
            opacity: raceState.status === 'running' ? 0.6 : 1,
          }}
        >
          {raceState.status === 'running' ? 'Simulating…' : 'Simulate Race'}
        </button>

        {raceState.status === 'error' && (
          <div style={{ fontSize: 10, color: '#f87171', padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 6 }}>
            {raceState.message}
          </div>
        )}

        {raceState.status === 'done' && (
          <RaceResultTable result={raceState.result} />
        )}
      </div>

      {/* ── Strategy Optimiser ─────────────────────────────────────── */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Race Strategy
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>
              Pit stop loss:
            </span>
            <input
              type="number" min={10} max={60} value={pitStopSec}
              onChange={e => setPitStopSec(Math.max(10, Math.min(60, parseInt(e.target.value) || 25)))}
              style={{ width: 38, fontSize: 9, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text-secondary)', padding: '1px 4px', textAlign: 'center' }}
            />
            <span style={{ fontSize: 9, color: 'var(--text-faint)' }}>s</span>
            <button
              onClick={handleOptimiseStrategy}
              disabled={strategyRunning}
              style={{
                padding: '4px 12px', fontSize: 10, fontWeight: 700,
                background: strategyRunning ? 'var(--bg-card)' : 'rgba(99,102,241,0.20)',
                border: `1px solid ${strategyRunning ? 'var(--border)' : '#6366f1'}`,
                borderRadius: 5, color: strategyRunning ? 'var(--text-muted)' : '#a5b4fc',
                cursor: strategyRunning ? 'default' : 'pointer',
              }}
            >
              {strategyRunning ? 'Optimising…' : '⚡ Optimise Strategy'}
            </button>
          </div>

          {strategyResult && strategyResult.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {strategyResult.map((s, i) => {
                const compoundColor: Record<string, string> = {
                  soft: '#ef4444', medium: '#f59e0b', hard: '#9ca3af',
                  inter: '#22c55e', wet: '#3b82f6',
                };
                const isBest = i === 0;
                return (
                  <div key={i} style={{
                    padding: '5px 8px', borderRadius: 5, fontSize: 9,
                    background: isBest ? 'rgba(99,102,241,0.12)' : 'var(--bg-card)',
                    border: `1px solid ${isBest ? '#6366f1' : 'var(--border-subtle)'}`,
                    display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                  }}>
                    {isBest && <span style={{ color: '#a5b4fc', fontWeight: 700, fontSize: 8 }}>OPTIMAL</span>}
                    <span style={{ color: 'var(--text-faint)' }}>{s.numStops}-stop</span>
                    <span style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                      {s.stints.map((st, j) => (
                        <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                          {j > 0 && <span style={{ color: 'var(--text-dim)', fontSize: 8 }}>→pit{s.pitLaps[j-1]}→</span>}
                          <span style={{ color: compoundColor[st.compound] ?? 'var(--text-secondary)', fontWeight: 700, textTransform: 'capitalize' }}>
                            {st.compound.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--text-dim)' }}>({st.stintLaps}L)</span>
                        </span>
                      ))}
                    </span>
                    <span style={{ marginLeft: 'auto', color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {fmtStratTime(s.totalTimeSec)}
                    </span>
                  </div>
                );
              })}
              <div style={{ fontSize: 8, color: 'var(--text-dim)', fontStyle: 'italic' }}>
                Dry compounds only · Grip model: thermal × mechanical wear · Same tyre rules apply
              </div>
            </div>
          )}
        </div>

      {/* Track Editor */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Editor header + toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Track Editor
          </span>

          {/* Lock / Unlock */}
          <button
            onClick={() => setIsLocked(l => !l)}
            title={isLocked ? 'Unlock to edit segments' : 'Lock (discard edits)'}
            style={{
              padding: '2px 8px', fontSize: 9, fontWeight: 600,
              background: isLocked ? 'var(--bg-card)' : 'rgba(250,200,100,0.12)',
              border: `1px solid ${isLocked ? 'var(--border)' : '#f59e0b'}`,
              borderRadius: 4, color: isLocked ? 'var(--text-dim)' : '#f59e0b', cursor: 'pointer',
            }}
          >
            {isLocked ? '🔒 Locked' : '🔓 Editing'}
          </button>

          {!isLocked && (
            <>
              <button onClick={addSeg} style={editorBtnStyle}>+ Segment</button>

              <button onClick={handleNewTrack} style={editorBtnStyle} title="Create blank custom circuit">
                New Track
              </button>
            </>
          )}

          {/* Import */}
          <button
            onClick={() => importRef.current?.click()}
            style={editorBtnStyle}
            title="Import circuit from JSON file"
          >
            Import JSON
          </button>
          <input ref={importRef} type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />

          {/* Export */}
          <button onClick={handleExport} style={editorBtnStyle} title="Export current circuit as JSON">
            Export JSON
          </button>

          {/* Total distance */}
          <span style={{ marginLeft: 'auto', fontSize: 9, color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {(totalEditLength / 1000).toFixed(3)} km
          </span>
        </div>

        {/* Track name input (editable when unlocked) */}
        {!isLocked && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 9, color: 'var(--text-faint)', minWidth: 40 }}>Name</span>
            <input
              value={editName}
              onChange={e => setEditName(e.target.value)}
              style={{
                flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 4, color: 'var(--text-primary)', fontSize: 10,
                padding: '3px 7px', outline: 'none',
              }}
            />
          </div>
        )}

        {/* Segment table header */}
        <div style={{ display: 'grid', gridTemplateColumns: '22px 64px 70px 60px 60px 52px 24px', gap: 4, alignItems: 'center' }}>
          {['#', 'Type', 'Label', 'R (m)', 'Len (m)', 'Dir', ''].map(h => (
            <span key={h} style={{ fontSize: 8, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase' }}>{h}</span>
          ))}
        </div>

        {/* Segment rows */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 260, overflowY: 'auto' }}>
          {editSegs.map((seg, i) => (
            <SegmentEditorRow
              key={i}
              index={i}
              seg={seg}
              locked={isLocked}
              onChange={patch => updateSeg(i, patch)}
              onDelete={() => removeSeg(i)}
            />
          ))}
        </div>

        {isLocked && (
          <span style={{ fontSize: 9, color: 'var(--text-dim)' }}>
            Unlock to edit segments. Changes affect lap time calculation live.
          </span>
        )}
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4 }}>
        Point-mass lap sim · Pacejka tyre model · Gear model (Stage 10) · Combined slip (Stage 13) · Tyre thermal (Stage 11)
      </div>

      {/* Stage 21 — About / Methodology */}
      <AboutSection />
    </div>
    </div>
  );
}

// ── About / Methodology (Stage 21) ────────────────────────────────────────────

function AboutSection() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 10, marginTop: 4 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          background: 'transparent', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 9, fontWeight: 700, color: 'var(--text-faint)',
          textTransform: 'uppercase', letterSpacing: '0.08em',
          padding: 0,
        }}
      >
        <span style={{ fontSize: 10 }}>{open ? '▾' : '▸'}</span>
        About &amp; Methodology
      </button>

      {open && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 9, color: 'var(--text-muted)', lineHeight: 1.6 }}>

          {/* Physics stages */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Physics Model Stages
            </div>
            {[
              ['1',  'Bicycle model',           'Steady-state yaw / understeer gradient (Gillespie Ch.6)'],
              ['2',  'Pacejka Magic Formula',    'Nonlinear tyre Fy + Fx (RCVD Ch.2)'],
              ['3',  'Load transfer',            'Per-corner Fz, combined slip, FWD/RWD/AWD/AWD+TV'],
              ['4',  'Suspension (roll)',         'Roll angle, ARB, Fz split front/rear (RCVD Ch.16)'],
              ['5',  'Braking model',            'Brake bias, ABS clip, combined braking + cornering'],
              ['6',  'Aerodynamics',             'Speed-dependent downforce + drag, axle splits'],
              ['7',  'Lap time estimator',       'Point-mass sim over corner + straight segments'],
              ['8',  '14-DOF time domain',       'Step steer / sine sweep / brake-in-turn (RK4 ODE)'],
              ['9',  'Tyre load sensitivity',    'Pacejka degressive μ with Fz (qFz)'],
              ['10', 'Gear + powertrain',        'Gear ratios, shift points, rev-limited P/V curve'],
              ['11', 'Tyre thermal model',       'μ bell curve vs temperature, warmup/degradation'],
              ['12', 'Setup optimisation',       'Nelder-Mead simplex over 7 params → min lap time'],
              ['13', 'Full nonlinear model',     'Separate F/R Cα, friction circle, yaw transient'],
              ['14', 'Race simulation',          'Multi-lap: tyre warmup, fuel burn, sector times'],
              ['15', 'Track editor',             'Editable segment table + SVG preview, JSON export'],
              ['16', 'GPS circuit maps',         '22 circuits: TUMFTM LGPL-3.0 + OSM ODbL GPS paths'],
              ['18', 'Vehicle presets',          'Road / Formula Student / GT3 / F1 one-click params'],
              ['19', 'Onboarding',               'First-visit banner + inline tooltips on every slider'],
              ['20', 'Setup comparison',         'Save baseline → run variant → show Δ lap time'],
              ['22', 'Camber + toe',             'Camber thrust (Cγ × γ) + toe effective Cα (RCVD §2.3)'],
              ['23', 'Tyre wear model',          'Soft/medium/hard/inter/wet — warmup, wear cliff, graining'],
              ['24', 'Wind + ambient',           'ISA air density (altitude + temp), headwind, crosswind μ'],
              ['25', 'Driver model',             'Aggression 0–100%: heat rate, wear rate, μ utilisation'],
              ['26', 'Differential model',       'Open / LSD / Locked — traction efficiency + yaw moment'],
              ['27', 'Brake temperature',        'Disc temp per lap, Gaussian fade, braking capacity scaling'],
              ['28', 'Tyre pressure',            'Cα × (p/2.0)^0.35, μ × (2.0/p)^0.10 (Pacejka §4.3.1)'],
              ['29', 'Ride height + rake',       'Rake → aero balance shift; CL boost at low ride height'],
              ['30', 'Race strategy optimizer',  'Brute-force 1/2-stop over soft/medium/hard compounds'],
              ['31', 'Engine torque curve',      'NA bell curve, turbo plateau, electric flat from 0'],
              ['32', 'Traction control',         'Slip ratio threshold — clamps drive force on driven axle'],
              ['33', 'Track rubber evolution',   'peakMu × (1 + 0.15 × rubberLevel) — green to rubbed'],
              ['34', 'Wet track + drying line',  'Per-compound wetGripFactor — slick → 0.30 at standing water'],
              ['35', 'ERS / Hybrid',             'MGU-K additive force, deploy strategies, energy budget'],
              ['36', 'Multi-car comparison',     'Mass/power/peakMu vs baseline — Δ lap time cards'],
              ['37', 'Track banking + elevation','Banked corner FBD (RCVD §2.5), gradient drive/brake forces'],
              ['38', 'Data export',              'Lap trace + race telemetry CSV (speed, gear, RPM, G-forces)'],
              ['39', 'Telemetry overlay',        'Upload CSV → compare vs sim in overlaid speed/G-force charts'],
            ].map(([n, name, desc]) => (
              <div key={n} style={{ display: 'grid', gridTemplateColumns: '16px 100px 1fr', gap: 4, fontSize: 9, alignItems: 'baseline' }}>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{n}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
                <span style={{ color: 'var(--text-dim)' }}>{desc}</span>
              </div>
            ))}
          </div>

          {/* References */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Validation References
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>Milliken &amp; Milliken — <em>Race Car Vehicle Dynamics</em> (RCVD), SAE 1995</span>
              <span>Gillespie — <em>Fundamentals of Vehicle Dynamics</em>, SAE 1992</span>
              <span>Pacejka — <em>Tyre and Vehicle Dynamics</em>, 3rd ed., Butterworth-Heinemann 2012</span>
              <span>All 21 validation checks pass · Extended suite: 424/424 pass</span>
            </div>
          </div>

          {/* Attribution */}
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
              Circuit Data Attribution
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span>
                <span style={{ color: 'var(--text-secondary)' }}>TUMFTM Racetrack Database</span> — 14 circuits.
                {' '}GPS paths © TU Munich (TUMFTM), licensed LGPL-3.0.
              </span>
              <span>
                <span style={{ color: 'var(--text-secondary)' }}>OpenStreetMap contributors</span> — 4 circuits.
                {' '}GPS paths © OpenStreetMap, licensed ODbL 1.0.
              </span>
              <span style={{ color: 'var(--text-dim)' }}>
                4 generic circuits hand-designed. All schematic circuits (Monza, Spa, Silverstone, Suzuka) hand-crafted from published track guides.
              </span>
            </div>
          </div>

          {/* Build info */}
          <div style={{ color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', paddingTop: 6 }}>
            RacePhysiX — MIT License · Srikar Buddhiraju (MEng Automotive Engineering, University of Leeds, 2019)
          </div>
        </div>
      )}
    </div>
  );
}

// ── Editor row ─────────────────────────────────────────────────────────────────

const editorBtnStyle: React.CSSProperties = {
  padding: '2px 8px', fontSize: 9, fontWeight: 600,
  background: 'var(--bg-card)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text-secondary)', cursor: 'pointer',
};

function SegmentEditorRow({
  index, seg, locked, onChange, onDelete,
}: {
  index:    number;
  seg:      TrackSegment;
  locked:   boolean;
  onChange: (p: Partial<TrackSegment>) => void;
  onDelete: () => void;
}) {
  const isCorner = seg.type === 'corner';
  const inp: React.CSSProperties = {
    width: '100%', background: locked ? 'transparent' : 'var(--bg-card)',
    border: locked ? 'none' : '1px solid var(--border)',
    borderRadius: 3, color: locked ? 'var(--text-muted)' : 'var(--text-primary)',
    fontSize: 9, padding: '2px 4px', outline: 'none',
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '22px 64px 70px 60px 60px 52px 24px', gap: 4, alignItems: 'center' }}>
      <span style={{ fontSize: 8, color: 'var(--text-dim)', textAlign: 'center' }}>{index + 1}</span>

      {/* Type */}
      <select
        value={seg.type}
        disabled={locked}
        onChange={e => onChange({ type: e.target.value as 'corner' | 'straight', radius: e.target.value === 'straight' ? undefined : (seg.radius ?? 50) })}
        style={{ ...inp, cursor: locked ? 'default' : 'pointer' }}
      >
        <option value="straight">Straight</option>
        <option value="corner">Corner</option>
      </select>

      {/* Label */}
      <input
        type="text"
        value={seg.label ?? ''}
        disabled={locked}
        placeholder="auto"
        onChange={e => onChange({ label: e.target.value || undefined })}
        style={inp}
      />

      {/* Radius */}
      <input
        type="number"
        value={isCorner ? (seg.radius ?? '') : ''}
        disabled={locked || !isCorner}
        min={5}
        onChange={e => onChange({ radius: parseFloat(e.target.value) || undefined })}
        style={{ ...inp, color: isCorner ? (locked ? 'var(--text-muted)' : 'var(--text-primary)') : 'var(--text-dim)' }}
        placeholder={isCorner ? '60' : '—'}
      />

      {/* Length */}
      <input
        type="number"
        value={seg.length}
        disabled={locked}
        min={1}
        onChange={e => onChange({ length: parseFloat(e.target.value) || 1 })}
        style={inp}
      />

      {/* Direction */}
      <select
        value={seg.direction ?? 'left'}
        disabled={locked || !isCorner}
        onChange={e => onChange({ direction: e.target.value as 'left' | 'right' })}
        style={{ ...inp, cursor: locked || !isCorner ? 'default' : 'pointer', color: isCorner ? (locked ? 'var(--text-muted)' : 'var(--text-primary)') : 'var(--text-dim)' }}
      >
        <option value="left">Left</option>
        <option value="right">Right</option>
      </select>

      {/* Delete */}
      {!locked ? (
        <button
          onClick={onDelete}
          title="Remove segment"
          style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
        >
          ×
        </button>
      ) : <span />}
    </div>
  );
}

// ── Race result table ──────────────────────────────────────────────────────────

function fmtSec(s: number): string { return s.toFixed(3); }

function RaceResultTable({ result }: { result: RaceResult }) {
  const { laps, fastestLapNum } = result;
  const COL = { lap: 28, time: 54, gap: 48, s1: 40, s2: 40, s3: 40, temp: 36, mu: 32, fuel: 36 };
  const headerStyle: React.CSSProperties = {
    fontSize: 8, color: 'var(--text-faint)', fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: '0.04em', textAlign: 'right' as const, paddingBottom: 4,
  };
  const cellStyle: React.CSSProperties = {
    fontSize: 9, textAlign: 'right' as const, fontVariantNumeric: 'tabular-nums', padding: '2px 0',
  };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 354 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <th style={{ ...headerStyle, width: COL.lap, textAlign: 'left' as const }}>Lap</th>
            <th style={{ ...headerStyle, width: COL.time }}>Time</th>
            <th style={{ ...headerStyle, width: COL.gap }}>Gap</th>
            <th style={{ ...headerStyle, width: COL.s1 }}>S1</th>
            <th style={{ ...headerStyle, width: COL.s2 }}>S2</th>
            <th style={{ ...headerStyle, width: COL.s3 }}>S3</th>
            <th style={{ ...headerStyle, width: COL.temp }}>T°C</th>
            <th style={{ ...headerStyle, width: COL.mu }}>μ%</th>
            <th style={{ ...headerStyle, width: COL.fuel }}>Fuel</th>
          </tr>
        </thead>
        <tbody>
          {laps.map(lap => {
            const isFastest = lap.lap === fastestLapNum;
            const rowStyle: React.CSSProperties = {
              background: isFastest ? 'var(--bg-active)' : 'transparent',
              borderBottom: '1px solid var(--border-subtle)',
            };
            const timeColor = isFastest ? 'var(--accent-text)' : 'var(--text-primary)';
            const gapColor  = lap.gapToFastestSec < 0.001 ? 'var(--accent-text)' :
                              lap.gapToFastestSec > 2 ? '#f87171' : 'var(--text-muted)';
            const muColor   = lap.muFraction > 0.97 ? '#4ade80' :
                              lap.muFraction > 0.90 ? 'var(--text-secondary)' : '#f87171';
            return (
              <tr key={lap.lap} style={rowStyle}>
                <td style={{ ...cellStyle, textAlign: 'left', color: isFastest ? 'var(--accent-text)' : 'var(--text-faint)', fontWeight: isFastest ? 700 : 400 }}>
                  {lap.lap}{isFastest ? ' ★' : ''}
                </td>
                <td style={{ ...cellStyle, color: timeColor, fontWeight: isFastest ? 700 : 400 }}>{fmtTime(lap.lapTimeSec)}</td>
                <td style={{ ...cellStyle, color: gapColor }}>{lap.gapToFastestSec < 0.001 ? '—' : `+${fmtSec(lap.gapToFastestSec)}`}</td>
                <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{fmtSec(lap.s1Sec)}</td>
                <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{fmtSec(lap.s2Sec)}</td>
                <td style={{ ...cellStyle, color: 'var(--text-muted)' }}>{fmtSec(lap.s3Sec)}</td>
                <td style={{ ...cellStyle, color: 'var(--text-secondary)' }}>{lap.tyreTempC.toFixed(0)}</td>
                <td style={{ ...cellStyle, color: muColor }}>{(lap.muFraction * 100).toFixed(0)}</td>
                <td style={{ ...cellStyle, color: 'var(--text-dim)' }}>{lap.fuelMassKg.toFixed(1)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: '1px solid var(--border)' }}>
            <td colSpan={2} style={{ ...cellStyle, textAlign: 'left', color: 'var(--text-secondary)', fontWeight: 700, paddingTop: 4 }}>Total</td>
            <td colSpan={7} style={{ ...cellStyle, color: 'var(--text-secondary)', fontWeight: 700, paddingTop: 4 }}>{fmtTime(result.totalTimeSec)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── OptimResultCard ────────────────────────────────────────────────────────────

function OptimResultCard({
  result, baseParams, onApply,
}: { result: OptimiseResult; baseParams: VehicleParams; onApply: (r: OptimiseResult) => void }) {
  const improved = result.improvement > 0.05;
  return (
    <div style={{
      background: improved ? 'var(--bg-active)' : 'var(--bg-card)',
      border: `1px solid ${improved ? 'var(--accent)' : 'var(--border-subtle)'}`,
      borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {improved ? (
          <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-text)', fontVariantNumeric: 'tabular-nums' }}>
            −{result.improvement.toFixed(1)}s
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Already near-optimal</span>
        )}
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
          {fmtTime(result.baseTimeSec)} → {fmtTime(result.bestTimeSec)}
          {improved && (
            <span style={{ color: '#4ade80', fontWeight: 600, marginLeft: 6 }}>
              Δ −{(result.baseTimeSec - result.bestTimeSec).toFixed(3)}s
            </span>
          )}
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 'auto' }}>{result.iterations} iterations</span>
        {improved && (
          <button
            onClick={() => onApply(result)}
            style={{ padding: '3px 10px', fontSize: 10, fontWeight: 600, background: 'var(--accent)', border: 'none', borderRadius: 5, color: 'var(--accent-text)', cursor: 'pointer' }}
          >
            Apply
          </button>
        )}
      </div>
      {improved && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 12px' }}>
          {OPTIMISABLE_KEYS.map(key => {
            const wasVal  = baseParams[key] as number;
            const nowVal  = result.bestParams[key] as number;
            const changed = Math.abs(nowVal - wasVal) > Math.abs(wasVal) * 0.005;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: 10 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: changed ? 600 : 400 }}>{OPTIM_LABELS[key]}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: changed ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                  {fmtParamValue(key, nowVal)}
                  {changed && <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>{' '}(was {fmtParamValue(key, wasVal)})</span>}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── SummaryCard ────────────────────────────────────────────────────────────────

function SummaryCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{
      background: accent ? 'var(--bg-active)' : 'var(--bg-card)',
      border: `1px solid ${accent ? 'var(--accent)' : 'var(--border-subtle)'}`,
      borderRadius: 6, padding: '7px 8px',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text-faint)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: accent ? 16 : 13, fontWeight: 700, color: accent ? 'var(--accent-text)' : 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
  );
}

// ── SegmentRow (breakdown display, read-only) ──────────────────────────────────

function SegmentRow({ seg, totalTime }: { seg: import('../physics/laptime').SegmentResult; totalTime: number }) {
  const isCorner = seg.type === 'corner';
  const pct      = (seg.timeSec / totalTime) * 100;
  const color    = isCorner ? '#f87171' : '#60a5fa';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '90px 48px 80px 48px 1fr 48px', alignItems: 'center', gap: 6, fontSize: 10 }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: isCorner ? 600 : 400 }}>
        {seg.label}
      </span>
      <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>{fmtTime(seg.timeSec)}</span>
      <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>
        {isCorner ? `${seg.minSpeedKph.toFixed(0)} km/h` : `${seg.minSpeedKph.toFixed(0)}→${seg.maxSpeedKph.toFixed(0)} km/h`}
      </span>
      <span style={{ color: 'var(--text-faint)', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>
        {seg.length.toFixed(0)}m{isCorner && seg.radius != null ? ` · R${seg.radius}m` : ''}
      </span>
      <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 9, textAlign: 'right' }}>{pct.toFixed(1)}%</span>
    </div>
  );
}
