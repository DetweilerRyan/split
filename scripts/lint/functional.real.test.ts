import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

// The plugin as `npm run lint` runs it: the real oxlint with the repository's .oxlintrc.json, on a
// throwaway file. functional.test.ts covers the rules' cases; this covers loading them.
const oxlint = fileURLToPath(new URL('../../node_modules/oxlint/bin/oxlint', import.meta.url));
const config = fileURLToPath(new URL('../../.oxlintrc.json', import.meta.url));

/** oxlint's one-line-per-problem output for `source`, linted as a file of its own. */
function lint(source: string) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-lint-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  writeFileSync(join(cwd, 'code.ts'), source);
  const result = spawnSync(
    process.execPath,
    [oxlint, '-c', config, '--format', 'unix', 'code.ts'],
    {
      cwd,
      encoding: 'utf8',
    },
  );
  return {
    status: result.status,
    problems: result.stdout.split('\n').filter((l) => l.includes('[')),
  };
}

describe('the repository lint config', () => {
  it('reports a class and a `this` through the functional plugin', () => {
    const { status, problems } = lint(
      'export class Store {}\nexport function read() {\n  return this;\n}\n',
    );
    expect(status).toBe(1);
    expect(problems).toEqual([
      expect.stringMatching(/^code\.ts:1:8: .* \[Error\/functional\(no-classes\)\]$/),
      expect.stringMatching(/^code\.ts:3:10: .* \[Error\/functional\(no-this\)\]$/),
    ]);
  });

  it('reports a module-level `let` and `var` through the functional plugin', () => {
    const { status, problems } = lint(
      'export let count = 0;\nvar total = 0;\nexport function read() {\n  let n = count;\n  return n + total;\n}\n',
    );
    expect(status).toBe(1);
    expect(problems).toEqual([
      expect.stringMatching(/^code\.ts:1:8: .* \[Error\/functional\(no-module-let\)\]$/),
      expect.stringMatching(/^code\.ts:2:1: .* \[Error\/functional\(no-module-let\)\]$/),
    ]);
  });

  it('leaves an Error subclass alone', () => {
    expect(lint('export class NotFound extends Error {}\n')).toEqual({ status: 0, problems: [] });
  });

  it('allows `this` that reads a kept class, through allowInClasses, and no other', () => {
    const source = [
      '// oxlint-disable-next-line functional/no-classes -- a reason',
      'export class Kept {',
      '  read() { return this; }',
      '  later() { return function () { return this; }; }',
      '}',
      '',
    ].join('\n');
    expect(lint(source).problems).toEqual([
      expect.stringMatching(/^code\.ts:4:\d+: .*\[Error\/functional\(no-this\)\]$/),
    ]);
  });

  it('honours a disable comment on the next line only', () => {
    const source = [
      '// oxlint-disable-next-line functional/no-classes -- a reason',
      'export class Kept {}',
      '// oxlint-disable-next-line functional/no-this -- a reason',
      'export function a() { return this; }',
      'export function b() { return this; }',
      '',
    ].join('\n');
    expect(lint(source).problems).toEqual([
      expect.stringMatching(/^code\.ts:5:30: .*\[Error\/functional\(no-this\)\]$/),
    ]);
  });

  it('honours a disable comment for the rest of a block', () => {
    const source = [
      '// oxlint-disable functional/no-this -- a reason',
      'export function a() { return this; }',
      '// oxlint-enable functional/no-this',
      'export function b() { return this; }',
      '',
    ].join('\n');
    expect(lint(source).problems).toEqual([
      expect.stringMatching(/^code\.ts:4:30: .*\[Error\/functional\(no-this\)\]$/),
    ]);
  });
});
