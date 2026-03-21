# Claude Lessons — ApexSim Project

Running log of mistakes and rules to avoid repeating.
Updated after every correction per CLAUDE.md Self-Improvement Loop.

---

## Engineering Discipline

### No untested assumptions — ever
- **Rule**: Any assumption that drives a code change must be verified before the change is written. Not after. Not "probably correct." Verified.
- **Why**: Session 16 — assumed TUMFTM GPS SVG paths traverse CCW without checking a single coordinate. Implemented direction-reversal logic across 9 circuits and the entire animation system. Result: arrows reversed on all circuits. The assumption was the foundation and it was never tested. This is not how an engineer works.
- **How to apply**: Before any implementation that rests on an assumed property (direction, sign, order, format), add a verification step first. For SVG direction: check first 3 coordinates against a known landmark. For physics signs: hand-calculate one case. For data format: log one real value. If the verification takes 5 minutes, do it. If the implementation takes 2 hours and the assumption is wrong, those 2 hours are wasted.

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

### Always ask scope before running /sim-review (or any heavy multi-agent skill)
- **Rule**: Before launching `/sim-review`, ask: "Which checks? Options: Circuit Geometry / Lap Times /
  Speed-RPM-Gear / Physics / Visual-Physics Sync / Screenshots / All"
- **Why**: Full sim-review runs 6 parallel agents = ~400k+ tokens. Often only 1–2 checks are needed.
- **When**: Every time `/sim-review` is invoked. Default to all ONLY if Srikar explicitly says so.

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

---

## Animation / Visual Physics

### Net heading = 2π does NOT mean the SVG path spatially closes
- **Rule**: `buildTrackPath()` integrates cos/sin over headings. If ∑(turn×sweep) = 2π, the direction
  returns to 0° but the *position* will NOT return to origin unless the circuit geometry is symmetric.
  Club ended 415px from start even after heading fix.
- **Why**: Session 15 — 4 hours of heading fixes that didn't fix "wonky" circuits.
- **How to apply**: For any circuit that needs to look closed, use an explicit `svgPath`. Do NOT
  rely on heading closure as a proxy for spatial closure.

### Use `vPrev = vExit` not `vPrev = vExitTarget` at straight segment end
- **Rule**: In `simulateLap`, after simulating a straight, store the *actual* simulated exit speed
  as the next segment's entry — not the pre-planned target corner speed.
- **Why**: `vPrev = vExitTarget` causes a speed step at every straight→corner boundary: the straight
  exits at a different speed than the corner thinks it entered at, creating heatmap discontinuities.
- **How to apply**: `laptime.ts` around segment-end bookkeeping — always `vPrev = vExit`.

### Always clamp animation dt (deltaTime) to a max value
- **Rule**: In any RAF animation loop, clamp `dt = Math.min(timestamp - prevTimestamp, 50)`.
- **Why**: Backgrounding a browser tab pauses RAF. On refocus, dt can be seconds, causing
  accelG = (ΔV/Δt) to spike to 50–100g, breaking the G-meter visually.
- **How to apply**: Any place dt is used to compute a rate (accelG, any derivative). Max 50ms.

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

## Circuit / Track Data (continued)

### GPS SVG direction vs physics: TUMFTM paths are already CW (same as physics)
- **Rule**: TUMFTM GPS SVG paths traverse in the **same direction** as the physics model. Do NOT add any `svgReversed` or direction-inversion logic.
- **Why**: Session 16 — assumed TUMFTM GPS SVG paths are CCW (opposite to CW physics). Added `svgReversed: true` to all 9 circuits. Session 17 — verified geometrically: Spa SVG starts at S/F, moves toward La Source (top of circuit), then down to Eau Rouge. This is identical to the physics segment order. The assumption was wrong in both sessions. `svgReversed` was reverted.
- **How to apply**: If a heatmap or arrow direction bug appears on GPS circuits: (1) extract the first 2–3 SVG coordinates, (2) identify geographic location (landmark), (3) compare to physics segment order. The path direction should already match — look for bugs elsewhere (speed profile indexing, timeFrac→pathFrac mapping, etc.).

### RAF tick: access props via refs to avoid stale closures
- **Rule**: The RAF `tick` callback is a stable `useCallback`. Props accessed inside it must go via a ref (same pattern as `resultRef`/`raceResultRef`). Add `fooRef = useRef(foo)` and sync it with `useEffect(() => { fooRef.current = foo; }, [foo])`.
- **Why**: Accessing props directly in `tick` will read stale values after they change, because `tick` is not recreated. `layoutRef` was added in Session 16 for this reason but later removed when the feature it served (`svgReversed`) was reverted. The pattern remains valid for any other prop needed inside the tick.

---

## SVG / Animation Geometry

### Always verify polygon-tip direction vs heading formula
- **Rule**: For any directional arrow, explicitly verify: (a) which axis the polygon tip points at rotation=0°, (b) what angle `atan2` returns for the primary direction of travel, (c) confirm `rotate(heading)` aligns them. If tip is at `(0,-y)` (points up) and heading = `atan2(dy,dx)`, the offset needed is +90°.
- **Why**: Session 19 — arrow polygon tip was at `(0,-8)` (up). `atan2` gives 0° for eastward motion. rotate(0°) = tip up = 90° sideways. Visible in every screenshot. Was not caught because the code `rotate(${headingDeg})` looks correct on a quick read without checking the polygon geometry.
- **How to apply**: Write out: tip direction at 0° → required rotation for car moving east → offset = required - atan2_east. Takes 30 seconds.

---

## Screenshots / Browser Capture

### On Bazzite (Wayland + rpm-ostree): just ask Srikar for screenshots
- **Rule**: Do NOT attempt automated screenshot capture on this machine. Research display server first (`echo $XDG_SESSION_TYPE`), then act — not trial-and-error.
- **Why**: System is Bazzite (Fedora Atomic, rpm-ostree). `$XDG_SESSION_TYPE=wayland`. `import` (ImageMagick) needs X11. `grim` is not in brew. `gnome-screenshot` not installed. Flameshot flatpak fails on Wayland. `rpm-ostree install` requires a reboot.
- **How to apply**: When Agent F (screenshots) is requested, ask Srikar: "Which circuit/state do you want captured? I'll guide you on what to look for." Don't burn tokens on tool-discovery loops.

---

## GPS Zone Overlay

### GPS curvature overlay: N must resolve the shortest corner arc
- **Rule**: Set N (sample count) so that `ds = totalDist / N` is less than `(shortest arc length) / 3`. For Monza's 18m T1 chicane, ds must be < 6m → N ≥ 1000. N=400 was producing ds=14.5m, making T1 invisible to the Menger formula (needed 3 points, got 1.2).
- **Why**: Session 18 — N=400 GPS overlay showed full-throttle (green) at Monza T1 approach because the chicane was under-sampled. User saw "braking shows acceleration." Root cause was sampling, not sign errors.
- **How to apply**: After choosing N, check: `ds = totalDist / N`. Identify the shortest corner in the circuit (usually a chicane). Verify `shortest_arc / ds ≥ 3`. If not, increase N until it is.

### GPS curvature smoothing window must not exceed shortest corner arc
- **Rule**: The Gaussian smoothing window must span ≤ (shortest arc length / 2). A 7-point ±3 window spans ±43.5m at N=400, which is wider than a 18m chicane — dilutes peak curvature to near-zero. Use 3-point [1,2,1] with N=2000.
- **Why**: Same session — smoothing blurred the curvature peak at T1 completely, making R_smoothed ≈ 110m instead of 55m.

### Sub-agent integration formula claims must be hand-verified
- **Rule**: When a sub-agent claims a sign or formula is wrong in a physics integration, always derive the correct formula from first principles before applying the fix.
- **Why**: Session 18 — Agent A claimed the backward braking pass `+2*aBrake` was wrong and should be `−2*aBrake`. This was incorrect. The backward pass answers "what is the max entry speed given exit speed V[exit] and braking distance ds?" → `V_entry = sqrt(V_exit² + 2*a*ds)`. The `+` sign is correct. Agent A confused forward integration (`V_exit² = V_entry² − 2*a*ds`) with backward integration (`V_entry² = V_exit² + 2*a*ds`).
- **How to apply**: Always hand-check with one concrete numerical example (30 m/s → brake 14.5m at 8.83 m/s² → entry speed = sqrt(900+256)=34 m/s ≠ sqrt(900-256)=25.4 m/s). Verify which answer is physically correct.

### Zone decelG threshold: use physics-based ratio, not absolute m/s drop
- **Rule**: The deceleration detection check `V[i+1] < V[i] - 0.3` fails at high speed. At 50 m/s, 0.3g deceleration only changes speed by `0.3*9.81*ds/50 ≈ 0.17 m/s`, which is below the 0.3 m/s threshold. Use `decelG = (V[i]²-V[i+1]²)/(2*ds*G)` and threshold on g-units instead.
- **Why**: The absolute threshold caused trail-braking and mild braking to be classified as full-throttle at high approach speeds (>50 km/h).

---

## Skills / Commands

### Create project-level skills for recurring tasks
- **Rule**: Any task run more than once (test suite, session start, branch creation) should have a
  `.claude/commands/<name>.md` skill file in the project root.
- **Why**: Reduces friction. Skill is self-documenting. New sessions pick it up automatically.
- **Skill locations**: Global skills → `~/.claude/commands/`. Project skills → `.claude/commands/` in repo root.
