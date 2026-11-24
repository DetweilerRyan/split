import { posix } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { type Entry, findFiles, type Glob } from './files.ts';

// files.ts over files in memory. oxcrap.ts gives it Node's fs.globSync; the feature contract in
// features/ checks that end to end.

const ROOT = '/repo';
const CODE = ['**/*.ts'];

/** Every folder `path` is in, each ending in `/`, then `path` itself. */
function withFolders(path: string) {
  const parts = path.split('/');
  return parts.map((_, i) => (i < parts.length - 1 ? `${parts.slice(0, i + 1).join('/')}/` : path));
}

/**
 * fs.globSync over `paths`, files from its cwd, in memory. Like Node's, it gives folders as well
 * as files, gives each its folder from the cwd, and doesn't search a folder `exclude` is true for.
 * Patterns are matched with Node's `path.matchesGlob`. Unlike Node's, it asks `exclude` about every
 * folder, even one a pattern names outright, such as `features` in `features/*.ts`.
 */
function inMemory(paths: readonly string[]): Glob {
  const inFolder = new Map<string, [string, Entry][]>();
  for (const path of new Set(paths.flatMap(withFolders))) {
    const folder = path.endsWith('/');
    const name = folder ? path.slice(0, -1) : path;
    const entry: Entry = {
      name: posix.basename(name),
      parentPath: posix.dirname(name),
      isFile: () => !folder,
      isDirectory: () => folder,
    };
    inFolder.set(entry.parentPath, [...(inFolder.get(entry.parentPath) ?? []), [name, entry]]);
  }
  return (patterns, { exclude }) => {
    const found: Entry[] = [];
    function search(folder: string) {
      for (const [path, entry] of inFolder.get(folder) ?? []) {
        if (exclude(entry)) continue;
        if (patterns.some((pattern) => posix.matchesGlob(path, pattern))) found.push(entry);
        if (entry.isDirectory()) search(path);
      }
    }
    search('.');
    return found;
  };
}

/** What findFiles finds among `paths` under ROOT, with `CODE` globs unless `files` says. */
function find(
  paths: readonly string[],
  {
    files = CODE,
    ignorePatterns = [],
    extra = [],
    gitignore = '',
  }: {
    files?: readonly string[];
    ignorePatterns?: readonly string[];
    extra?: readonly string[];
    gitignore?: string;
  } = {},
) {
  return findFiles(inMemory(paths), ROOT, files, ignorePatterns, extra, gitignore);
}

describe('findFiles', () => {
  it('finds the files the globs match, with paths from the root, sorted', () => {
    expect(find(['src/b.ts', 'notes.md', 'src/deep/a.ts', 'a.ts'])).toEqual({
      matched: ['a.ts', 'src/b.ts', 'src/deep/a.ts'],
      scored: ['a.ts', 'src/b.ts', 'src/deep/a.ts'],
    });
  });

  it('finds only files, not folders the globs match', () => {
    expect(find(['lib.ts/index.ts'], { files: ['**'] })).toEqual({
      matched: ['lib.ts/index.ts'],
      scored: ['lib.ts/index.ts'],
    });
  });

  it('finds a file once when several globs match it', () => {
    expect(find(['src/a.ts'], { files: ['src/*.ts', '**/*.ts'] }).scored).toEqual(['src/a.ts']);
  });

  it('leaves the files ignorePatterns match out of scoring, but still counts them against the report', () => {
    expect(find(['src/a.ts', 'src/a.test.ts'], { ignorePatterns: ['*.test.*'] })).toEqual({
      matched: ['src/a.test.ts', 'src/a.ts'],
      scored: ['src/a.ts'],
    });
  });

  it('brings back with `!` a file an earlier pattern left out', () => {
    const ignorePatterns = ['*.test.*', '!keep.test.ts'];
    expect(find(['a.test.ts', 'keep.test.ts'], { ignorePatterns }).scored).toEqual([
      'keep.test.ts',
    ]);
  });

  it('leaves what the .gitignore lists out of both scoring and the report check', () => {
    expect(find(['src/a.ts', 'src/a.gen.ts'], { gitignore: '*.gen.ts\n' })).toEqual({
      matched: ['src/a.ts'],
      scored: ['src/a.ts'],
    });
  });

  it('can’t bring back with a `!` in ignorePatterns what the .gitignore lists', () => {
    const found = find(['a.gen.ts'], { gitignore: '*.gen.ts', ignorePatterns: ['!a.gen.ts'] });
    expect(found).toEqual({ matched: [], scored: [] });
  });

  it('doesn’t search a folder ignorePatterns or the .gitignore lists, even to bring a file back', () => {
    const paths = ['build/a.ts', 'vendor/b.ts', 'src/c.ts'];
    const ignorePatterns = ['vendor/', '!vendor/b.ts'];
    expect(find(paths, { gitignore: 'build/', ignorePatterns })).toEqual({
      matched: ['src/c.ts'],
      scored: ['src/c.ts'],
    });
  });

  it('tells a folder from a file of the same name, as gitignore does by its trailing slash', () => {
    const paths = ['out/a.ts', 'src/out', 'src/b.ts'];
    expect(find(paths, { files: ['**'], ignorePatterns: ['out/'] }).scored).toEqual([
      'src/b.ts',
      'src/out',
    ]);
  });

  it('doesn’t search a folder a pattern with no trailing slash matches, as gitignore doesn’t', () => {
    expect(find(['a.test.ts/b.ts', 'c.ts'], { ignorePatterns: ['*.test.ts'] })).toEqual({
      matched: ['c.ts'],
      scored: ['c.ts'],
    });
  });

  it('always scores files named outright, sorted in with the rest and listed once', () => {
    const found = find(['src/b.ts', 'src/a.test.ts'], {
      files: [],
      ignorePatterns: ['*.test.*'],
      extra: ['src/a.test.ts', 'src/0.ts', 'src/a.test.ts'],
    });
    expect(found).toEqual({
      matched: ['src/0.ts', 'src/a.test.ts'],
      scored: ['src/0.ts', 'src/a.test.ts'],
    });
  });

  it('asks the glob for file types, from the root', () => {
    const glob = vi.fn<Glob>(() => []);
    findFiles(glob, ROOT, CODE, [], [], '');
    expect(glob.mock.calls).toEqual([
      [CODE, { cwd: ROOT, withFileTypes: true, exclude: expect.any(Function) }],
    ]);
  });

  it('reads an absolute parentPath, as Node’s glob gives one, from the root', () => {
    function glob(): Entry[] {
      return [
        { name: 'a.ts', parentPath: '/repo/src', isFile: () => true, isDirectory: () => false },
      ];
    }
    expect(findFiles(glob, ROOT, CODE, [], [], '').scored).toEqual(['src/a.ts']);
  });
});
