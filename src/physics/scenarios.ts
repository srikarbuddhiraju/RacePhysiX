/**
 * ISO test scenario definitions for Stage 8 time-domain simulation.
 *
 * Scenarios:
 *   step_steer    — ISO 7401: step steer at constant speed, measures transient yaw response
 *   sine_sweep    — ISO 13674: linear chirp 0.2→4.0 Hz to map frequency response
 *   brake_in_turn — steady cornering then brake ramp, measures stability under combined loads
 *
 * inputAt() defines the driver inputs as a function of time only — no state feedback
 * (open-loop manoeuvres, as required by the ISO standards).
 */

import type { VehicleState, SimInput } from './vehicleState';
import type { VehicleParams }          from './types';

// Loaded tyre radius for 205/55R16 equivalent — matches dynamics14dof constant
const R_TIRE = 0.315; // m

export interface ScenarioDef {
  id:           'step_steer' | 'sine_sweep' | 'brake_in_turn';
  name:         string;
  duration:     number;  // s
  /** Build an initial state: vehicle moving straight at params.speedKph. */
  initialState: (params: VehicleParams) => VehicleState;
  /** Open-loop input schedule (no state feedback). */
  inputAt:      (t: number, params: VehicleParams) => SimInput;
}

/** Vehicle travelling straight at params.speedKph with wheels rolling freely. */
function straightState(params: VehicleParams): VehicleState {
  const Vx = params.speedKph / 3.6;
  const omega0 = Vx / R_TIRE;
  return {
    x: 0, y: 0, psi: 0,
    Vx, Vy: 0, psiDot: 0,
    phi: 0, phiDot: 0,
    omegaFL: omega0, omegaFR: omega0,
    omegaRL: omega0, omegaRR: omega0,
  };
}

export const SCENARIOS: ScenarioDef[] = [

  // ── Step Steer ─────────────────────────────────────────────────────────────
  // δ = 0 for t < 1 s, then instantaneously step to δ_max = L / R (geometric).
  // Throttle held at 30% throughout.  Measures yaw rate rise time and overshoot.
  {
    id:       'step_steer',
    name:     'Step Steer',
    duration: 5,
    initialState: straightState,
    inputAt: (t, params) => ({
      steerAngle: t >= 1.0 ? params.wheelbase / params.turnRadius : 0,
      throttle:   0.3,
      brake:      0,
    }),
  },

  // ── Sine Sweep ─────────────────────────────────────────────────────────────
  // Linear chirp: instantaneous frequency f(t) = 0.2 + 3.8*(t/30) Hz
  //   → 0.2 Hz at t=0, 4.0 Hz at t=30 s.
  // Phase integral: φ(t) = 2π ∫₀ᵗ f(τ) dτ = 2π (0.2t + 3.8t²/60)
  // Amplitude = δ_max × 0.5 (half geometric steer angle).
  {
    id:       'sine_sweep',
    name:     'Sine Sweep',
    duration: 30,
    initialState: straightState,
    inputAt: (t, params) => {
      const deltaMax = params.wheelbase / params.turnRadius;
      const A     = deltaMax * 0.5;
      const phase = 2 * Math.PI * (0.2 * t + 3.8 * t * t / 60);
      return {
        steerAngle: A * Math.sin(phase),
        throttle:   0.3,
        brake:      0,
      };
    },
  },

  // ── Brake-in-Turn ──────────────────────────────────────────────────────────
  // t < 2 s : steady cornering (full δ_max, 30% throttle).
  // t ≥ 2 s : steer held, throttle zeroed, brake ramps 0→0.6 over 0.1 s.
  // Tests combined longitudinal + lateral load — measures yaw stability under braking.
  {
    id:       'brake_in_turn',
    name:     'Brake-in-Turn',
    duration: 7,
    initialState: straightState,
    inputAt: (t, params) => {
      const deltaMax = params.wheelbase / params.turnRadius;
      const brake    = t < 2.0 ? 0 : Math.min((t - 2.0) / 0.1, 0.6);
      return {
        steerAngle: deltaMax,
        throttle:   t < 2.0 ? 0.3 : 0,
        brake,
      };
    },
  },
];
