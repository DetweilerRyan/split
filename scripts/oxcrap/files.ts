// Finds the files a config picks out: `files` are Node's fs.globSync patterns (stable since Node
// 22.17); `ignorePatterns`, and the .gitignore in the config's folder, are gitignore-style, as
// oxlint reads them, matched by the `ignore` package from the config's folder. The search itself is
// passed in, so oxcrap.ts gives it the real fs.globSync and a test gives it files in memory.
import { relative, resolve, sep } from 'node:path';
import ignore from 'ignore';

/** A file or folder the search finds, as fs.globSync gives one with `withFileTypes`. */
export type Entry = {
  name: string;
  /** The folder it's in, absolute or from the search's `cwd`. */
  parentPath: string;
  isFile: () => boolean;
  isDirectory: () => boolean;
};

/**
 * Node's fs.globSync with `withFileTypes`: the entries under `cwd` that `patterns` match, not
 * searching a folder `exclude` is true for.
 */
export type Glob = (
  patterns: readonly string[],
  options: { cwd: string; withFileTypes: true; exclude: (entry: Entry) => boolean },
) => Entry[];

function posix(path: string) {
  return path.split(sep).join('/');
}
function unique(paths: readonly string[]) {
  return [...new Set(paths)].sort();
}

/**
 * The files under `root` that `files` match, with paths from `root` and `/` between folders, and
 * `extra` files named outright, which are always scored. `gitignore` is the text of the .gitignore
 * in `root`, or nothing.
 * - A folder `gitignore` or `ignorePatterns` matches isn't searched.
 * - `scored` leaves out every file either matches.
 * - `matched`, which a coverage report must be newer than, leaves out only what `gitignore`
 *   matches. Files `ignorePatterns` alone leaves out, such as tests, still count, but generated
 *   files a .gitignore lists, written after the tests ran, don't.
 */
export function findFiles(
  glob: Glob,
  root: string,
  files: readonly string[],
  ignorePatterns: readonly string[],
  extra: readonly string[],
  gitignore: string,
) {
  const untracked = ignore().add(gitignore);
  const patterns = ignore().add(ignorePatterns);
  // Kept apart, so a `!` in ignorePatterns can't bring back what the .gitignore lists.
  const ignored = { ignores: (path: string) => untracked.ignores(path) || patterns.ignores(path) };
  // A Dirent's parentPath can be relative to the search's cwd, which is `root`, not this process's.
  function from(entry: Entry) {
    return posix(relative(root, resolve(root, entry.parentPath, entry.name)));
  }
  const found = glob(files, {
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
