// Finds the files a config's globs pick out.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { baseOf, globToRegExp, matchesAny } from './glob.ts';

/**
 * The files under `root` that match `files`, with paths from `root` and `/` between folders. It
 * starts from the fixed part of each glob, and doesn't search a folder `ignorePatterns` matches.
 * `matched` is every file found, which a coverage report must be newer than, tests included;
 * `scored` leaves out the files `ignorePatterns` matches.
 */
export function findFiles(root: string, files: string[], ignorePatterns: string[]) {
  const include = files.map(globToRegExp);
  const ignore = ignorePatterns.map(globToRegExp);
  const matched = new Set<string>();

  const walk = (folder: string) => {
    const at = folder === '.' ? root : join(root, folder);
    if (!existsSync(at)) return;
    if (!statSync(at).isDirectory()) {
      if (matchesAny(folder, include)) matched.add(folder);
      return;
    }
    for (const entry of readdirSync(at, { withFileTypes: true })) {
      const path = folder === '.' ? entry.name : `${folder}/${entry.name}`;
      if (entry.isDirectory()) {
        if (!matchesAny(`${path}/`, ignore)) walk(path);
      } else if (entry.isFile() && matchesAny(path, include)) {
        matched.add(path);
      }
    }
  };
  for (const base of new Set(files.map(baseOf))) walk(base);

  const all = [...matched].sort();
  return { matched: all, scored: all.filter((path) => !matchesAny(path, ignore)) };
}
