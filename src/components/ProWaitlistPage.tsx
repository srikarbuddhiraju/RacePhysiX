import { useState, useEffect } from 'react';
import './ProWaitlistPage.css';

const WAITLIST_URL = import.meta.env.PROD
  ? 'https://racephysix-waitlist.srikarbuddhiraju.workers.dev/waitlist'
  : 'http://localhost:8787/waitlist';

const PRO_FEATURES = [
  {
    icon: '☁️',
    title: 'Cloud Setup Saves',
    description: 'Save unlimited vehicle setups and lap sim results across devices. Never lose a session.',
  },
  {
    icon: '👥',
    title: 'Team Workspaces',
    description: 'Share setups with your Formula Student team or engineering group. Live collaboration.',
  },
  {
    icon: '📊',
    title: 'Lap Time Database',
    description: 'Access historical validated lap times across all 22 circuits to benchmark your setup.',
  },
  {
    icon: '🔧',
    title: 'Custom Tyre Coefficients',
    description: 'Import your own Pacejka MF coefficients from tyre data sheets — go beyond the generic model.',
  },
  {
    icon: '📥',
    title: 'Bulk Data Export',
    description: 'Export full session data, optimisation runs, and race strategies to CSV / JSON.',
  },
  {
    icon: '⚡',
    title: 'Priority Features',
    description: 'Vote on the roadmap. Pro subscribers shape what gets built next.',
  },
];

type FormState = 'idle' | 'submitting' | 'success' | 'error';

function getInitialDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return true;
  }
}

export function ProWaitlistPage() {
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dark, setDark] = useState(getInitialDark);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }, [dark]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setFormState('submitting');
    setErrorMsg('');

    try {
      const res = await fetch(WAITLIST_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setFormState('success');
        setEmail('');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMsg((data as { error?: string }).error ?? 'Something went wrong. Please try again.');
        setFormState('error');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection and try again.');
      setFormState('error');
    }
  }

  return (
    <div className="pro-page">
      {/* ── Nav ───────────────────────────────────────────────────── */}
      <nav className="pro-nav">
        <a href="/" className="pro-nav-logo">
          <img
            src={dark ? '/logo-dark.png' : '/logo-light.png'}
            alt="RacePhysiX"
            className="pro-nav-logo-img"
          />
        </a>
        <div className="pro-nav-right">
          <button
            className="pro-theme-toggle"
            onClick={() => setDark(d => !d)}
            title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {dark ? '☀' : '🌙'}
          </button>
          <a href="/" className="pro-nav-link">← Back to Simulator</a>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="pro-hero">
        <div className="pro-badge">Coming Soon</div>
        <h1 className="pro-title">
          RacePhysiX <span className="pro-title-accent">Pro</span>
        </h1>
        <p className="pro-subtitle">
          The full vehicle dynamics platform for engineers who need more than one browser tab.
          Cloud saves, team workspaces, custom tyre data, and priority access to new physics stages.
        </p>

        {/* ── Waitlist form ─────────────────────────────────────── */}
        {formState === 'success' ? (
          <div className="pro-success">
            <span className="pro-success-icon">✓</span>
            <p>You're on the list. We'll email you when Pro launches.</p>
          </div>
        ) : (
          <form className="pro-form" onSubmit={handleSubmit} noValidate>
            <input
              type="email"
              className="pro-input"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={formState === 'submitting'}
              aria-label="Email address"
            />
            <button
              type="submit"
              className="pro-submit"
              disabled={formState === 'submitting' || !email.trim()}
            >
              {formState === 'submitting' ? 'Joining…' : 'Notify me at launch'}
            </button>
          </form>
        )}

        {formState === 'error' && (
          <p className="pro-error">{errorMsg}</p>
        )}

        <p className="pro-disclaimer">No spam. One email when Pro launches. Unsubscribe any time.</p>
      </section>

      {/* ── Features grid ─────────────────────────────────────────── */}
      <section className="pro-features">
        <h2 className="pro-features-title">What's in Pro</h2>
        <div className="pro-grid">
          {PRO_FEATURES.map(f => (
            <div key={f.title} className="pro-card">
              <div className="pro-card-icon">{f.icon}</div>
              <h3 className="pro-card-title">{f.title}</h3>
              <p className="pro-card-desc">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Free tier reassurance ─────────────────────────────────── */}
      <section className="pro-free">
        <h2 className="pro-free-title">The free tier stays free</h2>
        <p className="pro-free-desc">
          All 46 physics stages, 22 circuits, and the full lap time simulator remain completely
          free — forever. Pro is for teams and engineers who need cloud, collaboration, and
          deeper data tools on top.
        </p>
        <a href="/" className="pro-free-link">Open the simulator →</a>
      </section>

      {/* ── Footer ────────────────────────────────────────────────── */}
      <footer className="pro-footer">
        <span>© {new Date().getFullYear()} Srikar Buddhiraju</span>
        <span>·</span>
        <a href="https://github.com/srikarbuddhiraju/RacePhysiX" target="_blank" rel="noopener noreferrer">GitHub</a>
        <span>·</span>
        <a href="mailto:racephysix@srikarbuddhiraju.com">Contact</a>
      </footer>
    </div>
  );
}
