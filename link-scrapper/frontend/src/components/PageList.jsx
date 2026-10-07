import React from 'react';

/** Renders the URL path, with each depth level indented. */
function shortPath(url) {
  try {
    const u = new URL(url);
    return u.pathname === '/' ? '/' : u.pathname;
  } catch {
    return url;
  }
}

export default function PageList({ pages, selected, onSelect }) {
  if (pages.length === 0) {
    return <div className="list-pane empty">No pages match that filter.</div>;
  }

  return (
    <div className="list-pane">
      {pages.map((page) => {
        const isActive = page.order === selected;
        return (
          <button
            key={page.order}
            className={isActive ? 'page-row active' : 'page-row'}
            style={{ paddingLeft: `${12 + page.depth * 16}px` }}
            onClick={() => onSelect(page.order)}
          >
            <div className="page-row-top">
              <span className="page-order">{String(page.order).padStart(2, '0')}</span>
              <span className={`status-dot ${page.error ? 'err' : page.status < 300 ? 'ok' : 'mid'}`} />
              <span className="page-title">
                {page.title ?? <em>untitled</em>}
              </span>
            </div>
            <div className="page-row-bottom">
              <span className="path">{shortPath(page.url)}</span>
              <span className="mini-stats">
                {page.headingCount}h {page.linkCount}l {page.imageCount}i {page.wordCount}w
              </span>
            </div>
            {page.error && (
              <div className="page-error">
                {page.botWall && <span className="wall-tag">{page.botWall}</span>}
                {page.error}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
