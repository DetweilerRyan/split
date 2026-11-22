// Finds the files a config's globs pick out, with Node's fs.globSync (stable since Node 22.17).
import { globSync } from 'node:fs';
import { sep } from 'node:path';

const posix = (path: string) => path.split(sep).join('/');
const unique = (paths: string[]) => [...new Set(paths.map(posix))].sort();

/**
 * The files under `root` that `files` match, with paths from `root` and `/` between folders, and
 * `extra` files named outright, which are always scored.
 * - `scored` leaves out everything `ignorePatterns` matches. A folder it matches isn't searched.
 * - `matched` is what a coverage report must be newer than. It leaves out only the folders
 *   `ignorePatterns` names (patterns ending in `/**`, such as `**\/node_modules/**`), so tests
 *   still count.
 */
export function findFiles(
  root: string,
  files: string[],
  ignorePatterns: string[],
  extra: string[] = [],
) {
  const folders = ignorePatterns.filter((pattern) => pattern.endsWith('/**'));
  const find = (exclude: string[]) => globSync(files, { cwd: root, exclude });
  return {
    matched: unique([...find(folders), ...extra]),
    scored: unique([...find(ignorePatterns), ...extra]),
  };
}
