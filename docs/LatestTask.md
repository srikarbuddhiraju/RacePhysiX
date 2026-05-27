# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 40 — 2026-05-27  |  branch: `main` (COMPLETE ✅)

### Canvas button layout fix
- [x] Canvas top-left buttons (🌙, ?, Docs) grouped into a single `position:absolute` flex container
- [x] `.theme-toggle` CSS: removed individual absolute positioning (lives in flex group now)
- [x] `ViewLabel` in TopDownView: `panelLeft + panelWidth + textAlign:center` — labels centred in their panels at all screen widths, no pixel-gap fragility
- [x] `tsc --noEmit` clean, `npm run build` clean — merged to `main`
- [x] ConvoQAClaude.md: all stale session 4–11 `[ ]` items marked `[x]`

### Monetisation + roadmap strategy
- [x] Competitive analysis completed — RacePhysiX uncontested in browser-based space; OptimumLap is the incumbent to displace
- [x] Licence decision: MIT → AGPL v3 + commercial dual licence
- [x] Tier design agreed: Free (all current) / Pro £6–8/month / Team £20–25/month / Consulting
- [x] FS teams identified as priority revenue wedge
- [x] v3 FEA direction confirmed: Tauri + Rust WASM + WebGPU, 200–500 element tyre shell
- [x] `docs/monetisation.md` created — full licence + tier + action plan
- [x] `docs/roadmap.md` created — v1/v2/v3 milestones + FEA prerequisites
- [x] `docs/project-overview.md` rewritten (was severely stale from Session 3)
- [x] `docs/marketing.md` monetisation stub updated to point to monetisation.md
- [x] `.gitignore` updated: monetisation.md + roadmap.md added (private strategy docs)

### State
- Branch: `main`, live on Cloudflare Pages
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors, 0 npm vulnerabilities, build clean

### Next session priorities (in order)
1. ~~**Licence change**~~ ✅ Done — AGPL-3.0-or-later + COMMERCIAL_LICENSE.md, v1.0.0
2. **GitHub Sponsors** — Set up page (30 min, covers hosting costs immediately)
3. **Marketing Phase 1** — README improvements, 2–3 screenshots/GIF, first community post
4. **Pro waitlist landing page** — Simple "notify me" form before building auth/billing
5. **M5b** — 3D brake glow + body roll/pitch (deferred visual enhancement)

---

## Session 39 — 2026-05-27  |  branch: `main` (COMPLETE ✅)

### Security audit + UX fixes

- [x] npm audit: found vite 6.4.1 (HIGH — GHSA-p9ff-h696-f583 dev WebSocket file read) + postcss (moderate XSS)
- [x] react-markdown missing from node_modules (lock file had it, node_modules did not — broken build)
- [x] `npm install` + `npm audit fix` → vite 6.4.2, postcss 8.5.15, react-markdown 10.1.0 installed
- [x] 0 npm vulnerabilities, build clean — committed `88c26a7`
- [x] All Session 38 + Session 36 browser verify items marked complete (Srikar confirmed clean)
- [x] Obsidian notebook updated to match actual project state (all 48 stages, full task/notes/bugs)
- [x] Button overlap fix: "Top View" label moved left:46px → left:115px (clears theme/? /Docs buttons)
- [x] Corner numbering: segment breakdown now shows T1·R60m, T2·R20m etc. instead of bare R60m
- [x] Confirmed ViewLegend already has strut + downforce arrow entries — no change needed
- [x] Build + 37/37 physics checks pass — merged `8f4d453`

### State
- Branch: `main`, live on Cloudflare Pages (commit `8f4d453`)
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors, 0 npm vulnerabilities, build clean
- Obsidian: `/home/srikarbuddhiraju/Srikar/Notebook/Projects/RacePhysiX/` — fully up to date
- No open UX items, no open bugs

---

## Session 38 — 2026-04-23  |  branch: `feature/documentation` (COMPLETE ✅)

### Documentation — in-app popup + /docs page

- [x] Feature branch `feature/documentation` created
- [x] `react-markdown` v10.1.0 installed
- [x] `public/docs/getting-started.md` — 3-step intro, audience table, result definitions
- [x] `public/docs/user-guide.md` — every panel, tab, control, and output documented
- [x] `public/docs/physics-overview.md` — all stages, formulas, derivations, validation
- [x] `public/docs/circuits.md` — all 22 circuits, GPS attribution, banking data, limitations
- [x] `public/docs/faq.md` — general, usage, physics, and technical questions
- [x] `src/components/DocsPage.tsx` + `DocsPage.css` — sidebar nav, react-markdown render, version footer
- [x] `src/components/WelcomeModal.tsx` — full-screen modal, "Don't show again" checkbox, docs link
- [x] `src/App.tsx` — hash routing (#docs), WelcomeModal wired, Help (?) + Docs buttons added
- [x] `tsc --noEmit` clean, `npm run build` clean

### Verification — browser verified 2026-05-27 ✅
- [x] Browser verify: modal appears on load, "Don't show again" persists, "Start Exploring" dismisses
- [x] Browser verify: ? button re-opens modal, Docs button navigates to /docs
- [x] Browser verify: all 5 docs sections load and render markdown correctly
- [x] Browser verify: internal doc links (e.g. [Physics Models](physics-overview)) navigate correctly
- [x] Browser verify: "Back to Simulator" returns to simulator state

### State
- Merged to `main`, live on Cloudflare Pages
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors, build clean

---

## Session 37 — 2026-04-11  |  branch: `feature/fix-ui-layout-surface` (IN PROGRESS)

### UI Layout — Surface Pro 6 responsive fixes

- [x] `App.css`: `max-height: 880px` → `app-main: 50-51%` (gives charts more vertical space)
- [x] `ResultsPanel.css`: `max-width: 1400px` → 240px (covers 1368px Surface Pro width)
- [x] `ChartsPanel.css`: compact controls at `max-height: 880px` (tighter tabs, hide preset desc)
- [x] `TrackVisualiser.tsx`: left overlay 188→170px, right overlay 200×270→182×248px

### Pending verification
- [x] Browser verify on Surface Pro 6: charts taller, layout correct ✓
- [x] Top View / Chase View vectors aligned (DPR double-scaling fixed) ✓
- [x] Verified no regressions (build clean, Srikar confirmed "looks good")

### State
- Merged to `main`, commit `a77fdd9`, live on Cloudflare Pages
- SSH key configured for all 3 repos (Surface Pro 6 Ubuntu)

---

## Session 36 — 2026-04-01  |  branch: `main` (COMPLETE ✅)

### Advanced tab label fix
- [x] Changed `adv-header` `align-items: baseline` → `center` + `min-height: 18px` (header was collapsing)
- [x] Split label: coefficient symbol coloured inline, description text uses `var(--text-muted)` (readable in both themes)
- [x] Added `.adv-label-desc` CSS class

### Stage 48 — Vehicle Setup JSON import/export
- [x] `vehicleSetup.ts`: `exportSetupJSON()` (browser download) + `validateSetupJSON()` (75 VehicleParams + 4 coeffs — type + range)
- [x] `VehiclePresetSelector`: ↓ Export + ↑ Import buttons after Reset separator; inline banner for errors/warnings; "Apply anyway" for hard-error state
- [x] `App.tsx`: passes `params` + `coeffs` to selector

### Verification — browser verified 2026-05-27 ✅
- [x] Browser verify: Export downloads valid JSON → re-import → Δ = 0 on lap time
- [x] Browser verify: Import with out-of-range field → yellow warning banner shown, setup applied
- [x] Browser verify: Import with missing field → red error banner, "Apply anyway" visible
- [x] Advanced tab: labels visible in both light and dark themes

### State
- Branch: `main`, merged commit `4c6d678`, live on Cloudflare Pages
- Physics: 37/37 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, build clean

---

## Session 35 — 2026-03-26  |  branch: `main` (COMPLETE ✅)

### Stage 47 — Visual Enhancements — MERGED TO MAIN (commit `ef8e20b`)

- [x] M1: buildLapTrace extended with tyreTempC, brakeDiscTempC, throttlePct, brakePct, sectorIndex; sectorSplits.ts for all 22 circuits
- [x] M2: Left overlay panel (floating card) — 4-corner tyre+brake temps, sectors S1/S2/S3, TC/Turbo/ERS icons, tyre wear bars
- [x] M3: Right overlay panel — G-G diagram + dashed friction circle, Full Lap/Live toggle, live Lat-G/Long-G numerical readout below diagram
- [x] M4: Bottom telemetry strip — Throttle%/Brake% bars + brake fade indicator (gated on brakePct > 5)
- [x] M5a: Car-centred view + minimap + Chase view; panel open/close buttons; fullscreen; 1×/4×/8× playback
- [x] Bug fixes: GPS lap time mismatch, GPS throttle/brake from zone model, SVG hi-res (geometricPrecision)
- [ ] M5b: 3D effects (brake glow, body roll/pitch) — deferred, needs Three.js

**Next session (Stage 48):** Vehicle setup JSON import/export — all VehicleParams + PacejkaCoeffs, validation layer, "Apply anyway" option, buttons in preset row.

### State (session start)
- Branch: `main`, commit `d22ae79` (Stage 46 merged)
- Physics: 37/37 checks pass | 424/424 extended tests pass
- 0 TypeScript errors (`tsc -b` clean)

---

## Session 32 — 2026-03-25  |  branch: `feature/stage-42-45-suspension-damper-aero-thermal` (COMPLETE ✅)

### Completed this session

**Stages 42–45** (commit `0db6ef3`)

- **Stage 42 — Motion ratio**: `kWheel = spring × MR²` in `suspension.ts`; `dynamics14dof.ts` passes `frontMotionRatio`/`rearMotionRatio`; 4 presets updated (road 1.0, FS 0.8, GT3 0.9, F1 0.85)
- **Stage 43 — Roll damper**: `cPhi = 2 × ζ × sqrt(KPhiTotal × Ixx)` in `dynamics14dof.ts`; `ζ = params.rollDamperRatio ?? 0.7`; replaces hardcoded 0.4
- **Stage 44 — Crosswind in balance model**: `crosswindLateralForceN` from `ambient.ts` added to `FyFrontReq`/`FyRearReq` in `pacejkaModel.ts`; no new params
- **Stage 45 — Tyre thermal core**: `computeCoreTemp` in `tyreTemp.ts`; `coreTemp = (1−lag)×surface + lag×ambient`; `computeTyreEffectiveMu` now evaluates μ at `coreTemp`; lag=0 backward-compatible
- UI sliders for MR (Stage 42), roll damper ζ (Stage 43), core heat lag (Stage 45) in ParameterPanel Suspension + Tyres tabs
- SHORT_KEYS: `fmr/rmr/rdr/tch` added to App.tsx

### State
- Branch: `feature/stage-42-45-suspension-damper-aero-thermal` (commit `0db6ef3`)
- Physics: **32/32** checks pass | **424/424** extended tests pass
- 0 TypeScript errors (`tsc -b` clean)
- Ready to merge to `main`

---

## Session 31 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Stage 40 — MF-Swift combined slip** (commit `922eacb`, merged `5de4902`)

- `pacejkaFx(κ, Fz, peakMu, qFz, Fz0)`: longitudinal Pacejka, Bx=12.0, Cx=1.65, Ex=−0.80
- `combinedSlipGky(κ)`: cos(Cκy × arctan(Bκy × κ)) — proper Pacejka '96 Fy reduction
- `combinedSlipGxa(α)`: cos(Cxα × arctan(Bxα × α)) — proper Fx reduction
- `solveSlipAngleTyreAxle`: Kamm circle replaced with Gky (physically accurate at moderate slip)
- Checks 15a–c: Gky(0/0.1/0.2) verified against Pacejka §4.3.2

**Stage 41 — Roll centre height + dynamic camber** (same commit)

- 4 new `VehicleParams`: `frontRollCentreHeightMm` (30 mm), `rearRollCentreHeightMm` (40 mm), `camberGainFront` (0.7), `camberGainRear` (0.5)
- `loadTransfer.ts`: geometric + elastic split — ΔFz_geom = m×ay×fwf×rcH/TW; RC=0 → identical to old formula
- `pacejkaModel.ts`: dynamic camber = staticCamber − rollAngle × camberGain → feeds camber thrust (ΔFy_F22/R22)
- 4 sliders in ParameterPanel Suspension tab under "Roll Centre Heights (Stage 41)"
- Checks 16a–b: RC load transfer formula + dynamic camber verified

**Post-merge validation fixes** (commits `4419997`, `9192b6d`)

- Build was failing (`tsc -b` stricter than `--noEmit`): 4 presets + validate.ts + test-extended.ts missing Stage 41 fields; unused imports in TelemetryOverlayChart + App.tsx — all fixed
- `buildHandlingCurve` was using RC=0 load transfer even when user set RC heights → fixed by passing `rcF_m/rcR_m` through
- Track minimap / zone overlay / animation confirmed unaffected (isolated from Stage 40+41 code path)
- 424/424 extended tests, 28/28 validation checks pass post-fix

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `9192b6d`)
- Physics: 28/28 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Next session plan
1. **Docs + README update** — add Stages 40–41 to physics table
2. **Marketing Phase 1** (deferred — Srikar away)
3. **Multi-device testing** (Surface Pro 6 + real users — deferred)

---

## Session 30 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**URL compression + desktop responsive layout** (merged `57d7e6c`)

URL:
- Short-key map: 56 VehicleParams fields → 2–3 char codes
- Nearest-preset encoding: `#p=gt3&{tiny-b64}` (~28 chars) vs old ~950 chars
- Backwards-compatible: old full-key base64 URLs still decode

Layout:
- `min-width: 900px` on `.app` — horizontal scroll before collapse
- 1100px breakpoint: panels shrink to 200px, canvas gets more space
- `max-height: 700px` query: vertical scroll on short screens, charts accessible
- ChartsPanel: collapses to 1-column at ≤1000px
- Multi-device testing deferred (will test on different devices later)

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `57d7e6c`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

---

## Session 29 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Stage 39 — Telemetry overlay** (commit `81dcc85`, merged `9dd77cb`)

- "Import Telemetry" button in Lap Time panel — uploads any CSV with `dist_m` + `speed_kph`
- Accepts Stage 38 Lap Trace format natively (parses circuit/lap metadata from header comments)
- Three overlaid Recharts: Speed / Lat-G / Long-G vs distance (m)
- Sim = orange, Uploaded = sky-blue; Δ top speed, Δ min corner, Δ lap time stats row
- Live update: changing params updates sim line; uploaded trace stays fixed
- Self-consistency: export Lap Trace → re-import → all Δ values = 0 ✓
- New files: `parseTelemetryCSV.ts` (parser + interp helper), `TelemetryOverlayChart.tsx`

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `9dd77cb`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Next session plan
1. **URL compression** — custom-param URLs still long
2. **Docs + README**, **Marketing Phase 1**
3. **Multi-device / user testing** — Surface Pro 6 + real users (future session)

---

## Session 28 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**Stage 38 — Data export** (commit `785af88`, merged `0ed7919`)

Three export buttons in Lap Time panel:
- **Lap Summary** (renamed): params + per-segment breakdown CSV (existing)
- **Lap Trace**: single-lap high-res telemetry, ~5 m steps, ~1400 pts/lap at Spa
  Columns: `dist_m, time_s, speed_kph, gear, rpm, long_g, lat_g, zone`
- **Race Telemetry**: all laps concatenated, per-lap summary header
  Header: fastest lap, lap_time_s, sector times, tyre_temp, tyre_wear, fuel_kg, brake_temp_c

New files: `src/physics/gearUtils.ts` — shared `computeGearRPM` (gear hysteresis, redline logic)
New function: `buildRaceLapTraces` — per-lap physics scaling (μ×wear, fuel mass, brake fade)

Verified by Srikar: all 3 CSVs downloaded, physics correct (lap 1 slow cold tyres, fastest lap 6)

---

**Stage 37 — Track banking & elevation** (commit `aa5d0a5`)

Physics: banked corner FBD (Milliken RCVD §2.5):
- `muEff = μ cosθ + sinθ` — gravity assists centripetal force on banked road
- `gradientPct` on straights: `F_grade = mg sinα` reduces drive accel; assists braking uphill
- GPS circuits: `BankingProfile` lookup in `buildGpsZoneOverlay` raises `vMax[i]`

Circuit data added:
| Circuit | Corner | Banking | Effect |
|---|---|---|---|
| Spa | Eau Rouge | 5° | GT3 flat-out (208 kph) ✓ |
| Spa | Raidillon | 6° | GT3 flat-out (235 kph) ✓ |
| Spa | Uphill to Eau Rouge | 18% gradient | Reduced accel on uphill run |
| Spa | Kemmel Straight | -4% gradient | Slight downhill speed boost |
| Monza | Parabolica | 3° | Slight corner speed increase |
| Silverstone | Copse | 3° | Slight corner speed increase |
| Suzuka | 130R | 2° | Slight corner speed increase |

Verified by Srikar in UI: Eau Rouge/Raidillon zone overlay **blue (full-throttle)** for GT3 ✓

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `0ed7919`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Remaining P0 bugs
1. ~~Erratic animation after param change~~ FIXED ✓
2. ~~Race simulation wrong speeds on GPS circuits~~ FIXED ✓
3. ~~Eau Rouge braking zone~~ FIXED ✓ (Stage 37 banking)
4. **URL compression** — custom-param URLs still long
5. **Surface Pro 6 camera** — needs device testing

### Next session plan
1. **Stage 39** — Telemetry replay (upload CSV from data logger, overlay vs sim)
2. **Browser verify** — end-to-end check all Stages 23–38 in UI
3. **Docs + README**, **Marketing Phase 1**

---

## Session 27 — 2026-03-25  |  branch: `main` (COMPLETE ✅)

### Completed this session

**P0 Bug fix: erratic animation after param change + race simulation on GPS circuits**

Two root causes fixed in `TrackVisualiser.tsx`:

1. **Stable tick / stale-ref race condition** — `tick` was in `useCallback([playing, params])`, so every param change restarted the RAF. New RAF fired before `gpsAnimRef` could update → stale speed profile locked in. Fix: `paramsRef` pattern, `tick` now `useCallback([playing])` only — RAF never restarts on param change.

2. **Race simulation on GPS circuits** — Race animation block fell through to schematic-trace code even on GPS circuits. Schematic distance fractions applied to GPS SVG path → wrong positions + telemetry. Fix: GPS branch inside race animation block uses `tGps = t * gpsA.lapTimeSec` → `gpsAtTime()` for correct GPS-path animation.

**Commits:** `a47cda5`, `43fea13`, `b6e0070` — merged to `main`

### Eau Rouge braking zone — known limitation

- **GT3**: flat-road model correctly brakes at Raidillon (R ~115-150m, threshold R > 185m for flat-out). Real-world flat-out requires banking (~4-8° at Raidillon). Fix: Stage 37 (track banking).
- **F1**: should be flat-out (threshold R > 109m). If F1 shows braking → possible GPS curvature artifact; needs curvature debug.

### State
- Branch: `main`, pushed, live on Cloudflare Pages (commit `b6e0070`)
- Physics: 21/21 checks pass | 424/424 extended tests pass
- 0 TypeScript errors, 0 npm vulnerabilities

### Remaining P0 bugs
1. ~~Erratic animation after param change~~ FIXED ✓
2. ~~Race simulation wrong speeds on GPS circuits~~ FIXED ✓
3. **Eau Rouge braking zone** — GT3 known limitation (Stage 37); confirm F1 behaviour
4. **URL compression** — custom-param URLs still long; needs short-key map + binary packing
5. **Surface Pro 6 camera** — needs device testing

### Next session plan
1. **Stage 37** — Track banking/elevation (fixes Eau Rouge for GT3)
2. **Stage 38** — Data export (CSV/JSON)
3. **Stage 39** — Telemetry replay
4. **Browser verify** — end-to-end check all Stages 23–36 in UI
5. **Docs + README**, **Marketing Phase 1**

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

#### Realism roadmap (Stages 40–45 — future)
MF-Swift tyres (+15%), non-linear suspension (+10%), damper model (+8%), aero yaw (+5%), tyre thermal core (+8%), pre-computed CFD map (+20%). Target ~93% accuracy by Stage 45.

#### v3 (long-term): Tauri + Rust WASM + tyre shell FEA (~95% accuracy). Srikar to lead FE formulation.

---

## Sessions 1–27 — COMPLETE / MERGED

Stages 1–37: full physics from bicycle model through track banking/elevation.
See git history for details.
22 GPS circuits. 424/424 tests. See git history.
