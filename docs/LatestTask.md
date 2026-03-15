# Latest Task — ApexSim

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 3 — 2026-03-15  |  branch: `feature/stage4-suspension`

### Status: IN PROGRESS

### Planned sequence this session
1. Stage 4 — Suspension (roll stiffness model, roll angle, corrected load transfer)
2. Stage 5 — Braking (brake bias, longitudinal decel + cornering combined slip)
3. Stage 6 — Aero (CL/CD downforce + drag, speed-dependent grip)
4. Stage 7 — Lap time estimator (corner + straight segments, min-time solve)
5. UX polish throughout

### Stage 4 checklist
- [ ] 4a Physics: roll stiffness model — KΦ_front/rear from spring rate + ARB
- [ ] 4b Replace simple load transfer split with roll stiffness ratio
- [ ] 4c Compute roll angle: Φ = m·ay·hCG / (KΦ_total)
- [ ] 4d New params: frontSpringRate, rearSpringRate, frontARB, rearARB, unsprungMass
- [ ] 4e Outputs: rollAngle, rollStiffnessRatio, updated FzFL/FR/RL/RR
- [ ] 4f ParameterPanel: suspension section sliders
- [ ] 4g ResultsPanel: roll angle + stiffness ratio display
- [ ] 4h validate.ts: roll stiffness check
- [ ] 4i tsc clean

### Stage 5 checklist
- [ ] 5a Brake bias slider (front %)
- [ ] 5b Braking g slider (0 → 1.5g)
- [ ] 5c Longitudinal load transfer under braking (front gains, rear loses)
- [ ] 5d Combined braking + cornering on friction ellipse (extend existing)
- [ ] 5e ABS clip: cap brake force at peak μ×Fz per axle
- [ ] 5f ResultsPanel: braking outputs

### Stage 6 checklist
- [ ] 6a Aero params: CL (downforce coeff), CD (drag coeff), frontal area A
- [ ] 6b Downforce: ΔFz = ½ρV²A·CL split front/rear by aero balance
- [ ] 6c Drag: F_drag = ½ρV²A·CD added to longitudinal model
- [ ] 6d Aero presets (clean road car, moderate wing, full downforce)
- [ ] 6e ResultsPanel + ParameterPanel aero section

### Stage 7 checklist
- [ ] 7a Track model: sequence of corners + straights (JSON config)
- [ ] 7b Corner max speed: V_max = √(μ_eff × g × R) accounting for aero grip
- [ ] 7c Straight: acceleration integration from V1 to V2 under power - drag
- [ ] 7d Braking: decel from V2 to corner entry speed
- [ ] 7e Lap time sum + per-segment breakdown
- [ ] 7f LapTimePanel component

---

## Session 2 — 2026-03-15  |  Status: MERGED to main

Stage 3 (load transfer + combined slip + FWD/RWD/AWD/AWD_TV),
power unit toggle (kW/BHP/PS), dark/light theme, Stage 3 display fixes.
Commits: fa0b2dc → ae6c2e6, merged 4c57091.

---

## Session 1 — 2026-03-15  |  Status: MERGED to main

Scaffold, bicycle model (Gillespie-validated), Pacejka Stage 2, tyre presets,
charts (TyreCurve + HandlingDiagram), TopDownView multi-view + silhouettes.
Commit: c6549a9.
