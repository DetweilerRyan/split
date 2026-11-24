#!/usr/bin/env node
// Fails when a module in src/components/ or src/hooks/ is used from fewer than two folders. Those
// folders hold UI that more than one route uses, and code one route or module uses lives beside
// it, as docs/engineering/code-layout.md says. rev-dep finds each module's importers, through `@/`
// aliases and relative paths; imports from tests don't count. `npm run lint` runs it from the
// repository root. Why it works this way is in docs/engineering/code-layout.meta.md, under "Shared
// folders are checked"; read that only when changing or questioning the script.
//
// Usage: node scripts/check-shared-folders.ts
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The folders that hold only shared code, from the repository root. */
export const SHARED_FOLDERS: readonly string[] = ['src/components', 'src/hooks'];

/** A module in a shared folder, and the files that import it, by path from the root. */
export type Use = { readonly file: string; readonly importers: readonly string[] };

const revDep = fileURLToPath(new URL('../node_modules/.bin/rev-dep', import.meta.url));

/** Whether a file is a test, as testing-conventions.md names them: `<module>.<kind>.test.<ext>`. */
export function isTest(path: string): boolean {
  return basename(path).includes('.test.');
}

/**
 * Whether the check covers a file, given by its path below a shared folder. A test and the
 * `.gitkeep` that keeps an empty folder aren't shared code, and a private `_` folder's parts have
 * one user by design, as code layout says.
 */
export function isChecked(pathInFolder: string): boolean {
  const segments = pathInFolder.split('/');
  return (
    basename(pathInFolder) !== '.gitkeep' &&
    !isTest(pathInFolder) &&
    !segments.slice(0, -1).some((segment) => segment.startsWith('_'))
  );
}

/** The folders a module is used from: each importer's folder, leaving out tests. */
export function usingFolders(importers: readonly string[]): readonly string[] {
  return [...new Set(importers.filter((importer) => !isTest(importer)).map(dirname))].sort();
}

/** An error for each module used from fewer than two folders, saying what to do about it. */
export function problems(uses: readonly Use[]): readonly string[] {
  return uses.flatMap(({ file, importers }) => {
    const folders = usingFolders(importers);
    if (folders.length >= 2) return [];
    const where =
      folders.length === 0
        ? "isn't imported outside tests. Move it beside the code that uses it, or delete it"
        : `is used only from ${folders[0]}/. Move it into that folder, beside its one user`;
    return [
      `${file} ${where}, as docs/engineering/code-layout.md#where-a-module-goes says. ` +
        'src/components/ and src/hooks/ hold only code used from two or more folders.',
    ];
  });
}

/** The files the check covers in each shared folder under `root`, by path from `root`. */
function checkedFiles(root: string): readonly string[] {
  return SHARED_FOLDERS.flatMap((folder) => {
    const dir = join(root, folder);
    if (!existsSync(dir)) return [];
    return readdirSync(dir, { recursive: true, encoding: 'utf8' })
      .map((path) => path.split('\\').join('/'))
      .filter((path) => isChecked(path) && statSync(join(dir, path)).isFile())
      .map((path) => `${folder}/${path}`)
      .sort();
  });
}

/** The files that import `file`, from rev-dep, or its error when it can't say. */
function importersOf(
  file: string,
): { readonly importers: readonly string[] } | { readonly error: string } {
  const result = spawnSync(revDep, ['imported-by', '--file', file], {
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });
  if (result.status !== 0) {
    const output = `${result.stdout}${result.stderr}`.trim();
    return { error: output || `rev-dep exited with ${result.status ?? result.signal}.` };
  }
  return {
    importers: result.stdout
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean),
  };
}

function run(): number {
  const uses: Use[] = [];
  for (const file of checkedFiles(process.cwd())) {
    const found = importersOf(file);
    if ('error' in found) {
      console.error(`rev-dep couldn't list the importers of ${file}:\n${found.error}`);
      return 1;
    }
    uses.push({ file, importers: found.importers });
  }
  const errors = problems(uses);
  for (const error of errors) console.error(error);
  if (errors.length > 0) return 1;
  console.log(`Every module in ${SHARED_FOLDERS.join(' and ')} is used from two or more folders.`);
  return 0;
}

if (import.meta.main) process.exitCode = run();
