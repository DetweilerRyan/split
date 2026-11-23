import { configDefaults, defineConfig } from 'vitest/config';

// The tooling tests: everything under scripts/, and the tests of root tooling config such as
// .rev-dep.config.jsonc. `npm run test:tooling` runs them; `npm test` runs only the app's, from
// vitest.config.ts. docs/engineering/testing-conventions.md says which a test belongs in.
//
// Unlike the app's config, this has no React Compiler, no coverage and no `@` alias: tooling
// isn't React, oxCrap scores only src/ and app/, and without the alias a tooling test can't
// import app code by accident. `<module>.real.test.ts` runs real programs and files; every
// other `<module>.test.ts` is a unit test. Both run in Node.
const realTests = ['scripts/**/*.real.test.ts', 'rev-dep.config.real.test.ts'];
// Branch worktrees live inside the checkout (docs/engineering/workflow/starting-work.md).
const ignored = [...configDefaults.exclude, '**/.next/**', '**/.claude/worktrees/**'];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'tooling-unit',
          environment: 'node',
          include: ['scripts/**/*.test.ts'],
          exclude: [...ignored, ...realTests],
        },
      },
      {
        test: {
          name: 'tooling-real',
          environment: 'node',
          include: realTests,
          exclude: ignored,
        },
      },
    ],
  },
});
