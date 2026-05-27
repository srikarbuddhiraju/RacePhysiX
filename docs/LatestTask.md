# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 42 — 2026-05-27  |  branch: `fix/corner-radii` (COMPLETE ✅)

### Part A — Fix broken circuit segment lengths (merged)
Hockenheim/Spielberg/Zandvoort/São Paulo had segment totals 480–1200m shorter than claimed — produced wildly wrong lap times. All four now exact:
- [x] Hockenheim 4574m ✓ | Spielberg 4318m ✓ | Zandvoort 4259m ✓ | São Paulo 4309m ✓

### Part B — Fix circuit corner radii
**Problem:** Several hand-designed circuits had hairpin/chicane radii that were unrealistically tight, making affected circuits run seconds too slow (São Paulo) or too fast (Zandvoort).

**11 radius corrections across 4 circuits:**

| Corner | Old R | New R | Old speed | New speed | Note |
|---|---|---|---|---|---|
| São Paulo: Senna S T1 | 25m | 65m | 74 km/h | 119 km/h | Chicane, not hairpin |
| São Paulo: Senna S T2 | 25m | 60m | 74 km/h | 114 km/h | |
| São Paulo: Ferradura | 16m | 28m | 59 km/h | 78 km/h | Real R≈25-30m |
| São Paulo: Mergulho | 40m | 65m | 93 km/h | 119 km/h | Medium-speed left |
| São Paulo: Pinheirinho | 40m | 55m | 93 km/h | 109 km/h | |
| São Paulo: Cotovelo | 40m | 50m | 93 km/h | 104 km/h | |
| São Paulo: Subida dos Boxes | 50m | 80m | 104 km/h | 132 km/h | Final corner, too tight |
| Zandvoort: Tarzan hairpin | 25m | 20m | 74 km/h | 66 km/h | Real min ~60-70 km/h |
| Zandvoort: Marlboro hairpin | 25m | 20m | 74 km/h | 66 km/h | Same |
| Hockenheim: Spitzkehre | 16m | 22m | 59 km/h | 69 km/h | Real ~70-80 km/h |
| Brands Hatch: Druids | 14m | 19m | 55 km/h | 64 km/h | Real ~60-70 km/h |

**GT3 lap time results — before → after (BMW M4 GT3 2023 qualifying):**

| Circuit | Before (Sess 41) | After (now) | Est. range | OK? |
|---|---|---|---|---|
| São Paulo | 1:44.179 (10s slow) | **1:33.863** | 1:32–1:40 | ✓ |
| Zandvoort | 1:29.599 (2s fast) | **1:31.306** | 1:31–1:39 | ✓ |
| Hockenheim | 1:35.660 | **1:34.845** | 1:33–1:41 | ✓ |
| Spa | 2:13.782 | 2:13.782 | 2:14–2:20 | ~✓ |
| Monza | 1:50.233 | 1:50.233 | 1:47–1:50 | ~✓ |
| Silverstone | 2:00.782 | 2:00.782 | 1:58–2:03 | ✓ |
| Spielberg | 1:25.236 | 1:25.236 | 1:21–1:29 | ✓ |

- [x] `npx tsc --noEmit` → 0 errors
- [x] `npx tsx src/physics/validate.ts` → 37/37 checks, 424/424 extended

### State
- Branch: `fix/corner-radii` (ready to merge)
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors

### Next session priorities (in order)
1. **GitHub Sponsors** — Set up page (deferred from Session 40)
2. **Marketing Phase 1** — README improvements, screenshots, community post
3. **Pro waitlist landing page** — Simple "notify me" form
4. **M5b** — 3D brake glow + body roll/pitch (deferred)

---

## Session 41 — 2026-05-27  |  branch: `main` (COMPLETE ✅)

### Accuracy push — Pacejka MF coefficient overhaul

**Key finding:** Road tyre E was wrong sign. Validated against Pacejka "Tire and Vehicle Dynamics" 3rd ed.
(2012) Appendix 3 — real measured 205/60R15 91V dataset (TNO MF-Tyre/MF-Swift 6.1, Fzo=4000 N).

**Road tyre** (from real Appendix 3 data, free academic public domain):
- [x] B: 10→11 (derived: BCD_y = pKy1×Fzo×sin(2arctan(1/pKy2)) / (C×D) → B≈11.4)
- [x] C: 1.30→1.34 (pCy1=1.338)
- [x] μ: 1.00→0.88 (pDy1=0.8785 — real dry road tyre peak)
- [x] E: −1.50→**+0.80** (pEy1=+0.8057 — POSITIVE = gradual saturation, correct road tyre shape)

**Racing slicks** (Pacejka Ch.4 §4.3.1 + Fig.4.10 guidance):
- [x] FS:  C 1.30→1.50, μ 1.80→1.75, E −0.80→**−2.50** (sharp peak ~5°, pronounced dropoff)
- [x] GT3: B 10→11, C 1.35→1.45, μ 1.60→1.55, E −0.70→**−1.50** (moderate peak ~7°)
- [x] F1:  C 1.40→1.50, μ 2.00→1.95, E −1.00→**−2.00** (early peak ~4°, ultra-stiff slick)
- [x] DEFAULT_PACEJKA_COEFFS updated to match corrected road tyre profile
- [x] vehiclePresets.ts: all 4 presets updated + source comments citing Appendix 3 + Pacejka Ch.4

**Validation:** 37/37 checks pass. TypeScript clean. Merged to `main`.

**Physical interpretation of E values (now correct):**
- Road: E > 0 → force builds gradually and saturates (no peak-then-drop). Real road tyre shape.
- FS/GT3/F1: E < 0 → sharp peak then dropoff past peak slip angle. Classic slick behaviour.
  The more negative, the more sensitive past the peak (F1 most sensitive at E=−2.0).

**Source:** Pacejka, H.B. (2012). *Tire and Vehicle Dynamics* (3rd ed.). Appendix 3.
Tyre: 205/60R15 91V. No proprietary data used.

### State
- Branch: `main`, live on Cloudflare Pages
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors, build clean

### Next session priorities (in order)
1. **Validation against real-world lap times** — calibrate against published GT3/F1 lap times at Spa/Silverstone (check if μ changes affect predicted times correctly)
2. **GitHub Sponsors** — Set up page (deferred from Session 40)
3. **Marketing Phase 1** — README improvements, screenshots, first community post
4. **Pro waitlist landing page** — Simple "notify me" form
5. **M5b** — 3D brake glow + body roll/pitch (deferred)

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

## Sessions 1–36 — COMPLETE / MERGED

Stages 1–46: full physics stack, 22 GPS circuits, 424/424 tests. See git history.
