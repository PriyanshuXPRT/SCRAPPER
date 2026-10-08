#!/usr/bin/env node
// Structural check for the committed link-scrapper frontend.
//
// Runs before the build so a broken crawl report fails with a clear message
// instead of surfacing as a confusing Vite/fetch error. Checks that:
//   - every required source file is present
//   - every JSON file under data/ actually parses
//   - the per-page index agrees with the page files on disk
//   - the committed build output is present
//
// Read-only: never writes to the working tree, so it is safe in CI.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const root = resolve(dir, '..');
const frontend = join(root, 'frontend');

const errors = [];
const checks = [];

const ok = (msg) => checks.push(msg);
const fail = (msg) => errors.push(msg);

// --- 1. required files present -------------------------------------------
const required = [
  'frontend/index.html',
  'frontend/vite.config.js',
  'frontend/src/main.jsx',
  'frontend/src/App.jsx',
  'frontend/src/api.js',
  'frontend/data/crawl.json',
];
for (const rel of required) {
  if (existsSync(join(root, rel))) ok(rel);
  else fail(`missing required file: ${rel}`);
}

// --- 2. every JSON file parses -------------------------------------------
const dataDir = join(frontend, 'data');
const jsonFiles = [];
function walk(d) {
  if (!existsSync(d)) return;
  for (const entry of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.json')) jsonFiles.push(p);
  }
}
walk(dataDir);

if (jsonFiles.length === 0) {
  fail('no JSON files found under frontend/data');
} else {
  for (const file of jsonFiles) {
    const rel = file.slice(root.length + 1);
    try {
      JSON.parse(readFileSync(file, 'utf8'));
      ok(`parsed ${rel}`);
    } catch (err) {
      fail(`invalid JSON in ${rel}: ${err.message}`);
    }
  }
}

// --- 3. page index references only files that exist ------------------------
// Deliberately one-directional. crawl.json and _index.json are emitted by the
// scraper and only cover the pages of the latest crawl, so a page file left on
// disk by an earlier run is expected and must not fail the build. A *dangling*
// reference, by contrast, means the index points at a file that is gone, which
// would break the frontend at runtime.
const indexPath = join(dataDir, 'pages', '_index.json');
if (existsSync(indexPath)) {
  try {
    const idx = JSON.parse(readFileSync(indexPath, 'utf8'));
    const listed = Array.isArray(idx) ? idx : idx.pages;
    if (!Array.isArray(listed)) {
      fail('frontend/data/pages/_index.json is not an array and has no "pages" array');
    } else {
      const onDisk = new Set(
        readdirSync(join(dataDir, 'pages'))
          .filter((f) => f.endsWith('.json') && f !== '_index.json')
      );
      for (const entry of listed) {
        const name = (entry.file || entry.name || '').toString();
        if (!name) {
          fail(`_index.json has a page entry with no "file" field`);
        } else if (!onDisk.has(name)) {
          fail(`_index.json references a page file that does not exist: ${name}`);
        }
      }
      const referenced = new Set(listed.map((p) => (p.file || p.name || '').toString()));
      const orphans = [...onDisk].filter((f) => !referenced.has(f));
      if (orphans.length) {
        console.log(`  note ${orphans.length} unreferenced page file(s) from an earlier crawl: ${orphans.join(', ')}`);
      }
      ok(`_index.json: ${listed.length} reference(s), all resolve`);
    }
  } catch (err) {
    // Already reported by the JSON.parse sweep above.
  }
}

// --- 3b. crawl.json shape matches what the frontend requires ----------------
// api.js rejects any report whose "pages" is not an array, so guard that here
// rather than letting it surface as an empty UI with no error.
const crawlPath = join(dataDir, 'crawl.json');
if (existsSync(crawlPath)) {
  try {
    const crawl = JSON.parse(readFileSync(crawlPath, 'utf8'));
    if (!Array.isArray(crawl.pages)) {
      fail('frontend/data/crawl.json has no "pages" array - api.js would reject this report');
    } else {
      ok(`crawl.json exposes ${crawl.pages.length} page(s)`);
      const scraped = crawl.stats?.pagesScraped;
      if (typeof scraped === 'number' && scraped !== crawl.pages.length) {
        console.log(`  note crawl.json stats.pagesScraped=${scraped} but pages[] has ${crawl.pages.length}`);
      }
    }
  } catch {
    // Already reported above.
  }
}

// --- 4. committed build output present ------------------------------------
const distIndex = join(frontend, 'dist', 'index.html');
if (existsSync(distIndex)) ok('frontend/dist/index.html present');
else fail('missing committed build output: frontend/dist/index.html');

// --- report ---------------------------------------------------------------
for (const c of checks) console.log(`  ok   ${c}`);
for (const e of errors) console.error(`  FAIL ${e}`);

if (errors.length) {
  console.error(`\nvalidate: ${errors.length} problem(s) found`);
  process.exit(1);
}
console.log(`\nvalidate: ${checks.length} checks passed`);