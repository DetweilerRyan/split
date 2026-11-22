// Finds the files a config picks out: `files` are Node's fs.globSync patterns (stable since Node
// 22.17), and `ignorePatterns` are gitignore-style, as oxlint's are, matched by the `ignore`
// package from the config's folder.
import { type Dirent, globSync } from 'node:fs';
import { relative, resolve, sep } from 'node:path';
import ignore from 'ignore';

const posix = (path: string) => path.split(sep).join('/');
const unique = (paths: string[]) => [...new Set(paths)].sort();

/**
 * The files under `root` that `files` match, with paths from `root` and `/` between folders, and
 * `extra` files named outright, which are always scored.
 * - `scored` leaves out every file `ignorePatterns` matches.
 * - `matched` is what a coverage report must be newer than, so it keeps ignored files, such as
 *   tests. A folder `ignorePatterns` matches is left out of both, and isn't searched.
 */
export function findFiles(
  root: string,
  files: string[],
  ignorePatterns: string[],
  extra: string[] = [],
) {
  const ignored = ignore().add(ignorePatterns);
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
    matched: unique([...found, ...extra]),
    scored: unique([...found.filter((file) => !ignored.ignores(file)), ...extra]),
  };
}
