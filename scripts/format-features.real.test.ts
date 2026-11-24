import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

const script = fileURLToPath(new URL('./format-features.ts', import.meta.url));

const formatted = `Feature: Split a bill

  Scenario: Two people share an item
    Given the receipt lists:
      | item  | price |
      | Fries |  4.00 |
`;
// The same feature with a misaligned table and a step indented one space too far.
const unformatted = `Feature: Split a bill

  Scenario: Two people share an item
     Given the receipt lists:
      | item | price |
      | Fries | 4.00 |
`;

function features(files: Readonly<Record<string, string>>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-features-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(join(cwd, name, '..'), { recursive: true });
    writeFileSync(join(cwd, name), text);
  }
  return cwd;
}

function run(cwd: string, ...args: readonly string[]) {
  return spawnSync(process.execPath, [script, ...args], { cwd, encoding: 'utf8' });
}

describe('format-features', () => {
  it('passes the check when every feature is formatted', () => {
    const cwd = features({ 'e2e/features/split.feature': formatted });
    const result = run(cwd, '--check');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('1 feature files checked');
  });

  it('fails the check and names each unformatted feature, without changing it', () => {
    const cwd = features({
      'e2e/features/split.feature': unformatted,
      'e2e/features/nested/also.feature': unformatted,
      'e2e/features/ok.feature': formatted,
    });
    const result = run(cwd, '--check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Not formatted: e2e/features/nested/also.feature');
    expect(result.stderr).toContain('Not formatted: e2e/features/split.feature');
    expect(result.stderr).not.toContain('ok.feature');
    expect(readFileSync(join(cwd, 'e2e/features/split.feature'), 'utf8')).toBe(unformatted);
  });

  it('formats features in place when not checking', () => {
    const cwd = features({ 'e2e/features/split.feature': unformatted });
    expect(run(cwd).status).toBe(0);
    expect(readFileSync(join(cwd, 'e2e/features/split.feature'), 'utf8')).toBe(formatted);
    expect(run(cwd, '--check').status).toBe(0);
  });

  it('fails when there are no feature files to check', () => {
    const cwd = features({ 'e2e/features/notes.md': '# Not a feature\n' });
    const result = run(cwd, '--check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No .feature files found in e2e/features.');
  });

  it('fails with the parse error when a feature is not valid Gherkin', () => {
    // A line after a step that is no Gherkin keyword can't be parsed.
    const cwd = features({
      'e2e/features/broken.feature': 'Feature: Broken\n  Scenario: x\n    Given a\n  Bogus line\n',
    });
    const result = run(cwd, '--check');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('e2e/features/broken.feature: (4:3): expected:');
    expect(result.stderr).not.toContain('    at ');
  });
});
