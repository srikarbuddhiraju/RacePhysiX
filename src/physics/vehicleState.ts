/**
 * Vehicle state types for 14-state time-domain simulation — Stage 8.
 *
 * State vector: [x, y, ψ, Vx, Vy, ψ̇, φ, φ̇, ωFL, ωFR, ωRL, ωRR]
 * Convention:   x forward, y left, z up (right-hand).  Positive ψ̇ = left turn.
 */

/** 12-element state vector: body pose/velocity + roll + 4 wheel spins. */
export interface VehicleState {
  x:       number;   // m    — global X position
  y:       number;   // m    — global Y position
  psi:     number;   // rad  — heading angle (yaw, CCW positive)
  Vx:      number;   // m/s  — body-frame longitudinal velocity
  Vy:      number;   // m/s  — body-frame lateral velocity (y-left positive)
  psiDot:  number;   // rad/s — yaw rate (CCW positive)
  phi:     number;   // rad  — roll angle (roll right positive)
  phiDot:  number;   // rad/s — roll rate
  omegaFL: number;   // rad/s — front-left wheel spin
  omegaFR: number;   // rad/s — front-right wheel spin
  omegaRL: number;   // rad/s — rear-left wheel spin
  omegaRR: number;   // rad/s — rear-right wheel spin
}

/** Driver inputs at a given time step. */
export interface SimInput {
  steerAngle: number;  // rad — front-wheel steer angle (positive = left turn)
  throttle:   number;  // 0–1 — fraction of full throttle
  brake:      number;  // 0–1 — fraction of maximum brake torque
}

/** Per-step output record (decimated to every DECIMATE-th step). */
export interface SimResult {
  t:         number;
  state:     VehicleState;
  ax:        number;   // m/s² — longitudinal acceleration (body frame)
  ay:        number;   // m/s² — lateral acceleration (body frame)
  slipAngle: [number, number, number, number];  // rad — FL, FR, RL, RR
  Fz:        [number, number, number, number];  // N   — FL, FR, RL, RR
  Fy:        [number, number, number, number];  // N   — FL, FR, RL, RR
  slipRatio: [number, number, number, number];  // κ   — FL, FR, RL, RR
}
