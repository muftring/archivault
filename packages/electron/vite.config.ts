import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { join } from 'path';

export default defineConfig({
  root: join(__dirname, 'src/renderer'),
  plugins: [react()],
  build: {
    outDir: join(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
  },
});
