import { useState, useMemo } from 'react';
import { computeBicycleModel } from './physics/bicycleModel';
import { computePacejkaModel, DEFAULT_PACEJKA_COEFFS } from './physics/pacejkaModel';
import { ParameterPanel } from './components/ParameterPanel';
import { ResultsPanel }   from './components/ResultsPanel';
import { TopDownView }    from './visualisation/TopDownView';
import { ChartsPanel }    from './charts/ChartsPanel';
import type { VehicleParams, PacejkaCoeffs } from './physics/types';
import './App.css';

const DEFAULT_PARAMS: VehicleParams = {
  mass: 1500,
  wheelbase: 2.7,
  frontWeightFraction: 0.55,
  corneringStiffnessNPerDeg: 500,
  cgHeight: 0.55,
  trackWidth: 1.5,
  tyreSectionWidth: 0.205,       // m — 205/55R16, typical road car
  turnRadius: 200,               // m — 0.25g at 80 km/h, within linear model range
  speedKph: 80,
  vehicleClass: 'road',
};

export function App() {
  const [params, setParams]   = useState<VehicleParams>(DEFAULT_PARAMS);
  const [coeffs, setCoeffs]   = useState<PacejkaCoeffs>(DEFAULT_PACEJKA_COEFFS);

  const bicycle = useMemo(() => computeBicycleModel(params),         [params]);
  const pacejka = useMemo(() => computePacejkaModel(params, coeffs), [params, coeffs]);

  return (
    <div className="app">
      {/* Top row: param panel | 3D view | results */}
      <div className="app-main">
        <ParameterPanel params={params} onChange={setParams} />
        <div className="canvas-area">
          <TopDownView params={params} result={bicycle} />
        </div>
        <ResultsPanel result={bicycle} />
      </div>

      {/* Bottom row: dynamic charts (tyre curve + handling diagram + Pacejka sliders) */}
      <div className="app-charts">
        <ChartsPanel
          pacejka={pacejka}
          bicycle={bicycle}
          coeffs={coeffs}
          onCoeffsChange={setCoeffs}
          params={params}
          onParamsChange={setParams}
        />
      </div>
    </div>
  );
}
