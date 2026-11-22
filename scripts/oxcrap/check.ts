// The CRAP rules: which functions are over the limits, and which @crap-allow comments no longer
// match their function.
import type { Allow, Finding } from './allow.ts';
import { type Changed, isChanged } from './diff.ts';
import type { Fn } from './functions.ts';

export const MAX_CRAP = 30;
export const MAX_COMPLEXITY = 10;

export type Scored = { fn: Fn; file: string; coverage: number; crap: number };

/** CRAP: complexity² × (1 − coverage)³ + complexity, with coverage from 0 to 1. */
export const crapOf = (complexity: number, coverage: number) =>
  complexity ** 2 * (1 - coverage) ** 3 + complexity;

const round = (n: number) => Math.round(n * 10) / 10;
const overLimit = (s: Scored) => s.crap > MAX_CRAP || s.fn.complexity > MAX_COMPLEXITY;
const numbers = (s: Scored) => `CRAP ${round(s.crap)}, complexity ${s.fn.complexity}`;
const describe = (s: Scored) =>
  `${s.fn.name}: ${numbers(s)}, coverage ${Math.round(s.coverage * 100)}%`;

const order = (a: Finding, b: Finding) =>
  a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1;

/**
 * Problems fail the check: a changed function over the limits with no @crap-allow comment, and
 * any comment whose numbers don't match its function or whose function is within the limits.
 * Notices are the comments the branch adds or changes, for the owner to see.
 */
export function check(scored: Scored[], allowed: Map<Fn, Allow>, changed: Changed) {
  const problems: Finding[] = [];
  const notices: Finding[] = [];
  for (const s of scored) {
    const allow = allowed.get(s.fn);
    if (allow) {
      const at = { file: allow.file, line: allow.line };
      if (!overLimit(s)) {
        problems.push({
          ...at,
          message: `${describe(s)}. It's within the limits now, so delete its @crap-allow comment.`,
        });
      } else if (round(s.crap) !== allow.crap || s.fn.complexity !== allow.complexity) {
        problems.push({
          ...at,
          message: `${describe(s)}, but its @crap-allow comment says CRAP ${allow.crap}, complexity ${allow.complexity}. Update the comment to \`// @crap-allow ${numbers(s)}.\`, and check its reason still holds.`,
        });
      }
      if (isChanged(changed.get(allow.file), allow.line, allow.lastLine)) {
        notices.push({
          ...at,
          message: `Adds or changes the @crap-allow comment for ${s.fn.name} (CRAP ${allow.crap}, complexity ${allow.complexity}). Its reason: ${allow.reason || '(none)'}`,
        });
      }
    } else if (overLimit(s) && isChanged(changed.get(s.file), s.fn.start.line, s.fn.end.line)) {
      problems.push({
        file: s.file,
        line: s.fn.start.line,
        message: `${describe(s)}. Over the limits (CRAP ${MAX_CRAP}, complexity ${MAX_COMPLEXITY}). To leave it, add \`// @crap-allow ${numbers(s)}. <reason>\` directly above it.`,
      });
    }
  }
  return { problems: problems.sort(order), notices: notices.sort(order) };
}
