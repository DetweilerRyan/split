import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// .oxlintrc.json keeps scripts/oxcrap/ from importing anything outside it. If its override is
// dropped or its patterns stop matching, the rest of the suite still passes, so this runs the real
// oxlint with the real config on throwaway files laid out like the repository.
const config = fileURLToPath(new URL('./.oxlintrc.json', import.meta.url));
const oxlint = fileURLToPath(new URL('./node_modules/.bin/oxlint', import.meta.url));
const directories: string[] = [];

function lint(files: Record<string, string>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-oxlintrc-'));
  directories.push(cwd);
  copyFileSync(config, join(cwd, '.oxlintrc.json'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  const result = spawnSync(oxlint, ['--format', 'unix', '.'], { cwd, encoding: 'utf8' });
  return { status: result.status, output: result.stdout + result.stderr };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

describe('.oxlintrc.json', () => {
  it('fails each way scripts/oxcrap/ could import from outside itself', () => {
    const { status, output } = lint({
      'scripts/shared.ts': 'export const x = 1;\n',
      'scripts/oxcrap/parent.ts': "import { x } from '../shared.ts';\nexport const a = x;\n",
      'scripts/oxcrap/typeonly.ts':
        "import type { X } from '../../src/x.ts';\nexport type T = X;\n",
      'scripts/oxcrap/reexport.ts': "export { x } from '../shared.ts';\n",
      'scripts/oxcrap/dynamic.ts': "export const load = () => import('../shared.ts');\n",
      'scripts/oxcrap/alias.ts': "import { m } from '@/utils/math';\nexport const c = m;\n",
    });

    expect(status).toBe(1);
    for (const file of ['parent', 'typeonly', 'reexport', 'dynamic']) {
      expect(output).toContain(`scripts/oxcrap/${file}.ts`);
    }
    expect(output).toMatch(/scripts\/oxcrap\/alias\.ts:1:1: '@\/utils\/math' import is restricted/);
    expect(output).toContain('5 problems');
  });

  it('lets scripts/oxcrap/ import its own files, Node built-ins and npm packages', () => {
    const { status, output } = lint({
      'scripts/oxcrap/sibling.ts': 'export const b = 1;\n',
      'scripts/oxcrap/allowed.ts':
        "import { b } from './sibling.ts';\nimport { readFileSync } from 'node:fs';\nimport { parseSync } from 'oxc-parser';\nexport const all = [b, readFileSync, parseSync];\n",
    });

    expect(output).not.toContain('error');
    expect(status).toBe(0);
  });

  it('leaves files outside scripts/oxcrap/ free to import from parent folders', () => {
    const { status } = lint({
      'src/x.ts': 'export const x = 1;\n',
      'scripts/other.ts': "import { x } from '../src/x.ts';\nexport const o = x;\n",
    });

    expect(status).toBe(0);
  });
});
