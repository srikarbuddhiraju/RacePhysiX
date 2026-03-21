/**
 * TrackVisualiser — race-engineer standard circuit map with zone overlay and live telemetry.
 *
 * Architecture:
 *   buildLapTrace()  → high-res physics trace (distM, timeSec, speedKph, longG, latG, zone)
 *   Zone overlay     → 400 SVG segments coloured by zone (replaces heatmap)
 *   Animation        → binary-search trace by timeSec → smooth position, no linear interp
 *   Telemetry strip  → speed | gear | rpm | long-G | lat-G | zone (data-first, monospaced)
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { buildLapTrace } from '../physics/laptime';
import type { TrackLayout, LapResult, RaceResult, LapSimInput, TracePoint } from '../physics/laptime';
import type { VehicleParams } from '../physics/types';

// ── Zone colours ──────────────────────────────────────────────────────────────

const ZONE_COLORS: Record<TracePoint['zone'], string> = {
  'braking':       '#ff2020',
  'trail-braking': '#ff8000',
  'cornering':     '#f5c000',
  'full-throttle': '#00c8f0',
};

const ZONE_LABELS: Record<TracePoint['zone'], string> = {
  'braking':       'BRAKING',
  'trail-braking': 'TRAIL',
  'cornering':     'CORNERING',
  'full-throttle': 'FULL THROTTLE',
};

const ZONE_ENTRIES = Object.entries(ZONE_COLORS) as [TracePoint['zone'], string][];

// ── Theme ─────────────────────────────────────────────────────────────────────

const C = {
  bg:      '#07070f',
  panel:   '#0a0a16',
  border:  '#181828',
  text:    '#b8b8d0',
  dim:     '#38385a',
  accent:  '#4466ff',
};

// ── Track path builder (schematic circuits) ───────────────────────────────────

function buildTrackPath(layout: TrackLayout): { d: string; viewBox: string } {
  const SCALE = 0.4;
  const PAD   = 20;
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
      const turn  = seg.direction === 'right' ? 1 : -1;
      const sweep = seg.length / seg.radius;
      const R     = seg.radius * SCALE;
      const perpAngle  = heading + turn * Math.PI / 2;
      const cx = x + Math.cos(perpAngle) * R;
      const cy = y + Math.sin(perpAngle) * R;
      const newHeading = heading + turn * sweep;
      const nx = cx - Math.cos(newHeading + turn * Math.PI / 2) * R;
      const ny = cy - Math.sin(newHeading + turn * Math.PI / 2) * R;
      const steps = Math.max(4, Math.ceil(sweep / (Math.PI / 8)));
      for (let s = 1; s <= steps; s++) {
        const a  = heading + turn * sweep * (s / steps);
        const px = cx - Math.cos(a + turn * Math.PI / 2) * R;
        const py = cy - Math.sin(a + turn * Math.PI / 2) * R;
        allX.push(px); allY.push(py);
      }
      const largeArc  = sweep > Math.PI ? 1 : 0;
      const sweepFlag = turn === 1 ? 1 : 0;
      pts.push(`A ${R.toFixed(1)} ${R.toFixed(1)} 0 ${largeArc} ${sweepFlag} ${nx.toFixed(1)} ${ny.toFixed(1)}`);
      x = nx; y = ny;
      heading = newHeading;
    }
  }

  const minX = Math.min(...allX);
  const minY = Math.min(...allY);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  const vbW  = maxX - minX + 2 * PAD;
  const vbH  = maxY - minY + 2 * PAD;
  return {
    d:       pts.join(' ') + ' Z',
    viewBox: `${(minX - PAD).toFixed(1)} ${(minY - PAD).toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`,
  };
}

// ── Trace lookup ──────────────────────────────────────────────────────────────

/** Interpolated trace state at a given cumulative time. */
function traceAtTime(timeSec: number, trace: TracePoint[]): TracePoint {
  let lo = 0, hi = trace.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (trace[mid].timeSec <= timeSec) lo = mid; else hi = mid;
  }
  if (lo >= hi) return trace[hi];
  const span = trace[hi].timeSec - trace[lo].timeSec;
  if (span <= 0) return trace[lo];
  const t = (timeSec - trace[lo].timeSec) / span;
  return {
    distM:    trace[lo].distM    + t * (trace[hi].distM    - trace[lo].distM),
    timeSec:  timeSec,
    speedKph: trace[lo].speedKph + t * (trace[hi].speedKph - trace[lo].speedKph),
    longG:    trace[lo].longG    + t * (trace[hi].longG    - trace[lo].longG),
    latG:     trace[lo].latG     + t * (trace[hi].latG     - trace[lo].latG),
    zone:     trace[lo].zone,
  };
}

/** Nearest trace point by cumulative distance (for static zone overlay). */
function traceAtDist(distM: number, trace: TracePoint[]): TracePoint {
  let lo = 0, hi = trace.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (trace[mid].distM <= distM) lo = mid; else hi = mid;
  }
  return trace[lo];
}

// ── Gear / RPM ────────────────────────────────────────────────────────────────

function computeGearRPM(speedKph: number, params: VehicleParams, prevGear = 1): { gear: number; rpm: number } {
  const speedMs = speedKph / 3.6;
  if (speedMs < 0.5) return { gear: 1, rpm: params.enginePeakRpm * 0.2 };
  const wheelRpm = (speedMs / params.wheelRadiusM) / (2 * Math.PI) * 60;
  const n    = params.gearCount;
  const step = Math.pow(params.topGearRatio / params.firstGearRatio, 1 / (n - 1));
  // Hysteresis: stay in prevGear if RPM is in the comfortable band
  if (prevGear >= 1 && prevGear <= n) {
    const prevRatio = params.firstGearRatio * Math.pow(step, prevGear - 1);
    const prevRpm   = wheelRpm * prevRatio * params.finalDriveRatio;
    if (prevRpm >= params.enginePeakRpm * 0.65 && prevRpm <= params.engineRedlineRpm * 0.95) {
      return { gear: prevGear, rpm: prevRpm };
    }
  }
  for (let g = 1; g <= n; g++) {
    const ratio = params.firstGearRatio * Math.pow(step, g - 1);
    const rpm   = wheelRpm * ratio * params.finalDriveRatio;
    if (rpm <= params.engineRedlineRpm * 0.92) return { gear: g, rpm: Math.max(rpm, params.enginePeakRpm * 0.15) };
  }
  const topRatio = params.firstGearRatio * Math.pow(step, n - 1);
  return { gear: n, rpm: wheelRpm * topRatio * params.finalDriveRatio };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Centre-anchored horizontal bar: negative fills left (red), positive fills right (green). */
function GBar({ value, range, negColor, posColor }: {
  value: number; range: number; negColor: string; posColor: string;
}) {
  const clamped = Math.max(-range, Math.min(range, value));
  const isNeg   = clamped < 0;
  const pct     = Math.abs(clamped) / range * 50;
  return (
    <div style={{ width: '88%', height: 3, background: C.border, borderRadius: 2, position: 'relative', marginTop: 4 }}>
      <div style={{
        position: 'absolute', top: 0, height: '100%',
        left: isNeg ? `${50 - pct}%` : '50%',
        width: `${pct}%`,
        background: isNeg ? negColor : posColor,
        borderRadius: 2,
      }} />
      {/* Centre tick */}
      <div style={{ position: 'absolute', top: -2, left: '50%', width: 1, height: 7, background: C.dim }} />
    </div>
  );
}

/** Linear bar 0→1, with colour zones (green/yellow/red). */
function RpmBar({ frac }: { frac: number }) {
  const color = frac > 0.9 ? '#ff3030' : frac > 0.75 ? '#ffcc00' : '#22cc55';
  return (
    <div style={{ width: '88%', height: 3, background: C.border, borderRadius: 2, marginTop: 4 }}>
      <div style={{ width: `${Math.min(1, frac) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
    </div>
  );
}

// ── Zone segment ──────────────────────────────────────────────────────────────

interface ZoneSeg { x1: number; y1: number; x2: number; y2: number; color: string }

// ── GPS zone overlay ──────────────────────────────────────────────────────────
/**
 * Compute zone overlay for GPS circuits by deriving physics directly from the
 * SVG path curvature. This guarantees zones appear at the correct GPS positions
 * rather than being approximated by a distance-fraction mapping.
 *
 * Algorithm:
 *   1. Sample N+1 evenly-spaced points on the SVG path.
 *   2. Compute Menger curvature at each point (3-point formula) + smooth.
 *   3. V_max[i] = sqrt(μ · g · R_real[i]) — cornering speed from curvature.
 *   4. Forward + backward Euler passes (4 iterations) → minimum-time speed profile.
 *   5. Classify zone at each sample: cornering / braking / trail / full-throttle.
 */
function buildGpsZoneOverlay(
  pathEl: SVGPathElement,
  layout: TrackLayout,
  inp:    LapSimInput,
  N = 2000,
): ZoneSeg[] {
  const G_C     = 9.81;
  const pathLen = pathEl.getTotalLength();
  const totalDist = layout.segments.reduce((sum, s) => sum + s.length, 0);
  if (pathLen < 1 || totalDist < 1) return [];

  const svgToMeter = totalDist / pathLen;   // meters per SVG unit
  const dsReal     = totalDist / N;         // meters per step
  const vTop       = inp.maxVehicleSpeedMs ?? 80;

  // 1. Sample points
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const p = pathEl.getPointAtLength((i / N) * pathLen);
    pts.push({ x: p.x, y: p.y });
  }

  // 2. Menger curvature (raw)
  const rawK = new Float64Array(N + 1);
  for (let i = 1; i < N; i++) {
    const ax = pts[i].x - pts[i-1].x, ay = pts[i].y - pts[i-1].y;
    const bx = pts[i+1].x - pts[i].x, by = pts[i+1].y - pts[i].y;
    const cx = pts[i+1].x - pts[i-1].x, cy = pts[i+1].y - pts[i-1].y;
    const cross = Math.abs(ax * by - ay * bx);
    const denom = Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(cx, cy);
    rawK[i] = denom > 1e-12 ? (2 * cross) / denom : 0;
  }
  rawK[0] = rawK[1]; rawK[N] = rawK[N - 1];

  // 3-point smooth (reduces GPS noise without blurring short chicanes)
  const kappa = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const im1 = Math.max(0, i - 1);
    const ip1 = Math.min(N, i + 1);
    kappa[i] = (rawK[im1] + 2 * rawK[i] + rawK[ip1]) / 4;
  }

  // 3. V_max from curvature
  const vMax = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const kappaReal = kappa[i] / svgToMeter;            // 1/m
    const R         = kappaReal > 1e-6 ? 1 / kappaReal : 1e6;
    vMax[i] = Math.min(vTop, Math.sqrt(inp.peakMu * G_C * R));
  }

  // 4. Speed profile — 4 forward/backward Euler passes
  const V      = Float64Array.from(vMax);
  const aBrake = inp.brakingCapG * G_C;

  for (let iter = 0; iter < 4; iter++) {
    // Forward pass: max acceleration
    for (let i = 0; i < N; i++) {
      const Fd   = Math.max(0, inp.driveForce(V[i]) - inp.dragForce(V[i]));
      const vNxt = Math.sqrt(Math.max(0, V[i] * V[i] + 2 * (Fd / inp.mass) * dsReal));
      V[i + 1]   = Math.min(vNxt, vMax[i + 1]);
    }
    // Backward pass: max braking
    for (let i = N; i > 0; i--) {
      const vPrv = Math.sqrt(Math.max(0, V[i] * V[i] + 2 * aBrake * dsReal));
      V[i - 1]   = Math.min(vPrv, vMax[i - 1]);
    }
  }

  // 5. Zone classification + segment output
  const segs: ZoneSeg[] = [];
  for (let i = 0; i < N; i++) {
    const isLimited = vMax[i] < vTop - 2;
    const atLimit   = V[i] >= vMax[i] - 1.5;
    // decelG > 0 = decelerating, < 0 = accelerating
    const decelG = (V[i] * V[i] - V[i + 1] * V[i + 1]) / (2 * dsReal * G_C);
    let zone: TracePoint['zone'];
    if (isLimited && atLimit) {
      zone = 'cornering';
    } else if (decelG > 0.3) {
      zone = 'braking';
    } else if (decelG > 0.05) {
      zone = 'trail-braking';
    } else {
      zone = 'full-throttle';
    }
    segs.push({ x1: pts[i].x, y1: pts[i].y, x2: pts[i+1].x, y2: pts[i+1].y, color: ZONE_COLORS[zone] });
  }
  return segs;
}

// ── Telemetry state ───────────────────────────────────────────────────────────

interface TelemetryState {
  speedKph: number;
  gear:     number;
  rpm:      number;
  longG:    number;
  latG:     number;
  zone:     TracePoint['zone'];
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  layout:      TrackLayout;
  result:      LapResult;
  lapSimInput: LapSimInput;
  raceResult:  RaceResult | null;
  triggerRace: number;
  params:      VehicleParams;
  onClose:     () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrackVisualiser({ layout, result, lapSimInput, raceResult, triggerRace, params, onClose }: Props) {
  const [playing,    setPlaying]    = useState(true);
  const [dotPos,     setDotPos]     = useState<{ x: number; y: number } | null>(null);
  const [dotHeading, setDotHeading] = useState(0);
  const [zoneOverlay, setZoneOverlay] = useState<ZoneSeg[]>([]);
  const [raceLabel,  setRaceLabel]  = useState<string | null>(null);
  const [telemetry,  setTelemetry]  = useState<TelemetryState | null>(null);

  // Refs used inside RAF
  const pathRef        = useRef<SVGPathElement | null>(null);
  const rafRef         = useRef<number | null>(null);
  const startRef       = useRef<number | null>(null);
  const lapStartRef    = useRef<number | null>(null);
  const raceAnimRef    = useRef<{ isRacing: boolean; lapIdx: number } | null>(null);
  const raceResultRef  = useRef(raceResult);
  const traceRef       = useRef<TracePoint[]>([]);
  const prevGearRef    = useRef(1);

  useEffect(() => { raceResultRef.current = raceResult; }, [raceResult]);

  // Build trace from physics
  const trace = useMemo(() => buildLapTrace(layout, lapSimInput), [layout, lapSimInput]);
  useEffect(() => { traceRef.current = trace; }, [trace]);

  // SVG path
  const { d: trackD, viewBox } = useMemo(() => {
    if (layout.svgPath && layout.svgViewBox) return { d: layout.svgPath, viewBox: layout.svgViewBox };
    return buildTrackPath(layout);
  }, [layout]);

  // Zone overlay:
  //   GPS circuits  → curvature-based physics on the actual GPS path (exact positions)
  //   Schematic     → segment-proportional buildTrackPath + trace lookup (exact)
  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl) return;
    if (layout.svgPath) {
      setZoneOverlay(buildGpsZoneOverlay(pathEl, layout, lapSimInput));
    } else {
      if (trace.length < 2) return;
      const N       = 400;
      const pathLen = pathEl.getTotalLength();
      const totalDist = trace[trace.length - 1].distM;
      const ptArr   = Array.from({ length: N + 1 }, (_, i) => {
        const pt = pathEl.getPointAtLength((i / N) * pathLen);
        return { x: pt.x, y: pt.y };
      });
      const segs: ZoneSeg[] = ptArr.slice(1).map((p, i) => {
        const distM = ((i + 0.5) / N) * totalDist;
        const tp    = traceAtDist(distM, trace);
        return { x1: ptArr[i].x, y1: ptArr[i].y, x2: p.x, y2: p.y, color: ZONE_COLORS[tp.zone] };
      });
      setZoneOverlay(segs);
    }
  }, [layout, trace, lapSimInput]);

  // Race trigger
  useEffect(() => {
    if (triggerRace === 0 || !raceResult || raceResult.laps.length === 0) return;
    raceAnimRef.current = { isRacing: true, lapIdx: 0 };
    lapStartRef.current = null;
    startRef.current    = null;
    setRaceLabel(`Lap 1 / ${raceResult.laps.length}`);
  }, [triggerRace]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset animation on layout/trace change
  useEffect(() => { startRef.current = null; prevGearRef.current = 1; }, [layout, trace]);

  // Playback speed: 8× real-time so a 2-min lap takes ~15s to watch
  const PLAYBACK_SPEED = 8;

  // Core RAF tick
  const tick = useCallback((timestamp: number) => {
    if (!playing) { rafRef.current = requestAnimationFrame(tick); return; }
    const pathEl = pathRef.current;
    const tr = traceRef.current;
    if (!pathEl || tr.length < 2) { rafRef.current = requestAnimationFrame(tick); return; }
    if (startRef.current === null) startRef.current = timestamp;

    const traceTotalTime = tr[tr.length - 1].timeSec;
    const traceTotalDist = tr[tr.length - 1].distM;
    let timeSec_cur: number;

    const raceAnim = raceAnimRef.current;
    const raceRes  = raceResultRef.current;

    if (raceAnim?.isRacing && raceRes && raceRes.laps.length > 0) {
      if (lapStartRef.current === null) lapStartRef.current = timestamp;
      const lapData     = raceRes.laps[raceAnim.lapIdx];
      const lapMs       = lapData.lapTimeSec * 1000;
      const elapsed     = (timestamp - lapStartRef.current) * PLAYBACK_SPEED;
      const t           = Math.min(elapsed / lapMs, 1);
      timeSec_cur       = t * traceTotalTime;
      if (elapsed >= lapMs) {
        const nextIdx = raceAnim.lapIdx + 1;
        if (nextIdx >= raceRes.laps.length) {
          raceAnimRef.current = null;
          setRaceLabel(null);
        } else {
          raceAnimRef.current = { isRacing: true, lapIdx: nextIdx };
          lapStartRef.current = timestamp;
          setRaceLabel(`Lap ${nextIdx + 1} / ${raceRes.laps.length}`);
        }
      }
    } else {
      const elapsed = (timestamp - startRef.current) * PLAYBACK_SPEED;
      timeSec_cur   = (elapsed % (traceTotalTime * 1000)) / 1000;
    }

    const tp       = traceAtTime(timeSec_cur, tr);
    const pathFrac = tp.distM / traceTotalDist;
    const pathLen  = pathEl.getTotalLength();
    const sampleAt = pathFrac * pathLen;
    const pt       = pathEl.getPointAtLength(sampleAt);

    // Heading — eps clamp prevents snap at lap end
    const eps  = Math.max(0.5, pathLen * 0.003);
    const ptA  = pathEl.getPointAtLength(Math.max(eps, Math.min(sampleAt - eps, pathLen - 2 * eps)));
    const ptB  = pathEl.getPointAtLength(Math.min(pathLen - eps, Math.max(sampleAt + eps, 2 * eps)));
    const headingDeg = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180 / Math.PI;

    // Gear / RPM
    const { gear, rpm } = computeGearRPM(tp.speedKph, params, prevGearRef.current);
    prevGearRef.current = gear;

    setDotPos({ x: pt.x, y: pt.y });
    setDotHeading(headingDeg);
    setTelemetry({ speedKph: tp.speedKph, gear, rpm, longG: tp.longG, latG: tp.latG, zone: tp.zone });

    rafRef.current = requestAnimationFrame(tick);
  }, [playing, params]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  // ── Derived telemetry display values ─────────────────────────────────────────
  const redline   = params.engineRedlineRpm;
  const rpmFrac   = telemetry ? Math.min(1, telemetry.rpm / redline) : 0;
  const zoneColor = telemetry ? ZONE_COLORS[telemetry.zone] : C.dim;

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, fontFamily: 'system-ui, sans-serif', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '0 14px', height: 36, flexShrink: 0,
        background: C.panel, borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.dim,
          fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
        }}>×</button>
        <span style={{ fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em', color: C.dim, textTransform: 'uppercase' }}>
          {layout.name}
        </span>
        {layout.svgPath && (
          <span style={{ fontSize: 8, color: C.dim, letterSpacing: '0.10em', opacity: 0.6 }}>
            GPS © TUMFTM · LGPL-3.0
          </span>
        )}
        <div style={{ flex: 1 }} />
        {raceLabel && (
          <span style={{ fontSize: 10, color: C.accent, letterSpacing: '0.12em' }}>{raceLabel}</span>
        )}
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.text, letterSpacing: '0.08em' }}>
          {formatTime(result.totalTimeSec)}
        </span>
        <button onClick={() => setPlaying(p => !p)} style={{
          background: 'none', border: `1px solid ${C.border}`, color: C.text,
          fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: 3,
          letterSpacing: '0.1em',
        }}>
          {playing ? '⏸' : '▶'}
        </button>
      </div>

      {/* ── Circuit map ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}>
        <svg
          viewBox={viewBox}
          style={{ width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Hidden measurement path — Z stripped so getTotalLength() excludes closing segment */}
          <path ref={pathRef} d={trackD.replace(/\s*Z\s*$/i, '')} fill="none" stroke="none" />

          {/* Track shadow */}
          <path d={trackD} fill="none" stroke="#02020a" strokeWidth={22}
            strokeLinecap="round" strokeLinejoin="round" />
          {/* Track asphalt */}
          <path d={trackD} fill="none" stroke="#141420" strokeWidth={16}
            strokeLinecap="round" strokeLinejoin="round" />
          {/* Track edge */}
          <path d={trackD} fill="none" stroke="#1e1e30" strokeWidth={12}
            strokeLinecap="round" strokeLinejoin="round" />

          {/* Zone overlay */}
          {zoneOverlay.map((seg, i) => (
            <line key={i}
              x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
              stroke={seg.color} strokeWidth={3} strokeLinecap="round" opacity={0.88}
            />
          ))}

          {/* Centre line dashes */}
          <path d={trackD} fill="none" stroke="rgba(255,255,255,0.05)"
            strokeWidth={1} strokeDasharray="4 10" />

          {/* Car arrow */}
          {dotPos && (
            <g transform={`translate(${dotPos.x},${dotPos.y}) rotate(${dotHeading})`}>
              <circle r={11} fill={`${zoneColor}35`} />
              <polygon points="0,-8 -4.5,5.5 4.5,5.5"
                fill="#ffffff" stroke={zoneColor} strokeWidth={1.5} />
            </g>
          )}
        </svg>

        {/* Zone legend — bottom-left of map */}
        <div style={{
          position: 'absolute', bottom: 8, left: 10,
          display: 'flex', gap: 10, flexWrap: 'wrap',
        }}>
          {ZONE_ENTRIES.map(([zone, color]) => (
            <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, background: color, borderRadius: 1 }} />
              <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.1em' }}>
                {ZONE_LABELS[zone]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Telemetry strip ── */}
      <div style={{
        display: 'flex', flexShrink: 0, height: 82,
        background: C.panel, borderTop: `1px solid ${C.border}`,
      }}>

        {/* Speed */}
        <TCell flex={1.2}>
          <TValue size={30} color={C.text}>
            {telemetry ? Math.round(telemetry.speedKph) : '---'}
          </TValue>
          <TLabel>KM/H</TLabel>
        </TCell>

        <TDivider />

        {/* Gear */}
        <TCell flex={0.7}>
          <TValue size={42} color="#ffffff" weight={700}>
            {telemetry ? telemetry.gear : '-'}
          </TValue>
          <TLabel>GEAR</TLabel>
        </TCell>

        <TDivider />

        {/* RPM */}
        <TCell flex={1.6}>
          <TValue size={22} color={rpmFrac > 0.9 ? '#ff3030' : rpmFrac > 0.75 ? '#ffcc00' : C.text}>
            {telemetry ? Math.round(telemetry.rpm) : '----'}
          </TValue>
          <RpmBar frac={rpmFrac} />
          <TLabel>{redline.toFixed(0)} REDLINE</TLabel>
        </TCell>

        <TDivider />

        {/* Long G */}
        <TCell flex={1.6}>
          <TValue size={20} color={telemetry && telemetry.longG < -0.1 ? '#ff4040' : telemetry && telemetry.longG > 0.1 ? '#22cc55' : C.text}>
            {telemetry
              ? (telemetry.longG >= 0 ? '+' : '') + telemetry.longG.toFixed(2) + 'g'
              : '+0.00g'
            }
          </TValue>
          <GBar value={telemetry?.longG ?? 0} range={2} negColor="#ff2020" posColor="#22cc55" />
          <TLabel>LONG G</TLabel>
        </TCell>

        <TDivider />

        {/* Lat G */}
        <TCell flex={1.6}>
          <TValue size={20} color={C.text}>
            {telemetry ? telemetry.latG.toFixed(2) + 'g' : '0.00g'}
          </TValue>
          <GBar value={telemetry?.latG ?? 0} range={2} negColor="#a040ff" posColor="#a040ff" />
          <TLabel>LAT G</TLabel>
        </TCell>

        <TDivider />

        {/* Zone */}
        <TCell flex={1.4}>
          <span style={{
            fontFamily: 'monospace', fontSize: 11, fontWeight: 700,
            color: zoneColor, letterSpacing: '0.08em', textAlign: 'center',
          }}>
            {telemetry ? ZONE_LABELS[telemetry.zone] : '───'}
          </span>
          <TLabel>ZONE</TLabel>
        </TCell>

      </div>
    </div>
  );
}

// ── Telemetry cell primitives ─────────────────────────────────────────────────

function TCell({ children, flex }: { children: React.ReactNode; flex: number }) {
  return (
    <div style={{
      flex, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '6px 10px', gap: 2,
    }}>
      {children}
    </div>
  );
}

function TValue({ children, size, color, weight = 400 }: {
  children: React.ReactNode; size: number; color: string; weight?: number;
}) {
  return (
    <span style={{
      fontFamily: 'monospace', fontSize: size, fontWeight: weight,
      color, lineHeight: 1, letterSpacing: '-0.02em',
    }}>
      {children}
    </span>
  );
}

function TLabel({ children }: { children?: React.ReactNode }) {
  return (
    <span style={{ fontSize: 8, color: C.dim, letterSpacing: '0.22em', textTransform: 'uppercase' }}>
      {children}
    </span>
  );
}

function TDivider() {
  return <div style={{ width: 1, height: '60%', background: C.border, flexShrink: 0 }} />;
}
