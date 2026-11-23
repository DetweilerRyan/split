import { configDefaults, defineConfig } from 'vitest/config';

// The tests mutation testing runs: oxCrap's unit and property tests, and no `.real.test.ts` or
// feature contract, as docs/engineering/mutation-testing.md says. stryker.config.json points here.
export default defineConfig({
  test: {
    name: 'mutation',
    environment: 'node',
    include: ['scripts/oxcrap/**/*.test.ts'],
    exclude: [
      ...configDefaults.exclude,
      '**/*.real.test.ts',
      '**/.claude/worktrees/**',
      '**/.stryker-tmp/**',
    ],
  },
});
