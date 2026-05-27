# RacePhysiX — Project Overview

**Created:** 2026-03-15  |  **Last updated:** 2026-05-27
**Live:** racephysix.srikarbuddhiraju.com (Cloudflare Pages)
**Repo:** https://github.com/srikarbuddhiraju/RacePhysiX

---

## What This Is

Browser-based, physics-accurate vehicle dynamics simulator. No install, no login, free.
Not a toy — Pacejka Magic Formula, 14-DOF time domain, real GPS circuits, setup optimiser.

**v1 (done):** Educational — understand why a car behaves the way it does.  
**v2 (current):** Setup tool — tune a car for a specific circuit or condition.  
**v3 (future):** Local desktop app with real-time FEA tyre model. See `roadmap.md`.

---

## Owner

Srikar Buddhiraju. MEng Automotive Engineering, University of Leeds (2019).
Physics validated by Srikar. Implementation by Claude. Accuracy is non-negotiable.

---

## Current Status (Session 40 — 2026-05-27)

- **36 physics stages** implemented and validated (see CLAUDE.md for full table)
- **22 circuits** — 4 generic + 4 schematic + 14 GPS (TUMFTM LGPL-3.0 + OSM ODbL)
- **37/37** validation checks | **424/424** extended tests
- **0** TypeScript errors | **0** npm vulnerabilities
- Deployed, live, publicly accessible

---

## Target Audiences

| Audience | Why They Care |
|---|---|
| Sim racers | Understand setup physics, not just trial and error |
| Automotive engineering students | Interactive, free, real physics — supplements lectures |
| Formula Student teams | Affordable alternative to OptimumLap — does more |
| Club/semi-pro racing engineers | Quick setup analysis without £500/yr desktop tools |
| Vehicle dynamics researchers | Open-source model to extend and publish with |

---

## Licence

**Current (as of Session 40 decision):** Changing from MIT → **AGPL v3** (open source, viral for
commercial use) + separate **commercial licence** for companies wanting non-AGPL terms.

This dual-licence model protects against commercial extraction while keeping the tool
fully free and open for students, hobbyists, and non-commercial use. See `monetisation.md`.

---

## Tech Stack (settled — do not re-question)

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Frontend | React |
| Build tool | Vite |
| 3D Visualisation | Three.js |
| Charts | Recharts |
| Physics engine | Pure TypeScript (framework-agnostic) |
| Hosting | Cloudflare Pages |

---

## Key Docs

| File | Purpose |
|---|---|
| `CLAUDE.md` | Full physics stage table, working conventions, hard rules |
| `docs/roadmap.md` | v1/v2/v3 milestones + FEA prerequisites |
| `docs/monetisation.md` | Licence, tier design, action items |
| `docs/marketing.md` | Audiences, post strategy, content ideas |
| `docs/ConvoQAClaude.md` | Session decisions log |
| `docs/LatestTask.md` | Rolling task log |
| `docs/lessons.md` | Mistakes + rules to avoid repeating |
