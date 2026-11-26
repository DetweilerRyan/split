import { configDefaults, defineConfig } from 'vitest/config';

// The tooling's real tests: `<module>.real.test.ts` under scripts/, and the tests of root tooling
// config such as .rev-dep.config.jsonc. They run real programs and files, so they collect no
// coverage: CRAP's coverage comes from unit tests only (docs/engineering/testing/crap-testing-practices.md). `npm run
// test:tooling` runs them after vitest.tooling.config.ts's unit tests.
export default defineConfig({
  test: {
    name: 'tooling-real',
    environment: 'node',
    include: ['scripts/**/*.real.test.ts', 'rev-dep.config.real.test.ts', 'oxlintrc.real.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      '**/.next/**',
      '**/.claude/worktrees/**',
      '**/.stryker-tmp/**',
    ],
  },
});
