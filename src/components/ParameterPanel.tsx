import { useState } from 'react';
import type { VehicleParams, DrivetrainType } from '../physics/types';
import { InfoTooltip } from './InfoTooltip';
import './ParameterPanel.css';

// ── Tab type ─────────────────────────────────────────────────────────────────
type PanelTab = 'vehicle' | 'suspension' | 'aero';

// ── Power unit helpers ────────────────────────────────────────────────────────
type PowerUnit = 'kW' | 'BHP' | 'PS';
const toKW   = (v: number, u: PowerUnit) => u === 'BHP' ? v / 1.34102 : u === 'PS' ? v / 1.35962 : v;
const fromKW = (v: number, u: PowerUnit) => u === 'BHP' ? v * 1.34102 : u === 'PS' ? v * 1.35962 : v;
const POWER_RANGE: Record<PowerUnit, { min: number; max: number; step: number }> = {
  kW:  { min: 50,  max: 600, step: 5  },
  BHP: { min: 67,  max: 805, step: 5  },
  PS:  { min: 68,  max: 816, step: 5  },
};

interface Props {
  params: VehicleParams;
  onChange: (params: VehicleParams) => void;
}

interface SliderConfig {
  label:   string;
  key:     keyof VehicleParams;
  min:     number;
  max:     number;
  step:    number;
  unit:    string;
  format?: (v: number) => string;
  tip:     string;
}

const SLIDERS: SliderConfig[] = [
  // ── Corner scenario ───────────────────────────────────────────────────────
  {
    label: 'Speed',
    key:   'speedKph',
    min:   20, max: 250, step: 5,
    unit:  'km/h',
    tip:   'How fast the car travels through the corner. Higher speed → higher lateral acceleration (ay = V²/R) → tyres work harder and slip angles rise.',
  },
  {
    label: 'Turn radius',
    key:   'turnRadius',
    min:   15, max: 500, step: 5,
    unit:  'm',
    tip:   'Radius of the corner arc. Smaller = tighter corner = more lateral g at the same speed. Typical: 15 m hairpin, 80–200 m medium-speed corner, 400+ m fast sweep.',
  },
  // ── Tyre / aero ───────────────────────────────────────────────────────────
  {
    label: 'Front Cα',
    key:   'corneringStiffnessNPerDeg',
    min:   100, max: 2000, step: 25,
    unit:  'N/deg',
    tip:   'Front axle cornering stiffness (Fy = Cα·α in linear range). Higher = stiffer front tyre. Stiffer front than rear → understeer. Stage 13A: separate front/rear. Typical road tyre: 300–600 N/deg per axle.',
  },
  {
    label: 'Rear Cα',
    key:   'rearCorneringStiffnessNPerDeg',
    min:   100, max: 2000, step: 25,
    unit:  'N/deg',
    tip:   'Rear axle cornering stiffness. Lower rear Cα than front → rear slips more at same lateral g → oversteer (K < 0). Equal to front = symmetric. Stage 13A.',
  },
  // ── Weight distribution ───────────────────────────────────────────────────
  {
    label: 'Front weight',
    key:   'frontWeightFraction',
    min:   0.30, max: 0.70, step: 0.01,
    unit:  '%',
    format: v => (v * 100).toFixed(0),
    tip:   'Fraction of total weight over the front axle at rest. Shifts the balance: more front weight → more understeer (K increases). Neutral steer = 50/50 split with equal Cα.',
  },
  // ── Vehicle geometry ──────────────────────────────────────────────────────
  {
    label: 'Mass',
    key:   'mass',
    min:   500, max: 3000, step: 50,
    unit:  'kg',
    tip:   'Total vehicle mass. More mass → more lateral force needed at the same ay → higher slip angles at the same speed/radius. Typical: 1100 kg (Formula Student), 1500 kg (road car), 2200 kg (SUV).',
  },
  {
    label: 'Wheelbase',
    key:   'wheelbase',
    min:   1.8, max: 4.0, step: 0.05,
    unit:  'm',
    format: v => v.toFixed(2),
    tip:   'Front-to-rear axle distance. Longer wheelbase = less yaw agility, more stable, typically more understeer. Moment arm for lateral force balance. Typical: 2.4 m (FS car), 2.7 m (road car), 3.0 m (larger saloon).',
  },
  {
    label: 'CG height',
    key:   'cgHeight',
    min:   0.20, max: 0.90, step: 0.01,
    unit:  'm',
    format: v => v.toFixed(2),
    tip:   'Height of the centre of gravity above the ground plane. Higher CG → more lateral load transfer in corners → grip loss via Pacejka nonlinearity (outer tyre doesn\'t compensate for inner). Critical for Stage 3. Typical: 0.25 m (FS), 0.55 m (road car), 0.70 m (SUV).',
  },
  {
    label: 'Track width',
    key:   'trackWidth',
    min:   1.0, max: 2.5, step: 0.05,
    unit:  'm',
    format: v => v.toFixed(2),
    tip:   'Lateral distance between left and right tyres. Wider track → less lateral load transfer → more total grip (less degressive Fz penalty). Used in Stage 3 load transfer model. Typical: 1.2 m (FS), 1.5 m (road car), 1.8 m (race car).',
  },
];

export function ParameterPanel({ params, onChange }: Props) {
  const [powerUnit, setPowerUnit] = useState<PowerUnit>('kW');
  const [tab, setTab] = useState<PanelTab>('vehicle');

  const set = (key: keyof VehicleParams, value: number) => {
    onChange({ ...params, [key]: value });
  };

  // Derived display values
  const speedMs = params.speedKph / 3.6;
  const ay      = (speedMs * speedMs) / params.turnRadius / 9.81;
  const L       = params.wheelbase;
  const b       = params.frontWeightFraction * L;
  const a       = L - b;

  return (
    <div className="param-panel">
      <div className="param-title">ApexSim</div>
      <div className="param-subtitle">Vehicle Dynamics Simulator</div>

      {/* ── Tab bar ────────────────────────────────────────────────────────── */}
      <div className="param-tabs">
        {(['vehicle', 'suspension', 'aero'] as PanelTab[]).map(t => (
          <button
            key={t}
            className={`param-tab ${tab === t ? 'param-tab--active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'vehicle' ? 'Vehicle' : t === 'suspension' ? 'Susp.' : 'Aero'}
          </button>
        ))}
      </div>

      {/* ── Vehicle tab ────────────────────────────────────────────────────── */}
      {tab === 'vehicle' && <>
        <div className="param-section-label">Corner scenario</div>
        {SLIDERS.slice(0, 2).map(cfg => <SliderRow key={cfg.key} cfg={cfg} params={params} set={set} />)}
        <div className="param-derived">
          <DerivedRow label="Lateral accel." value={`${ay.toFixed(3)} g`} tip="ay = V²/R. If this exceeds ~0.4g the linear model is becoming inaccurate — switch attention to the Pacejka charts below." />
        </div>

        <div className="param-section-label">Tyres (bicycle model — Stage 13A)</div>
        {SLIDERS.slice(2, 4).map(cfg => <SliderRow key={cfg.key} cfg={cfg} params={params} set={set} />)}
        <div className="param-derived">
          {(() => {
            const DEG_TO_RAD = Math.PI / 180;
            const CaF = params.corneringStiffnessNPerDeg / DEG_TO_RAD;
            const CaR = (params.rearCorneringStiffnessNPerDeg ?? params.corneringStiffnessNPerDeg) / DEG_TO_RAD;
            const bv = params.frontWeightFraction * params.wheelbase;
            const av = params.wheelbase - bv;
            const Kdegpg = (params.mass / params.wheelbase) * (bv / CaF - av / CaR) * 9.81 * (180 / Math.PI);
            const bal = Kdegpg > 0.05 ? 'US' : Kdegpg < -0.05 ? 'OS' : 'Neutral';
            return <DerivedRow label="Understeer grad K" value={`${Kdegpg.toFixed(3)} deg/g — ${bal}`} tip="K = (m/L)×(b/CαF − a/CαR)×g×(180/π). Positive = understeer, negative = oversteer. Stage 13A: uses separate front/rear Cα." />;
          })()}
        </div>

        <div className="param-section-label">Weight & geometry</div>
        {SLIDERS.slice(4).map(cfg => <SliderRow key={cfg.key} cfg={cfg} params={params} set={set} />)}
        <div className="param-derived">
          <DerivedRow label="CG→front (a)" value={`${a.toFixed(3)} m`} tip="a = wheelbase × (1 − front weight fraction)." />
          <DerivedRow label="CG→rear (b)"  value={`${b.toFixed(3)} m`} tip="b = wheelbase × front weight fraction." />
          <DerivedRow label="Front load Wf" value={`${(params.mass * 9.81 * b / L / 1000).toFixed(2)} kN`} tip="Static front axle load = mass × g × b/L." />
          <DerivedRow label="Rear load Wr"  value={`${(params.mass * 9.81 * a / L / 1000).toFixed(2)} kN`} tip="Static rear axle load = mass × g × a/L." />
        </div>

        <div className="param-section-label">Drivetrain</div>
        <DrivetrainSelector value={params.drivetrainType} onChange={dt => onChange({ ...params, drivetrainType: dt })} />
        <PowerSliderRow powerKW={params.enginePowerKW} unit={powerUnit} onUnitChange={setPowerUnit} onKWChange={kw => onChange({ ...params, enginePowerKW: kw })} />
        <SliderRow cfg={{ label: 'Throttle', key: 'throttlePercent', min: 0, max: 100, step: 5, unit: '%', format: v => v.toFixed(0), tip: 'Fraction of maximum engine power applied. At 0% = coast. Throttle on driven axle → combined slip → reduced lateral grip.' }} params={params} set={set} />
        {(params.drivetrainType === 'AWD' || params.drivetrainType === 'AWD_TV') && (
          <SliderRow cfg={{ label: 'AWD split', key: 'awdFrontBias', min: 0, max: 1, step: 0.05, unit: '', format: v => `${(v*100).toFixed(0)}%F / ${((1-v)*100).toFixed(0)}%R`, tip: 'Torque split front/rear. 0.40 = 40F/60R typical.' }} params={params} set={set} />
        )}
        <div className="param-derived">
          <DerivedRow label="Drive force" value={(() => { const vS = Math.max(speedMs,2); return `${((params.enginePowerKW*1000*params.throttlePercent/100)/vS/1000).toFixed(2)} kN`; })()} tip="F = P × throttle / V." />
        </div>

        <div className="param-section-label">Engine &amp; Gears (Stage 10)</div>
        <SliderRow cfg={{ label: 'Gear count', key: 'gearCount', min: 4, max: 8, step: 1, unit: '', format: v => v.toFixed(0), tip: 'Number of forward gears. More gears = smaller ratio steps = engine stays closer to peak power RPM. Typical: 5–6 road, 6–8 motorsport.' }} params={params} set={set} />
        <SliderRow cfg={{ label: '1st gear ratio', key: 'firstGearRatio', min: 2.0, max: 5.0, step: 0.1, unit: '', format: v => v.toFixed(2), tip: '1st gear ratio. Higher = more torque multiplication at low speed, lower max speed in 1st. Typical road: 3.0–3.5.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Top gear ratio', key: 'topGearRatio', min: 0.5, max: 1.2, step: 0.01, unit: '', format: v => v.toFixed(2), tip: 'Top gear ratio. <1.0 = overdrive (engine spins slower than output). 1.0 = direct drive. 0.72 typical 6-speed OD.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Final drive', key: 'finalDriveRatio', min: 2.5, max: 5.5, step: 0.1, unit: '', format: v => v.toFixed(2), tip: 'Differential/final drive ratio. Higher = more torque at wheels but lower top speed. Typical: 3.5–4.5 road, 4.0–5.0 track.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Wheel radius', key: 'wheelRadiusM', min: 0.26, max: 0.38, step: 0.01, unit: 'm', format: v => v.toFixed(2), tip: 'Loaded tyre radius. Larger radius = higher top speed but less torque at wheels. 225/45R17 ≈ 0.32 m; 245/35R20 ≈ 0.33 m.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Peak power RPM', key: 'enginePeakRpm', min: 3000, max: 18000, step: 100, unit: 'rpm', format: v => v.toFixed(0), tip: 'RPM at which peak power is reached. Below this = flat torque plateau. Above this = torque falls (constant power). 5500 rpm typical road; 15000+ rpm F1.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Redline', key: 'engineRedlineRpm', min: 4000, max: 20000, step: 100, unit: 'rpm', format: v => v.toFixed(0), tip: 'Maximum engine RPM. Gears that would exceed redline at the current speed are skipped. Sets the top speed in each gear.' }} params={params} set={set} />
        <div className="param-derived">
          {(() => {
            const omegaPeak = params.enginePeakRpm * 2 * Math.PI / 60;
            const tPeak     = (params.enginePowerKW * 1000) / omegaPeak;
            const omegaRed  = params.engineRedlineRpm * 2 * Math.PI / 60;
            const vMax      = omegaRed * params.wheelRadiusM / (params.topGearRatio * params.finalDriveRatio);
            // Geometric progression ratios
            const n = params.gearCount;
            const ratios: string[] = [];
            for (let i = 0; i < n; i++) {
              const r = params.firstGearRatio * Math.pow(params.topGearRatio / params.firstGearRatio, i / Math.max(n - 1, 1));
              ratios.push(r.toFixed(2));
            }
            return <>
              <DerivedRow label="Peak torque" value={`${tPeak.toFixed(0)} Nm`} tip="T_peak = P / ω_peak. Flat torque plateau below peak RPM." />
              <DerivedRow label="Top speed" value={`${(vMax * 3.6).toFixed(0)} km/h`} tip="Max speed = redline × wheelRadius / (topGear × finalDrive). Assumes flat road, no drag limit." />
              <DerivedRow label="Gear ratios" value={ratios.join(' / ')} tip="Geometric progression from 1st to top gear." />
            </>;
          })()}
        </div>
      </>}

      {/* ── Suspension tab ─────────────────────────────────────────────────── */}
      {tab === 'suspension' && <>
        <div className="param-section-label">Spring rates (wheel rate)</div>
        <SliderRow cfg={{ label: 'Front spring', key: 'frontSpringRate', min: 5000, max: 150000, step: 1000, unit: 'N/m', format: v => `${(v/1000).toFixed(0)}k`, tip: 'Per-wheel spring rate. Higher = stiffer ride but faster transient response. Roll stiffness ∝ k × TW². Road: 15–30 kN/m; GT: 40–80; Formula: 80–200.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Rear spring',  key: 'rearSpringRate',  min: 5000, max: 150000, step: 1000, unit: 'N/m', format: v => `${(v/1000).toFixed(0)}k`, tip: 'Stiffer rear spring increases rear roll stiffness → moves load transfer to rear → more oversteer tendency.' }} params={params} set={set} />

        <div className="param-section-label">Anti-roll bars (ARB)</div>
        <SliderRow cfg={{ label: 'Front ARB', key: 'frontARBRate', min: 0, max: 40000, step: 500, unit: 'N/m eq.', format: v => v === 0 ? 'off' : `${(v/1000).toFixed(1)}k`, tip: 'Front anti-roll bar as equivalent wheel rate. Adding front ARB increases front roll stiffness → more lateral load transfer to front axle → more understeer.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Rear ARB',  key: 'rearARBRate',  min: 0, max: 40000, step: 500, unit: 'N/m eq.', format: v => v === 0 ? 'off' : `${(v/1000).toFixed(1)}k`, tip: 'Rear anti-roll bar. Adding rear ARB shifts load transfer to rear → more oversteer tendency. Classic handling tuning: soften rear ARB to reduce oversteer.' }} params={params} set={set} />

        <div className="param-derived">
          {(() => {
            const TW = params.trackWidth;
            const tw2o2 = (TW*TW)/2;
            const kF = (params.frontSpringRate + params.frontARBRate) * tw2o2;
            const kR = (params.rearSpringRate  + params.rearARBRate)  * tw2o2;
            const tot = kF + kR;
            const ratio = tot > 0 ? kF/tot : 0.5;
            const rollDeg = tot > 0 ? (params.mass * ay * 9.81 * params.cgHeight / tot) * (180/Math.PI) : 0;
            return <>
              <DerivedRow label="Roll stiffness F" value={`${(kF/57.3).toFixed(0)} Nm/deg`} tip="Front axle roll stiffness = (k_spring + k_ARB) × TW²/2. More = less body roll on front." />
              <DerivedRow label="Roll stiffness R" value={`${(kR/57.3).toFixed(0)} Nm/deg`} tip="Rear axle roll stiffness." />
              <DerivedRow label="Load transfer split" value={`${(ratio*100).toFixed(1)}% front`} tip="Fraction of lateral load transfer on front axle. >50% → understeer tendency. The key tuning parameter for handling balance." />
              <DerivedRow label="Roll angle @ ay" value={`${rollDeg.toFixed(2)} deg`} tip="Steady-state body roll angle at current lateral acceleration. Φ = m·ay·hCG / KΦ_total." />
            </>;
          })()}
        </div>
      </>}

      {/* ── Aero & Braking tab ─────────────────────────────────────────────── */}
      {tab === 'aero' && <>
        <div className="param-section-label">Aero preset</div>
        <AeroPresets params={params} onChange={onChange} />
        <div className="param-section-label">Aerodynamics</div>
        <SliderRow cfg={{ label: 'Downforce CL', key: 'aeroCL', min: 0, max: 4.0, step: 0.05, unit: '', format: v => v.toFixed(2), tip: 'Downforce coefficient. F_down = ½ρV²A·CL. 0 = clean road car; 0.3 = mild aero; 1.5 = GT wing; 3.0+ = formula car. Increases grip at higher speeds.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Drag CD',       key: 'aeroCD', min: 0.10, max: 1.50, step: 0.05, unit: '', format: v => v.toFixed(2), tip: 'Drag coefficient. F_drag = ½ρV²A·CD. 0.25 = slippery road car; 0.50 = GT; 0.80 = open wheel. Drag limits top speed and requires more engine power.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Frontal area',  key: 'aeroReferenceArea', min: 0.8, max: 3.0, step: 0.1, unit: 'm²', format: v => v.toFixed(1), tip: 'Frontal reference area for aero calculations. 1.5 m² = formula car; 1.8 = sports car; 2.0 = road saloon; 2.5 = SUV.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Aero balance', key: 'aeroBalance', min: 0.30, max: 0.70, step: 0.01, unit: '', format: v => `${(v*100).toFixed(0)}%F / ${((1-v)*100).toFixed(0)}%R`, tip: 'Fraction of total downforce acting on the front axle. <0.50 = rear-biased → oversteer at high speed. >0.50 = front-biased → understeer. Typical: 0.35–0.45F.' }} params={params} set={set} />
        <div className="param-derived">
          {(() => {
            const q = 0.5 * 1.225 * speedMs * speedMs;
            const F_down = q * params.aeroReferenceArea * params.aeroCL;
            const F_drag = q * params.aeroReferenceArea * params.aeroCD;
            return <>
              <DerivedRow label="Downforce @ V" value={`${(F_down/1000).toFixed(2)} kN`} tip="Speed-dependent downforce at current speed. Adds to tyre Fz → more grip. Grows with V²." />
              <DerivedRow label="Drag @ V"      value={`${(F_drag/1000).toFixed(2)} kN`} tip="Aerodynamic drag force at current speed. Must be overcome by engine drive force." />
              <DerivedRow label="Drag power"    value={`${(F_drag * speedMs / 1000).toFixed(1)} kW`} tip="Power consumed by drag = F_drag × V. At high speed this dominates the power budget." />
            </>;
          })()}
        </div>

        <div className="param-section-label">Braking</div>
        <SliderRow cfg={{ label: 'Braking',    key: 'brakingG',  min: 0, max: 1.5, step: 0.05, unit: 'g', format: v => v.toFixed(2), tip: 'Applied braking deceleration. 0 = coasting. 0.5g = gentle; 1.0g = firm; 1.5g = maximum ABS-limited stop. Shifts weight to front axle, reduces rear lateral grip.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Brake bias', key: 'brakeBias', min: 0.40, max: 0.90, step: 0.01, unit: '', format: v => `${(v*100).toFixed(0)}%F / ${((1-v)*100).toFixed(0)}%R`, tip: 'Fraction of brake force on front axle. 0.65 = 65F/35R typical road. More front bias = stable but front tyres saturate early. More rear = faster yaw but rear lock risk.' }} params={params} set={set} />
        {params.brakingG > 0 && (
          <div className="param-derived">
            {(() => {
              const F_brake = params.mass * params.brakingG * 9.81;
              return <DerivedRow label="Brake force" value={`${(F_brake/1000).toFixed(2)} kN`} tip="Total brake force = m × brakingG × g. Split front/rear by brake bias; ABS clips each axle at μ×Fz." />;
            })()}
          </div>
        )}
      </>}

        <div className="param-section-label">Tyre (Stage 9)</div>
        <SliderRow cfg={{ label: 'Load sensitivity', key: 'tyreLoadSensitivity', min: 0, max: 0.30, step: 0.01, unit: '', format: v => v.toFixed(2), tip: 'Pacejka load sensitivity qFz: how much μ degrades as tyre load exceeds the nominal (static) value. 0 = linear (no sensitivity). 0.10 = typical road tyre. 0.20 = high sensitivity. At 1.5× nominal load and qFz=0.10, effective μ drops by ~5%. Increases slip angles and load-transfer penalty at high cornering loads.' }} params={params} set={set} />
        <div className="param-derived">
          {(() => {
            const Fz0 = params.mass * 9.81 / 4;
            const FzOuter = Fz0 * 1.5;   // approx outer tyre at ~0.8g lateral
            const muEff = params.tyreLoadSensitivity > 0
              ? (1 - params.tyreLoadSensitivity * (FzOuter / Fz0 - 1))
              : 1.0;
            return <DerivedRow label="μ @ 1.5× load" value={`${(muEff * 100).toFixed(0)}% of μ₀`} tip="Effective peak friction coefficient on the outside tyre when it's carrying 1.5× the static corner load. Shows the grip penalty from load sensitivity." />;
          })()}
        </div>

        <div className="param-section-label">Fuel &amp; Race (Race Sim)</div>
        <SliderRow cfg={{ label: 'Fuel load', key: 'fuelLoadKg', min: 0, max: 120, step: 1, unit: 'kg', format: v => v.toFixed(0), tip: 'Total fuel mass at race start. Reduces car mass as it burns off each lap. Road: 40–60 kg; F1: ~100 kg; sprint/qualify: 2–5 kg.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Burn rate', key: 'fuelBurnRateKgPerLap', min: 0.5, max: 5.0, step: 0.1, unit: 'kg/lap', format: v => v.toFixed(1), tip: 'Fuel consumed per lap. Road car: ~2–3 kg/lap; GT: ~3–4 kg/lap; F1: ~1.6–2.0 kg/lap. Determines how much lighter the car gets as the race progresses.' }} params={params} set={set} />

        <div className="param-section-label">Tyre Temperature (Stage 11)</div>
        <SliderRow cfg={{ label: 'Optimal temp', key: 'tyreOptTempC', min: 50, max: 150, step: 5, unit: '°C', format: v => v.toFixed(0), tip: 'Temperature at which the tyre reaches peak grip. Road tyre: ~80–90°C; track: ~95–110°C; motorsport: ~110–120°C. The bell curve peaks here.' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Half-width', key: 'tyreTempHalfWidthC', min: 10, max: 60, step: 5, unit: '°C', format: v => v.toFixed(0), tip: 'Grip drops 50% of the way to the floor at ±this many °C from optimal. Narrow = sensitive tyre (motorsport compound). Wide = forgiving (all-season).' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Current temp', key: 'tyreTempCurrentC', min: 0, max: 180, step: 5, unit: '°C', format: v => v.toFixed(0), tip: 'Current tyre operating temperature. Explore cold-tyre lap-start conditions (20–40°C), optimal window (70–120°C), or overheating scenarios (150°C+).' }} params={params} set={set} />
        <SliderRow cfg={{ label: 'Grip floor', key: 'tyreTempFloorMu', min: 0.40, max: 0.90, step: 0.05, unit: '', format: v => v.toFixed(2), tip: 'Minimum μ fraction at extreme temperatures (very cold or overheated). 0.60 = 60% of peak grip. Lower = more dangerous cold/hot tyre behaviour.' }} params={params} set={set} />
        <div className="param-derived">
          {(() => {
            const { tyreTempCurrentC: T, tyreOptTempC: Topt, tyreTempHalfWidthC: hw, tyreTempFloorMu: floor } = params;
            const k  = hw > 0 ? Math.LN2 / (hw * hw) : 0;
            const dT = T - Topt;
            const f  = Math.max(floor + (1 - floor) * Math.exp(-k * dT * dT), floor);
            const status = f >= 0.97 ? 'Optimal' : f >= 0.85 ? 'Near optimal' : f >= 0.70 ? 'Cold / warming' : 'Very cold / overheated';
            return <>
              <DerivedRow label="μ fraction" value={`${(f * 100).toFixed(1)}%`} tip="f(T) — thermal grip multiplier on peakMu. 100% = at optimal temperature. Applied to all Pacejka force calculations." />
              <DerivedRow label="Grip deficit" value={`−${((1 - f) * 100).toFixed(1)}%`} tip="Percentage of peak grip lost due to temperature offset. 0% = at optimal. Reduces tyre forces, slip angles, and handling limit." />
              <DerivedRow label="Tyre status" value={status} tip="Simple classification based on current μ fraction." />
            </>;
          })()}
        </div>

      <div className="param-note">
        Bicycle model — steady-state constant radius.<br />
        Stages 3–6: load transfer · suspension · drivetrain · braking · aero<br />
        Stage 9: Pacejka load sensitivity (degressive μ with Fz)<br />
        Stage 10: Gear model (torque curve · ratio progression · optimal gear selection)<br />
        Stage 11: Tyre thermal model (bell-curve μ vs temperature)
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SliderRow({
  cfg,
  params,
  set,
}: {
  cfg: SliderConfig;
  params: VehicleParams;
  set: (key: keyof VehicleParams, v: number) => void;
}) {
  const { label, key, min, max, step, unit, format, tip } = cfg;
  const raw     = (params[key] as number) ?? min;   // guard: undefined during HMR state mismatch
  const display = format ? format(raw) : raw < 10 ? raw.toFixed(2) : raw.toFixed(0);

  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">
          {label}
          <InfoTooltip text={tip} />
        </span>
        <span className="slider-value">{display} {unit}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={raw}
        onChange={e => set(key, Number(e.target.value))}
      />
    </div>
  );
}

// ── Power slider with unit toggle ────────────────────────────────────────────

function PowerSliderRow({ powerKW, unit, onUnitChange, onKWChange }: {
  powerKW: number;
  unit: PowerUnit;
  onUnitChange: (u: PowerUnit) => void;
  onKWChange: (kw: number) => void;
}) {
  const range = POWER_RANGE[unit];
  const displayVal = Math.round(fromKW(powerKW, unit));

  return (
    <div className="slider-row">
      <div className="slider-header">
        <span className="slider-label">
          Engine power
          <InfoTooltip text="Peak power at the wheels. F = P × throttle / V. Higher power means more traction load on driven tyres at any given speed and throttle." />
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="slider-value">{displayVal} {unit}</span>
          <span className="unit-toggle">
            {(['kW', 'BHP', 'PS'] as PowerUnit[]).map(u => (
              <button
                key={u}
                className={`unit-btn ${unit === u ? 'unit-btn--active' : ''}`}
                onClick={() => onUnitChange(u)}
              >{u}</button>
            ))}
          </span>
        </span>
      </div>
      <input
        type="range"
        min={range.min} max={range.max} step={range.step}
        value={displayVal}
        onChange={e => onKWChange(toKW(Number(e.target.value), unit))}
      />
    </div>
  );
}

const DT_OPTIONS: { id: DrivetrainType; label: string; tip: string }[] = [
  { id: 'FWD',    label: 'FWD',   tip: 'Front-wheel drive. Drive force on front axle only. Under throttle the front tyres carry both traction and cornering load → combined slip → understeer increases with throttle.' },
  { id: 'RWD',    label: 'RWD',   tip: 'Rear-wheel drive. Under throttle the rear tyres carry both traction and cornering load → oversteer tendency increases with throttle.' },
  { id: 'AWD',    label: 'AWD',   tip: 'All-wheel drive. Torque split front/rear via the AWD bias slider. Both axles share traction load → more balanced, higher traction limit.' },
  { id: 'AWD_TV', label: 'AWD+TV', tip: 'AWD with active torque vectoring. Biases rear torque left/right to create a yaw moment. Reduces understeer under power — the TV yaw moment shows the active correction.' },
];

function DrivetrainSelector({ value, onChange }: { value: DrivetrainType; onChange: (dt: DrivetrainType) => void }) {
  return (
    <div className="dt-selector">
      {DT_OPTIONS.map(opt => (
        <button
          key={opt.id}
          className={`dt-btn ${value === opt.id ? 'dt-btn--active' : ''}`}
          onClick={() => onChange(opt.id)}
          title={opt.tip}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function DerivedRow({ label, value, tip }: { label: string; value: string; tip: string }) {
  return (
    <div className="derived-row">
      <span className="derived-label">
        {label}
        <InfoTooltip text={tip} />
      </span>
      <span className="derived-value">{value}</span>
    </div>
  );
}

// ── Aero presets ─────────────────────────────────────────────────────────────

interface AeroPreset {
  label:  string;
  tip:    string;
  aeroCL:            number;
  aeroCD:            number;
  aeroReferenceArea: number;
  aeroBalance:       number;
}

const AERO_PRESETS: AeroPreset[] = [
  { label: 'Road',    tip: 'Clean road car — no wings, low drag. CL≈0, CD≈0.28.', aeroCL: 0,    aeroCD: 0.28, aeroReferenceArea: 2.0, aeroBalance: 0.45 },
  { label: 'Mild',    tip: 'Mild aero kit — small lip spoiler + front splitter. CL≈0.3, CD≈0.33.', aeroCL: 0.30, aeroCD: 0.33, aeroReferenceArea: 1.9, aeroBalance: 0.45 },
  { label: 'GT',      tip: 'GT3/GTE-style wing package. CL≈0.9, CD≈0.55.', aeroCL: 0.90, aeroCD: 0.55, aeroReferenceArea: 1.8, aeroBalance: 0.42 },
  { label: 'Formula', tip: 'Open-wheel formula car. High downforce, high drag. CL≈2.8, CD≈0.90.', aeroCL: 2.80, aeroCD: 0.90, aeroReferenceArea: 1.5, aeroBalance: 0.40 },
];

function AeroPresets({ params, onChange }: { params: VehicleParams; onChange: (p: VehicleParams) => void }) {
  const active = AERO_PRESETS.findIndex(p =>
    Math.abs(p.aeroCL - params.aeroCL) < 0.01 &&
    Math.abs(p.aeroCD - params.aeroCD) < 0.01 &&
    Math.abs(p.aeroReferenceArea - params.aeroReferenceArea) < 0.01,
  );

  return (
    <div className="dt-selector" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {AERO_PRESETS.map((preset, i) => (
        <button
          key={preset.label}
          className={`dt-btn ${active === i ? 'dt-btn--active' : ''}`}
          title={preset.tip}
          onClick={() => onChange({ ...params, aeroCL: preset.aeroCL, aeroCD: preset.aeroCD, aeroReferenceArea: preset.aeroReferenceArea, aeroBalance: preset.aeroBalance })}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );
}
