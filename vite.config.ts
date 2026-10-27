import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/split/',
  resolve: {
    dedupe: ['yjs'],
  },
  plugins: [react()],
  test: {
    environment: 'node',
  },
});
