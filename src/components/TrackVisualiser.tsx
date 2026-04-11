/**
 * TrackVisualiser — race-engineer standard circuit map with zone overlay and live telemetry.
 *
 * Architecture:
 *   buildLapTrace()  → high-res physics trace (distM, timeSec, speedKph, longG, latG, zone, Stage 47 fields)
 *   Zone overlay     → 400 SVG segments coloured by zone
 *   Animation        → binary-search trace by timeSec → smooth position
 *   Telemetry strip  → speed | gear | rpm | throttle | brake | zone
 *   Left panel       → corner temps, sector timing, system icons, tyre wear  (Stage 47 M2)
 *   Right panel      → live G-G diagram + friction circle                    (Stage 47 M3)
 *   View modes       → full circuit / car-centred + minimap / chase camera   (Stage 47 M5)
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { buildLapTrace } from '../physics/laptime';
import type { TrackLayout, LapResult, RaceResult, LapSimInput, TracePoint, BankingProfile } from '../physics/laptime';
import type { VehicleParams } from '../physics/types';
import { computeGearRPM } from '../physics/gearUtils';

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
    distM:          trace[lo].distM    + t * (trace[hi].distM    - trace[lo].distM),
    timeSec,
    speedKph:       trace[lo].speedKph + t * (trace[hi].speedKph - trace[lo].speedKph),
    longG:          trace[lo].longG    + t * (trace[hi].longG    - trace[lo].longG),
    latG:           trace[lo].latG     + t * (trace[hi].latG     - trace[lo].latG),
    zone:           trace[lo].zone,
    throttlePct:    trace[lo].throttlePct  + t * (trace[hi].throttlePct  - trace[lo].throttlePct),
    brakePct:       trace[lo].brakePct     + t * (trace[hi].brakePct     - trace[lo].brakePct),
    tyreTempC:      trace[lo].tyreTempC    + t * (trace[hi].tyreTempC    - trace[lo].tyreTempC),
    brakeDiscTempC: trace[lo].brakeDiscTempC + t * (trace[hi].brakeDiscTempC - trace[lo].brakeDiscTempC),
    sectorIndex:    trace[lo].sectorIndex,
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec - m * 60;
  return `${m}:${s.toFixed(1).padStart(4, '0')}`;
}

/** Temperature → hex colour: cold=blue, optimal=green, hot=red */
function tempColor(t: number, optTemp: number, halfWidth: number): string {
  const delta = t - optTemp;
  if (delta < -halfWidth) return '#2255ee';
  if (delta < 0) {
    const f = (delta + halfWidth) / halfWidth;
    return lerpHex('#2255ee', '#22cc55', f);
  }
  if (delta < halfWidth) {
    const f = delta / halfWidth;
    return lerpHex('#22cc55', '#ff4422', f);
  }
  return '#ff4422';
}

function lerpHex(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16);
  const r = Math.round(ar + t * (br - ar));
  const g = Math.round(ag + t * (bg - ag));
  const bl = Math.round(ab + t * (bb - ab));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Linear bar 0→1 */
function LinearBar({ frac, color }: { frac: number; color: string }) {
  return (
    <div style={{ width: '88%', height: 3, background: C.border, borderRadius: 2, marginTop: 4 }}>
      <div style={{ width: `${Math.min(1, Math.max(0, frac)) * 100}%`, height: '100%', background: color, borderRadius: 2 }} />
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

// ── GPS animation point ────────────────────────────────────────────────────────

interface GpsAnimPoint {
  timeSec:  number;
  pathFrac: number;
  speedKph: number;
  zone:     TracePoint['zone'];
  longG:    number;
  latG:     number;
}

interface GpsZoneResult {
  segs:       ZoneSeg[];
  anim:       GpsAnimPoint[];
  lapTimeSec: number;
}

// ── GPS zone overlay ──────────────────────────────────────────────────────────
/**
 * Derive speed profile and zone classification directly from GPS SVG path curvature.
 */
function buildGpsZoneOverlay(
  pathEl:           SVGPathElement,
  inp:              LapSimInput,
  totalDist:        number,
  bankingProfiles?: BankingProfile[],
): GpsZoneResult {
  const N       = 2000;
  const G       = 9.81;
  const RHO_AIR = 1.225;
  const pathLen = pathEl.getTotalLength();
  const svgToM  = totalDist / pathLen;
  const dsReal  = totalDist / N;

  const kAero = inp.aeroCL > 0
    ? inp.peakMu * 0.5 * RHO_AIR * inp.aeroReferenceArea * inp.aeroCL / inp.mass
    : 0;

  const bankingAt = (f: number): number => {
    if (!bankingProfiles?.length) return 0;
    for (const bp of bankingProfiles) {
      if (f >= bp.pathFracStart && f <= bp.pathFracEnd) return bp.bankingDeg;
    }
    return 0;
  };

  const aBrakeBase = Math.max(inp.brakingCapG, inp.peakMu) * G;

  const raw: { x: number; y: number }[] = [];
  for (let i = 0; i <= N; i++) {
    const pt = pathEl.getPointAtLength((i / N) * pathLen);
    raw.push({ x: pt.x, y: pt.y });
  }

  const W = 2;
  const sm: { x: number; y: number }[] = raw.map((_, i) => {
    let sx = 0, sy = 0;
    for (let k = -W; k <= W; k++) {
      const j = ((i + k) % (N + 1) + (N + 1)) % (N + 1);
      sx += raw[j].x; sy += raw[j].y;
    }
    return { x: sx / (2 * W + 1), y: sy / (2 * W + 1) };
  });

  const kappa: number[] = new Array(N + 1).fill(0);
  for (let i = 1; i < N; i++) {
    const ax = sm[i].x - sm[i-1].x,  ay = sm[i].y - sm[i-1].y;
    const bx = sm[i+1].x - sm[i].x,  by = sm[i+1].y - sm[i].y;
    const cx = sm[i+1].x - sm[i-1].x, cy = sm[i+1].y - sm[i-1].y;
    const cross = Math.abs(ax * by - ay * bx);
    const dAB   = Math.hypot(ax, ay);
    const dBC   = Math.hypot(bx, by);
    const dAC   = Math.hypot(cx, cy);
    kappa[i]    = (dAB < 1e-9 || dBC < 1e-9 || dAC < 1e-9)
      ? 0 : 2 * cross / (dAB * dBC * dAC);
  }
  kappa[0] = kappa[1]; kappa[N] = kappa[N - 1];

  const kS: number[] = [...kappa];
  for (let i = 1; i < N; i++) {
    kS[i] = (kappa[i-1] + 2 * kappa[i] + kappa[i+1]) / 4;
  }

  const vTop = inp.maxVehicleSpeedMs ?? 80;
  const vMax: number[] = new Array(N + 1).fill(vTop);
  for (let i = 0; i <= N; i++) {
    const kReal  = kS[i] / svgToM;
    const R      = kReal > 1e-6 ? 1 / kReal : 2000;
    const Rclamp = Math.min(R, 2000);
    const denom  = 1 - kAero * Rclamp;
    const theta  = bankingAt(i / N) * Math.PI / 180;
    const muEff  = inp.peakMu * Math.cos(theta) + Math.sin(theta);
    vMax[i] = denom > 0.05
      ? Math.min(Math.sqrt(muEff * G * Rclamp / denom), vTop)
      : vTop;
  }

  const fwdBwd = () => {
    for (let i = 0; i < N; i++) {
      const Fd   = inp.driveForce(V[i]) - inp.dragForce(V[i]);
      const aD   = Math.max(0, Fd / inp.mass);
      const vNxt = Math.sqrt(V[i] * V[i] + 2 * aD * dsReal);
      V[i+1] = Math.min(V[i+1], vNxt, vTop);
    }
    for (let i = N; i > 0; i--) {
      const aBrakeV = aBrakeBase + kAero * V[i] * V[i];
      const vEnt    = Math.sqrt(V[i] * V[i] + 2 * aBrakeV * dsReal);
      V[i-1] = Math.min(V[i-1], vEnt);
    }
  };
  const V: number[] = [...vMax];
  for (let iter = 0; iter < 8; iter++) fwdBwd();

  const vBoundary = Math.min(V[0], V[N]);
  V[0] = vBoundary;
  V[N] = vBoundary;
  for (let iter = 0; iter < 4; iter++) fwdBwd();

  const zones:  TracePoint['zone'][] = new Array(N).fill('full-throttle' as TracePoint['zone']);
  const longGs: number[] = new Array(N).fill(0);
  const latGs:  number[] = new Array(N).fill(0);
  for (let i = 0; i < N; i++) {
    const vi   = V[i], vj = V[i + 1];
    const kMid = (kS[i] + kS[i+1]) / 2;
    const kReal = kMid / svgToM;
    const RReal  = kReal > 1e-6 ? 1 / kReal : 2000;
    const vMid   = (vi + vj) / 2;
    const decelG = (vi * vi - vj * vj) / (2 * dsReal * G);
    const atLim  = (vMax[i] + vMax[i+1]) / 2 < vTop - 1.5;

    latGs[i]  = vMid * vMid / (RReal * G);
    longGs[i] = -decelG;

    if (decelG > 0.3)         zones[i] = 'braking';
    else if (decelG > 0.05)   zones[i] = 'trail-braking';
    else if (atLim)           zones[i] = 'cornering';
    else                      zones[i] = 'full-throttle';
  }

  const segs: ZoneSeg[] = raw.slice(1).map((p, i) => ({
    x1: raw[i].x, y1: raw[i].y,
    x2: p.x,      y2: p.y,
    color: ZONE_COLORS[zones[i]],
  }));

  const anim: GpsAnimPoint[] = [];
  let tCum = 0;
  for (let i = 0; i <= N; i++) {
    anim.push({
      timeSec:  tCum,
      pathFrac: i / N,
      speedKph: V[i] * 3.6,
      zone:     i < N ? zones[i] : zones[N - 1],
      longG:    i < N ? longGs[i] : longGs[N - 1],
      latG:     i < N ? latGs[i] : latGs[N - 1],
    });
    if (i < N) {
      const vAvg = (V[i] + V[i + 1]) / 2;
      tCum += dsReal / Math.max(vAvg, 0.1);
    }
  }

  return { segs, anim, lapTimeSec: tCum };
}

// ── GPS animation lookup ───────────────────────────────────────────────────────

function gpsAtTime(timeSec: number, anim: GpsAnimPoint[]): GpsAnimPoint {
  let lo = 0, hi = anim.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (anim[mid].timeSec <= timeSec) lo = mid; else hi = mid;
  }
  if (lo >= hi) return anim[hi];
  const span = anim[hi].timeSec - anim[lo].timeSec;
  if (span <= 0) return anim[lo];
  const t = (timeSec - anim[lo].timeSec) / span;
  return {
    timeSec,
    pathFrac: anim[lo].pathFrac + t * (anim[hi].pathFrac - anim[lo].pathFrac),
    speedKph: anim[lo].speedKph + t * (anim[hi].speedKph - anim[lo].speedKph),
    zone:     anim[lo].zone,
    longG:    anim[lo].longG    + t * (anim[hi].longG    - anim[lo].longG),
    latG:     anim[lo].latG     + t * (anim[hi].latG     - anim[lo].latG),
  };
}

// ── Telemetry state ───────────────────────────────────────────────────────────

interface TelemetryState {
  speedKph:       number;
  gear:           number;
  rpm:            number;
  longG:          number;
  latG:           number;
  zone:           TracePoint['zone'];
  // Stage 47 M2/M3/M4
  throttlePct:    number;
  brakePct:       number;
  tyreTempC:      number;
  brakeDiscTempC: number;
  sectorIndex:    1 | 2 | 3;
}

// ── View mode ─────────────────────────────────────────────────────────────────

type ViewMode = 'full' | 'centred' | 'chase';

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  layout:      TrackLayout;
  result:      LapResult;
  lapSimInput: LapSimInput;
  raceResult:  RaceResult | null;
  triggerRace: number;
  params:      VehicleParams;
  onClose:     () => void;
  circuitKey?: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrackVisualiser({ layout, result, lapSimInput, raceResult, triggerRace, params, onClose, circuitKey = '' }: Props) {
  const [playing,      setPlaying]      = useState(true);
  const [playSpeed,    setPlaySpeed]    = useState(4);
  const [dotPos,       setDotPos]       = useState<{ x: number; y: number } | null>(null);
  const [dotHeading,   setDotHeading]   = useState(0);
  const [zoneOverlay,  setZoneOverlay]  = useState<ZoneSeg[]>([]);
  const [gpsAnim,      setGpsAnim]      = useState<{ anim: GpsAnimPoint[]; lapTimeSec: number } | null>(null);
  const [raceLabel,    setRaceLabel]    = useState<string | null>(null);
  const [telemetry,    setTelemetry]    = useState<TelemetryState | null>(null);
  const [liveTimeSec,  setLiveTimeSec]  = useState(0);
  // Stage 47 UI state
  const [leftOpen,     setLeftOpen]     = useState(true);
  const [rightOpen,    setRightOpen]    = useState(true);
  const [bottomOpen,   setBottomOpen]   = useState(true);
  const [ggMode,       setGgMode]       = useState<'full' | 'live'>('full');
  const [ggSnapshot,   setGgSnapshot]   = useState<{ x: number; y: number }[]>([]);
  const [viewMode,     setViewMode]     = useState<ViewMode>('full');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [liveViewBox,  setLiveViewBox]  = useState<string | null>(null);

  const playSpeedRef    = useRef(4);
  const gpsAnimRef      = useRef<{ anim: GpsAnimPoint[]; lapTimeSec: number } | null>(null);
  const lastRealTimestamp  = useRef<number>(0);
  const lastLiveUpdate     = useRef<number>(0);
  const pathRef            = useRef<SVGPathElement | null>(null);
  const rafRef             = useRef<number | null>(null);
  const startRef           = useRef<number | null>(null);
  const lapStartRef        = useRef<number | null>(null);
  const raceAnimRef        = useRef<{ isRacing: boolean; lapIdx: number } | null>(null);
  const raceResultRef      = useRef(raceResult);
  const traceRef           = useRef<TracePoint[]>([]);
  const prevGearRef        = useRef(1);
  const paramsRef          = useRef(params);
  const containerRef       = useRef<HTMLDivElement>(null);
  // Stage 47: G-G history ref (avoid re-renders in RAF)
  const ggHistRef          = useRef<{ x: number; y: number }[]>([]);
  const lastGgUpdate       = useRef(0);
  const prevLiveTimeGG     = useRef(0);
  // Stage 47: view mode + G-G mode refs for RAF
  const viewModeRef        = useRef<ViewMode>('full');
  const ggModeRef          = useRef<'full' | 'live'>('full');
  const staticVBRef        = useRef<[number, number, number, number]>([0, 0, 100, 100]);

  useEffect(() => { raceResultRef.current   = raceResult; },  [raceResult]);
  useEffect(() => { playSpeedRef.current    = playSpeed;  },  [playSpeed]);
  useEffect(() => { gpsAnimRef.current      = gpsAnim;    },  [gpsAnim]);
  useEffect(() => { paramsRef.current       = params;     },  [params]);
  useEffect(() => { viewModeRef.current     = viewMode;   },  [viewMode]);
  useEffect(() => { ggModeRef.current       = ggMode;     },  [ggMode]);

  // Build trace from physics
  const trace = useMemo(() => buildLapTrace(layout, lapSimInput, circuitKey), [layout, lapSimInput, circuitKey]);
  useEffect(() => { traceRef.current = trace; }, [trace]);

  // SVG path
  const { d: trackD, viewBox } = useMemo(() => {
    if (layout.svgPath && layout.svgViewBox) return { d: layout.svgPath, viewBox: layout.svgViewBox };
    return buildTrackPath(layout);
  }, [layout]);

  // Sync static viewBox for RAF
  useEffect(() => {
    const parts = viewBox.split(' ').map(Number);
    if (parts.length === 4) staticVBRef.current = parts as [number, number, number, number];
  }, [viewBox]);

  // Precompute sector boundary times from trace (Stage 47)
  const sectorTimes = useMemo(() => {
    let s1End = 0, s2End = 0;
    for (const pt of trace) {
      if (pt.sectorIndex >= 2 && s1End === 0) s1End = pt.timeSec;
      if (pt.sectorIndex >= 3 && s2End === 0) s2End = pt.timeSec;
    }
    const total = trace.length > 0 ? trace[trace.length - 1].timeSec : 0;
    if (s1End === 0) s1End = total * 0.333;
    if (s2End === 0) s2End = total * 0.667;
    return { s1: s1End, s2: s2End - s1End, s3: total - s2End, total };
  }, [trace]);

  // Zone overlay + GPS animation
  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl || trace.length < 2) return;
    const totalDist = trace[trace.length - 1].distM;

    if (layout.svgPath && layout.svgIsGps) {
      const result = buildGpsZoneOverlay(pathEl, lapSimInput, totalDist, layout.bankingProfiles);
      const newGpsAnim = { anim: result.anim, lapTimeSec: result.lapTimeSec };
      setZoneOverlay(result.segs);
      setGpsAnim(newGpsAnim);
      gpsAnimRef.current = newGpsAnim;
    } else {
      setGpsAnim(null);
      gpsAnimRef.current = null;
      const N       = 400;
      const pathLen = pathEl.getTotalLength();
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

  // Reset animation on circuit change
  useEffect(() => {
    startRef.current = null;
    prevGearRef.current = 1;
    ggHistRef.current = [];
    setGgSnapshot([]);
  }, [layout]);

  // Fullscreen API listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const cycleViewMode = useCallback(() => {
    setViewMode(m => m === 'full' ? 'centred' : m === 'centred' ? 'chase' : 'full');
  }, []);

  // ── Helper: update G-G history and live viewBox (called in each tick branch) ─

  const updateGGAndViewBox = useCallback((
    latG: number, longG: number,
    liveT: number, timestamp: number,
    ptX: number, ptY: number,
  ) => {
    // G-G history — detect lap reset (time jumped backward > 2s)
    if (liveT < prevLiveTimeGG.current - 2) {
      ggHistRef.current = [];
    }
    prevLiveTimeGG.current = liveT;
    ggHistRef.current.push({ x: latG, y: longG });
    if (ggHistRef.current.length > 3000) ggHistRef.current.shift();

    if (timestamp - lastGgUpdate.current >= 250) {
      lastGgUpdate.current = timestamp;
      const pts = ggModeRef.current === 'live'
        ? ggHistRef.current.slice(-200)
        : [...ggHistRef.current];
      setGgSnapshot(pts);
    }

    // Live viewBox for centred / chase modes
    if (viewModeRef.current !== 'full') {
      const [vX, vY, vW, vH] = staticVBRef.current;
      const zoom  = 0.32;
      const zW    = vW * zoom;
      const zH    = vH * zoom;
      const isChase = viewModeRef.current === 'chase';
      const lx = Math.max(vX, Math.min(vX + vW - zW, ptX - zW / 2));
      const ly = Math.max(vY, Math.min(vY + vH - zH, ptY - (isChase ? zH * 0.70 : zH / 2)));
      setLiveViewBox(`${lx.toFixed(1)} ${ly.toFixed(1)} ${zW.toFixed(1)} ${zH.toFixed(1)}`);
    }
  }, []); // stable — only refs used

  // ── RAF tick ──────────────────────────────────────────────────────────────────

  const tick = useCallback((timestamp: number) => {
    const realDelta = lastRealTimestamp.current > 0 ? timestamp - lastRealTimestamp.current : 0;
    lastRealTimestamp.current = timestamp;
    void realDelta;

    if (!playing) { rafRef.current = requestAnimationFrame(tick); return; }
    const pathEl = pathRef.current;
    const tr = traceRef.current;
    if (!pathEl || tr.length < 2) { rafRef.current = requestAnimationFrame(tick); return; }
    if (startRef.current === null) {
      const gpsA = gpsAnimRef.current;
      const lapMs = gpsA ? gpsA.lapTimeSec * 1000 : tr[tr.length - 1].timeSec * 1000;
      startRef.current = timestamp - Math.random() * lapMs / playSpeedRef.current;
    }
    if (realDelta > 200 && startRef.current !== null) {
      startRef.current += (realDelta - 200);
      if (lapStartRef.current !== null) lapStartRef.current += (realDelta - 200);
    }

    const traceTotalTime = tr[tr.length - 1].timeSec;
    const traceTotalDist = tr[tr.length - 1].distM;
    let timeSec_cur: number;

    const raceAnim = raceAnimRef.current;
    const raceRes  = raceResultRef.current;

    if (raceAnim?.isRacing && raceRes && raceRes.laps.length > 0) {
      if (lapStartRef.current === null) lapStartRef.current = timestamp;
      const lapData = raceRes.laps[raceAnim.lapIdx];
      const lapMs   = lapData.lapTimeSec * 1000;
      const elapsed = (timestamp - lapStartRef.current) * playSpeedRef.current;
      const t       = Math.min(elapsed / lapMs, 1);

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

      const gpsA = gpsAnimRef.current;
      if (gpsA && gpsA.anim.length > 1) {
        const tGps     = t * gpsA.lapTimeSec;
        const gpt      = gpsAtTime(tGps, gpsA.anim);
        const pLen     = pathEl.getTotalLength();
        const sampleAt = gpt.pathFrac * pLen;
        const pt       = pathEl.getPointAtLength(sampleAt);
        const eps      = Math.max(0.5, pLen * 0.003);
        const ptA      = pathEl.getPointAtLength(Math.max(eps, Math.min(sampleAt - eps, pLen - 2 * eps)));
        const ptB      = pathEl.getPointAtLength(Math.min(pLen - eps, Math.max(sampleAt + eps, 2 * eps)));
        const hdg      = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180 / Math.PI;
        const { gear, rpm } = computeGearRPM(gpt.speedKph, paramsRef.current, prevGearRef.current);
        prevGearRef.current = gear;
        // Stage 47: throttle/brake from GPS zone+longG (must match displayed zone)
        // Thermal (tyre/brake temp) from schematic trace lookup by distance fraction
        const thermalPt   = tr.length > 1 ? traceAtDist(gpt.pathFrac * traceTotalDist, tr) : tr[0];
        const gpsThrottle = gpt.zone === 'full-throttle' ? 100 : gpt.zone === 'cornering' ? 60 : gpt.zone === 'trail-braking' ? 20 : 0;
        const gpsBrake    = gpt.zone === 'braking'       ? Math.min(100, Math.round(Math.abs(gpt.longG) * 80))
                          : gpt.zone === 'trail-braking'  ? Math.min(80,  Math.round(Math.abs(gpt.longG) * 40)) : 0;
        setDotPos({ x: pt.x, y: pt.y });
        setDotHeading(hdg);
        setTelemetry({
          speedKph: gpt.speedKph, gear, rpm, longG: gpt.longG, latG: gpt.latG, zone: gpt.zone,
          throttlePct:    gpsThrottle,
          brakePct:       gpsBrake,
          tyreTempC:      thermalPt.tyreTempC,
          brakeDiscTempC: thermalPt.brakeDiscTempC,
          sectorIndex:    thermalPt.sectorIndex,
        });
        updateGGAndViewBox(gpt.latG, gpt.longG, tGps, timestamp, pt.x, pt.y);
        if (timestamp - lastLiveUpdate.current >= 100) {
          lastLiveUpdate.current = timestamp;
          setLiveTimeSec(tGps * (traceTotalTime / gpsA.lapTimeSec));
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      timeSec_cur = t * traceTotalTime;
    } else {
      const elapsed = (timestamp - startRef.current) * playSpeedRef.current;
      const gpsA    = gpsAnimRef.current;

      if (gpsA && gpsA.anim.length > 1) {
        const tGps     = (elapsed % (gpsA.lapTimeSec * 1000)) / 1000;
        const gpt      = gpsAtTime(tGps, gpsA.anim);
        const pLen     = pathEl.getTotalLength();
        const sampleAt = gpt.pathFrac * pLen;
        const pt       = pathEl.getPointAtLength(sampleAt);
        const eps      = Math.max(0.5, pLen * 0.003);
        const ptA      = pathEl.getPointAtLength(Math.max(eps, Math.min(sampleAt - eps, pLen - 2 * eps)));
        const ptB      = pathEl.getPointAtLength(Math.min(pLen - eps, Math.max(sampleAt + eps, 2 * eps)));
        const hdg      = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180 / Math.PI;
        const { gear, rpm } = computeGearRPM(gpt.speedKph, paramsRef.current, prevGearRef.current);
        prevGearRef.current = gear;
        // Stage 47: throttle/brake from GPS zone+longG (matches displayed zone)
        const thermalPt   = tr.length > 1 ? traceAtDist(gpt.pathFrac * traceTotalDist, tr) : tr[0];
        const gpsThrottle = gpt.zone === 'full-throttle' ? 100 : gpt.zone === 'cornering' ? 60 : gpt.zone === 'trail-braking' ? 20 : 0;
        const gpsBrake    = gpt.zone === 'braking'       ? Math.min(100, Math.round(Math.abs(gpt.longG) * 80))
                          : gpt.zone === 'trail-braking'  ? Math.min(80,  Math.round(Math.abs(gpt.longG) * 40)) : 0;
        setDotPos({ x: pt.x, y: pt.y });
        setDotHeading(hdg);
        setTelemetry({
          speedKph: gpt.speedKph, gear, rpm, longG: gpt.longG, latG: gpt.latG, zone: gpt.zone,
          throttlePct:    gpsThrottle,
          brakePct:       gpsBrake,
          tyreTempC:      thermalPt.tyreTempC,
          brakeDiscTempC: thermalPt.brakeDiscTempC,
          sectorIndex:    thermalPt.sectorIndex,
        });
        updateGGAndViewBox(gpt.latG, gpt.longG, tGps, timestamp, pt.x, pt.y);
        if (timestamp - lastLiveUpdate.current >= 100) {
          lastLiveUpdate.current = timestamp;
          setLiveTimeSec(tGps * (traceTotalTime / gpsA.lapTimeSec));
        }
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      timeSec_cur = (elapsed % (traceTotalTime * 1000)) / 1000;
    }

    // ── Schematic circuit path ────────────────────────────────────────────────
    const tp       = traceAtTime(timeSec_cur, tr);
    const pathFrac = tp.distM / traceTotalDist;
    const pathLen  = pathEl.getTotalLength();
    const sampleAt = pathFrac * pathLen;
    const pt       = pathEl.getPointAtLength(sampleAt);

    const eps  = Math.max(0.5, pathLen * 0.003);
    const ptA  = pathEl.getPointAtLength(Math.max(eps, Math.min(sampleAt - eps, pathLen - 2 * eps)));
    const ptB  = pathEl.getPointAtLength(Math.min(pathLen - eps, Math.max(sampleAt + eps, 2 * eps)));
    const headingDeg = Math.atan2(ptB.y - ptA.y, ptB.x - ptA.x) * 180 / Math.PI;

    const { gear, rpm } = computeGearRPM(tp.speedKph, paramsRef.current, prevGearRef.current);
    prevGearRef.current = gear;

    setDotPos({ x: pt.x, y: pt.y });
    setDotHeading(headingDeg);
    setTelemetry({
      speedKph: tp.speedKph, gear, rpm, longG: tp.longG, latG: tp.latG, zone: tp.zone,
      throttlePct:    tp.throttlePct,
      brakePct:       tp.brakePct,
      tyreTempC:      tp.tyreTempC,
      brakeDiscTempC: tp.brakeDiscTempC,
      sectorIndex:    tp.sectorIndex,
    });
    updateGGAndViewBox(tp.latG, tp.longG, timeSec_cur, timestamp, pt.x, pt.y);
    if (timestamp - lastLiveUpdate.current >= 100) {
      lastLiveUpdate.current = timestamp;
      setLiveTimeSec(timeSec_cur);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [playing, updateGGAndViewBox]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  // ── Derived display values ─────────────────────────────────────────────────
  const redline    = params.engineRedlineRpm;
  const rpmFrac    = telemetry ? Math.min(1, telemetry.rpm / redline) : 0;
  const zoneColor  = telemetry ? ZONE_COLORS[telemetry.zone] : C.dim;

  // Sector timing (render-time, no extra state needed)
  const lapTimeSec    = result.totalTimeSec;   // always matches LapTimePanel
  const s1EndSec      = (sectorTimes.total > 0 ? sectorTimes.s1 / sectorTimes.total : 0.333) * lapTimeSec;
  const s2EndSec      = (sectorTimes.total > 0 ? (sectorTimes.s1 + sectorTimes.s2) / sectorTimes.total : 0.667) * lapTimeSec;
  const activeSector: 1 | 2 | 3 = liveTimeSec < s1EndSec ? 1 : liveTimeSec < s2EndSec ? 2 : 3;

  // Active viewBox (full / centred / chase)
  const activeViewBox = viewMode === 'full' ? viewBox : (liveViewBox ?? viewBox);

  // Chase view: circuit rotates so car always faces "up"
  const chaseTransform = viewMode === 'chase' && dotPos
    ? `rotate(${-(dotHeading + 90)}, ${dotPos.x}, ${dotPos.y})`
    : undefined;

  // Brake fade indicator (Gaussian model: 1 = no fade, 0 = maximum fade)
  const brakeOptT  = params.brakeOptTempC   ?? 400;
  const brakeHW    = params.brakeHalfWidthC ?? 200;
  const brakeFloor = params.brakeFloorMu    ?? 0.65;
  const discTemp   = telemetry?.brakeDiscTempC ?? 100;
  const brakeEfficiency = brakeFloor + (1 - brakeFloor) * Math.exp(-Math.pow((discTemp - brakeOptT) / brakeHW, 2));
  const fadeFrac   = 1 - brakeEfficiency; // 0 = optimal, >0 = degraded
  const fadeColor  = fadeFrac > 0.25 ? '#ff4422' : fadeFrac > 0.10 ? '#ffcc00' : '#22cc55';

  // View mode label
  const VIEW_LABELS: Record<ViewMode, string> = { full: 'FULL', centred: 'CAR', chase: 'CHASE' };

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        background: C.bg, fontFamily: 'system-ui, sans-serif', overflow: 'hidden',
      }}
    >

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 10px', height: 36, flexShrink: 0,
        background: C.panel, borderBottom: `1px solid ${C.border}`,
      }}>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: C.dim,
          fontSize: 16, cursor: 'pointer', padding: '0 4px', lineHeight: 1,
        }}>×</button>

        <span style={{
          flex: 1, textAlign: 'center',
          fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.18em',
          color: C.text, textTransform: 'uppercase',
        }}>
          {layout.name}
        </span>

        {layout.svgIsGps && (
          <span style={{ fontSize: 7, color: C.dim, letterSpacing: '0.08em', opacity: 0.5, flexShrink: 0 }}>
            {layout.svgSource === 'osm' ? 'GPS © OSM ODbL' : 'GPS © TUMFTM LGPL-3.0'}
          </span>
        )}

        {/* View mode toggle */}
        <button onClick={cycleViewMode} style={{
          background: viewMode !== 'full' ? 'rgba(68,102,255,0.18)' : 'none',
          border: `1px solid ${viewMode !== 'full' ? C.accent : C.border}`,
          color: viewMode !== 'full' ? '#8899ff' : C.dim,
          fontSize: 9, cursor: 'pointer', padding: '2px 6px', borderRadius: 3,
          letterSpacing: '0.1em', fontFamily: 'monospace',
        }} title="Cycle view: Full → Car-centred → Chase">
          {VIEW_LABELS[viewMode]}
        </button>

        {/* Fullscreen */}
        <button onClick={toggleFullscreen} style={{
          background: 'none', border: `1px solid ${C.border}`,
          color: C.dim, fontSize: 11, cursor: 'pointer',
          padding: '2px 6px', borderRadius: 3,
        }} title="Toggle fullscreen">
          {isFullscreen ? '⊡' : '⛶'}
        </button>

        {raceLabel && (
          <span style={{ fontSize: 10, color: C.accent, letterSpacing: '0.12em' }}>{raceLabel}</span>
        )}
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: C.text, letterSpacing: '0.08em' }}>
          {formatTime(liveTimeSec)} / {formatTime(lapTimeSec)}
        </span>
        {([1, 4, 8] as const).map(s => (
          <button key={s} onClick={() => setPlaySpeed(s)} style={{
            background: playSpeed === s ? 'rgba(68,102,255,0.2)' : 'none',
            border: `1px solid ${playSpeed === s ? C.accent : C.border}`,
            color: playSpeed === s ? '#8899ff' : C.dim,
            fontSize: 10, cursor: 'pointer', padding: '2px 6px', borderRadius: 3,
          }}>{s}×</button>
        ))}
        <button onClick={() => setPlaying(p => !p)} style={{
          background: 'none', border: `1px solid ${C.border}`, color: C.text,
          fontSize: 11, cursor: 'pointer', padding: '2px 8px', borderRadius: 3,
          letterSpacing: '0.1em',
        }}>
          {playing ? '⏸' : '▶'}
        </button>
      </div>

      {/* ── Body: circuit fills full width, panels float as overlays ── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', background: C.bg }}>

        {/* ── Circuit SVG — full width ── */}
        <svg
          viewBox={activeViewBox}
          style={{ width: '100%', height: '100%' }}
          preserveAspectRatio="xMidYMid meet"
          shapeRendering="geometricPrecision"
        >
            {/* Hidden measurement path */}
            <path ref={pathRef} d={trackD.replace(/\s*Z\s*$/i, '')} fill="none" stroke="none" />

            {/* Circuit + zones inside chase-rotation group */}
            <g transform={chaseTransform}>
              <path d={trackD} fill="none" stroke="#02020a" strokeWidth={22} strokeLinecap="round" strokeLinejoin="round" />
              <path d={trackD} fill="none" stroke="#141420" strokeWidth={16} strokeLinecap="round" strokeLinejoin="round" />
              <path d={trackD} fill="none" stroke="#1e1e30" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
              {zoneOverlay.map((seg, i) => (
                <line key={i}
                  x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                  stroke={seg.color} strokeWidth={3} strokeLinecap="round" opacity={0.88}
                />
              ))}
              <path d={trackD} fill="none" stroke="rgba(255,255,255,0.05)"
                strokeWidth={1} strokeDasharray="4 10" />
              {/* S/F marker */}
              {pathRef.current && (() => {
                const sfPt = pathRef.current!.getPointAtLength(0);
                return (
                  <>
                    <circle cx={sfPt.x} cy={sfPt.y} r={4} fill="white" opacity={0.9} />
                    <text x={sfPt.x + 6} y={sfPt.y + 4} fontSize={8} fill="white" fontFamily="monospace" opacity={0.7}>S/F</text>
                  </>
                );
              })()}
            </g>

            {/* Car arrow — NOT inside chase-rotation group (always faces up in chase mode) */}
            {dotPos && (
              <g transform={
                viewMode === 'chase'
                  ? `translate(${dotPos.x},${dotPos.y})`
                  : `translate(${dotPos.x},${dotPos.y}) rotate(${dotHeading + 90})`
              }>
                <circle r={11} fill={`${zoneColor}35`} />
                <polygon points="0,-8 -4.5,5.5 4.5,5.5"
                  fill="#ffffff" stroke={zoneColor} strokeWidth={1.5} />
              </g>
            )}
          </svg>

          {/* Zone legend — bottom-left, shifts right when left panel open */}
          <div style={{
            position: 'absolute', bottom: 8, left: 10,
            display: 'flex', gap: 10, flexWrap: 'wrap',
            background: 'rgba(7,7,15,0.80)', borderRadius: 4, padding: '4px 6px',
            zIndex: 4, transition: 'left 0.15s',
          }}>
            {ZONE_ENTRIES.map(([zone, color]) => (
              <div key={zone} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div style={{ width: 10, height: 10, background: color, borderRadius: 1 }} />
                <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.1em' }}>
                  {ZONE_LABELS[zone]}
                </span>
              </div>
            ))}
          </div>

          {/* Minimap overlay — shown in centred + chase modes, avoids right panel */}
          {viewMode !== 'full' && dotPos && (
            <MinimapOverlay trackD={trackD} viewBox={viewBox} dotPos={dotPos} rightOffset={rightOpen ? 180 : 10} />
          )}

          {/* View mode label — top-right of circuit */}
          {viewMode !== 'full' && (
            <div style={{
              position: 'absolute', top: 8, right: rightOpen ? 180 : 8,
              fontSize: 8, color: C.dim, letterSpacing: '0.14em',
              background: 'rgba(7,7,15,0.7)', borderRadius: 3, padding: '2px 5px',
              zIndex: 4,
            }}>
              {viewMode === 'chase' ? '◉ CHASE' : '⊕ CAR-CENTRED'}
            </div>
          )}

          {/* ── Left overlay panel ── */}
          {leftOpen && (
            <div style={{
              position: 'absolute', left: 8, top: 8,
              width: 170,
              background: 'rgba(10,10,22,0.94)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              zIndex: 5,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              {/* Corner temps */}
              <div style={{ padding: '8px 8px 4px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.15em', flex: 1 }}>CORNER TEMPS</span>
                  <span onClick={() => setLeftOpen(false)} style={{ fontSize: 14, color: C.dim, cursor: 'pointer', padding: '0 2px', lineHeight: 1 }} title="Close">×</span>
                </div>
                <CornerTempWidget telemetry={telemetry} params={params} />
              </div>

              {/* Sector timing */}
              <div style={{ padding: '8px', borderBottom: `1px solid ${C.border}` }}>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.15em', marginBottom: 6 }}>SECTORS</div>
                <SectorDisplay
                  liveTimeSec={liveTimeSec}
                  s1EndSec={s1EndSec}
                  s2EndSec={s2EndSec}
                  lapTimeSec={lapTimeSec}
                  s1Dur={sectorTimes.s1}
                  s2Dur={sectorTimes.s2}
                  s3Dur={sectorTimes.s3}
                  activeSector={activeSector}
                />
              </div>

              {/* System icons */}
              <div style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}` }}>
                <SystemIconsRow telemetry={telemetry} params={params} />
              </div>

              {/* Tyre wear */}
              <div style={{ padding: '6px 8px', flex: 1 }}>
                <div style={{ fontSize: 9, color: C.dim, letterSpacing: '0.15em', marginBottom: 6 }}>TYRE WEAR (EST)</div>
                <TyreWearDisplay lapFrac={liveTimeSec / Math.max(lapTimeSec, 1)} params={params} />
              </div>
            </div>
          )}

          {/* Left open button — shown when panel is closed */}
          {!leftOpen && (
            <div onClick={() => setLeftOpen(true)} style={{
              position: 'absolute', left: 8, top: 8, zIndex: 6,
              background: 'rgba(10,10,22,0.85)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 4, cursor: 'pointer', padding: '4px 8px',
              fontSize: 9, color: C.dim, letterSpacing: '0.1em',
            }} title="Show telemetry panel">☰ TEL</div>
          )}

          {/* ── Right overlay panel ── */}
          {rightOpen && (
            <div style={{
              position: 'absolute', right: 8, top: 8,
              width: 182,
              height: 248,
              background: 'rgba(10,10,22,0.94)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 6,
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
              zIndex: 5,
              boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              {/* G-G header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '8px 8px 4px',
                borderBottom: `1px solid ${C.border}`,
              }}>
                <span style={{ fontSize: 9, color: C.dim, letterSpacing: '0.15em', flex: 1 }}>G-G DIAGRAM</span>
                {(['full', 'live'] as const).map(m => (
                  <button key={m} onClick={() => setGgMode(m)} style={{
                    background: ggMode === m ? 'rgba(68,102,255,0.2)' : 'none',
                    border: `1px solid ${ggMode === m ? C.accent : C.border}`,
                    color: ggMode === m ? '#8899ff' : C.dim,
                    fontSize: 8, cursor: 'pointer', padding: '1px 5px', borderRadius: 2,
                    letterSpacing: '0.1em',
                  }}>{m.toUpperCase()}</button>
                ))}
                <span onClick={() => setRightOpen(false)} style={{ fontSize: 14, color: C.dim, cursor: 'pointer', padding: '0 2px', lineHeight: 1, marginLeft: 2 }} title="Close">×</span>
              </div>

              {/* G-G diagram */}
              <div style={{ flex: 1, padding: '6px', position: 'relative', minHeight: 0 }}>
                <GGDiagram
                  points={ggSnapshot}
                  livePoint={telemetry ? { x: telemetry.latG, y: telemetry.longG } : null}
                  peakMu={lapSimInput.peakMu}
                />
              </div>

              {/* G-G footer — μ label + live Lat-G / Long-G readout */}
              <div style={{
                padding: '4px 8px 6px',
                borderTop: `1px solid ${C.border}`,
              }}>
                <div style={{ fontSize: 8, color: C.dim, letterSpacing: '0.1em', textAlign: 'center', marginBottom: 4 }}>
                  μ={lapSimInput.peakMu.toFixed(2)} · LAT-G (x) vs LONG-G (y)
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
                      color: telemetry ? (Math.abs(telemetry.latG) > lapSimInput.peakMu * 0.85 ? '#ffcc00' : C.text) : C.dim,
                      lineHeight: 1,
                    }}>
                      {telemetry ? Math.abs(telemetry.latG).toFixed(2) : '0.00'}
                    </div>
                    <div style={{ fontSize: 8, color: C.dim, letterSpacing: '0.12em', marginTop: 2 }}>LAT-G</div>
                  </div>
                  <div style={{ width: 1, background: C.border }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'monospace', fontSize: 18, fontWeight: 700,
                      color: telemetry
                        ? (telemetry.longG < -0.5 ? '#ff4040' : telemetry.longG > 0.3 ? '#22cc55' : C.text)
                        : C.dim,
                      lineHeight: 1,
                    }}>
                      {telemetry ? telemetry.longG.toFixed(2) : '0.00'}
                    </div>
                    <div style={{ fontSize: 8, color: C.dim, letterSpacing: '0.12em', marginTop: 2 }}>LONG-G</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Right open button — shown when panel is closed */}
          {!rightOpen && (
            <div onClick={() => setRightOpen(true)} style={{
              position: 'absolute', right: 8, top: 8, zIndex: 6,
              background: 'rgba(10,10,22,0.85)', border: '1px solid rgba(255,255,255,0.09)',
              borderRadius: 4, cursor: 'pointer', padding: '4px 8px',
              fontSize: 9, color: C.dim, letterSpacing: '0.1em',
            }} title="Show G-G diagram">G-G ☰</div>
          )}
        </div>

      {/* ── Bottom strip (collapsible) ── */}
      <div style={{ flexShrink: 0 }}>
        {/* Collapse handle — always visible */}
        <div
          onClick={() => setBottomOpen(v => !v)}
          style={{
            height: 14, background: C.panel,
            borderTop: `1px solid ${C.border}`,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}
        >
          <div style={{ width: 20, height: 1.5, background: C.dim, borderRadius: 1 }} />
          <span style={{ fontSize: 7, color: C.dim, letterSpacing: '0.12em' }}>
            {bottomOpen ? '▾ TELEMETRY' : '▸ TELEMETRY'}
          </span>
          <div style={{ width: 20, height: 1.5, background: C.dim, borderRadius: 1 }} />
        </div>

        {bottomOpen && (
          <div style={{ display: 'flex', height: 82, background: C.panel }}>

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
                {telemetry ? Math.min(telemetry.rpm, params.engineRedlineRpm).toFixed(0) : '----'}
              </TValue>
              <RpmBar frac={rpmFrac} />
              <TLabel>{redline.toFixed(0)} REDLINE</TLabel>
            </TCell>

            <TDivider />

            {/* Throttle % — replaces Long-G */}
            <TCell flex={1.4}>
              <TValue size={20} color="#22cc55">
                {telemetry ? Math.round(telemetry.throttlePct) : '0'}%
              </TValue>
              <LinearBar frac={(telemetry?.throttlePct ?? 0) / 100} color="#22cc55" />
              <TLabel>THROTTLE</TLabel>
            </TCell>

            <TDivider />

            {/* Brake % — replaces Lat-G, with fade indicator */}
            <TCell flex={1.8}>
              <TValue size={20} color={telemetry && telemetry.brakePct > 5 ? '#ff4040' : C.text}>
                {telemetry ? Math.round(telemetry.brakePct) : '0'}%
              </TValue>
              <LinearBar frac={(telemetry?.brakePct ?? 0) / 100} color="#ff4040" />
              {/* Brake fade — only meaningful while actually braking */}
              {(telemetry?.brakePct ?? 0) > 5 ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: fadeColor }} />
                  <span style={{ fontSize: 7, color: fadeColor, letterSpacing: '0.1em' }}>
                    {fadeFrac > 0.20 ? 'FADE' : fadeFrac > 0.08 ? 'WARM' : 'OK'}
                  </span>
                  <span style={{ fontSize: 7, color: C.dim }}>{Math.round(discTemp)}°</span>
                </div>
              ) : (
                <div style={{ fontSize: 7, color: C.dim, marginTop: 2 }}>{Math.round(discTemp)}°C</div>
              )}
              <TLabel>BRAKE</TLabel>
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
        )}
      </div>
    </div>
  );
}

// ── Left panel: corner temperature widget ─────────────────────────────────────

function CornerTempWidget({ telemetry, params }: { telemetry: TelemetryState | null; params: VehicleParams }) {
  const base    = telemetry?.tyreTempC     ?? 85;
  const longG   = telemetry?.longG         ?? 0;
  const brakeBias = params.brakeBias       ?? 0.65;
  const optT    = params.tyreOptTempC      ?? 85;
  const hw      = params.tyreTempHalfWidthC ?? 30;
  const bOptT   = params.brakeOptTempC     ?? 400;
  const bHW     = params.brakeHalfWidthC   ?? 200;
  const discBase = telemetry?.brakeDiscTempC ?? 80;

  // Front tyres heat under braking, rear under acceleration
  const frontBoost = Math.max(0, -longG) * 6;
  const rearBoost  = Math.max(0, longG) * 4;
  const flTemp = base + frontBoost;
  const frTemp = base + frontBoost;
  const rlTemp = base + rearBoost;
  const rrTemp = base + rearBoost;

  const flDisc = discBase * brakeBias;
  const frDisc = discBase * brakeBias;
  const rlDisc = discBase * (1 - brakeBias);
  const rrDisc = discBase * (1 - brakeBias);

  const tc = (t: number) => tempColor(t, optT, hw);
  const bc = (t: number) => tempColor(t, bOptT, bHW);

  return (
    <svg viewBox="0 0 150 94" style={{ width: '100%', height: 82 }}>
      {/* Car body */}
      <rect x={30} y={32} width={90} height={30} rx={6}
        fill="rgba(16,16,28,0.9)" stroke={C.border} strokeWidth={1} />

      {/* Axle lines */}
      <line x1={21} y1={21} x2={129} y2={21} stroke={C.border} strokeWidth={1} />
      <line x1={21} y1={73} x2={129} y2={73} stroke={C.border} strokeWidth={1} />

      {/* FL tyre + disc */}
      <rect x={3}   y={8}  width={13} height={26} rx={2} fill={tc(flTemp)} />
      <rect x={16}  y={14} width={5}  height={14} rx={1} fill={bc(flDisc)} opacity={0.9} />
      <text x={9}   y={5}  fontSize={7} fill={C.dim} fontFamily="monospace" textAnchor="middle">FL</text>
      <text x={9}   y={41} fontSize={7} fill={tc(flTemp)} fontFamily="monospace" textAnchor="middle">
        {Math.round(flTemp)}°
      </text>

      {/* FR tyre + disc */}
      <rect x={134} y={8}  width={13} height={26} rx={2} fill={tc(frTemp)} />
      <rect x={129} y={14} width={5}  height={14} rx={1} fill={bc(frDisc)} opacity={0.9} />
      <text x={141} y={5}  fontSize={7} fill={C.dim} fontFamily="monospace" textAnchor="middle">FR</text>
      <text x={141} y={41} fontSize={7} fill={tc(frTemp)} fontFamily="monospace" textAnchor="middle">
        {Math.round(frTemp)}°
      </text>

      {/* RL tyre + disc */}
      <rect x={3}   y={60} width={13} height={26} rx={2} fill={tc(rlTemp)} />
      <rect x={16}  y={66} width={5}  height={14} rx={1} fill={bc(rlDisc)} opacity={0.9} />
      <text x={9}   y={57} fontSize={7} fill={C.dim} fontFamily="monospace" textAnchor="middle">RL</text>
      <text x={9}   y={93} fontSize={7} fill={tc(rlTemp)} fontFamily="monospace" textAnchor="middle">
        {Math.round(rlTemp)}°
      </text>

      {/* RR tyre + disc */}
      <rect x={134} y={60} width={13} height={26} rx={2} fill={tc(rrTemp)} />
      <rect x={129} y={66} width={5}  height={14} rx={1} fill={bc(rrDisc)} opacity={0.9} />
      <text x={141} y={57} fontSize={7} fill={C.dim} fontFamily="monospace" textAnchor="middle">RR</text>
      <text x={141} y={93} fontSize={7} fill={tc(rrTemp)} fontFamily="monospace" textAnchor="middle">
        {Math.round(rrTemp)}°
      </text>
    </svg>
  );
}

// ── Left panel: sector display ────────────────────────────────────────────────

function SectorDisplay({ liveTimeSec, s1EndSec, s2EndSec, lapTimeSec, s1Dur, s2Dur, s3Dur, activeSector }: {
  liveTimeSec: number;
  s1EndSec: number; s2EndSec: number; lapTimeSec: number;
  s1Dur: number; s2Dur: number; s3Dur: number;
  activeSector: 1 | 2 | 3;
}) {
  const totalDur = s1Dur + s2Dur + s3Dur || 1;
  const rows: { label: string; dur: number; elapsed: number | null; active: boolean }[] = [
    {
      label: 'S1',
      dur: s1Dur,
      elapsed: activeSector >= 2 ? s1EndSec : (activeSector === 1 ? liveTimeSec : null),
      active: activeSector === 1,
    },
    {
      label: 'S2',
      dur: s2Dur,
      elapsed: activeSector >= 3 ? s2EndSec - s1EndSec : (activeSector === 2 ? liveTimeSec - s1EndSec : null),
      active: activeSector === 2,
    },
    {
      label: 'S3',
      dur: s3Dur,
      elapsed: activeSector === 3 ? liveTimeSec - s2EndSec : null,
      active: activeSector === 3,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {rows.map(row => (
        <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, width: 14,
            color: row.active ? C.accent : C.dim,
            letterSpacing: '0.1em',
          }}>{row.label}</span>
          {/* Duration bar */}
          <div style={{
            flex: 1, height: 4, background: C.border, borderRadius: 2, position: 'relative',
          }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${(row.dur / totalDur) * 100}%`,
              background: row.active ? C.accent : '#2a2a48',
              borderRadius: 2,
            }} />
            {/* Progress inside sector */}
            {row.active && row.elapsed !== null && (
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                width: `${Math.min(100, (row.elapsed / Math.max(row.dur, 0.1)) * (row.dur / totalDur) * 100)}%`,
                background: `${C.accent}88`,
                borderRadius: 2,
              }} />
            )}
          </div>
          <span style={{
            fontFamily: 'monospace', fontSize: 9, width: 40, textAlign: 'right',
            color: row.active ? C.text : (row.elapsed !== null ? '#6688aa' : C.dim),
          }}>
            {row.elapsed !== null ? formatTime(row.elapsed) : formatTime(row.dur)}
          </span>
        </div>
      ))}
      <div style={{
        marginTop: 2, paddingTop: 4,
        borderTop: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 7, color: C.dim, letterSpacing: '0.12em' }}>LAP</span>
        <span style={{ fontFamily: 'monospace', fontSize: 10, color: C.text }}>{formatTime(lapTimeSec)}</span>
      </div>
    </div>
  );
}

// ── Left panel: system icons ──────────────────────────────────────────────────

function SystemIconsRow({ telemetry, params }: { telemetry: TelemetryState | null; params: VehicleParams }) {
  const zone    = telemetry?.zone ?? 'full-throttle';

  const tcActive = (params.tcEnabled ?? false) && zone === 'full-throttle';
  const turboVisible = (params.engineCurveType ?? '') === 'turbo';
  const turboActive  = turboVisible && (telemetry?.speedKph ?? 0) > 80;
  const ersActive    = (params.ersEnabled ?? false) && zone === 'full-throttle';

  const iconStyle = (active: boolean, dimmed: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 3,
    padding: '3px 5px', borderRadius: 3,
    border: `1px solid ${active ? C.accent : C.border}`,
    background: active ? 'rgba(68,102,255,0.15)' : 'transparent',
    opacity: dimmed ? 0.3 : 1,
  });

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      <div style={iconStyle(tcActive, !params.tcEnabled)}>
        <span style={{ fontSize: 8, color: tcActive ? '#8899ff' : C.dim, letterSpacing: '0.08em', fontFamily: 'monospace' }}>TC</span>
      </div>
      {turboVisible && (
        <div style={iconStyle(turboActive, false)}>
          <span style={{ fontSize: 8, color: turboActive ? '#ffcc44' : C.dim, letterSpacing: '0.08em', fontFamily: 'monospace' }}>TURBO</span>
        </div>
      )}
      {params.ersEnabled && (
        <div style={iconStyle(ersActive, false)}>
          <span style={{ fontSize: 8, color: ersActive ? '#44ffaa' : C.dim, letterSpacing: '0.08em', fontFamily: 'monospace' }}>ERS</span>
        </div>
      )}
    </div>
  );
}

// ── Left panel: tyre wear ─────────────────────────────────────────────────────

function TyreWearDisplay({ lapFrac, params }: { lapFrac: number; params: VehicleParams }) {
  const compound = params.tyreCompound ?? 'medium';
  const wearRates: Record<string, number> = {
    soft: 0.40, medium: 0.24, hard: 0.14, inter: 0.20, wet: 0.16,
  };
  const rate = wearRates[compound] ?? 0.24;
  // Front tyres wear slightly faster (more cornering + braking load)
  const wearFL = Math.min(100, lapFrac * 100 * rate * 1.05);
  const wearFR = Math.min(100, lapFrac * 100 * rate * 1.05);
  const wearRL = Math.min(100, lapFrac * 100 * rate * 0.95);
  const wearRR = Math.min(100, lapFrac * 100 * rate * 0.95);

  const wearColor = (w: number) => w > 60 ? '#ff4422' : w > 35 ? '#ffcc00' : '#22cc55';

  const WearBar = ({ label, pct }: { label: string; pct: number }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4 }}>
      <span style={{ fontSize: 8, color: C.dim, fontFamily: 'monospace', width: 14 }}>{label}</span>
      <div style={{ flex: 1, height: 5, background: C.border, borderRadius: 2 }}>
        <div style={{
          width: `${pct}%`, height: '100%',
          background: wearColor(pct), borderRadius: 2,
          transition: 'width 0.3s ease',
        }} />
      </div>
      <span style={{ fontSize: 7, color: wearColor(pct), fontFamily: 'monospace', width: 24, textAlign: 'right' }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );

  return (
    <div>
      <WearBar label="FL" pct={wearFL} />
      <WearBar label="FR" pct={wearFR} />
      <WearBar label="RL" pct={wearRL} />
      <WearBar label="RR" pct={wearRR} />
    </div>
  );
}

// ── Right panel: G-G diagram ──────────────────────────────────────────────────

function GGDiagram({ points, livePoint, peakMu }: {
  points: { x: number; y: number }[];
  livePoint: { x: number; y: number } | null;
  peakMu: number;
}) {
  const R = 2.4;
  return (
    <svg
      viewBox={`${-R} ${-R} ${2 * R} ${2 * R}`}
      style={{ width: '100%', height: '100%', display: 'block' }}
      preserveAspectRatio="xMidYMid meet"
    >
      {/* Background */}
      <rect x={-R} y={-R} width={2 * R} height={2 * R} fill="rgba(0,0,0,0.35)" />

      {/* Grid lines */}
      {[-2, -1, 0, 1, 2].map(v => (
        <g key={v}>
          <line x1={v} y1={-R} x2={v} y2={R} stroke="rgba(255,255,255,0.04)" strokeWidth={0.015} />
          <line x1={-R} y1={v} x2={R} y2={v} stroke="rgba(255,255,255,0.04)" strokeWidth={0.015} />
        </g>
      ))}

      {/* Axes */}
      <line x1={-R} y1={0} x2={R} y2={0} stroke="rgba(255,255,255,0.10)" strokeWidth={0.025} />
      <line x1={0} y1={-R} x2={0} y2={R} stroke="rgba(255,255,255,0.10)" strokeWidth={0.025} />

      {/* Friction circle */}
      <circle cx={0} cy={0} r={peakMu}
        fill="none" stroke="rgba(80,220,80,0.75)" strokeWidth={0.05} strokeDasharray="0.15 0.08" />
      <circle cx={0} cy={0} r={peakMu}
        fill="none" stroke="rgba(80,220,80,0.14)" strokeWidth={0.18} />

      {/* Scatter — latG mirrored (unsigned → symmetric display) */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={p.x}  cy={-p.y} r={0.042} fill="rgba(110,145,240,0.70)" />
          <circle cx={-p.x} cy={-p.y} r={0.042} fill="rgba(110,145,240,0.32)" />
        </g>
      ))}

      {/* Live dot */}
      {livePoint && (
        <g>
          <circle cx={livePoint.x}  cy={-livePoint.y} r={0.10} fill="#4466ff" opacity={0.95} />
          <circle cx={-livePoint.x} cy={-livePoint.y} r={0.10} fill="#4466ff" opacity={0.45} />
          {/* Glow ring */}
          <circle cx={livePoint.x}  cy={-livePoint.y} r={0.18} fill="none" stroke="rgba(68,102,255,0.4)" strokeWidth={0.04} />
        </g>
      )}

      {/* Axis labels */}
      <text x={R - 0.08} y={-0.08} fontSize={0.18} fill="rgba(255,255,255,0.25)" textAnchor="end" fontFamily="monospace">LAT</text>
      <text x={0.08}     y={-(R - 0.18)} fontSize={0.18} fill="rgba(255,255,255,0.25)" fontFamily="monospace">LONG</text>
      <text x={-(R-0.08)} y={0.22} fontSize={0.14} fill="rgba(255,255,255,0.18)" textAnchor="start" fontFamily="monospace">BRAKE</text>
      <text x={0.08}     y={R - 0.12} fontSize={0.14} fill="rgba(255,255,255,0.18)" fontFamily="monospace">ACCEL</text>
    </svg>
  );
}

// ── Minimap overlay ───────────────────────────────────────────────────────────

function MinimapOverlay({ trackD, viewBox, dotPos, rightOffset = 10 }: {
  trackD: string; viewBox: string; dotPos: { x: number; y: number }; rightOffset?: number;
}) {
  const parts = viewBox.split(' ').map(Number);
  const vbW = parts[2] ?? 100;
  const mapScale = 92 / Math.max(vbW, 1);
  const dotR = vbW * 0.022;

  return (
    <div style={{
      position: 'absolute', bottom: 30, right: rightOffset,
      transition: 'right 0.15s',
      width: 100, height: 76,
      background: 'rgba(8,8,20,0.92)',
      border: `1px solid rgba(255,255,255,0.16)`,
      borderRadius: 5, overflow: 'hidden',
    }}>
      <svg viewBox={viewBox} style={{ width: '100%', height: '100%' }} preserveAspectRatio="xMidYMid meet" shapeRendering="geometricPrecision">
        <path d={trackD} fill="none" stroke="#1a1a38" strokeWidth={22 / mapScale} strokeLinecap="round" strokeLinejoin="round" />
        <path d={trackD} fill="none" stroke="#5555a0" strokeWidth={10 / mapScale} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={dotPos.x} cy={dotPos.y} r={dotR} fill="#5577ff" />
        <circle cx={dotPos.x} cy={dotPos.y} r={dotR * 2.5} fill="none" stroke="rgba(85,119,255,0.55)" strokeWidth={dotR * 0.5} />
      </svg>
      <div style={{
        position: 'absolute', top: 2, left: 4,
        fontSize: 7, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', fontFamily: 'monospace',
      }}>MAP</div>
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
