import { fileURLToPath } from 'node:url';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

// Three projects, chosen by file name; docs/engineering/testing-conventions.md says which a
// test belongs in. `<module>.browser.test.ts(x)` runs in headless Chromium through Playwright,
// `<module>.real.test.ts` runs in Node with real programs and files, and every other
// `<module>.test.ts(x)` runs in jsdom.
const browserTests = ['**/*.browser.test.ts', '**/*.browser.test.tsx'];
const realTests = ['**/*.real.test.ts'];
// Branch worktrees live inside the checkout (docs/engineering/branch-setup.md). Without this, a
// run from one checkout also runs every worktree's copy of the tests.
const ignored = [...configDefaults.exclude, '**/.next/**', '**/.claude/worktrees/**'];

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
          exclude: [...ignored, ...browserTests, ...realTests],
        },
      },
      {
        extends: true,
        test: {
          name: 'real',
          environment: 'node',
          include: realTests,
          exclude: ignored,
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
          exclude: ignored,
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
