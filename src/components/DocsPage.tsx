import { useEffect, useState, useCallback } from 'react';
import Markdown from 'react-markdown';
import './DocsPage.css';

const VERSION = '0.1.0';

const NAV_ITEMS = [
  { id: 'getting-started', label: 'Getting Started',   file: 'getting-started.md' },
  { id: 'user-guide',      label: 'User Guide',         file: 'user-guide.md' },
  { id: 'physics-overview',label: 'Physics Models',     file: 'physics-overview.md' },
  { id: 'circuits',        label: 'Circuit Reference',  file: 'circuits.md' },
  { id: 'faq',             label: 'FAQ',                file: 'faq.md' },
] as const;

type SectionId = typeof NAV_ITEMS[number]['id'];

interface DocsPageProps {
  initialSection?: string;
  onBack: () => void;
}

export function DocsPage({ initialSection, onBack }: DocsPageProps) {
  const resolveSection = (raw?: string): SectionId => {
    const match = NAV_ITEMS.find(n => n.id === raw);
    return match ? match.id : 'getting-started';
  };

  const [section, setSection] = useState<SectionId>(() => resolveSection(initialSection));
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState<string | null>(null);

  // Keep URL hash in sync with current section
  useEffect(() => {
    window.location.hash = section === 'getting-started' ? '#docs' : `#docs/${section}`;
  }, [section]);

  // Handle clicks on internal markdown links (e.g. [Physics Models](physics-overview))
  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (target.tagName !== 'A') return;
    const href = (target as HTMLAnchorElement).getAttribute('href') ?? '';
    const match = NAV_ITEMS.find(n => n.id === href);
    if (match) {
      e.preventDefault();
      setSection(match.id);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const item = NAV_ITEMS.find(n => n.id === section)!;
    fetch(`/docs/${item.file}`)
      .then(r => {
        if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
        return r.text();
      })
      .then(text => { setContent(text); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
  }, [section]);

  const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const logoSrc = darkMode ? '/logo-dark.png' : '/logo-light.png';

  return (
    <div className="docs-root">
      {/* Header */}
      <div className="docs-header">
        <img src={logoSrc} alt="RacePhysiX" className="docs-header-logo" />
        <span className="docs-header-title">Documentation</span>
        <span className="docs-header-version">v{VERSION}</span>
        <button className="docs-back-btn" onClick={onBack}>
          ← Back to Simulator
        </button>
      </div>

      {/* Body */}
      <div className="docs-body">
        {/* Sidebar */}
        <nav className="docs-sidebar">
          <div className="docs-nav-section">Contents</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`docs-nav-item${section === item.id ? ' active' : ''}`}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="docs-content" onClick={handleClick}>
          {loading && <div className="docs-loading">Loading…</div>}
          {error   && <div className="docs-error">Failed to load: {error}</div>}
          {!loading && !error && (
            <div className="docs-markdown">
              <Markdown>{content}</Markdown>
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <div className="docs-footer">
        <span>RacePhysiX v{VERSION} — Physics-accurate vehicle dynamics simulation</span>
        <span>MIT Licence · © Srikar Buddhiraju</span>
      </div>
    </div>
  );
}
