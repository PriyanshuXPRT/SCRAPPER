import React, { useMemo, useState } from 'react';

/** Explains what was dropped and why, grouped by reason. */
export default function SkippedPanel({ skipped, onClose }) {
  const [reasonFilter, setReasonFilter] = useState(null);

  const grouped = useMemo(() => {
    const map = new Map();
    for (const item of skipped) {
      const list = map.get(item.reason) ?? [];
      list.push(item);
      map.set(item.reason, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [skipped]);

  const shown = reasonFilter
    ? skipped.filter((s) => s.reason === reasonFilter)
    : skipped;

  return (
    <div className="skipped-panel">
      <div className="skipped-head">
        <strong>{skipped.length} URLs discovered but not crawled</strong>
        <button className="ghost small" onClick={onClose}>
          Close
        </button>
      </div>

      <div className="reason-chips">
        <button
          className={reasonFilter === null ? 'chip active' : 'chip'}
          onClick={() => setReasonFilter(null)}
        >
          all ({skipped.length})
        </button>
        {grouped.map(([reason, items]) => (
          <button
            key={reason}
            className={reasonFilter === reason ? 'chip active' : 'chip'}
            onClick={() => setReasonFilter(reason)}
          >
            {reason} ({items.length})
          </button>
        ))}
      </div>

      <ul className="skipped-list">
        {shown.slice(0, 300).map((s, i) => (
          <li key={i}>
            <span className="skip-reason">{s.reason}</span>
            <span className="skip-url" title={s.url}>{s.url}</span>
            {s.text && <span className="skip-text">"{s.text}"</span>}
          </li>
        ))}
      </ul>
      {shown.length > 300 && (
        <p className="muted">...and {shown.length - 300} more.</p>
      )}
    </div>
  );
}
