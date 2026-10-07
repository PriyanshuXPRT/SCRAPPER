import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const dir = path.dirname(fileURLToPath(import.meta.url));
// Crawl reports are written to <project>/out by default. Vite serves files
// relative to `root`, so the report directory has to be copied in rather than
// referenced with a ../ path - Vite's SPA fallback answers unmatched routes
// with index.html, which silently breaks fetch() with a 200 and HTML body.
const DATA_SRC = path.resolve(dir, '..', 'out');
const DATA_DEST = path.resolve(dir, 'data');

// Copy on config load so a fresh `npm run crawl` is picked up on server restart.
// Overwrite-in-place rather than delete-then-copy: Vite holds files inside
// frontend/data open, and rmSync on that directory throws ENOTEMPTY.
function syncData() {
  if (!fs.existsSync(DATA_SRC)) return;
  try {
    fs.mkdirSync(DATA_DEST, { recursive: true });
    fs.cpSync(DATA_SRC, DATA_DEST, { recursive: true, force: true });
    // Never expose internal crawler state through the dev server.
    fs.rmSync(path.join(DATA_DEST, '.crawl-checkpoint.json'), { force: true });
  } catch (err) {
    console.warn(`[crawl-data] sync failed: ${err.message}`);
  }
}
syncData();

/**
 * Re-copies the report directory whenever the scraper writes to it, so
 * hitting Reload in the browser shows the newest crawl without restarting
 * the dev server.
 *
 * Debounced, because a crawl writes several files in quick succession and
 * syncing on each one is wasteful. Never throws: a failed data refresh must
 * not take the dev server down.
 */
function dataSyncPlugin() {
  return {
    name: 'crawl-data-sync',
    configureServer(server) {
      const target = path.resolve(DATA_SRC);
      let timer = null;

      server.watcher.add(target);
      const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          syncData();
          server.ws.send({ type: 'full-reload' });
        }, 400);
      };

      for (const event of ['add', 'change', 'unlink']) {
        server.watcher.on(event, (file) => {
          if (typeof file === 'string' && file.startsWith(target)) schedule();
        });
      }
    }
  };
}

export default defineConfig({
  root: dir,
  plugins: [react(), dataSyncPlugin()],
  server: {
    port: 5173,
    open: true,
    fs: { allow: [dir, path.resolve(dir, '..')] }
  },
  build: {
    outDir: path.resolve(dir, 'dist'),
    emptyOutDir: true
  }
});
