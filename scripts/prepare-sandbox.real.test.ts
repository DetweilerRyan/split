import { execFile, execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { describe, expect, it, onTestFinished } from 'vitest';

const script = fileURLToPath(new URL('./prepare-sandbox.sh', import.meta.url));
const runCommand = promisify(execFile);

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-setup-'));
  onTestFinished(() => rmSync(cwd, { recursive: true, force: true }));
  mkdirSync(join(cwd, 'bin'));
  writeFileSync(join(cwd, 'package.json'), '{}');
  writeFileSync(join(cwd, 'package-lock.json'), '{}');
  writeFileSync(
    join(cwd, 'bin/npm'),
    `#!/bin/sh
if [ "$1" = "--version" ]; then echo 1.0; exit 0; fi
echo install >> installs
if [ -f fail-install ]; then exit 1; fi
sleep 0.1
mkdir -p node_modules
`,
    { mode: 0o755 },
  );
  // Playwright's CLI: records each call and, for an install, leaves a fake headless shell
  // where Playwright would put it.
  writeFileSync(
    join(cwd, 'bin/npx'),
    `#!/bin/sh
echo "$*" >> browser-calls
if [ "$3" = "install" ]; then
  shell="$PLAYWRIGHT_BROWSERS_PATH/chromium_headless_shell-1/chrome-headless-shell-linux64"
  mkdir -p "$shell"
  touch "$shell/chrome-headless-shell"
fi
if [ "$3" = "install-deps" ] && [ -f fail-deps ]; then exit 1; fi
if [ "$3" = "install-deps" ]; then rm -f missing-libs; fi
exit 0
`,
    { mode: 0o755 },
  );
  // ldd reports each library listed in missing-libs as not found.
  writeFileSync(
    join(cwd, 'bin/ldd'),
    `#!/bin/sh
if [ -f missing-libs ]; then sed 's/.*/\t& => not found/' missing-libs; fi
echo "\tlibc.so.6 => /lib/libc.so.6"
`,
    { mode: 0o755 },
  );
  writeFileSync(join(cwd, 'bin/sudo'), '#!/bin/sh\n[ "$1" = "-n" ] && shift\nexec "$@"\n', {
    mode: 0o755,
  });
  // The launch check fails while fail-launch exists.
  mkdirSync(join(cwd, 'scripts'));
  writeFileSync(
    join(cwd, 'scripts/check-browser.mjs'),
    `import { existsSync } from 'node:fs';
if (existsSync('fail-launch')) { console.error('browser did not launch'); process.exit(1); }
console.log('Headless Chromium launched and rendered a page.');
`,
  );
  execFileSync('git', ['init', '--quiet'], { cwd });
  const env = {
    ...process.env,
    PATH: `${join(cwd, 'bin')}:${process.env.PATH}`,
    PLAYWRIGHT_BROWSERS_PATH: join(cwd, 'browsers'),
  };
  function run() {
    return spawnSync('sh', [script], { cwd, env, encoding: 'utf8' });
  }
  function runAsync() {
    return runCommand('sh', [script], { cwd, env });
  }
  return { cwd, run, runAsync };
}

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

  it('installs the browser on every run, even when dependencies are already installed', () => {
    const { cwd, run } = fixture();
    expect(run().status).toBe(0);
    const second = run();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain('already installed');
    expect(readFileSync(join(cwd, 'installs'), 'utf8')).toBe('install\n');
    expect(readFileSync(join(cwd, 'browser-calls'), 'utf8')).toBe(
      '--no-install playwright install --only-shell chromium\n'.repeat(2),
    );
    expect(second.stdout).toContain('Headless Chromium is already installed.');
    expect(second.stdout).toContain("Chromium's system libraries are already installed.");
    expect(second.stdout).toContain('Headless Chromium launched and rendered a page.');
  });

  it("installs the browser's system libraries only while some are missing", () => {
    const { cwd, run } = fixture();
    writeFileSync(join(cwd, 'missing-libs'), 'libglib-2.0.so.0\n');
    expect(run().status).toBe(0);
    expect(run().status).toBe(0);
    const calls = readFileSync(join(cwd, 'browser-calls'), 'utf8').split('\n');
    expect(calls.filter((call) => call.includes('install-deps'))).toEqual([
      '--no-install playwright install-deps chromium',
    ]);
  });

  it('carries on to the launch check when the library install fails, and names what is missing', () => {
    const { cwd, run } = fixture();
    writeFileSync(join(cwd, 'missing-libs'), 'libglib-2.0.so.0\n');
    writeFileSync(join(cwd, 'fail-deps'), '');
    writeFileSync(join(cwd, 'fail-launch'), '');
    const result = run();
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toContain('WARNING');
    expect(result.stdout + result.stderr).toContain('libglib-2.0.so.0');
    expect(result.stdout + result.stderr).toContain('browser did not launch');
  });

  it('fails when the browser does not launch', () => {
    const { cwd, run } = fixture();
    writeFileSync(join(cwd, 'fail-launch'), '');
    expect(run().status).not.toBe(0);
    rmSync(join(cwd, 'fail-launch'));
    expect(run().status).toBe(0);
  });

  it('serializes concurrent setup attempts', async () => {
    const { cwd, runAsync } = fixture();
    await Promise.all([runAsync(), runAsync()]);
    expect(readFileSync(join(cwd, 'installs'), 'utf8')).toBe('install\n');
  });
});
