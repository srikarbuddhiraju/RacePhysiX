# FAQ

---

## General

### What is RacePhysiX?

A physics-accurate vehicle dynamics simulator that runs in your browser. It implements the same mathematical models used by professional motorsport engineers — tyre models, load transfer, aerodynamics, suspension, braking, thermal models, and more — and lets you interact with them through a real-time parameter interface.

It is educational by design: every output is explainable from first principles. It is not a game and has no driving component.

### Who built it?

RacePhysiX was built by Srikar Buddhiraju, a University of Leeds MEng Automotive Engineering graduate (2019). All physics models are implemented from scratch in TypeScript and validated against published textbooks (Milliken & Milliken, Gillespie, Pacejka) and real-world vehicle data.

### Is it free?

The simulator is completely free — all 46 physics stages, 22 circuits, and every feature on this page. No account required, no install, no time limit. The source code is open under AGPL-3.0 on GitHub.

A **Pro tier** is coming with cloud saves, team workspaces, and custom tyre coefficient import. [Join the waitlist](/pro).

### Is it accurate?

The physics is accurate for a point-mass and linear-response model of a real vehicle. It gives physically correct trends and good absolute values for setup direction decisions.

Accuracy is bounded by:
- **Tyre data**: default Pacejka coefficients are representative but not from a real tyre test. Fitting to actual tyre test data significantly improves accuracy.
- **Track geometry**: GPS circuits are accurate to within ±9 m total length. Corner speeds depend on how accurately radius is captured.
- **Driver model**: assumes an idealised driver who always uses full available grip.
- **Aero model**: the CFD map is class-representative, not specific to any real car.

GT3 validation (BMW M4 GT3 2023 qualifying): Spa, Monza, Silverstone, Imola, Red Bull Ring, Hockenheim, Zandvoort, São Paulo — all within ±5–10% of real qualifying times.

### Is the source code available?

Yes — RacePhysiX is open source under AGPL-3.0. The repository is on GitHub at [github.com/srikarbuddhiraju/RacePhysiX](https://github.com/srikarbuddhiraju/RacePhysiX). Pull requests are welcome.

---

## Using the simulator

### My lap time looks wrong — what should I check?

In roughly this order:

1. **Tyre μ** (Tyres & Fuel tab) — the single biggest lever. Check it matches the vehicle class: road ≈ 0.9, semi-slick ≈ 1.2, full slick ≈ 1.5–1.6.
2. **Vehicle mass** — make sure it includes driver and fuel.
3. **Aero CL** — on fast circuits, even small CL values make a large difference. Road cars typically have CL ≈ 0; F1 cars CL ≈ 4–5.
4. **Drivetrain type** — FWD is traction-limited under acceleration on slow circuits.
5. **Tyre compound** — if set to Inter or Wet on a dry circuit, grip is severely reduced.
6. **Tyre temperature** — if current tyre temp is far from optimal, μ is penalised. Set to the optimal value for a baseline comparison.

### What are the Pacejka coefficients and how do I use them?

B, C, D, E are curve-fit parameters from the Magic Formula tyre model. They control the shape of the lateral force vs slip angle curve:

| Coefficient | Name | Effect |
|---|---|---|
| B | Stiffness factor | Initial slope = B × C × D. Higher B = quicker build-up of lateral force |
| C | Shape factor | 1.0–2.0. Controls peak width. Racing slicks ≈ 1.45–1.55 |
| D | Peak factor | Scales with tyre load and peak friction coefficient μ |
| E | Curvature factor | Negative = sharper peak with quicker drop-off (slicks). Positive = gradual saturation (road tyres) |

The default values are validated against Pacejka's 3rd edition Appendix 3 and real tyre data. Only change them if you have actual tyre test data to fit. See [Physics — Foundations](physics-foundations) for the full equation.

### What is the understeer gradient and what should it be?

The understeer gradient K describes how much additional steering angle a driver must apply per unit of lateral acceleration — the most concise single-number summary of handling balance.

- **K > 0**: understeer — self-correcting, stable. The car resists turning. Most road cars: K = +2 to +5 deg/g.
- **K = 0**: neutral steer — ideal but theoretically difficult to achieve across all conditions.
- **K < 0**: oversteer — the car turns more than the driver inputs. Above the critical speed, directionally unstable.

Target ranges:
- Road car: +1.5 to +3.0 deg/g
- GT racing: +0.5 to +1.5 deg/g
- Formula Student: 0 to +1.0 deg/g

### Why does the understeer gradient change with speed?

It shouldn't — in the linear bicycle model, K is speed-independent. If K appears to change, it is because you are looking at nonlinear tyre behaviour (Pacejka model) or combined slip effects that only appear above a certain lateral G threshold. The linear K reported in the Results panel is computed at the specified cornering speed and radius — it is technically a local value, not a global constant.

### Why does my car show oversteer but feel like it would understeer?

The bicycle model is a steady-state linear approximation. It captures the car's tendency at moderate lateral accelerations. At higher lateral g (beyond tyre linearity), the Pacejka model takes over and the balance can shift. Also check:

- **Suspension setup**: heavy front ARB increases understeer in the nonlinear range even if the bicycle model shows neutral steer.
- **Tyre μ front vs rear**: if front peak μ is lower than rear, the front saturates first → understeer in the limit.
- **Combined slip**: under simultaneous braking and cornering, the driven/braked axle loses lateral capacity → that axle breaks away first.

### What is the difference between cornering stiffness and peak friction?

- **Cornering stiffness Cα**: the initial slope of the Fy vs α curve, in N/deg. It determines how quickly lateral force builds with slip angle. Higher Cα = more responsive to steering input.
- **Peak friction μ**: the maximum lateral force coefficient the tyre can achieve, at the optimal slip angle. It determines the limit of grip, not how quickly it builds.

A tyre can have high Cα (responsive) but low μ (limited peak) — like a hard compound at low temperature. Or high μ but low Cα — like a soft compound that builds force slowly.

### What is the friction circle?

The friction circle represents the tyre's total force capacity. At any instant, the vector sum of lateral (Fy) and longitudinal (Fx) force cannot exceed the tyre's friction limit:

```
√(Fx² + Fy²) ≤ μ × Fz
```

A driver who brakes and steers simultaneously uses both Fx and Fy from the same budget. Trail braking — reducing braking gradually as steering increases — manages this transition, keeping the total force vector near the circle boundary without exceeding it. You can see the G-G diagram in the circuit visualiser, which traces the actual path through the friction circle.

### Can I import my own tyre data?

The Pacejka B, C, D, E coefficients can be entered manually in the **Advanced** tab of the parameter panel. If you have MF5.2 or MF6.2 fitted coefficients from FSAE TTC data or a flat-track test, enter them there. The model uses Fy and Fx Magic Formula equations directly.

Full coefficient import from TIR files is on the Pro roadmap.

### Can I import my own circuit?

Yes — use the Track Editor in the Lap Time panel. Define a circuit as a sequence of straights and corners with radius, direction, and length. The SVG preview updates live. Export/import as JSON for future sessions.

Direct import from GPS files or GPX format is not currently supported. If you have GPS data, identify corners (circumradius < 200 m) and measure their radii, then enter segments manually.

### How do I share a setup?

The URL encodes your full setup in the hash. Copy and paste the URL to share an exact configuration. Preset-based setups use very short hashes (`#p=gt3`); custom setups add a compact diff from the nearest preset.

You can also **Export** the full setup as a JSON file (top of the parameter panel) and share the file directly.

---

## Physics

### Why does adding downforce increase corner speed but reduce top speed?

Downforce (Fa) adds to the tyre's vertical load, which increases available lateral force: Fy = μ × Fz. More Fy → higher cornering speed.

But drag grows with the square of speed: Fd = ½ × ρ × V² × CD × A. More drag → lower top speed.

This trade-off — grip vs straight-line speed — is the core of aero setup. Fast circuits (Monza, Le Mans) run minimal downforce. Slow, technical circuits (Hungary, Formula Student autocross) run maximum downforce.

### Why does load transfer hurt total grip?

Because tyre grip is degressive with load. If both tyres have the same vertical load Fz, total lateral force = 2 × Fy(Fz). If load transfers so one tyre has Fz + ΔFz and the other Fz − ΔFz, total = Fy(Fz + ΔFz) + Fy(Fz − ΔFz) < 2 × Fy(Fz), because the gain on the loaded tyre is less than the loss on the unloaded tyre (degressive tyre response).

This is why lowering the CG height, widening track, and softening springs reduces unnecessary load transfer — and why it almost always improves lap time.

### Why does tyre temperature matter?

The Pacejka peak friction coefficient D varies with temperature following a Gaussian bell curve. Below optimal (cold tyres): D is reduced up to 30%, the car slides. Above optimal (overheating): D drops progressively as the compound degrades.

Warmup time constant is approximately 2.5 laps (exponential). A soft compound warms up faster but also overheats and degrades faster than a hard compound.

### What is the difference between geometric and elastic load transfer?

Total lateral load transfer = geometric + elastic components:

- **Geometric load transfer**: instantaneous, through the suspension links. Determined by roll centre height. Acts without any suspension movement.
- **Elastic load transfer**: through the springs and ARBs. Depends on roll stiffness and CG height above roll axis. Develops as the car rolls.

The split matters because geometric load transfer does not compress the spring (no tyre contact change), while elastic load transfer does (the outer tyre digs in). A high roll centre reduces body roll but increases geometric load transfer — which can hurt grip at high lateral G.

### How does ERS / hybrid deployment affect lap time?

The MGU-K adds an additional drive force up to the configured deployment power (default 120 kW for F1). This is modelled as a torque addition at the driven wheels. Strategies:
- **Full attack**: deploy maximum power everywhere — fastest qualifying mode, depletes energy in 1–2 laps
- **Saving**: deploy only on longest straights — conserves energy for multiple laps
- **Balanced**: deploy proportional to throttle position

On Spa (straight-heavy), full attack deployment saves ~0.6–0.8 seconds vs saving mode on the energy budget.

### How accurate is the 14-DOF time-domain model?

The 14-DOF model captures: longitudinal, lateral, and yaw motion of the sprung mass; vertical, roll, and pitch of the sprung mass; and independent wheel/tyre vertical dynamics (4 wheels). It is a full nonlinear vehicle model, not a linearised approximation.

Validation checks compare step steer response (time to 90% of steady-state yaw rate), sine sweep natural frequencies, and brake-in-turn combined slip against analytical expected values. All 37 validation checks pass.

For formal vehicle dynamics analysis (ESC calibration, active suspension design), a full ADAMS or VI-Grade model is still required — the 14-DOF model here is for qualitative understanding of transient phenomena.

---

## Race strategy

### How does the race strategy optimiser work?

It brute-forces all combinations of 1-stop and 2-stop strategies over soft, medium, and hard compounds. For each strategy:

1. Each stint is simulated lap-by-lap with a grip model that accounts for tyre warmup, linear wear, cliff degradation, and compound-specific graining
2. A fixed 25-second pit stop time penalty is applied for each stop
3. Total race time = sum of all stint times + pit stop penalties
4. The strategy with minimum total time wins

The optimiser returns the best strategy for 1-stop and 2-stop, and shows the lap time trace for each.

### Should I always follow the optimiser's recommendation?

The optimiser minimises total race time for an idealised driver. In practice:
- **Undercut opportunity**: if a competitor pits early, you may need to react regardless of your optimal strategy
- **Safety car**: a safety car can negate the pit stop time penalty — the optimiser doesn't model this
- **Tyre cliff**: if your graining model (compound + driver aggression) is conservative, the real cliff may come earlier than the model predicts

Use the strategy optimiser for the baseline plan, then adjust for race conditions.

---

## Technical

### What technology is this built on?

TypeScript, React, Vite, Three.js (3D visualiser), Recharts (charts). Pure TypeScript physics engine with no game physics library. Hosted on Cloudflare Pages. Open source under AGPL-3.0.

### How does the lap time calculation work?

Point-mass quasi-static simulation over circuit segments. For each corner:
1. Maximum corner speed = √(μ_eff × g × R), where μ_eff includes tyre forces, downforce, and banking
2. Braking zone: working backwards from corner speed to entry, limited by longitudinal braking G
3. Acceleration zone: working forwards from corner speed on exit, limited by power and traction
4. Segment time = segment length / average speed

Total lap time = sum over all segments. Corner speeds are independent (quasi-static — no coupling between adjacent corners). This is the main source of ±5–15% error on technical circuits with linked corners.

### How are the GPS circuits processed?

Raw GPS coordinates (latitude, longitude) are projected to a flat 2D plane. A 3-point circumradius (Menger curvature) is computed at each GPS point to identify corners. A rolling mean smooths the curvature signal. Points where curvature exceeds a threshold (radius < 200 m) are grouped into corners; the rest are straights. Each corner's effective radius is the harmonic mean of all radii within it. Total circuit length is corrected by adjusting the longest straight to match the published circuit length.

### Why is the bundle large?

The full physics engine, tyre model, 22 circuit definitions, Three.js visualiser, Recharts charting library, and react-markdown documentation renderer are all bundled client-side. This enables the tool to run with zero server-side computation — all physics runs in your browser tab, which is why it is instantaneous even on mobile.

The bundle is approximately 1.4 MB gzipped to ~420 KB. On a typical connection (5 Mbps), this loads in under 1 second.

### Can I contribute?

Yes — pull requests welcome. See the [GitHub repository](https://github.com/srikarbuddhiraju/RacePhysiX). Priority areas for contribution:
- New GPS-accurate circuits
- Tyre coefficient databases (public domain data only)
- Physics model improvements with textbook references
- UI / accessibility improvements
