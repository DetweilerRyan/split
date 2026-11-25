import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, onTestFinished } from 'vitest';

// The package bans in .oxlintrc.json's overrides for src/domain/ and src/services/, from #94, which
// docs/engineering/dependency-direction.md describes, and the code design principles' checks from
// #116, which code-design-principles.meta.md lists. An override's globs match paths relative to
// the config, so this copies the real config into a throwaway project, links in the repository's
// own lint plugin, and runs the real oxlint on files laid out like the repository.
const config = fileURLToPath(new URL('./.oxlintrc.json', import.meta.url));
const plugins = fileURLToPath(new URL('./scripts/lint', import.meta.url));
const oxlint = fileURLToPath(new URL('./node_modules/oxlint/bin/oxlint', import.meta.url));

/** The `[rule]` of each problem oxlint reports in `files`, as `path:line [rule]`. */
function lint(files: Readonly<Record<string, string>>) {
  const cwd = mkdtempSync(join(tmpdir(), 'splitsmart-oxlint-'));
  onTestFinished(() => rmSync(cwd, { recursive: true }));
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
      .map((line) => line.replace(/^([^:]+:\d+):\d+: .* \[(?:Error|Warning)\/(.*)\]$/, '$1 [$2]'))
      .toSorted(),
  };
}

/** One file per package, under `folder`, importing it in the plainest way. */
function importsOf(folder: string, packages: readonly string[]) {
  return Object.fromEntries(
    packages.map((name, index) => [
      `${folder}/imports${index}.ts`,
      `import * as p from '${name}';\nexport { p };\n`,
    ]),
  );
}

/** The problems `importsOf(folder, packages)` should get, one per file. */
function refusals(folder: string, packages: readonly string[]) {
  return packages
    .map((_, index) => `${folder}/imports${index}.ts:1 [eslint(no-restricted-imports)]`)
    .toSorted();
}

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
    // Its `export *` lines make it a barrel file too, which oxlint reports on its first line.
    expect(problems).toEqual(
      [
        ...[1, 2, 3, 4, 6].map(
          (line) => `src/domain/forms.ts:${line} [eslint(no-restricted-imports)]`,
        ),
        'src/domain/forms.ts:1 [oxc(no-barrel-file)]',
      ].toSorted(),
    );
  });

  it('refuses JSX in src/domain/, which imports react/jsx-runtime with no import statement', () => {
    expect(
      // It returns unknown: with no React installed here, the JSX's type is any.
      lint({ 'src/domain/badge.tsx': 'export function Badge(): unknown {\n  return <i />;\n}\n' }),
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

/** One file per name, under `folder`, reading it as a value. */
function readsOf(folder: string, names: readonly string[]) {
  return Object.fromEntries(
    names.map((name, index) => [`${folder}/reads${index}.ts`, `export const a = ${name};\n`]),
  );
}

/** The problems `readsOf(folder, names)` should get, one per file, from `rule`. */
function readRefusals(folder: string, names: readonly string[], rule: string) {
  return names.map((_, index) => `${folder}/reads${index}.ts:1 [${rule}]`).toSorted();
}

// Effects the shell passes into src/domain/ as arguments, from #116.
const browser = ['navigator', 'window', 'document', 'location'];
const storageGlobals = ['localStorage', 'sessionStorage', 'indexedDB'];
const effects = ['fetch', 'setTimeout', 'setInterval'];
const hiddenInputs = ['Date.now()', 'Math.random()'];

describe('.oxlintrc.json’s code design principle checks', () => {
  it('refuses the browser’s globals, its storage, timers and Proxy in src/domain/', () => {
    const banned = [...browser, ...storageGlobals, ...effects, 'Proxy'];

    expect(lint(readsOf('src/domain', banned))).toEqual({
      status: 1,
      problems: readRefusals('src/domain', banned, 'eslint(no-restricted-globals)'),
    });
  });

  it('refuses the clock and randomness in src/domain/', () => {
    expect(lint(readsOf('src/domain', hiddenInputs))).toEqual({
      status: 1,
      problems: readRefusals('src/domain', hiddenInputs, 'eslint(no-restricted-properties)'),
    });
  });

  it('lets src/domain/ use a parameter named like a global, and other Date and Math members', () => {
    const allowed = [
      "['here'].map((location) => location)",
      'new Date(0)',
      'Date.UTC(2026, 0, 1)',
      'Math.max(1, 2)',
    ];

    expect(lint(readsOf('src/domain', allowed))).toEqual({ status: 0, problems: [] });
  });

  it('leaves the other folders free to use the browser, timers, the clock and randomness', () => {
    const all = [...browser, ...storageGlobals, ...effects, ...hiddenInputs];

    expect(lint({ ...readsOf('src/sync', all), ...readsOf('app', all) })).toEqual({
      status: 0,
      problems: [],
    });
  });

  it('refuses eval, new Function and Proxy anywhere', () => {
    const banned = {
      'app/run.ts': "eval('1');\n",
      'src/sync/build.ts': "export const f = new Function('return 1');\n",
      'scripts/call.ts': "export const g = Function('return 1');\n",
      'src/utils/wrap.ts': 'export const p = new Proxy({}, {});\n',
    };

    expect(lint(banned)).toEqual({
      status: 1,
      problems: [
        'app/run.ts:1 [eslint(no-eval)]',
        'scripts/call.ts:1 [eslint(no-new-func)]',
        // Type-aware linting (#120) turns on no-implied-eval, which also sees a Function call.
        'scripts/call.ts:1 [typescript(no-implied-eval)]',
        'src/sync/build.ts:1 [eslint(no-new-func)]',
        'src/sync/build.ts:1 [typescript(no-implied-eval)]',
        'src/utils/wrap.ts:1 [eslint(no-restricted-globals)]',
      ],
    });
  });

  it('refuses a barrel file, however few modules it passes through', () => {
    expect(
      lint({
        'src/utils/a.ts': 'export const a = 1;\n',
        'src/utils/index.ts': "export * from './a';\n",
      }),
    ).toEqual({ status: 1, problems: ['src/utils/index.ts:1 [oxc(no-barrel-file)]'] });
  });

  it('refuses a module-level let everywhere but src/sync/', () => {
    const state = 'export let count = 0;\n';

    expect(
      lint({
        'src/domain/count.ts': state,
        'app/count.ts': state,
        'scripts/count.ts': state,
        'src/sync/count.ts': state,
        'src/sync/nested/count.ts': state,
      }),
    ).toEqual({
      status: 1,
      problems: [
        'app/count.ts:1 [functional(no-module-let)]',
        'scripts/count.ts:1 [functional(no-module-let)]',
        'src/domain/count.ts:1 [functional(no-module-let)]',
      ],
    });
  });
});
