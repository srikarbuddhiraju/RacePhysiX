/**
 * TrackVisualiser — premium circuit map with speed heatmap and real-time animation.
 *
 * Layout: 3-column flex row
 *   Left panel (200px)  — Speedometer arc gauge, speed number, gear indicator
 *   Centre (flex-1)     — SVG circuit map with speed heatmap
 *   Right panel (200px) — RPM gauge, longitudinal G-meter, 4 tyre temp indicators
 *
 * Animation is ALWAYS real-time (loop duration = result.totalTimeSec * 1000 ms).
 *
 * Visual layers (back to front):
 *   1. Track shadow (blurred black, depth)
 *   2. Kerb/edge border (#4a4a60, more visible)
 *   3. Asphalt surface (#252533)
 *   4. Speed heatmap (red→yellow→cyan)
 *   5. Centre line dashes (subtle white)
 *   6. S/F line (white crossbar)
 *   7. Car glow + car dot (speed-coloured)
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { TrackLayout, LapResult, RaceResult } from '../physics/laptime';
import type { VehicleParams } from '../physics/types';

// ── Speed profile ──────────────────────────────────────────────────────────────

interface SpeedPt { pathFrac: number; speedKph: number }

function buildSpeedProfile(result: LapResult): SpeedPt[] {
  const totalLen = result.totalLengthM;
  const pts: SpeedPt[] = [];
  let cumLen = 0;
  for (const seg of result.segments) {
    const startFrac = cumLen / totalLen;
    const midFrac   = (cumLen + seg.length / 2) / totalLen;
    const endFrac   = (cumLen + seg.length)     / totalLen;
    if (seg.type === 'straight') {
      pts.push({ pathFrac: startFrac, speedKph: seg.entrySpeedKph });
      pts.push({ pathFrac: endFrac,   speedKph: seg.exitSpeedKph  });
    } else {
      pts.push({ pathFrac: startFrac, speedKph: seg.entrySpeedKph });
      pts.push({ pathFrac: midFrac,   speedKph: seg.minSpeedKph   });
      pts.push({ pathFrac: endFrac,   speedKph: seg.exitSpeedKph  });
    }
    cumLen += seg.length;
  }
  return pts;
}

function interpSpeed(frac: number, profile: SpeedPt[]): number {
  if (!profile.length) return 0;
  if (frac <= profile[0].pathFrac) return profile[0].speedKph;
  for (let i = 1; i < profile.length; i++) {
    if (frac <= profile[i].pathFrac) {
      const span = profile[i].pathFrac - profile[i - 1].pathFrac;
      const t    = span > 0 ? (frac - profile[i - 1].pathFrac) / span : 0;
      return profile[i - 1].speedKph + t * (profile[i].speedKph - profile[i - 1].speedKph);
    }
  }
  return profile[profile.length - 1].speedKph;
}

/** Map speed → hsl colour: slow = red (0°), medium = yellow (50°), fast = cyan (200°). */
function speedToColor(speed: number, minSpd: number, maxSpd: number): string {
  const t   = maxSpd > minSpd ? Math.max(0, Math.min(1, (speed - minSpd) / (maxSpd - minSpd))) : 0;
  const hue = t < 0.5 ? t * 2 * 50 : 50 + (t - 0.5) * 2 * 150;
  return `hsl(${hue.toFixed(0)}, 90%, 58%)`;
}

// ── Time fractions table ───────────────────────────────────────────────────────

interface TimePt { pathFrac: number; timeFrac: number }

function buildTimeFractions(result: LapResult): TimePt[] {
  const total = result.totalTimeSec;
  const totalLen = result.totalLengthM;
  let cumLen = 0, cumTime = 0;
  const pts: TimePt[] = [{ pathFrac: 0, timeFrac: 0 }];
  for (const seg of result.segments) {
    cumLen  += seg.length;
    cumTime += seg.timeSec;
    pts.push({ pathFrac: cumLen / totalLen, timeFrac: cumTime / total });
  }
  return pts;
}

function timeFracToPathFrac(tf: number, table: TimePt[]): number {
  for (let i = 1; i < table.length; i++) {
    if (tf <= table[i].timeFrac) {
      const span = table[i].timeFrac - table[i - 1].timeFrac;
      const t    = span > 0 ? (tf - table[i - 1].timeFrac) / span : 0;
      return table[i - 1].pathFrac + t * (table[i].pathFrac - table[i - 1].pathFrac);
    }
  }
  return 1;
}

// ── Track path builder ────────────────────────────────────────────────────────

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
      const perpAngle = heading + turn * Math.PI / 2;
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
    d:       pts.join(' '),
    viewBox: `${(minX - PAD).toFixed(1)} ${(minY - PAD).toFixed(1)} ${vbW.toFixed(1)} ${vbH.toFixed(1)}`,
  };
}

// ── Heatmap segment ────────────────────────────────────────────────────────────

interface HeatSeg { x1: number; y1: number; x2: number; y2: number; color: string }

// ── Gear / RPM computation ─────────────────────────────────────────────────────

function computeGearRPM(speedKph: number, params: VehicleParams): { gear: number; rpm: number } {
  const speedMs = speedKph / 3.6;
  if (speedMs < 0.5) return { gear: 1, rpm: params.enginePeakRpm * 0.2 };
  const wheelRpmAtSpeed = (speedMs / params.wheelRadiusM) / (2 * Math.PI) * 60;
  const n    = params.gearCount;
  const step = Math.pow(params.topGearRatio / params.firstGearRatio, 1 / (n - 1));
  for (let g = 1; g <= n; g++) {
    const ratio = params.firstGearRatio * Math.pow(step, g - 1);
    const rpm   = wheelRpmAtSpeed * ratio * params.finalDriveRatio;
    if (rpm <= params.engineRedlineRpm * 0.92) {
      return { gear: g, rpm: Math.max(rpm, params.enginePeakRpm * 0.15) };
    }
  }
  const topRatio = params.firstGearRatio * Math.pow(step, n - 1);
  return { gear: n, rpm: wheelRpmAtSpeed * topRatio * params.finalDriveRatio };
}

// ── Arc gauge helpers ─────────────────────────────────────────────────────────

// Speedometer/RPM gauge: -210° to +30° from 12-o-clock (240° sweep, standard analog style)
const SPD_START_DEG = -210;  // from 12-o-clock (bottom-left)
const SPD_END_DEG   = 30;    // from 12-o-clock (bottom-right)

function speedometerAngle(speedKph: number, maxSpd: number): number {
  const frac = Math.max(0, Math.min(1, speedKph / Math.max(maxSpd, 1)));
  return SPD_START_DEG + frac * (SPD_END_DEG - SPD_START_DEG);
}

function rpmAngle(rpm: number, redline: number): number {
  const frac = Math.max(0, Math.min(1, rpm / Math.max(redline, 1)));
  return SPD_START_DEG + frac * (SPD_END_DEG - SPD_START_DEG);
}

/** SVG arc path from centre. startAngle/endAngle in degrees from 12-o-clock, CW positive. */
function gaugeArcPath(cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number): string {
  const toRad = (d: number) => (d - 90) * Math.PI / 180;
  const sa = toRad(startAngleDeg);
  const ea = toRad(endAngleDeg);
  const x1 = cx + r * Math.cos(sa);
  const y1 = cy + r * Math.sin(sa);
  const x2 = cx + r * Math.cos(ea);
  const y2 = cy + r * Math.sin(ea);
  // Determine large arc: going clockwise from start to end
  const sweep = ((endAngleDeg - startAngleDeg) % 360 + 360) % 360;
  const large = sweep > 180 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

// ── Speedometer gauge SVG ─────────────────────────────────────────────────────

function SpeedometerGauge({ speedKph, maxSpeedKph, color }: { speedKph: number; maxSpeedKph: number; color: string }) {
  const cx = 80, cy = 80, r = 60;
  const needleAngle = speedometerAngle(speedKph, maxSpeedKph);
  const toRad = (d: number) => (d - 90) * Math.PI / 180;
  const nx = cx + r * 0.85 * Math.cos(toRad(needleAngle));
  const ny = cy + r * 0.85 * Math.sin(toRad(needleAngle));

  // Background arc
  const bgArc      = gaugeArcPath(cx, cy, r, SPD_START_DEG, SPD_END_DEG);
  // Value arc (from start to needle position)
  const valArc     = speedKph > 0.1
    ? gaugeArcPath(cx, cy, r, SPD_START_DEG, needleAngle)
    : null;

  return (
    <svg width="160" height="130" viewBox="0 0 160 130" style={{ display: 'block', margin: '0 auto' }}>
      {/* Background track */}
      <path d={bgArc} fill="none" stroke="#1e1e2d" strokeWidth="8" strokeLinecap="round" />
      {/* Value arc */}
      {valArc && <path d={valArc} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeOpacity="0.9" />}
      {/* Needle */}
      <line
        x1={cx} y1={cy}
        x2={nx.toFixed(1)} y2={ny.toFixed(1)}
        stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeOpacity="0.95"
      />
      {/* Centre dot */}
      <circle cx={cx} cy={cy} r="4" fill={color} fillOpacity="0.9" />
      <circle cx={cx} cy={cy} r="2" fill="#0a0a14" />
      {/* Speed text */}
      <text x={cx} y={cy + 26} textAnchor="middle" fill={color} fontSize="22" fontWeight="700" fontFamily="monospace">
        {Math.round(speedKph)}
      </text>
      <text x={cx} y={cy + 38} textAnchor="middle" fill="#556" fontSize="8" fontFamily="sans-serif">
        km/h
      </text>
      {/* Scale labels */}
      <text x={cx - 45} y={cy + 55} textAnchor="middle" fill="#445" fontSize="7">0</text>
      <text x={cx + 45} y={cy + 55} textAnchor="middle" fill="#445" fontSize="7">{Math.round(maxSpeedKph)}</text>
    </svg>
  );
}

// ── RPM gauge SVG ─────────────────────────────────────────────────────────────

function RpmGauge({ rpm, peakRpm, redlineRpm }: { rpm: number; peakRpm: number; redlineRpm: number }) {
  const cx = 80, cy = 80, r = 60;
  const needleAngle = rpmAngle(rpm, redlineRpm);
  const peakAngle   = rpmAngle(peakRpm, redlineRpm);
  const warnAngle   = rpmAngle(redlineRpm * 0.90, redlineRpm);
  const toRad = (d: number) => (d - 90) * Math.PI / 180;
  const nx = cx + r * 0.85 * Math.cos(toRad(needleAngle));
  const ny = cy + r * 0.85 * Math.sin(toRad(needleAngle));

  const greenArc  = gaugeArcPath(cx, cy, r, SPD_START_DEG, peakAngle);
  const orangeArc = gaugeArcPath(cx, cy, r, peakAngle, warnAngle);
  const redArc    = gaugeArcPath(cx, cy, r, warnAngle, SPD_END_DEG);
  const valArc    = rpm > 100 ? gaugeArcPath(cx, cy, r, SPD_START_DEG, needleAngle) : null;

  const rpmColor = rpm >= redlineRpm * 0.90 ? '#f43f5e' : rpm >= peakRpm ? '#f97316' : '#4ade80';

  return (
    <svg width="160" height="130" viewBox="0 0 160 130" style={{ display: 'block', margin: '0 auto' }}>
      {/* Zone arcs */}
      <path d={greenArc}  fill="none" stroke="#4ade8022" strokeWidth="8" strokeLinecap="round" />
      <path d={orangeArc} fill="none" stroke="#f9731622" strokeWidth="8" strokeLinecap="round" />
      <path d={redArc}    fill="none" stroke="#f43f5e22" strokeWidth="8" strokeLinecap="round" />
      {/* Background track */}
      <path d={gaugeArcPath(cx, cy, r, SPD_START_DEG, SPD_END_DEG)} fill="none" stroke="#1e1e2d" strokeWidth="8" strokeLinecap="round" />
      {/* Value arc */}
      {valArc && <path d={valArc} fill="none" stroke={rpmColor} strokeWidth="6" strokeLinecap="round" strokeOpacity="0.85" />}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke={rpmColor} strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill={rpmColor} fillOpacity="0.9" />
      <circle cx={cx} cy={cy} r="2" fill="#0a0a14" />
      {/* RPM text */}
      <text x={cx} y={cy + 24} textAnchor="middle" fill={rpmColor} fontSize="14" fontWeight="700" fontFamily="monospace">
        {Math.round(rpm / 100) * 100}
      </text>
      <text x={cx} y={cy + 35} textAnchor="middle" fill="#556" fontSize="8">RPM</text>
      <text x={cx - 40} y={cy + 55} textAnchor="middle" fill="#445" fontSize="7">0</text>
      <text x={cx + 40} y={cy + 55} textAnchor="middle" fill="#f43f5e88" fontSize="7">{Math.round(redlineRpm / 1000)}k</text>
    </svg>
  );
}

// ── G-meter (vertical bar) ────────────────────────────────────────────────────

function GMeter({ accelG }: { accelG: number }) {
  const H = 100, W = 24;
  const minG = -1.5, maxG = 1.0;
  const total = maxG - minG;
  const zeroFrac  = (maxG) / total;  // fraction from top where zero is
  const gFrac     = Math.max(0, Math.min(1, (maxG - accelG) / total));  // from top
  const zeroY     = zeroFrac * H;
  const gY        = gFrac * H;
  const barTop    = Math.min(zeroY, gY);
  const barHeight = Math.abs(zeroY - gY);
  const isAccel   = accelG >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{ fontSize: 7, color: '#445', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Long G</span>
      <svg width={W + 20} height={H + 4} viewBox={`0 0 ${W + 20} ${H + 4}`}>
        {/* Background bar */}
        <rect x={10} y={2} width={W} height={H} rx={3} fill="#1e1e2d" />
        {/* Value bar */}
        <rect x={10} y={barTop + 2} width={W} height={barHeight} rx={2} fill={isAccel ? '#4ade80' : '#f43f5e'} fillOpacity="0.85" />
        {/* Zero line */}
        <line x1={8} y1={zeroY + 2} x2={W + 12} y2={zeroY + 2} stroke="#334" strokeWidth="1.5" />
        {/* Labels */}
        <text x={W + 14} y={zeroY + 6} fontSize="7" fill="#445" fontFamily="monospace">0</text>
        <text x={W + 14} y={6} fontSize="7" fill="#4ade8088" fontFamily="monospace">+1g</text>
        <text x={W + 14} y={H + 4} fontSize="7" fill="#f43f5e88" fontFamily="monospace">-1.5</text>
      </svg>
      <span style={{ fontSize: 9, fontWeight: 700, color: isAccel ? '#4ade80' : '#f43f5e', fontVariantNumeric: 'tabular-nums' }}>
        {accelG >= 0 ? '+' : ''}{accelG.toFixed(2)}g
      </span>
    </div>
  );
}

// ── Tyre temperature indicator ────────────────────────────────────────────────

function tyreTempColor(tempC: number, optC: number, halfWidthC: number): string {
  const delta = Math.abs(tempC - optC);
  if (delta < halfWidthC * 0.4) return '#4ade80';
  if (delta < halfWidthC * 0.8) return '#facc15';
  if (delta < halfWidthC * 1.3) return '#f97316';
  return '#f43f5e';
}

function TyreTempGrid({ tempC, optC, halfWidthC }: { tempC: number; optC: number; halfWidthC: number }) {
  const positions = ['FL', 'FR', 'RL', 'RR'] as const;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <span style={{ fontSize: 7, color: '#445', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Tyre Temps</span>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
        {positions.map(pos => {
          const col = tyreTempColor(tempC, optC, halfWidthC);
          return (
            <div key={pos} style={{
              background: col + '22',
              border: `1px solid ${col}66`,
              borderRadius: 4, padding: '4px 6px', textAlign: 'center', minWidth: 36,
            }}>
              <div style={{ fontSize: 7, color: '#667', marginBottom: 1 }}>{pos}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: col, fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(tempC)}°
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Telemetry state ────────────────────────────────────────────────────────────

interface TelemetryState {
  speedKph: number;
  gear:     number;
  rpm:      number;
  accelG:   number;
  tyreTempC: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  layout:      TrackLayout;
  result:      LapResult;
  raceResult:  RaceResult | null;
  /** Increment to trigger race animation. */
  triggerRace: number;
  params:      VehicleParams;
  onClose:     () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TrackVisualiser({ layout, result, raceResult, triggerRace, params, onClose }: Props) {
  const [playing,         setPlaying]         = useState(true);
  const [dotPos,          setDotPos]          = useState<{ x: number; y: number } | null>(null);
  const [dotColor,        setDotColor]        = useState('#ef4444');
  const [heatmap,         setHeatmap]         = useState<HeatSeg[]>([]);
  const [raceLabel,       setRaceLabel]       = useState<string | null>(null);
  const [telemetry,       setTelemetry]       = useState<TelemetryState | null>(null);

  // Refs used inside RAF
  const pathRef        = useRef<SVGPathElement | null>(null);
  const rafRef         = useRef<number | null>(null);
  const startRef       = useRef<number | null>(null);
  const lapStartRef    = useRef<number | null>(null);
  const raceAnimRef    = useRef<{ isRacing: boolean; lapIdx: number } | null>(null);
  const resultRef      = useRef(result);
  const raceResultRef  = useRef(raceResult);
  const timeFracsRef   = useRef<TimePt[]>([]);
  const speedProfRef   = useRef<SpeedPt[]>([]);
  const prevSpeedRef   = useRef<number>(0);
  const prevTimeRef    = useRef<number | null>(null);

  // Keep refs in sync
  useEffect(() => { resultRef.current    = result;    }, [result]);
  useEffect(() => { raceResultRef.current = raceResult; }, [raceResult]);

  const timeFractions = useMemo(() => buildTimeFractions(result), [result]);
  const speedProfile  = useMemo(() => buildSpeedProfile(result),  [result]);

  useEffect(() => { timeFracsRef.current = timeFractions; }, [timeFractions]);
  useEffect(() => { speedProfRef.current = speedProfile;  }, [speedProfile]);

  // Derive SVG path
  const { d, viewBox } = useMemo(() => {
    if (layout.svgPath && layout.svgViewBox) {
      return { d: layout.svgPath, viewBox: layout.svgViewBox };
    }
    return buildTrackPath(layout);
  }, [layout]);

  // Sample heatmap
  useEffect(() => {
    const pathEl = pathRef.current;
    if (!pathEl || result.totalLengthM === 0) return;
    const N       = 300;
    const pathLen = pathEl.getTotalLength();
    const minSpd  = result.minCornerKph;
    const maxSpd  = result.maxSpeedKph;
    const profile = speedProfRef.current;
    const ptArr: Array<{ x: number; y: number }> = [];
    for (let i = 0; i <= N; i++) {
      const pt = pathEl.getPointAtLength((i / N) * pathLen);
      ptArr.push({ x: pt.x, y: pt.y });
    }
    const lines: HeatSeg[] = ptArr.slice(1).map((p, i) => ({
      x1: ptArr[i].x, y1: ptArr[i].y,
      x2: p.x,        y2: p.y,
      color: speedToColor(interpSpeed((i + 0.5) / N, profile), minSpd, maxSpd),
    }));
    setHeatmap(lines);
  }, [layout, result]);

  // Trigger race animation
  useEffect(() => {
    if (triggerRace === 0 || !raceResult || raceResult.laps.length === 0) return;
    raceAnimRef.current = { isRacing: true, lapIdx: 0 };
    lapStartRef.current = null;
    startRef.current    = null;
    setRaceLabel(`Lap 1 / ${raceResult.laps.length}`);
  }, [triggerRace]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on layout/result change
  useEffect(() => {
    startRef.current = null;
  }, [layout, result]);

  // Core RAF tick — always real-time
  const tick = useCallback((timestamp: number) => {
    const pathEl = pathRef.current;
    if (!pathEl) return;
    if (startRef.current === null) {
      startRef.current  = timestamp;
      prevTimeRef.current = timestamp;
    }

    const res       = resultRef.current;
    const raceRes   = raceResultRef.current;
    const raceAnim  = raceAnimRef.current;
    const timeFracs = timeFracsRef.current;
    const speedProf = speedProfRef.current;

    let pathFrac: number;

    if (raceAnim?.isRacing && raceRes && raceRes.laps.length > 0) {
      if (lapStartRef.current === null) lapStartRef.current = timestamp;
      const lapData  = raceRes.laps[raceAnim.lapIdx];
      const lapMs    = lapData.lapTimeSec * 1000;
      const elapsed  = timestamp - lapStartRef.current;
      const tf       = Math.min(elapsed / lapMs, 1);
      pathFrac       = timeFracToPathFrac(tf, timeFracs);

      if (elapsed >= lapMs) {
        const nextIdx = raceAnim.lapIdx + 1;
        if (nextIdx >= raceRes.laps.length) {
          raceAnimRef.current = null;
          setRaceLabel(null);
        } else {
          raceAnimRef.current = { isRacing: true, lapIdx: nextIdx };
          setRaceLabel(`Lap ${nextIdx + 1} / ${raceRes.laps.length}`);
          lapStartRef.current = timestamp;
        }
      }
    } else {
      // Always real-time loop
      const elapsed = timestamp - startRef.current;
      const loopMs  = res.totalTimeSec * 1000;
      const tf      = (elapsed % loopMs) / loopMs;
      pathFrac      = timeFracToPathFrac(tf, timeFracs);
    }

    const totalPathLen = pathEl.getTotalLength();
    const pt           = pathEl.getPointAtLength(pathFrac * totalPathLen);
    const speedKph     = interpSpeed(pathFrac, speedProf);
    const color        = speedToColor(speedKph, res.minCornerKph, res.maxSpeedKph);

    // Longitudinal G
    const dt = prevTimeRef.current !== null ? (timestamp - prevTimeRef.current) : 16;
    const prevSpeed = prevSpeedRef.current;
    const accelMs2  = ((speedKph - prevSpeed) / 3.6) / (dt / 1000);
    const accelG    = accelMs2 / 9.81;
    prevSpeedRef.current = speedKph;
    prevTimeRef.current  = timestamp;

    // Gear / RPM
    const { gear, rpm } = computeGearRPM(speedKph, params);

    // Tyre temp: use raceResult current lap if available
    let tyreTempC = params.tyreTempCurrentC;
    if (raceAnimRef.current?.isRacing && raceRes && raceRes.laps.length > 0) {
      const lapIdx = Math.min(raceAnimRef.current.lapIdx, raceRes.laps.length - 1);
      tyreTempC = raceRes.laps[lapIdx].tyreTempC;
    }

    setDotPos({ x: pt.x, y: pt.y });
    setDotColor(color);
    setTelemetry({ speedKph, gear, rpm, accelG, tyreTempC });

    rafRef.current = requestAnimationFrame(tick);
  }, [params]); // params is stable-ish; gear/RPM computation needs it

  // Start / stop animation
  useEffect(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (playing) {
      startRef.current = null;
      prevTimeRef.current = null;
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setDotPos(null);
      setTelemetry(null);
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, tick]);

  // S/F marker geometry
  const [, , vbW, vbH] = viewBox.split(' ').map(Number);
  const u       = Math.min(vbW, vbH) * 0.06;
  const sfMatch = d.match(/M\s*([\d.+-]+)\s+([\d.+-]+)/);
  const sfX     = sfMatch ? parseFloat(sfMatch[1]) : 0;
  const sfY     = sfMatch ? parseFloat(sfMatch[2]) : 0;

  const distKm     = (result.totalLengthM / 1000).toFixed(3);
  const maxSpeedKph = result.maxSpeedKph;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a14' }}>

      {/* ── Header bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0,
        background: '#0d0d1a',
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          title="Close circuit map"
          style={{
            background: 'none', border: '1px solid #333344', borderRadius: 4,
            color: '#888899', cursor: 'pointer', fontSize: 14, lineHeight: 1,
            padding: '2px 8px', fontWeight: 700,
          }}
        >
          ×
        </button>

        <span style={{ fontSize: 11, fontWeight: 700, color: '#e0e0f0', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          {layout.name}
        </span>
        <span style={{ fontSize: 9, color: '#555577' }}>{distKm} km</span>

        <span style={{ fontSize: 9, color: '#666688', background: 'rgba(100,100,255,0.08)', padding: '2px 8px', borderRadius: 10 }}>
          Real-time simulation
        </span>

        {raceLabel && (
          <span style={{ fontSize: 9, fontWeight: 700, color: '#a0a0ff', background: 'rgba(100,100,255,0.12)', padding: '2px 7px', borderRadius: 10 }}>
            {raceLabel}
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setPlaying(p => !p)}
            title={playing ? 'Pause animation' : 'Resume animation'}
            style={{
              padding: '3px 10px', fontSize: 10, fontWeight: 700,
              background: playing ? 'rgba(100,100,255,0.15)' : '#1e1e2e',
              border: `1px solid ${playing ? '#6466f1' : '#333344'}`,
              borderRadius: 5, color: playing ? '#a0a0ff' : '#666677', cursor: 'pointer',
            }}
          >
            {playing ? '⏸' : '▶'}
          </button>
        </div>
      </div>

      {/* ── 3-column body ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

        {/* ── Left panel: Speedometer + Gear ── */}
        <div style={{
          width: 170, flexShrink: 0,
          background: '#0d0d1a', borderRight: '1px solid #1a1a28',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 8, padding: '12px 8px',
        }}>
          <div style={{ fontSize: 8, color: '#445', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Speed</div>
          <SpeedometerGauge
            speedKph={telemetry?.speedKph ?? 0}
            maxSpeedKph={maxSpeedKph}
            color={telemetry ? speedToColor(telemetry.speedKph, result.minCornerKph, result.maxSpeedKph) : '#ef4444'}
          />
          {/* Gear display */}
          <div style={{
            fontSize: 42, fontWeight: 900, color: '#e0e0f0',
            fontFamily: 'monospace', lineHeight: 1, letterSpacing: '-0.05em',
            textShadow: '0 0 20px rgba(100,100,255,0.4)',
          }}>
            {telemetry ? telemetry.gear : '—'}
          </div>
          <div style={{ fontSize: 8, color: '#445', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Gear</div>
        </div>

        {/* ── Centre: SVG circuit map ── */}
        <div style={{ flex: 1, position: 'relative', background: '#0a0a14', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <svg
            viewBox={viewBox}
            width="100%"
            height="100%"
            style={{ display: 'block' }}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="tv-carGlow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <filter id="tv-trackShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="8" floodColor="#000000" floodOpacity="0.9" />
              </filter>
            </defs>

            {/* Layer 1 — shadow */}
            <path d={d} fill="none" stroke="rgba(0,0,0,0.5)" strokeWidth="32"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round"
              filter="url(#tv-trackShadow)" />

            {/* Layer 2 — edge (more visible) */}
            <path d={d} fill="none" stroke="#4a4a60" strokeWidth="20"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

            {/* Layer 3 — asphalt */}
            <path ref={pathRef} d={d} fill="none" stroke="#252533" strokeWidth="12"
              vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />

            {/* Layer 4 — speed heatmap */}
            {heatmap.map((seg, i) => (
              <line key={i}
                x1={seg.x1} y1={seg.y1} x2={seg.x2} y2={seg.y2}
                stroke={seg.color} strokeWidth="5" strokeOpacity="0.88"
                vectorEffect="non-scaling-stroke" strokeLinecap="round" />
            ))}

            {/* Layer 5 — centre line */}
            <path d={d} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1"
              strokeDasharray="10 18" vectorEffect="non-scaling-stroke"
              strokeLinejoin="round" strokeLinecap="round" />

            {/* S/F line */}
            <line x1={sfX} y1={sfY - u} x2={sfX} y2={sfY + u}
              stroke="rgba(255,255,255,0.9)" strokeWidth={u * 0.28}
              strokeLinecap="round" vectorEffect="non-scaling-stroke" />

            {/* Car glow */}
            {dotPos && (
              <circle cx={dotPos.x} cy={dotPos.y} r={u * 1.8}
                fill={dotColor} fillOpacity="0.20" filter="url(#tv-carGlow)" />
            )}
            {/* Car dot */}
            {dotPos && (
              <circle cx={dotPos.x} cy={dotPos.y} r={u * 0.75}
                fill={dotColor} stroke="rgba(255,255,255,0.9)" strokeWidth={u * 0.15}
                vectorEffect="non-scaling-stroke" />
            )}
          </svg>

          {/* Speed legend — bottom right */}
          <div style={{ position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
              {result.minCornerKph.toFixed(0)}
            </span>
            <div style={{
              width: 56, height: 4, borderRadius: 2,
              background: 'linear-gradient(to right, hsl(0,90%,58%), hsl(50,90%,58%), hsl(200,90%,58%))',
            }} />
            <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' }}>
              {result.maxSpeedKph.toFixed(0)} km/h
            </span>
          </div>

          {/* Lap time — bottom left */}
          <div style={{ position: 'absolute', bottom: 14, left: 14 }}>
            <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.2)' }}>
              {Math.floor(result.totalTimeSec / 60)}:{(result.totalTimeSec % 60).toFixed(1).padStart(4, '0')}
            </span>
          </div>
        </div>

        {/* ── Right panel: RPM + G-meter + Tyre temps ── */}
        <div style={{
          width: 170, flexShrink: 0,
          background: '#0d0d1a', borderLeft: '1px solid #1a1a28',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 10, padding: '12px 8px',
        }}>
          <div style={{ fontSize: 8, color: '#445', textTransform: 'uppercase', letterSpacing: '0.1em' }}>RPM</div>
          <RpmGauge
            rpm={telemetry?.rpm ?? 0}
            peakRpm={params.enginePeakRpm}
            redlineRpm={params.engineRedlineRpm}
          />
          <GMeter accelG={telemetry ? Math.max(-1.5, Math.min(1.0, telemetry.accelG)) : 0} />
          <TyreTempGrid
            tempC={telemetry?.tyreTempC ?? params.tyreTempCurrentC}
            optC={params.tyreOptTempC}
            halfWidthC={params.tyreTempHalfWidthC}
          />
        </div>

      </div>
    </div>
  );
}
