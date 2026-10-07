import React, { useEffect, useMemo, useState } from 'react';
import { loadReport, safeStringify } from './api.js';
import PageList from './components/PageList.jsx';
import PageDetail from './components/PageDetail.jsx';
import StatsBar from './components/StatsBar.jsx';
import SkippedPanel from './components/SkippedPanel.jsx';

export default function App() {
  const [state, setState] = useState({ loading: true, report: null, source: null, error: null });
  const [selected, setSelected] = useState(null);
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('detail');
  const [showSkipped, setShowSkipped] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchReport() {
      setState((s) => ({ ...s, loading: true, error: null }));
      const { report, source } = await loadReport();
      if (cancelled) return;

      if (!report) {
        setState({
          loading: false,
          report: null,
          source: null,
          error:
            'No crawl report found. Run the scraper first:\n\n' +
            'npm run crawl -- https://example.com --out ./out\n\n' +
            'Then reload this page.'
        });
        return;
      }
      setState({ loading: false, report, source, error: null });
      setSelected(report.pages[0]?.order ?? null);
    }

    fetchReport();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const pages = state.report?.pages ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return pages;
    return pages.filter(
      (p) =>
        (p.title ?? '').toLowerCase().includes(q) ||
        p.url.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q)
    );
  }, [state.report, query]);

  const activePage = useMemo(() => {
    const pages = state.report?.pages ?? [];
    const full = state.report?.pageData ?? [];
    const summary = pages.find((p) => p.order === selected);
    const detail = full.find((p) => p.order === selected);
    return { summary, detail };
  }, [state.report, selected]);

  if (state.loading) {
    return (
      <div className="screen-center">
        <div className="spinner" />
        <p>Loading crawl report...</p>
      </div>
    );
  }

  if (state.error) {
    return (
      <div className="screen-center">
        <div className="card error-card">
          <h2>No data yet</h2>
          <pre>{state.error}</pre>
        </div>
      </div>
    );
  }

  const report = state.report;

  return (
    <div className="app">
      <header className="header">
        <div className="header-main">
          <h1>Crawl Viewer</h1>
          <a
            className="site-link"
            href={report.seed}
            target="_blank"
            rel="noreferrer noopener"
          >
            {report.seed.replace(/^https?:\/\//, '')}
          </a>
        </div>
        <button className="ghost" onClick={() => window.location.reload()}>
          Reload
        </button>
      </header>

      <StatsBar
        stats={report.stats}
        elapsedMs={report.elapsedMs}
        finishedAt={report.finishedAt}
        config={report.config}
        robots={report.robots}
      />

      <div className="toolbar">
        <input
          type="search"
          placeholder="Filter pages by title, url, or description..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="search"
        />
        <span className="result-count">
          {filtered.length} of {report.pages.length} pages
        </span>
        <button
          className={showSkipped ? 'chip active' : 'chip'}
          onClick={() => setShowSkipped((v) => !v)}
        >
          Skipped ({report.skipped.length})
        </button>
      </div>

      {showSkipped && (
        <SkippedPanel skipped={report.skipped} onClose={() => setShowSkipped(false)} />
      )}

      <main className="split">
        <PageList
          pages={filtered}
          selected={selected}
          onSelect={setSelected}
        />
        <div className="detail-pane">
          <div className="tabs">
            {['detail', 'links', 'images', 'headings', 'jsonld', 'json'].map((t) => (
              <button
                key={t}
                className={tab === t ? 'tab active' : 'tab'}
                onClick={() => setTab(t)}
              >
                {t.toUpperCase()}
              </button>
            ))}
          </div>
          <PageDetail page={activePage.detail} summary={activePage.summary} tab={tab} />
        </div>
      </main>
    </div>
  );
}
