import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import Markdown from 'react-markdown';
import './DocsPage.css';

const VERSION = '0.1.0';

const NAV_ITEMS = [
  { id: 'getting-started',     label: 'Getting Started',        file: 'getting-started.md' },
  { id: 'user-guide',          label: 'User Guide',             file: 'user-guide.md' },
  { id: 'physics-foundations', label: 'Physics — Foundations',  file: 'physics-foundations.md' },
  { id: 'physics-advanced',    label: 'Physics — Advanced',     file: 'physics-advanced.md' },
  { id: 'circuits',            label: 'Circuit Reference',      file: 'circuits.md' },
  { id: 'faq',                 label: 'FAQ',                    file: 'faq.md' },
] as const;

type SectionId = typeof NAV_ITEMS[number]['id'];

// ── Types ────────────────────────────────────────────────────────────────────

interface H2Section { heading: string; content: string; }
interface QAPair    { question: string; answer: string; }
interface SearchEntry { fileId: SectionId; fileLabel: string; heading: string; snippet: string; }

// ── Parsers ──────────────────────────────────────────────────────────────────

function parseH2Sections(text: string): H2Section[] {
  const parts = text.split(/^## /m);
  const intro: H2Section = { heading: '', content: parts[0] };
  const sections = parts.slice(1).map(part => {
    const nl = part.indexOf('\n');
    return {
      heading: nl >= 0 ? part.slice(0, nl).trim() : part.trim(),
      content: nl >= 0 ? part.slice(nl + 1) : '',
    };
  });
  return [intro, ...sections].filter(s => s.content.trim().length > 0);
}

function parseQAPairs(text: string): QAPair[] {
  const parts = text.split(/^### /m);
  return parts.slice(1).map(part => {
    const nl = part.indexOf('\n');
    return {
      question: nl >= 0 ? part.slice(0, nl).trim() : part.trim(),
      answer:   nl >= 0 ? part.slice(nl + 1).trim() : '',
    };
  });
}

// ── Search index ─────────────────────────────────────────────────────────────

async function buildSearchIndex(): Promise<SearchEntry[]> {
  const entries: SearchEntry[] = [];
  for (const item of NAV_ITEMS) {
    try {
      const r = await fetch(`/docs/${item.file}`);
      if (!r.ok) continue;
      const text = await r.text();
      const sections = parseH2Sections(text);
      for (const sec of sections) {
        const snippet = sec.content.replace(/[#*`>\-|]/g, '').replace(/\s+/g, ' ').slice(0, 160).trim();
        entries.push({
          fileId:    item.id,
          fileLabel: item.label,
          heading:   sec.heading || item.label,
          snippet,
        });
      }
    } catch { /* skip on fetch error */ }
  }
  return entries;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function QAAccordion({ pairs }: { pairs: QAPair[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  return (
    <div className="docs-qa-list">
      {pairs.map((pair, i) => (
        <div key={i} className="docs-qa-item">
          <button
            className={`docs-qa-question${openIdx === i ? ' open' : ''}`}
            onClick={() => setOpenIdx(openIdx === i ? null : i)}
          >
            <span className="docs-qa-chevron">{openIdx === i ? '▾' : '▸'}</span>
            {pair.question}
          </button>
          {openIdx === i && (
            <div className="docs-qa-answer docs-markdown">
              <Markdown>{pair.answer}</Markdown>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

interface CollapsibleSectionProps {
  section: H2Section;
  isFaq: boolean;
}

function CollapsibleSection({ section, isFaq }: CollapsibleSectionProps) {
  const [open, setOpen] = useState(true);

  // Intro block (before first ##) — always visible, no toggle
  if (!section.heading) {
    return (
      <div className="docs-markdown">
        <Markdown>{section.content}</Markdown>
      </div>
    );
  }

  const qaPairs = isFaq ? parseQAPairs(section.content) : null;

  return (
    <div className="docs-section">
      <button className="docs-section-toggle" onClick={() => setOpen(o => !o)}>
        <span className="docs-section-chevron">{open ? '▾' : '▸'}</span>
        {section.heading}
      </button>
      {open && (
        <div className="docs-section-body">
          {qaPairs && qaPairs.length > 0 ? (
            <QAAccordion pairs={qaPairs} />
          ) : (
            <div className="docs-markdown">
              <Markdown>{section.content}</Markdown>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SearchBarProps {
  index: SearchEntry[];
  onNavigate: (fileId: SectionId) => void;
}

function SearchBar({ index, onNavigate }: SearchBarProps) {
  const [query, setQuery]     = useState('');
  const [focused, setFocused] = useState(false);
  const wrapRef               = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (query.trim().length < 2) return [];
    const q = query.toLowerCase();
    return index.filter(e =>
      e.heading.toLowerCase().includes(q) || e.snippet.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, index]);

  return (
    <div className="docs-search-wrap" ref={wrapRef}>
      <input
        type="text"
        className="docs-search-input"
        placeholder="Search docs…"
        value={query}
        onChange={e => setQuery(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 160)}
      />
      {focused && results.length > 0 && (
        <div className="docs-search-results">
          {results.map((r, i) => (
            <button
              key={i}
              className="docs-search-result"
              onClick={() => { onNavigate(r.fileId); setQuery(''); }}
            >
              <span className="docs-search-result-label">{r.fileLabel}</span>
              <span className="docs-search-result-heading">{r.heading}</span>
              {r.snippet && (
                <span className="docs-search-result-snippet">{r.snippet}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface DocsPageProps {
  initialSection?: string;
  onBack: () => void;
}

export function DocsPage({ initialSection, onBack }: DocsPageProps) {
  const resolveSection = (raw?: string): SectionId => {
    // Backward compat: old physics-overview hash → foundations
    if (raw === 'physics-overview') return 'physics-foundations';
    return NAV_ITEMS.find(n => n.id === raw)?.id ?? 'getting-started';
  };

  const [pageId,  setPageId]  = useState<SectionId>(() => resolveSection(initialSection));
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState<SearchEntry[]>([]);
  const contentRef = useRef<HTMLElement>(null);

  // Pre-fetch search index in background on mount
  useEffect(() => { buildSearchIndex().then(setSearchIndex); }, []);

  // Keep URL hash in sync
  useEffect(() => {
    window.location.hash = pageId === 'getting-started' ? '#docs' : `#docs/${pageId}`;
  }, [pageId]);

  // Fetch content when page changes, scroll to top
  useEffect(() => {
    setLoading(true);
    setError(null);
    const item = NAV_ITEMS.find(n => n.id === pageId)!;
    fetch(`/docs/${item.file}`)
      .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.text(); })
      .then(text => { setContent(text); setLoading(false); })
      .catch(err => { setError(String(err)); setLoading(false); });
    contentRef.current?.scrollTo(0, 0);
  }, [pageId]);

  // Handle internal markdown link clicks (e.g. [Foundations](physics-foundations))
  const handleContentClick = useCallback((e: React.MouseEvent<HTMLElement>) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') ?? '';
    const match = NAV_ITEMS.find(n => n.id === href);
    if (match) { e.preventDefault(); setPageId(match.id); }
  }, []);

  const sections = useMemo(() => parseH2Sections(content), [content]);
  const isFaq    = pageId === 'faq';

  const darkMode = document.documentElement.getAttribute('data-theme') === 'dark';
  const logoSrc  = darkMode ? '/logo-dark.png' : '/logo-light.png';

  return (
    <div className="docs-root">
      {/* Header */}
      <div className="docs-header">
        <img src={logoSrc} alt="RacePhysiX" className="docs-header-logo" />
        <span className="docs-header-title">Documentation</span>
        <span className="docs-header-version">v{VERSION}</span>
        <SearchBar index={searchIndex} onNavigate={setPageId} />
        <button className="docs-back-btn" onClick={onBack}>← Back to Simulator</button>
      </div>

      {/* Body */}
      <div className="docs-body">
        {/* Sidebar */}
        <nav className="docs-sidebar">
          <div className="docs-nav-section">Contents</div>
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`docs-nav-item${pageId === item.id ? ' active' : ''}`}
              onClick={() => setPageId(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Main content */}
        <main className="docs-content" ref={contentRef} onClick={handleContentClick}>
          {loading && <div className="docs-loading">Loading…</div>}
          {error   && <div className="docs-error">Failed to load: {error}</div>}
          {!loading && !error && sections.map((section, i) => (
            <CollapsibleSection key={`${pageId}-${i}`} section={section} isFaq={isFaq} />
          ))}
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
