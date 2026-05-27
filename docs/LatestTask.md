# Latest Task — RacePhysiX

Rolling log. 200-line limit — trim oldest entries when exceeded.

---

## Session 44 — 2026-05-27  |  branch: `main` (COMPLETE ✅)

### Theme consistency + v1.1.0 versioning + waitlist email

- [x] `src/utils/theme.ts` — single localStorage-based theme source of truth (`racephysix_theme`)
- [x] LandingPage, ProWaitlistPage, App.tsx all use `getStoredTheme()` / `setStoredTheme()` — theme persists across navigation
- [x] App.tsx: `← Home` button in canvas overlay top-left (same style as Docs / ?)
- [x] DocsPage.css: `color: #f87171` → `var(--color-error)` — docs light mode fully tokenised
- [x] index.css: `--color-error`, `--color-success`, `--color-warn` added to both dark and light token blocks
- [x] Version bumped `1.0.0 → 1.1.0` — displayed in landing footer, WelcomeModal, README badge, docs FAQ
- [x] Landing nav logo: 28px → 38px (was too small)
- [x] Landing footer logo: `align-self: flex-start` fix (was skewed by column-flex stretch)
- [x] Waitlist Worker: confirmation email via Resend after every new signup
  - Dark-themed HTML email + plain-text fallback
  - From: `noreply@racephysix.srikarbuddhiraju.com`
  - Contact section mentions `racephysix@srikarbuddhiraju.com`
  - Graceful: skipped silently if `RESEND_API_KEY` not yet set
  - Idempotent: already-signed-up emails don't get re-sent
- [x] All commits pushed to main, live on Cloudflare Pages

### Open items (your tasks)
- [ ] **Task #3** — Resend setup: create account → verify domain → `wrangler secret put RESEND_API_KEY`
- [ ] **Task #2** — Re-deploy Worker (do after Task #3): `cd workers/waitlist && git pull && npx wrangler deploy`
- [ ] Community posts: r/simracing → r/FormulaStudent → r/formula1

### Next session — first item
- [ ] **Task #4** — Docs still say MIT licence in at least one place. Grep `public/docs/` for "MIT", replace all with AGPL-3.0. Quick fix.

### State
- Branch: `main`, all commits pushed, live on Cloudflare Pages
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors, build clean (racephysix@1.1.0)

---

## Session 43 — 2026-05-27  |  branch: `main` (COMPLETE ✅)

### Marketing Phase 1 — README, Screenshot, GitHub Sponsors, Pro Waitlist

#### README overhaul
- [x] Visitor-first hook: tagline + live demo badge + sponsor badge at top
- [x] GT3/Spa screenshot captured via Playwright (banner dismissed automatically)
- [x] "Who it's for" table moved above feature lists
- [x] GT3 validation table added (8 circuits, before/after lap times)
- [x] 46-stage physics table collapsed into `<details>` block
- [x] `docs/assets/screenshot-main.png` committed (gitignored going forward)

#### GitHub Sponsors
- [x] `.github/FUNDING.yml` created — Sponsor button on GitHub sidebar
- [x] `SPONSORS.md` placeholder created
- [x] README sponsor badge added
- [x] Profile submitted — awaiting GitHub approval (1–3 days)

#### Pro waitlist landing page `/pro`
- [x] `src/components/ProWaitlistPage.tsx` + `ProWaitlistPage.css` — full page, dark theme, design tokens
- [x] Route detection in `main.tsx` — `/pro` renders waitlist, all else renders App
- [x] Email form → Cloudflare Worker (replaced Formspree)
- [x] End-to-end Playwright screenshot verified — all sections render correctly

#### Cloudflare Worker — waitlist backend
- [x] `workers/waitlist/index.ts` — POST /waitlist (store email in KV), GET /waitlist?secret=X (CSV dump)
- [x] KV namespace provisioned: `e87ab07fc61e4f9ebb496ccec5b353bb`
- [x] `ADMIN_SECRET` set via `wrangler secret put`
- [x] Deployed and live: `racephysix-waitlist.srikarbuddhiraju.workers.dev`
- [x] POST valid email → `{ ok: true }` ✓ | invalid email → `{ ok: false, error }` ✓

#### Community posts
- [x] r/FormulaStudent, r/simracing, r/formula1 posts drafted (in session chat)

### Open items
- [ ] **Task #2** — Re-deploy Worker from local machine: `cd workers/waitlist && git pull && npx wrangler deploy` (picks up warning-suppression config)
- [ ] Post to r/simracing first, then r/FormulaStudent, r/formula1
- [ ] Set up Formspree → replaced by CF Worker (done, nothing needed)
- [ ] Swap `FORMSPREE_ID` → N/A (CF Worker used instead)

### Download your waitlist at any time
```
https://racephysix-waitlist.srikarbuddhiraju.workers.dev/waitlist?secret=<ADMIN_SECRET>
```

### State
- Branch: `main`, all commits pushed, live on Cloudflare Pages
- Physics: 37/37 checks | 424/424 extended tests — unchanged
- 0 TypeScript errors, build clean

### Next session priorities
1. **Community posts** — post r/simracing, r/FormulaStudent, r/formula1
2. **Pro tier build** — auth + billing + cloud saves (3–4 sessions)
3. **Team / FS Edition** — multi-user workspace
4. **M5b** — 3D brake glow + body roll/pitch (deferred)

---

## Session 42 — 2026-05-27  |  branch: `fix/corner-radii` (COMPLETE ✅)

### Part A — Fix broken circuit segment lengths (merged)
Hockenheim/Spielberg/Zandvoort/São Paulo had segment totals 480–1200m shorter than claimed.
- [x] Hockenheim 4574m ✓ | Spielberg 4318m ✓ | Zandvoort 4259m ✓ | São Paulo 4309m ✓

### Part B — Fix circuit corner radii
11 radius corrections across 4 circuits. GT3 lap time results:

| Circuit | Before | After | Est. range | OK? |
|---|---|---|---|---|
| São Paulo | 1:44.179 | **1:33.863** | 1:32–1:40 | ✓ |
| Zandvoort | 1:29.599 | **1:31.306** | 1:31–1:39 | ✓ |
| Hockenheim | 1:35.660 | **1:34.845** | 1:33–1:41 | ✓ |

- [x] `npx tsc --noEmit` → 0 errors
- [x] 37/37 checks | 424/424 extended tests

---

## Sessions 1–41 — COMPLETE / MERGED

Stages 1–48: full physics stack, 22 GPS circuits, 424/424 tests. See git history.
