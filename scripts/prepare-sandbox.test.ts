// @vitest-environment node
import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('./prepare-sandbox.sh', import.meta.url));
const directories: string[] = [];
const runCommand = promisify(execFile);

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-setup-'));
  directories.push(cwd);
  mkdirSync(join(cwd, 'bin'));
  writeFileSync(join(cwd, 'package.json'), '{}');
  writeFileSync(join(cwd, 'package-lock.json'), '{}');
  writeFileSync(join(cwd, 'bin/npm'), `#!/bin/sh
if [ "$1" = "--version" ]; then echo 1.0; exit 0; fi
echo install >> installs
if [ -f fail-install ]; then exit 1; fi
sleep 0.1
mkdir -p node_modules
`, { mode: 0o755 });
  execFileSync('git', ['init', '--quiet'], { cwd });
  const env = { ...process.env, PATH: `${join(cwd, 'bin')}:${process.env.PATH}` };
  const run = () => spawnSync('sh', [script], { cwd, env, encoding: 'utf8' });
  const runAsync = () => runCommand('sh', [script], { cwd, env });
  return { cwd, run, runAsync };
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe.skipIf(process.platform !== 'linux')('sandbox dependency setup', () => {
  it('reuses an installation until the lockfile changes', () => {
    const { cwd, run } = fixture();
    expect(run().status).toBe(0);
    expect(run().stdout).toContain('already installed');
    expect(readFileSync(join(cwd, 'installs'), 'utf8')).toBe('install\n');
    writeFileSync(join(cwd, 'package-lock.json'), '{"changed":true}');
    expect(run().status).toBe(0);
    expect(readFileSync(join(cwd, 'installs'), 'utf8')).toBe('install\ninstall\n');
  });

  it('does not mark a failed install as ready and can retry', () => {
    const { cwd, run } = fixture();
    expect(run().status).toBe(0);
    writeFileSync(join(cwd, 'package-lock.json'), '{"changed":true}');
    writeFileSync(join(cwd, 'fail-install'), '');
    expect(run().status).not.toBe(0);
    rmSync(join(cwd, 'fail-install'));
    writeFileSync(join(cwd, 'package-lock.json'), '{}');
    expect(run().status).toBe(0);
    expect(readFileSync(join(cwd, 'installs'), 'utf8')).toBe('install\ninstall\ninstall\n');
  });

  it('serializes concurrent setup attempts', async () => {
    const { cwd, runAsync } = fixture();
    await Promise.all([runAsync(), runAsync()]);
    expect(readFileSync(join(cwd, 'installs'), 'utf8')).toBe('install\n');
  });
});
