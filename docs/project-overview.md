# ApexSim — Project Overview

**Created:** 2026-03-15
**Repo:** https://github.com/srikarbuddhiraju/ApexSim
**Local path:** `/home/srikarbuddhiraju/Srikar/Repo/ApexSim`
**Status:** v1 feature-complete — pending deployment

---

## What This Is

An interactive, physics-accurate vehicle dynamics simulator that runs in the browser.
Not a game. A tool where you change parameters and see real-world vehicle behaviour in real time.

**Primary purpose (v1):** Educational — understand *why* a car behaves the way it does.
**Secondary purpose (v2):** Setup tool — tune a car for a specific circuit or condition.

---

## Why This Works

- Srikar can validate physics (MEng Automotive Engineering, Leeds 2019) — the hardest part, already solved
- Gap is real: CarSim/VI-grade cost tens of thousands, nothing good on web
- Open source fits: academia + motorsport community will contribute and share
- No App Store needed — just a URL
- Monetisation path clear: free educational core → paid pro setup tool

---

## Target Audience

| Audience | Why They Care |
|---|---|
| Automotive engineering students | Visualise lecture concepts interactively |
| Formula Student teams | Setup tool they can actually afford |
| Club/semi-pro motorsport engineers | Quick checks without expensive software |
| Sim racing community | Understand why setup changes behaviour |
| Vehicle dynamics researchers | Open source model to extend |

---

## Monetisation

- **Community version**: MIT license, open source, free forever
- **Pro hosted version**: Advanced parameters, save/share setups, paid subscription
- No enterprise sales — individual pays with credit card

---

## Tech Stack (settled — do not re-question)

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Frontend | React |
| Build tool | Vite |
| 3D Visualisation | Three.js |
| Charts | Recharts |
| Physics engine | Pure TypeScript module (framework-agnostic) |
| Hosting | Cloudflare Pages — `apexsim.srikarbuddhiraju.com` |
| License | MIT |

---

## Physics Models — v1 Complete

| Stage | Model | Status |
|---|---|---|
| 1 | Bicycle model | ✅ done |
| 2 | Pacejka Magic Formula | ✅ done |
| 3 | Load transfer + drivetrain (FWD/RWD/AWD/AWD+TV) | ✅ done |
| 4 | Suspension — roll stiffness, ARB | ✅ done |
| 5 | Braking — brake bias, ABS clip | ✅ done |
| 6 | Aerodynamics — downforce + drag | ✅ done |
| 7 | Lap time estimator — 4 track presets | ✅ done |
| 8 | Full 14-DOF | long term |

All stages validated against Milliken & Milliken / Gillespie. 18 checks pass.

---

## v1 Features

- ParameterPanel: 3 tabs — Vehicle, Suspension, Aero & Braking
- Aero presets: Road / Mild / GT / Formula
- URL hash sharing: full params encoded in URL, shareable links
- Export: CSV (all params + results) and SVG (charts)
- Track map SVG: procedural per preset in LapTimePanel
- Responsive layout: works at 1200px, 900px, mobile
- Dark/light theme toggle
- 3D top-down view (Three.js) with tyre force vectors

---

## Reach Strategy

- Search-optimised README: "vehicle dynamics simulation", "Pacejka interactive", "understeer oversteer calculator"
- Submit to r/MotorsportEngineering, r/formula1tech, r/simracing
- Formula Student community forums and Discord servers
- Reach out to Leeds vehicle dynamics faculty for feedback + sharing
- One professor linking it in course materials = hundreds of users overnight

---

## Ideas Explored and Ruled Out

| Idea | Why Ruled Out |
|---|---|
| Cloud account ownership lifecycle tool | Azure Policy + Power Automate already covers it. Enterprise sales too heavy. |
| Platform knowledge graph | One-time problem, not a recurring product need |
| Motorcycle app | Against Srikar's philosophy — freedom from screens |
| Philosophy platform (Nadam) | Medium contradicts message. Advaita doesn't fit feeds/algorithms. |
| 65x24 cinematic video app | Requires Mac + iOS dev. No Mac available. |

---

## Reference Material

- Milliken & Milliken — *Race Car Vehicle Dynamics* (the bible)
- Pacejka — *Tyre and Vehicle Dynamics*
- Gillespie — *Fundamentals of Vehicle Dynamics*

---

## Relationship to Panchangam

- Panchangam ships April 2026 — that takes priority
- ApexSim runs in parallel, slow pace, no hard deadline
- Separate repo, separate stack, separate Claude project context
