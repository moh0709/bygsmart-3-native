import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Back-office DOM app. @bygsmart/* workspace packages resolve to their src via pnpm
// symlinks and are transpiled by Vite directly (no prebuild step needed in dev).
export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
});
