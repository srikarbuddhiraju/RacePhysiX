---
description: Full physics + build test suite — automotive engineer perspective
allowed-tools: Bash(npx:*), Bash(npm:*), Read, Grep, Agent
---

You are an automotive engineer and software tester. Your job is to validate ApexSim end-to-end. Be critical. Report every issue, even minor ones.

Spawn sub-agents for the independent test phases. All agents run in parallel.

---

## Parallel sub-agent assignments

Launch ALL of the following agents simultaneously:

### Agent 1 — Build integrity
**Task**: In the ApexSim project at `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:
1. Run `npx tsc --noEmit` — report any TypeScript errors with file:line.
2. Run `npm run build` — report any build errors or warnings.
Return: pass/fail for each step, full error output if any.

### Agent 2 — Existing validation suite
**Task**: In the ApexSim project at `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:
Run `npx tsx src/physics/validate.ts`
This covers: bicycle model algebraic checks, Gillespie Ch.6 numerical reference, suspension roll stiffness (RCVD Ch.16), aerodynamics, braking ABS, Stage 8 time-domain (step steer, neutral steer, sine sweep).
Return: full output, pass/fail count, any failures with analysis.

### Agent 3 — Extended physics suite
**Task**: In the ApexSim project at `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:
Run `npx tsx src/physics/test-extended.ts`
This covers sections A–H: load transfer equilibrium, suspension roll stiffness ratio, Pacejka curve shape, aero V² scaling, braking ABS enforcement, lap time circuit distances and plausible times, bicycle model V_ch theorem, edge cases.
Return: full output, pass/fail count, any failures with analysis.

### Agent 4 — Critical code review
**Task**: In the ApexSim project at `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`, read the following files and review as an automotive engineer:
1. `src/physics/bicycleModel.ts` — verify K formula matches Gillespie eq.6.15, b/a geometry correct
2. `src/physics/loadTransfer.ts` — verify sign convention: ax<0=braking → front gains (longTransfer subtracted from front)
3. `src/physics/laptime.ts` — scan all 5 real circuits; for each corner compute sweep = length/radius in degrees. Flag any sweep > 180° (unusual but possible for hairpins) and any sweep > 360° (impossible)
4. `src/physics/suspension.ts` — verify KΦ = (k_spring + k_ARB) × TW²/2 formula (RCVD Ch.16)
Return: findings for each file, any bugs or concerns, list of all circuit corners with sweep > 150°.

### Agent 5 — Lap time engineering analysis
**Task**: In the ApexSim project at `/var/home/srikarbuddhiraju/Srikar/Repo/ApexSim`:
Read `src/physics/laptime.ts` and `src/physics/test-extended.ts`.
The test-extended.ts F3 output shows lap times for a 1500 kg / 200 kW / peakMu=1.1 car:
- Monaco ~113s, Monza ~140s, Spa ~173s, Silverstone ~150s, Suzuka ~151s
Evaluate these as an automotive engineer:
1. Compare to real F1 qualifying times (Monaco ~72s, Monza ~82s, Spa ~104s, Silverstone ~88s, Suzuka ~90s). Are the ratios plausible for the car spec?
2. Are the top speeds plausible? (power-limited, aero drag)
3. Are minimum corner speeds plausible? (grip-limited, μ=1.1 × aero)
4. Is there anything that feels wrong about the lap time model?
Return: circuit-by-circuit assessment with reasoning, any anomalies flagged.

---

## After all agents complete — synthesise

Consolidate all 5 agent reports into a single test report:

```
## ApexSim Physics Test Report — [date]

### Build & TypeScript
[status from Agent 1]

### Validation Suite (validate.ts) — Checks 1–10
[from Agent 2]

### Extended Suite (test-extended.ts) — Sections A–H
[from Agent 3]

### Code Review Findings
[from Agent 4]

### Lap Time Engineering Review
[from Agent 5]

### Known Model Limitations
- [ ] Pacejka B,C,E fixed with Fz (no load sensitivity on shape — v0.1 limitation)
- [ ] Linear bicycle model only (non-linear at high ay not captured in stage 1–7)
- [ ] No aero pitch/ride-height sensitivity
- [ ] No thermal tyre model
- [ ] Point-mass lap sim (no lateral dynamics in lap estimator)
[add any additional gaps found by agents]

### Overall Verdict
[PASS / PASS WITH NOTES / FAIL — one paragraph]
```

Be direct. If something is wrong, say so clearly. The standard is high — this is a physics tool engineers use for setup decisions.
