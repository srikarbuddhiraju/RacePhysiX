# ApexSim — Claude Instructions

## Project Overview
A browser-based, physics-accurate vehicle dynamics simulator.
- **Purpose**: Educational (v1) → Setup tool (v2)
- **Platform**: Web (browser-first, no install)
- **Tech Stack**: TBD — see Tech Stack section below

## Owner
Srikar Buddhiraju. MEng Automotive Engineering, University of Leeds (2019).
No prior programming experience. Claude implements, Srikar validates physics.
Srikar can and will catch incorrect physics — accuracy is non-negotiable.

## Design Philosophy (no exceptions)
1. **Easy** — prefer simple, readable code over clever abstractions
2. **Scalable** — structure code so features can be added without rewriting
3. **Robust** — handle errors gracefully, strong typing, no silent failures
4. **Secure** — no hardcoded secrets, validate inputs
5. **Light** — minimise dependencies, avoid bloat, optimise for performance
6. **Accurate** — physics MUST NOT compromise on precision. Validate every model against
   Milliken & Milliken (textbook reference) AND real-world data (actuality).
   Accuracy beats simplicity when it comes to the physics.

## Tech Stack
*(Pending discussion — will be locked here once decided. Do not re-question once settled.)*
- Language: TypeScript
- Frontend: React
- 3D Visualisation: Three.js
- Physics engine: Pure TypeScript module (framework-agnostic)
- Build tool: TBD
- Hosting: Cloudflare Pages (tentative, free) — `apexsim.srikarbuddhiraju.com` subdomain

## Physics Model Roadmap
Build and validate each stage before moving to the next.

| Stage | Model | Status | What It Captures |
|---|---|---|---|
| 1 | Bicycle model | ✅ done | Yaw, understeer/oversteer, cornering response |
| 2 | Pacejka Magic Formula | ✅ done | Realistic tyre lateral + longitudinal forces |
| 3 | Load transfer + drivetrain | ✅ done | Per-corner Fz, combined slip, FWD/RWD/AWD/AWD+TV |
| 4 | Suspension (roll stiffness) | 🔄 next | Roll angle, ARB, accurate load transfer split |
| 5 | Braking model | planned | Brake bias, longitudinal decel, combined braking+cornering |
| 6 | Aerodynamics | planned | Speed-dependent downforce + drag |
| 7 | Lap time estimator | planned | Min-time solve over corner+straight track segments |
| 8 | Full 14-DOF | long term | Research-grade complete vehicle |

## Physics Reference Docs
All physics knowledge lives in `docs/physics-reference/`. Read relevant file before
implementing any physics model.
- [mechanics-fundamentals.md](docs/physics-reference/mechanics-fundamentals.md)
- [vehicle-geometry.md](docs/physics-reference/vehicle-geometry.md)
- [bicycle-model.md](docs/physics-reference/bicycle-model.md)
- [tyre-pacejka.md](docs/physics-reference/tyre-pacejka.md)
- [load-transfer.md](docs/physics-reference/load-transfer.md)

## Working Conventions
- Always explain what you're doing and why, in plain language
- When adding a dependency, justify it against the design philosophy
- Keep files small and focused (single responsibility)
- **Use tokens strategically** — Grep/Glob over broad reads; avoid re-reading files in context
- **No web searches for reference data** — ask Srikar to fetch and paste. WebSearch burns tokens.
- **Skim and scan, never read blindly** — scan for the specific value first, read broadly only if scan fails
- Always update `docs/LatestTask.md` with current status during active work
- **200-line limit on ALL markdown files**: split immediately if exceeded. Each file = one responsibility.

## Session Start Checklist
Read these before doing anything else:
1. `docs/ConvoQAClaude.md` — past decisions and open questions
2. `docs/lessons.md` — mistakes made and rules to avoid repeating
3. `docs/LatestTask.md` — what was being worked on last session

## Workflow Orchestration

### 1. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan — don't keep pushing
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents to keep main context window clean
- Offload research, exploration, and parallel work to subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from Srikar: update `docs/lessons.md` with the pattern
- Write rules that prevent the same mistake
- Review lessons at session start

### 4. Verification Before Done
- Never mark a task complete without proving it works
- For physics: output must match expected values for a hand-validated test case
- Ask: "Would a staff engineer approve this?"

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip for simple, obvious fixes — don't over-engineer

### 6. Autonomous Bug Fixing
- When given a bug: just fix it. Don't ask for hand-holding unless absolutely necessary.

## Task Management
1. **Plan First**: Write plan to `docs/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Capture Lessons**: Update `docs/lessons.md` after corrections
5. **LatestTask.md**: Update every ~5 minutes during active work — current status, done, pending, key findings

## Core Principles
- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Only touch what's necessary. Avoid introducing bugs.

## Hard Rules — Never Break These

### 1. Surface the error BEFORE writing any fix
- Make it fail loudly first — remove catches, add console.error, read the actual output
- Read the error. Then write the fix. Never guess.

### 2. Never write a library/API call without verifying the exact method name
- Check the library source or official docs for exact method signature
- Wrong method name = broken build = wasted cycle

### 3. Never use bare `catch` with no logging
- At minimum: `catch (e) { console.error(e); }`
- Silent failures hide root causes entirely

### 4. Read the relevant doc section before designing a feature
- Read `docs/ConvoQAClaude.md` and `docs/LatestTask.md` before proposing any model
- Read the relevant physics reference file before implementing any physics model

### 5. Diagnose → propose → confirm → implement. In that order. Always.
1. Get the actual error
2. Explain the root cause clearly
3. Wait for Srikar's confirmation before building
4. Implement, test, demonstrate output

### 6. Never implement a physics model without validating against a known reference
- Pick 2–3 known inputs → compute expected output using Milliken or real-world data
- If computed matches expected within tolerance → implement
- Never implement a physics change based on theory alone

### 7. Physics output must match a hand-validated test case before task is complete
- "It compiles" means nothing. Provide the test case and its expected vs actual output.

### 8. Always use feature branches — never implement on main
- Branch: `feature/<short-description>`
- Merge only when session is complete AND all verification items are checked

### 9. An unchecked verification item blocks merge — no exceptions
- `[ ]` in `docs/todo.md` or `docs/LatestTask.md` = hard blocker
- Treat unchecked items the same as failing tests
