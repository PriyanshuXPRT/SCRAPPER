import React from 'react';

export default function StatsBar({ stats, elapsedMs, finishedAt, config, robots }) {
  const tiles = [
    { label: 'Pages scraped', value: stats.pagesScraped, tone: 'good' },
    { label: 'Pages failed', value: stats.pagesFailed, tone: stats.pagesFailed ? 'bad' : 'neutral' },
    {
      label: 'Bot-walled',
      value: stats.botWalled ?? 0,
      tone: stats.botWalled ? 'bad' : 'neutral',
      title: 'Pages that returned a bot-protection challenge instead of real content'
    },
    {
      label: 'Blocked by robots',
      value: stats.blockedByRobots ?? 0,
      tone: stats.blockedByRobots ? 'warn' : 'neutral'
    },
    { label: 'Links discovered', value: stats.linksDiscovered },
    { label: 'Retries', value: stats.retries ?? 0 },
    { label: 'Duration', value: `${(elapsedMs / 1000).toFixed(1)}s` }
  ];

  const robotsLine = !robots?.checked
    ? 'robots.txt not checked'
    : robots.present
      ? `robots.txt: ${robots.groups} group(s)${robots.crawlDelaySeconds ? `, crawl-delay ${robots.crawlDelaySeconds}s` : ''}`
      : `robots.txt: absent${robots.note ? ` (${robots.note})` : ''}`;

  return (
    <section className="stats-bar">
      <div className="tiles">
        {tiles.map((t) => (
          <div key={t.label} className={`tile ${t.tone ?? ''}`} title={t.title}>
            <div className="tile-value">{t.value}</div>
            <div className="tile-label">{t.label}</div>
          </div>
        ))}
      </div>
      <div className="meta-row">
        <span className={`badge ${stats.navDetected ? 'ok' : 'warn'}`}>
          nav {stats.navDetected ? 'detected' : 'not found'}
        </span>
        <span className={`badge ${robots?.checked && robots.present ? 'ok' : 'warn'}`}>
          {robotsLine}
        </span>
        <span className="meta">
          depth {config.maxDepth} &middot; max {config.maxPages} pages &middot;{' '}
          {config.delayMs}ms delay
          {config.maxRetries ? ` \u00b7 ${config.maxRetries} attempts/page` : ''}
        </span>
        {finishedAt && <span className="meta">{new Date(finishedAt).toLocaleString()}</span>}
      </div>
    </section>
  );
}
