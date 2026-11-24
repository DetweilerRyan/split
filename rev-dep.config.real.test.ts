import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// The rules in .rev-dep.config.jsonc, which docs/engineering/dependency-direction.md describes. If a
// rule is dropped or its pattern stops matching, the rest of the suite still passes, so this runs the
// real rev-dep with the real config on throwaway files laid out like the repository.
const config = fileURLToPath(new URL('./.rev-dep.config.jsonc', import.meta.url));
const revDep = fileURLToPath(new URL('./node_modules/.bin/rev-dep', import.meta.url));
const directories: string[] = [];

const keep = 'export const k = 1;\n';

/**
 * One file in each folder a rule covers. rev-dep fails a rule whose pattern matches no files, so a
 * throwaway project needs them all to pass.
 */
const ruled: Readonly<Record<string, string>> = {
  'scripts/oxcrap/keep.ts': keep,
  'src/domain/keep.ts': keep,
  'src/utils/keep.ts': keep,
  'src/services/keep.ts': keep,
  'src/sync/keep.ts': keep,
};

/**
 * The ruled folders, and one file in each other folder a rule's `allow` could be widened to. A
 * widened glob then matches files, so the boundary tests below fail on the import they let through,
 * not on rev-dep's check for a glob that matches nothing.
 */
const layout: Readonly<Record<string, string>> = {
  ...ruled,
  'scripts/keep.ts': keep,
  'src/keep.ts': keep,
  'src/components/keep.ts': keep,
  'src/hooks/keep.ts': keep,
  'src/server/keep.ts': keep,
  'src/data/keep.ts': keep,
  'src/polyfills/keep.ts': keep,
  'app/keep.ts': keep,
};

/** A throwaway project holding the real config, the app's `@/` alias, `base` and `files`. */
function check(files: Readonly<Record<string, string>>, base = layout) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-rev-dep-'));
  directories.push(cwd);
  copyFileSync(config, join(cwd, '.rev-dep.config.jsonc'));
  const project = {
    // rev-dep resolves an npm package only when package.json declares it, as the real one does.
    'package.json': JSON.stringify({
      name: 'project',
      type: 'module',
      devDependencies: { 'oxc-parser': '0.157.0' },
    }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    ...base,
    ...files,
  };
  for (const [path, content] of Object.entries(project)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  // The same options `npm run lint` passes.
  const result = spawnSync(
    revDep,
    [
      'config',
      'run',
      '--list-all-issues',
      '--lint-config-rules',
      'orphan-file-globs,orphan-module-globs,overlapping-globs',
    ],
    {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NO_COLOR: '1' },
    },
  );
  return { status: result.status, output: result.stdout + result.stderr };
}

/** A module that a layer's rule refuses or allows, by its path from the root without `.ts`. */
function target(path: string) {
  return { [`${path}.ts`]: 'export const o = 1;\nexport type O = number;\n' };
}

/**
 * Each way a file in `src/<layer>/` could import `src/<outside>.ts`, keyed by the importing file:
 * a parent folder, type-only, a re-export, a dynamic `import()`, the `@/` alias, and a path that
 * goes back up through a folder.
 */
function waysOut(layer: string, outside: string) {
  return {
    [`src/${layer}/parent.ts`]: `import { o } from '../${outside}.ts';\nexport const a = o;\n`,
    [`src/${layer}/typeonly.ts`]: `import type { O } from '../${outside}.ts';\nexport type T = O;\n`,
    [`src/${layer}/reexport.ts`]: `export { o } from '../${outside}.ts';\n`,
    [`src/${layer}/dynamic.ts`]: `export function load() {\n  return import('../${outside}.ts');\n}\n`,
    [`src/${layer}/alias.ts`]: `import { o } from '@/${outside}';\nexport const c = o;\n`,
    [`src/${layer}/a/b/deep.ts`]: `import { o } from '../b/../../../${outside}.ts';\nexport const d = o;\n`,
  };
}

/** Imports from `src/<layer>/` of each of `targets`, by path from the root, one file each. */
function importsOf(layer: string, targets: readonly string[]) {
  return Object.fromEntries(
    targets.map((path, index) => [
      `src/${layer}/imports${index}.ts`,
      `import { o } from '../../${path}.ts';\nexport const i${index} = o;\n`,
    ]),
  );
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('.rev-dep.config.jsonc', () => {
  it('fails each way scripts/oxcrap/ could import from outside itself', () => {
    const { status, output } = check({
      'src/x.ts': 'export const x = 1;\n',
      'scripts/shared.ts': 'export const s = 1;\n',
      'scripts/oxcrap/parent.ts': "import { s } from '../shared.ts';\nexport const a = s;\n",
      'scripts/oxcrap/typeonly.ts':
        "import type { X } from '../../src/x.ts';\nexport type T = X;\n",
      'scripts/oxcrap/reexport.ts': "export { s } from '../shared.ts';\n",
      'scripts/oxcrap/dynamic.ts': "export const load = () => import('../shared.ts');\n",
      'scripts/oxcrap/alias.ts': "import { x } from '@/x';\nexport const c = x;\n",
      'scripts/oxcrap/features/steps/deep.ts':
        "import { x } from '../screenplay/../../../../src/x.ts';\nexport const d = x;\n",
    });

    expect(status).toBe(1);
    for (const [file, target] of [
      ['parent', 'scripts/shared.ts'],
      ['typeonly', 'src/x.ts'],
      ['reexport', 'scripts/shared.ts'],
      ['dynamic', 'scripts/shared.ts'],
      ['alias', 'src/x.ts'],
      ['features/steps/deep', 'src/x.ts'],
    ]) {
      expect(output).toContain(`scripts/oxcrap/${file}.ts -> ${target} (NOT ALLOWED)`);
    }
    expect(output).toContain('Module Boundary Issues (6)');
  });

  it('fails an import it can’t resolve, which the rule couldn’t check', () => {
    const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-rev-dep-outside-'));
    directories.push(cwd);
    writeFileSync(join(cwd, 'x.ts'), 'export const x = 1;\n');
    const { status, output } = check({
      'scripts/oxcrap/absolute.ts': `import { x } from '${join(cwd, 'x.ts')}';\nexport const a = x;\n`,
      'scripts/oxcrap/computed.ts': 'export const load = (path: string) => import(path);\n',
    });

    expect(status).toBe(1);
    expect(output).toContain('Unresolved Imports (2)');
    expect(output).toContain('scripts/oxcrap/absolute.ts');
    expect(output).toContain('scripts/oxcrap/computed.ts');
  });

  it('lets scripts/oxcrap/ import its own files, from any of its folders, and Node and npm', () => {
    const { status, output } = check({
      'node_modules/oxc-parser/package.json': JSON.stringify({ name: 'oxc-parser', main: 'x.js' }),
      'node_modules/oxc-parser/x.js': 'export const parseSync = 1;\n',
      'scripts/oxcrap/allow.ts': 'export const b = 1;\n',
      'scripts/oxcrap/features/screenplay/actor.ts': 'export const c = 1;\n',
      'scripts/oxcrap/features/steps/x.steps.ts':
        "import { c } from '../screenplay/actor.ts';\nimport { b } from '../../allow.ts';\nimport { readFileSync } from 'node:fs';\nimport { parseSync } from 'oxc-parser';\nexport const all = [b, c, readFileSync, parseSync];\n",
    });

    expect(output).toContain('All checks passed!');
    expect(status).toBe(0);
  });

  it.each(Object.keys(ruled))(
    'fails when no file matches %s’s rule, so it can’t quietly stop applying',
    (path) => {
      const rest = Object.fromEntries(Object.entries(layout).filter(([key]) => key !== path));
      const { status, output } = check({ 'scripts/other.ts': keep }, rest);

      expect(status).toBe(1);
      expect(output).toContain('Config lint:');
      expect(output).not.toContain('Config lint: no issues');
    },
  );

  it('leaves files outside the ruled folders free to import from anywhere', () => {
    const { status } = check({
      ...target('src/x'),
      'scripts/other.ts': "import { x } from '../src/x.ts';\nexport const o = x;\n",
      'src/components/view.ts':
        "import { k } from '../sync/keep.ts';\nimport { o } from '../services/api.ts';\nexport const v = [k, o];\n",
      ...target('src/services/api'),
    });

    expect(status).toBe(0);
  });

  // The layers in docs/engineering/code-layout.md, from #94. Each refuses `outside`, under src/, in
  // each way out, and a direct import of each path in `refused`, from the root. Every folder here
  // already holds a file from `layout`, so a rule widened to one fails on the import it lets
  // through, which each test asserts, and not on the config lint.
  const unruled = ['src/RoomView', 'src/data/presets', 'src/polyfills/dialog', 'app/page'];
  describe.each([
    {
      layer: 'domain',
      outside: 'sync/store',
      refused: [
        'src/services/api',
        'src/components/view',
        'src/hooks/useView',
        'src/server/guard',
        ...unruled,
      ],
      allowed: ['src/domain/money/currency', 'src/utils/qr'],
    },
    {
      layer: 'utils',
      outside: 'domain/money/currency',
      refused: [
        'src/sync/store',
        'src/services/api',
        'src/components/view',
        'src/hooks/useView',
        'src/server/guard',
        ...unruled,
      ],
      allowed: ['src/utils/qr'],
    },
    {
      layer: 'services',
      outside: 'sync/store',
      refused: ['src/components/view', 'src/hooks/useView', 'src/server/guard', ...unruled],
      allowed: ['src/services/cache', 'src/domain/money/currency', 'src/utils/qr'],
    },
    {
      layer: 'sync',
      outside: 'components/view',
      refused: ['src/services/api', 'src/hooks/useView', 'src/server/guard', ...unruled],
      allowed: ['src/sync/store', 'src/domain/money/currency', 'src/utils/qr'],
    },
  ])('src/$layer/', ({ layer, outside, refused, allowed }) => {
    it(`fails each way it could import src/${outside}.ts`, () => {
      const { status, output } = check({
        ...target(`src/${outside}`),
        ...waysOut(layer, outside),
      });

      expect(output).toContain('Config lint: no issues');
      for (const file of ['parent', 'typeonly', 'reexport', 'dynamic', 'alias', 'a/b/deep']) {
        expect(output).toContain(`src/${layer}/${file}.ts -> src/${outside}.ts (NOT ALLOWED)`);
      }
      expect(output).toContain('Module Boundary Issues (6)');
      expect(status).toBe(1);
    });

    it('fails an import of each other folder it may not use', () => {
      const { status, output } = check({
        ...Object.assign({}, ...refused.map(target)),
        ...importsOf(layer, refused),
      });

      expect(output).toContain('Config lint: no issues');
      for (const [index, path] of refused.entries()) {
        expect(output).toContain(`src/${layer}/imports${index}.ts -> ${path}.ts (NOT ALLOWED)`);
      }
      expect(output).toContain(`Module Boundary Issues (${refused.length})`);
      expect(status).toBe(1);
    });

    it(`lets it import ${allowed.map((path) => path.split('/').slice(0, 2).join('/')).join(', ')}`, () => {
      const { status, output } = check({
        ...Object.assign({}, ...allowed.map(target)),
        ...importsOf(layer, allowed),
        [`src/${layer}/a/b/deep.ts`]: `import { o } from '../b/../../../../${allowed[0]}.ts';\nexport const d = o;\n`,
      });

      expect(output).toContain('All checks passed!');
      expect(status).toBe(0);
    });
  });
});
