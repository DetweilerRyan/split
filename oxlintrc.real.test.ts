import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

// The package bans in .oxlintrc.json's overrides for src/domain/ and src/services/, from #94, which
// docs/engineering/dependency-direction.md describes. An override's globs match paths relative to
// the config, so this copies the real config into a throwaway project, links in the repository's
// own lint plugin, and runs the real oxlint on files laid out like the repository.
const config = fileURLToPath(new URL('./.oxlintrc.json', import.meta.url));
const plugins = fileURLToPath(new URL('./scripts/lint', import.meta.url));
const oxlint = fileURLToPath(new URL('./node_modules/oxlint/bin/oxlint', import.meta.url));
const directories: string[] = [];

/** The `[rule]` of each problem oxlint reports in `files`, as `path:line [rule]`. */
function lint(files: Readonly<Record<string, string>>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-oxlint-'));
  directories.push(cwd);
  copyFileSync(config, join(cwd, '.oxlintrc.json'));
  mkdirSync(join(cwd, 'scripts'));
  symlinkSync(plugins, join(cwd, 'scripts/lint'));
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(cwd, path)), { recursive: true });
    writeFileSync(join(cwd, path), content);
  }
  const result = spawnSync(
    process.execPath,
    [oxlint, '-c', '.oxlintrc.json', '--format', 'unix', ...Object.keys(files)],
    { cwd, encoding: 'utf8' },
  );
  return {
    status: result.status,
    problems: result.stdout
      .split('\n')
      .filter((line) => line.includes('['))
      .map((line) => line.replace(/^([^:]+:\d+):\d+: .* \[Error\/(.*)\]$/, '$1 [$2]'))
      .toSorted(),
  };
}

/** One file per package, under `folder`, importing it in the plainest way. */
function importsOf(folder: string, packages: readonly string[]) {
  return Object.fromEntries(
    packages.map((name, index) => [
      `${folder}/imports${index}.ts`,
      `import * as p from '${name}';\nexport const a = p;\n`,
    ]),
  );
}

/** The problems `importsOf(folder, packages)` should get, one per file. */
function refusals(folder: string, packages: readonly string[]) {
  return packages
    .map((_, index) => `${folder}/imports${index}.ts:1 [eslint(no-restricted-imports)]`)
    .toSorted();
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true });
});

const ui = ['react', 'react/jsx-runtime', 'react-dom/client', 'next', 'next/link', 'lucide-react'];
const sync = [
  'yjs',
  'y-indexeddb',
  'y-webrtc',
  'y-protocols/awareness',
  '@liveblocks/client',
  '@liveblocks/client/internal',
];
const storage = ['idb', 'idb-keyval', 'localforage', 'dexie/dist/dexie.mjs'];
const server = [
  'next/server',
  '@vercel/functions',
  'mcp-handler',
  '@modelcontextprotocol/server',
  'dialog-closedby-polyfill',
];
// Names that only start like a banned package, and relative paths with a banned package's name.
const lookalikes = ['zod', 'reactive', 'next-intl', 'yjs-helpers', './y-axis', '../react/b'];

describe('.oxlintrc.json’s package bans', () => {
  it('refuses UI, sync, browser-storage and server packages in src/domain/', () => {
    const banned = [...ui, ...sync, ...storage, ...server];

    expect(lint(importsOf('src/domain', banned))).toEqual({
      status: 1,
      problems: refusals('src/domain', banned),
    });
  });

  it('refuses a banned package in src/domain/ however it’s imported', () => {
    const { status, problems } = lint({
      'src/domain/forms.ts': [
        "import type { Doc } from 'yjs';",
        "export { useMemo } from 'react';",
        "export * from '@liveblocks/client';",
        "export * as Y from 'yjs';",
        'export function load() {',
        "  return import('react-dom');",
        '}',
        'export type D = Doc;',
        '',
      ].join('\n'),
    });

    expect(status).toBe(1);
    expect(problems).toEqual(
      [1, 2, 3, 4, 6].map((line) => `src/domain/forms.ts:${line} [eslint(no-restricted-imports)]`),
    );
  });

  it('refuses JSX in src/domain/, which imports react/jsx-runtime with no import statement', () => {
    expect(
      lint({ 'src/domain/badge.tsx': 'export function Badge() {\n  return <i />;\n}\n' }),
    ).toEqual({ status: 1, problems: ['src/domain/badge.tsx:2 [react(jsx-filename-extension)]'] });
  });

  it('lets src/domain/ import plain libraries and look-alike names', () => {
    expect(lint(importsOf('src/domain', lookalikes))).toEqual({ status: 0, problems: [] });
  });

  it('refuses UI and sync packages in src/services/', () => {
    const banned = [...ui, ...sync, 'next/server'];

    expect(lint(importsOf('src/services', banned))).toEqual({
      status: 1,
      problems: refusals('src/services', banned),
    });
  });

  it('lets src/services/ import browser storage, server packages and look-alike names', () => {
    const allowed = [...storage, ...server.filter((name) => name !== 'next/server'), ...lookalikes];

    expect(lint(importsOf('src/services', allowed))).toEqual({ status: 0, problems: [] });
  });

  it('leaves the other folders free to import any package', () => {
    const all = [...ui, ...sync, ...storage, ...server];

    expect(lint(importsOf('src/sync', all))).toEqual({ status: 0, problems: [] });
  });
});
