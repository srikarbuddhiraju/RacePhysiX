# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries as sessions accumulate.

---

## Session 2 — 2026-03-15  |  branch: `feature/stage3-load-transfer-drivetrain`

### Status: IN PROGRESS — Stage 3

### Done this session
- Stages 1+2 committed to main (c6549a9)
- Multi-view canvas: top-down + chase cam, vehicle class silhouettes
- Branching convention established — see memory/feedback_branching.md

### Stage 3 checklist
- [ ] 3a Lateral load transfer — per-corner Fz via nonlinear per-tyre Pacejka sum
- [ ] 3b Longitudinal load transfer — weight shift under throttle/braking
- [ ] 3c Combined slip (friction ellipse) — Fx reduces Fy on driven axles
- [ ] 3d Drivetrain (FWD/RWD/AWD/AWD_TV) + torque vectoring
- [ ] UI drivetrain section in ParameterPanel
- [ ] ResultsPanel Stage 3 outputs
- [ ] tsc clean + validate

### Key physics decisions
- Per-axle solver sums Fy_outer + Fy_inner — nonlinearity from Pacejka curve shape
- Combined slip applied per-tyre in bisection solver (friction ellipse scaling peakMu_eff)
- TV: tvBias ∝ slipAngleDiffDeg clamped ±0.8, Mz = FxRear × tvBias × TW/2

---

## Session 1 — 2026-03-15 | main

### Status: Complete — c6549a9

Scaffold, bicycle model (validated Gillespie), Pacejka Stage 2, tyre presets,
charts (TyreCurveChart + HandlingDiagram), ParameterPanel sliders, InfoTooltips,
TopDownView multi-view + vehicle silhouettes.
