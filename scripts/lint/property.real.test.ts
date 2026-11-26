import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

// The plugin as `npm run lint` runs it: the real oxlint with the repository's .oxlintrc.json, on a
// throwaway file. property.test.ts and property.property.test.ts cover the rules' cases; this
// covers loading the plugin, and the override that turns its rules on for property tests only.
const oxlint = fileURLToPath(new URL('../../node_modules/oxlint/bin/oxlint', import.meta.url));
const config = fileURLToPath(new URL('../../.oxlintrc.json', import.meta.url));

/** oxlint's exit status and the property rules it reports for `source`, as a file named `name`. */
function lint(name: string, source: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-lint-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  writeFileSync(join(cwd, name), source);
  const result = spawnSync(process.execPath, [oxlint, '-c', config, '--format', 'unix', name], {
    cwd,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    problems: result.stdout.split('\n').filter((line) => line.includes('property(')),
  };
}

const unrun = [
  "import fc from 'fast-check';",
  "import { it } from 'vitest';",
  '',
  "it('never runs', () => {",
  '  fc.property(fc.integer(), (n) => {',
  '    check(n);',
  '  });',
  '});',
  '',
].join('\n');

describe('the repository lint config', () => {
  it('checks a property test with the property plugin', () => {
    const { status, problems } = lint('code.property.test.ts', unrun);
    expect(status).toBe(1);
    expect(problems).toEqual([
      expect.stringMatching(
        /^code\.property\.test\.ts:5:3: Pass this property to .*\[Error\/property\(asserted\)\]$/,
      ),
    ]);
  });

  it('leaves the same code alone in a test that is not a property test', () => {
    expect(lint('code.test.ts', unrun).problems).toEqual([]);
  });

  it('honours a disable comment with a reason on the next line only', () => {
    const source = [
      "import fc from 'fast-check';",
      '// oxlint-disable-next-line property/no-filter -- a rare value no constraint can name',
      'export const odd = fc.integer().filter((n) => n % 2 === 1);',
      'export const even = fc.integer().filter((n) => n % 2 === 0);',
      '',
    ].join('\n');
    expect(lint('code.property.test.ts', source).problems).toEqual([
      expect.stringMatching(
        /^code\.property\.test\.ts:4:34: Build the constraint .*\[Error\/property\(no-filter\)\]$/,
      ),
    ]);
  });
});
