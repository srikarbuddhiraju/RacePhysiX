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

interface Props {
  onSelect: (params: VehicleParams, coeffs: PacejkaCoeffs) => void;
}

export function VehiclePresetSelector({ onSelect }: Props) {
  const [activeId, setActiveId] = useState<string>('road');
  const [tooltip,  setTooltip]  = useState<string | null>(null);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '6px 10px',
      background: 'var(--panel-bg)',
      borderBottom: '1px solid var(--border-color)',
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, color: 'var(--label-color)',
        textTransform: 'uppercase', letterSpacing: '0.08em',
        marginRight: 4, whiteSpace: 'nowrap',
      }}>
        Vehicle
      </span>

      {VEHICLE_PRESETS.map(preset => {
        const active = activeId === preset.id;
        return (
          <button
            key={preset.id}
            title={preset.description}
            onMouseEnter={() => setTooltip(preset.description)}
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
            }}
          >
            {preset.label}
          </button>
        );
      })}

      {tooltip && (
        <span style={{
          fontSize: 10, color: 'var(--label-color)', opacity: 0.7,
          marginLeft: 4, fontStyle: 'italic',
        }}>
          {tooltip}
        </span>
      )}
    </div>
  );
}
