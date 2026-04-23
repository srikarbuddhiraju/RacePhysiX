# FAQ

---

## General

### What is RacePhysiX?

A physics-accurate vehicle dynamics simulator that runs in your browser. It implements the same mathematical models used by professional motorsport engineers — tyre models, load transfer, aerodynamics, suspension, braking, thermal models, and more — and lets you interact with them through a real-time parameter interface.

It is educational by design: every output is explainable from first principles. It is not a game and has no driving component.

### Who built it?

RacePhysiX was built by Srikar Buddhiraju, a University of Leeds MEng Automotive Engineering graduate (2019). All physics models are implemented from scratch in TypeScript and validated against published textbooks (Milliken & Milliken, Gillespie, Pacejka) and real-world vehicle data.

### Is it accurate?

The physics is accurate for a point-mass and linear-response model of a real vehicle. It will give you physically correct trends and ballpark absolute values. It will not give you sub-tenth lap times without fitting to real tyre data for your specific vehicle.

Accuracy is bounded by:
- Tyre data: default Pacejka coefficients are representative but not from a real tyre test. If you fit coefficients from actual tyre test data, the model is significantly more accurate.
- Track geometry: real GPS circuits are accurate to within ±9 m total length. Corner speeds depend on how accurately the radius is captured.
- Driver model: the simulator assumes an idealised driver who always uses full available grip. Real drivers are not perfect.
- Aero model: the CFD map is class-representative, not specific to any real car.

### Is the source code available?

Yes — RacePhysiX is open source under the MIT licence. The repository is on GitHub.

---

## Using the simulator

### My lap time looks wrong — what should I check?

In roughly this order:

1. **Tyre μ** (Tyres & Fuel tab) — this is the single biggest lever on lap time. Check it matches the vehicle class (road ≈ 0.9, semi-slick ≈ 1.2, full slick ≈ 1.5–1.6).
2. **Vehicle mass** — make sure it includes driver and fuel.
3. **Aero CL** — on fast circuits, even small CL values make a large difference. Road cars typically have CL ≈ 0; F1 cars CL ≈ 4–5.
4. **Drivetrain type** — FWD is traction-limited under acceleration, which hurts on slow circuits.
5. **Tyre compound** — if the compound is set to Inter or Wet on a dry circuit, grip is severely reduced.

### What are the Pacejka coefficients?

B, C, D, E are curve-fit parameters from the Magic Formula tyre model. They describe the shape of the lateral force vs slip angle curve:

- B (stiffness factor): initial slope = B × C × D. Higher B = quicker build-up of force.
- C (shape factor): between 1 and 2. Controls how wide the peak is.
- D (peak factor): scales with tyre load and peak friction coefficient.
- E (curvature factor): negative values = sharper peak with quicker drop-off (typical of slicks).

See [Physics Models → Stage 2](physics-overview) for the full equation and coefficient roles.

### What is the understeer gradient?

The understeer gradient K describes how much additional steering angle a driver must apply per unit of lateral acceleration. It is the most concise single-number summary of a car's handling balance.

- K > 0: understeer — the car wants to go straight more than it wants to turn. The driver adds steering as speed rises.
- K = 0: neutral steer — the geometric steering angle (δ = L/R) is sufficient at all speeds.
- K < 0: oversteer — the car turns more than the driver inputs. Above the critical speed, it is directionally unstable.

### Why does my car show oversteer but feel like it would understeer?

The bicycle model is a steady-state linear approximation. It captures the car's tendency at moderate lateral accelerations. At higher lateral g (beyond tyre linearity), the Pacejka model takes over and the balance can shift. Also check:

- Suspension setup: heavy front ARB increases understeer in the nonlinear range, even if the bicycle model shows neutral steer.
- Tyre μ: if front tyre μ is lower than rear, the front saturates first → understeer in the limit.
- Combined slip: under simultaneous braking and cornering, the driven/braked axle loses lateral capacity → that axle breaks away first.

### What's the difference between FWD, RWD, AWD, and AWD+TV?

- **FWD (Front-Wheel Drive)**: front tyres do all the driving work. Under acceleration out of corners, the fronts are fighting combined slip — understeer gets worse as throttle increases.
- **RWD (Rear-Wheel Drive)**: rear tyres drive. Under power, rear slip increases — oversteer tendency under acceleration.
- **AWD (All-Wheel Drive)**: torque split across both axles. Better traction on exit; combined slip is shared. More complex balance.
- **AWD+TV (Torque Vectoring)**: like AWD but torque is biased left-to-right on the rear axle, generating a yaw moment. Can actively reduce understeer or help rotate the car — but adds to tyre slip on the driven rear.

### Can I import my own circuit?

Yes — use the Track Editor in the Lap Time panel. You can define a circuit as a sequence of straights and corners, preview it in the SVG view, and save/load it as JSON.

Currently there is no direct import from GPS files. If you have GPS data for a circuit, you would need to identify the segments (corners and straights with radius and length) and enter them manually.

### Why does the animation look slower than the real circuit?

The animation playback speed can be adjusted — 1×, 4×, or 8× using the controls in the track visualiser. At 1× the car moves at true simulated speed, which can feel slow on long straights at low playback resolution. Use 4× for a more engaging view.

---

## Physics

### Why does adding downforce increase corner speed but reduce top speed?

Downforce (Fa) adds to the tyre's vertical load, which increases the available lateral force (Fy = μ × Fz). More Fy → higher cornering speed.

But drag (Fd) grows with the same square-law: Fd = ½ × ρ × V² × CD × A. More drag → the engine must work harder to maintain speed on straights → lower top speed.

This trade-off — grip vs straight-line speed — is the core of aero setup on any racing car. Fast circuits (Monza) run minimal downforce. Slow, technical circuits (Hungary) run maximum downforce.

### Why does load transfer hurt total grip?

Because tyre grip is degressive with load. If both tyres have load Fz, the total lateral force is 2 × Fy(Fz). If load transfers so one has Fz + ΔFz and the other has Fz − ΔFz, the total is Fy(Fz + ΔFz) + Fy(Fz − ΔFz) < 2 × Fy(Fz), because the gain on the loaded tyre is less than the loss on the unloaded one. This is why you want to minimise unnecessary load transfer — lower CG, wider track.

### What is the friction circle?

The friction circle represents the tyre's total force capacity. At any instant, the vector sum of lateral and longitudinal force cannot exceed the tyre's friction limit:

```
√(Fx² + Fy²) ≤ μ × Fz
```

A driver who brakes and steers simultaneously is using both Fx and Fy from the same budget. Trail braking (reducing braking gradually as steering increases) manages this transition — keeping the total force vector near the circle boundary without exceeding it.

### Why does tyre temperature matter?

The Pacejka peak friction coefficient D is not fixed — it varies with temperature following a Gaussian bell curve. Below the optimal temperature (cold tyres), D is reduced and the car slides. Above it (overheating), D drops again.

This means: warming tyres up matters, but so does not overworking them. A soft compound warms up faster but also overheats and degrades faster than a hard compound.

---

## Technical

### What technology is this built on?

TypeScript, React, Vite, Three.js (3D visualiser), Recharts (charts). Pure TypeScript physics engine with no game physics library. Hosted on Cloudflare Pages.

### How does the lap time calculation work?

Point-mass simulation over circuit segments. For each corner, the maximum speed is computed from the tyre force and radius. The simulator then works backwards through the braking zone to find the maximum entry speed, and forwards through the acceleration zone to find the exit speed. Time for each segment = distance / average speed. Total lap time = sum over all segments.

See [Physics Models → Stage 7](physics-overview) for the full detail.

### How are the GPS circuits processed?

Raw GPS coordinates (latitude, longitude) are projected to a flat 2D plane. A 3-point circumradius (Menger curvature) is computed at each GPS point to identify corners. A rolling mean smooths the curvature signal. Points where curvature exceeds a threshold (radius < 200 m) are grouped as corners; the rest are straights. Each corner's effective radius is the harmonic mean of all radii within it. The total circuit length is corrected by adjusting the longest straight.

### Can I contribute?

The project is open source (MIT licence). Pull requests are welcome — physics improvements, new circuits, UI enhancements. See the GitHub repository for contribution guidelines.
