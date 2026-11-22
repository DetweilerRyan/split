// The CRAP rules: which functions are over the limits, and which @crap-allow comments no longer
// match their function.
import type { Allow, Finding } from './allow.ts';
import type { Limits } from './config.ts';
import type { Fn } from './functions.ts';

export type Scored = { fn: Fn; file: string; coverage: number; crap: number };

/** CRAP: complexity² × (1 − coverage)³ + complexity, with coverage from 0 to 1. */
export const crapOf = (complexity: number, coverage: number) =>
  complexity ** 2 * (1 - coverage) ** 3 + complexity;

const round = (n: number) => Math.round(n * 10) / 10;
const numbers = (s: Scored) => `CRAP ${round(s.crap)}, complexity ${s.fn.complexity}`;
const describe = (s: Scored) =>
  `${s.fn.name}: ${numbers(s)}, coverage ${Math.round(s.coverage * 100)}%`;

const order = (a: Finding, b: Finding) =>
  a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1;

/**
 * Every function is checked: one over the limits fails unless a @crap-allow comment gives its
 * current numbers, and a comment fails when its numbers don't match its function or its function
 * is within the limits.
 */
export function check(scored: Scored[], allowed: Map<Fn, Allow>, limits: Limits) {
  const overLimit = (s: Scored) => s.crap > limits.crap || s.fn.complexity > limits.complexity;
  const problems: Finding[] = [];
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
    } else if (overLimit(s)) {
      problems.push({
        file: s.file,
        line: s.fn.start.line,
        message: `${describe(s)}. Over the limits (CRAP ${limits.crap}, complexity ${limits.complexity}). To leave it, add \`// @crap-allow ${numbers(s)}. <reason>\` directly above it.`,
      });
    }
  }
  return problems.sort(order);
}
