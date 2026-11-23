import { mkdirSync, readFileSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Covered, Task } from './actor.ts';

/** Writes `content` to `path` in the actor's project, making its folders. */
export const writesFile =
  (path: string, content: string): Task =>
  (actor) => {
    const file = join(actor.project, path);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content.endsWith('\n') ? content : `${content}\n`);
  };

/** A function with `complexity - 1` if statements, so its complexity is `complexity`. */
export function functionSource(name: string, complexity: number) {
  const ifs = Array.from({ length: complexity - 1 }, (_, i) => `  if (n === ${i}) return ${i};`);
  return `export function ${name}(n: number) {\n${ifs.join('\n')}\n  return -1;\n}\n`;
}

/** Writes a file holding one function with the given complexity, below `above` if given. */
export const writesFunction = (path: string, name: string, complexity: number, above = ''): Task =>
  writesFile(path, `${above}${functionSource(name, complexity)}`);

/**
 * Records that a test run covered `path` (`all` or `none` of its statements), and writes
 * coverage.json as the run would: one statement per non-blank line of each file it ran. It's
 * written now, so it's newer than the code written before it.
 */
export const runsTests =
  (path: string, covered: string): Task =>
  (actor) => {
    if (covered !== 'all' && covered !== 'none') throw new Error(`"${covered}" isn't all or none.`);
    const runs = actor.has('coverage') ? actor.recall('coverage') : new Map<string, Covered>();
    runs.set(path, covered as Covered);
    actor.remember('coverage', runs);
    const report: Record<string, unknown> = {};
    for (const [file, share] of runs) {
      const statementMap: Record<string, unknown> = {};
      const s: Record<string, number> = {};
      readFileSync(join(actor.project, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (!line.trim()) return;
          statementMap[index] = {
            start: { line: index + 1, column: 0 },
            end: { line: index + 1, column: line.length },
          };
          s[index] = share === 'all' ? 1 : 0;
        });
      report[resolve(actor.project, file)] = {
        statementMap,
        s,
        fnMap: {},
        f: {},
        branchMap: {},
        b: {},
      };
    }
    writeFileSync(join(actor.project, 'coverage.json'), JSON.stringify(report));
  };

/** Makes `path` look changed after the test run, by moving its time a minute later. */
export const changesAfterTheTests =
  (path: string): Task =>
  (actor) => {
    const later = new Date(Date.now() + 60_000);
    utimesSync(join(actor.project, path), later, later);
  };

/** Writes `comment` on its own line directly above the function `fn` in `path`. */
export const writesCommentAbove =
  (path: string, fn: string, comment: string): Task =>
  (actor) => {
    const file = join(actor.project, path);
    const declaration = `export function ${fn}(`;
    const source = readFileSync(file, 'utf8');
    if (!source.includes(declaration)) throw new Error(`${path} has no function ${fn}.`);
    writeFileSync(file, source.replace(declaration, `${comment}\n${declaration}`));
  };

/** Writes a coverage report for `path` that has statements but none of the function counts. */
export const writesReportWithoutFunctions =
  (path: string): Task =>
  (actor) => {
    const report = { [resolve(actor.project, path)]: { statementMap: {}, s: {} } };
    writeFileSync(join(actor.project, 'coverage.json'), JSON.stringify(report));
  };

/** Links the project folder as `name` inside another folder, to run the check from there. */
export const linksTheProject =
  (name: string): Task =>
  (actor) => {
    const other = actor.elsewhere();
    symlinkSync(actor.project, join(other, name), 'dir');
    actor.remember('otherFolder', other);
  };

/**
 * Runs the check with a command line such as `oxcrap --coverage coverage.json src`, from the
 * project folder, a folder in it, or the other folder the project is linked from.
 */
export const runsTheCheck =
  (commandLine: string, where: { in?: string; inTheOtherFolder?: boolean } = {}): Task =>
  (actor) => {
    const [program, ...args] = commandLine.split(/\s+/).filter(Boolean);
    if (program !== 'oxcrap')
      throw new Error(`Expected a command starting "oxcrap": ${commandLine}`);
    const cwd = where.inTheOtherFolder
      ? actor.recall('otherFolder')
      : join(actor.project, where.in ?? '');
    actor.remember('run', actor.runsTheCheck(args, cwd));
  };
