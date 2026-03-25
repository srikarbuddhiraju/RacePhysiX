/**
 * Pacejka Magic Formula — lateral + longitudinal + MF-Swift combined slip.
 *
 * Stage 40 additions:
 *  - pacejkaFx: longitudinal Pacejka (κ → Fx), fixed coefficients Bx=12, Cx=1.65, Ex=−0.80
 *  - combinedSlipGky: proper Pacejka '96 Fy reduction from longitudinal slip κ (Pacejka §4.3.2)
 *  - combinedSlipGxa: proper Pacejka '96 Fx reduction from lateral slip α
 *  - solveSlipAngleTyreAxle: Kamm circle replaced with Gky cosine reduction (more accurate shape)
 *
 * Reference: docs/physics-reference/tyre-pacejka.md §2, §7, §8
 *            Pacejka TVSB §4.2 (longitudinal), §4.3.2 (combined slip reduction functions)
 */

/**
 * Stage 9 — Load-sensitive peak friction.
 *
 * D = μ₀ × Fz × (1 − qFz × (Fz/Fz₀ − 1))
 *
 * Physics: rubber contact patch grows sub-linearly with Fz (Hertzian deformation),
 * so normalised grip Fy/Fz decreases as load rises.
 * Reference: Pacejka TVSB §4.2.2; RCVD §2.3.
 *
 * @param Fz   Current tyre load [N]
 * @param Fz0  Nominal tyre load [N] (= mass × g / 4 for a symmetric car at rest)
 * @param mu0  Peak friction coefficient at Fz0
 * @param qFz  Load sensitivity factor (0 = off, 0.10 = typical road, 0.20 = high sensitivity)
 */
export function loadSensitiveMu(Fz: number, Fz0: number, mu0: number, qFz: number): number {
  if (qFz === 0 || Fz0 <= 0) return mu0;
  return mu0 * Math.max(1 - qFz * (Fz / Fz0 - 1), 0.1);
}

/**
 * Compute Pacejka lateral force Fy.
 *
 * @param alpha_rad  Slip angle [rad], signed — positive α gives positive Fy
 * @param Fz         Normal load [N], must be > 0
 * @param B          Stiffness factor [1/rad] — BCD equals the cornering stiffness Cα
 * @param C          Shape factor [-] — ~1.3 for lateral force
 * @param peakMu     Peak friction coefficient [-] — D = peakMu_eff × Fz
 * @param E          Curvature factor [-] — governs transition into saturation, typically < 0
 * @param qFz        Load sensitivity factor (Stage 9); 0 = off (default)
 * @param Fz0        Nominal load [N] for load sensitivity reference; ignored if qFz = 0
 * @returns          Lateral force [N], same sign as alpha
 */
export function pacejkaFy(
  alpha_rad: number,
  Fz: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
  qFz = 0,
  Fz0 = Fz,
): number {
  const muEff = loadSensitiveMu(Fz, Fz0, peakMu, qFz);
  const D  = muEff * Fz;
  const Bx = B * alpha_rad;
  return D * Math.sin(C * Math.atan(Bx - E * (Bx - Math.atan(Bx))));
}

/**
 * Stage 40 — Longitudinal Pacejka Magic Formula (Fx vs slip ratio κ).
 *
 * Uses fixed longitudinal coefficients per Pacejka §4.2 (typical passenger/racing tyre):
 *   Bx = 12.0  (longitudinal stiffness ≈ 2.5× lateral — builds force faster in κ)
 *   Cx = 1.65  (sharper peak, narrower than lateral C=1.30)
 *   Ex = −0.80 (softer post-peak drop than lateral)
 *
 * @param kappa    Slip ratio [-]; >0 = drive, <0 = brake
 * @param Fz       Normal load [N]
 * @param peakMu   Peak friction coefficient at Fz0
 * @param qFz      Load sensitivity (Stage 9); 0 = off
 * @param Fz0      Nominal load [N]
 * @returns        Longitudinal force [N], same sign as kappa
 */
export function pacejkaFx(
  kappa: number,
  Fz: number,
  peakMu: number,
  qFz = 0,
  Fz0 = Fz,
): number {
  const BX = 12.0;
  const CX = 1.65;
  const EX = -0.80;
  const muEff = loadSensitiveMu(Fz, Fz0, peakMu, qFz);
  const D  = muEff * Fz;
  const Bk = BX * kappa;
  return D * Math.sin(CX * Math.atan(Bk - EX * (Bk - Math.atan(Bk))));
}

/**
 * Stage 40 — MF-Swift combined-slip reduction of Fy due to longitudinal slip.
 *
 * Gκy(κ) = cos(Cκy × arctan(Bκy × κ))
 *
 * Constants: Bκy = 3.5, Cκy = 1.0 (Pacejka §4.3.2, typical passenger tyre)
 * Properties:
 *   κ = 0   → Gky = 1.00 (no reduction — pure lateral)
 *   κ = 0.1 → Gky ≈ 0.944 (light braking: ~6% Fy reduction)
 *   κ = 0.2 → Gky ≈ 0.819 (heavy braking: ~18% Fy reduction)
 *
 * Replaces the Kamm circle sqrt(1 − (Fx/Fxmax)²) which overestimates reduction
 * at moderate slip ratios.
 */
export function combinedSlipGky(kappa: number): number {
  const Bky = 3.5;
  const Cky = 1.0;
  return Math.cos(Cky * Math.atan(Bky * kappa));
}

/**
 * Stage 40 — MF-Swift combined-slip reduction of Fx due to lateral slip.
 *
 * Gxα(α) = cos(Cxα × arctan(Bxα × α))
 *
 * Constants: Bxα = 3.0, Cxα = 1.0 (Pacejka §4.3.2)
 * Properties:
 *   α = 0    → Gxa = 1.00 (no reduction — pure longitudinal)
 *   α = 5°   → Gxa ≈ 0.958 (~4% Fx reduction under light cornering)
 *   α = 10°  → Gxa ≈ 0.847 (~15% Fx reduction under heavy cornering)
 */
export function combinedSlipGxa(alpha_rad: number): number {
  const Bxa = 3.0;
  const Cxa = 1.0;
  return Math.cos(Cxa * Math.atan(Bxa * alpha_rad));
}

/**
 * Scan for the slip angle at which Fy peaks (ascending scan, stops after peak).
 * Returns the peak alpha in radians.
 */
export function findPeakAlpha(
  Fz: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
  qFz = 0,
  Fz0 = Fz,
): number {
  const STEP = 0.002; // ~0.11 deg
  let maxFy    = 0;
  let peakAlpha = STEP;
  for (let alpha = STEP; alpha <= 0.45; alpha += STEP) {
    const Fy = pacejkaFy(alpha, Fz, B, C, peakMu, E, qFz, Fz0);
    if (Fy > maxFy) { maxFy = Fy; peakAlpha = alpha; }
    else if (Fy < maxFy - 50) break; // well past peak — stop scanning
  }
  return peakAlpha;
}

/**
 * Bisection solver: find the slip angle [rad] that produces a given lateral force.
 * Assumes Fy is monotonically increasing on [0, peakAlpha].
 * If Fy_required exceeds the tyre peak, returns peakAlpha (saturated state).
 *
 * @param Fy_required  Target lateral force [N], must be ≥ 0
 */
export function solveSlipAngle(
  Fy_required: number,
  Fz: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
  qFz = 0,
  Fz0 = Fz,
): number {
  const peakAlpha = findPeakAlpha(Fz, B, C, peakMu, E, qFz, Fz0);
  const FyPeak    = pacejkaFy(peakAlpha, Fz, B, C, peakMu, E, qFz, Fz0);

  if (Fy_required >= FyPeak) return peakAlpha; // tyre saturated

  // Bisection on [0, peakAlpha]
  let lo = 0;
  let hi = peakAlpha;
  for (let i = 0; i < 50; i++) {
    const mid   = (lo + hi) * 0.5;
    const FyMid = pacejkaFy(mid, Fz, B, C, peakMu, E, qFz, Fz0);
    if (FyMid < Fy_required) lo = mid;
    else                     hi = mid;
  }
  return (lo + hi) * 0.5;
}

/**
 * Per-axle slip angle solver with lateral load transfer + combined slip.
 *
 * Models both tyres on an axle separately (FzOuter / FzInner after lateral
 * load transfer).  Combined slip via the friction ellipse:
 *
 *   FyAvail_tyre(α) = Fy_pacejka(α, Fz, B, C, peakMu_eff, E)
 *   where peakMu_eff = peakMu × √(1 − (Fx_per_tyre / Fx_max_tyre)²)
 *
 * The naturally different Fz values on inside/outside tyres mean the two
 * Pacejka curves differ, capturing load-transfer sensitivity without needing
 * an explicit degressive-μ model.
 *
 * @param FyRequired   Target combined lateral force for this axle [N] (≥ 0)
 * @param FzOuter      Normal load on the outside (higher-loaded) tyre [N]
 * @param FzInner      Normal load on the inside (lighter) tyre [N]
 * @param FxAxle       Total longitudinal drive/brake force on this axle [N]
 * @param qFz          Load sensitivity factor (Stage 9); 0 = off
 * @param Fz0          Nominal load [N] for load sensitivity reference
 * @returns            Slip angle [rad]
 */
export function solveSlipAngleTyreAxle(
  FyRequired: number,
  FzOuter: number,
  FzInner: number,
  FxAxle: number,
  B: number,
  C: number,
  peakMu: number,
  E: number,
  qFz = 0,
  Fz0 = (FzOuter + FzInner) / 2,
): number {
  const FxPerTyre = FxAxle / 2;

  // Effective peak mu: load sensitivity + Gky combined-slip reduction (replaces Kamm circle)
  const ellipseScale = (Fz: number) => {
    const muLS  = loadSensitiveMu(Fz, Fz0, peakMu, qFz);
    // Approximate kappa from Fx/FxMax ratio (preserves sign for direction)
    const kappa = FxAxle !== 0
      ? Math.min(Math.abs(FxPerTyre) / Math.max(muLS * Fz, 1), 1.0) * Math.sign(FxAxle)
      : 0;
    return muLS * combinedSlipGky(kappa);
  };

  const peakMuOuter = ellipseScale(FzOuter);
  const peakMuInner = ellipseScale(FzInner);

  // Combined Fy for this axle at a given slip angle
  const getFyAxle = (alpha: number): number =>
    pacejkaFy(alpha, FzOuter, B, C, peakMuOuter, E) +
    pacejkaFy(alpha, FzInner, B, C, peakMuInner, E);

  // Scan for peak alpha (combined from both tyres)
  let maxFy = 0, peakAlpha = 0.01;
  for (let alpha = 0.01; alpha <= 0.45; alpha += 0.002) {
    const Fy = getFyAxle(alpha);
    if (Fy > maxFy) { maxFy = Fy; peakAlpha = alpha; }
    else if (Fy < maxFy - 150) break;   // well past peak
  }

  if (FyRequired >= maxFy) return peakAlpha;   // saturated

  // Bisection
  let lo = 0, hi = peakAlpha;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) * 0.5;
    if (getFyAxle(mid) < FyRequired) lo = mid;
    else                             hi = mid;
  }
  return (lo + hi) * 0.5;
}
