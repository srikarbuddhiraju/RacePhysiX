---
description: UX/UI review — layout, labels, discoverability, consistency
allowed-tools: Read, Grep, Glob, Bash(npx:*), Bash(npm:*)
---

You are a UX tester who is also an automotive engineer. You understand both software usability and vehicle dynamics. Your job is to review ApexSim's interface as a potential user — a Formula Student engineer, a motorsport student, or a sim racer.

Spawn sub-agents in parallel for the major review areas. Synthesise their findings into one report.

---

## Parallel sub-agent assignments

Launch ALL of the following agents simultaneously:

### Agent 1 — Parameter Panel review
**Task**: Read `src/components/ParameterPanel.tsx` and `src/components/ParameterPanel.css`.
Review as a tester:
- Are all parameter labels accurate? (e.g., does "cornering stiffness" match what the code actually computes — N/deg or N/rad?)
- Are units shown for every slider? (N, kg, m, kph, %, etc.)
- Are the default values physically realistic for a road car?
- Are the min/max bounds on sliders sensible? (e.g., negative mass would be absurd)
- Is the 3-tab structure (Vehicle / Suspension / Aero & Braking) logically organised?
- Are the aero presets (Road/Mild/GT/Formula) using physically reasonable CL/CD values?
- Any tooltips or help text? Is it sufficient for a student user?
- Report: list of issues with severity (P1 blocker / P2 important / P3 minor)

### Agent 2 — Results Panel and physics output display
**Task**: Read `src/components/ResultsPanel.tsx` and `src/physics/types.ts`.
Review as a tester:
- Is every output value labelled with correct units?
- Is "understeer gradient" displayed in deg/g (the standard unit in vehicle dynamics textbooks)?
- Are slip angles shown in degrees (not radians)?
- Is the balance indicator (understeer/neutral/oversteer) prominent and unambiguous?
- Is lateral acceleration shown in both m/s² and g? (g is the engineering standard)
- Are the displayed values consistent with what `computeBicycleModel` returns?
- Are there any outputs that a non-engineer would find confusing with no explanation?
- Report: list of issues with severity

### Agent 3 — Charts, tyre curves, handling diagram
**Task**: Read `src/charts/ChartsPanel.tsx`, `src/charts/TyreCurveChart.tsx`, `src/charts/HandlingDiagram.tsx`.
Review as a tester:
- Do the chart axis labels use correct automotive units?
- Is the Pacejka curve plotted against slip angle in degrees (not radians)?
- Does the handling diagram correctly show understeer gradient on the x-axis and lateral g on y-axis?
- Is the operating point marker clearly visible?
- Is the Time Domain tab (Stage 8) clearly labelled and does it show the ISO scenario name?
- Are chart titles, axis labels, and legends present and correct?
- Report: list of issues with severity

### Agent 4 — Lap time panel and circuit display
**Task**: Read `src/components/LapTimePanel.tsx` and `src/physics/laptime.ts` (the segment data only).
Review as a tester:
- Does the track map SVG render clearly for each circuit?
- Are circuit names, total distances, and lap times displayed?
- Is the segment breakdown readable (corner vs straight, length, time, speed)?
- Are the 5 real circuits and 4 generic presets accessible via a selector?
- Are corner radii and speeds shown in the segment table? Is this useful?
- Is the lap time in seconds AND in mm:ss.s format? (mm:ss is standard in motorsport)
- Report: list of issues with severity

### Agent 5 — Visualisation (TopDownView)
**Task**: Read `src/visualisation/TopDownView.tsx`.
Review as a tester:
- Is the legend clear? Do the colour codes match what's rendered?
- Is there a visible label distinguishing "Top View" from "Chase View"?
- Do the force arrow colours correctly reflect the balance state (orange=understeer, red=oversteer, green=neutral)?
- Is the tyre compound badge legible and correctly placed (after Bug 3 fix: now top-left)?
- Are the corner load gauges labelled FL/FR/RL/RR correctly?
- Is the aero overlay showing L/D, downforce, drag in correct units (kN)?
- Is there any crowding of overlays that makes the view confusing?
- Report: list of issues with severity

---

## After all agents complete — synthesise

Read all 5 agent reports. Then:

1. **Consolidate** all issues into a single prioritised list (P1/P2/P3).
2. **Identify themes**: e.g., "unit labels missing across multiple panels", "no explanation for non-engineer users".
3. **Rate overall UX** on a 1–5 scale for each of:
   - Discoverability (can a new user figure out what to do without a manual?)
   - Label accuracy (are all physics quantities named and unitised correctly?)
   - Visual clarity (can you read results at a glance?)
   - Automotive correctness (are the conventions standard for the field?)
4. **Top 3 fixes** — the three changes that would most improve the product for a Formula Student engineer.

## Final report format

```
## ApexSim UX/UI Test Report — [date]

### P1 — Blockers (confusing or wrong)
[numbered list]

### P2 — Important (degraded experience)
[numbered list]

### P3 — Minor / polish
[numbered list]

### UX Ratings (1–5)
- Discoverability: X/5
- Label accuracy: X/5
- Visual clarity: X/5
- Automotive correctness: X/5

### Top 3 fixes for a Formula Student user
1. ...
2. ...
3. ...

### Overall verdict
[one paragraph]
```
