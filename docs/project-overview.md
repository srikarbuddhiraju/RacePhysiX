# ApexSim — Project Overview

**Created:** Mar 14, 2026
**Repo:** https://github.com/srikarbuddhiraju/ApexSim
**Local path:** `/home/srikarbuddhiraju/Srikar/Repo/ApexSim`
**Status:** Active development — v0.1 in progress

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
| Physics engine | Pure TypeScript module (framework-agnostic) |
| Hosting | Cloudflare Pages (tentative, free) — `apexsim.srikarbuddhiraju.com` |
| License | MIT |

---

## Physics Models — Complexity Ladder

Build and validate each stage before moving to the next.

| Stage | Model | What It Captures |
|---|---|---|
| 1 | Bicycle model | Yaw, understeer/oversteer, cornering response |
| 2 | Pacejka Magic Formula | Realistic tyre lateral + longitudinal forces |
| 3 | Quarter-car model | Suspension dynamics, ride, wheel hop |
| 4 | Full 14-DOF | Complete vehicle, research-grade (long term) |

---

## v0.1 — The Simplest Thing That Works

**One scenario:** Car going around a constant radius corner.

**User adjusts:**
- Speed
- Front/rear weight distribution (%)
- Cornering stiffness (simplified tyre)

**Output:**
- Understeer / oversteer / neutral steer — and by how much
- Top-down view of car with tyre force vectors shown

**Goal:** Prove the physics engine is correct. One scenario, validated output, clean visual. Nothing more.

---

## Parameters To Expose (v1 — Bicycle + Pacejka)

**Vehicle:** total mass, front/rear weight split, CG height, wheelbase, track width
**Tyres (Pacejka simplified):** peak lateral force coefficient, slip angle at peak, cornering stiffness
**Inputs:** steering angle, speed, longitudinal acceleration

---

## Visualisations (v1)

- Top-down vehicle path with tyre slip angle indicators
- Friction circle — tyre load usage per corner
- Understeer/oversteer real-time gauge
- Weight transfer bars — front/rear/left/right
- Yaw rate vs lateral acceleration (handling diagram)

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
- Publicly available Pacejka coefficients datasets (to be gathered)

---

## Relationship to Panchangam

- Panchangam ships April 2026 — that takes priority
- ApexSim runs in parallel, slow pace, no hard deadline
- Separate repo, separate stack, separate Claude project context
