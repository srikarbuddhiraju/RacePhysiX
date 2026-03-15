# Latest Task — ApexSim

Rolling log. Trim oldest entries as new sessions are added.

---

## Session 1 — 2026-03-15

### Status: Complete — v0.1 committed on feature/v0.1-scaffold

### Done this session
- Researched GitHub landscape — confirmed ApexSim fills an unoccupied gap
- Named project: ApexSim
- Created GitHub repo: https://github.com/srikarbuddhiraju/ApexSim
- Initialised local repo at `/home/srikarbuddhiraju/Srikar/Repo/ApexSim`
- Wrote `CLAUDE.md` (adapted from Panchangam, ApexSim-specific physics rules added)
- Wrote `docs/lessons.md`
- Wrote `docs/ConvoQAClaude.md`
- Wrote `docs/LatestTask.md` (this file)
- Physics reference docs being written by parallel agents:
  - mechanics-fundamentals.md
  - vehicle-geometry.md
  - bicycle-model.md
  - tyre-pacejka.md
  - load-transfer.md

### Pending — next session
- [ ] Merge feature/v0.1-scaffold → main and push to GitHub
- [ ] Set GitHub repo topics
- [ ] Physics validation: test with Milliken reference values
- [ ] Add slip angle warning to Three.js scene (visual, not just text)
- [ ] Decide next: Pacejka Stage 2 or improve visualisation first

### Key Findings
- Tech stack: TypeScript + React + Three.js confirmed. Build tool TBD.
- Physics validation standard: Milliken (textbook) + real-world data (both required)
- No competitors in browser-based physics-correct vehicle dynamics space
