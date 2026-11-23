import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// .rev-dep.config.jsonc keeps scripts/oxcrap/ from importing anything outside it. If its rule is
// dropped or its patterns stop matching, the rest of the suite still passes, so this runs the real
// rev-dep with the real config on throwaway files laid out like the repository.
const config = fileURLToPath(new URL('./.rev-dep.config.jsonc', import.meta.url));
const revDep = fileURLToPath(new URL('./node_modules/.bin/rev-dep', import.meta.url));
const directories: string[] = [];

/** A throwaway project holding the real config, the app's `@/` alias and `files`. */
function check(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-rev-dep-'));
  directories.push(cwd);
  copyFileSync(config, join(cwd, '.rev-dep.config.jsonc'));
  const project = {
    'package.json': JSON.stringify({ name: 'project', type: 'module' }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
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

  it('fails when the rule matches no files, so it can’t quietly stop applying', () => {
    const { status } = check({ 'scripts/other.ts': 'export const o = 1;\n' });

    expect(status).not.toBe(0);
  });

  it('leaves files outside scripts/oxcrap/ free to import from anywhere', () => {
    const { status } = check({
      'src/x.ts': 'export const x = 1;\n',
      'scripts/other.ts': "import { x } from '../src/x.ts';\nexport const o = x;\n",
      'scripts/oxcrap/keep.ts': 'export const k = 1;\n',
    });

    expect(status).toBe(0);
  });
});
