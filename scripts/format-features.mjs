#!/usr/bin/env node
// Formats Gherkin .feature files with Cucumber's own formatter (@cucumber/gherkin-utils), which
// oxfmt doesn't cover. `npm run format` writes them; `npm run format:check` runs this with
// --check, which changes nothing and exits 1 if any file isn't formatted.
//
// Usage: node scripts/format-features.mjs [--check] [path ...]   (default path: e2e/features)
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const formatter = fileURLToPath(
  new URL('../node_modules/@cucumber/gherkin-utils/bin/gherkin-utils', import.meta.url),
);

const args = process.argv.slice(2);
const check = args.includes('--check');
const paths = args.filter((arg) => arg !== '--check');
if (paths.length === 0) paths.push('e2e/features');

function featureFiles(path) {
  if (!statSync(path).isDirectory()) return path.endsWith('.feature') ? [path] : [];
  return readdirSync(path, { recursive: true })
    .filter((entry) => entry.endsWith('.feature'))
    .map((entry) => join(path, entry))
    .sort();
}

function format(source) {
  const result = spawnSync(process.execPath, [formatter, 'format'], {
    input: source,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    // The formatter throws on a parse error; keep its "(line:column): ..." lines, not the stack.
    const positions = result.stderr.split('\n').filter((line) => /^\(\d+:\d+\)/.test(line));
    throw new Error(positions.join('\n') || result.stderr.trim() || 'the formatter failed');
  }
  return result.stdout;
}

const files = paths.flatMap(featureFiles);
if (files.length === 0) {
  console.error(`No .feature files found in ${paths.join(', ')}.`);
  process.exit(1);
}

const unformatted = [];
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  let formatted;
  try {
    formatted = format(source);
  } catch (error) {
    console.error(`${relative(process.cwd(), file)}: ${error.message}`);
    process.exit(1);
  }
  if (formatted === source) continue;
  unformatted.push(file);
  if (!check) writeFileSync(file, formatted);
}

if (check && unformatted.length > 0) {
  for (const file of unformatted) console.error(`Not formatted: ${relative(process.cwd(), file)}`);
  console.error('Run `npm run format` to format them.');
  process.exit(1);
}
const verb = check ? 'checked' : 'formatted';
console.log(`${files.length} feature files ${verb}, ${check ? 0 : unformatted.length} changed.`);
