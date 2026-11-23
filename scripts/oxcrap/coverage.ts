// Reads an istanbul JSON coverage report, and works out how much of each function it ran. The
// script never runs the tests itself: whatever runs them writes the report it's given.
import type { Fn, Range } from './functions.ts';

/** One file's entry in an istanbul JSON coverage report. */
export type FileCoverage = {
  statementMap: Record<string, Range>;
  s: Record<string, number>;
  fnMap: Record<string, { loc: Range }>;
  f: Record<string, number>;
};
export type Report = Record<string, FileCoverage>;

/** Whether `file` has every part of an istanbul file entry that the scoring reads. */
function isFileCoverage(file: unknown) {
  const entry = file as Partial<FileCoverage> | null | undefined;
  return Boolean(entry?.statementMap && entry.s && entry.fnMap && entry.f);
}

/** Reads a report's text, keyed by absolute path as istanbul writes it, or says what's wrong. */
export function parseReport(text: string, path: string): Report {
  let report: unknown;
  try {
    report = JSON.parse(text);
  } catch (error) {
    throw new Error(`${path} isn't a JSON coverage report: ${(error as Error).message}`);
  }
  const isObject = report !== null && typeof report === 'object' && !Array.isArray(report);
  if (!isObject || !Object.values(report as object).every(isFileCoverage)) {
    throw new Error(`${path} isn't an istanbul JSON coverage report, such as coverage-final.json.`);
  }
  return report as Report;
}

/**
 * The files changed after the report was written, newest first, so a report made before the
 * latest edits isn't mistaken for one that covers them.
 */
export function newerThan(reportTime: number, files: { file: string; time: number }[]) {
  return files
    .filter((f) => f.time > reportTime)
    .sort((a, b) => b.time - a.time)
    .map((f) => f.file);
}

function before(a: Range['start'], b: Range['start']) {
  return a.line < b.line || (a.line === b.line && a.column <= b.column);
}
function contains(outer: Range, inner: Range) {
  return before(outer.start, inner.start) && before(inner.end, outer.end);
}

/** The innermost of `functions` whose range holds `range`. */
function innermost(functions: Fn[], range: Range) {
  let best: Fn | undefined;
  for (const fn of functions) {
    if (
      contains(fn, range) &&
      (!best || fn.offset.end - fn.offset.start < best.offset.end - best.offset.start)
    ) {
      best = fn;
    }
  }
  return best;
}

/** For each function, how many statements it holds, and how many of them ran. */
function statementCounts(functions: Fn[], file: FileCoverage) {
  const counts = new Map<Fn, { total: number; run: number }>();
  for (const [id, range] of Object.entries(file.statementMap)) {
    const owner = innermost(functions, range);
    if (!owner) continue;
    const count = counts.get(owner) ?? { total: 0, run: 0 };
    count.total++;
    if (file.s[id] > 0) count.run++;
    counts.set(owner, count);
  }
  return counts;
}

/** The functions the report shows were called, for those with no statements of their own. */
function calledFunctions(functions: Fn[], file: FileCoverage) {
  const called = new Set<Fn>();
  for (const [id, fn] of Object.entries(file.fnMap)) {
    const owner = innermost(functions, fn.loc);
    if (owner && file.f[id] > 0) called.add(owner);
  }
  return called;
}

/**
 * The share of each function's statements the tests ran, from 0 to 1. A statement counts toward
 * the innermost of `functions` holding it: with `enclosing` counting only outermost functions are
 * passed, so it's the outermost function around it, as complexity counts nested functions. A
 * function with no statements of its own, such as a one-line arrow, counts as covered when the
 * report shows it was called. A file the report doesn't have scores 0 throughout.
 */
export function coverageOf(functions: Fn[], file: FileCoverage | undefined) {
  const counts = file ? statementCounts(functions, file) : new Map();
  const called = file ? calledFunctions(functions, file) : new Set<Fn>();
  const covered = new Map<Fn, number>();
  for (const fn of functions) {
    const count = counts.get(fn);
    if (count && count.total > 0) covered.set(fn, count.run / count.total);
    else covered.set(fn, called.has(fn) ? 1 : 0);
  }
  return covered;
}
