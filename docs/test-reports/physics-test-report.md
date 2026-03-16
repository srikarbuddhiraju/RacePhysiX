# ApexSim Physics Test Report — 2026-03-15

## Build & TypeScript
PASS. 0 errors. Build 4.62s. Advisory: index chunk 1097 kB (non-blocking for v1).

## validate.ts — 10/10 PASS
All bicycle model, Gillespie ref, suspension, aero, braking ABS, Stage 8 checks pass.

## test-extended.ts — 178/178 PASS
All sections A–H pass.

## Code Review — Issues Found & Status

| # | Severity | Issue | Status |
|---|---|---|---|
| 1 | ~~HIGH~~ | Spa 1000m short — code review agent arithmetic error; Spa was already 7004m ✓ | False alarm |
| 2 | MEDIUM | Final-straight braking wrap: last straight had no braking target on lap close | **FIXED** — scans forward for next corner |
| 3 | LOW | 3 hairpins ~180.1–180.7° (rounding artefact at π×R) | Acceptable — <1° |
| 4 | LOW | `direction` tags dead data in physics engine | Known open item |
| 5 | LOW | Axle-lift silently clamped — no lift flag returned | Accepted v1 limitation |
| 6 | INFO | a/b naming follows Gillespie not SAE/Milliken | Documented, no change |

## Lap Time Engineering
Ratios vs F1: Monaco 1.57×, Monza 1.71×, Spa 1.66×, Silverstone 1.70×, Suzuka 1.68×.
Plausible for 1500 kg / 200 kW / μ=1.1 car. Circuit hierarchy correct.

## Known Model Limitations (v1)
- No rolling resistance
- Point-mass corner model (constant speed through arc)
- Single Cα for both axles
- No V_crit warning for oversteer vehicles
- Braking distance uses entry-speed decel (slightly optimistic)
