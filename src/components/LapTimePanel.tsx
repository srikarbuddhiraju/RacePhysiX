import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { computeLapTime, TRACK_PRESETS } from '../physics/laptime';
import { computeMaxDriveForce } from '../physics/gearModel';
import { optimiseSetup, OPTIMISE_BOUNDS, OPTIMISABLE_KEYS } from '../physics/optimise';
import type { OptimiseResult } from '../physics/optimise';
import type { TrackLayout } from '../physics/laptime';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import { InfoTooltip } from './InfoTooltip';
import { exportLapTimeCSV } from '../utils/export';

const G = 9.81;

interface Props {
  params:   VehicleParams;
  coeffs:   PacejkaCoeffs;
  onChange: (p: VehicleParams) => void;
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
  if (key === 'aeroBalance') return `${(v * 100).toFixed(0)}F/${((1 - v) * 100).toFixed(0)}R`;
  if (key === 'brakeBias')   return `${(v * 100).toFixed(0)}F/${((1 - v) * 100).toFixed(0)}R`;
  return `${(v / 1000).toFixed(1)}k N/m`;
}

const RHO_AIR = 1.225;

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  // 1 decimal place — matches estimator precision. mm:ss.s for lap totals, ss.ss for segments.
  return m > 0 ? `${m}:${s.toFixed(1).padStart(4, '0')}` : `${s.toFixed(1)}s`;
}

type OptimState =
  | { status: 'idle' }
  | { status: 'running' }
  | { status: 'done'; result: OptimiseResult }
  | { status: 'error'; message: string };

export function LapTimePanel({ params, coeffs, onChange }: Props) {
  const [trackKey,   setTrackKey]   = useState<string>('club');
  const [optimState, setOptimState] = useState<OptimState>({ status: 'idle' });
  const layout = TRACK_PRESETS[trackKey];

  /**
   * Build a LapSimInput from candidate params.
   * Computes effective peakMu accounting for suspension load transfer at 1g lateral:
   *   higher roll stiffness ratio → more load on outer tyre → load sensitivity penalty.
   * This makes spring and ARB rates meaningful in the optimiser objective.
   */
  const inpBuilder = useCallback((p: VehicleParams) => {
    const { mass, brakingG, aeroCD, aeroReferenceArea, cgHeight, trackWidth,
            tyreLoadSensitivity } = p;
    const peakMu      = coeffs.peakMu;
    const brakingCapG = Math.max(brakingG, 0.9);

    // Roll stiffness ratio at candidate setup
    const tw2o2   = (trackWidth * trackWidth) / 2;
    const kPhiF   = (p.frontSpringRate + p.frontARBRate) * tw2o2;
    const kPhiR   = (p.rearSpringRate  + p.rearARBRate)  * tw2o2;
    const kPhiTot = kPhiF + kPhiR;
    const phiFront = kPhiTot > 0 ? kPhiF / kPhiTot : 0.5;

    // Lateral load transfer at representative 1g, front outer tyre
    const FzStatic  = mass * G / 4;
    const dFzOuter  = mass * G * cgHeight * phiFront / trackWidth;
    const FzOuter   = FzStatic + dFzOuter;

    // Load sensitivity: μ degrades on overloaded outer tyre
    const qFz       = tyreLoadSensitivity;
    const muFrac    = qFz > 0 ? Math.max(0.5, 1 - qFz * (FzOuter / FzStatic - 1)) : 1.0;
    const peakMuEff = peakMu * muFrac;

    const dragForce  = (V: number) => 0.5 * RHO_AIR * V * V * aeroReferenceArea * aeroCD;
    const driveForce = (V: number) => computeMaxDriveForce(V, p);
    return {
      mass, peakMu: peakMuEff, brakingCapG,
      aeroCL: p.aeroCL, aeroCD, aeroReferenceArea, dragForce, driveForce,
    };
  }, [coeffs]);

  const result = useMemo(() => computeLapTime(layout, inpBuilder(params)), [params, layout, inpBuilder]);

  const handleOptimise = () => {
    setOptimState({ status: 'running' });
    setTimeout(() => {
      try {
        const res = optimiseSetup(params, layout, inpBuilder, OPTIMISE_BOUNDS);
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

  return (
    <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', height: '100%' }}>

      {/* Header + track selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Lap Time Estimator
          <InfoTooltip text="Point-mass lap simulation. Max corner speed from Pacejka μ + aero grip. Straight speed from engine P/V curve minus drag. Braking zones computed backward from corner entry." />
        </span>
        <button
          onClick={() => exportLapTimeCSV(layout.name, result, params, coeffs)}
          title="Export lap time + segment breakdown as CSV"
          style={{
            marginLeft: 'auto', padding: '3px 10px', fontSize: 10, fontWeight: 600,
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 5, color: 'var(--text-secondary)', cursor: 'pointer',
          }}
        >
          Export CSV
        </button>
        <select
          value={trackKey}
          onChange={e => setTrackKey(e.target.value)}
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
          <optgroup label="Real Circuits">
            {['monza', 'monaco', 'spa', 'silverstone', 'suzuka'].map(k => (
              <option key={k} value={k}>{TRACK_PRESETS[k].name}</option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* Vehicle identity strip */}
      <div style={{ display: 'flex', gap: 14, fontSize: 10, color: 'var(--text-muted)', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.mass} kg</span>
        <span>·</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.enginePowerKW} kW</span>
        <span>·</span>
        <span>μ <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{coeffs.peakMu.toFixed(2)}</span></span>
        <span>·</span>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.drivetrainType}</span>
        {params.aeroCL > 0.05 && <>
          <span>·</span>
          <span>CL <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{params.aeroCL.toFixed(2)}</span></span>
        </>}
      </div>

      {/* Track map */}
      <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '8px 10px' }}>
        <TrackMapSVG layout={layout} result={result} />
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        <SummaryCard label="Lap time" value={fmtTime(result.totalTimeSec)} accent />
        <SummaryCard label="Avg speed" value={`${result.avgSpeedKph.toFixed(1)} km/h`} />
        <SummaryCard label="Top speed" value={`${result.maxSpeedKph.toFixed(1)} km/h`} />
        <SummaryCard label="Min corner" value={`${result.minCornerKph.toFixed(1)} km/h`} />
      </div>

      {/* Setup optimiser */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {result.segments.map((seg, i) => (
          <SegmentRow key={i} seg={seg} totalTime={result.totalTimeSec} />
        ))}
      </div>

      <div style={{ fontSize: 9, color: 'var(--text-dim)', lineHeight: 1.5, marginTop: 4 }}>
        Point-mass model — no gear shifts, no tyre temp, no slip angle limits on straights.<br />
        Accuracy improves with Stage 3–6 parameters tuned to the actual vehicle.
      </div>
    </div>
  );
}

// ── Track map SVG ─────────────────────────────────────────────────────────────

interface TrackPathResult { d: string; viewBox: string }

function buildTrackPath(layout: TrackLayout): TrackPathResult {
  // Walk the track: straight = forward, corner = arc.
  // heading 0 = +x direction. SVG y increases downward.
  // direction 'left'  → heading increases (sweep-flag=1 in SVG)
  // direction 'right' → heading decreases (sweep-flag=0 in SVG)
  const SCALE = 0.4;   // pixels per metre
  const PAD   = 20;    // viewBox padding (px)
  let x = 0, y = 0, heading = 0;
  const pts: string[] = ['M 0 0'];
  const allX: number[] = [0];
  const allY: number[] = [0];

  for (const seg of layout.segments) {
    if (seg.type === 'straight') {
      const dx = Math.cos(heading) * seg.length * SCALE;
      const dy = Math.sin(heading) * seg.length * SCALE;
      x += dx; y += dy;
      pts.push(`l ${dx.toFixed(1)} ${dy.toFixed(1)}`);
      allX.push(x); allY.push(y);

    } else if (seg.type === 'corner' && seg.radius) {
      // SVG y-down convention: right turn = clockwise = heading increases
      // turn: +1 for right (clockwise), -1 for left (counterclockwise)
      const turn  = seg.direction === 'right' ? 1 : -1;
      const sweep = seg.length / seg.radius;   // radians
      const R     = seg.radius * SCALE;

      // Arc centre: perpendicular right (+π/2) or left (-π/2) of current heading
      const perpAngle = heading + turn * Math.PI / 2;
      const cx = x + Math.cos(perpAngle) * R;
      const cy = y + Math.sin(perpAngle) * R;

      const newHeading = heading + turn * sweep;

      // End point: from centre, opposite of new perpendicular direction
      const nx = cx - Math.cos(newHeading + turn * Math.PI / 2) * R;
      const ny = cy - Math.sin(newHeading + turn * Math.PI / 2) * R;

      // Sample arc points for accurate bounding box
      const steps = Math.max(4, Math.ceil(sweep / (Math.PI / 8)));
      for (let s = 1; s <= steps; s++) {
        const a  = heading + turn * sweep * (s / steps);
        const px = cx - Math.cos(a + turn * Math.PI / 2) * R;
        const py = cy - Math.sin(a + turn * Math.PI / 2) * R;
        allX.push(px); allY.push(py);
      }

      const largeArc  = sweep > Math.PI ? 1 : 0;
      // sweep-flag=1 → clockwise in SVG (right turn); 0 → counterclockwise (left turn)
      const sweepFlag = turn === 1 ? 1 : 0;
      pts.push(`A ${R.toFixed(1)} ${R.toFixed(1)} 0 ${largeArc} ${sweepFlag} ${nx.toFixed(1)} ${ny.toFixed(1)}`);
      x = nx; y = ny;
      heading = newHeading;
    }
  }
  // No 'Z' — let the path end naturally; circuits that close will visually close,
  // those that don't (Monaco, Suzuka) won't show a false diagonal closure line.

  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  const vbW  = maxX - minX + 2 * PAD;
  const vbH  = maxY - minY + 2 * PAD;

  return {
    d:       pts.join(' '),
    viewBox: `${(minX - PAD).toFixed(1)} ${(minY - PAD).toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`,
  };
}

// ── Animated dot state ─────────────────────────────────────────────────────────

/** Total playback duration for one animated lap (ms). Fixed 5s for UX. */
const PLAYBACK_MS = 5000;

interface TrackMapSVGProps {
  layout: TrackLayout;
  result: import('../physics/laptime').LapResult;
}

function TrackMapSVG({ layout, result }: TrackMapSVGProps) {
  // Determine path data and viewBox — prefer hardcoded svgPath for real circuits
  const { d, viewBox } = useMemo(() => {
    if (layout.svgPath && layout.svgViewBox) {
      return { d: layout.svgPath, viewBox: layout.svgViewBox };
    }
    return buildTrackPath(layout);
  }, [layout]);

  // Scale S/F marker to viewBox
  const [vbX, vbY, vbW, vbH] = viewBox.split(' ').map(Number);
  const u = Math.min(vbW, vbH) * 0.06;

  // The S/F point is the start of the SVG path — extract from first M command
  const sfMatch = d.match(/M\s*([\d.+-]+)\s+([\d.+-]+)/);
  const sfX = sfMatch ? parseFloat(sfMatch[1]) : vbX;
  const sfY = sfMatch ? parseFloat(sfMatch[2]) : vbY;

  // Build a cumulative time fraction table: maps [0..1] path-fraction → time-fraction
  // This drives the dot to go faster on straights and slower at corners.
  const timeFractions = useMemo(() => {
    const total = result.totalTimeSec;
    const segs = result.segments;
    // Build array of { pathFrac, timeFrac } pairs at each segment boundary
    let cumLen = 0;
    let cumTime = 0;
    const totalLen = result.totalLengthM;
    const pts: Array<{ pathFrac: number; timeFrac: number }> = [{ pathFrac: 0, timeFrac: 0 }];
    for (const seg of segs) {
      cumLen  += seg.length;
      cumTime += seg.timeSec;
      pts.push({
        pathFrac: cumLen  / totalLen,
        timeFrac: cumTime / total,
      });
    }
    return pts;
  }, [result]);

  // Animation state
  const [playing, setPlaying] = useState(false);
  const [dotPos, setDotPos]   = useState<{ x: number; y: number } | null>(null);
  const pathRef   = useRef<SVGPathElement | null>(null);
  const rafRef    = useRef<number | null>(null);
  const startRef  = useRef<number | null>(null);

  /** Map a time-fraction [0..1] → path-fraction [0..1] by inverting the timeFractions table. */
  const timeFracToPathFrac = useCallback((tf: number): number => {
    const pts = timeFractions;
    // Linear search — table is small (~20 entries)
    for (let i = 1; i < pts.length; i++) {
      if (tf <= pts[i].timeFrac) {
        const span = pts[i].timeFrac - pts[i - 1].timeFrac;
        const t    = span > 0 ? (tf - pts[i - 1].timeFrac) / span : 0;
        return pts[i - 1].pathFrac + t * (pts[i].pathFrac - pts[i - 1].pathFrac);
      }
    }
    return 1;
  }, [timeFractions]);

  const stopAnimation = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    setPlaying(false);
    setDotPos(null);
  }, []);

  const tick = useCallback((timestamp: number) => {
    if (!pathRef.current) return;
    if (startRef.current === null) startRef.current = timestamp;

    const elapsed   = timestamp - startRef.current;
    const timeFrac  = (elapsed % PLAYBACK_MS) / PLAYBACK_MS;  // loops
    const pathFrac  = timeFracToPathFrac(timeFrac);
    const totalLen  = pathRef.current.getTotalLength();
    const pt        = pathRef.current.getPointAtLength(pathFrac * totalLen);
    setDotPos({ x: pt.x, y: pt.y });

    rafRef.current = requestAnimationFrame(tick);
  }, [timeFracToPathFrac]);

  const startAnimation = useCallback(() => {
    setPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  // Clean up on unmount or layout change
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Stop animation when layout changes (different circuit selected)
  useEffect(() => {
    stopAnimation();
  }, [layout, stopAnimation]);

  const handlePlayStop = () => {
    if (playing) {
      stopAnimation();
    } else {
      startAnimation();
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={viewBox}
        width="100%"
        style={{ maxHeight: 220, display: 'block' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Game-style track map: thick outer stroke (kerb/edge) + thinner inner stroke (road surface) */}
        <path
          ref={pathRef}
          d={d}
          fill="none"
          stroke="var(--border)"
          strokeWidth="10"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={d}
          fill="none"
          stroke="var(--text-primary)"
          strokeWidth="5"
          vectorEffect="non-scaling-stroke"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {/* S/F marker — red dot + white bar (start/finish line style) */}
        <circle cx={sfX} cy={sfY} r={u * 0.7} fill="#ef4444" />
        <line
          x1={sfX + u} y1={sfY - u * 0.8}
          x2={sfX + u} y2={sfY + u * 0.8}
          stroke="white" strokeWidth={u * 0.25}
          strokeLinecap="round" vectorEffect="non-scaling-stroke"
        />
        {/* Animated lap position dot */}
        {dotPos && (
          <circle
            cx={dotPos.x}
            cy={dotPos.y}
            r={u * 0.8}
            fill="#ef4444"
            stroke="white"
            strokeWidth={u * 0.2}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      {/* Play/Stop button overlaid bottom-right of the map */}
      <button
        onClick={handlePlayStop}
        title={playing ? 'Stop lap animation' : 'Animate lap position (5s playback)'}
        style={{
          position: 'absolute', bottom: 4, right: 4,
          padding: '3px 9px', fontSize: 10, fontWeight: 600,
          background: playing ? 'var(--bg-active)' : 'var(--bg-card)',
          border: `1px solid ${playing ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 5,
          color: playing ? 'var(--accent-text)' : 'var(--text-secondary)',
          cursor: 'pointer', lineHeight: 1.4,
        }}
      >
        {playing ? '■ Stop' : '▶ Play'}
      </button>
    </div>
  );
}

function OptimResultCard({
  result, baseParams, onApply,
}: {
  result:     OptimiseResult;
  baseParams: VehicleParams;
  onApply:    (r: OptimiseResult) => void;
}) {
  const improved = result.improvement > 0.05;
  return (
    <div style={{
      background: improved ? 'var(--bg-active)' : 'var(--bg-card)',
      border: `1px solid ${improved ? 'var(--accent)' : 'var(--border-subtle)'}`,
      borderRadius: 8, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {/* Header */}
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
        </span>
        <span style={{ fontSize: 9, color: 'var(--text-dim)', marginLeft: 'auto' }}>
          {result.iterations} iterations
        </span>
        {improved && (
          <button
            onClick={() => onApply(result)}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: 600,
              background: 'var(--accent)', border: 'none',
              borderRadius: 5, color: 'var(--accent-text)', cursor: 'pointer',
            }}
          >
            Apply
          </button>
        )}
      </div>
      {/* Parameter diff table */}
      {improved && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '2px 12px' }}>
          {OPTIMISABLE_KEYS.map(key => {
            const wasVal  = baseParams[key] as number;
            const nowVal  = result.bestParams[key] as number;
            const changed = Math.abs(nowVal - wasVal) > Math.abs(wasVal) * 0.005;
            return (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6, fontSize: 10 }}>
                <span style={{ color: 'var(--text-secondary)', fontWeight: changed ? 600 : 400 }}>
                  {OPTIM_LABELS[key]}
                </span>
                <span style={{ fontVariantNumeric: 'tabular-nums', color: changed ? 'var(--accent-text)' : 'var(--text-muted)' }}>
                  {fmtParamValue(key, nowVal)}
                  {changed && (
                    <span style={{ color: 'var(--text-dim)', fontSize: 9 }}>
                      {' '}(was {fmtParamValue(key, wasVal)})
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

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

function SegmentRow({ seg, totalTime }: { seg: import('../physics/laptime').SegmentResult; totalTime: number }) {
  const isCorner = seg.type === 'corner';
  const pct      = (seg.timeSec / totalTime) * 100;
  const color    = isCorner ? '#f87171' : '#60a5fa';

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '90px 48px 80px 1fr 48px',
      alignItems: 'center', gap: 6, fontSize: 10,
    }}>
      <span style={{ color: 'var(--text-secondary)', fontWeight: isCorner ? 600 : 400 }}>
        {seg.label}
      </span>
      <span style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {fmtTime(seg.timeSec)}
      </span>
      <span style={{ color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', fontSize: 9 }}>
        {isCorner
          ? `${seg.minSpeedKph.toFixed(0)} km/h`
          : `${seg.minSpeedKph.toFixed(0)}→${seg.maxSpeedKph.toFixed(0)} km/h`}
      </span>
      {/* time share bar */}
      <div style={{ height: 3, background: 'var(--border-subtle)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color: 'var(--text-faint)', fontSize: 9, textAlign: 'right' }}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}
