import { configDefaults, defineConfig } from 'vitest/config';

// The tooling's unit and property tests: every `<module>.test.ts` under scripts/,
// `<module>.property.test.ts` included. `npm run test:tooling` runs them, then the real tests
// (vitest.tooling-real.config.ts) and oxCrap's features. `npm test` runs only the app's, from
// vitest.config.ts. docs/engineering/testing-conventions.md says which a test belongs in.
//
// Unlike the app's config, this has no React Compiler and no `@` alias: tooling isn't React, and
// without the alias a tooling test can't import app code by accident. Its coverage, of oxCrap's
// own code, is the report scripts/oxcrap/.oxcraprc.json scores. Only these unit tests count
// towards it, as docs/engineering/crap.md says. Stryker runs these tests too (stryker.config.json).
const ignored = [
  ...configDefaults.exclude,
  '**/.next/**',
  // Branch worktrees live inside the checkout (docs/engineering/workflow/starting-work.md).
  '**/.claude/worktrees/**',
  // Stryker's sandbox is a copy of the repository while a mutation run is going.
  '**/.stryker-tmp/**',
];

export default defineConfig({
  test: {
    name: 'tooling-unit',
    environment: 'node',
    include: ['scripts/**/*.test.ts'],
    exclude: [...ignored, '**/*.real.test.ts'],
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['json'],
      reportsDirectory: 'coverage-tooling',
      include: ['scripts/oxcrap/**/*.ts'],
      exclude: ['**/*.test.ts', 'scripts/oxcrap/features/**'],
    },
  },
});
