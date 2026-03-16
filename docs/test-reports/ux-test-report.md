# ApexSim UX/UI Test Report — 2026-03-15

## P1 Fixes Applied

| Issue | Fix |
|---|---|
| TopDownView overlays (badge, aero, corner loads) buried Chase View | Wrapped in 60%-width container — Chase View clear |
| Understeer colour orange (non-standard) | Changed to blue — matches MoTeC/Bosch convention |
| Trailing `%` on AWD split / Aero balance / Brake bias sliders | `unit: ''` on all three |
| Kinematic steer sub-label `(L/R)` opaque | Changed to `(each wheel)` |
| BCD tooltip said N/rad, label showed N/deg | Tooltip clarified both |

## P2 Fixes Applied

| Issue | Fix |
|---|---|
| View labels 9px dim — invisible on dark canvas | 11px, muted colour |
| Lap time segment format 3dp overstates precision | 1dp — matches estimator accuracy |
| Track selector flat list, no grouping | `<optgroup>` Generic / Real Circuits |
| `DL` label non-standard for downforce | Changed to `DF` |

## Remaining Open Items

### P1
- No vehicle identity in LapTimePanel — lap time has no car context

### P2
- Real circuit corner names missing from segment table (shows generic labels)
- Lap time CSV export exports bicycle/Pacejka data, not lap time/circuit data
- Suspension strut colours (green/orange/blue) not in legend
- Downforce arrows (indigo) not in legend
- Corner load gauges: no car-footprint spatial diagram
- Default params don't match any named aero preset

### P3
- Track map: no direction arrow, no S/F label, no scale bar
- Chase View panel has no legend
- No reset-to-defaults button
- Turn-centre dot colour mismatch between legend and scene

## UX Ratings After Fixes (1–5)
- Discoverability: 3/5
- Label accuracy: 4/5 (was 3/5)
- Visual clarity: 4/5 (was 3/5)
- Automotive correctness: 4/5 (was 3/5)
