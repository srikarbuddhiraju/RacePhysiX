import { useState, useMemo } from 'react';
import { computeBicycleModel } from './physics/bicycleModel';
import { ParameterPanel } from './components/ParameterPanel';
import { ResultsPanel } from './components/ResultsPanel';
import { TopDownView } from './visualisation/TopDownView';
import type { VehicleParams } from './physics/types';
import './App.css';

const DEFAULT_PARAMS: VehicleParams = {
  mass: 1500,                   // kg
  wheelbase: 2.7,               // m
  frontWeightFraction: 0.55,    // 55% front
  corneringStiffnessNPerDeg: 500, // N/deg per axle
  cgHeight: 0.55,               // m
  turnRadius: 50,               // m
  speedKph: 80,                 // km/h
};

export function App() {
  const [params, setParams] = useState<VehicleParams>(DEFAULT_PARAMS);
  const result = useMemo(() => computeBicycleModel(params), [params]);

  return (
    <div className="app">
      <ParameterPanel params={params} onChange={setParams} />
      <div className="canvas-area">
        <TopDownView params={params} result={result} />
      </div>
      <ResultsPanel result={result} />
    </div>
  );
}
