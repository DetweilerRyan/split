// Finds the files a config picks out: `files` are Node's fs.globSync patterns (stable since Node
// 22.17); `ignorePatterns`, and the .gitignore in the config's folder, are gitignore-style, as
// oxlint reads them, matched by the `ignore` package from the config's folder.
import { type Dirent, existsSync, globSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import ignore from 'ignore';

const posix = (path: string) => path.split(sep).join('/');
const unique = (paths: string[]) => [...new Set(paths)].sort();

/** The .gitignore in `root`, if there is one, as text the `ignore` package takes. */
export const gitignoreIn = (root: string) => {
  const path = join(root, '.gitignore');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
};

/**
 * The files under `root` that `files` match, with paths from `root` and `/` between folders, and
 * `extra` files named outright, which are always scored.
 * - A folder `gitignore` or `ignorePatterns` matches isn't searched.
 * - `scored` leaves out every file either matches.
 * - `matched`, which a coverage report must be newer than, leaves out only what `gitignore`
 *   matches. Files `ignorePatterns` alone leaves out, such as tests, still count, but generated
 *   files a .gitignore lists, written after the tests ran, don't.
 */
export function findFiles(
  root: string,
  files: string[],
  ignorePatterns: string[],
  extra: string[] = [],
  gitignore = '',
) {
  const untracked = ignore().add(gitignore);
  const patterns = ignore().add(ignorePatterns);
  // Kept apart, so a `!` in ignorePatterns can't bring back what the .gitignore lists.
  const ignored = { ignores: (path: string) => untracked.ignores(path) || patterns.ignores(path) };
  // A Dirent's parentPath is relative to the search's cwd, which is `root`, not this process's.
  const from = (entry: Dirent) =>
    posix(relative(root, resolve(root, entry.parentPath, entry.name)));
  const found = globSync(files, {
    cwd: root,
    withFileTypes: true,
    // gitignore tells a folder by its trailing slash.
    exclude: (entry) => entry.isDirectory() && ignored.ignores(`${from(entry)}/`),
  })
    .filter((entry) => entry.isFile())
    .map(from);
  return {
    matched: unique([...found.filter((file) => !untracked.ignores(file)), ...extra]),
    scored: unique([...found.filter((file) => !ignored.ignores(file)), ...extra]),
  };
}
