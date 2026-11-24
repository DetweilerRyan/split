import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

const script = fileURLToPath(new URL('./check-shared-folders.ts', import.meta.url));

const component = 'export function Shared() {\n  return null;\n}\n';
const viaAlias = "import { Shared } from '@/components/Shared';\nexport const a = Shared;\n";
const empty = { 'src/components/.gitkeep': '', 'src/hooks/.gitkeep': '' };

/**
 * Runs the script, with the real rev-dep, on a throwaway project holding the app's `@/` alias, an
 * empty src/components/ and src/hooks/, and `files`.
 */
function check(files: Readonly<Record<string, string>>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-shared-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  const project = {
    'package.json': JSON.stringify({ name: 'project', type: 'module' }),
    'tsconfig.json': JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }),
    ...empty,
    ...files,
  };
  for (const [path, content] of Object.entries(project)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  const result = spawnSync(process.execPath, [script], { cwd, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('check-shared-folders', () => {
  it('passes when src/components/ and src/hooks/ hold only their .gitkeep', () => {
    const result = check({});
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(
      'Every module in src/components and src/hooks is used from two or more folders.',
    );
    expect(result.status).toBe(0);
  });

  it('passes a module used from two folders, through the @/ alias and a relative path', () => {
    const result = check({
      'src/components/Shared.tsx': component,
      'app/RoomApp.tsx': viaAlias,
      'app/ingest/_ingest-entry/IngestEntry.tsx':
        "import { Shared } from '../../../src/components/Shared.tsx';\nexport const b = Shared;\n",
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });

  it('fails a module with one user, and says to move it beside that user', () => {
    const result = check({
      'src/hooks/useShared.ts': component,
      'app/RoomApp.tsx': viaAlias.replace('components/Shared', 'hooks/useShared'),
    });
    expect(result.stderr).toContain(
      'src/hooks/useShared.ts is used only from app/. Move it into that folder, beside its one user, as docs/engineering/code-layout.md#where-a-module-goes says.',
    );
    expect(result.status).toBe(1);
  });

  it('fails a module whose two users share a folder', () => {
    const result = check({
      'src/components/Shared.tsx': component,
      'app/r/One.tsx': viaAlias,
      'app/r/Two.tsx': viaAlias,
    });
    expect(result.stderr).toContain('src/components/Shared.tsx is used only from app/r/.');
    expect(result.status).toBe(1);
  });

  it("fails a module only tests use, since a test isn't a user", () => {
    const result = check({
      'src/components/Shared.tsx': component,
      'src/components/Shared.browser.test.tsx': viaAlias,
      'app/r/One.test.tsx': viaAlias,
    });
    expect(result.stderr).toContain(
      "src/components/Shared.tsx isn't imported outside tests. Move it beside the code that uses it, or delete it",
    );
    expect(result.status).toBe(1);
  });

  it("leaves a private _ folder's part, used by its one component, to review", () => {
    const result = check({
      'src/components/Shared.tsx':
        "import { Part } from './_shared/Part.tsx';\nexport const Shared = Part;\n",
      'src/components/_shared/Part.tsx': 'export const Part = 1;\n',
      'app/a/One.tsx': viaAlias,
      'app/b/Two.tsx': viaAlias,
    });
    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
  });
});
