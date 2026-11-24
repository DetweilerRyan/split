#!/usr/bin/env node
// oxCrap's command line: scores every function its config picks out by CRAP, from a coverage
// report, and fails on one over the limits without a matching @crap-allow comment. What CRAP is,
// the options, the config file and the comment's rules are in README.md beside this file; why it
// works this way is in oxcrap.meta.md, to read only when changing or questioning it.
//
// This file only connects run.ts and files.ts to the real file system and the process; they do
// the work.
// Node runs this as TypeScript by stripping the types, so use only syntax that erases: no enums,
// namespaces or parameter properties.
import { existsSync, globSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { findFiles } from './files.ts';
import { type Host, run } from './run.ts';

/** The .gitignore in `root`, if there is one, as text the `ignore` package takes. */
function gitignoreIn(root: string) {
  const path = join(root, '.gitignore');
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

const host: Host = {
  cwd: process.cwd(),
  caseInsensitive: process.platform === 'win32',
  exists: existsSync,
  isDirectory: (path) => statSync(path).isDirectory(),
  read: (path) => readFileSync(path, 'utf8'),
  modified: (path) => statSync(path).mtimeMs,
  realpath: (path) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  },
  findFiles: (root, globs, ignorePatterns, named) =>
    findFiles(globSync, root, globs, ignorePatterns, named, gitignoreIn(root)),
};

const { status, stdout, stderr } = run(process.argv.slice(2), host);
for (const line of stdout) console.log(line);
for (const line of stderr) console.error(line);
process.exitCode = status;
