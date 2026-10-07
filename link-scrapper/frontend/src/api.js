/**
 * Loads a crawl report written by the scraper.
 *
 * Reports live in ../out by default, which is outside the Vite root. The dev
 * server is configured to allow that path, and the JSON is fetched rather than
 * imported so a re-run of the scraper shows up on refresh without a rebuild.
 */

// Vite's SPA fallback returns index.html with a 200 for any unmatched path, so
// a wrong URL does not surface as a fetch error. Every candidate is validated
// on shape before it is trusted, and the content-type is checked first.
const CANDIDATES = [
  '/data/crawl.json',
  '/out/crawl.json',
  '/out-node/crawl.json',
  '/data-node/crawl.json'
];

async function tryFetch(url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;

    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('json')) {
      return null;
    }

    const json = await res.json();
    if (!json || typeof json !== 'object' || !Array.isArray(json.pages)) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

export async function loadReport() {
  for (const url of CANDIDATES) {
    const report = await tryFetch(url);
    if (report) {
      return { report, source: url };
    }
  }
  return { report: null, source: null };
}

/** Pretty-print a value for the JSON panel, tolerating circular refs. */
export function safeStringify(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
