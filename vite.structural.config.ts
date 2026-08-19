import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, port: 5174, strictPort: true },
  preview: { host: true, port: 4174, strictPort: true },
  build: {
    target: 'es2022',
    sourcemap: true,
    outDir: 'dist-structural',
    emptyOutDir: true,
    rollupOptions: { input: { structural: 'town-center-structural-viewer.html' } },
  },
});
