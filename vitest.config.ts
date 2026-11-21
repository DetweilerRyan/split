import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Tests named `<module>.browser.test.ts(x)` run in headless Chromium through Playwright; every
// other test runs in jsdom, or Node where a file opts in. docs/engineering/testing-conventions.md
// says which project a test belongs in.
const browserTests = ['**/*.browser.test.ts', '**/*.browser.test.tsx'];

export default defineConfig({
  // Compile components and hooks with the React Compiler, as next.config.ts does for the app
  // (`reactCompiler: true`), so tests see the same memoization users get. The compiler has to
  // run first; plugins listed here run before plugin-react's own transforms.
  plugins: [react({ babel: { plugins: ['babel-plugin-react-compiler'] } })],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
    dedupe: ['yjs'],
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'jsdom',
          include: ['**/*.test.ts', '**/*.test.tsx'],
          exclude: ['**/node_modules/**', '**/.next/**', ...browserTests],
        },
      },
      {
        extends: true,
        // Bundle these before the first test. Found partway through a run instead, Vite
        // reloads the page and loads a second copy of React.
        optimizeDeps: {
          include: [
            'react',
            'react-dom',
            'react-dom/client',
            'react/jsx-dev-runtime',
            'lucide-react',
          ],
        },
        test: {
          name: 'browser',
          include: browserTests,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
