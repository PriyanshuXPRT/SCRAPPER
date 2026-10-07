import React from 'react';
import { safeStringify } from '../api.js';

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function Field({ label, value }) {
  if (!value) return null;
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}

function LinksTab({ links }) {
  const [filter, setFilter] = React.useState('all');
  const filtered =
    filter === 'external' ? links.filter((l) => l.external) : filter === 'internal' ? links.filter((l) => !l.external) : links;

  return (
    <div className="tab-body">
      <div className="filter-row">
        {['all', 'internal', 'external'].map((f) => (
          <button
            key={f}
            className={filter === f ? 'chip active' : 'chip'}
            onClick={() => setFilter(f)}
          >
            {f} ({f === 'all' ? links.length : filtered.length})
          </button>
        ))}
      </div>
      <ul className="link-list">
        {filtered.map((l, i) => (
          <li key={`${l.href}-${i}`}>
            <a href={l.href} target="_blank" rel="noreferrer noopener">
              {l.href}
            </a>
            {l.text && <span className="link-text">{l.text}</span>}
            {l.external && <span className="tag ext">ext</span>}
            {!l.external && hostOf(l.href) !== hostOf(l.href) && null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImagesTab({ images }) {
  return (
    <div className="tab-body">
      {images.length === 0 && <p className="muted">No images found.</p>}
      <div className="image-grid">
        {images.map((img, i) => (
          <figure key={`${img.src}-${i}`}>
            <img src={img.src} alt={img.alt ?? ''} loading="lazy" />
            <figcaption title={img.src}>
              {img.alt || <em>no alt text</em>}
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  );
}

function HeadingsTab({ headings }) {
  if (headings.length === 0) return <p className="muted">No headings.</p>;
  return (
    <ul className="heading-list">
      {headings.map((h, i) => (
        <li key={i} style={{ paddingLeft: `${(h.level - 1) * 16}px` }}>
          <span className="h-level">h{h.level}</span>
          <span>{h.text}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PageDetail({ page, summary, tab }) {
  if (!page) {
    return <div className="detail-body empty">Select a page from the list.</div>;
  }

  const header = (
    <div className="detail-header">
      <h2>{page.title ?? 'Untitled'}</h2>
      <a className="detail-url" href={page.url} target="_blank" rel="noreferrer noopener">
        {page.url}
      </a>
      <div className="detail-meta">
        <span className={`status-pill ${page.error ? 'err' : 'ok'}`}>
          {page.error ? 'failed' : page.status}
        </span>
        <span className="meta">depth {page.depth}</span>
        <span className="meta">found via {page.discoveredViaText}</span>
        <span className="meta">{page.elapsedMs}ms</span>
        {page.contentType && <span className="meta">{page.contentType}</span>}
      </div>
      {page.error && (
        <div className="banner err">
          {page.botWall && <strong>{page.botWall}: </strong>}
          {page.error}
          {page.botWall && page.botWall !== 'robots' && (
            <div className="banner-note">
              This page returned a bot-protection challenge, not real content. Treat it
              as a failed scrape rather than an empty page.
            </div>
          )}
        </div>
      )}
    </div>
  );

  let body = null;

  if (tab === 'detail') {
    body = (
      <div className="tab-body">
        <Field label="Description" value={page.description} />
        <Field label="Site" value={page.siteName} />
        <Field label="Author" value={page.author} />
        <Field label="Published" value={page.published} />
        <Field label="Language" value={page.lang} />
        <Field label="Canonical" value={page.canonical} />

        <div className="count-row">
          <div><strong>{page.counts.headings}</strong> headings</div>
          <div><strong>{page.counts.links}</strong> links</div>
          <div><strong>{page.counts.externalLinks}</strong> external</div>
          <div><strong>{page.counts.images}</strong> images</div>
          <div><strong>{page.text.wordCount}</strong> words</div>
        </div>

        {page.text.excerpt && (
          <>
            <h3>Text excerpt</h3>
            <p className="excerpt">{page.text.excerpt}</p>
          </>
        )}

        {page.screenshot && (
          <>
            <h3>Screenshot</h3>
            <img className="screenshot" src={page.screenshot} alt={`Screenshot of ${page.title}`} />
          </>
        )}
      </div>
    );
  } else if (tab === 'links') {
    body = <LinksTab links={page.links} />;
  } else if (tab === 'images') {
    body = <ImagesTab images={page.images} />;
  } else if (tab === 'headings') {
    body = <HeadingsTab headings={page.headings} />;
  } else if (tab === 'jsonld') {
    body = (
      <div className="tab-body">
        {page.jsonLd.length === 0 ? (
          <p className="muted">No JSON-LD on this page.</p>
        ) : (
          <pre className="json">{safeStringify(page.jsonLd)}</pre>
        )}
      </div>
    );
  } else if (tab === 'json') {
    body = <pre className="json">{safeStringify(page)}</pre>;
  }

  return (
    <div className="detail-body">
      {header}
      {body}
    </div>
  );
}
