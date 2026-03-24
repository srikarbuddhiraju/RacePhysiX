# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 26 — 2026-03-24  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Logo integration**

- Srikar created `RacePhysiX_LightBG.png` and `RacePhysiX_DarkBG.png` (+ `RacePhysiX_master.svg`) in `docs/Logo/`
- Logo concept: charcoal wordmark "RacePhysi" + orange X-with-engineering-crosshair icon
- Copied to `public/logo-light.png` and `public/logo-dark.png`
- Added to `ParameterPanel.tsx` header — replaces plain "RacePhysiX / Vehicle Dynamics Simulator" text
- CSS theme-swap via `[data-theme]` attribute: `logo-dark-theme` / `logo-light-theme` classes in `index.css`
- Sizing: `width: 100%, height: auto` — fills panel width, AR always maintained
- Favicon placeholder added to `index.html` using `logo-dark.png` (pending X-only icon)
- All commits pushed to `main`, Cloudflare Pages auto-deployed

**Bugs fixed this session**
- Logo AR distorted by flex column stretch → fixed with `alignSelf: flex-start` then replaced with `width: 100% / height: auto`
- Logo too small → removed `maxHeight` constraint, now fills full panel width

**Favicon TODO (next session)**
- Srikar to create X-only PNG (just the crosshair icon, no wordmark)
- Drop in `public/favicon.png`, update `index.html` `<link rel="icon">` + add `apple-touch-icon`

### State
- All on `main`, pushed, live on Cloudflare Pages (commit `29eca34`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

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

**Also this session:**
- Security audit: 0 vulnerabilities, no XSS vectors, no secrets, no external calls
- Removed copyrighted textbook PDFs from git history (git filter-repo + force push)
- Added `docs/Textbooks/` and `docs/marketing.md` to .gitignore
- Created `docs/marketing.md` (private, gitignored) — working doc for marketing strategy
- Discussed marketing: phases 1–4, target audiences, content ideas, community seeding plan

### State
- All on `main`, pushed, Cloudflare Pages auto-deployed (commit `eb1e3e1`)
- Dev server: `http://localhost:5173/`
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities
- Git history clean — no PDFs, no secrets

### Next session plan

#### P0 Bugs (found on live site — 2026-03-24)
1. **[BUG] Erratic animation after param change** — When any param in the left panel (vehicle, aero, drivetrain) is changed, the arrow goes full throttle into corner 1 with absurd speeds (200–250+ kph), then brakes erratically. Behaves like the old V[0] propagation bug. Persists even after hitting Reset — suggests stale physics state or cached speed profile is not being recomputed/cleared on param change. Affects all circuits.
2. **[BUG] Braking zone before Eau Rouge (Spa)** — GT3 and F1 should be flat-out through Eau Rouge. A braking zone is shown there which is physically wrong. Root cause likely in the lap time estimator corner classification or the corner-speed solver treating Raidillon as a hairpin.
3. **[BUG] URL compression incomplete** — Preset short-codes work (e.g. `#p=f1`) but custom-param URLs are still long. Need a systematic, robust URL encoding scheme: short keys, base64 or numeric packing, max ~100 chars for any valid config.
4. **[BUG] Top/chase camera broken on Surface Pro 6** — Views distorted or misaligned on Surface Pro 6 display (likely high-DPI / non-standard aspect ratio). Site must render consistently across all desktop screen sizes and DPI scales (mobile is out of scope for now).

#### Existing plan
5. **Browser verify** — end-to-end check all Stages 23–36 in UI
6. **Stage 37** — Track banking/elevation (lateral g correction on banked corners, gradient drag/assist on hills)
7. **Stage 38** — Data export (CSV/JSON download of lap + race simulation data)
8. **Stage 39** — Telemetry replay (upload CSV from data logger, overlay vs sim)
9. **Docs + README** — User-facing docs, README, in-app landing copy (prerequisite for marketing)
10. **Marketing Phase 1** — Screenshots/GIF, first Reddit post (see `docs/marketing.md`)

#### Realism Improvement Stages (logged 2026-03-24 — start session 27+)
Priority order — each is independent, implement incrementally:

| Stage | Model | Est. realism gain | Notes |
|---|---|---|---|
| 40 | MF-Swift tyre (belt dynamics) | +10–15% | Adds lateral carcass stiffness + transient slip on top of Pacejka |
| 41 | Non-linear suspension kinematics | +10% | Camber/toe change through travel (bump steer, roll camber) — currently linearised |
| 42 | Damper model | +8% | Dynamic load transfer with damper force — improves transient accuracy |
| 43 | Aero yaw sensitivity | +5% | Cornering yaw angle → drag increase + downforce shift |
| 44 | Tyre structural thermal | +8% | Surface vs core temp differential (~30°C gradient in real tyres) |
| 45 | Pre-computed aero map (lookup table) | +15–20% | CFD offline → Cl/Cd vs yaw vs ride height 2D table → runtime interpolation |

Target: Level 2 (~85–88% accuracy) by Stage 43, Level 3 (~90–93%) by Stage 45.

#### v3 Architecture Direction — Local App + FEA (logged 2026-03-24, long-term)
Once browser feature set is complete, evolve toward a downloadable local app with real FEA physics.

**Stack:**
- Frontend: React (unchanged)
- App wrapper: Tauri (Rust backend, ~10MB overhead vs Electron's ~150MB)
- FEA solver: Rust → compiled to native (local app) or WASM (browser fallback)
- GPU compute: WebGPU for matrix assembly/solve on consumer GPU

**FEA scope:**
| Component | Approach | Notes |
|---|---|---|
| Tyre contact | Shell ring model, ~200–500 elements, explicit integration | Replaces/augments Pacejka. ~500–1000 Hz on CPU, higher on GPU. Srikar to lead physics formulation. |
| Chassis compliance | Static FEA, beam elements | Solve once per param change (<1s). Feeds suspension kinematics. |
| Aerodynamics | Pre-computed CFD table (lookup) | CFD not real-time feasible — tables remain correct approach. |

**Why Tauri + Rust WASM:**
- WASM module works in browser (limited perf) AND local app (full perf) — same codebase
- Rust is ideal: zero-cost abstractions, BLAS/LAPACK bindings, safe memory
- No existing open-source consumer tyre shell FEA exists — this would be novel

**Realism ceiling:** ~95%+ for tyre dynamics (vs ~85% with MF-Swift). Matches FTire-class accuracy on consumer hardware.

**Prerequisite:** Stages 40–45 complete, browser v2 stable, Srikar to draft tyre shell FE formulation.

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
