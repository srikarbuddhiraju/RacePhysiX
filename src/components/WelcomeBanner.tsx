/**
 * WelcomeBanner — Stage 19 (Onboarding)
 *
 * Shown once on first visit. Explains what the tool does and how to start.
 * Dismisses permanently via localStorage flag.
 */

import { useState } from 'react';

const STORAGE_KEY = 'racephysix_welcomed_v1';

export function WelcomeBanner() {
  const [visible, setVisible] = useState<boolean>(() => {
    try { return !localStorage.getItem(STORAGE_KEY); } catch { return false; }
  });

  if (!visible) return null;

  const dismiss = () => {
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* quota */ }
    setVisible(false);
  };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 100%)',
      border: '1px solid rgba(99,102,241,0.35)',
      borderRadius: 6,
      padding: '10px 14px',
      margin: '6px 8px 0',
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#a5b4fc', marginBottom: 4 }}>
          Welcome to RacePhysiX
        </div>
        <div style={{ fontSize: 11, color: 'var(--label-color)', lineHeight: 1.5 }}>
          A physics-accurate vehicle dynamics simulator. Pick a <strong>vehicle preset</strong> above,
          then adjust the sliders — every parameter update recomputes tyre forces, lap time, and
          handling balance in real time.{' '}
          <span style={{ opacity: 0.7 }}>
            All models validated against Milliken &amp; Milliken (RCVD) and Gillespie.
          </span>
        </div>
        <div style={{ marginTop: 6, fontSize: 11, color: 'var(--label-color)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <span>→ <strong>Vehicle tab</strong>: mass, geometry, power</span>
          <span>→ <strong>Suspension tab</strong>: springs, ARB, roll stiffness</span>
          <span>→ <strong>Aero &amp; Braking tab</strong>: downforce, drag, brake bias</span>
          <span>→ <strong>Tyres &amp; Fuel tab</strong>: Pacejka coefficients, thermal model</span>
          <span>→ <strong>Lap Time tab</strong>: lap sim, race simulation, setup optimiser</span>
        </div>
      </div>
      <button
        onClick={dismiss}
        title="Dismiss"
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--label-color)',
          fontSize: 16,
          cursor: 'pointer',
          padding: '0 4px',
          lineHeight: 1,
          opacity: 0.6,
          flexShrink: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}
