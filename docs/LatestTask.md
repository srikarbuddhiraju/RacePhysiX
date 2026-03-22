# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 25 — 2026-03-22  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Bug fixes deployed to main + Cloudflare Pages**

| Fix | Root cause | Files |
|---|---|---|
| Top speed 800-900 kph for F1/GT3 | `computeMaxSpeed` used only gearbox limit (redline-in-top-gear), ignoring power-drag balance. F1 gave 954 kph. | `gearModel.ts`, `validate.ts` |
| Speed jumps 200→338 kph at S/F | `vBoundary` was set after Euler passes — V[1]…V[N-1] still computed from old V[0]=vTop. Post-reconciliation passes not run. | `TrackVisualiser.tsx` |
| Animation always starts at S/F (zero feel) | `startRef.current = timestamp` always started at tGps=0 (S/F). | `TrackVisualiser.tsx` |
| URL too long (~500 chars for presets) | Full params blob always encoded, even for presets. | `App.tsx` |
| No reset button | — | `VehiclePresetSelector.tsx`, `App.tsx` |

**Fix details:**
- `computeMaxSpeed` now `min(gearbox, power-drag)`: F1 338 kph ✓, GT3 279 kph ✓, Road 273 kph ✓, FS 172 kph ✓
- TrackVisualiser: 4→8 main Euler iters + 4 post-reconciliation passes to propagate corrected V[0]
- Rolling start: `startRef` offset by random fraction of lap time on first load
- URL: preset → `#p=f1` (7 chars), diff-only encoding for custom params, old URLs auto-recompressed on load
- Reset button in Vehicle row — restores all params + Pacejka coeffs, clears URL hash
- All 21 physics checks pass, 0 TS errors

### State
- All on `main`, pushed, Cloudflare Pages auto-deployed (commit `9148667`)
- Dev server: `http://localhost:5173/`
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors

### Next session plan
1. **Browser verify** — end-to-end check all Stages 23–36 in UI (speeds, compound selector, strategy optimizer, ERS, multi-car comparison)
2. **Stage 37** — Track banking/elevation (lateral g correction on banked corners, gradient drag/assist on hills)
3. **Stage 38** — Data export (CSV/JSON download of lap + race simulation data)
4. **Stage 39** — Telemetry replay (upload CSV from data logger, overlay vs sim)
5. **Docs update** — README + all user-facing docs updated after Stages 37–39 complete

---

## Session 24 — 2026-03-22  |  COMPLETE ✅

Stages 23–36: tyre wear, ambient, driver model, differential, brake temp, tyre pressure,
ride height, strategy optimizer, torque curve, TC, rubber, wet track, ERS, multi-car comparison.
Aero tab → "Aero & Braking". kW/BHP/PS toggle. All 4 presets carry all fields.

---

## Sessions 1–23 — COMPLETE / MERGED

Stages 1–22: full physics from bicycle model through camber+toe.
Stage 18–22: presets, onboarding, setup comparison, about, camber+toe.
22 GPS circuits. 424/424 tests. See git history.
