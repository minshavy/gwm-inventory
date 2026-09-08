// -----------------------------------------------------------------------
// Standalone build: a plain Vite + React + Express app. API calls
// (src/lib/api-client.ts) and auth (src/lib/auth-shim.tsx) talk to the
// local Express server (server/index.cjs) at /api/*, proxied below in dev.
// -----------------------------------------------------------------------
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
);

const pkgDeps = Object.keys(pkg.dependencies)
  // Need to exclude @tiptap/pm from optimization, since it doesn't have a top level entry point
  .filter(dep => dep !== '@tiptap/pm');

/**
 * Vite's main focus is on startup speed, so it doesn't check your package.json to see which dependencies you have at startup.
 * When it spots a file that imports a dependency, it optimizes that dependency on the fly and reloads the page. If I use something
 * that relies on another dependency, like lucide-react depending on react, it has to optimize lucide first and then reoptimize react
 * since lucide depends on react. It might have tree-shaken something lucide was using.
 *
 * This works fine in local development because it sends the websocket events quickly. But I noticed that if there's a decent gap
 * between the HMR update event and the HMR full-reload event (over ~500ms), it tries to use the new dependencies before the page reloads.
 * React throws an "invalid hook call" error in this case because there are now two different versions of react in play—the one it
 * initially rendered with and the newly optimized version.
 *
 * So we force Vite optimize all dependencies upfront at startup. This way, we avoid having to reoptimize dependencies on file
 * changes and reload the page. Since we have so few dependencies, the impact on startup speed is minimal.
 *
 * Belt-and-braces: we also explicitly include `react-dom` (bare) and `react-dom/server` so that subpath imports
 * pulled in by other deps (e.g. SSR-aware libraries, error boundaries) don't trigger a separate re-optimization
 * pass for react-dom, which would land it on a different `?v=` hash than `react` and cause the "two versions of
 * React" race documented above.
 */
const deps = new Set([
  'react',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-dom',
  'react-dom/client',
  'react-dom/server',
  ...pkgDeps,
]);

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  build: { target: 'esnext', sourcemap: false, reportCompressedSize: false },
  server: {
    host: true,
    port: 8080,
    cors: true,
    hmr: {
      overlay: false,
    },
    // Forward API calls to the local Express server (server/index.js).
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    include: [...deps],
    // Crawl every source file at startup so Vite discovers all imported deps
    // upfront and includes them in the initial pre-bundle pass. By default Vite
    // only scans entries reachable from `index.html`; deps imported only in
    // lazily-loaded routes or via dynamic imports get optimized later, which
    // splits them onto different `?v=` hashes than react/react-dom and triggers
    // the "two versions of React" race described above.
    entries: ['index.html', 'src/**/*.{ts,tsx,js,jsx}'],
  },
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@project/components': path.resolve(__dirname, './vendor/components'),
    },
  },
}));
