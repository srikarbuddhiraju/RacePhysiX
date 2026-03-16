# Claude Lessons — ApexSim Project

Running log of mistakes and rules to avoid repeating.
Updated after every correction per CLAUDE.md Self-Improvement Loop.

---

## Physics Validation

### Never implement a physics model without validating theory first
- **Rule**: Before ANY physics implementation: pick 2–3 known inputs → compute expected output
  using Milliken & Milliken or real-world reference data → if they match within tolerance → implement.
- **Rule**: A plan being approved does NOT mean the physics is correct. Verify the empirical
  premise before implementing.
- **Rule**: Milliken = textbook reference (theoretical baseline). Real-world data = actuality.
  Both must agree before a model is accepted.

---

## Token Efficiency

### Subagents for simple targeted searches = wasteful
- **Rule**: Use Grep/Glob for known targets. Reserve subagents for open-ended multi-file exploration.

### Web search for reference data = wasteful
- **Rule**: Ask Srikar to fetch and paste external data. Do not use WebSearch for tables/specs.

### Do not read blindly into files
- **Rule**: Skim and scan first. Only read broadly if targeted scan fails.

---

## Git Branching

### Always use feature branches
- **Rule**: NEVER implement on main. Create `feature/<short-description>` branch first.
- **Rule**: Merge only when session is complete AND all verification items are checked.

---

## Data Persistence

### Never lose user-pasted data between sessions
- **Rule**: If Srikar pastes it (reference values, test data, real-world measurements),
  immediately write it to `docs/data/` or the relevant source file.
- **Rule**: Confirm: "Saved to docs/data/filename.md"

---

## Design / Feature Planning

### Read existing docs before designing any feature
- **Rule**: Read `docs/ConvoQAClaude.md` and `docs/LatestTask.md` before proposing any model.
- **Rule**: Read the relevant physics reference file before implementing any physics model.

---

## Error Handling

### Surface errors before fixing
- **Rule**: When something silently fails → make it fail loudly FIRST.
  Remove catch blocks, add console.error, read the actual output.
- **Rule**: Read the error. Then write the fix. Never guess.

### Never use bare catch with no logging
- **Rule**: `catch (e) { }` is forbidden on any meaningful code path.
  At minimum: `catch (e) { console.error(e); }`

---

## Production Builds

### Always use `npm run build` as the final verification step — not just `tsc --noEmit`
- **Rule**: After every implementation session, run `npm run build` (which runs `tsc -b && vite build`)
  before committing. `tsc --noEmit` is more lenient than `tsc -b` — some errors only appear in build mode.
- **Why**: Stage 13 — `tsc --noEmit` passed but `npm run build` failed with two errors:
  a type assertion needing `unknown` intermediate, and an unused parameter. Black screen resulted.
- **How to apply**: Final checklist: `npx tsc --noEmit` → `npm run build` → both must pass.

### Dev server ≠ production build
- **Rule**: Any code that could behave differently in a production/minified build
  (tree-shaking, bundling, env vars) must be tested with a production build,
  not just the dev server.

### Guard slider values against undefined to survive HMR state mismatch
- **Rule**: Any component that reads `params[key]` as a number must guard against `undefined`:
  `(params[key] as number) ?? fallback`. Use `min` as the fallback for sliders.
- **Why**: When Vite HMR updates a component that renders a new `VehicleParams` key while React
  preserves old state (which predates that key), the value is `undefined`. Calling `.toFixed()`
  on `undefined` throws, React unmounts the tree, and the app shows a black screen.
- **How to apply**: Already applied in `SliderRow`. Apply same pattern in any new component that
  reads numeric params fields that may not exist in old serialised state (URL hash).

---

## Circuit / Track Data

### Corner arc lengths must satisfy arc = R × θ
- **Rule**: When entering real circuit data, NEVER use physical segment lengths (e.g., 90m for a chicane).
  Use arc = R × θ. Typical angles: hairpin ~180°, chicane corner ~75–80°, medium ~90°, fast sweeper ~120–130°.
- **Why**: A 90m arc at R=14m = 6.43 rad = 368° — more than a full loop. Breaks the track map SVG renderer.
- **How to apply**: After entering any real circuit corners, spot-check: if `length / radius > π` (>180°) and
  it's not meant to be a hairpin, it's almost certainly wrong. Recompute.
- **Fix pattern**: After correcting all arcs, adjust one "filler straight" per circuit to maintain the correct
  total track distance.

### Direction tags: circuit handedness convention
- **Rule**: `direction: 'left'` = SVG sweep CW (y-down), `direction: 'right'` = CCW.
  CW circuits (Monza) → standalone corners use `'left'`. CCW circuits (Monaco/Spa/Silverstone/Suzuka) → `'right'`.
  Chicane pairs: T1 goes against the primary direction, T2 returns to it.
- **Why**: Wrong direction tags make the track map trace in the opposite circuit direction.

---

## Test Infrastructure

### Always write a test script alongside physics models
- **Rule**: For every physics module, `test-extended.ts` must include at least: zero/identity case,
  Newton's law check (forces sum correctly), directionality check (sign convention correct),
  and one numerical spot-check vs hand calculation.
- **Why**: `validate.ts` only covers the happy path. Edge cases (zero speed, extreme ay, zero stiffness)
  catch bugs that only show up at parameter extremes.

### Verify test formulas before running
- **Rule**: When writing a test that checks a theoretical property (e.g., characteristic speed V_ch),
  re-derive the formula from scratch in comments before coding it. Never copy from memory.
- **Why**: V_ch formula error in Session 5 — used sqrt(g×L/K) instead of sqrt(L/K_rad).
  The correct derivation (δ = L/R + K×V²/R, set δ = 2×L/R) is 3 lines. Write them first.

### Sub-agents: use for parallel independent test phases
- **Rule**: Physics tests (validate, extended, build, code review, engineering analysis) are independent.
  Launch all as parallel sub-agents. Collect and synthesise. Do not run sequentially.
- **Why**: Reduces session time significantly. Each phase takes 10–30s. Sequential = 5× slower.

---

## Agent Output Verification

### Always verify agent arithmetic before applying data fixes
- **Rule**: When an agent reports a numerical discrepancy (e.g., "circuit X is Y metres short"), verify with a one-line node calculation before making any change.
- **Why**: Session 6 — code review agent reported Spa was 1000m short (6004m vs 7004m). Manual `node -e` verified the original was already 7004m. Agent made an arithmetic error. A fix was applied and then immediately reverted, wasting 2 edits.
- **How to apply**: `node -e "const segs=[...]; console.log(segs.reduce((a,b)=>a+b,0))"` takes 5 seconds and prevents incorrect changes.

---

## Skills / Commands

### Create project-level skills for recurring tasks
- **Rule**: Any task run more than once (test suite, session start, branch creation) should have a
  `.claude/commands/<name>.md` skill file in the project root.
- **Why**: Reduces friction. Skill is self-documenting. New sessions pick it up automatically.
- **Skill locations**: Global skills → `~/.claude/commands/`. Project skills → `.claude/commands/` in repo root.
