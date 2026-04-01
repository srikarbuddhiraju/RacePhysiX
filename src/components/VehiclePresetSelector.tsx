/**
 * VehiclePresetSelector — Stage 18 + Stage 48
 *
 * Compact horizontal row of preset buttons + import/export for vehicle setups.
 * Stage 48 adds:
 *  - "Export Setup" → downloads current params + Pacejka coeffs as JSON
 *  - "Import Setup" → reads a JSON file, validates, shows errors/warnings,
 *                     "Apply anyway" if only warnings (no hard errors)
 */

import { useRef, useState } from 'react';
import { VEHICLE_PRESETS } from '../physics/vehiclePresets';
import type { VehicleParams, PacejkaCoeffs } from '../physics/types';
import { type PowerUnit, fmtPower } from '../utils/units';
import { exportSetupJSON, validateSetupJSON, type ValidationResult } from '../physics/vehicleSetup';

interface Props {
  onSelect:           (params: VehicleParams, coeffs: PacejkaCoeffs) => void;
  onReset:            () => void;
  powerUnit:          PowerUnit;
  onPowerUnitChange:  (u: PowerUnit) => void;
  params:             VehicleParams;
  coeffs:             PacejkaCoeffs;
}

/** Replace the hardcoded "X kW" in a preset description with the converted value. */
function formatDesc(desc: string, kw: number, unit: PowerUnit): string {
  return desc.replace(/\d+ kW/, fmtPower(kw, unit));
}

const BTN_BASE: React.CSSProperties = {
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
};

export function VehiclePresetSelector({
  onSelect, onReset, powerUnit, onPowerUnitChange, params, coeffs,
}: Props) {
  const [activeId,    setActiveId]    = useState<string | null>('road');
  const [tooltip,     setTooltip]     = useState<string | null>(null);
  const [importState, setImportState] = useState<ValidationResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleExport() {
    exportSetupJSON(params, coeffs);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const raw    = JSON.parse(ev.target?.result as string);
        const result = validateSetupJSON(raw);
        if (result.errors.length === 0 && result.warnings.length === 0) {
          // Clean — apply immediately, no banner needed
          onSelect(result.params!, result.coeffs!);
          setActiveId(null);
          setImportState(null);
        } else {
          setImportState(result);
          // If no hard errors, apply the parsed values immediately in background
          // (user can still dismiss or check the warnings)
          if (result.errors.length === 0) {
            onSelect(result.params!, result.coeffs!);
            setActiveId(null);
          }
        }
      } catch {
        setImportState({
          errors: ['File is not valid JSON. Please check the file and try again.'],
          warnings: [],
        });
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported after editing
    e.target.value = '';
  }

  return (
    <div>
      {/* ── Main preset row ───────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '6px 10px',
        background: 'var(--panel-bg)',
        borderBottom: importState ? 'none' : '1px solid var(--border-color)',
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
                ...BTN_BASE,
                fontWeight: active ? 700 : 500,
                background: active ? 'rgba(99,102,241,0.20)' : 'transparent',
                border: `1px solid ${active ? '#6366f1' : 'var(--border-color)'}`,
                color: active ? '#a5b4fc' : 'var(--label-color)',
              }}
            >
              {preset.label}
            </button>
          );
        })}

        {/* Reset */}
        <button
          title="Reset all parameters to default values"
          onMouseEnter={() => setTooltip('Reset all parameters to defaults')}
          onMouseLeave={() => setTooltip(null)}
          onClick={() => { setActiveId(null); onReset(); setImportState(null); }}
          style={{ ...BTN_BASE, opacity: 0.6 }}
        >
          Reset
        </button>

        {/* Separator */}
        <span style={{ width: 1, height: 16, background: 'var(--border-color)', flexShrink: 0 }} />

        {/* Export */}
        <button
          title="Export current vehicle setup as a JSON file"
          onMouseEnter={() => setTooltip('Export current setup to JSON')}
          onMouseLeave={() => setTooltip(null)}
          onClick={handleExport}
          style={{ ...BTN_BASE, color: '#60a5fa' }}
        >
          ↓ Export
        </button>

        {/* Import */}
        <button
          title="Import a vehicle setup from a JSON file"
          onMouseEnter={() => setTooltip('Import setup from JSON file')}
          onMouseLeave={() => setTooltip(null)}
          onClick={() => fileInputRef.current?.click()}
          style={{ ...BTN_BASE, color: '#34d399' }}
        >
          ↑ Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />

        {/* Tooltip — fills remaining space */}
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

      {/* ── Import result banner ──────────────────────────────────────────── */}
      {importState && (
        <ImportBanner
          result={importState}
          onApply={() => {
            if (importState.params && importState.coeffs) {
              onSelect(importState.params, importState.coeffs);
              setActiveId(null);
            }
            setImportState(null);
          }}
          onDismiss={() => setImportState(null)}
        />
      )}
    </div>
  );
}

// ─── Import Banner ─────────────────────────────────────────────────────────────

function ImportBanner({
  result, onApply, onDismiss,
}: {
  result:    ValidationResult;
  onApply:   () => void;
  onDismiss: () => void;
}) {
  const hasErrors   = result.errors.length   > 0;
  const hasWarnings = result.warnings.length > 0;

  const borderColor = hasErrors ? '#f87171' : '#fbbf24';
  const bgColor     = hasErrors ? 'rgba(239,68,68,0.08)' : 'rgba(251,191,36,0.08)';
  const titleColor  = hasErrors ? '#f87171' : '#fbbf24';

  return (
    <div style={{
      padding: '8px 12px',
      background: bgColor,
      borderBottom: `1px solid var(--border-color)`,
      borderLeft: `3px solid ${borderColor}`,
      fontSize: 11,
      lineHeight: 1.5,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 700, color: titleColor }}>
            {hasErrors
              ? `Import failed — ${result.errors.length} error${result.errors.length > 1 ? 's' : ''}`
              : `Import applied with ${result.warnings.length} warning${result.warnings.length > 1 ? 's' : ''}`}
          </span>

          {/* Errors */}
          {result.errors.map((e, i) => (
            <div key={i} style={{ color: '#f87171', marginTop: 2 }}>✗ {e}</div>
          ))}

          {/* Warnings */}
          {hasWarnings && (
            <div style={{ marginTop: 4 }}>
              {result.warnings.slice(0, 5).map((w, i) => (
                <div key={i} style={{ color: '#fbbf24', marginTop: 1 }}>⚠ {w}</div>
              ))}
              {result.warnings.length > 5 && (
                <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>
                  … and {result.warnings.length - 5} more warnings
                </div>
              )}
            </div>
          )}

          {/* Apply anyway option for hard-error state (partial data) */}
          {hasErrors && result.params && (
            <div style={{ marginTop: 6 }}>
              <button onClick={onApply} style={{
                padding: '3px 10px', fontSize: 10, fontWeight: 600,
                background: 'rgba(248,113,113,0.15)',
                border: '1px solid #f87171', borderRadius: 4,
                color: '#f87171', cursor: 'pointer', marginRight: 6,
              }}>
                Apply anyway
              </button>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>
                (valid fields will be applied, missing/invalid fields keep current values)
              </span>
            </div>
          )}
        </div>

        {/* Dismiss */}
        <button onClick={onDismiss} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--label-color)', fontSize: 14, lineHeight: 1,
          padding: '0 4px', opacity: 0.6, flexShrink: 0,
        }}>✕</button>
      </div>
    </div>
  );
}
