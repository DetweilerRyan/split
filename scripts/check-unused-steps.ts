#!/usr/bin/env node
// Fails when a step definition is used by no feature. playwright-bdd's `bddgen` already fails a
// step with no definition, or one that two definitions match; its `export --unused-steps`
// report lists unused definitions but exits 0, so this script turns the report into a check.
// `npm run lint` runs it from the repository root. Why it exists and works this way is in
// check-unused-steps.meta.md beside it; read that only when changing or questioning the script.
//
// Usage: node scripts/check-unused-steps.ts [-c <config>]...
// Each -c names a playwright-bdd config to check; with none, playwright.config.ts in the current
// directory. `npm run lint` passes every config the repository has.
// BDDGEN_CLI replaces the path to playwright-bdd's CLI, so a test can supply a fake one.
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cli =
  process.env.BDDGEN_CLI ??
  fileURLToPath(new URL('../node_modules/playwright-bdd/dist/cli/index.js', import.meta.url));

const args = process.argv.slice(2);
const configs: (string | undefined)[] = [];
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '-c' || args[i] === '--config') && args[i + 1]) configs.push(args[++i]);
  else {
    console.error(
      `Unknown argument ${args[i]}. Usage: node scripts/check-unused-steps.ts [-c <config>]...`,
    );
    process.exit(1);
  }
}
// With no -c, bddgen reads playwright.config.ts in the current directory.
if (configs.length === 0) configs.push(undefined);

for (const config of configs) {
  const name = config ?? 'playwright.config.ts';
  const result = spawnSync(
    process.execPath,
    [cli, 'export', '--unused-steps', ...(config ? ['-c', config] : [])],
    { encoding: 'utf8', env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1' } },
  );
  const output = `${result.stdout}${result.stderr}`.trim();

  if (result.status !== 0) {
    console.error(`${name}: ${output || `bddgen exited with ${result.status ?? result.signal}.`}`);
    process.exit(1);
  }

  const count = /^Unused steps \((\d+)\):/m.exec(output)?.[1];
  if (count === undefined) {
    console.error(
      `Couldn't find the "Unused steps (<n>):" line in bddgen's output for ${name}; playwright-bdd may have changed it.`,
    );
    console.error(output);
    process.exit(1);
  }

  if (count !== '0') {
    console.error(`${name}:`);
    console.error(output);
    console.error('Delete each step definition above, or use it in a feature.');
    process.exit(1);
  }
}
console.log('No unused step definitions.');
