import { useState, useEffect } from 'react';
import './LandingPage.css';

function getInitialDark(): boolean {
  try { return window.matchMedia('(prefers-color-scheme: dark)').matches; }
  catch { return true; }
}

const FEATURES = [
  {
    icon: '🏎️',
    title: 'Pacejka Magic Formula',
    body: 'Full nonlinear tyre model — Fy, Fx, combined slip. Load sensitivity, camber thrust, thermal core. The same model used in professional vehicle dynamics software.',
  },
  {
    icon: '🗺️',
    title: '22 Real Circuits',
    body: 'GPS-accurate tracks from TUMFTM and OpenStreetMap — Spa, Monza, Silverstone, Suzuka, Zandvoort, Interlagos, and 16 more. Schematic and generic circuits included.',
  },
  {
    icon: '⏱️',
    title: 'Lap Time & Race Sim',
    body: 'Point-mass quasi-static lap time estimator per segment. Multi-lap race simulation with tyre warmup, degradation, fuel burn, pit strategy, and sector timing.',
  },
  {
    icon: '🔧',
    title: 'Setup Optimiser',
    body: 'Nelder-Mead simplex search over spring rates, ARB, aero balance, and brake bias. Finds the minimum lap time setup automatically across any circuit.',
  },
  {
    icon: '📐',
    title: '14-DOF Time Domain',
    body: 'RK4 ODE solver for step steer, sine sweep, and brake-in-turn scenarios. Roll centre, motion ratio, dynamic camber — full transient response.',
  },
  {
    icon: '📊',
    title: 'Data Export & Import',
    body: 'Export lap traces and race telemetry as CSV. Import your own telemetry and overlay it against the sim. Share setups as JSON.',
  },
];

const AUDIENCE = [
  { icon: '🎓', who: 'Engineering students', why: 'Learn vehicle dynamics from first principles with immediate visual feedback — no textbook needed.' },
  { icon: '🏁', who: 'Formula Student teams', why: 'Quick setup direction on spring rates, ARB, brake bias, and aero balance before track day.' },
  { icon: '🕹️', who: 'Sim racers', why: 'Build intuition for why setup changes work — see the physics behind understeer and oversteer.' },
  { icon: '🔬', who: 'Curious engineers', why: 'Explore Pacejka, load transfer, roll dynamics, and race strategy interactively.' },
];

const VALIDATION = [
  { circuit: 'Spa-Francorchamps', model: '2:13.8', ref: '~2:13–2:17' },
  { circuit: 'Monza', model: '1:50.2', ref: '~1:49–1:53' },
  { circuit: 'Silverstone', model: '2:00.8', ref: '~2:00–2:04' },
  { circuit: 'Zandvoort', model: '1:31.3', ref: '~1:31–1:35' },
  { circuit: 'Red Bull Ring', model: '1:25.2', ref: '~1:24–1:28' },
  { circuit: 'São Paulo', model: '1:33.9', ref: '~1:32–1:36' },
];

export function LandingPage() {
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <div className="land">

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav className="land-nav">
        <a href="/" className="land-nav-logo">
          <img
            src={dark ? '/logo-dark.png' : '/logo-light.png'}
            alt="RacePhysiX"
            className="land-nav-logo-img"
          />
        </a>
        <div className="land-nav-links">
          <a href="/pro" className="land-nav-link">Pro</a>
          <a href="https://github.com/srikarbuddhiraju/RacePhysiX" target="_blank" rel="noopener noreferrer" className="land-nav-link">GitHub</a>
          <button className="land-theme-toggle" onClick={() => setDark(d => !d)} title={dark ? 'Light mode' : 'Dark mode'} aria-label="Toggle theme">
            {dark ? '☀' : '🌙'}
          </button>
          <a href="/app" className="land-nav-cta">Launch Simulator</a>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="land-hero">
        <div className="land-hero-inner">
          <div className="land-hero-badge">Free · No install · No account</div>
          <h1 className="land-hero-title">
            Physics-accurate vehicle dynamics.<br />
            <span className="land-hero-accent">In your browser.</span>
          </h1>
          <p className="land-hero-sub">
            Adjust any setup parameter — tyres, suspension, aero, brakes — and see the
            effect on handling balance, cornering speed, and lap time across 22 real circuits.
            Instantly.
          </p>
          <div className="land-hero-actions">
            <a href="/app" className="land-btn-primary">Launch Simulator →</a>
            <a href="/pro" className="land-btn-secondary">Join Pro Waitlist</a>
          </div>
          <p className="land-hero-meta">
            424 physics validation checks pass &nbsp;·&nbsp; GT3 accuracy ±5–10% &nbsp;·&nbsp; 46 physics stages
          </p>
        </div>
      </section>

      {/* ── Screenshot ───────────────────────────────────────────────── */}
      <section className="land-screenshot-section">
        <div className="land-screenshot-wrap">
          <img
            src="/docs/screenshot-main.png"
            alt="RacePhysiX simulator — GT3 on Spa-Francorchamps"
            className="land-screenshot"
          />
        </div>
        <p className="land-screenshot-caption">GT3 preset · Spa-Francorchamps · Real-time physics</p>
      </section>

      {/* ── Features ─────────────────────────────────────────────────── */}
      <section className="land-section">
        <div className="land-inner">
          <h2 className="land-section-title">Built on the full physics stack</h2>
          <p className="land-section-sub">
            Every model references Milliken &amp; Milliken, Gillespie, and Pacejka. No simplified approximations.
          </p>
          <div className="land-features-grid">
            {FEATURES.map(f => (
              <div key={f.title} className="land-feature-card">
                <div className="land-feature-icon">{f.icon}</div>
                <h3 className="land-feature-title">{f.title}</h3>
                <p className="land-feature-body">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Audience ─────────────────────────────────────────────────── */}
      <section className="land-section land-section-alt">
        <div className="land-inner">
          <h2 className="land-section-title">Who uses it</h2>
          <div className="land-audience-grid">
            {AUDIENCE.map(a => (
              <div key={a.who} className="land-audience-card">
                <span className="land-audience-icon">{a.icon}</span>
                <h3 className="land-audience-who">{a.who}</h3>
                <p className="land-audience-why">{a.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Validation ───────────────────────────────────────────────── */}
      <section className="land-section">
        <div className="land-inner land-inner-narrow">
          <h2 className="land-section-title">Validated against real lap times</h2>
          <p className="land-section-sub">BMW M4 GT3 2023 qualifying — model vs published reference times.</p>
          <div className="land-val-table">
            <div className="land-val-header">
              <span>Circuit</span>
              <span>Model</span>
              <span>Reference</span>
            </div>
            {VALIDATION.map(v => (
              <div key={v.circuit} className="land-val-row">
                <span>{v.circuit}</span>
                <span className="land-val-model">{v.model}</span>
                <span className="land-val-ref">{v.ref} ✓</span>
              </div>
            ))}
          </div>
          <p className="land-val-note">Overall accuracy ±5–10% vs real-world qualifying times.</p>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────── */}
      <section className="land-cta-section">
        <div className="land-inner land-inner-narrow land-cta-inner">
          <h2 className="land-cta-title">Start simulating in 10 seconds.</h2>
          <p className="land-cta-sub">No account. No download. Pick a preset and run a lap.</p>
          <a href="/app" className="land-btn-primary land-btn-lg">Launch Simulator →</a>
          <p className="land-cta-meta">Free forever &nbsp;·&nbsp; AGPL-3.0 open source &nbsp;·&nbsp; <a href="/pro" className="land-cta-pro-link">Pro coming soon</a></p>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────── */}
      <footer className="land-footer">
        <div className="land-footer-inner">
          <div className="land-footer-left">
            <img
              src={dark ? '/logo-dark.png' : '/logo-light.png'}
              alt="RacePhysiX"
              className="land-footer-logo"
            />
            <p className="land-footer-copy">© {new Date().getFullYear()} Srikar Buddhiraju</p>
          </div>
          <div className="land-footer-links">
            <a href="/app">Simulator</a>
            <a href="/pro">Pro</a>
            <a href="https://github.com/srikarbuddhiraju/RacePhysiX" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/sponsors/srikarbuddhiraju" target="_blank" rel="noopener noreferrer">Sponsor</a>
            <a href="mailto:racephysix@srikarbuddhiraju.com">Contact</a>
          </div>
        </div>
        <div className="land-footer-legal">
          AGPL-3.0 · Circuit GPS data: LGPL-3.0 (TUMFTM) · ODbL (OpenStreetMap)
        </div>
      </footer>

    </div>
  );
}
