---
name: stage-status
description: Show ApexSim physics stage completion status, current branch, and recommended next step
allowed-tools: Bash, Read
---

Show the current state of the ApexSim project:

1. Read `docs/LatestTask.md` for current work and open checklist items
2. Run `git log --oneline -8` to show recent commits
3. Run `git branch` to show current branch
4. Run `npx tsc --noEmit 2>&1 | head -5` to check for type errors

Then summarise:
- Which stages are complete (Stage 1: bicycle ✅, Stage 2: Pacejka ✅, Stage 3: load transfer+drivetrain ✅ if committed)
- Current branch and any open `[ ]` checklist items from LatestTask.md
- Recommended next step based on the physics roadmap in CLAUDE.md
