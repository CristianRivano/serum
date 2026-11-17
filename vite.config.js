import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  root: 'dev',
  publicDir: '../public',
  base: './',
  server: { fs: { allow: ['..'] } },
  build: { outDir: '../dist', emptyOutDir: true },
  plugins: [react()],
});
