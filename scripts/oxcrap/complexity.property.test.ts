import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Counting } from './complexity.ts';
import { parse } from './functions.ts';

// Random functions from a small grammar that knows what it writes, so the expected complexity comes
// from the generator, not from running the counter. It keeps apart the kinds of branch each
// counting option decides on, so one property checks every combination of the options. fast-check
// shrinks a failure to the smallest function that breaks the count. The code is only parsed, never
// run, so its names needn't exist.

/** What a piece of code adds, by kind: each kind is counted, or not, as an option says. */
type Tally = {
  branches: number;
  defaults: number;
  optional: number;
  /** Non-default `case`s, and the `switch`es they're in. */
  cases: number;
  switches: number;
  /** `&&`, `||` and `??` operators, and the runs of the same operator they form. */
  operators: number;
  sequences: number;
  /** `break` and `continue` to a label. */
  jumps: number;
  /** Calls of the function being scored, `subject()`. */
  recursion: number;
};
/** A piece of code, what it adds itself, and what the functions nested in it hold. */
type Code = { code: string; own: Tally; nested: Tally };

const NONE: Tally = {
  branches: 0,
  defaults: 0,
  optional: 0,
  cases: 0,
  switches: 0,
  operators: 0,
  sequences: 0,
  jumps: 0,
  recursion: 0,
};
const add = (...tallies: Tally[]): Tally =>
  Object.fromEntries(
    Object.keys(NONE).map((kind) => [
      kind,
      tallies.reduce((sum, t) => sum + t[kind as keyof Tally], 0),
    ]),
  ) as Tally;
const leaf = (code: string, tally: Partial<Tally> = {}): Code => ({
  code,
  own: { ...NONE, ...tally },
  nested: NONE,
});
const join = (parts: Code[]): Code => ({
  code: parts.map((part) => part.code).join('\n'),
  own: add(...parts.map((part) => part.own)),
  nested: add(...parts.map((part) => part.nested)),
});
/** `code` wrapped around `inner`, adding `branches` of its own. */
const wrap = (code: string, branches: number, ...inner: Code[]): Code => ({
  code,
  own: add({ ...NONE, branches }, ...inner.map((part) => part.own)),
  nested: add(...inner.map((part) => part.nested)),
});
/** A function nested in the code around it: everything in it, and its own defaults, is nested. */
const nest = (code: string, inner: Code, defaults = 0): Code => ({
  code,
  own: NONE,
  nested: add(inner.own, inner.nested, { ...NONE, defaults }),
});

const { statements } = fc.letrec<{ statement: Code; statements: Code }>((tie) => {
  const body = tie('statements');
  return {
    statements: fc.array(tie('statement'), { maxLength: 3 }).map(join),
    statement: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      // No branch.
      fc.constantFrom(leaf('n++;'), leaf('n = n + 1;')),
      // Optional links and default values, which the options count or not.
      fc
        .integer({ min: 1, max: 3 })
        .map((links) => leaf(`void obj${'?.a'.repeat(links)};`, { optional: links })),
      fc.constant(leaf('void obj.f?.();', { optional: 1 })),
      fc
        .integer({ min: 1, max: 3 })
        .map((count) =>
          leaf(
            `const { ${Array.from({ length: count }, (_, i) => `d${i} = ${i}`).join(', ')} } = obj;`,
            { defaults: count },
          ),
        ),
      // Expressions: a ?: over a run of &&, one sequence of its operators.
      fc
        .integer({ min: 1, max: 4 })
        .map((operators) =>
          leaf(
            `n = ${Array.from({ length: operators + 1 }, (_, i) => `x${i}`).join(' && ')} ? 1 : 0;`,
            { branches: 1, operators, sequences: 1 },
          ),
        ),
      // `&&` inside `||`: two operators, and two sequences, since they differ.
      fc.constant(leaf('n = x0 && x1 || x2;', { operators: 2, sequences: 2 })),
      // A run of ?? is one sequence.
      fc.constant(leaf('n = x0 ?? x1 ?? x2;', { operators: 2, sequences: 1 })),
      fc
        .constantFrom('||=', '&&=', '??=')
        .map((operator) => leaf(`n ${operator} 1;`, { branches: 1 })),
      fc.constant(leaf('n = obj.x ?? 0;', { operators: 1, sequences: 1 })),
      // A call of the function being scored.
      fc.constant(leaf('subject();', { recursion: 1 })),
      // Statements that branch, around bodies of their own.
      body.map((s) => wrap(`if (a) {\n${s.code}\n}`, 1, s)),
      fc
        .tuple(body, body)
        .map(([s, t]) => wrap(`if (a) {\n${s.code}\n} else {\n${t.code}\n}`, 1, s, t)),
      fc
        .tuple(body, body, body)
        .map(([s, t, u]) =>
          wrap(
            `if (a) {\n${s.code}\n} else if (b) {\n${t.code}\n} else {\n${u.code}\n}`,
            2,
            s,
            t,
            u,
          ),
        ),
      body.map((s) => wrap(`for (let i = 0; i < n; i++) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`for (const x of xs) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`for (const k in obj) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`while (n < 10) {\n${s.code}\n}`, 1, s)),
      body.map((s) => wrap(`do {\n${s.code}\n} while (n < 10);`, 1, s)),
      fc
        .tuple(body, body)
        .map(([s, t]) => wrap(`try {\n${s.code}\n} catch {\n${t.code}\n}`, 1, s, t)),
      body.map((s) => wrap(`try {\n${s.code}\n} finally {\n}`, 0, s)),
      fc
        .tuple(body, body, body)
        .map(([s, t, u]) =>
          wrap(`try {\n${s.code}\n} catch {\n${t.code}\n} finally {\n${u.code}\n}`, 1, s, t, u),
        ),
      fc
        .tuple(fc.array(body, { minLength: 1, maxLength: 3 }), fc.boolean())
        .map(([cases, withDefault]) => {
          const code = `switch (n) {\n${cases.map((c, i) => `case ${i}: {\n${c.code}\nbreak;\n}`).join('\n')}${withDefault ? '\ndefault:\nbreak;' : ''}\n}`;
          const inner = join(cases);
          return {
            code,
            own: add(inner.own, { ...NONE, cases: cases.length, switches: 1 }),
            nested: inner.nested,
          };
        }),
      // A labelled loop, with a jump to its label.
      fc
        .tuple(body, fc.nat({ max: 999 }))
        .map(([s, id]) =>
          wrap(`L${id}: for (const x of xs) {\n${s.code}\nif (a) continue L${id};\n}`, 2, s),
        )
        .map((code) => ({ ...code, own: add(code.own, { ...NONE, jumps: 1 }) })),
      // Nested functions: assigned, passed to a call, and with default parameters.
      fc
        .tuple(body, fc.nat({ max: 999 }))
        .map(([s, id]) => nest(`const inner${id} = () => {\n${s.code}\n};`, s)),
      body.map((s) => nest(`items.forEach((item) => {\n${s.code}\n});`, s)),
      fc
        .tuple(body, fc.integer({ min: 1, max: 2 }))
        .map(([s, count]) =>
          nest(
            `run(function (${Array.from({ length: count }, (_, i) => `p${i} = ${i}`).join(', ')}) {\n${s.code}\n});`,
            s,
            count,
          ),
        ),
    ),
  };
});

/** What `tally` adds under `counting`, leaving recursion to the function as a whole. */
const counted = (tally: Tally, counting: Counting) =>
  tally.branches +
  (counting.defaultValues ? tally.defaults : 0) +
  (counting.optionalChaining ? tally.optional : 0) +
  (counting.switchCases === 'each' ? tally.cases : tally.switches) +
  (counting.logicalOperators === 'each' ? tally.operators : tally.sequences) +
  (counting.labelledJumps ? tally.jumps : 0);

const countings: fc.Arbitrary<Counting> = fc.record({
  nestedFunctions: fc.constantFrom('enclosing' as const, 'own' as const),
  defaultValues: fc.boolean(),
  optionalChaining: fc.boolean(),
  switchCases: fc.constantFrom('each' as const, 'once' as const),
  logicalOperators: fc.constantFrom('each' as const, 'sequence' as const),
  recursion: fc.boolean(),
  labelledJumps: fc.boolean(),
});

describe('complexity of generated functions', () => {
  it('is 1 plus the branches each counting option counts', () => {
    fc.assert(
      fc.property(statements, countings, ({ code, own, nested }, counting) => {
        const source = `export function subject() {\n${code}\n}\n`;
        const subject = parse('generated.ts', source, counting).functions.find(
          (fn) => fn.name === 'subject',
        );
        const enclosing = counting.nestedFunctions === 'enclosing';
        const inside = enclosing ? counted(nested, counting) : 0;
        // Calling itself puts it in a recursion cycle once, however many calls; a nested
        // function's call counts only when that function is part of it.
        const calls = own.recursion + (enclosing ? nested.recursion : 0);
        const recursive = counting.recursion && calls > 0 ? 1 : 0;
        expect(subject?.complexity).toBe(1 + counted(own, counting) + inside + recursive);
      }),
      { numRuns: 1000 },
    );
  });
});
