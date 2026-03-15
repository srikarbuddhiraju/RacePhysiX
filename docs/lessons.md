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

### Dev server ≠ production build
- **Rule**: Any code that could behave differently in a production/minified build
  (tree-shaking, bundling, env vars) must be tested with a production build,
  not just the dev server.
