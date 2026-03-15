/**
 * Lap time estimator — Stage 7.
 *
 * Point-mass simulation over a track defined as a sequence of corner + straight
 * segments. Uses the vehicle's current Pacejka + aero + suspension parameters.
 *
 * Algorithm per segment:
 *  Corner : V_max = iterative solve √(μ_eff × g × R) with aero grip boost
 *  Straight: forward Euler integration (dt = 0.005 s) from V_entry to V_exit
 *            under F_drive(V) − F_drag(V), bounded by braking decel to V_next_corner
 *
 * Braking zone: analytically estimated distance d = V²/(2 × a_brake),
 * then straight time is subdivided into accel and coast/brake phases.
 *
 * Reference: Milliken & Milliken RCVD App.B (Simple Lap Simulation)
 */

const G       = 9.81;
const RHO_AIR = 1.225;   // kg/m³

// ── Track definition ─────────────────────────────────────────────────────────

export interface TrackSegment {
  type:   'corner' | 'straight';
  length: number;   // m — arc length for corners, distance for straights
  radius?: number;  // m — corners only
}

export interface TrackLayout {
  name:     string;
  segments: TrackSegment[];
}

export const TRACK_PRESETS: Record<string, TrackLayout> = {
  club: {
    name: 'Club circuit (~1.9 km)',
    segments: [
      { type: 'corner',   length: 63,  radius: 20  },  // hairpin
      { type: 'straight', length: 300              },
      { type: 'corner',   length: 94,  radius: 60  },  // chicane exit
      { type: 'straight', length: 150              },
      { type: 'corner',   length: 126, radius: 80  },  // medium
      { type: 'straight', length: 400              },  // main straight
      { type: 'corner',   length: 157, radius: 100 },  // fast sweeper
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 94,  radius: 60  },
      { type: 'straight', length: 250              },
      { type: 'corner',   length: 47,  radius: 30  },  // tight
      { type: 'straight', length: 200              },
    ],
  },
  karting: {
    name: 'Karting circuit (~1.0 km)',
    segments: [
      { type: 'corner',   length: 47,  radius: 15  },  // hairpin
      { type: 'straight', length: 150              },
      { type: 'corner',   length: 63,  radius: 20  },
      { type: 'straight', length: 80               },
      { type: 'corner',   length: 79,  radius: 25  },
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 50,  radius: 16  },
      { type: 'straight', length: 120              },
      { type: 'corner',   length: 50,  radius: 20  },
      { type: 'straight', length: 100              },
      { type: 'corner',   length: 47,  radius: 15  },
      { type: 'straight', length: 50               },
    ],
  },
  gt_circuit: {
    name: 'GT circuit (~3.2 km)',
    segments: [
      { type: 'straight', length: 600              },  // main straight
      { type: 'corner',   length: 94,  radius: 60  },  // hairpin
      { type: 'straight', length: 300              },
      { type: 'corner',   length: 157, radius: 100 },
      { type: 'straight', length: 250              },
      { type: 'corner',   length: 251, radius: 160 },  // fast
      { type: 'straight', length: 400              },
      { type: 'corner',   length: 314, radius: 200 },  // fast sweeper
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 126, radius: 80  },
      { type: 'straight', length: 350              },
      { type: 'corner',   length: 94,  radius: 30  },
      { type: 'straight', length: 400              },
    ],
  },
  formula_test: {
    name: 'Formula test track (~2.1 km)',
    segments: [
      { type: 'corner',   length: 47,  radius: 15  },  // hairpin
      { type: 'straight', length: 500              },
      { type: 'corner',   length: 94,  radius: 60  },
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 157, radius: 100 },
      { type: 'straight', length: 300              },
      { type: 'corner',   length: 251, radius: 160 },
      { type: 'straight', length: 250              },
      { type: 'corner',   length: 94,  radius: 60  },
      { type: 'straight', length: 200              },
      { type: 'corner',   length: 63,  radius: 20  },
      { type: 'straight', length: 200              },
    ],
  },
};

// ── Vehicle capability inputs ─────────────────────────────────────────────────

export interface LapSimInput {
  mass:              number;   // kg
  peakMu:            number;   // tyre peak friction coeff
  enginePowerKW:     number;   // kW
  brakingCapG:       number;   // g, max deceleration capability (typically 1.0–1.5)
  aeroCL:            number;
  aeroCD:            number;
  aeroReferenceArea: number;   // m²
  dragForce: (V: number) => number;  // pre-bound drag fn
}

// ── Per-segment and lap result ────────────────────────────────────────────────

export interface SegmentResult {
  type:          'corner' | 'straight';
  length:        number;
  timeSec:       number;
  entrySpeedKph: number;
  exitSpeedKph:  number;
  minSpeedKph:   number;
  maxSpeedKph:   number;
  label:         string;
}

export interface LapResult {
  totalTimeSec:   number;
  totalLengthM:   number;
  avgSpeedKph:    number;
  maxSpeedKph:    number;
  minCornerKph:   number;
  segments:       SegmentResult[];
}

// ── Physics helpers ───────────────────────────────────────────────────────────

/** Max cornering speed at radius R, accounting for aero downforce (iterative). */
function maxCornerSpeed(R: number, inp: LapSimInput): number {
  const { mass, peakMu, aeroCL, aeroReferenceArea: A } = inp;
  let V = Math.sqrt(peakMu * G * R);  // initial guess (no aero)
  for (let i = 0; i < 10; i++) {
    const downforce = 0.5 * RHO_AIR * V * V * A * aeroCL;
    const muEff = peakMu * (mass * G + downforce) / (mass * G);
    V = Math.sqrt(muEff * G * R);
  }
  return V;
}

/** Drive force at speed V from peak power (P/V curve). */
function driveForce(V: number, powerKW: number, mass: number): number {
  const vSafe = Math.max(V, 1);
  return Math.min((powerKW * 1000) / vSafe, mass * G * 1.0);  // cap at 1g traction
}

/** Brake deceleration at speed V, accounting for aero (aerodynamic braking boost). */
function brakeDecel(V: number, inp: LapSimInput): number {
  const { mass, brakingCapG, aeroCL, aeroReferenceArea: A } = inp;
  const downforce = 0.5 * RHO_AIR * V * V * A * aeroCL;
  // More downforce → more brake force available (friction limit rises)
  const aeroBoost = downforce * inp.peakMu;
  return inp.brakingCapG * G + aeroBoost / mass;
}

/** Straight integration: returns time and speed profile from V0 to the segment end,
 *  limiting to V_target_exit at the end (braking zone) and V_max_straight. */
function simulateStraight(
  length: number,
  V_entry: number,
  V_exit_target: number,
  inp: LapSimInput,
): { timeSec: number; vMax: number; vExit: number } {
  const DT = 0.005;   // s, Euler step

  // Backward pass: compute braking requirement from exit end
  // Braking distance from V_entry to V_exit_target:
  // Use simplified: d_brake ≈ V²/(2a) differential, numerical
  // Forward Euler is fine for 5ms steps.

  let V = V_entry;
  let x = 0;
  let t = 0;
  let vMax = V;

  while (x < length) {
    const Fdrive   = driveForce(V, inp.enginePowerKW, inp.mass);
    const Fdrag    = inp.dragForce(V);
    const a_drive  = (Fdrive - Fdrag) / inp.mass;

    // Check if we need to start braking to hit V_exit_target
    const dist_remaining = length - x;
    const a_brake        = brakeDecel(V, inp);
    // Braking distance from current V to V_exit_target
    const d_brake_needed = (V * V - V_exit_target * V_exit_target) / (2 * a_brake);
    const shouldBrake    = d_brake_needed >= dist_remaining && V > V_exit_target;

    let a: number;
    if (shouldBrake) {
      a = -a_brake;
    } else {
      a = a_drive;
    }

    V += a * DT;
    V  = Math.max(V, 0.5);  // never stop
    x += V * DT;
    t += DT;
    if (V > vMax) vMax = V;
  }

  return { timeSec: t, vMax, vExit: Math.max(V, V_exit_target * 0.95) };
}

// ── Main lap time function ────────────────────────────────────────────────────

export function computeLapTime(layout: TrackLayout, inp: LapSimInput): LapResult {
  const { segments } = layout;
  const n = segments.length;

  // Pre-compute max corner speed for each corner segment
  const vCorner: number[] = segments.map(seg =>
    seg.type === 'corner' && seg.radius ? maxCornerSpeed(seg.radius, inp) : Infinity
  );

  // Build speed profile: corner entry = corner exit = vCorner
  const segResults: SegmentResult[] = [];
  let totalTime = 0;
  let vPrev = vCorner.find(v => isFinite(v)) ?? 20;  // start at first corner speed

  for (let i = 0; i < n; i++) {
    const seg = segments[i];

    if (seg.type === 'corner' && seg.radius) {
      const vC = vCorner[i];
      const t  = seg.length / vC;
      totalTime += t;
      segResults.push({
        type: 'corner', length: seg.length, timeSec: t,
        entrySpeedKph: vC * 3.6, exitSpeedKph: vC * 3.6,
        minSpeedKph: vC * 3.6, maxSpeedKph: vC * 3.6,
        label: `R${seg.radius}m`,
      });
      vPrev = vC;

    } else if (seg.type === 'straight') {
      // Exit target = speed of next corner
      const nextCornerIdx = ((i + 1) % n);
      const vNextCorner   = vCorner[nextCornerIdx];
      const vExitTarget   = isFinite(vNextCorner) ? vNextCorner : vPrev;

      const { timeSec, vMax, vExit } = simulateStraight(seg.length, vPrev, vExitTarget, inp);
      totalTime += timeSec;
      segResults.push({
        type: 'straight', length: seg.length, timeSec,
        entrySpeedKph: vPrev * 3.6, exitSpeedKph: vExit * 3.6,
        minSpeedKph: Math.min(vPrev, vExit) * 3.6, maxSpeedKph: vMax * 3.6,
        label: `${seg.length}m straight`,
      });
      vPrev = vExitTarget;  // exit at corner speed
    }
  }

  const totalLength = segments.reduce((s, seg) => s + seg.length, 0);
  const avgSpeedKph  = (totalLength / totalTime) * 3.6;
  const maxSpeedKph  = Math.max(...segResults.map(s => s.maxSpeedKph));
  const minCornerKph = Math.min(...segResults.filter(s => s.type === 'corner').map(s => s.minSpeedKph));

  return { totalTimeSec: totalTime, totalLengthM: totalLength, avgSpeedKph, maxSpeedKph, minCornerKph, segments: segResults };
}
