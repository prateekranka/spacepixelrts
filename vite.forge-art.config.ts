import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

/**
 * Forge Art Lab — developer-only workbench build.
 * Separate from the production config: never builds into dist/, never ships.
 * Repo-root base so tool modules can import ../../src/* production painters.
 */
export default defineConfig({
  base: './',
  appType: 'spa',
  server: { port: 5179, host: '127.0.0.1', strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist-forge-art',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        workbench: fileURLToPath(new URL('./tools/forge-art/index.html', import.meta.url)),
        rig: fileURLToPath(new URL('./tools/forge-art/rig.html', import.meta.url)),
      },
    },
  },
});
