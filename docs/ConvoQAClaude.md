# ConvoQA — ApexSim Decisions & Open Questions

Running log of decisions made and questions from Srikar.
Most recent session at the top.

---

## Session 1 — 2026-03-15

### Decisions Made
- **Project name**: ApexSim
- **Repo**: https://github.com/srikarbuddhiraju/ApexSim
- **Local path**: `/home/srikarbuddhiraju/Srikar/Repo/ApexSim`
- **License**: MIT
- **Physics accuracy standard**: Validate against BOTH Milliken & Milliken (textbook) AND real-world data
- **Session start checklist**: mirrors Panchangam — ConvoQAClaude.md + lessons.md + LatestTask.md
- **Physics validation hard rule**: Never implement a model without validating outputs against known reference
- **Verification standard**: Physics output matches expected values for a hand-validated test case
- **Physics reference docs**: separate files in `docs/physics-reference/`, 200-line limit each
- **Tech stack**: TypeScript + React + Vite + Three.js. All settled — do not re-question.
- **Hosting**: Cloudflare Pages (tentative, free) — subdomain `apexsim.srikarbuddhiraju.com`
- **Domain**: srikarbuddhiraju.com (currently on Wix — migration to Cloudflare Pages planned, saves ₹4–5k/year)
- **Hosting rationale**: Cloudflare Pages preferred over Vercel — no commercial restriction, better India CDN, works identically with Vite/React

### Open Questions
- [ ] Tech stack: Build tool (Vite vs other?) and hosting (Vercel vs Netlify?) — discuss next
- [ ] Project name: finalise topics on GitHub repo (done locally, confirm topics set on remote)
- [ ] v0.1 start: what is the first thing to build once tech stack is locked?

### Landscape Research (done 2026-03-15)
No browser-based physics-correct vehicle dynamics tool exists. Gap confirmed:
- All physics-correct tools are desktop (C++, MATLAB, ROS)
- All browser tools are 3D viewers or autonomous motion planners (no real dynamics)
- ApexSim occupies unoccupied space: physics-correct + browser + interactive UI
