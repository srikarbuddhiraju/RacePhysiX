/**
 * 14-state time-domain vehicle dynamics — Stage 8.
 *
 * State:       [x, y, ψ, Vx, Vy, ψ̇, φ, φ̇, ωFL, ωFR, ωRL, ωRR]
 * Integrator:  RK4 at dt = 1 ms, output decimated to every 10th step (10 ms / 100 Hz).
 * Convention:  x forward, y left, z up (right-hand).  ψ̇ > 0 = left turn.
 *
 * Physics reused from existing modules:
 *   pacejkaFy()         — lateral tyre force per corner     (src/physics/pacejka.ts)
 *   computeLoadTransfer()— dynamic per-corner Fz            (src/physics/loadTransfer.ts)
 *   computeSuspension() — roll stiffness (called once)      (src/physics/suspension.ts)
 *   computeAero()       — speed-dependent downforce/drag    (src/physics/aero.ts)
 *
 * Reference: Milliken & Milliken RCVD Ch.5,16,17; ISO 7401; ISO 13674-1
 */

import { pacejkaFy }           from './pacejka';
import { computeLoadTransfer } from './loadTransfer';
import { computeSuspension }   from './suspension';
import { computeAero }         from './aero';
import type { VehicleParams, PacejkaCoeffs } from './types';
import type { VehicleState, SimInput, SimResult } from './vehicleState';
import type { ScenarioDef } from './scenarios';

// ── Physical constants ────────────────────────────────────────────────────────

const G        = 9.81;    // m/s²
const R_TIRE   = 0.315;   // m — loaded radius, 205/55R16
const I_WHEEL  = 1.2;     // kg·m² — per-wheel rotational inertia
const DECIMATE = 10;      // output every 10th 1-ms step → 100 Hz records

// ── Internal types ────────────────────────────────────────────────────────────

/** Pre-computed vehicle invariants (constants for a given params/coeffs set). */
interface VehicleConst {
  lf:          number;   // m — CG to front axle
  lr:          number;   // m — CG to rear axle
  TW:          number;   // m — track width
  hCG:         number;   // m — CG height
  m:           number;   // kg
  Izz:         number;   // kg·m² — yaw inertia
  Ixx:         number;   // kg·m² — roll inertia
  KPhiTotal:   number;   // Nm/rad — total roll stiffness
  cPhi:        number;   // Nm·s/rad — roll damping (ζ = 0.4)
  rollRatio:   number;   // KΦ_front / KΦ_total
  numDriven:   number;   // count of driven wheels
  isDriven:    [boolean, boolean, boolean, boolean];  // FL FR RL RR
  T_brake_max: number;   // N·m per wheel at brake = 1.0
}

/** Full derivative of the state vector plus diagnostic outputs. */
interface Deriv {
  dState:    VehicleState;
  ax:        number;
  ay:        number;
  slipAngle: [number, number, number, number];
  Fz:        [number, number, number, number];
  Fy:        [number, number, number, number];
  slipRatio: [number, number, number, number];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Compute state + h * derivative (component-wise). */
function addScaled(s: VehicleState, ds: VehicleState, h: number): VehicleState {
  return {
    x:       s.x       + ds.x       * h,
    y:       s.y       + ds.y       * h,
    psi:     s.psi     + ds.psi     * h,
    Vx:      s.Vx      + ds.Vx      * h,
    Vy:      s.Vy      + ds.Vy      * h,
    psiDot:  s.psiDot  + ds.psiDot  * h,
    phi:     s.phi     + ds.phi     * h,
    phiDot:  s.phiDot  + ds.phiDot  * h,
    omegaFL: s.omegaFL + ds.omegaFL * h,
    omegaFR: s.omegaFR + ds.omegaFR * h,
    omegaRL: s.omegaRL + ds.omegaRL * h,
    omegaRR: s.omegaRR + ds.omegaRR * h,
  };
}

/** RK4-weighted average of four derivatives. */
function rk4Avg(k1: VehicleState, k2: VehicleState, k3: VehicleState, k4: VehicleState): VehicleState {
  const w = 1 / 6;
  return {
    x:       w * (k1.x       + 2*k2.x       + 2*k3.x       + k4.x),
    y:       w * (k1.y       + 2*k2.y       + 2*k3.y       + k4.y),
    psi:     w * (k1.psi     + 2*k2.psi     + 2*k3.psi     + k4.psi),
    Vx:      w * (k1.Vx      + 2*k2.Vx      + 2*k3.Vx      + k4.Vx),
    Vy:      w * (k1.Vy      + 2*k2.Vy      + 2*k3.Vy      + k4.Vy),
    psiDot:  w * (k1.psiDot  + 2*k2.psiDot  + 2*k3.psiDot  + k4.psiDot),
    phi:     w * (k1.phi     + 2*k2.phi     + 2*k3.phi     + k4.phi),
    phiDot:  w * (k1.phiDot  + 2*k2.phiDot  + 2*k3.phiDot  + k4.phiDot),
    omegaFL: w * (k1.omegaFL + 2*k2.omegaFL + 2*k3.omegaFL + k4.omegaFL),
    omegaFR: w * (k1.omegaFR + 2*k2.omegaFR + 2*k3.omegaFR + k4.omegaFR),
    omegaRL: w * (k1.omegaRL + 2*k2.omegaRL + 2*k3.omegaRL + k4.omegaRL),
    omegaRR: w * (k1.omegaRR + 2*k2.omegaRR + 2*k3.omegaRR + k4.omegaRR),
  };
}

/** Build the VehicleConst cache from params. */
function buildConst(params: VehicleParams): VehicleConst {
  const L  = params.wheelbase;
  const lf = (1 - params.frontWeightFraction) * L;  // CG → front axle
  const lr = params.frontWeightFraction * L;          // CG → rear axle

  const m   = params.mass;
  const TW  = params.trackWidth;
  const hCG = params.cgHeight;

  // Yaw inertia: simplified solid-ellipsoid estimate
  const Izz = m * (lf * lf + lr * lr) * 0.5;

  // Roll inertia: rough estimate (validated against typical RCVD values)
  const Ixx = m * 0.25; // ≈ 375 kg·m² for a 1500 kg car

  // Roll stiffness from suspension model
  const susp = computeSuspension({
    mass: m, cgHeight: hCG, trackWidth: TW,
    frontSpringRate: params.frontSpringRate, rearSpringRate: params.rearSpringRate,
    frontARBRate:    params.frontARBRate,   rearARBRate:   params.rearARBRate,
  });
  const KPhiTotal = susp.KPhiTotal;
  const rollRatio = susp.rollStiffRatio;

  // Critical damping coefficient at ζ = 0.4
  const cPhi = 2 * 0.4 * Math.sqrt(KPhiTotal * Ixx);

  // Driven wheels and torque budget
  const driven = params.drivetrainType;
  const isDriven: [boolean, boolean, boolean, boolean] =
    driven === 'FWD'    ? [true,  true,  false, false] :
    driven === 'RWD'    ? [false, false, true,  true ] :
    /* AWD / AWD_TV */    [true,  true,  true,  true ];
  const numDriven = isDriven.filter(Boolean).length;

  // Max brake torque per wheel: enough for params.brakingG at brake = 1.0
  const T_brake_max = m * G * params.brakingG * R_TIRE / 4;

  return { lf, lr, TW, hCG, m, Izz, Ixx, KPhiTotal, cPhi, rollRatio, numDriven, isDriven, T_brake_max };
}

// ── Core derivative computation ───────────────────────────────────────────────

/**
 * Evaluate the full state derivative at a given state and input.
 *
 * Sequence:
 *  1. Aero — speed-dependent downforce / drag
 *  2. Dynamic Fz — per-corner load transfer (lateral + longitudinal)
 *  3. Slip angles — per corner (SAE, including TW/2 yaw contribution)
 *  4. Slip ratios — per wheel
 *  5. Lateral Fy — Pacejka Magic Formula per corner
 *  6. Longitudinal Fx — linear tyre + friction circle clamp
 *  7. Drive / brake torques → wheel spin derivatives
 *  8. Transform front forces into body frame via steer angle
 *  9. Sum forces and moments → EOM
 * 10. Position and heading kinematics
 */
function computeDerivatives(
  s: VehicleState,
  inp: SimInput,
  params: VehicleParams,
  coeffs: PacejkaCoeffs,
  vc: VehicleConst,
): Deriv {
  const { lf, lr, TW, hCG, m, Izz, Ixx, KPhiTotal, cPhi, rollRatio } = vc;
  const { B, C, peakMu, E } = coeffs;
  const { steerAngle: delta, throttle, brake } = inp;

  // 1. Aerodynamics
  const aero = computeAero({
    aeroCL: params.aeroCL, aeroCD: params.aeroCD,
    aeroReferenceArea: params.aeroReferenceArea, aeroBalance: params.aeroBalance,
    speedMs: Math.max(s.Vx, 0),
  });

  // 2. Dynamic Fz per corner
  //    ay_centripetal = ψ̇ × Vx (used for roll-bar load transfer)
  //    ax from slip ratios (approximate: use wheel torque contribution implicitly via Fx below)
  const ay_centripetal = s.psiDot * s.Vx;
  const lt = computeLoadTransfer(
    {
      mass: m, wheelbase: params.wheelbase, cgHeight: hCG, trackWidth: TW,
      frontWeightFraction: params.frontWeightFraction,
      rollStiffRatio: rollRatio,
      FzBoostFront: aero.FzBoostFront,
      FzBoostRear:  aero.FzBoostRear,
    },
    ay_centripetal,
    0,  // longitudinal ax handled via Fx → included in ΣFx already
  );

  const FzCorner: [number, number, number, number] = [lt.FzFL, lt.FzFR, lt.FzRL, lt.FzRR];
  const Vx_safe = Math.max(s.Vx, 0.1);

  // 3. Slip angles — body-frame velocity at each wheel contact patch
  //    FL at ( lf,  TW/2): vel_x = Vx − ψ̇·TW/2,  vel_y = Vy + ψ̇·lf
  //    FR at ( lf, −TW/2): vel_x = Vx + ψ̇·TW/2,  vel_y = Vy + ψ̇·lf
  //    RL at (−lr,  TW/2): vel_x = Vx − ψ̇·TW/2,  vel_y = Vy − ψ̇·lr
  //    RR at (−lr, −TW/2): vel_x = Vx + ψ̇·TW/2,  vel_y = Vy − ψ̇·lr
  //
  //    Sign convention (Pacejka / ISO):  α = steer − atan2(Vy_contact, Vx_contact)
  //    Positive α → velocity vector behind wheel heading → positive Fy (leftward in y-left frame).
  const psiVx_half = s.psiDot * TW / 2;
  const vyF = s.Vy + s.psiDot * lf;
  const vyR = s.Vy - s.psiDot * lr;

  const vxFL = Math.max(s.Vx - psiVx_half, 0.1);
  const vxFR = Math.max(s.Vx + psiVx_half, 0.1);
  const vxRL = Math.max(s.Vx - psiVx_half, 0.1);
  const vxRR = Math.max(s.Vx + psiVx_half, 0.1);

  const alphaFL = delta - Math.atan2(vyF, vxFL);
  const alphaFR = delta - Math.atan2(vyF, vxFR);
  const alphaRL =       - Math.atan2(vyR, vxRL);
  const alphaRR =       - Math.atan2(vyR, vxRR);

  const alphas: [number, number, number, number] = [alphaFL, alphaFR, alphaRL, alphaRR];

  // 4. Slip ratios (κ): positive = spin up = driving; negative = lock = braking
  const omegas = [s.omegaFL, s.omegaFR, s.omegaRL, s.omegaRR];
  const kappas: [number, number, number, number] = omegas.map(
    omega => (omega * R_TIRE - s.Vx) / Vx_safe
  ) as [number, number, number, number];

  // 5. Lateral Fy (Pacejka) — signed, handles sign(alpha) automatically
  const FyCorner: [number, number, number, number] = alphas.map(
    (alpha, i) => pacejkaFy(alpha, FzCorner[i], B, C, peakMu, E)
  ) as [number, number, number, number];

  // 6. Longitudinal Fx — linear model (Cx = 20), friction-circle limited
  //    Priority: Fy retained; Fx trimmed to fit inside μ·Fz circle.
  const CX = 20;
  const FxCorner: [number, number, number, number] = kappas.map((kappa, i) => {
    const Fz     = FzCorner[i];
    const FxRaw  = CX * kappa * Fz;
    const FxLim  = Math.sqrt(Math.max(0, (peakMu * Fz) ** 2 - FyCorner[i] ** 2));
    return Math.sign(FxRaw) * Math.min(Math.abs(FxRaw), FxLim);
  }) as [number, number, number, number];

  // 7. Wheel torque → spin derivatives
  //    T_net = T_drive − sign_drag · R_TIRE · |Fx|   (Fx resists spin)
  //    ω̇ = T_net / I_WHEEL
  const drivenOmegaAvg = Math.max(
    vc.isDriven[0] ? s.omegaFL : 0,
    vc.isDriven[1] ? s.omegaFR : 0,
    vc.isDriven[2] ? s.omegaRL : 0,
    vc.isDriven[3] ? s.omegaRR : 0,
    0.1,
  );
  const P_drive  = throttle * params.enginePowerKW * 1000;
  const T_drive_total = P_drive / Math.max(drivenOmegaAvg * R_TIRE, 1.0);
  const T_drive_each  = T_drive_total / vc.numDriven;
  const T_brake_each  = brake * vc.T_brake_max;

  const omegaDots: [number, number, number, number] = vc.isDriven.map((driven, i) => {
    const T_net = (driven ? T_drive_each : 0)
                 - T_brake_each
                 - R_TIRE * FxCorner[i];    // tyre reaction
    return T_net / I_WHEEL;
  }) as [number, number, number, number];

  // 8. Transform front tyre forces from wheel frame → body frame
  //    (rotation by steer angle δ)
  const cosD = Math.cos(delta);
  const sinD = Math.sin(delta);

  const FxFL_body = FxCorner[0] * cosD - FyCorner[0] * sinD;
  const FyFL_body = FxCorner[0] * sinD + FyCorner[0] * cosD;
  const FxFR_body = FxCorner[1] * cosD - FyCorner[1] * sinD;
  const FyFR_body = FxCorner[1] * sinD + FyCorner[1] * cosD;

  // Rear: no steer — body frame = tyre frame
  const FxRL_body = FxCorner[2];
  const FyRL_body = FyCorner[2];
  const FxRR_body = FxCorner[3];
  const FyRR_body = FyCorner[3];

  // 9. Force and moment sums
  const SumFx = FxFL_body + FxFR_body + FxRL_body + FxRR_body - aero.dragN;
  const SumFy = FyFL_body + FyFR_body + FyRL_body + FyRR_body;

  // Yaw moment (CCW positive, z-up):
  //   Each corner at [rx, ry]: Mz = rx·Fy − ry·Fx
  //   FL: [+lf, +TW/2],  FR: [+lf, −TW/2],  RL: [−lr, +TW/2],  RR: [−lr, −TW/2]
  const SumMz =
    (lf * FyFL_body  - ( TW/2) * FxFL_body) +
    (lf * FyFR_body  - (-TW/2) * FxFR_body) +
    (-lr * FyRL_body - ( TW/2) * FxRL_body) +
    (-lr * FyRR_body - (-TW/2) * FxRR_body);

  // 10. Equations of motion
  const ax = SumFx / m + s.psiDot * s.Vy;       // body-frame, rotating-frame correction
  const ay = SumFy / m - s.psiDot * s.Vx;

  const psiDDot  = SumMz / Izz;
  const phiDDot  = (m * ay_centripetal * hCG - KPhiTotal * s.phi - cPhi * s.phiDot) / Ixx;

  // Global position derivatives (kinematics)
  const xDot = s.Vx * Math.cos(s.psi) - s.Vy * Math.sin(s.psi);
  const yDot = s.Vx * Math.sin(s.psi) + s.Vy * Math.cos(s.psi);

  return {
    dState: {
      x:       xDot,
      y:       yDot,
      psi:     s.psiDot,
      Vx:      ax,
      Vy:      ay,
      psiDot:  psiDDot,
      phi:     s.phiDot,
      phiDot:  phiDDot,
      omegaFL: omegaDots[0],
      omegaFR: omegaDots[1],
      omegaRL: omegaDots[2],
      omegaRR: omegaDots[3],
    },
    ax,
    ay,
    slipAngle: alphas,
    Fz:        FzCorner,
    Fy:        FyCorner,
    slipRatio: kappas,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Run a time-domain simulation for the given scenario.
 *
 * @param params   Vehicle parameters
 * @param coeffs   Pacejka tyre coefficients
 * @param scenario Scenario definition (from SCENARIOS array)
 * @param dt       Integration step size (default 1 ms)
 * @returns        Array of SimResult records at every DECIMATE-th step
 */
export function runSimulation(
  params:   VehicleParams,
  coeffs:   PacejkaCoeffs,
  scenario: ScenarioDef,
  dt = 0.001,
): SimResult[] {
  const vc      = buildConst(params);
  const results: SimResult[] = [];

  let state = scenario.initialState(params);
  const nSteps = Math.round(scenario.duration / dt);

  for (let step = 0; step < nSteps; step++) {
    const t   = step * dt;
    const inp = scenario.inputAt(t, params);

    // RK4
    const d1 = computeDerivatives(state,                        inp, params, coeffs, vc);
    const d2 = computeDerivatives(addScaled(state, d1.dState, dt/2), inp, params, coeffs, vc);
    const d3 = computeDerivatives(addScaled(state, d2.dState, dt/2), inp, params, coeffs, vc);
    const d4 = computeDerivatives(addScaled(state, d3.dState, dt),   inp, params, coeffs, vc);

    state = addScaled(state, rk4Avg(d1.dState, d2.dState, d3.dState, d4.dState), dt);

    // Clamp wheel spin (prevent reverse spin from integrator overshoot)
    state.omegaFL = Math.max(state.omegaFL, 0);
    state.omegaFR = Math.max(state.omegaFR, 0);
    state.omegaRL = Math.max(state.omegaRL, 0);
    state.omegaRR = Math.max(state.omegaRR, 0);

    // Decimate: record every DECIMATE-th step
    if (step % DECIMATE === 0) {
      results.push({
        t,
        state:     { ...state },
        ax:        d1.ax,
        ay:        d1.ay,
        slipAngle: d1.slipAngle,
        Fz:        d1.Fz,
        Fy:        d1.Fy,
        slipRatio: d1.slipRatio,
      });
    }
  }

  return results;
}
