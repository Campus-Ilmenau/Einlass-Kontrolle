import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // Lokale Entwicklung: API unter http://localhost:3000 (pnpm --filter @einlass/api dev)
  server: { proxy: { '/api': 'http://localhost:3000' } },
  preview: { proxy: { '/api': 'http://localhost:3000' } },
  build: {
    target: 'es2022',
    sourcemap: false,
    chunkSizeWarningLimit: 1500,
  },
});
