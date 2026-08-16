import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, host: true, strictPort: true },
  preview: { port: 4173, host: true, strictPort: true },
  build: { target: 'es2022', sourcemap: true },
});
