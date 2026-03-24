/**
 * VehiclePresetSelector — Stage 18
 *
 * A compact horizontal row of preset buttons. Selecting a preset loads a full
 * VehicleParams + PacejkaCoeffs set so users have an immediately meaningful
 * starting point without needing to understand every parameter.
 */

import { useState } from 'react';
import { VEHICLE_PRESETS } from '../physics/vehiclePresets';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import { type PowerUnit, fmtPower } from '../utils/units';

interface Props {
  onSelect:           (params: VehicleParams, coeffs: PacejkaCoeffs) => void;
  onReset:            () => void;
  powerUnit:          PowerUnit;
  onPowerUnitChange:  (u: PowerUnit) => void;
}

/** Replace the hardcoded "X kW" in a preset description with the converted value. */
function formatDesc(desc: string, kw: number, unit: PowerUnit): string {
  return desc.replace(/\d+ kW/, fmtPower(kw, unit));
}

export function VehiclePresetSelector({ onSelect, onReset, powerUnit, onPowerUnitChange }: Props) {
  const [activeId, setActiveId] = useState<string | null>('road');
  const [tooltip,  setTooltip]  = useState<string | null>(null);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'var(--panel-bg)',
      borderBottom: '1px solid var(--border-color)',
      flexWrap: 'nowrap',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: 'var(--label-color)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginRight: 4, whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        Vehicle
      </span>

      {VEHICLE_PRESETS.map(preset => {
        const active = activeId === preset.id;
        const desc   = formatDesc(preset.description, preset.params.enginePowerKW, powerUnit);
        return (
          <button
            key={preset.id}
            title={desc}
            onMouseEnter={() => setTooltip(desc)}
            onMouseLeave={() => setTooltip(null)}
            onClick={() => {
              setActiveId(preset.id);
              onSelect(preset.params, preset.coeffs);
            }}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              background: active ? 'rgba(99,102,241,0.20)' : 'transparent',
              border: `1px solid ${active ? '#6366f1' : 'var(--border-color)'}`,
              borderRadius: 4,
              color: active ? '#a5b4fc' : 'var(--label-color)',
              cursor: 'pointer',
              transition: 'all 0.15s',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {preset.label}
          </button>
        );
      })}

      {/* Reset to defaults */}
      <button
        title="Reset all parameters to default values"
        onMouseEnter={() => setTooltip('Reset all parameters to defaults')}
        onMouseLeave={() => setTooltip(null)}
        onClick={() => { setActiveId(null); onReset(); }}
        style={{
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 500,
          background: 'transparent',
          border: '1px solid var(--border-color)',
          borderRadius: 4,
          color: 'var(--label-color)',
          cursor: 'pointer',
          transition: 'all 0.15s',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          opacity: 0.6,
        }}
      >
        Reset
      </button>

      {/* Tooltip — inline, right of buttons, truncates if needed */}
      <span style={{
        fontSize: 10, color: 'var(--label-color)', opacity: tooltip ? 0.7 : 0,
        marginLeft: 6, fontStyle: 'italic',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        flex: '1 1 0', minWidth: 0,
      }}>
        {tooltip ?? ''}
      </span>

      {/* Global power unit toggle */}
      <span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <span style={{ fontSize: 9, color: 'var(--label-color)', opacity: 0.5, marginRight: 2 }}>Power</span>
        {(['kW', 'BHP', 'PS'] as PowerUnit[]).map(u => (
          <button
            key={u}
            onClick={() => onPowerUnitChange(u)}
            style={{
              padding: '2px 7px', fontSize: 9, fontWeight: powerUnit === u ? 700 : 400,
              background: powerUnit === u ? 'rgba(99,102,241,0.20)' : 'transparent',
              border: `1px solid ${powerUnit === u ? '#6366f1' : 'var(--border-color)'}`,
              borderRadius: 3,
              color: powerUnit === u ? '#a5b4fc' : 'var(--label-color)',
              cursor: 'pointer',
            }}
          >{u}</button>
        ))}
      </span>
    </div>
  );
}
