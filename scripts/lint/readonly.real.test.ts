import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

// The plugin as `npm run lint` runs it: the real oxlint with the repository's .oxlintrc.json, on a
// throwaway file. readonly.test.ts and readonly.property.test.ts cover the rule's cases; this
// covers loading it.
const oxlint = fileURLToPath(new URL('../../node_modules/oxlint/bin/oxlint', import.meta.url));
const config = fileURLToPath(new URL('../../.oxlintrc.json', import.meta.url));

/** oxlint's exit status and one-line-per-problem output for `source`, as a file of its own. */
function lint(source: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-lint-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  writeFileSync(join(cwd, 'code.ts'), source);
  const result = spawnSync(
    process.execPath,
    [oxlint, '-c', config, '--format', 'unix', 'code.ts'],
    { cwd, encoding: 'utf8' },
  );
  return {
    status: result.status,
    problems: result.stdout.split('\n').filter((line) => line.includes('[')),
  };
}

describe('the repository lint config', () => {
  it('reports a mutable type through the readonly plugin', () => {
    const { status, problems } = lint(
      'export type Row = {\n  name: string;\n  tags: readonly string[][];\n};\n',
    );
    expect(status).toBe(1);
    expect(problems).toEqual([
      expect.stringMatching(/^code\.ts:2:3: Mark the property .* \[Error\/readonly\(types\)\]$/),
      expect.stringMatching(/^code\.ts:3:3: Mark the property .* \[Error\/readonly\(types\)\]$/),
      expect.stringMatching(
        /^code\.ts:3:18: Write `readonly T\[\]` .* \[Error\/readonly\(types\)\]$/,
      ),
    ]);
  });

  it('leaves readonly types, and a local working array, alone', () => {
    const source = [
      'export type Row = Readonly<{ name: string; tags: readonly string[] }>;',
      'export function names(rows: readonly Row[]): readonly string[] {',
      '  const out: string[] = [];',
      '  for (const row of rows) out.push(row.name);',
      '  return out;',
      '}',
      '',
    ].join('\n');
    expect(lint(source)).toEqual({ status: 0, problems: [] });
  });

  it('honours a disable comment with a reason on the next line only', () => {
    const source = [
      '// oxlint-disable-next-line readonly/types -- a cache filled in place',
      'export type Cache = Map<string, number>;',
      'export type Other = Map<string, number>;',
      '',
    ].join('\n');
    expect(lint(source).problems).toEqual([
      expect.stringMatching(/^code\.ts:3:21: Write `ReadonlyMap.*\[Error\/readonly\(types\)\]$/),
    ]);
  });
});
