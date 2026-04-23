import { useState } from 'react';

const STORAGE_KEY = 'racephysix_welcomed_v1';

interface WelcomeModalProps {
  visible: boolean;
  onClose: () => void;
  onOpenDocs: () => void;
}

export function WelcomeModal({ visible, onClose, onOpenDocs }: WelcomeModalProps) {
  const [dontShow, setDontShow] = useState(false);

  if (!visible) return null;

  const handleDismiss = () => {
    if (dontShow) {
      try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* quota */ }
    }
    onClose();
  };

  const handleDocs = () => {
    handleDismiss();
    onOpenDocs();
  };

  const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const logoSrc = darkMode ? '/logo-dark.png' : '/logo-light.png';

  return (
    /* Backdrop */
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 900,
        background: 'rgba(0,0,0,0.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleDismiss(); }}
    >
      {/* Modal box */}
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '32px 36px',
        width: '100%',
        maxWidth: 580,
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        position: 'relative',
      }}>

        {/* Close button */}
        <button
          onClick={handleDismiss}
          title="Dismiss"
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'transparent', border: 'none',
            color: 'var(--text-muted)', fontSize: 20, cursor: 'pointer',
            lineHeight: 1, padding: '2px 6px', borderRadius: 4,
          }}
        >
          ×
        </button>

        {/* Logo */}
        <img
          src={logoSrc}
          alt="RacePhysiX"
          style={{ height: 36, width: 'auto', marginBottom: 16 }}
        />

        {/* Tagline */}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 24 }}>
          Physics-accurate vehicle dynamics simulation — in your browser.
          No install. No account. Just open and simulate.
        </div>

        {/* Quick-start steps */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 12,
          }}>
            How to get started
          </div>
          {[
            ['1', 'Pick a vehicle preset', 'Road Car, Formula Student, GT3, or F1 — each fills in realistic parameters for that class.'],
            ['2', 'Choose a circuit and run a lap', 'Select any of 22 circuits, hit Run Lap Sim, and get a lap time with sector splits instantly.'],
            ['3', 'Change a parameter', 'Adjust suspension, aero, tyres, or drivetrain — every change recomputes in real time.'],
          ].map(([num, title, desc]) => (
            <div key={num} style={{
              display: 'flex', gap: 14, marginBottom: 12, alignItems: 'flex-start',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                background: 'var(--accent)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{num}</div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Capability pills */}
        <div style={{ marginBottom: 28 }}>
          <div style={{
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: 10,
          }}>
            What's inside
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              'Pacejka tyre model', '22 GPS circuits', 'Race simulation',
              '14-DOF dynamics', 'Setup optimiser', 'Tyre thermals',
              'Race strategy', 'Telemetry overlay', 'Data export',
            ].map(label => (
              <span key={label} style={{
                fontSize: 10, padding: '3px 9px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 12,
                color: 'var(--text-secondary)',
              }}>{label}</span>
            ))}
          </div>
        </div>

        {/* Don't show again */}
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            id="dont-show-again"
            checked={dontShow}
            onChange={e => setDontShow(e.target.checked)}
            style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
          />
          <label htmlFor="dont-show-again" style={{
            fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer', userSelect: 'none',
          }}>
            Don't show this again
          </label>
        </div>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={handleDocs}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 6,
              border: '1px solid var(--accent)',
              background: 'transparent',
              color: 'var(--accent-text)', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(96,96,208,0.12)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            View Documentation →
          </button>
          <button
            onClick={handleDismiss}
            style={{
              flex: 1, padding: '10px 0', borderRadius: 6,
              border: 'none', background: 'var(--accent)',
              color: '#fff', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Start Exploring
          </button>
        </div>
      </div>
    </div>
  );
}
